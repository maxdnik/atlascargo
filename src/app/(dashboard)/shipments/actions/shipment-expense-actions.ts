"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

import { expenseSchema } from "./schemas";
import {
  assertShipmentAccess,
  getContext,
  normalizeOptional,
  parseFinancialStatus,
  resolveAmountBase,
  toDate,
  toDecimal,
  wrapDirectAction,
} from "./shared";
import type { ShipmentActionState } from "./types";

export async function upsertExpenseAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const parsed = expenseSchema.parse({
      id: formData.get("id") || undefined,
      shipmentId: formData.get("shipmentId"),
      supplierName: formData.get("supplierName"),
      concept: formData.get("concept"),
      amount: formData.get("amount"),
      currencyCode: formData.get("currencyCode"),
      exchangeRate: formData.get("exchangeRate") || undefined,
      dueDate: String(formData.get("dueDate") || ""),
      status: parseFinancialStatus(formData.get("status")),
      notes: formData.get("notes") || undefined,
    });

    const shipment = await assertShipmentAccess(ctx.companyId, parsed.shipmentId);
    const dueDate = toDate(parsed.dueDate);
    const exchangeRate = toDecimal(parsed.exchangeRate);
    const amountBase = resolveAmountBase({
      amount: parsed.amount,
      currencyCode: parsed.currencyCode,
      exchangeRate,
    });
    const payload = {
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? undefined,
      shipmentId: shipment.id,
      supplierName: parsed.supplierName.trim(),
      concept: parsed.concept.trim(),
      amount: parsed.amount,
      currencyCode: parsed.currencyCode,
      exchangeRate,
      amountBase,
      dueDate,
      status: parsed.status,
      notes: normalizeOptional(parsed.notes),
    };

    if (parsed.id) {
      const existing = await prisma.expense.findFirst({
        where: {
          id: parsed.id,
          companyId: ctx.companyId,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Expense record not found");
      }
      await prisma.expense.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.expense.create({ data: payload });
    }

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export const upsertExpenseDirectAction = wrapDirectAction(
  upsertExpenseAction,
  "Unable to save expense record",
);

export async function deleteExpenseAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Expense id is required");
    }

    const existing = await prisma.expense.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
      },
    });
    if (!existing) {
      throw new Error("Expense record not found");
    }

    await prisma.expense.delete({ where: { id: existing.id } });
    revalidatePath(`/shipments/${existing.shipmentId}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export const deleteExpenseDirectAction = wrapDirectAction(
  deleteExpenseAction,
  "Unable to delete expense",
);
