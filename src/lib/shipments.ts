import { ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

  return prisma.shipment.findMany({
    where: {
      companyId,
      ...(modeFilter ? { mode: modeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
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
    include: {
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
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function getShipmentById(companyId: string, id: string) {
  return prisma.shipment.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      shipmentNumber: true,
      customerId: true,
      quoteId: true,
      quoteSnapshot: true,
      quotedSellAmount: true,
      quotedCostAmount: true,
      quotedGrossProfit: true,
      quotedMarginPercent: true,
      quotedTransitTimeDays: true,
      quotedMode: true,
      quotedDirection: true,
      quotedOrigin: true,
      quotedDestination: true,
      quotedChargeBreakdown: true,
      quotedSupplierSuggestions: true,
      quotedAssumptionsNotes: true,
      ownerUserId: true,
      mode: true,
      direction: true,
      status: true,
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
      incotermCode: true,
      serviceLevel: true,
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
      polPortId: true,
      podPortId: true,
      originAirportId: true,
      destinationAirportId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
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
          estimatedTransitTimeDays: true,
          suggestedCarrier: true,
          suggestedSupplier: true,
          serviceLevelAssumption: true,
          routeAssumption: true,
          assumptionsNotes: true,
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
      },
      revenues: {
        select: {
          id: true,
          concept: true,
          amount: true,
          currencyCode: true,
          exchangeRate: true,
          amountBase: true,
          dueDate: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
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
          payments: {
            select: {
              amount: true,
              paymentDate: true,
            },
            orderBy: [{ paymentDate: "asc" }],
          },
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

export async function getShipmentRef(companyId: string, id: string) {
  return prisma.shipment.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      shipmentNumber: true,
      customerId: true,
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
