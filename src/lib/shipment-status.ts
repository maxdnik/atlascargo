import { MilestoneStatus, ShipmentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deriveShipmentState } from "@/lib/shipment-state";

type MilestoneSnapshot = {
  id: string;
  code: string;
  status: MilestoneStatus;
  expectedAt: Date | null;
  actualAt: Date | null;
};

type ShipmentStatusEvaluationInput = {
  currentStatus: ShipmentStatus;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
  milestones: MilestoneSnapshot[];
};

type ShipmentStatusSyncResult = {
  shipmentId: string;
  previousStatus: ShipmentStatus;
  nextStatus: ShipmentStatus;
  statusChanged: boolean;
  datesChanged: boolean;
  milestoneStatusesChanged: boolean;
};

type MilestoneStatusUpdate = {
  id: string;
  status: MilestoneStatus;
};

function isSameDate(a: Date | null, b: Date | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

export function evaluateShipmentStatus(input: ShipmentStatusEvaluationInput): ShipmentStatus {
  const derived = deriveShipmentState(
    {
      status: input.currentStatus,
      atd: input.atd,
      ata: input.ata,
      deliveredAt: input.deliveredAt,
    },
    input.milestones.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      expectedAt: row.expectedAt,
      actualAt: row.actualAt,
    })),
  );
  return derived.masterStatus as ShipmentStatus;
}

export async function syncShipmentStatusFromMilestones(input: {
  companyId: string;
  shipmentId: string;
  tx?: Prisma.TransactionClient;
}): Promise<ShipmentStatusSyncResult> {
  const client = input.tx ?? prisma;

  const shipment = await client.shipment.findFirst({
    where: {
      id: input.shipmentId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      status: true,
      atd: true,
      ata: true,
      deliveredAt: true,
      milestones: {
        select: {
          id: true,
          code: true,
          status: true,
          expectedAt: true,
          actualAt: true,
        },
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const derived = deriveShipmentState(
    {
      status: shipment.status,
      atd: shipment.atd,
      ata: shipment.ata,
      deliveredAt: shipment.deliveredAt,
    },
    shipment.milestones.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      expectedAt: row.expectedAt,
      actualAt: row.actualAt,
    })),
  );

  const nextStatus = derived.masterStatus as ShipmentStatus;
  const nextAtd = derived.dates.atd;
  const nextAta = derived.dates.ata;
  const nextDeliveredAt = derived.dates.deliveredAt;

  const milestoneStatusUpdates: MilestoneStatusUpdate[] = shipment.milestones
    .map((row) => {
      const nextMilestoneStatus = derived.milestoneStatusByCode[row.code];
      if (!nextMilestoneStatus) return null;
      if (nextMilestoneStatus === row.status) return null;
      return {
        id: row.id,
        status: nextMilestoneStatus as MilestoneStatus,
      };
    })
    .filter((row): row is MilestoneStatusUpdate => Boolean(row));

  const datesChanged =
    !isSameDate(shipment.atd, nextAtd) ||
    !isSameDate(shipment.ata, nextAta) ||
    !isSameDate(shipment.deliveredAt, nextDeliveredAt);
  const statusChanged = nextStatus !== shipment.status;
  const milestoneStatusesChanged = milestoneStatusUpdates.length > 0;

  for (const milestoneUpdate of milestoneStatusUpdates) {
    await client.shipmentMilestone.update({
      where: { id: milestoneUpdate.id },
      data: {
        status: milestoneUpdate.status,
      },
    });
  }

  if (datesChanged || statusChanged) {
    await client.shipment.update({
      where: { id: shipment.id },
      data: {
        atd: nextAtd,
        ata: nextAta,
        deliveredAt: nextDeliveredAt,
        status: nextStatus,
      },
    });
  }

  return {
    shipmentId: shipment.id,
    previousStatus: shipment.status,
    nextStatus,
    statusChanged,
    datesChanged,
    milestoneStatusesChanged,
  };
}
