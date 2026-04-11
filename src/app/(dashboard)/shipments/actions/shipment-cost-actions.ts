"use server";

import { revalidatePath } from "next/cache";
import { ShipmentCostCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { shipmentCostSchema } from "./schemas";
import { assertShipmentAccess, getContext, normalizeOptional, toDate } from "./shared";
import type { ShipmentActionState } from "./types";

export async function upsertShipmentCostAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const parsed = shipmentCostSchema.parse({
      id: formData.get("id") || undefined,
      shipmentId: formData.get("shipmentId"),
      supplierName: formData.get("supplierName"),
      conceptCategory: formData.get("conceptCategory"),
      customConcept: formData.get("customConcept") || undefined,
      amount: formData.get("amount"),
      currencyCode: formData.get("currencyCode"),
      dueDate: String(formData.get("dueDate") || ""),
      status: formData.get("status"),
      notes: formData.get("notes") || undefined,
    });

    if (parsed.conceptCategory === ShipmentCostCategory.OTHER && !parsed.customConcept?.trim()) {
      throw new Error("Custom concept is required when category is OTHER");
    }

    const shipment = await assertShipmentAccess(ctx.companyId, parsed.shipmentId);
    const dueDate = toDate(parsed.dueDate);
    const payload = {
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? undefined,
      shipmentId: shipment.id,
      supplierName: parsed.supplierName.trim(),
      conceptCategory: parsed.conceptCategory,
      customConcept: normalizeOptional(parsed.customConcept),
      amount: parsed.amount,
      currencyCode: parsed.currencyCode,
      dueDate,
      status: parsed.status,
      notes: normalizeOptional(parsed.notes),
    };

    if (parsed.id) {
      const existing = await prisma.shipmentCost.findFirst({
        where: {
          id: parsed.id,
          companyId: ctx.companyId,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Shipment cost record not found");
      }
      await prisma.shipmentCost.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.shipmentCost.create({ data: payload });
    }

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    revalidatePath("/finance");
    revalidatePath("/finance/profitability");
    revalidatePath("/finance/forecast");
    revalidatePath("/finance/ap");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function upsertShipmentCostDirectAction(formData: FormData): Promise<void> {
  const result = await upsertShipmentCostAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to save shipment cost");
  }
}

export async function deleteShipmentCostAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Shipment cost id is required");
    }

    const existing = await prisma.shipmentCost.findFirst({
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
      throw new Error("Shipment cost record not found");
    }

    await prisma.shipmentCost.delete({ where: { id: existing.id } });
    revalidatePath(`/shipments/${existing.shipmentId}`);
    revalidatePath("/shipments");
    revalidatePath("/finance");
    revalidatePath("/finance/profitability");
    revalidatePath("/finance/forecast");
    revalidatePath("/finance/ap");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteShipmentCostDirectAction(formData: FormData): Promise<void> {
  const result = await deleteShipmentCostAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to delete shipment cost");
  }
}
