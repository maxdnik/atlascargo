export const SHIPMENT_MILESTONE_WORKFLOW = [
  { code: "QUOTE_APPROVED", label: "Quote Approved", isCritical: false },
  { code: "CARGO_READY", label: "Cargo Ready", isCritical: true },
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
