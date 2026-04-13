import { MilestoneStatus, ShipmentStatus } from "@prisma/client";

export const SHIPMENT_MILESTONE_WORKFLOW = [
  { code: "QUOTE_APPROVED", label: "Quote Approved", isCritical: false },
  { code: "BOOKING_REQUESTED", label: "Booking Requested", isCritical: true },
  { code: "BOOKING_CONFIRMED", label: "Booking Confirmed", isCritical: true },
  { code: "DEPARTED", label: "Departed", isCritical: true },
  { code: "CUSTOMS_IN_PROGRESS", label: "Customs In Progress", isCritical: false },
  { code: "ARRIVED", label: "Arrived", isCritical: true },
  { code: "DELIVERED", label: "Delivered", isCritical: true },
  { code: "CLOSED", label: "Closed", isCritical: true },
] as const;

const MILESTONE_LABEL_BY_CODE = new Map<string, string>(
  SHIPMENT_MILESTONE_WORKFLOW.map((milestone) => [milestone.code, milestone.label] as const),
);

const MILESTONE_ORDER_BY_CODE = new Map<string, number>(
  SHIPMENT_MILESTONE_WORKFLOW.map((milestone, index) => [milestone.code, index] as const),
);

const MILESTONE_CRITICAL_BY_CODE = new Map<string, boolean>(
  SHIPMENT_MILESTONE_WORKFLOW.map((milestone) => [milestone.code, milestone.isCritical] as const),
);

const SHIPMENT_STATUS_BY_MILESTONE = new Map<string, ShipmentStatus>([
  ["QUOTE_APPROVED", ShipmentStatus.DRAFT],
  ["BOOKING_REQUESTED", ShipmentStatus.BOOKING_REQUESTED],
  ["BOOKING_CONFIRMED", ShipmentStatus.BOOKING_CONFIRMED],
  ["DEPARTED", ShipmentStatus.IN_TRANSIT],
  ["CUSTOMS_IN_PROGRESS", ShipmentStatus.CUSTOMS],
  ["ARRIVED", ShipmentStatus.ARRIVED],
  ["DELIVERED", ShipmentStatus.DELIVERED],
  ["CLOSED", ShipmentStatus.CLOSED],
]);

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = value instanceof Date ? value : new Date(value);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export function getShipmentMilestoneLabel(code: string, fallback?: string | null) {
  return MILESTONE_LABEL_BY_CODE.get(code) ?? fallback ?? code;
}

export function isCriticalShipmentMilestone(code: string) {
  return MILESTONE_CRITICAL_BY_CODE.get(code) ?? false;
}

export function isShipmentWorkflowMilestone(code: string) {
  return MILESTONE_ORDER_BY_CODE.has(code);
}

export function filterShipmentWorkflowMilestones<T extends { code: string }>(milestones: T[]) {
  return milestones.filter((milestone) => isShipmentWorkflowMilestone(milestone.code));
}

export function deriveShipmentStatusFromMilestones(
  milestones: Array<{ code: string; status: MilestoneStatus; actualAt?: Date | string | null }>,
  currentStatus?: ShipmentStatus | null,
) {
  if (currentStatus === ShipmentStatus.CANCELLED) {
    return ShipmentStatus.CANCELLED;
  }

  const completedCodes = new Set(
    milestones
      .filter(
        (milestone) =>
          isShipmentWorkflowMilestone(milestone.code) &&
          (milestone.status === MilestoneStatus.COMPLETED || Boolean(milestone.actualAt)),
      )
      .map((milestone) => milestone.code),
  );

  for (let index = SHIPMENT_MILESTONE_WORKFLOW.length - 1; index >= 0; index -= 1) {
    const code = SHIPMENT_MILESTONE_WORKFLOW[index]?.code;
    if (!code || !completedCodes.has(code)) continue;
    return SHIPMENT_STATUS_BY_MILESTONE.get(code) ?? ShipmentStatus.DRAFT;
  }

  return ShipmentStatus.DRAFT;
}

export function sortShipmentMilestones<
  T extends {
    code: string;
    createdAt?: Date | string | null;
    actualAt?: Date | string | null;
  },
>(milestones: T[]) {
  return [...milestones].sort((left, right) => {
    const leftIndex = MILESTONE_ORDER_BY_CODE.get(left.code) ?? Number.POSITIVE_INFINITY;
    const rightIndex = MILESTONE_ORDER_BY_CODE.get(right.code) ?? Number.POSITIVE_INFINITY;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;

    const leftTime = toTimestamp(left.actualAt ?? left.createdAt);
    const rightTime = toTimestamp(right.actualAt ?? right.createdAt);
    if (leftTime !== rightTime) return leftTime - rightTime;

    return left.code.localeCompare(right.code);
  });
}
