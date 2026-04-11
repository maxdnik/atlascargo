import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  Expense,
  FinancialRecordStatus,
  InvoiceStatus,
  MilestoneStatus,
  Shipment,
  ShipmentCostStatus,
  ShipmentStatus,
  TransportMode,
} from "@prisma/client";
import { deriveShipmentState, isExecutionShipmentStatus } from "@/lib/shipment-state";
import { deriveShipmentFinancialTruth } from "@/lib/finance-truth";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

const STUCK_THRESHOLDS_DAYS: Partial<Record<ShipmentStatus, number>> = {
  [ShipmentStatus.BOOKING_REQUESTED]: 3,
  [ShipmentStatus.BOOKING_CONFIRMED]: 3,
  [ShipmentStatus.IN_TRANSIT]: 7,
  [ShipmentStatus.CUSTOMS]: 5,
};

const INVOICE_EXCLUDED_STATUSES = new Set<InvoiceStatus>([InvoiceStatus.CANCELLED]);

const SHIPMENT_STAGE_INDEX: Record<ShipmentStatus, number> = {
  [ShipmentStatus.DRAFT]: -1,
  [ShipmentStatus.BOOKING_REQUESTED]: 0,
  [ShipmentStatus.BOOKING_CONFIRMED]: 1,
  [ShipmentStatus.IN_TRANSIT]: 3,
  [ShipmentStatus.ARRIVED]: 4,
  [ShipmentStatus.CUSTOMS]: 5,
  [ShipmentStatus.DELIVERED]: 6,
  [ShipmentStatus.CLOSED]: 7,
  [ShipmentStatus.CANCELLED]: 99,
};

const ALERT_PRIORITY: Record<AlertSeverity, number> = {
  [AlertSeverity.CRITICAL]: 0,
  [AlertSeverity.WARNING]: 1,
  [AlertSeverity.INFO]: 2,
};

export type ActionCenterAlertItem = {
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  recommendedAction?: string;
  shipmentId?: string;
  shipmentNumber?: string;
  customerId?: string;
  customerName?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
  source: "rules-engine";
  ruleKey: string;
};

export type ShipmentAlertSnapshot = Pick<
  Shipment,
  | "id"
  | "companyId"
  | "shipmentNumber"
  | "status"
  | "mode"
  | "eta"
  | "etd"
  | "atd"
  | "ata"
  | "deliveredAt"
  | "bookingRef"
  | "houseRef"
  | "masterRef"
  | "updatedAt"
> & {
  customerId: string;
  customerName: string;
  quote: {
    marginAmount: unknown;
    totalSell: unknown;
  } | null;
  milestones: Array<{
    code: string;
    status: string;
    expectedAt: Date | null;
    actualAt: Date | null;
  }>;
  documents: Array<{ docType: string }>;
  invoices: Array<{
    id: string;
    status: InvoiceStatus;
    createdAt: Date;
    dueDate: Date | null;
    total: unknown;
  }>;
  shipmentCosts: Array<{
    amount: unknown;
    dueDate: Date | null;
    status: ShipmentCostStatus;
  }>;
  expenses: Array<Pick<Expense, "amountBase" | "dueDate" | "status">>;
};

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysOverdue(reference: Date, now: Date) {
  const ms = startOfDay(now).getTime() - startOfDay(reference).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function isShipmentDeliveredLike(status: ShipmentStatus) {
  return status === ShipmentStatus.DELIVERED || status === ShipmentStatus.CLOSED;
}

function getRuleKey(type: AlertType, shipmentId: string) {
  return `${shipmentId}:${type}`;
}

function getOverdueSeverity(days: number) {
  return days > 14 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
}

function pushAlert(
  alerts: ActionCenterAlertItem[],
  now: Date,
  shipment: ShipmentAlertSnapshot,
  input: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    recommendedAction?: string;
    metadata?: Record<string, unknown>;
  },
) {
  alerts.push({
    type: input.type,
    severity: input.severity,
    status: AlertStatus.OPEN,
    title: input.title,
    description: input.description,
    recommendedAction: input.recommendedAction,
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    customerId: shipment.customerId,
    customerName: shipment.customerName,
    createdAt: now,
    metadata: input.metadata ?? {},
    source: "rules-engine",
    ruleKey: getRuleKey(input.type, shipment.id),
  });
}

function hasRequiredBill(shipment: ShipmentAlertSnapshot) {
  const hasReference = Boolean(shipment.houseRef || shipment.masterRef);
  const documentTypes = new Set(shipment.documents.map((document) => String(document.docType)));
  const hasAirDoc = documentTypes.has("AWB") || documentTypes.has("HAWB") || documentTypes.has("MAWB");
  const hasOceanDoc = documentTypes.has("BL") || documentTypes.has("HBL") || documentTypes.has("MBL");
  if (shipment.mode === TransportMode.AIR) {
    return hasReference || hasAirDoc;
  }
  if (shipment.mode === TransportMode.OCEAN) {
    return hasReference || hasOceanDoc;
  }
  return hasReference;
}

export function evaluateShipmentAlerts(
  shipment: ShipmentAlertSnapshot,
  now = new Date(),
): ActionCenterAlertItem[] {
  const alerts: ActionCenterAlertItem[] = [];
  const derivedState = deriveShipmentState(
    {
      status: shipment.status,
      atd: shipment.atd,
      ata: shipment.ata,
      deliveredAt: shipment.deliveredAt,
      now,
    },
    shipment.milestones.map((milestone) => ({
      code: milestone.code,
      status: milestone.status,
      expectedAt: milestone.expectedAt,
      actualAt: milestone.actualAt,
    })),
  );
  const openInvoices = shipment.invoices.filter((invoice) => !INVOICE_EXCLUDED_STATUSES.has(invoice.status));
  const financialTruth = deriveShipmentFinancialTruth({
    invoices: shipment.invoices.map((invoice) => ({
      status: invoice.status,
      total: invoice.total,
    })),
    revenues: [],
    shipmentCosts: shipment.shipmentCosts,
    expenses: shipment.expenses,
  });
  const invoiceTotal = financialTruth.revenue;
  const totalCosts = financialTruth.cost;
  const actualMargin = financialTruth.grossProfit;
  const quotedMargin = shipment.quote ? asNumber(shipment.quote.marginAmount) : 0;
  const derivedStageIndex = SHIPMENT_STAGE_INDEX[derivedState.masterStatus];
  const rawStageIndex = SHIPMENT_STAGE_INDEX[shipment.status];

  if (
    shipment.eta &&
    shipment.eta.getTime() < startOfDay(now).getTime() &&
    !isShipmentDeliveredLike(derivedState.masterStatus) &&
    derivedState.masterStatus !== ShipmentStatus.CANCELLED
  ) {
    const delayDays = daysOverdue(shipment.eta, now);
    pushAlert(alerts, now, shipment, {
      type: AlertType.ETA_DELAY,
      severity: delayDays > 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: "ETA delay",
      description: `ETA passed ${delayDays} day(s) ago and shipment is not delivered.`,
      recommendedAction: "Update ETA and communicate revised arrival plan.",
      metadata: { delayDays, eta: shipment.eta.toISOString() },
    });
  }

  if (!hasRequiredBill(shipment) && derivedState.masterStatus !== ShipmentStatus.CANCELLED) {
    pushAlert(alerts, now, shipment, {
      type: AlertType.MISSING_BL,
      severity: isExecutionShipmentStatus(derivedState.masterStatus)
        ? AlertSeverity.CRITICAL
        : AlertSeverity.WARNING,
      title: "Missing BL/AWB reference",
      description: "Shipment is missing required BL/AWB reference or transport document.",
      recommendedAction: "Upload transport document or complete house/master references.",
      metadata: { mode: shipment.mode },
    });
  }

  const customsMilestone = shipment.milestones.find((milestone) => milestone.code === "CUSTOMS_IN_PROGRESS");
  if (
    customsMilestone &&
    customsMilestone.expectedAt &&
    !customsMilestone.actualAt &&
    customsMilestone.status !== "COMPLETED" &&
    customsMilestone.status !== "CANCELLED" &&
    (derivedState.masterStatus === ShipmentStatus.ARRIVED ||
      derivedState.masterStatus === ShipmentStatus.CUSTOMS ||
      derivedState.masterStatus === ShipmentStatus.DELIVERED ||
      derivedState.masterStatus === ShipmentStatus.CLOSED) &&
    customsMilestone.expectedAt.getTime() < now.getTime()
  ) {
    const overdueDays = daysOverdue(customsMilestone.expectedAt, now);
    pushAlert(alerts, now, shipment, {
      type: AlertType.CUSTOMS_DELAY,
      severity: overdueDays > 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: "Customs delay",
      description: `Customs stage is overdue by ${overdueDays} day(s).`,
      recommendedAction: "Escalate customs clearance with broker and update expected release.",
      metadata: { overdueDays, expectedAt: customsMilestone.expectedAt.toISOString() },
    });
  }

  const stuckThreshold = STUCK_THRESHOLDS_DAYS[derivedState.masterStatus];
  if (stuckThreshold && derivedState.masterStatus !== ShipmentStatus.CANCELLED) {
    const ageDays = daysOverdue(shipment.updatedAt, now);
    if (ageDays > stuckThreshold) {
      pushAlert(alerts, now, shipment, {
        type: AlertType.SHIPMENT_STUCK_IN_STAGE,
        severity: ageDays > stuckThreshold * 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        title: "Shipment stuck in stage",
        description: `${derivedState.masterStatus} for ${ageDays} day(s) (threshold ${stuckThreshold}).`,
        recommendedAction: "Review blockers and move shipment to the next valid milestone.",
        metadata: { ageDays, thresholdDays: stuckThreshold, stage: derivedState.masterStatus },
      });
    }
  }

  const departedAt = shipment.atd ?? shipment.milestones.find((item) => item.code === "DEPARTED")?.actualAt ?? null;
  if (departedAt) {
    const hasInvoiceAfterDeparture = openInvoices.some(
      (invoice) => invoice.createdAt.getTime() >= departedAt.getTime(),
    );
    if (!hasInvoiceAfterDeparture && now.getTime() - departedAt.getTime() >= TWO_DAYS_MS) {
      pushAlert(alerts, now, shipment, {
        type: AlertType.MISSING_INVOICE_AFTER_DEPARTURE,
        severity: AlertSeverity.CRITICAL,
        title: "Missing invoice after departure",
        description: "Shipment departed over 48h ago and no invoice has been created.",
        recommendedAction: "Create invoice immediately and confirm billing owner.",
        metadata: { departedAt: departedAt.toISOString() },
      });
    }
  }

  if (actualMargin < 0) {
    pushAlert(alerts, now, shipment, {
      type: AlertType.NEGATIVE_MARGIN,
      severity: AlertSeverity.CRITICAL,
      title: "Negative margin",
      description: `Current margin is ${actualMargin.toFixed(2)} (revenue ${invoiceTotal.toFixed(2)} vs costs ${totalCosts.toFixed(2)}).`,
      recommendedAction: "Escalate commercial recovery and review supplier costs.",
      metadata: { actualMargin, invoiceTotal, totalCosts },
    });
  }

  if (quotedMargin > 0 && actualMargin >= 0 && actualMargin < quotedMargin) {
    const leakage = quotedMargin - actualMargin;
    pushAlert(alerts, now, shipment, {
      type: AlertType.LOW_MARGIN_VS_QUOTE,
      severity: leakage > quotedMargin * 0.3 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: "Margin below quoted baseline",
      description: `Actual margin (${actualMargin.toFixed(2)}) is below quoted margin (${quotedMargin.toFixed(2)}).`,
      recommendedAction: "Validate sell recovery and update profitability assumptions.",
      metadata: { actualMargin, quotedMargin, leakage },
    });
  }

  if (totalCosts > 0 && invoiceTotal <= 0) {
    pushAlert(alerts, now, shipment, {
      type: AlertType.COST_WITHOUT_REVENUE,
      severity: AlertSeverity.CRITICAL,
      title: "Cost without revenue",
      description: `Costs (${totalCosts.toFixed(2)}) are loaded without billed revenue.`,
      recommendedAction: "Issue invoice and verify cost allocation.",
      metadata: { totalCosts },
    });
  }

  const overdueReceivables = openInvoices.filter((invoice) => {
    if (!invoice.dueDate) return false;
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) return false;
    return invoice.dueDate.getTime() < startOfDay(now).getTime();
  });
  if (overdueReceivables.length > 0) {
    const maxOverdueDays = Math.max(...overdueReceivables.map((invoice) => daysOverdue(invoice.dueDate!, now)));
    const overdueAmount = overdueReceivables.reduce((sum, invoice) => sum + asNumber(invoice.total), 0);
    pushAlert(alerts, now, shipment, {
      type: AlertType.OVERDUE_RECEIVABLE,
      severity: getOverdueSeverity(maxOverdueDays),
      title: "Overdue receivable",
      description: `${overdueReceivables.length} invoice(s) overdue totaling ${overdueAmount.toFixed(2)}.`,
      recommendedAction: "Trigger collections follow-up and update expected payment date.",
      metadata: { overdueCount: overdueReceivables.length, overdueAmount, maxOverdueDays },
    });
  }

  const overdueShipmentCosts = shipment.shipmentCosts.filter((row) => {
    if (!row.dueDate) return false;
    if (row.status === ShipmentCostStatus.PAID) return false;
    return row.dueDate.getTime() < startOfDay(now).getTime();
  });
  const overdueExpenses = shipment.expenses.filter((row) => {
    if (!row.dueDate) return false;
    if (row.status === FinancialRecordStatus.PAID) return false;
    return row.dueDate.getTime() < startOfDay(now).getTime();
  });
  if (overdueShipmentCosts.length > 0 || overdueExpenses.length > 0) {
    const maxOverdueDays = Math.max(
      0,
      ...overdueShipmentCosts.map((row) => daysOverdue(row.dueDate!, now)),
      ...overdueExpenses.map((row) => daysOverdue(row.dueDate!, now)),
    );
    const overdueAmount =
      overdueShipmentCosts.reduce((sum, row) => sum + asNumber(row.amount), 0) +
      overdueExpenses.reduce((sum, row) => sum + asNumber(row.amountBase), 0);
    pushAlert(alerts, now, shipment, {
      type: AlertType.OVERDUE_PAYABLE,
      severity: getOverdueSeverity(maxOverdueDays),
      title: "Overdue payable",
      description: `Payables overdue by up to ${maxOverdueDays} day(s), total ${overdueAmount.toFixed(2)}.`,
      recommendedAction: "Prioritize supplier payments and confirm AP release date.",
      metadata: {
        overdueShipmentCosts: overdueShipmentCosts.length,
        overdueExpenses: overdueExpenses.length,
        overdueAmount,
        maxOverdueDays,
      },
    });
  }

  const hasDepartureEvidence =
    Boolean(shipment.atd) ||
    shipment.milestones.some(
      (milestone) =>
        milestone.code === "DEPARTED" &&
        (milestone.actualAt !== null || milestone.status === MilestoneStatus.COMPLETED),
    );
  const hasArrivalEvidence =
    Boolean(shipment.ata) ||
    shipment.milestones.some(
      (milestone) =>
        milestone.code === "ARRIVED" &&
        (milestone.actualAt !== null || milestone.status === MilestoneStatus.COMPLETED),
    );
  const hasDeliveryEvidence =
    Boolean(shipment.deliveredAt) ||
    shipment.milestones.some(
      (milestone) =>
        milestone.code === "DELIVERED" &&
        (milestone.actualAt !== null || milestone.status === MilestoneStatus.COMPLETED),
    );

  if (
    (derivedState.masterStatus === ShipmentStatus.IN_TRANSIT && !hasDepartureEvidence) ||
    (derivedState.masterStatus === ShipmentStatus.ARRIVED && !hasArrivalEvidence) ||
    (derivedState.masterStatus === ShipmentStatus.DELIVERED && !hasDeliveryEvidence)
  ) {
    pushAlert(alerts, now, shipment, {
      type: AlertType.MISSING_CRITICAL_MILESTONE,
      severity: AlertSeverity.CRITICAL,
      title: "Missing critical milestone",
      description: `Status ${derivedState.masterStatus} is missing required milestone evidence.`,
      recommendedAction: "Update the milestone record before progressing shipment status.",
      metadata: {
        hasDepartureEvidence,
        hasArrivalEvidence,
        hasDeliveryEvidence,
        status: derivedState.masterStatus,
      },
    });
  }

  if (
    shipment.status !== ShipmentStatus.CANCELLED &&
    derivedState.masterStatus !== ShipmentStatus.CANCELLED &&
    shipment.status !== derivedState.masterStatus
  ) {
    const stageGap = Math.abs(rawStageIndex - derivedStageIndex);
    pushAlert(alerts, now, shipment, {
      type: AlertType.SHIPMENT_WITH_INCONSISTENT_STATE,
      severity: stageGap > 1 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: "Shipment state inconsistency",
      description: `Stored status (${shipment.status}) does not match derived status (${derivedState.masterStatus}).`,
      recommendedAction: "Reconcile milestone completion and synchronize shipment status.",
      metadata: {
        storedStatus: shipment.status,
        derivedStatus: derivedState.masterStatus,
        stageGap,
      },
    });
  }

  return alerts;
}

export function evaluateCompanyAlerts(input: {
  shipments: ShipmentAlertSnapshot[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const alerts = input.shipments.flatMap((shipment) => evaluateShipmentAlerts(shipment, now));
  const dedupedByKey = new Map<string, ActionCenterAlertItem>();

  for (const alert of alerts) {
    const existing = dedupedByKey.get(alert.ruleKey);
    if (!existing) {
      dedupedByKey.set(alert.ruleKey, alert);
      continue;
    }
    if (ALERT_PRIORITY[alert.severity] < ALERT_PRIORITY[existing.severity]) {
      dedupedByKey.set(alert.ruleKey, alert);
    }
  }

  return Array.from(dedupedByKey.values()).sort((a, b) => {
    const severityDelta = ALERT_PRIORITY[a.severity] - ALERT_PRIORITY[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.ruleKey.localeCompare(b.ruleKey);
  });
}
