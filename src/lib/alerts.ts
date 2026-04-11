import { AlertSeverity, AlertStatus, AlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateCompanyAlerts, type ShipmentAlertSnapshot } from "@/lib/action-center/rules-engine";
import type { Prisma } from "@prisma/client";

type AlertSyncResult = {
  created: number;
  reopened: number;
  resolved: number;
  updated: number;
};

export type AlertFeedRow = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  ruleKey: string;
  title: string;
  description: string;
  recommendedAction: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  shipmentId: string | null;
  shipmentNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  ctaHref: string;
};

export type AlertListFilters = {
  severity?: AlertSeverity;
  type?: AlertType;
  status?: "ACTIVE" | AlertStatus;
  scope?: string;
  shipmentId?: string;
  customerId?: string;
  limit?: number;
};

async function getShipmentAlertSnapshots(where: { companyId: string; shipmentIds?: string[] }) {
  const rows = await prisma.shipment.findMany({
    where: {
      companyId: where.companyId,
      ...(where.shipmentIds ? { id: { in: where.shipmentIds } } : {}),
    },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      shipmentNumber: true,
      status: true,
      mode: true,
      eta: true,
      etd: true,
      atd: true,
      ata: true,
      deliveredAt: true,
      bookingRef: true,
      houseRef: true,
      masterRef: true,
      updatedAt: true,
      customer: {
        select: { legalName: true },
      },
      quote: {
        select: {
          marginAmount: true,
          totalSell: true,
        },
      },
      milestones: {
        select: {
          code: true,
          status: true,
          expectedAt: true,
          actualAt: true,
        },
      },
      documents: {
        select: { docType: true },
      },
      invoices: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          dueDate: true,
          total: true,
        },
      },
      shipmentCosts: {
        select: {
          amount: true,
          dueDate: true,
          status: true,
        },
      },
      expenses: {
        select: {
          amountBase: true,
          dueDate: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return rows.map(
    (row): ShipmentAlertSnapshot => ({
      id: row.id,
      companyId: row.companyId,
      customerId: row.customerId,
      customerName: row.customer.legalName,
      shipmentNumber: row.shipmentNumber,
      status: row.status,
      mode: row.mode,
      eta: row.eta,
      etd: row.etd,
      atd: row.atd,
      ata: row.ata,
      deliveredAt: row.deliveredAt,
      bookingRef: row.bookingRef,
      houseRef: row.houseRef,
      masterRef: row.masterRef,
      updatedAt: row.updatedAt,
      quote: row.quote,
      milestones: row.milestones,
      documents: row.documents,
      invoices: row.invoices,
      shipmentCosts: row.shipmentCosts,
      expenses: row.expenses,
    }),
  );
}

async function syncAlertsForSnapshots(input: {
  companyId: string;
  snapshots: ShipmentAlertSnapshot[];
  now: Date;
}): Promise<AlertSyncResult> {
  if (input.snapshots.length === 0) {
    return { created: 0, reopened: 0, resolved: 0, updated: 0 };
  }

  const shipmentIds = input.snapshots.map((shipment) => shipment.id);
  const candidateAlerts = evaluateCompanyAlerts({
    shipments: input.snapshots,
    now: input.now,
  });
  const candidateByRuleKey = new Map(candidateAlerts.map((item) => [item.ruleKey, item]));
  const existing = await prisma.alert.findMany({
    where: {
      companyId: input.companyId,
      shipmentId: { in: shipmentIds },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const existingByRuleKey = new Map(existing.map((alert) => [alert.ruleKey, alert]));

  let created = 0;
  let reopened = 0;
  let resolved = 0;
  let updated = 0;

  for (const candidate of candidateAlerts) {
    const existingAlert = existingByRuleKey.get(candidate.ruleKey);
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          companyId: input.companyId,
          type: candidate.type,
          severity: candidate.severity,
          status: AlertStatus.OPEN,
          ruleKey: candidate.ruleKey,
          source: candidate.source,
          title: candidate.title,
          description: candidate.description,
          recommendedAction: candidate.recommendedAction ?? null,
          shipmentId: candidate.shipmentId,
          customerId: candidate.customerId,
          metadata: candidate.metadata as Prisma.InputJsonValue,
        },
      });
      created += 1;
      continue;
    }

    const shouldReopen = existingAlert.status === AlertStatus.RESOLVED;
    const hasContentChanges =
      existingAlert.type !== candidate.type ||
      existingAlert.severity !== candidate.severity ||
      existingAlert.title !== candidate.title ||
      existingAlert.description !== candidate.description ||
      existingAlert.recommendedAction !== (candidate.recommendedAction ?? null);

    if (!shouldReopen && !hasContentChanges) continue;

    await prisma.alert.update({
      where: { id: existingAlert.id },
      data: {
        type: candidate.type,
        severity: candidate.severity,
        status: shouldReopen ? AlertStatus.REOPENED : existingAlert.status,
        title: candidate.title,
        description: candidate.description,
        recommendedAction: candidate.recommendedAction ?? null,
        source: candidate.source,
        shipmentId: candidate.shipmentId ?? null,
        customerId: candidate.customerId ?? null,
        metadata: candidate.metadata as Prisma.InputJsonValue,
        resolvedAt: shouldReopen ? null : existingAlert.resolvedAt,
      },
    });
    if (shouldReopen) {
      reopened += 1;
    } else {
      updated += 1;
    }
  }

  for (const alert of existing) {
    if (alert.status === AlertStatus.RESOLVED) continue;
    if (candidateByRuleKey.has(alert.ruleKey)) continue;
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: input.now,
      },
    });
    resolved += 1;
  }

  return { created, reopened, resolved, updated };
}

export async function runAlertChecksForShipmentUpdate(input: { companyId: string; shipmentId: string }) {
  const snapshots = await getShipmentAlertSnapshots({
    companyId: input.companyId,
    shipmentIds: [input.shipmentId],
  });
  return syncAlertsForSnapshots({
    companyId: input.companyId,
    snapshots,
    now: new Date(),
  });
}

export async function runAlertChecksForInvoiceMutation(input: { companyId: string; shipmentId: string }) {
  const snapshots = await getShipmentAlertSnapshots({
    companyId: input.companyId,
    shipmentIds: [input.shipmentId],
  });
  return syncAlertsForSnapshots({
    companyId: input.companyId,
    snapshots,
    now: new Date(),
  });
}

export async function runScheduledAlertChecksForCompany(companyId: string) {
  const snapshots = await getShipmentAlertSnapshots({ companyId });
  return syncAlertsForSnapshots({
    companyId,
    snapshots,
    now: new Date(),
  });
}

export async function runScheduledAlertChecksForAllCompanies() {
  const companies = await prisma.company.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let reopened = 0;
  let resolved = 0;
  let updated = 0;
  for (const company of companies) {
    const result = await runScheduledAlertChecksForCompany(company.id);
    created += result.created;
    reopened += result.reopened;
    resolved += result.resolved;
    updated += result.updated;
  }
  return { companies: companies.length, created, reopened, resolved, updated };
}

export async function listAlertsForCompany(
  scope: { companyId: string },
  filters: AlertListFilters = {},
): Promise<AlertFeedRow[]> {
  const query = filters.scope?.trim();
  const rows = await prisma.alert.findMany({
    where: {
      companyId: scope.companyId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.status
        ? filters.status === "ACTIVE"
          ? { status: { in: [AlertStatus.OPEN, AlertStatus.REOPENED] } }
          : { status: filters.status }
        : {}),
      ...(filters.shipmentId ? { shipmentId: filters.shipmentId } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
              { shipment: { shipmentNumber: { contains: query } } },
              { customer: { legalName: { contains: query } } },
            ],
          }
        : {}),
    },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
        },
      },
      customer: {
        select: {
          id: true,
          legalName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(filters.limit ?? 80, 250)),
  });

  const severityRank: Record<AlertSeverity, number> = {
    [AlertSeverity.CRITICAL]: 0,
    [AlertSeverity.WARNING]: 1,
    [AlertSeverity.INFO]: 2,
  };

  return rows
    .sort((a, b) => {
      const severityDelta = severityRank[a.severity] - severityRank[b.severity];
      if (severityDelta !== 0) return severityDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      source: alert.source,
      ruleKey: alert.ruleKey,
      title: alert.title,
      description: alert.description,
      recommendedAction: alert.recommendedAction ?? null,
      metadata: (alert.metadata as Record<string, unknown> | null) ?? null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      resolvedAt: alert.resolvedAt,
      shipmentId: alert.shipmentId,
      shipmentNumber: alert.shipment?.shipmentNumber ?? null,
      customerId: alert.customerId,
      customerName: alert.customer?.legalName ?? null,
      ctaHref: alert.shipmentId ? `/shipments/${alert.shipmentId}` : "/dashboard/action-center",
    }));
}

export async function resolveAlertForCompany(input: { companyId: string; alertId: string }) {
  const alert = await prisma.alert.findFirst({
    where: {
      id: input.alertId,
      companyId: input.companyId,
    },
    select: { id: true, status: true },
  });
  if (!alert) {
    throw new Error("Alert not found");
  }
  if (alert.status === AlertStatus.RESOLVED) {
    return;
  }

  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
    },
  });
}

// Compatibility wrapper for existing consumers.
export async function listOpenAlertsForCompany(companyId: string, limit = 40): Promise<AlertFeedRow[]> {
  return listAlertsForCompany(
    { companyId },
    {
      status: "ACTIVE",
      limit,
    },
  );
}
