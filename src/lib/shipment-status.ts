import { MilestoneStatus, ShipmentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type MilestoneSnapshot = {
  code: string;
  status: MilestoneStatus;
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
};

const MILESTONE_CODES = {
  BOOKING_REQUESTED: "BOOKING_REQUESTED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  DEPARTED: "DEPARTED",
  ARRIVED: "ARRIVED",
  CUSTOMS_IN_PROGRESS: "CUSTOMS_IN_PROGRESS",
  DELIVERED: "DELIVERED",
} as const;

const COMPLETED_MILESTONE_STATUSES = new Set<MilestoneStatus>([MilestoneStatus.COMPLETED]);
const ACTIVE_MILESTONE_STATUSES = new Set<MilestoneStatus>([
  MilestoneStatus.IN_PROGRESS,
  MilestoneStatus.COMPLETED,
]);

function isSameDate(a: Date | null, b: Date | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function hasMilestoneProgress(
  milestones: MilestoneSnapshot[],
  code: string,
  options?: { allowInProgress?: boolean },
) {
  const milestone = milestones.find((row) => row.code === code);
  if (!milestone) return false;
  if (milestone.actualAt) return true;
  if (options?.allowInProgress) {
    return ACTIVE_MILESTONE_STATUSES.has(milestone.status);
  }
  return COMPLETED_MILESTONE_STATUSES.has(milestone.status);
}

function resolveDateFromMilestone(
  milestoneByCode: Map<string, MilestoneSnapshot>,
  code: string,
  fallback: Date | null,
) {
  if (!milestoneByCode.has(code)) return fallback;
  return milestoneByCode.get(code)?.actualAt ?? null;
}

export function evaluateShipmentStatus(input: ShipmentStatusEvaluationInput): ShipmentStatus {
  if (input.currentStatus === ShipmentStatus.CANCELLED) {
    return ShipmentStatus.CANCELLED;
  }
  if (input.currentStatus === ShipmentStatus.CLOSED) {
    return ShipmentStatus.CLOSED;
  }

  const hasDeliveredProgress =
    Boolean(input.deliveredAt) || hasMilestoneProgress(input.milestones, MILESTONE_CODES.DELIVERED);
  if (hasDeliveredProgress) {
    return ShipmentStatus.DELIVERED;
  }

  const hasCustomsProgress = hasMilestoneProgress(input.milestones, MILESTONE_CODES.CUSTOMS_IN_PROGRESS, {
    allowInProgress: true,
  });
  if (hasCustomsProgress) {
    return ShipmentStatus.CUSTOMS;
  }

  const hasArrivalProgress =
    Boolean(input.ata) || hasMilestoneProgress(input.milestones, MILESTONE_CODES.ARRIVED);
  if (hasArrivalProgress) {
    return ShipmentStatus.ARRIVED;
  }

  const hasDepartureProgress =
    Boolean(input.atd) || hasMilestoneProgress(input.milestones, MILESTONE_CODES.DEPARTED);
  if (hasDepartureProgress) {
    return ShipmentStatus.IN_TRANSIT;
  }

  if (
    hasMilestoneProgress(input.milestones, MILESTONE_CODES.BOOKING_CONFIRMED, {
      allowInProgress: true,
    })
  ) {
    return ShipmentStatus.BOOKING_CONFIRMED;
  }

  if (
    hasMilestoneProgress(input.milestones, MILESTONE_CODES.BOOKING_REQUESTED, {
      allowInProgress: true,
    })
  ) {
    return ShipmentStatus.BOOKING_REQUESTED;
  }

  return ShipmentStatus.DRAFT;
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
          code: true,
          status: true,
          actualAt: true,
        },
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const milestoneByCode = new Map(shipment.milestones.map((row) => [row.code, row]));
  const nextAtd = resolveDateFromMilestone(milestoneByCode, MILESTONE_CODES.DEPARTED, shipment.atd);
  const nextAta = resolveDateFromMilestone(milestoneByCode, MILESTONE_CODES.ARRIVED, shipment.ata);
  const nextDeliveredAt = resolveDateFromMilestone(
    milestoneByCode,
    MILESTONE_CODES.DELIVERED,
    shipment.deliveredAt,
  );

  const nextStatus = evaluateShipmentStatus({
    currentStatus: shipment.status,
    atd: nextAtd,
    ata: nextAta,
    deliveredAt: nextDeliveredAt,
    milestones: shipment.milestones,
  });

  const datesChanged =
    !isSameDate(shipment.atd, nextAtd) ||
    !isSameDate(shipment.ata, nextAta) ||
    !isSameDate(shipment.deliveredAt, nextDeliveredAt);
  const statusChanged = nextStatus !== shipment.status;

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
  };
}
