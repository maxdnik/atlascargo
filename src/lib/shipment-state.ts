export const SHIPMENT_STATUS_CODES = [
  "DRAFT",
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
] as const;

export type ShipmentStatusCode = (typeof SHIPMENT_STATUS_CODES)[number];

export const MILESTONE_STATUS_CODES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED",
  "CANCELLED",
] as const;

export type MilestoneStatusCode = (typeof MILESTONE_STATUS_CODES)[number];

export const SHIPMENT_STAGE_SEQUENCE = [
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "CARGO_READY",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_IN_PROGRESS",
  "DELIVERED",
  "CLOSED",
] as const;

export const STRICT_MILESTONE_SEQUENCE = SHIPMENT_STAGE_SEQUENCE;
export type StrictMilestoneCode = (typeof SHIPMENT_STAGE_SEQUENCE)[number];

export type ShipmentStateEngineShipmentInput = {
  status?: ShipmentStatusCode | string | null;
  atd?: Date | null;
  ata?: Date | null;
  deliveredAt?: Date | null;
  now?: Date;
  preserveTerminalStatus?: boolean;
};

export type ShipmentStateEngineMilestoneInput = {
  id?: string;
  code: string;
  status?: MilestoneStatusCode | string | null;
  expectedAt?: Date | null;
  actualAt?: Date | null;
};

type MilestoneCompletionRow = {
  code: string;
  status: MilestoneStatusCode | string;
  actualAt: Date | null;
};

export type MilestoneCompletionHint = {
  code: string;
  canComplete: boolean;
  blockedReason: string | null;
  missingPrerequisites: string[];
};

export type ShipmentDerivedState = {
  masterStatus: ShipmentStatusCode;
  currentStage: string;
  currentStageLabel: string;
  lastCompletedMilestone: string | null;
  nextExpectedMilestone: string | null;
  delayedMilestones: string[];
  actionableMilestones: string[];
  milestoneStatusByCode: Record<string, MilestoneStatusCode>;
  completionHintsByCode: Record<string, MilestoneCompletionHint>;
  isDelayed: boolean;
  hasOperationalIssue: boolean;
  progressPercent: number;
  dates: {
    atd: Date | null;
    ata: Date | null;
    deliveredAt: Date | null;
  };
};

const SHIPMENT_STATUS_TO_STAGE: Record<ShipmentStatusCode, string> = {
  DRAFT: "DRAFT",
  BOOKING_REQUESTED: "BOOKING_REQUESTED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  IN_TRANSIT: "DEPARTED",
  ARRIVED: "ARRIVED",
  CUSTOMS: "CUSTOMS_IN_PROGRESS",
  DELIVERED: "DELIVERED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
};

const STAGE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  BOOKING_REQUESTED: "Booking Requested",
  BOOKING_CONFIRMED: "Booking Confirmed",
  CARGO_READY: "Cargo Ready",
  DEPARTED: "Departed",
  ARRIVED: "Arrived",
  CUSTOMS_IN_PROGRESS: "Customs In Progress",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PROGRESS_SEQUENCE: StrictMilestoneCode[] = [
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "CARGO_READY",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_IN_PROGRESS",
  "DELIVERED",
];

const EXECUTION_MASTER_STATUSES = new Set<ShipmentStatusCode>([
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "CLOSED",
]);

function isMilestoneCompleted(row: { status: string; actualAt: Date | null }) {
  if (row.actualAt) return true;
  return row.status === "COMPLETED";
}

function isMilestoneCancelled(row: { status: string }) {
  return row.status === "CANCELLED";
}

function buildMilestoneLookup(milestones: ShipmentStateEngineMilestoneInput[]) {
  return new Map(milestones.map((row) => [row.code, row]));
}

function cloneCompletionSet(source: Set<StrictMilestoneCode>) {
  return new Set<StrictMilestoneCode>(source);
}

function seedCompletedSet(input: {
  currentStatus: ShipmentStatusCode | string;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
  milestonesByCode: Map<string, ShipmentStateEngineMilestoneInput>;
}): Set<StrictMilestoneCode> {
  const completed = new Set<StrictMilestoneCode>();

  for (const code of SHIPMENT_STAGE_SEQUENCE) {
    const row = input.milestonesByCode.get(code);
    if (row && isMilestoneCompleted({ status: String(row.status ?? "PENDING"), actualAt: row.actualAt ?? null })) {
      completed.add(code);
    }
  }

  if (input.atd) completed.add("DEPARTED");
  if (input.ata) completed.add("ARRIVED");
  if (input.deliveredAt) completed.add("DELIVERED");

  if (String(input.currentStatus) === "CLOSED") {
    completed.add("CLOSED");
  }

  for (const code of cloneCompletionSet(completed)) {
    const index = SHIPMENT_STAGE_SEQUENCE.indexOf(code);
    if (index <= 0) continue;
    for (let i = 0; i < index; i += 1) {
      completed.add(SHIPMENT_STAGE_SEQUENCE[i]);
    }
  }

  return completed;
}

function getCanonicalDate(input: {
  milestonesByCode: Map<string, ShipmentStateEngineMilestoneInput>;
  code: StrictMilestoneCode;
  fallback: Date | null;
}) {
  const fromMilestone = input.milestonesByCode.get(input.code)?.actualAt ?? null;
  return fromMilestone ?? input.fallback;
}

export function getMilestoneCompletionHint(input: {
  targetCode: string;
  milestones: MilestoneCompletionRow[];
}): MilestoneCompletionHint {
  const targetIndex = SHIPMENT_STAGE_SEQUENCE.findIndex((code) => code === input.targetCode);
  if (targetIndex <= 0) {
    return {
      code: input.targetCode,
      canComplete: true,
      blockedReason: null,
      missingPrerequisites: [],
    };
  }

  const milestonesByCode = new Map(input.milestones.map((row) => [row.code, row]));
  const prerequisiteCodes = SHIPMENT_STAGE_SEQUENCE.slice(0, targetIndex);
  const missingPrerequisites = prerequisiteCodes.filter((code) => {
    const row = milestonesByCode.get(code);
    if (!row) return true;
    return !isMilestoneCompleted(row);
  });

  if (missingPrerequisites.length === 0) {
    return {
      code: input.targetCode,
      canComplete: true,
      blockedReason: null,
      missingPrerequisites: [],
    };
  }

  return {
    code: input.targetCode,
    canComplete: false,
    blockedReason: `Complete ${missingPrerequisites[0]} first`,
    missingPrerequisites,
  };
}

export function deriveMilestoneCompletionHints(input: {
  milestones: MilestoneCompletionRow[];
}): MilestoneCompletionHint[] {
  return input.milestones.map((row) => {
    const alreadyCompleted = isMilestoneCompleted(row);
    if (alreadyCompleted) {
      return {
        code: row.code,
        canComplete: true,
        blockedReason: null,
        missingPrerequisites: [],
      };
    }
    return getMilestoneCompletionHint({
      targetCode: row.code,
      milestones: input.milestones,
    });
  });
}

export function getStatusLabel(code: string) {
  if (code in STAGE_LABELS) {
    return STAGE_LABELS[code];
  }
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveShipmentState(
  shipment: ShipmentStateEngineShipmentInput,
  milestones: ShipmentStateEngineMilestoneInput[],
): ShipmentDerivedState {
  const now = shipment.now ?? new Date();
  const preserveTerminalStatus = shipment.preserveTerminalStatus ?? true;
  const currentStatus = String(shipment.status ?? "DRAFT") as ShipmentStatusCode;
  const milestoneRows = milestones.map((row) => ({
    code: row.code,
    status: String(row.status ?? "PENDING"),
    expectedAt: row.expectedAt ?? null,
    actualAt: row.actualAt ?? null,
  }));
  const milestonesByCode = buildMilestoneLookup(milestoneRows);
  const canonicalAtd = getCanonicalDate({
    milestonesByCode,
    code: "DEPARTED",
    fallback: shipment.atd ?? null,
  });
  const canonicalAta = getCanonicalDate({
    milestonesByCode,
    code: "ARRIVED",
    fallback: shipment.ata ?? null,
  });
  const canonicalDeliveredAt = getCanonicalDate({
    milestonesByCode,
    code: "DELIVERED",
    fallback: shipment.deliveredAt ?? null,
  });
  const completedSet = seedCompletedSet({
    currentStatus,
    atd: canonicalAtd,
    ata: canonicalAta,
    deliveredAt: canonicalDeliveredAt,
    milestonesByCode,
  });
  const completionHints = deriveMilestoneCompletionHints({
    milestones: milestoneRows.map((row) => ({
      code: row.code,
      status: row.status,
      actualAt: row.actualAt,
    })),
  });
  const completionHintsByCode = Object.fromEntries(
    completionHints.map((hint) => [hint.code, hint]),
  ) as Record<string, MilestoneCompletionHint>;

  const nextExpectedMilestone =
    SHIPMENT_STAGE_SEQUENCE.find((code) => !completedSet.has(code)) ?? null;

  const actionableMilestones = nextExpectedMilestone ? [nextExpectedMilestone] : [];

  let masterStatus: ShipmentStatusCode = "DRAFT";

  if (preserveTerminalStatus && currentStatus === "CANCELLED") {
    masterStatus = "CANCELLED";
  } else if (preserveTerminalStatus && currentStatus === "CLOSED") {
    masterStatus = "CLOSED";
  } else if (completedSet.has("CLOSED")) {
    masterStatus = "CLOSED";
  } else if (completedSet.has("DELIVERED") || canonicalDeliveredAt) {
    masterStatus = "DELIVERED";
  } else if (completedSet.has("CUSTOMS_IN_PROGRESS")) {
    masterStatus = "CUSTOMS";
  } else if (completedSet.has("ARRIVED") || canonicalAta) {
    masterStatus = "ARRIVED";
  } else if (completedSet.has("DEPARTED") || canonicalAtd) {
    masterStatus = "IN_TRANSIT";
  } else if (completedSet.has("BOOKING_CONFIRMED") || completedSet.has("CARGO_READY")) {
    masterStatus = "BOOKING_CONFIRMED";
  } else if (completedSet.has("BOOKING_REQUESTED")) {
    masterStatus = "BOOKING_REQUESTED";
  }

  const currentStage = SHIPMENT_STATUS_TO_STAGE[masterStatus];
  const currentStageLabel = getStatusLabel(currentStage);

  const lastCompletedMilestone =
    [...SHIPMENT_STAGE_SEQUENCE]
      .reverse()
      .find((code) => completedSet.has(code)) ?? null;

  const milestoneStatusByCode: Record<string, MilestoneStatusCode> = {};
  const delayedMilestones: string[] = [];

  for (const milestone of milestoneRows) {
    let nextStatus: MilestoneStatusCode;
    if (isMilestoneCompleted(milestone)) {
      nextStatus = "COMPLETED";
    } else if (isMilestoneCancelled(milestone)) {
      nextStatus = "CANCELLED";
    } else {
      const hint = completionHintsByCode[milestone.code];
      const delayable = hint ? hint.canComplete : true;
      if (delayable && milestone.expectedAt && milestone.expectedAt.getTime() < now.getTime()) {
        nextStatus = "DELAYED";
      } else if (delayable && milestone.status === "IN_PROGRESS") {
        nextStatus = "IN_PROGRESS";
      } else {
        nextStatus = "PENDING";
      }
    }
    milestoneStatusByCode[milestone.code] = nextStatus;
    if (nextStatus === "DELAYED") {
      delayedMilestones.push(milestone.code);
    }
  }

  const completedProgressCount = PROGRESS_SEQUENCE.filter((code) => completedSet.has(code)).length;
  const progressPercent =
    masterStatus === "CLOSED"
      ? 100
      : Math.round((completedProgressCount / PROGRESS_SEQUENCE.length) * 100);

  const isDelayed = delayedMilestones.length > 0;
  const hasOperationalIssue = isDelayed;

  return {
    masterStatus,
    currentStage,
    currentStageLabel,
    lastCompletedMilestone,
    nextExpectedMilestone,
    delayedMilestones,
    actionableMilestones,
    milestoneStatusByCode,
    completionHintsByCode,
    isDelayed,
    hasOperationalIssue,
    progressPercent,
    dates: {
      atd: canonicalAtd,
      ata: canonicalAta,
      deliveredAt: canonicalDeliveredAt,
    },
  };
}

export function isExecutionShipmentStatus(status: ShipmentStatusCode | string) {
  return EXECUTION_MASTER_STATUSES.has(status as ShipmentStatusCode);
}
