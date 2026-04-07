"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "next-auth";

const shipmentSchema = z.object({
  id: z.string().optional(),
  shipmentNumber: z.string().min(3).max(40),
  customerId: z.string().min(1),
  mode: z.enum(["AIR", "OCEAN", "ROAD", "RAIL", "MULTIMODAL", "SPECIAL"]),
  direction: z.enum(["IMPORT", "EXPORT", "CROSS_TRADE"]),
  status: z.enum([
    "DRAFT",
    "OPEN",
    "IN_TRANSIT",
    "ARRIVED",
    "CUSTOMS",
    "DELIVERED",
    "INVOICED",
    "CLOSED",
    "CANCELLED",
  ]),
  incotermCode: z.string().max(10).optional(),
  serviceLevel: z.string().max(120).optional(),
  referenceClient: z.string().max(80).optional(),
  referenceInternal: z.string().max(80).optional(),
  bookingRef: z.string().max(80).optional(),
  houseRef: z.string().max(80).optional(),
  masterRef: z.string().max(80).optional(),
  commodity: z.string().max(160).optional(),
  packageCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  grossWeightKg: z.coerce.number().min(0).max(10_000_000).optional(),
  volumeM3: z.coerce.number().min(0).max(100_000).optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  atd: z.string().optional(),
  ata: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type ShipmentActionState = {
  success: boolean;
  error?: string;
};

function normalizeOptional(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
}

function validateShipmentDates({
  etd,
  eta,
  atd,
  ata,
}: {
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
}) {
  if (etd && eta && etd > eta) {
    throw new Error("ETD cannot be later than ETA");
  }
  if (atd && ata && atd > ata) {
    throw new Error("ATD cannot be later than ATA");
  }
  if (etd && atd && atd < etd) {
    throw new Error("ATD cannot be earlier than ETD");
  }
  if (eta && ata && ata < eta) {
    throw new Error("ATA cannot be earlier than ETA");
  }
}

async function getContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.role, "SHIPMENTS", "UPDATE")) {
    throw new Error("Insufficient permissions");
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    branchId: session.user.branchId,
  };
}

export async function createShipmentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext();

    const parsed = shipmentSchema.parse({
      shipmentNumber: formData.get("shipmentNumber"),
      customerId: formData.get("customerId"),
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      status: formData.get("status"),
      incotermCode: formData.get("incotermCode") || undefined,
      serviceLevel: formData.get("serviceLevel") || undefined,
      referenceClient: formData.get("referenceClient") || undefined,
      referenceInternal: formData.get("referenceInternal") || undefined,
      bookingRef: formData.get("bookingRef") || undefined,
      houseRef: formData.get("houseRef") || undefined,
      masterRef: formData.get("masterRef") || undefined,
      commodity: formData.get("commodity") || undefined,
      packageCount: formData.get("packageCount") || undefined,
      grossWeightKg: formData.get("grossWeightKg") || undefined,
      volumeM3: formData.get("volumeM3") || undefined,
      etd: String(formData.get("etd") || ""),
      eta: String(formData.get("eta") || ""),
      atd: String(formData.get("atd") || ""),
      ata: String(formData.get("ata") || ""),
      notes: formData.get("notes") || undefined,
    });

    const etd = toDate(parsed.etd);
    const eta = toDate(parsed.eta);
    const atd = toDate(parsed.atd);
    const ata = toDate(parsed.ata);
    validateShipmentDates({ etd, eta, atd, ata });

    const customer = await prisma.customer.findFirst({
      where: {
        id: parsed.customerId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new Error("Customer not found for this company");
    }

    const created = await prisma.shipment.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId ?? undefined,
        ownerUserId: ctx.userId,
        shipmentNumber: parsed.shipmentNumber.toUpperCase(),
        customerId: parsed.customerId,
        mode: parsed.mode,
        direction: parsed.direction,
        status: parsed.status,
        incotermCode: normalizeOptional(parsed.incotermCode) ?? undefined,
        serviceLevel: normalizeOptional(parsed.serviceLevel) ?? undefined,
        referenceClient: normalizeOptional(parsed.referenceClient),
        referenceInternal: normalizeOptional(parsed.referenceInternal),
        bookingRef: normalizeOptional(parsed.bookingRef),
        houseRef: normalizeOptional(parsed.houseRef),
        masterRef: normalizeOptional(parsed.masterRef),
        commodity: normalizeOptional(parsed.commodity),
        packageCount: parsed.packageCount ?? null,
        grossWeightKg: parsed.grossWeightKg ?? null,
        volumeM3: parsed.volumeM3 ?? null,
        etd,
        eta,
        atd,
        ata,
        notes: normalizeOptional(parsed.notes),
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: created.id,
        action: "CREATE",
        actorId: ctx.userId,
        afterJson: {
          shipmentNumber: created.shipmentNumber,
          status: created.status,
          mode: created.mode,
        },
      },
    });

    revalidatePath("/shipments");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateShipmentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext();
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Shipment id is required");
    }

    const parsed = shipmentSchema.parse({
      id,
      shipmentNumber: formData.get("shipmentNumber"),
      customerId: formData.get("customerId"),
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      status: formData.get("status"),
      incotermCode: formData.get("incotermCode") || undefined,
      serviceLevel: formData.get("serviceLevel") || undefined,
      referenceClient: formData.get("referenceClient") || undefined,
      referenceInternal: formData.get("referenceInternal") || undefined,
      bookingRef: formData.get("bookingRef") || undefined,
      houseRef: formData.get("houseRef") || undefined,
      masterRef: formData.get("masterRef") || undefined,
      commodity: formData.get("commodity") || undefined,
      packageCount: formData.get("packageCount") || undefined,
      grossWeightKg: formData.get("grossWeightKg") || undefined,
      volumeM3: formData.get("volumeM3") || undefined,
      etd: String(formData.get("etd") || ""),
      eta: String(formData.get("eta") || ""),
      atd: String(formData.get("atd") || ""),
      ata: String(formData.get("ata") || ""),
      notes: formData.get("notes") || undefined,
    });

    const etd = toDate(parsed.etd);
    const eta = toDate(parsed.eta);
    const atd = toDate(parsed.atd);
    const ata = toDate(parsed.ata);
    validateShipmentDates({ etd, eta, atd, ata });

    const customer = await prisma.customer.findFirst({
      where: {
        id: parsed.customerId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new Error("Customer not found for this company");
    }

    const before = await prisma.shipment.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });

    if (!before) {
      throw new Error("Shipment not found");
    }

    const updated = await prisma.shipment.update({
      where: { id: before.id },
      data: {
        shipmentNumber: parsed.shipmentNumber.toUpperCase(),
        customerId: parsed.customerId,
        mode: parsed.mode,
        direction: parsed.direction,
        status: parsed.status,
        incotermCode: normalizeOptional(parsed.incotermCode) ?? undefined,
        serviceLevel: normalizeOptional(parsed.serviceLevel) ?? undefined,
        referenceClient: normalizeOptional(parsed.referenceClient),
        referenceInternal: normalizeOptional(parsed.referenceInternal),
        bookingRef: normalizeOptional(parsed.bookingRef),
        houseRef: normalizeOptional(parsed.houseRef),
        masterRef: normalizeOptional(parsed.masterRef),
        commodity: normalizeOptional(parsed.commodity),
        packageCount: parsed.packageCount ?? null,
        grossWeightKg: parsed.grossWeightKg ?? null,
        volumeM3: parsed.volumeM3 ?? null,
        etd,
        eta,
        atd,
        ata,
        notes: normalizeOptional(parsed.notes),
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: updated.id,
        action: "UPDATE",
        actorId: ctx.userId,
        beforeJson: before,
        afterJson: updated,
      },
    });

    revalidatePath("/shipments");
    revalidatePath(`/shipments/${updated.id}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteShipmentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext();
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Shipment id is required");
    }

    const before = await prisma.shipment.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });

    if (!before) {
      throw new Error("Shipment not found");
    }

    await prisma.shipment.delete({
      where: { id: before.id },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: id,
        action: "DELETE",
        actorId: ctx.userId,
        beforeJson: before,
      },
    });

    revalidatePath("/shipments");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteShipmentDirectAction(formData: FormData): Promise<void> {
  const result = await deleteShipmentAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to delete shipment");
  }
}
