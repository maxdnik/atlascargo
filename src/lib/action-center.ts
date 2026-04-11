import { InvoiceStatus, MilestoneStatus, ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listOpenAlertsForCompany, type AlertFeedRow } from "@/lib/alerts";

const CRITICAL_STATUS_ORDER = new Set<ShipmentStatus>([
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.CUSTOMS,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CLOSED,
]);

const DELIVERED_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CLOSED,
]);

const ACTIVE_OPERATIONAL_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.BOOKING_REQUESTED,
  ShipmentStatus.BOOKING_CONFIRMED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.CUSTOMS,
  ShipmentStatus.DELIVERED,
]);

const STUCK_THRESHOLDS_DAYS: Partial<Record<ShipmentStatus, number>> = {
  [ShipmentStatus.BOOKING_REQUESTED]: 3,
  [ShipmentStatus.BOOKING_CONFIRMED]: 3,
  [ShipmentStatus.IN_TRANSIT]: 7,
  [ShipmentStatus.CUSTOMS]: 5,
};

type Severity = "HIGH" | "MEDIUM" | "LOW";

type AlertRow = {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  customer: string;
  issue: string;
  ctaHref: string;
};

type FinancialRiskRow = AlertRow & {
  amountImpact: number;
  ctaLabel: string;
};

type GeneratedTask = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  ctaHref: string;
};

type QuickShipment = {
  id: string;
  shipmentNumber: string;
  customer: string;
  status: ShipmentStatus;
  updatedAt: Date;
};

type QuickInvoice = {
  id: string;
  invoiceNumber: string;
  customer: string;
  status: InvoiceStatus;
  total: number;
  updatedAt: Date;
};

export type ActionCenterData = {
  alerts: AlertFeedRow[];
  criticalAlerts: {
    missingDocuments: AlertRow[];
    delayedShipments: AlertRow[];
    stuckStatuses: AlertRow[];
    missingMilestones: AlertRow[];
  };
  operationalRisks: Record<Severity, AlertRow[]>;
  financialRisks: {
    noInvoice: FinancialRiskRow[];
    lowOrNegativeMargin: FinancialRiskRow[];
    costWithoutRevenue: FinancialRiskRow[];
    overdueInvoices: FinancialRiskRow[];
  };
  tasks: {
    operations: GeneratedTask[];
    finance: GeneratedTask[];
  };
  quickActions: {
    recentShipments: QuickShipment[];
    recentInvoices: QuickInvoice[];
  };
};

function asMoney(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(date: Date, from: Date) {
  const ms = startOfDay(from).getTime() - startOfDay(date).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function toAlertRow(input: {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  customer: string;
  issue: string;
}): AlertRow {
  return {
    id: input.id,
    shipmentId: input.shipmentId,
    shipmentNumber: input.shipmentNumber,
    customer: input.customer,
    issue: input.issue,
    ctaHref: `/shipments/${input.shipmentId}`,
  };
}

function addTask(
  map: Map<string, GeneratedTask>,
  input: {
    key: string;
    title: string;
    detail: string;
    severity: Severity;
    ctaHref: string;
  },
) {
  if (map.has(input.key)) return;
  map.set(input.key, {
    id: input.key,
    title: input.title,
    detail: input.detail,
    severity: input.severity,
    ctaHref: input.ctaHref,
  });
}

export async function getActionCenterData(companyId: string): Promise<ActionCenterData> {
  const today = new Date();
  const todayStart = startOfDay(today);

  const [shipments, recentShipments, recentInvoices, alerts] = await Promise.all([
    prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentNumber: true,
        mode: true,
        status: true,
        customer: { select: { legalName: true } },
        quote: {
          select: {
            marginAmount: true,
            totalSell: true,
          },
        },
        originCode: true,
        destinationCode: true,
        pol: true,
        pod: true,
        airportOrigin: true,
        airportDestination: true,
        carrierName: true,
        vesselOrFlight: true,
        bookingRef: true,
        houseRef: true,
        masterRef: true,
        etd: true,
        eta: true,
        atd: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        shipmentCosts: {
          select: {
            amount: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            dueDate: true,
            status: true,
          },
        },
        milestones: {
          select: {
            code: true,
            status: true,
            actualAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 700,
    }),
    prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        updatedAt: true,
        customer: { select: { legalName: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        updatedAt: true,
        customer: { select: { legalName: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    listOpenAlertsForCompany(companyId, 30),
  ]);

  const criticalMissingDocuments: AlertRow[] = [];
  const criticalDelayedShipments: AlertRow[] = [];
  const criticalStuckStatuses: AlertRow[] = [];
  const criticalMissingMilestones: AlertRow[] = [];

  const operationalRisks: Record<Severity, AlertRow[]> = {
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  const financeNoInvoice: FinancialRiskRow[] = [];
  const financeLowOrNegativeMargin: FinancialRiskRow[] = [];
  const financeCostWithoutRevenue: FinancialRiskRow[] = [];
  const financeOverdueInvoices: FinancialRiskRow[] = [];

  const operationsTaskMap = new Map<string, GeneratedTask>();
  const financeTaskMap = new Map<string, GeneratedTask>();

  for (const shipment of shipments) {
    const customer = shipment.customer.legalName;
    const shipmentHref = `/shipments/${shipment.id}`;
    const isDelivered = DELIVERED_STATUSES.has(shipment.status) || Boolean(shipment.deliveredAt);
    const isCancelled = shipment.status === ShipmentStatus.CANCELLED;
    const ageInCurrentStatusDays = daysAgo(shipment.updatedAt, todayStart);
    const validInvoices = shipment.invoices.filter((invoice) => invoice.status !== InvoiceStatus.CANCELLED);
    const invoiceTotal = validInvoices.reduce((sum, invoice) => sum + asMoney(invoice.total), 0);
    const totalCosts = shipment.shipmentCosts.reduce((sum, row) => sum + asMoney(row.amount), 0);
    const actualMargin = invoiceTotal - totalCosts;
    const quotedMargin = shipment.quote ? asMoney(shipment.quote.marginAmount) : null;
    const quotedSell = shipment.quote ? asMoney(shipment.quote.totalSell) : null;

    const missingReferences = [
      !shipment.bookingRef ? "bookingRef" : null,
      !shipment.houseRef ? "houseRef" : null,
      !shipment.masterRef ? "masterRef" : null,
    ].filter((item): item is string => Boolean(item));

    if (missingReferences.length > 0 && !isCancelled) {
      criticalMissingDocuments.push(
        toAlertRow({
          id: `missing-docs-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: `Missing references: ${missingReferences.join(", ")}`,
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-missing-docs-${shipment.id}`,
        title: `Add missing booking documents for ${shipment.shipmentNumber}`,
        detail: `Complete ${missingReferences.join(", ")} for ${customer}.`,
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (shipment.eta && shipment.eta.getTime() < todayStart.getTime() && !isDelivered && !isCancelled) {
      const delayedDays = daysAgo(shipment.eta, todayStart);
      criticalDelayedShipments.push(
        toAlertRow({
          id: `delay-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: `ETA passed ${delayedDays} day(s) ago and shipment is not delivered.`,
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-delay-${shipment.id}`,
        title: `Update ETA for ${shipment.shipmentNumber}`,
        detail: `Shipment is delayed versus ETA; customer ${customer} needs updated arrival commitment.`,
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    const stuckThreshold = STUCK_THRESHOLDS_DAYS[shipment.status];
    if (stuckThreshold && ageInCurrentStatusDays > stuckThreshold && !isCancelled) {
      criticalStuckStatuses.push(
        toAlertRow({
          id: `stuck-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: `${shipment.status} for ${ageInCurrentStatusDays} day(s) (threshold ${stuckThreshold}).`,
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-stuck-${shipment.id}`,
        title: `Unblock status for ${shipment.shipmentNumber}`,
        detail: `${shipment.status} exceeded SLA by ${ageInCurrentStatusDays - stuckThreshold} day(s).`,
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    const hasDepartedMilestone = shipment.milestones.some(
      (milestone) =>
        milestone.code === "DEPARTED" &&
        (milestone.actualAt !== null || milestone.status === MilestoneStatus.COMPLETED),
    );
    if (shipment.status === ShipmentStatus.IN_TRANSIT && !shipment.atd && !hasDepartedMilestone) {
      criticalMissingMilestones.push(
        toAlertRow({
          id: `missing-milestone-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: "IN_TRANSIT without ATD / DEPARTED milestone confirmation.",
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-atd-${shipment.id}`,
        title: `Confirm departure milestone for ${shipment.shipmentNumber}`,
        detail: "Shipment is in transit but ATD is missing.",
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (!ACTIVE_OPERATIONAL_STATUSES.has(shipment.status) || isCancelled) {
      continue;
    }

    if (!shipment.carrierName) {
      operationalRisks.HIGH.push(
        toAlertRow({
          id: `op-missing-carrier-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: "Carrier missing on active shipment.",
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-carrier-${shipment.id}`,
        title: `Assign carrier for ${shipment.shipmentNumber}`,
        detail: "Carrier is required to execute movement and vendor coordination.",
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (!shipment.vesselOrFlight && shipment.status !== ShipmentStatus.BOOKING_REQUESTED) {
      operationalRisks.HIGH.push(
        toAlertRow({
          id: `op-missing-voyage-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: "Vessel/flight missing after booking stage.",
        }),
      );
    }

    if (!shipment.etd || !shipment.eta) {
      operationalRisks.MEDIUM.push(
        toAlertRow({
          id: `op-missing-schedule-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: "ETD/ETA incomplete for operational planning.",
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-schedule-${shipment.id}`,
        title: `Update ETD/ETA for ${shipment.shipmentNumber}`,
        detail: "Schedule data is incomplete and blocks planning/communication.",
        severity: "MEDIUM",
        ctaHref: shipmentHref,
      });
    }

    const missingRouteCore = !shipment.originCode || !shipment.destinationCode;
    const incompleteRouteByMode =
      shipment.mode === "AIR"
        ? !shipment.airportOrigin || !shipment.airportDestination
        : shipment.mode === "OCEAN"
          ? !shipment.pol || !shipment.pod
          : false;
    if (missingRouteCore || incompleteRouteByMode) {
      operationalRisks.MEDIUM.push(
        toAlertRow({
          id: `op-routing-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: "Origin/destination or routing details are incomplete.",
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-routing-${shipment.id}`,
        title: `Complete routing for ${shipment.shipmentNumber}`,
        detail: "Origin/destination and routing references must be complete.",
        severity: "MEDIUM",
        ctaHref: shipmentHref,
      });
    }

    if (shipment.status === ShipmentStatus.CUSTOMS && ageInCurrentStatusDays > 4) {
      operationalRisks.HIGH.push(
        toAlertRow({
          id: `op-customs-aging-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: `Customs stage open for ${ageInCurrentStatusDays} day(s).`,
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-customs-${shipment.id}`,
        title: `Escalate customs case ${shipment.shipmentNumber}`,
        detail: "Shipment has prolonged customs exposure.",
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (shipment.status === ShipmentStatus.DELIVERED && ageInCurrentStatusDays > 2) {
      operationalRisks.LOW.push(
        toAlertRow({
          id: `op-close-${shipment.id}`,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customer,
          issue: `Delivered file still open for ${ageInCurrentStatusDays} day(s).`,
        }),
      );
      addTask(operationsTaskMap, {
        key: `op-close-${shipment.id}`,
        title: `Close shipment ${shipment.shipmentNumber}`,
        detail: "Delivery is completed but file remains open.",
        severity: "LOW",
        ctaHref: shipmentHref,
      });
    }

    if (CRITICAL_STATUS_ORDER.has(shipment.status) && validInvoices.length === 0) {
      const impact = quotedSell && quotedSell > 0 ? quotedSell : totalCosts;
      financeNoInvoice.push({
        id: `fin-no-invoice-${shipment.id}`,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        customer,
        issue: "Shipment progressed operationally but has no invoice.",
        amountImpact: impact,
        ctaHref: shipmentHref,
        ctaLabel: "Open shipment",
      });
      addTask(financeTaskMap, {
        key: `fin-create-invoice-${shipment.id}`,
        title: `Create invoice for ${shipment.shipmentNumber}`,
        detail: "Shipment reached execution stage without billing.",
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (totalCosts > 0 && invoiceTotal <= 0) {
      financeCostWithoutRevenue.push({
        id: `fin-cost-no-revenue-${shipment.id}`,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        customer,
        issue: "Costs are loaded but no revenue was booked.",
        amountImpact: totalCosts,
        ctaHref: shipmentHref,
        ctaLabel: "Open shipment",
      });
      addTask(financeTaskMap, {
        key: `fin-cost-confirm-${shipment.id}`,
        title: `Confirm cost + revenue for ${shipment.shipmentNumber}`,
        detail: "Shipment has supplier costs without matching commercial invoice.",
        severity: "HIGH",
        ctaHref: shipmentHref,
      });
    }

    if (shipment.shipmentCosts.length === 0 && CRITICAL_STATUS_ORDER.has(shipment.status)) {
      addTask(financeTaskMap, {
        key: `fin-add-cost-${shipment.id}`,
        title: `Confirm cost from supplier for ${shipment.shipmentNumber}`,
        detail: "No shipment costs are loaded for an executed file.",
        severity: "MEDIUM",
        ctaHref: shipmentHref,
      });
    }

    if (invoiceTotal > 0 && (actualMargin < 0 || (quotedMargin !== null && actualMargin < quotedMargin))) {
      const impact =
        quotedMargin !== null
          ? Math.max(quotedMargin - actualMargin, 0)
          : Math.abs(Math.min(actualMargin, 0));
      financeLowOrNegativeMargin.push({
        id: `fin-margin-${shipment.id}`,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        customer,
        issue:
          actualMargin < 0
            ? "Negative gross profit detected."
            : `Actual margin below quoted baseline (${quotedMargin?.toFixed(2)}).`,
        amountImpact: impact,
        ctaHref: shipmentHref,
        ctaLabel: "Open shipment",
      });
      addTask(financeTaskMap, {
        key: `fin-margin-${shipment.id}`,
        title: `Review margin leakage on ${shipment.shipmentNumber}`,
        detail: "Actual profitability is below target; validate buy rates and sell recovery.",
        severity: actualMargin < 0 ? "HIGH" : "MEDIUM",
        ctaHref: shipmentHref,
      });
    }

    for (const invoice of validInvoices) {
      if (!invoice.dueDate) continue;
      if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) continue;
      if (invoice.dueDate.getTime() >= todayStart.getTime()) continue;

      financeOverdueInvoices.push({
        id: `fin-overdue-${invoice.id}`,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        customer,
        issue: `Invoice ${invoice.invoiceNumber} is overdue.`,
        amountImpact: asMoney(invoice.total),
        ctaHref: `/finance/invoices/${invoice.id}`,
        ctaLabel: "Open invoice",
      });
      addTask(financeTaskMap, {
        key: `fin-overdue-${invoice.id}`,
        title: `Follow up overdue invoice ${invoice.invoiceNumber}`,
        detail: `Past due for ${customer} on ${shipment.shipmentNumber}.`,
        severity: "HIGH",
        ctaHref: `/finance/invoices/${invoice.id}`,
      });
    }
  }

  const sortBySeverity = (tasks: Iterable<GeneratedTask>) => {
    const ranking: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return Array.from(tasks)
      .sort((a, b) => ranking[a.severity] - ranking[b.severity] || a.title.localeCompare(b.title))
      .slice(0, 18);
  };

  return {
    alerts,
    criticalAlerts: {
      missingDocuments: criticalMissingDocuments.slice(0, 20),
      delayedShipments: criticalDelayedShipments.slice(0, 20),
      stuckStatuses: criticalStuckStatuses.slice(0, 20),
      missingMilestones: criticalMissingMilestones.slice(0, 20),
    },
    operationalRisks: {
      HIGH: operationalRisks.HIGH.slice(0, 24),
      MEDIUM: operationalRisks.MEDIUM.slice(0, 24),
      LOW: operationalRisks.LOW.slice(0, 24),
    },
    financialRisks: {
      noInvoice: financeNoInvoice.slice(0, 24),
      lowOrNegativeMargin: financeLowOrNegativeMargin.slice(0, 24),
      costWithoutRevenue: financeCostWithoutRevenue.slice(0, 24),
      overdueInvoices: financeOverdueInvoices.slice(0, 24),
    },
    tasks: {
      operations: sortBySeverity(operationsTaskMap.values()),
      finance: sortBySeverity(financeTaskMap.values()),
    },
    quickActions: {
      recentShipments: recentShipments.map((shipment) => ({
        id: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        customer: shipment.customer.legalName,
        status: shipment.status,
        updatedAt: shipment.updatedAt,
      })),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer.legalName,
        status: invoice.status,
        total: asMoney(invoice.total),
        updatedAt: invoice.updatedAt,
      })),
    },
  };
}
