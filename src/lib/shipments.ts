import { ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deriveShipmentState } from "@/lib/domain/derive-shipment-state";

type ShipmentListFilters = {
  q?: string;
  mode?: string;
  status?: string;
  customerId?: string;
};

function isTransportMode(value?: string): value is TransportMode {
  return value !== undefined && Object.values(TransportMode).includes(value as TransportMode);
}

function isShipmentStatus(value?: string): value is ShipmentStatus {
  return value !== undefined && Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}

export async function listShipments(companyId: string, filters?: ShipmentListFilters) {
  const search = filters?.q?.trim();
  const modeFilter = isTransportMode(filters?.mode) ? filters?.mode : undefined;
  const statusFilter = isShipmentStatus(filters?.status) ? filters?.status : undefined;
  const customerId = filters?.customerId?.trim() || undefined;

  const rows = await prisma.shipment.findMany({
    where: {
      companyId,
      ...(modeFilter ? { mode: modeFilter } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { shipmentNumber: { contains: search } },
              { carrierName: { contains: search } },
              { vesselOrFlight: { contains: search } },
              { referenceClient: { contains: search } },
              { referenceInternal: { contains: search } },
              { bookingRef: { contains: search } },
              { houseRef: { contains: search } },
              { masterRef: { contains: search } },
              {
                customer: {
                  legalName: { contains: search },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      companyId: true,
      shipmentNumber: true,
      quoteId: true,
      customerId: true,
      mode: true,
      direction: true,
      status: true,
      incotermCode: true,
      serviceLevel: true,
      originCode: true,
      destinationCode: true,
      pol: true,
      pod: true,
      airportOrigin: true,
      airportDestination: true,
      placeOfReceipt: true,
      placeOfDelivery: true,
      shipperName: true,
      consigneeName: true,
      notifyPartyName: true,
      agentOriginName: true,
      agentDestinationName: true,
      carrierName: true,
      vesselOrFlight: true,
      referenceClient: true,
      referenceInternal: true,
      bookingRef: true,
      houseRef: true,
      masterRef: true,
      commodity: true,
      packageCount: true,
      packageType: true,
      grossWeightKg: true,
      chargeableWeightKg: true,
      volumeM3: true,
      containerCount: true,
      containerType: true,
      cargoReadyDate: true,
      etd: true,
      eta: true,
      atd: true,
      ata: true,
      deliveredAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          code: true,
          legalName: true,
        },
      },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
        },
      },
      milestones: {
        select: {
          code: true,
          status: true,
          expectedAt: true,
          actualAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  const enrichedRows = rows.map((row) => {
    const derived = deriveShipmentState(
      {
        status: row.status,
        atd: row.atd,
        ata: row.ata,
        deliveredAt: row.deliveredAt,
      },
      row.milestones.map((milestone) => ({
        code: milestone.code,
        status: milestone.status,
        expectedAt: milestone.expectedAt,
        actualAt: milestone.actualAt,
      })),
    );

    return {
      ...row,
      status: derived.masterStatus,
      derivedState: derived,
    };
  });

  if (!statusFilter) {
    return enrichedRows;
  }
  return enrichedRows.filter((row) => row.status === statusFilter);
}

export function deriveShipmentStateForView(input: {
  currentStatus: ShipmentStatus;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
  milestones: Array<{
    id?: string;
    code: string;
    status: string;
    expectedAt: Date | null;
    actualAt: Date | null;
  }>;
}) {
  return deriveShipmentState(
    {
      status: input.currentStatus,
      atd: input.atd,
      ata: input.ata,
      deliveredAt: input.deliveredAt,
    },
    input.milestones.map((milestone) => ({
      code: milestone.code,
      status: milestone.status,
      expectedAt: milestone.expectedAt,
      actualAt: milestone.actualAt,
    })),
  );
}

export async function listShipmentsWithDerivedState(companyId: string) {
  const rows = await prisma.shipment.findMany({
    where: { companyId },
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
      updatedAt: true,
      atd: true,
      ata: true,
      deliveredAt: true,
      milestones: {
        select: {
          code: true,
          status: true,
          expectedAt: true,
          actualAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return rows.map((row) => {
    const derived = deriveShipmentState(
      {
        status: row.status,
        atd: row.atd,
        ata: row.ata,
        deliveredAt: row.deliveredAt,
      },
      row.milestones.map((milestone) => ({
        code: milestone.code,
        status: milestone.status,
        expectedAt: milestone.expectedAt,
        actualAt: milestone.actualAt,
      })),
    );

    return {
      ...row,
      status: derived.masterStatus,
      derivedState: derived,
    };
  });
}

export async function getShipmentById(companyId: string, id: string) {
  return prisma.shipment.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          legalName: true,
          tradeName: true,
          city: true,
          country: true,
        },
      },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          totalSell: true,
          totalBuy: true,
          approvedAt: true,
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
          marginAmount: true,
          marginPct: true,
          customer: {
            select: {
              id: true,
              legalName: true,
            },
          },
        },
      },
      milestones: {
        orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      },
      documents: {
        orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          docType: true,
          fileName: true,
          fileUrl: true,
          referenceNumber: true,
          issueDate: true,
          version: true,
          status: true,
          notes: true,
          uploadedAt: true,
          parsingResults: {
            orderBy: [{ createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              status: true,
              parsedJson: true,
              createdAt: true,
              documentType: true,
            },
          },
        },
      },
      revenues: {
        orderBy: [{ createdAt: "desc" }],
      },
      expenses: {
        orderBy: [{ createdAt: "desc" }],
      },
      shipmentCosts: {
        orderBy: [{ createdAt: "desc" }],
      },
      invoices: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          lines: {
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
      _count: {
        select: {
          milestones: true,
          documents: true,
          revenues: true,
          expenses: true,
          shipmentCosts: true,
          invoices: true,
        },
      },
    },
  });
}

export async function deleteShipmentById(companyId: string, id: string) {
  const existing = await prisma.shipment.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Shipment not found");
  }

  await prisma.shipment.delete({ where: { id: existing.id } });
}
