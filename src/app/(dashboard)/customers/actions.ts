"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActivityAction, ActivityActorType, EntityType } from "@prisma/client";

import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent, recordEntityDiff } from "@/lib/audit";

const customerSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2).max(30),
  legalName: z.string().min(2).max(180),
  tradeName: z.string().max(180).optional(),
  taxId: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(240).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  isActive: z.boolean().default(true),
});

export type CustomerActionState = {
  success: boolean;
  error?: string;
};

async function getContext() {
  return enforceActionPermission("CUSTOMERS", "EDIT");
}

function getAuditActor(ctx: { userId: string }) {
  return {
    actorType: ActivityActorType.USER,
    actorId: ctx.userId,
  };
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const ctx = await getContext();
    await enforceActionPermission("CUSTOMERS", "CREATE");

    const parsed = customerSchema.parse({
      code: formData.get("code"),
      legalName: formData.get("legalName"),
      tradeName: formData.get("tradeName") || undefined,
      taxId: formData.get("taxId") || undefined,
      country: formData.get("country") || undefined,
      city: formData.get("city") || undefined,
      address: formData.get("address") || undefined,
      paymentTermsDays: formData.get("paymentTermsDays") || 30,
      isActive: formData.get("isActive") === "on",
    });

    const created = await prisma.customer.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId ?? undefined,
        code: parsed.code.toUpperCase(),
        legalName: parsed.legalName,
        tradeName: parsed.tradeName,
        taxId: parsed.taxId,
        country: parsed.country,
        city: parsed.city,
        address: parsed.address,
        paymentTermsDays: parsed.paymentTermsDays,
        isActive: parsed.isActive,
      },
    });

    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.CUSTOMER,
      entityId: created.id,
      action: ActivityAction.CREATE,
      customerId: created.id,
      summary: `Customer ${created.code} created.`,
      after: created as unknown as Record<string, unknown>,
      actor: getAuditActor(ctx),
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const ctx = await getContext();
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Customer id is required");
    }

    const parsed = customerSchema.parse({
      id,
      code: formData.get("code"),
      legalName: formData.get("legalName"),
      tradeName: formData.get("tradeName") || undefined,
      taxId: formData.get("taxId") || undefined,
      country: formData.get("country") || undefined,
      city: formData.get("city") || undefined,
      address: formData.get("address") || undefined,
      paymentTermsDays: formData.get("paymentTermsDays") || 30,
      isActive: formData.get("isActive") === "on",
    });

    const before = await prisma.customer.findFirst({
      where: {
        id: parsed.id,
        companyId: ctx.companyId,
      },
    });
    if (!before) {
      throw new Error("Customer not found");
    }

    const updated = await prisma.customer.update({
      where: {
        id: parsed.id,
        companyId: ctx.companyId,
      },
      data: {
        code: parsed.code.toUpperCase(),
        legalName: parsed.legalName,
        tradeName: parsed.tradeName,
        taxId: parsed.taxId,
        country: parsed.country,
        city: parsed.city,
        address: parsed.address,
        paymentTermsDays: parsed.paymentTermsDays,
        isActive: parsed.isActive,
      },
    });

    await recordEntityDiff({
      companyId: ctx.companyId,
      entityType: EntityType.CUSTOMER,
      entityId: updated.id,
      action: ActivityAction.UPDATE,
      customerId: updated.id,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      trackedFields: [
        "code",
        "legalName",
        "tradeName",
        "taxId",
        "country",
        "city",
        "address",
        "paymentTermsDays",
        "isActive",
      ],
      actor: getAuditActor(ctx),
      fallbackSummary: `Customer ${updated.code} updated.`,
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const ctx = await enforceActionPermission("CUSTOMERS", "DELETE");
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Customer id is required");
    }

    const before = await prisma.customer.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });
    if (!before) {
      throw new Error("Customer not found");
    }

    await prisma.customer.delete({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });

    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.CUSTOMER,
      entityId: id,
      action: ActivityAction.DELETE,
      customerId: id,
      summary: `Customer ${before.code} deleted.`,
      before: before as unknown as Record<string, unknown>,
      actor: getAuditActor(ctx),
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteCustomerDirectAction(formData: FormData): Promise<void> {
  const result = await deleteCustomerAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to delete customer");
  }
}
