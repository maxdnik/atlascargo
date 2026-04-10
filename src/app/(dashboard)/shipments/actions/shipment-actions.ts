"use server";

import { QuoteStatus, ShipmentStatus, type TradeDirection, type TransportMode } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { runAlertChecksForShipmentUpdate } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { syncShipmentStatusFromMilestones } from "@/lib/shipment-status";

import { quoteConvertSchema, shipmentSchema } from "./schemas";
import {
  getContext,
  milestoneSeedData,
  nextShipmentNumber,
  normalizeOptional,
  toDate,
  toMilestoneStatus,
  validateOperationalStatusRules,
  validateShipmentDates,
} from "./shared";
import type { ShipmentActionState } from "./types";

export async function createShipmentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "CREATE");

    const parsed = shipmentSchema.parse({
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
      const generatedShipmentNumber = await nextShipmentNumber(
        tx,
        ctx.companyId,
        parsed.mode,
        parsed.direction,
      );
      const shipment = await tx.shipment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          ownerUserId: ctx.userId,
          shipmentNumber: generatedShipmentNumber,
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

    await runAlertChecksForShipmentUpdate({
      companyId: ctx.companyId,
      shipmentId: created.id,
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
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const id = String(formData.get("id") ?? "");
    if (!id) {
      throw new Error("Shipment id is required");
    }

    const parsed = shipmentSchema.parse({
      id,
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

      const syncResult = await syncShipmentStatusFromMilestones({
        companyId: ctx.companyId,
        shipmentId: shipment.id,
        tx,
      });

      const persisted = await tx.shipment.findUnique({
        where: { id: shipment.id },
        select: { id: true, status: true },
      });
      if (!persisted) {
        throw new Error("Shipment not found after status synchronization");
      }

      return {
        shipmentId: persisted.id,
        previousStatus: before.status,
        nextStatus: persisted.status,
        statusChanged: syncResult.statusChanged,
        datesChanged: syncResult.datesChanged,
        milestoneStatusesChanged: syncResult.milestoneStatusesChanged,
      };
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: updated.shipmentId,
        action: "UPDATE",
        actorId: ctx.userId,
        beforeJson: before,
        afterJson: {
          shipmentId: updated.shipmentId,
          status: updated.nextStatus,
          previousStatus: updated.previousStatus,
          statusChanged: updated.statusChanged,
          datesChanged: updated.datesChanged,
          milestoneStatusesChanged: updated.milestoneStatusesChanged,
        },
      },
    });

    await runAlertChecksForShipmentUpdate({
      companyId: ctx.companyId,
      shipmentId: updated.shipmentId,
    });

    revalidatePath("/shipments");
    revalidatePath(`/shipments/${updated.shipmentId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function createShipmentFromQuoteAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "CREATE");
    const parsed = quoteConvertSchema.parse({
      quoteId: formData.get("quoteId"),
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
      const shipmentNumber = await nextShipmentNumber(tx, ctx.companyId, quote.mode, quote.direction);
      const shipment = await tx.shipment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          ownerUserId: ctx.userId,
          shipmentNumber,
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
