import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  InvoiceStatus,
  ShipmentStatus,
  type Alert,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAlertCreated } from "@/lib/notifications";
import { deriveShipmentState } from "@/lib/shipment-state";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MANAGED_ALERT_TYPES = [
  AlertType.MISSING_INVOICE,
  AlertType.NEGATIVE_MARGIN,
  AlertType.ETA_DELAY,
  AlertType.MISSING_DOC,
] as const;

const INVOICE_EXCLUDED_STATUSES = new Set<InvoiceStatus>([InvoiceStatus.CANCELLED]);

type AlertCandidate = {
  type: AlertType;
  severity: AlertSeverity;
  shipmentId: string;
  message: string;
};

type ShipmentSnapshot = {
  id: string;
  companyId: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  customerName: string;
  eta: Date | null;
  atd: Date | null;
  deliveredAt: Date | null;
  houseRef: string | null;
  masterRef: string | null;
  documents: Array<{ docType: string }>;
  shipmentCosts: Array<{ amount: unknown }>;
  invoices: Array<{ status: InvoiceStatus; createdAt: Date; total: unknown }>;
};

export type AlertFeedRow = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  createdAt: Date;
  shipmentId: string | null;
  shipmentNumber: string | null;
  customerName: string | null;
  ctaHref: string;
};

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function getCandidateKey(shipmentId: string, type: AlertType) {
  return `${shipmentId}:${type}`;
}

async function getShipmentSnapshots(where: { companyId?: string; shipmentIds?: string[] }) {
  return prisma.shipment
    .findMany({
      where: {
        ...(where.companyId ? { companyId: where.companyId } : {}),
        ...(where.shipmentIds ? { id: { in: where.shipmentIds } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        shipmentNumber: true,
        status: true,
        eta: true,
        atd: true,
        deliveredAt: true,
        houseRef: true,
        masterRef: true,
        customer: { select: { legalName: true } },
        documents: {
          select: {
            docType: true,
          },
        },
        shipmentCosts: { select: { amount: true } },
        invoices: {
          select: {
            status: true,
            createdAt: true,
            total: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    })
    .then((rows) =>
      rows.map(
        (row): ShipmentSnapshot => ({
          id: row.id,
          companyId: row.companyId,
          shipmentNumber: row.shipmentNumber,
          status: row.status,
          customerName: row.customer.legalName,
          eta: row.eta,
          atd: row.atd,
          deliveredAt: row.deliveredAt,
          houseRef: row.houseRef,
          masterRef: row.masterRef,
          documents: row.documents,
          shipmentCosts: row.shipmentCosts,
          invoices: row.invoices,
        }),
      ),
    );
}

function deriveCandidates(now: Date, shipment: ShipmentSnapshot): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const openInvoices = shipment.invoices.filter((invoice) => !INVOICE_EXCLUDED_STATUSES.has(invoice.status));
  const derivedState = deriveShipmentState(
    {
      status: shipment.status,
      atd: shipment.atd,
      deliveredAt: shipment.deliveredAt,
    },
    [],
  );

  if (shipment.atd) {
    const hasInvoiceAfterAtd = openInvoices.some(
      (invoice) => invoice.createdAt.getTime() >= shipment.atd!.getTime(),
    );
    const elapsed = now.getTime() - shipment.atd.getTime();
    if (!hasInvoiceAfterAtd && elapsed >= TWO_DAYS_MS) {
      candidates.push({
        type: AlertType.MISSING_INVOICE,
        severity: AlertSeverity.HIGH,
        shipmentId: shipment.id,
        message: `Missing invoice: ${shipment.shipmentNumber} has ATD older than 48h with no invoice.`,
      });
    }
  }

  const invoicedTotal = openInvoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
  const costsTotal = shipment.shipmentCosts.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const actualMargin = invoicedTotal - costsTotal;
  if (actualMargin < 0) {
    candidates.push({
      type: AlertType.NEGATIVE_MARGIN,
      severity: AlertSeverity.HIGH,
      shipmentId: shipment.id,
      message: `Negative margin: ${shipment.shipmentNumber} margin is ${actualMargin.toFixed(2)}.`,
    });
  }

  if (
    shipment.eta &&
    shipment.eta.getTime() < dayStart(now).getTime() &&
    derivedState.masterStatus !== ShipmentStatus.DELIVERED &&
    derivedState.masterStatus !== ShipmentStatus.CLOSED &&
    derivedState.masterStatus !== ShipmentStatus.CANCELLED &&
    !shipment.deliveredAt
  ) {
    candidates.push({
      type: AlertType.ETA_DELAY,
      severity: AlertSeverity.MEDIUM,
      shipmentId: shipment.id,
      message: `ETA delay: ${shipment.shipmentNumber} ETA has passed and shipment is not delivered.`,
    });
  }

  const hasBlOrAwb = shipment.documents.some((doc) => doc.docType === "BL" || doc.docType === "AWB");
  const hasCommercialInvoice = shipment.documents.some((doc) => doc.docType === "COMMERCIAL_INVOICE");

  if (!hasBlOrAwb || !hasCommercialInvoice) {
    const missingFields = [
      !hasBlOrAwb ? "BL/AWB" : null,
      !hasCommercialInvoice ? "commercial invoice" : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(" and ");
    candidates.push({
      type: AlertType.MISSING_DOC,
      severity: AlertSeverity.MEDIUM,
      shipmentId: shipment.id,
      message: `Missing critical docs: ${shipment.shipmentNumber} missing ${missingFields}.`,
    });
  }

  return candidates;
}

async function syncAlertsForSnapshots(input: {
  snapshots: ShipmentSnapshot[];
  now: Date;
}) {
  if (input.snapshots.length === 0) return { created: 0, reopened: 0, resolved: 0 };

  const companyId = input.snapshots[0].companyId;
  const shipmentIds = input.snapshots.map((shipment) => shipment.id);
  const existingAlerts = await prisma.alert.findMany({
    where: {
      companyId,
      shipmentId: { in: shipmentIds },
      type: { in: [...MANAGED_ALERT_TYPES] },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const snapshotById = new Map(input.snapshots.map((row) => [row.id, row]));
  const latestByKey = new Map<string, Alert>();
  const duplicateOpenIds: string[] = [];

  for (const existing of existingAlerts) {
    const key = getCandidateKey(existing.shipmentId ?? "", existing.type);
    if (!latestByKey.has(key)) {
      latestByKey.set(key, existing);
      continue;
    }
    if (existing.status === AlertStatus.OPEN) {
      duplicateOpenIds.push(existing.id);
    }
  }

  if (duplicateOpenIds.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: duplicateOpenIds } },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: input.now,
      },
    });
  }

  const activeKeys = new Set<string>();
  let created = 0;
  let reopened = 0;
  let resolved = 0;

  for (const snapshot of input.snapshots) {
    const candidates = deriveCandidates(input.now, snapshot);
    for (const candidate of candidates) {
      const key = getCandidateKey(candidate.shipmentId, candidate.type);
      activeKeys.add(key);
      const existing = latestByKey.get(key);

      if (!existing) {
        const alert = await prisma.alert.create({
          data: {
            companyId: snapshot.companyId,
            type: candidate.type,
            severity: candidate.severity,
            shipmentId: candidate.shipmentId,
            message: candidate.message,
            status: AlertStatus.OPEN,
          },
        });
        await notifyAlertCreated({
          companyId,
          alert,
          shipmentNumber: snapshot.shipmentNumber,
        });
        created += 1;
        continue;
      }

      const shouldReopen = existing.status === AlertStatus.RESOLVED;
      const shouldUpdateMessageOrSeverity =
        existing.message !== candidate.message || existing.severity !== candidate.severity;

      if (!shouldReopen && !shouldUpdateMessageOrSeverity) continue;

      const updated = await prisma.alert.update({
        where: { id: existing.id },
        data: {
          message: candidate.message,
          severity: candidate.severity,
          status: AlertStatus.OPEN,
          resolvedAt: null,
        },
      });

      if (shouldReopen) {
        await notifyAlertCreated({
          companyId,
          alert: updated,
          shipmentNumber: snapshot.shipmentNumber,
        });
        reopened += 1;
      }
    }
  }

  for (const existing of existingAlerts) {
    if (existing.status !== AlertStatus.OPEN) continue;
    const key = getCandidateKey(existing.shipmentId ?? "", existing.type);
    if (activeKeys.has(key)) continue;
    if (!snapshotById.has(existing.shipmentId ?? "")) continue;
    await prisma.alert.update({
      where: { id: existing.id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: input.now,
      },
    });
    resolved += 1;
  }

  return { created, reopened, resolved };
}

export async function runAlertChecksForShipmentUpdate(input: { companyId: string; shipmentId: string }) {
  const snapshots = await getShipmentSnapshots({ companyId: input.companyId, shipmentIds: [input.shipmentId] });
  if (snapshots.length === 0) return { created: 0, reopened: 0, resolved: 0 };
  return syncAlertsForSnapshots({
    snapshots,
    now: new Date(),
  });
}

export async function runAlertChecksForInvoiceMutation(input: { companyId: string; shipmentId: string }) {
  const snapshots = await getShipmentSnapshots({ companyId: input.companyId, shipmentIds: [input.shipmentId] });
  if (snapshots.length === 0) return { created: 0, reopened: 0, resolved: 0 };
  return syncAlertsForSnapshots({
    snapshots,
    now: new Date(),
  });
}

export async function runScheduledAlertChecksForCompany(companyId: string) {
  const snapshots = await getShipmentSnapshots({ companyId });
  return syncAlertsForSnapshots({
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

  for (const company of companies) {
    const result = await runScheduledAlertChecksForCompany(company.id);
    created += result.created;
    reopened += result.reopened;
    resolved += result.resolved;
  }

  return { companies: companies.length, created, reopened, resolved };
}

export async function listOpenAlertsForCompany(companyId: string, limit = 40): Promise<AlertFeedRow[]> {
  const rows = await prisma.alert.findMany({
    where: {
      companyId,
      status: AlertStatus.OPEN,
    },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          customer: { select: { legalName: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
  });

  const severityRank: Record<AlertSeverity, number> = {
    [AlertSeverity.HIGH]: 0,
    [AlertSeverity.MEDIUM]: 1,
    [AlertSeverity.LOW]: 2,
  };

  return rows
    .sort((a, b) => {
      const severityDelta = severityRank[a.severity] - severityRank[b.severity];
      if (severityDelta !== 0) return severityDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      message: row.message,
      createdAt: row.createdAt,
      shipmentId: row.shipmentId,
      shipmentNumber: row.shipment?.shipmentNumber ?? null,
      customerName: row.shipment?.customer.legalName ?? null,
      ctaHref: row.shipmentId ? `/shipments/${row.shipmentId}` : "/dashboard/action-center",
    }));
}

export async function listOpenAlertsForUser(userId: string, limit = 20): Promise<AlertFeedRow[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, isActive: true },
  });
  if (!user?.isActive) return [];
  return listOpenAlertsForCompany(user.companyId, limit);
}

export async function resolveAlertForCompany(input: { companyId: string; alertId: string }) {
  const alert = await prisma.alert.findFirst({
    where: {
      id: input.alertId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }
  if (alert.status === AlertStatus.RESOLVED) return;

  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
    },
  });
}

