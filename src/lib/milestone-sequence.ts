import { MilestoneStatus } from "@prisma/client";
import {
  STRICT_MILESTONE_SEQUENCE,
  getMilestoneCompletionHint,
} from "@/lib/shipment-state";

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
  const hint = getMilestoneCompletionHint({
    targetCode: input.targetCode,
    milestones: input.milestones,
  });
  if (!hint.canComplete) {
    return {
      canComplete: false,
      blockedReason: hint.blockedReason,
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

  const hint = getMilestoneCompletionHint({
    targetCode: input.targetCode,
    milestones: input.milestones,
  });
  const missingPrerequisites = [...hint.missingPrerequisites];

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
