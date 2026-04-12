"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

function getSafeCustomerActionError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "Please review the form fields and try again.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "A customer with this code already exists in your company.";
    }
    if (error.code === "P2003") {
      return "Unable to save customer because your branch assignment is invalid. Please contact an administrator.";
    }
  }
  return "Unable to save customer right now. Please try again.";
}

async function getContext() {
  return enforceActionPermission("CUSTOMERS", "EDIT");
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

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "CUSTOMER",
        entityId: created.id,
        action: "CREATE",
        actorId: ctx.userId,
        afterJson: {
          code: parsed.code.toUpperCase(),
          legalName: parsed.legalName,
        },
      },
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("[createCustomerAction] failed", {
      error,
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: getSafeCustomerActionError(error) };
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

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "CUSTOMER",
        entityId: updated.id,
        action: "UPDATE",
        actorId: ctx.userId,
        beforeJson: before ?? undefined,
        afterJson: updated,
      },
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

    await prisma.customer.delete({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "CUSTOMER",
        entityId: id,
        action: "DELETE",
        actorId: ctx.userId,
        beforeJson: before ?? undefined,
      },
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
