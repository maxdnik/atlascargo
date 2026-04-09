import { MilestoneStatus, ShipmentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

const MILESTONE_CODES = {
  QUOTE_APPROVED: "QUOTE_APPROVED",
  BOOKING_REQUESTED: "BOOKING_REQUESTED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  CARGO_READY: "CARGO_READY",
  DEPARTED: "DEPARTED",
  ARRIVED: "ARRIVED",
  CUSTOMS_IN_PROGRESS: "CUSTOMS_IN_PROGRESS",
  DELIVERED: "DELIVERED",
  CLOSED: "CLOSED",
} as const;

type MilestoneStatusUpdate = {
  id: string;
  status: MilestoneStatus;
};


function isSameDate(a: Date | null, b: Date | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function resolveDateFromMilestone(
  milestoneByCode: Map<string, MilestoneSnapshot>,
  code: string,
  fallback: Date | null,
) {
  if (!milestoneByCode.has(code)) return fallback;
  return milestoneByCode.get(code)?.actualAt ?? null;
}

function isMilestoneCompleted(
  milestonesByCode: Map<string, MilestoneSnapshot>,
  code: string,
  options?: { allowInProgress?: boolean },
) {
  const milestone = milestonesByCode.get(code);
  if (!milestone) return false;
  if (milestone.actualAt) return true;
  if (milestone.status === MilestoneStatus.COMPLETED) return true;
  if (options?.allowInProgress && milestone.status === MilestoneStatus.IN_PROGRESS) return true;
  return false;
}

function isMilestoneDelayable(args: {
  code: string;
  milestonesByCode: Map<string, MilestoneSnapshot>;
  nextAtd: Date | null;
  nextAta: Date | null;
  nextDeliveredAt: Date | null;
}) {
  const { code, milestonesByCode, nextAtd, nextAta, nextDeliveredAt } = args;

  if (code === MILESTONE_CODES.QUOTE_APPROVED) return true;
  if (code === MILESTONE_CODES.BOOKING_REQUESTED) return true;

  if (code === MILESTONE_CODES.BOOKING_CONFIRMED) {
    return isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_REQUESTED, {
      allowInProgress: true,
    });
  }

  if (code === MILESTONE_CODES.CARGO_READY) {
    return (
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_CONFIRMED, {
        allowInProgress: true,
      }) ||
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_REQUESTED, {
        allowInProgress: true,
      })
    );
  }

  if (code === MILESTONE_CODES.DEPARTED) {
    return (
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.CARGO_READY, {
        allowInProgress: true,
      }) ||
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_CONFIRMED, {
        allowInProgress: true,
      })
    );
  }

  if (code === MILESTONE_CODES.ARRIVED) {
    return Boolean(nextAtd) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.DEPARTED);
  }

  if (code === MILESTONE_CODES.CUSTOMS_IN_PROGRESS) {
    return Boolean(nextAta) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.ARRIVED);
  }

  if (code === MILESTONE_CODES.DELIVERED) {
    return (
      Boolean(nextAta) ||
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.ARRIVED) ||
      isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.CUSTOMS_IN_PROGRESS, {
        allowInProgress: true,
      })
    );
  }

  if (code === MILESTONE_CODES.CLOSED) {
    return Boolean(nextDeliveredAt) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.DELIVERED);
  }

  // For non-standard milestones, keep current behavior permissive.
  return true;
}

function resolveMilestoneStatuses(input: {
  milestones: MilestoneSnapshot[];
  nextAtd: Date | null;
  nextAta: Date | null;
  nextDeliveredAt: Date | null;
  now: Date;
}) {
  const milestonesByCode = new Map(input.milestones.map((row) => [row.code, row]));
  const updates: MilestoneStatusUpdate[] = [];

  for (const milestone of input.milestones) {
    let nextStatus = milestone.status;

    if (milestone.actualAt || milestone.status === MilestoneStatus.COMPLETED) {
      nextStatus = MilestoneStatus.COMPLETED;
    } else if (milestone.status === MilestoneStatus.CANCELLED) {
      nextStatus = MilestoneStatus.CANCELLED;
    } else {
      const delayable = isMilestoneDelayable({
        code: milestone.code,
        milestonesByCode,
        nextAtd: input.nextAtd,
        nextAta: input.nextAta,
        nextDeliveredAt: input.nextDeliveredAt,
      });

      if (!delayable) {
        nextStatus = MilestoneStatus.PENDING;
      } else if (milestone.expectedAt && milestone.expectedAt.getTime() < input.now.getTime()) {
        nextStatus = MilestoneStatus.DELAYED;
      } else if (milestone.status === MilestoneStatus.IN_PROGRESS) {
        nextStatus = MilestoneStatus.IN_PROGRESS;
      } else {
        nextStatus = MilestoneStatus.PENDING;
      }
    }

    if (nextStatus !== milestone.status) {
      updates.push({
        id: milestone.id,
        status: nextStatus,
      });
    }
  }

  return updates;
}

export function evaluateShipmentStatus(input: ShipmentStatusEvaluationInput): ShipmentStatus {
  if (input.currentStatus === ShipmentStatus.CANCELLED) {
    return ShipmentStatus.CANCELLED;
  }
  if (input.currentStatus === ShipmentStatus.CLOSED) {
    return ShipmentStatus.CLOSED;
  }

  const milestonesByCode = new Map(input.milestones.map((row) => [row.code, row]));
  const hasClosed = isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.CLOSED);
  const hasDelivered =
    Boolean(input.deliveredAt) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.DELIVERED);
  const hasCustoms = isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.CUSTOMS_IN_PROGRESS);
  const hasArrived =
    Boolean(input.ata) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.ARRIVED);
  const hasDeparted =
    Boolean(input.atd) || isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.DEPARTED);
  const hasCargoReady = isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.CARGO_READY);
  const hasBookingConfirmed =
    isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_CONFIRMED) ||
    hasCargoReady ||
    hasDeparted ||
    hasArrived ||
    hasCustoms ||
    hasDelivered;
  const hasBookingRequested =
    isMilestoneCompleted(milestonesByCode, MILESTONE_CODES.BOOKING_REQUESTED) ||
    hasBookingConfirmed;

  if (hasClosed) return ShipmentStatus.CLOSED;
  if (hasDelivered) return ShipmentStatus.DELIVERED;
  if (hasCustoms) return ShipmentStatus.CUSTOMS;
  if (hasArrived) return ShipmentStatus.ARRIVED;
  if (hasDeparted) return ShipmentStatus.IN_TRANSIT;
  if (hasBookingConfirmed) return ShipmentStatus.BOOKING_CONFIRMED;
  if (hasBookingRequested) return ShipmentStatus.BOOKING_REQUESTED;
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

  const milestoneByCode = new Map(shipment.milestones.map((row) => [row.code, row]));
  const nextAtd = resolveDateFromMilestone(milestoneByCode, MILESTONE_CODES.DEPARTED, shipment.atd);
  const nextAta = resolveDateFromMilestone(milestoneByCode, MILESTONE_CODES.ARRIVED, shipment.ata);
  const nextDeliveredAt = resolveDateFromMilestone(
    milestoneByCode,
    MILESTONE_CODES.DELIVERED,
    shipment.deliveredAt,
  );
  const milestoneStatusUpdates = resolveMilestoneStatuses({
    milestones: shipment.milestones,
    nextAtd,
    nextAta,
    nextDeliveredAt,
    now: new Date(),
  });

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
