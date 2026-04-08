"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MilestoneStatus,
  QuoteStatus,
  ShipmentStatus,
  TradeDirection,
  TransportMode,
} from "@prisma/client";

import { authOptions, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "next-auth";

const TRANSPORT_MODES = ["AIR", "OCEAN", "ROAD"] as const;
const TRADE_DIRECTIONS = ["IMPORT", "EXPORT"] as const;
const SHIPMENT_STATUSES = [
  "DRAFT",
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
] as const;

const shipmentSchema = z.object({
  id: z.string().optional(),
  shipmentNumber: z.string().min(3).max(40),
  customerId: z.string().min(1),
  quoteId: z.string().optional(),
  mode: z.enum(TRANSPORT_MODES),
  direction: z.enum(TRADE_DIRECTIONS),
  status: z.enum(SHIPMENT_STATUSES),
  incotermCode: z.string().max(10).optional(),
  serviceLevel: z.string().max(120).optional(),
  originCode: z.string().max(32).optional(),
  destinationCode: z.string().max(32).optional(),
  pol: z.string().max(64).optional(),
  pod: z.string().max(64).optional(),
  airportOrigin: z.string().max(64).optional(),
  airportDestination: z.string().max(64).optional(),
  placeOfReceipt: z.string().max(120).optional(),
  placeOfDelivery: z.string().max(120).optional(),
  shipperName: z.string().max(180).optional(),
  consigneeName: z.string().max(180).optional(),
  notifyPartyName: z.string().max(180).optional(),
  agentOriginName: z.string().max(180).optional(),
  agentDestinationName: z.string().max(180).optional(),
  carrierName: z.string().max(180).optional(),
  vesselOrFlight: z.string().max(180).optional(),
  referenceClient: z.string().max(80).optional(),
  referenceInternal: z.string().max(80).optional(),
  bookingRef: z.string().max(80).optional(),
  houseRef: z.string().max(80).optional(),
  masterRef: z.string().max(80).optional(),
  commodity: z.string().max(160).optional(),
  packageCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  packageType: z.string().max(80).optional(),
  grossWeightKg: z.coerce.number().min(0).max(10_000_000).optional(),
  chargeableWeightKg: z.coerce.number().min(0).max(10_000_000).optional(),
  volumeM3: z.coerce.number().min(0).max(100_000).optional(),
  containerCount: z.coerce.number().int().min(0).max(100_000).optional(),
  containerType: z.string().max(80).optional(),
  cargoReadyDate: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  atd: z.string().optional(),
  ata: z.string().optional(),
  deliveredAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type ShipmentActionState = {
  success: boolean;
  error?: string;
};

const defaultMilestones: Array<{ code: string; label: string; isCritical: boolean }> = [
  { code: "QUOTE_APPROVED", label: "Quote Approved", isCritical: false },
  { code: "BOOKING_REQUESTED", label: "Booking Requested", isCritical: true },
  { code: "BOOKING_CONFIRMED", label: "Booking Confirmed", isCritical: true },
  { code: "CARGO_READY", label: "Cargo Ready", isCritical: true },
  { code: "DEPARTED", label: "Departed", isCritical: true },
  { code: "ARRIVED", label: "Arrived", isCritical: true },
  { code: "CUSTOMS_IN_PROGRESS", label: "Customs In Progress", isCritical: false },
  { code: "DELIVERED", label: "Delivered", isCritical: true },
  { code: "CLOSED", label: "Closed", isCritical: true },
];

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
  cargoReadyDate,
  etd,
  eta,
  atd,
  ata,
  deliveredAt,
}: {
  cargoReadyDate: Date | null;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
}) {
  if (cargoReadyDate && etd && cargoReadyDate > etd) {
    throw new Error("Cargo Ready Date cannot be later than ETD");
  }
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
  if (deliveredAt && atd && deliveredAt < atd) {
    throw new Error("Delivered date cannot be earlier than ATD");
  }
}

function toMilestoneStatus(date: Date | null): MilestoneStatus {
  return date ? MilestoneStatus.COMPLETED : MilestoneStatus.PENDING;
}

type MilestoneDates = {
  quoteApprovedAt: Date | null;
  cargoReadyDate: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
};

function milestoneSeedData(shipmentId: string, dates: MilestoneDates) {
  return defaultMilestones.map((milestone) => {
    let expectedAt: Date | null = null;
    let actualAt: Date | null = null;
    let status: MilestoneStatus = MilestoneStatus.PENDING;

    if (milestone.code === "QUOTE_APPROVED") {
      expectedAt = dates.quoteApprovedAt;
      actualAt = dates.quoteApprovedAt;
      status = toMilestoneStatus(dates.quoteApprovedAt);
    }
    if (milestone.code === "CARGO_READY") {
      expectedAt = dates.cargoReadyDate;
      actualAt = dates.cargoReadyDate;
      status = toMilestoneStatus(dates.cargoReadyDate);
    }
    if (milestone.code === "DEPARTED") {
      expectedAt = dates.atd;
      actualAt = dates.atd;
      status = toMilestoneStatus(dates.atd);
    }
    if (milestone.code === "ARRIVED") {
      expectedAt = dates.ata;
      actualAt = dates.ata;
      status = toMilestoneStatus(dates.ata);
    }
    if (milestone.code === "DELIVERED") {
      expectedAt = dates.deliveredAt;
      actualAt = dates.deliveredAt;
      status = toMilestoneStatus(dates.deliveredAt);
    }
    if (milestone.code === "CLOSED" && dates.deliveredAt) {
      expectedAt = dates.deliveredAt;
    }

    return {
      shipmentId,
      code: milestone.code,
      label: milestone.label,
      expectedAt,
      actualAt,
      status,
      isCritical: milestone.isCritical,
    };
  });
}

function validateOperationalStatusRules(
  status: ShipmentStatus,
  dates: {
    atd: Date | null;
    deliveredAt: Date | null;
    etd: Date | null;
    eta: Date | null;
    ata: Date | null;
  },
  refs: {
    bookingRef: string | null;
    houseRef: string | null;
    masterRef: string | null;
  },
) {
  if (status === ShipmentStatus.IN_TRANSIT && !dates.atd) {
    throw new Error("IN_TRANSIT requires ATD operational confirmation");
  }

  if (status === ShipmentStatus.DELIVERED && !dates.deliveredAt) {
    throw new Error("DELIVERED requires Delivered At date");
  }

  if (status === ShipmentStatus.CLOSED) {
    if (!dates.atd || !dates.ata || !dates.deliveredAt) {
      throw new Error("CLOSED requires ATD, ATA and Delivered At dates");
    }
    if (!refs.bookingRef || (!refs.houseRef && !refs.masterRef)) {
      throw new Error("CLOSED requires booking reference and house/master reference");
    }
  }
}

async function getContext(
  resource: "SHIPMENTS" | "MILESTONES" = "SHIPMENTS",
  action: "CREATE" | "UPDATE" | "DELETE" = "UPDATE",
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.role, resource, action)) {
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
    const ctx = await getContext("SHIPMENTS", "CREATE");

    const parsed = shipmentSchema.parse({
      shipmentNumber: formData.get("shipmentNumber"),
      customerId: formData.get("customerId"),
      quoteId: formData.get("quoteId") || undefined,
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      status: formData.get("status"),
      incotermCode: formData.get("incotermCode") || undefined,
      serviceLevel: formData.get("serviceLevel") || undefined,
      originCode: formData.get("originCode") || undefined,
      destinationCode: formData.get("destinationCode") || undefined,
      pol: formData.get("pol") || undefined,
      pod: formData.get("pod") || undefined,
      airportOrigin: formData.get("airportOrigin") || undefined,
      airportDestination: formData.get("airportDestination") || undefined,
      placeOfReceipt: formData.get("placeOfReceipt") || undefined,
      placeOfDelivery: formData.get("placeOfDelivery") || undefined,
      shipperName: formData.get("shipperName") || undefined,
      consigneeName: formData.get("consigneeName") || undefined,
      notifyPartyName: formData.get("notifyPartyName") || undefined,
      agentOriginName: formData.get("agentOriginName") || undefined,
      agentDestinationName: formData.get("agentDestinationName") || undefined,
      carrierName: formData.get("carrierName") || undefined,
      vesselOrFlight: formData.get("vesselOrFlight") || undefined,
      referenceClient: formData.get("referenceClient") || undefined,
      referenceInternal: formData.get("referenceInternal") || undefined,
      bookingRef: formData.get("bookingRef") || undefined,
      houseRef: formData.get("houseRef") || undefined,
      masterRef: formData.get("masterRef") || undefined,
      commodity: formData.get("commodity") || undefined,
      packageCount: formData.get("packageCount") || undefined,
      packageType: formData.get("packageType") || undefined,
      grossWeightKg: formData.get("grossWeightKg") || undefined,
      chargeableWeightKg: formData.get("chargeableWeightKg") || undefined,
      volumeM3: formData.get("volumeM3") || undefined,
      containerCount: formData.get("containerCount") || undefined,
      containerType: formData.get("containerType") || undefined,
      cargoReadyDate: String(formData.get("cargoReadyDate") || ""),
      etd: String(formData.get("etd") || ""),
      eta: String(formData.get("eta") || ""),
      atd: String(formData.get("atd") || ""),
      ata: String(formData.get("ata") || ""),
      deliveredAt: String(formData.get("deliveredAt") || ""),
      notes: formData.get("notes") || undefined,
    });

    const quoteId = normalizeOptional(parsed.quoteId);
    const cargoReadyDate = toDate(parsed.cargoReadyDate);
    const etd = toDate(parsed.etd);
    const eta = toDate(parsed.eta);
    const atd = toDate(parsed.atd);
    const ata = toDate(parsed.ata);
    const deliveredAt = toDate(parsed.deliveredAt);
    validateShipmentDates({ cargoReadyDate, etd, eta, atd, ata, deliveredAt });

    let approvedQuote:
      | {
          id: string;
          status: QuoteStatus;
          approvedAt: Date | null;
          customerId: string;
          mode: TransportMode;
          direction: TradeDirection;
          incotermCode: string | null;
          originCode: string | null;
          destinationCode: string | null;
          pol: string | null;
          pod: string | null;
          airportOrigin: string | null;
          airportDestination: string | null;
          placeOfReceipt: string | null;
          placeOfDelivery: string | null;
          commodity: string | null;
        }
      | null = null;

    if (quoteId) {
      approvedQuote = await prisma.quote.findFirst({
        where: {
          id: quoteId,
          companyId: ctx.companyId,
          status: QuoteStatus.APPROVED,
        },
        select: {
          id: true,
          status: true,
          approvedAt: true,
          customerId: true,
          mode: true,
          direction: true,
          incotermCode: true,
          originCode: true,
          destinationCode: true,
          pol: true,
          pod: true,
          airportOrigin: true,
          airportDestination: true,
          placeOfReceipt: true,
          placeOfDelivery: true,
          commodity: true,
        },
      });

      if (!approvedQuote) {
        throw new Error("Shipment can only be created from an approved quote");
      }
    }

    if (approvedQuote) {
      if (parsed.customerId !== approvedQuote.customerId) {
        throw new Error("Customer must match approved quote");
      }
      if (parsed.mode !== approvedQuote.mode) {
        throw new Error("Mode must match approved quote");
      }
      if (parsed.direction !== approvedQuote.direction) {
        throw new Error("Direction must match approved quote");
      }
    }

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

    const resolvedIncotermCode =
      normalizeOptional(parsed.incotermCode) ?? approvedQuote?.incotermCode ?? null;
    const normalizedRefs = {
      bookingRef: normalizeOptional(parsed.bookingRef),
      houseRef: normalizeOptional(parsed.houseRef),
      masterRef: normalizeOptional(parsed.masterRef),
    };

    validateOperationalStatusRules(
      parsed.status,
      { atd, deliveredAt, etd, eta, ata },
      normalizedRefs,
    );

    const created = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          ownerUserId: ctx.userId,
          shipmentNumber: parsed.shipmentNumber.toUpperCase(),
          customerId: parsed.customerId,
          quoteId: approvedQuote?.id,
          mode: parsed.mode,
          direction: parsed.direction,
          status: parsed.status,
          incotermCode: resolvedIncotermCode ?? undefined,
          serviceLevel: normalizeOptional(parsed.serviceLevel) ?? undefined,
          originCode: normalizeOptional(parsed.originCode) ?? approvedQuote?.originCode ?? null,
          destinationCode:
            normalizeOptional(parsed.destinationCode) ?? approvedQuote?.destinationCode ?? null,
          pol: normalizeOptional(parsed.pol) ?? approvedQuote?.pol ?? null,
          pod: normalizeOptional(parsed.pod) ?? approvedQuote?.pod ?? null,
          airportOrigin:
            normalizeOptional(parsed.airportOrigin) ?? approvedQuote?.airportOrigin ?? null,
          airportDestination:
            normalizeOptional(parsed.airportDestination) ??
            approvedQuote?.airportDestination ??
            null,
          placeOfReceipt:
            normalizeOptional(parsed.placeOfReceipt) ?? approvedQuote?.placeOfReceipt ?? null,
          placeOfDelivery:
            normalizeOptional(parsed.placeOfDelivery) ?? approvedQuote?.placeOfDelivery ?? null,
          shipperName: normalizeOptional(parsed.shipperName),
          consigneeName: normalizeOptional(parsed.consigneeName),
          notifyPartyName: normalizeOptional(parsed.notifyPartyName),
          agentOriginName: normalizeOptional(parsed.agentOriginName),
          agentDestinationName: normalizeOptional(parsed.agentDestinationName),
          carrierName: normalizeOptional(parsed.carrierName),
          vesselOrFlight: normalizeOptional(parsed.vesselOrFlight),
          referenceClient: normalizeOptional(parsed.referenceClient),
          referenceInternal: normalizeOptional(parsed.referenceInternal),
          bookingRef: normalizedRefs.bookingRef,
          houseRef: normalizedRefs.houseRef,
          masterRef: normalizedRefs.masterRef,
          commodity: normalizeOptional(parsed.commodity) ?? approvedQuote?.commodity ?? null,
          packageCount: parsed.packageCount ?? null,
          packageType: normalizeOptional(parsed.packageType),
          grossWeightKg: parsed.grossWeightKg ?? null,
          chargeableWeightKg: parsed.chargeableWeightKg ?? null,
          volumeM3: parsed.volumeM3 ?? null,
          containerCount: parsed.containerCount ?? null,
          containerType: normalizeOptional(parsed.containerType),
          cargoReadyDate,
          etd,
          eta,
          atd,
          ata,
          deliveredAt,
          notes: normalizeOptional(parsed.notes),
        },
      });

      await tx.shipmentMilestone.createMany({
        data: milestoneSeedData(shipment.id, {
          quoteApprovedAt: approvedQuote?.approvedAt ?? null,
          cargoReadyDate,
          atd,
          ata,
          deliveredAt,
        }),
      });

      return shipment;
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
    const ctx = await getContext("SHIPMENTS", "UPDATE");
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Shipment id is required");
    }

    const parsed = shipmentSchema.parse({
      id,
      shipmentNumber: formData.get("shipmentNumber"),
      customerId: formData.get("customerId"),
      quoteId: formData.get("quoteId") || undefined,
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      status: formData.get("status"),
      incotermCode: formData.get("incotermCode") || undefined,
      serviceLevel: formData.get("serviceLevel") || undefined,
      originCode: formData.get("originCode") || undefined,
      destinationCode: formData.get("destinationCode") || undefined,
      pol: formData.get("pol") || undefined,
      pod: formData.get("pod") || undefined,
      airportOrigin: formData.get("airportOrigin") || undefined,
      airportDestination: formData.get("airportDestination") || undefined,
      placeOfReceipt: formData.get("placeOfReceipt") || undefined,
      placeOfDelivery: formData.get("placeOfDelivery") || undefined,
      shipperName: formData.get("shipperName") || undefined,
      consigneeName: formData.get("consigneeName") || undefined,
      notifyPartyName: formData.get("notifyPartyName") || undefined,
      agentOriginName: formData.get("agentOriginName") || undefined,
      agentDestinationName: formData.get("agentDestinationName") || undefined,
      carrierName: formData.get("carrierName") || undefined,
      vesselOrFlight: formData.get("vesselOrFlight") || undefined,
      referenceClient: formData.get("referenceClient") || undefined,
      referenceInternal: formData.get("referenceInternal") || undefined,
      bookingRef: formData.get("bookingRef") || undefined,
      houseRef: formData.get("houseRef") || undefined,
      masterRef: formData.get("masterRef") || undefined,
      commodity: formData.get("commodity") || undefined,
      packageCount: formData.get("packageCount") || undefined,
      packageType: formData.get("packageType") || undefined,
      grossWeightKg: formData.get("grossWeightKg") || undefined,
      chargeableWeightKg: formData.get("chargeableWeightKg") || undefined,
      volumeM3: formData.get("volumeM3") || undefined,
      containerCount: formData.get("containerCount") || undefined,
      containerType: formData.get("containerType") || undefined,
      cargoReadyDate: String(formData.get("cargoReadyDate") || ""),
      etd: String(formData.get("etd") || ""),
      eta: String(formData.get("eta") || ""),
      atd: String(formData.get("atd") || ""),
      ata: String(formData.get("ata") || ""),
      deliveredAt: String(formData.get("deliveredAt") || ""),
      notes: formData.get("notes") || undefined,
    });

    const cargoReadyDate = toDate(parsed.cargoReadyDate);
    const etd = toDate(parsed.etd);
    const eta = toDate(parsed.eta);
    const atd = toDate(parsed.atd);
    const ata = toDate(parsed.ata);
    const deliveredAt = toDate(parsed.deliveredAt);
    validateShipmentDates({ cargoReadyDate, etd, eta, atd, ata, deliveredAt });

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

    const normalizedRefs = {
      bookingRef: normalizeOptional(parsed.bookingRef),
      houseRef: normalizeOptional(parsed.houseRef),
      masterRef: normalizeOptional(parsed.masterRef),
    };

    validateOperationalStatusRules(
      parsed.status,
      { atd, deliveredAt, etd, eta, ata },
      normalizedRefs,
    );

    const before = await prisma.shipment.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
    });

    if (!before) {
      throw new Error("Shipment not found");
    }

    if (before.quoteId) {
      if (before.customerId !== parsed.customerId) {
        throw new Error("Customer cannot change on shipments linked to approved quote");
      }
      if (before.mode !== parsed.mode) {
        throw new Error("Mode cannot change on shipments linked to approved quote");
      }
      if (before.direction !== parsed.direction) {
        throw new Error("Direction cannot change on shipments linked to approved quote");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id: before.id },
        data: {
          shipmentNumber: parsed.shipmentNumber.toUpperCase(),
          customerId: parsed.customerId,
          mode: parsed.mode,
          direction: parsed.direction,
          status: parsed.status,
          incotermCode: normalizeOptional(parsed.incotermCode) ?? undefined,
          serviceLevel: normalizeOptional(parsed.serviceLevel) ?? undefined,
          originCode: normalizeOptional(parsed.originCode),
          destinationCode: normalizeOptional(parsed.destinationCode),
          pol: normalizeOptional(parsed.pol),
          pod: normalizeOptional(parsed.pod),
          airportOrigin: normalizeOptional(parsed.airportOrigin),
          airportDestination: normalizeOptional(parsed.airportDestination),
          placeOfReceipt: normalizeOptional(parsed.placeOfReceipt),
          placeOfDelivery: normalizeOptional(parsed.placeOfDelivery),
          shipperName: normalizeOptional(parsed.shipperName),
          consigneeName: normalizeOptional(parsed.consigneeName),
          notifyPartyName: normalizeOptional(parsed.notifyPartyName),
          agentOriginName: normalizeOptional(parsed.agentOriginName),
          agentDestinationName: normalizeOptional(parsed.agentDestinationName),
          carrierName: normalizeOptional(parsed.carrierName),
          vesselOrFlight: normalizeOptional(parsed.vesselOrFlight),
          referenceClient: normalizeOptional(parsed.referenceClient),
          referenceInternal: normalizeOptional(parsed.referenceInternal),
          bookingRef: normalizedRefs.bookingRef,
          houseRef: normalizedRefs.houseRef,
          masterRef: normalizedRefs.masterRef,
          commodity: normalizeOptional(parsed.commodity),
          packageCount: parsed.packageCount ?? null,
          packageType: normalizeOptional(parsed.packageType),
          grossWeightKg: parsed.grossWeightKg ?? null,
          chargeableWeightKg: parsed.chargeableWeightKg ?? null,
          volumeM3: parsed.volumeM3 ?? null,
          containerCount: parsed.containerCount ?? null,
          containerType: normalizeOptional(parsed.containerType),
          cargoReadyDate,
          etd,
          eta,
          atd,
          ata,
          deliveredAt,
          notes: normalizeOptional(parsed.notes),
        },
      });

      const milestoneUpdates = [
        { code: "CARGO_READY", label: "Cargo Ready", actualAt: cargoReadyDate },
        { code: "DEPARTED", label: "Departed", actualAt: atd },
        { code: "ARRIVED", label: "Arrived", actualAt: ata },
        { code: "DELIVERED", label: "Delivered", actualAt: deliveredAt },
      ];

      for (const row of milestoneUpdates) {
        await tx.shipmentMilestone.upsert({
          where: {
            shipmentId_code: {
              shipmentId: shipment.id,
              code: row.code,
            },
          },
          create: {
            shipmentId: shipment.id,
            code: row.code,
            label: row.label,
            expectedAt: row.actualAt,
            actualAt: row.actualAt,
            status: toMilestoneStatus(row.actualAt),
            isCritical: true,
          },
          update: {
            expectedAt: row.actualAt,
            actualAt: row.actualAt,
            status: toMilestoneStatus(row.actualAt),
          },
        });
      }

      return shipment;
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

const milestoneUpdateSchema = z.object({
  shipmentId: z.string().min(1),
  code: z.string().min(1).max(60),
  label: z.string().min(1).max(140),
  expectedAt: z.string().optional(),
  actualAt: z.string().optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  notes: z.string().max(600).optional(),
});

export async function upsertMilestoneAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("MILESTONES", "UPDATE");

    const parsed = milestoneUpdateSchema.parse({
      shipmentId: formData.get("shipmentId"),
      code: formData.get("code"),
      label: formData.get("label"),
      expectedAt: String(formData.get("expectedAt") || ""),
      actualAt: String(formData.get("actualAt") || ""),
      status: formData.get("status") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const shipment = await prisma.shipment.findFirst({
      where: {
        id: parsed.shipmentId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
      },
    });
    if (!shipment) {
      throw new Error("Shipment not found");
    }

    const expectedAt = toDate(parsed.expectedAt);
    const actualAt = toDate(parsed.actualAt);
    const normalizedNotes = normalizeOptional(parsed.notes);
    const status = parsed.status ?? (actualAt ? MilestoneStatus.COMPLETED : MilestoneStatus.PENDING);

    await prisma.shipmentMilestone.upsert({
      where: {
        shipmentId_code: {
          shipmentId: shipment.id,
          code: parsed.code,
        },
      },
      create: {
        shipmentId: shipment.id,
        code: parsed.code,
        label: parsed.label,
        expectedAt,
        actualAt,
        status,
        comment: normalizedNotes,
        isCritical: defaultMilestones.some((m) => m.code === parsed.code && m.isCritical),
      },
      update: {
        label: parsed.label,
        expectedAt,
        actualAt,
        status,
        comment: normalizedNotes,
      },
    });

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

const quoteConvertSchema = z.object({
  quoteId: z.string().min(1),
  shipmentNumber: z.string().min(3).max(40),
});

export async function createShipmentFromQuoteAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "CREATE");
    const parsed = quoteConvertSchema.parse({
      quoteId: formData.get("quoteId"),
      shipmentNumber: formData.get("shipmentNumber"),
    });

    const quote = await prisma.quote.findFirst({
      where: {
        id: parsed.quoteId,
        companyId: ctx.companyId,
        status: QuoteStatus.APPROVED,
      },
      select: {
        id: true,
        quoteNumber: true,
        approvedAt: true,
        customerId: true,
        mode: true,
        direction: true,
        incotermCode: true,
        originCode: true,
        destinationCode: true,
        pol: true,
        pod: true,
        airportOrigin: true,
        airportDestination: true,
        placeOfReceipt: true,
        placeOfDelivery: true,
        commodity: true,
        shipment: {
          select: { id: true },
        },
      },
    });

    if (!quote) {
      throw new Error("Quote not found or not approved");
    }
    if (quote.shipment) {
      throw new Error("Approved quote already has a shipment");
    }

    const created = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          ownerUserId: ctx.userId,
          shipmentNumber: parsed.shipmentNumber.toUpperCase(),
          quoteId: quote.id,
          customerId: quote.customerId,
          mode: quote.mode,
          direction: quote.direction,
          status: ShipmentStatus.DRAFT,
          incotermCode: quote.incotermCode ?? undefined,
          originCode: quote.originCode,
          destinationCode: quote.destinationCode,
          pol: quote.pol,
          pod: quote.pod,
          airportOrigin: quote.airportOrigin,
          airportDestination: quote.airportDestination,
          placeOfReceipt: quote.placeOfReceipt,
          placeOfDelivery: quote.placeOfDelivery,
          commodity: quote.commodity,
          notes: `Converted from approved quote ${quote.quoteNumber}`,
        },
      });

      await tx.shipmentMilestone.createMany({
        data: milestoneSeedData(shipment.id, {
          quoteApprovedAt: quote.approvedAt ?? null,
          cargoReadyDate: null,
          atd: null,
          ata: null,
          deliveredAt: null,
        }),
      });

      return shipment;
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: created.id,
        action: "CONVERT",
        actorId: ctx.userId,
        afterJson: {
          fromQuoteId: quote.id,
          fromQuoteNumber: quote.quoteNumber,
          shipmentNumber: created.shipmentNumber,
        },
      },
    });

    revalidatePath("/shipments");
    revalidatePath("/quotes");
    revalidatePath(`/shipments/${created.id}`);
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
    const ctx = await getContext("SHIPMENTS", "DELETE");
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
