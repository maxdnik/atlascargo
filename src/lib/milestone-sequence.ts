import { MilestoneStatus } from "@prisma/client";

const STRICT_MILESTONE_SEQUENCE = [
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "CARGO_READY",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_IN_PROGRESS",
  "DELIVERED",
  "CLOSED",
] as const;

export const AUTO_COMPLETE_MISSING_SEQUENCE_MILESTONES =
  process.env.AUTO_COMPLETE_MISSING_MILESTONES === "1";

export type MilestoneSequenceRow = {
  code: string;
  status: MilestoneStatus;
  actualAt: Date | null;
};

export class MilestoneSequenceError extends Error {
  readonly code = "INVALID_MILESTONE_SEQUENCE" as const;
  readonly targetCode: string;
  readonly missingPrerequisites: string[];

  constructor(targetCode: string, missingPrerequisites: string[]) {
    const missingText =
      missingPrerequisites.length === 1
        ? missingPrerequisites[0]
        : missingPrerequisites.join(", ");
    super(`Cannot complete ${targetCode} before ${missingText}`);
    this.targetCode = targetCode;
    this.missingPrerequisites = missingPrerequisites;
    this.name = "MilestoneSequenceError";
  }
}

function isCompletionIntent(input: {
  targetStatus: MilestoneStatus;
  targetActualAt: Date | null;
}) {
  return input.targetStatus === MilestoneStatus.COMPLETED || input.targetActualAt !== null;
}

export function canCompleteMilestoneInSequence(input: {
  targetCode: string;
  milestones: MilestoneSequenceRow[];
}) {
  const targetIndex = STRICT_MILESTONE_SEQUENCE.findIndex((code) => code === input.targetCode);
  if (targetIndex <= 0) {
    return { canComplete: true, blockedReason: null as string | null };
  }
  const milestonesByCode = new Map(input.milestones.map((row) => [row.code, row]));
  const prerequisiteCodes = STRICT_MILESTONE_SEQUENCE.slice(0, targetIndex);
  const missing = prerequisiteCodes.find((code) => {
    const row = milestonesByCode.get(code);
    if (!row) return true;
    return !(row.actualAt || row.status === MilestoneStatus.COMPLETED);
  });
  if (missing) {
    return {
      canComplete: false,
      blockedReason: `Complete ${missing} first`,
    };
  }
  return { canComplete: true, blockedReason: null as string | null };
}

export function validateMilestoneCompletionSequence(input: {
  targetCode: string;
  targetStatus: MilestoneStatus;
  targetActualAt: Date | null;
  milestones: MilestoneSequenceRow[];
  autoCompleteMissing?: boolean;
}) {
  if (!isCompletionIntent({ targetStatus: input.targetStatus, targetActualAt: input.targetActualAt })) {
    return { missingPrerequisites: [], autoCompleteCodes: [] as string[] };
  }

  const targetIndex = STRICT_MILESTONE_SEQUENCE.findIndex((code) => code === input.targetCode);
  if (targetIndex <= 0) {
    return { missingPrerequisites: [], autoCompleteCodes: [] as string[] };
  }

  const milestonesByCode = new Map(input.milestones.map((row) => [row.code, row]));
  const prerequisiteCodes = STRICT_MILESTONE_SEQUENCE.slice(0, targetIndex);
  const missingPrerequisites = prerequisiteCodes.filter((code) => {
    const milestone = milestonesByCode.get(code);
    if (!milestone) return true;
    if (milestone.actualAt) return false;
    return milestone.status !== MilestoneStatus.COMPLETED;
  });

  if (missingPrerequisites.length === 0) {
    return { missingPrerequisites: [], autoCompleteCodes: [] as string[] };
  }

  if (input.autoCompleteMissing) {
    return {
      missingPrerequisites,
      autoCompleteCodes: [...missingPrerequisites],
    };
  }

  throw new MilestoneSequenceError(input.targetCode, missingPrerequisites);
}
