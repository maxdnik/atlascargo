import { ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ShipmentListFilters = {
  q?: string;
  mode?: string;
  status?: string;
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

  return prisma.shipment.findMany({
    where: {
      companyId,
      ...(modeFilter ? { mode: modeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { shipmentNumber: { contains: search } },
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
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
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
        },
      },
      _count: {
        select: {
          milestones: true,
          documents: true,
          revenues: true,
          expenses: true,
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
