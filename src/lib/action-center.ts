import { AlertSeverity, AlertStatus, AlertType, InvoiceStatus, ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listAlertsForCompany, type AlertFeedRow } from "@/lib/alerts";

type Severity = AlertSeverity;

type AlertRow = {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  customer: string;
  issue: string;
  ctaHref: string;
  severity: Severity;
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

export type ActionCenterFilters = {
  severity?: AlertSeverity;
  type?: AlertType;
  status?: "ACTIVE" | AlertStatus;
  scope?: string;
  shipmentId?: string;
  customerId?: string;
};

export type ActionCenterData = {
  alerts: AlertFeedRow[];
  filters: ActionCenterFilters;
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
    overduePayables: FinancialRiskRow[];
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

function toAlertRow(alert: AlertFeedRow): AlertRow {
  return {
    id: alert.id,
    shipmentId: alert.shipmentId ?? "company",
    shipmentNumber: alert.shipmentNumber ?? "N/A",
    customer: alert.customerName ?? "N/A",
    issue: alert.description,
    ctaHref: alert.ctaHref,
    severity: alert.severity,
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

export async function getActionCenterData(
  companyId: string,
  filters: ActionCenterFilters = {},
): Promise<ActionCenterData> {
  const normalizedFilters: ActionCenterFilters = {
    ...filters,
    status: filters.status ?? "ACTIVE",
  };
  const [alerts, recentShipments, recentInvoices] = await Promise.all([
    listAlertsForCompany(
      { companyId },
      {
        severity: normalizedFilters.severity,
        type: normalizedFilters.type,
        status: normalizedFilters.status,
        scope: normalizedFilters.scope,
        shipmentId: normalizedFilters.shipmentId,
        customerId: normalizedFilters.customerId,
        limit: 160,
      },
    ),
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
  ]);

  const criticalAlerts = {
    missingDocuments: alerts.filter((alert) => alert.type === AlertType.MISSING_BL).map(toAlertRow),
    delayedShipments: alerts.filter((alert) => alert.type === AlertType.ETA_DELAY).map(toAlertRow),
    stuckStatuses: alerts
      .filter((alert) => alert.type === AlertType.SHIPMENT_STUCK_IN_STAGE)
      .map(toAlertRow),
    missingMilestones: alerts
      .filter(
        (alert) =>
          alert.type === AlertType.MISSING_CRITICAL_MILESTONE ||
          alert.type === AlertType.SHIPMENT_WITH_INCONSISTENT_STATE,
      )
      .map(toAlertRow),
  };

  const operationalTypes = new Set<AlertType>([
    AlertType.ETA_DELAY,
    AlertType.MISSING_BL,
    AlertType.CUSTOMS_DELAY,
    AlertType.SHIPMENT_STUCK_IN_STAGE,
    AlertType.MISSING_CRITICAL_MILESTONE,
    AlertType.SHIPMENT_WITH_INCONSISTENT_STATE,
  ]);
  const operationalRisks: Record<Severity, AlertRow[]> = {
    [AlertSeverity.CRITICAL]: [],
    [AlertSeverity.WARNING]: [],
    [AlertSeverity.INFO]: [],
  };

  for (const alert of alerts) {
    if (!operationalTypes.has(alert.type)) continue;
    operationalRisks[alert.severity].push(toAlertRow(alert));
  }

  const noInvoice = alerts.filter((alert) => alert.type === AlertType.MISSING_INVOICE_AFTER_DEPARTURE);
  const lowMargin = alerts.filter(
    (alert) => alert.type === AlertType.NEGATIVE_MARGIN || alert.type === AlertType.LOW_MARGIN_VS_QUOTE,
  );
  const costWithoutRevenue = alerts.filter((alert) => alert.type === AlertType.COST_WITHOUT_REVENUE);
  const overdueReceivable = alerts.filter((alert) => alert.type === AlertType.OVERDUE_RECEIVABLE);
  const overduePayable = alerts.filter((alert) => alert.type === AlertType.OVERDUE_PAYABLE);

  const toFinancialRow = (alert: AlertFeedRow): FinancialRiskRow => ({
    ...toAlertRow(alert),
    amountImpact: Number(alert.metadata?.amountImpact ?? alert.metadata?.overdueAmount ?? 0),
    ctaLabel: alert.shipmentId ? "Open shipment" : "Open action center",
  });

  const operationsTaskMap = new Map<string, GeneratedTask>();
  const financeTaskMap = new Map<string, GeneratedTask>();
  const financeTypes = new Set<AlertType>([
    AlertType.MISSING_INVOICE_AFTER_DEPARTURE,
    AlertType.NEGATIVE_MARGIN,
    AlertType.LOW_MARGIN_VS_QUOTE,
    AlertType.COST_WITHOUT_REVENUE,
    AlertType.OVERDUE_RECEIVABLE,
    AlertType.OVERDUE_PAYABLE,
  ]);

  for (const alert of alerts) {
    if (!alert.recommendedAction) continue;
    if (financeTypes.has(alert.type)) {
      addTask(financeTaskMap, {
        key: `fin-${alert.ruleKey}`,
        title: alert.recommendedAction,
        detail: `${alert.shipmentNumber ?? "Shipment"} · ${alert.title}`,
        severity: alert.severity,
        ctaHref: alert.ctaHref,
      });
      continue;
    }
    addTask(operationsTaskMap, {
      key: `op-${alert.ruleKey}`,
      title: alert.recommendedAction,
      detail: `${alert.shipmentNumber ?? "Shipment"} · ${alert.title}`,
      severity: alert.severity,
      ctaHref: alert.ctaHref,
    });
  }

  const sortBySeverity = (tasks: Iterable<GeneratedTask>) => {
    const ranking: Record<Severity, number> = {
      [AlertSeverity.CRITICAL]: 0,
      [AlertSeverity.WARNING]: 1,
      [AlertSeverity.INFO]: 2,
    };
    return Array.from(tasks)
      .sort((a, b) => ranking[a.severity] - ranking[b.severity] || a.title.localeCompare(b.title))
      .slice(0, 18);
  };

  return {
    alerts,
    filters: normalizedFilters,
    criticalAlerts: {
      missingDocuments: criticalAlerts.missingDocuments.slice(0, 20),
      delayedShipments: criticalAlerts.delayedShipments.slice(0, 20),
      stuckStatuses: criticalAlerts.stuckStatuses.slice(0, 20),
      missingMilestones: criticalAlerts.missingMilestones.slice(0, 20),
    },
    operationalRisks: {
      [AlertSeverity.CRITICAL]: operationalRisks[AlertSeverity.CRITICAL].slice(0, 24),
      [AlertSeverity.WARNING]: operationalRisks[AlertSeverity.WARNING].slice(0, 24),
      [AlertSeverity.INFO]: operationalRisks[AlertSeverity.INFO].slice(0, 24),
    },
    financialRisks: {
      noInvoice: noInvoice.map(toFinancialRow).slice(0, 24),
      lowOrNegativeMargin: lowMargin.map(toFinancialRow).slice(0, 24),
      costWithoutRevenue: costWithoutRevenue.map(toFinancialRow).slice(0, 24),
      overdueInvoices: overdueReceivable.map(toFinancialRow).slice(0, 24),
      overduePayables: overduePayable.map(toFinancialRow).slice(0, 24),
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
