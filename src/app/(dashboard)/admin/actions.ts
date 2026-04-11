"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ActivityAction, ActivityActorType, EntityType, UserRole } from "@prisma/client";
import { z } from "zod";

import { recordAuditEvent, recordEntityDiff } from "@/lib/audit";
import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type AdminUserActionState = {
  success: boolean;
  error?: string;
};

const userRoleValues = Object.values(UserRole);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(128),
  role: z.enum(userRoleValues as [UserRole, ...UserRole[]]),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  role: z.enum(userRoleValues as [UserRole, ...UserRole[]]),
  isActive: z.boolean().default(true),
});

const resetPasswordSchema = z.object({
  id: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

async function assertRoleExists(companyId: string, role: UserRole) {
  const existing = await prisma.role.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: role,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error(`Role ${role} is not configured`);
  }
}

async function syncUserRoleAssignment(companyId: string, userId: string, role: UserRole) {
  const roleRecord = await prisma.role.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: role,
      },
    },
    select: { id: true },
  });

  if (!roleRecord) {
    return;
  }

  await prisma.userRoleAssignment.deleteMany({ where: { userId } });
  await prisma.userRoleAssignment.create({
    data: {
      userId,
      roleId: roleRecord.id,
    },
  });
}

function getAuditActor(ctx: { userId: string }) {
  return {
    actorType: ActivityActorType.USER,
    actorId: ctx.userId,
  };
}

export async function createAdminUserAction(
  _prevState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const ctx = await enforceActionPermission("ADMIN", "CREATE");
    const parsed = createUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
      isActive: formData.get("isActive") === "on",
    });

    await assertRoleExists(ctx.companyId, parsed.role);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const created = await prisma.user.create({
      data: {
        companyId: ctx.companyId,
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash,
        role: parsed.role,
        isActive: parsed.isActive,
      },
      select: {
        id: true,
      },
    });

    await syncUserRoleAssignment(ctx.companyId, created.id, parsed.role);

    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.USER,
      entityId: created.id,
      action: ActivityAction.CREATE,
      summary: `User ${parsed.name} created.`,
      after: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        role: parsed.role,
        isActive: parsed.isActive,
      },
      actor: getAuditActor(ctx),
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/permissions");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateAdminUserAction(
  _prevState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const ctx = await enforceActionPermission("ADMIN", "EDIT");
    const parsed = updateUserSchema.parse({
      id: formData.get("id"),
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      isActive: formData.get("isActive") === "on",
    });

    await assertRoleExists(ctx.companyId, parsed.role);

    const existing = await prisma.user.findFirst({
      where: {
        id: parsed.id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw new Error("User not found");
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        role: parsed.role,
        isActive: parsed.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await syncUserRoleAssignment(ctx.companyId, updated.id, parsed.role);

    await recordEntityDiff({
      companyId: ctx.companyId,
      entityType: EntityType.USER,
      entityId: updated.id,
      action: ActivityAction.UPDATE,
      before: existing as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      trackedFields: ["name", "email", "role", "isActive"],
      actor: getAuditActor(ctx),
      fallbackSummary: `User ${updated.name} updated.`,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${updated.id}`);
    revalidatePath("/admin/permissions");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function toggleAdminUserActiveAction(formData: FormData): Promise<void> {
  const ctx = await enforceActionPermission("ADMIN", "EDIT");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("User id is required");
  }

  const existing = await prisma.user.findFirst({
    where: {
      id,
      companyId: ctx.companyId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive },
  });

  await recordAuditEvent({
    companyId: ctx.companyId,
    entityType: EntityType.USER,
    entityId: existing.id,
    action: ActivityAction.STATUS_CHANGE,
    field: "isActive",
    oldValue: String(existing.isActive),
    newValue: String(!existing.isActive),
    summary: `User ${existing.id} ${existing.isActive ? "deactivated" : "activated"}.`,
    metadata: {
      source: "toggleAdminUserActiveAction",
    },
    actor: getAuditActor(ctx),
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${existing.id}`);
}

export async function resetAdminUserPasswordAction(
  _prevState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const ctx = await enforceActionPermission("ADMIN", "EDIT");
    const parsed = resetPasswordSchema.parse({
      id: formData.get("id"),
      newPassword: formData.get("newPassword"),
    });

    const existing = await prisma.user.findFirst({
      where: {
        id: parsed.id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new Error("User not found");
    }

    const passwordHash = await bcrypt.hash(parsed.newPassword, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });

    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.USER,
      entityId: existing.id,
      action: ActivityAction.UPDATE,
      summary: "User password reset.",
      metadata: {
        passwordReset: true,
      },
      actor: getAuditActor(ctx),
    });

    revalidatePath(`/admin/users/${existing.id}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
