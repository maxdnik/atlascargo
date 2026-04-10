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

export type ShipmentStageCode = (typeof SHIPMENT_STAGE_SEQUENCE)[number];

export type ShipmentMasterStatus =
  | "DRAFT"
  | "BOOKING_REQUESTED"
  | "BOOKING_CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "CUSTOMS"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export type ShipmentStateEngineShipmentInput = {
  status?: ShipmentMasterStatus | string | null;
  atd?: Date | null;
  ata?: Date | null;
  deliveredAt?: Date | null;
};

export type ShipmentStateEngineMilestoneInput = {
  code: string;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED" | string | null;
  expectedAt?: Date | null;
  actualAt?: Date | null;
};

export type ShipmentDerivedState = {
  masterStatus: ShipmentMasterStatus;
  currentStage: ShipmentStageCode | "DRAFT" | "CANCELLED";
  lastCompletedMilestone: ShipmentStageCode | null;
  nextExpectedMilestone: ShipmentStageCode | null;
  delayedMilestones: ShipmentStageCode[];
  isDelayed: boolean;
};

function isCompletedMilestone(milestone: ShipmentStateEngineMilestoneInput) {
  if (milestone.actualAt) return true;
  return milestone.status === "COMPLETED";
}

function isMilestoneCancelled(milestone: ShipmentStateEngineMilestoneInput) {
  return milestone.status === "CANCELLED";
}

function toStageStatus(stage: ShipmentStageCode): ShipmentMasterStatus {
  if (stage === "DEPARTED") return "IN_TRANSIT";
  if (stage === "CUSTOMS_IN_PROGRESS") return "CUSTOMS";
  return stage;
}

function buildCompletedStages(
  shipment: ShipmentStateEngineShipmentInput,
  milestonesByCode: Map<string, ShipmentStateEngineMilestoneInput>,
) {
  const completed = new Set<ShipmentStageCode>();

  for (const stage of SHIPMENT_STAGE_SEQUENCE) {
    const milestone = milestonesByCode.get(stage);
    if (milestone && isCompletedMilestone(milestone)) {
      completed.add(stage);
    }
  }

  if (shipment.atd) completed.add("DEPARTED");
  if (shipment.ata) completed.add("ARRIVED");
  if (shipment.deliveredAt) completed.add("DELIVERED");
  if (shipment.status === "CLOSED") completed.add("CLOSED");

  return completed;
}

export function deriveShipmentState(
  shipment: ShipmentStateEngineShipmentInput,
  milestones: ShipmentStateEngineMilestoneInput[],
): ShipmentDerivedState {
  const now = new Date();
  const milestonesByCode = new Map(milestones.map((milestone) => [milestone.code, milestone]));
  const completedStages = buildCompletedStages(shipment, milestonesByCode);

  if (shipment.status === "CANCELLED") {
    return {
      masterStatus: "CANCELLED",
      currentStage: "CANCELLED",
      lastCompletedMilestone: null,
      nextExpectedMilestone: null,
      delayedMilestones: [],
      isDelayed: false,
    };
  }

  let lastCompletedMilestone: ShipmentStageCode | null = null;
  for (let idx = SHIPMENT_STAGE_SEQUENCE.length - 1; idx >= 0; idx -= 1) {
    const stage = SHIPMENT_STAGE_SEQUENCE[idx];
    if (completedStages.has(stage)) {
      lastCompletedMilestone = stage;
      break;
    }
  }

  const nextExpectedMilestone =
    SHIPMENT_STAGE_SEQUENCE.find((stage) => !completedStages.has(stage)) ?? null;

  let masterStatus: ShipmentMasterStatus = "DRAFT";
  if (lastCompletedMilestone) {
    masterStatus = toStageStatus(lastCompletedMilestone);
  } else if (shipment.status === "BOOKING_REQUESTED") {
    masterStatus = "BOOKING_REQUESTED";
  } else if (shipment.status === "BOOKING_CONFIRMED") {
    masterStatus = "BOOKING_CONFIRMED";
  }

  const currentStage: ShipmentDerivedState["currentStage"] =
    masterStatus === "IN_TRANSIT"
      ? "DEPARTED"
      : masterStatus === "CUSTOMS"
        ? "CUSTOMS_IN_PROGRESS"
        : masterStatus === "DRAFT" || masterStatus === "CANCELLED"
          ? masterStatus
          : (masterStatus as ShipmentStageCode);

  const maxDelayableIndex = nextExpectedMilestone
    ? SHIPMENT_STAGE_SEQUENCE.indexOf(nextExpectedMilestone)
    : SHIPMENT_STAGE_SEQUENCE.length - 1;

  const delayedMilestones: ShipmentStageCode[] = [];
  for (const stage of SHIPMENT_STAGE_SEQUENCE) {
    const milestone = milestonesByCode.get(stage);
    if (!milestone || isMilestoneCancelled(milestone) || isCompletedMilestone(milestone)) continue;

    const stageIndex = SHIPMENT_STAGE_SEQUENCE.indexOf(stage);
    const isActionableStage = stageIndex <= maxDelayableIndex;
    if (!isActionableStage) continue;

    if (milestone.expectedAt && milestone.expectedAt.getTime() < now.getTime()) {
      delayedMilestones.push(stage);
    }
  }

  return {
    masterStatus,
    currentStage,
    lastCompletedMilestone,
    nextExpectedMilestone,
    delayedMilestones,
    isDelayed: delayedMilestones.length > 0,
  };
}
