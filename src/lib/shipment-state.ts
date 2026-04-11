import { MilestoneStatus, ShipmentStatus } from "@prisma/client";

const STAGE_SEQUENCE = [
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "CARGO_READY",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_IN_PROGRESS",
  "DELIVERED",
  "CLOSED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  BOOKING_REQUESTED: "Booking Requested",
  BOOKING_CONFIRMED: "Booking Confirmed",
  CARGO_READY: "Cargo Ready",
  DEPARTED: "Departed",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
  CUSTOMS_IN_PROGRESS: "Customs In Progress",
  CUSTOMS: "Customs",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const EXECUTION_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.CUSTOMS,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CLOSED,
]);

export type ShipmentStateInput = {
  status?: ShipmentStatus | string | null;
  atd?: Date | null;
  ata?: Date | null;
  deliveredAt?: Date | null;
  now?: Date;
};

export type ShipmentStateMilestoneInput = {
  code: string;
  status?: MilestoneStatus | string | null;
  expectedAt?: Date | null;
  actualAt?: Date | null;
};

export type ShipmentDerivedState = {
  masterStatus: ShipmentStatus;
  currentStage: string;
  lastCompletedMilestone: string | null;
  nextExpectedMilestone: string | null;
  delayedMilestones: string[];
  isDelayed: boolean;
};

function isValidShipmentStatus(value: string): value is ShipmentStatus {
  return Object.values(ShipmentStatus).includes(value as ShipmentStatus);
}

function isMilestoneCompleted(status: string, actualAt: Date | null | undefined) {
  return Boolean(actualAt) || status === MilestoneStatus.COMPLETED;
}

function isMilestoneCancelled(status: string) {
  return status === MilestoneStatus.CANCELLED;
}

export function getStatusLabel(code: string) {
  return (
    STATUS_LABELS[code] ??
    code
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function isExecutionShipmentStatus(status: ShipmentStatus | string) {
  return EXECUTION_STATUSES.has(status as ShipmentStatus);
}

export function deriveShipmentState(
  shipment: ShipmentStateInput,
  milestones: ShipmentStateMilestoneInput[],
): ShipmentDerivedState {
  const now = shipment.now ?? new Date();
  const currentStatus = String(shipment.status ?? ShipmentStatus.DRAFT);
  const milestoneByCode = new Map(
    milestones.map((row) => [
      row.code,
      {
        status: String(row.status ?? MilestoneStatus.PENDING),
        expectedAt: row.expectedAt ?? null,
        actualAt: row.actualAt ?? null,
      },
    ]),
  );

  const completed = new Set<string>();
  for (const code of STAGE_SEQUENCE) {
    const row = milestoneByCode.get(code);
    if (row && isMilestoneCompleted(row.status, row.actualAt)) {
      completed.add(code);
    }
  }
  if (shipment.atd) completed.add("DEPARTED");
  if (shipment.ata) completed.add("ARRIVED");
  if (shipment.deliveredAt) completed.add("DELIVERED");
  if (currentStatus === ShipmentStatus.CLOSED) completed.add("CLOSED");

  for (const code of Array.from(completed)) {
    const index = STAGE_SEQUENCE.findIndex((item) => item === code);
    if (index <= 0) continue;
    for (let i = 0; i < index; i += 1) {
      completed.add(STAGE_SEQUENCE[i]);
    }
  }

  const lastCompletedMilestone =
    [...STAGE_SEQUENCE].reverse().find((code) => completed.has(code)) ?? null;
  const nextExpectedMilestone = STAGE_SEQUENCE.find((code) => !completed.has(code)) ?? null;

  const delayedMilestones: string[] = [];
  for (const code of STAGE_SEQUENCE) {
    const row = milestoneByCode.get(code);
    if (!row) continue;
    if (isMilestoneCompleted(row.status, row.actualAt)) continue;
    if (isMilestoneCancelled(row.status)) continue;

    const index = STAGE_SEQUENCE.findIndex((item) => item === code);
    const prerequisites = STAGE_SEQUENCE.slice(0, index);
    const isActionable = prerequisites.every((prereq) => completed.has(prereq));
    if (!isActionable) continue;
    if (row.expectedAt && row.expectedAt.getTime() < now.getTime()) {
      delayedMilestones.push(code);
    }
  }

  let masterStatus: ShipmentStatus;
  if (currentStatus === ShipmentStatus.CANCELLED) {
    masterStatus = ShipmentStatus.CANCELLED;
  } else if (completed.has("CLOSED")) {
    masterStatus = ShipmentStatus.CLOSED;
  } else if (completed.has("DELIVERED")) {
    masterStatus = ShipmentStatus.DELIVERED;
  } else if (completed.has("CUSTOMS_IN_PROGRESS")) {
    masterStatus = ShipmentStatus.CUSTOMS;
  } else if (completed.has("ARRIVED")) {
    masterStatus = ShipmentStatus.ARRIVED;
  } else if (completed.has("DEPARTED")) {
    masterStatus = ShipmentStatus.IN_TRANSIT;
  } else if (completed.has("BOOKING_CONFIRMED") || completed.has("CARGO_READY")) {
    masterStatus = ShipmentStatus.BOOKING_CONFIRMED;
  } else if (completed.has("BOOKING_REQUESTED")) {
    masterStatus = ShipmentStatus.BOOKING_REQUESTED;
  } else if (isValidShipmentStatus(currentStatus)) {
    masterStatus = currentStatus;
  } else {
    masterStatus = ShipmentStatus.DRAFT;
  }

  const currentStage =
    lastCompletedMilestone ??
    (masterStatus === ShipmentStatus.IN_TRANSIT
      ? "DEPARTED"
      : masterStatus === ShipmentStatus.CUSTOMS
        ? "CUSTOMS_IN_PROGRESS"
        : masterStatus);

  return {
    masterStatus,
    currentStage,
    lastCompletedMilestone,
    nextExpectedMilestone,
    delayedMilestones,
    isDelayed: delayedMilestones.length > 0,
  };
}
