import { ShipmentStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { getActionCenterData } from "@/lib/action-center";
import { authOptions } from "@/lib/auth";
import { listInvoicesForAr } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { getShipmentById, listShipments } from "@/lib/shipments";

export type PortalSession = {
  userId: string;
  companyId: string;
  customerIds: string[];
  primaryCustomerId: string;
  userName: string;
  companyName: string;
};

export type PortalShipmentRow = {
  id: string;
  shipmentNumber: string;
  mode: string;
  status: ShipmentStatus;
  origin: string | null;
  destination: string | null;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
  routeSummary: string;
  latestMilestoneLabel: string | null;
  progressPercent: number;
  hasClientAlert: boolean;
};

export type PortalInvoiceRow = {
  id: string;
  invoiceNumber: string;
  shipmentId: string;
  shipmentNumber: string;
  customerName: string;
  currencyCode: string;
  subtotal: number;
  taxes: number;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  issueDate: Date | null;
  dueDate: Date | null;
  status: string;
};

export type PortalDocumentRow = {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  docType: string;
  fileName: string;
  referenceNumber: string | null;
  issueDate: Date | null;
  uploadedAt: Date;
  status: string;
};

export type PortalTimelineRow = {
  id: string;
  timestamp: Date;
  shipmentId: string;
  shipmentNumber: string;
  title: string;
  description: string;
  actorName: string | null;
};

export type PortalAlertRow = {
  id: string;
  shipmentId: string;
  shipmentNumber: string;
  title: string;
  issue: string;
};

export type PortalDashboardData = {
  activeShipments: number;
  inTransit: number;
  inCustoms: number;
  delivered: number;
  openAlerts: number;
  outstandingInvoices: number;
  recentDocuments: PortalDocumentRow[];
  recentActivity: PortalTimelineRow[];
};

export async function getRequiredPortalSession(): Promise<PortalSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    redirect("/login?callbackUrl=/portal");
  }
  if (!session.user.isPortalUser) {
    redirect("/dashboard");
  }

  const customerIds =
    session.user.portalCustomerIds?.filter((value): value is string => Boolean(value)) ?? [];
  if (customerIds.length === 0) {
    redirect("/login?callbackUrl=/portal");
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    customerIds,
    primaryCustomerId: customerIds[0],
    userName: session.user.name ?? "Portal user",
    companyName: session.user.companyName ?? "Customer",
  };
}

function computeProgressPercent(status: ShipmentStatus) {
  const map: Record<ShipmentStatus, number> = {
    DRAFT: 5,
    BOOKING_REQUESTED: 15,
    BOOKING_CONFIRMED: 25,
    IN_TRANSIT: 55,
    ARRIVED: 70,
    CUSTOMS: 82,
    DELIVERED: 100,
    CLOSED: 100,
    CANCELLED: 0,
  };
  return map[status] ?? 0;
}

function statusLabel(status: ShipmentStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clientVisibleAlertTitle(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("delayed") || lower.includes("eta")) return raw;
  if (lower.includes("overdue")) return raw;
  if (lower.includes("missing")) return raw;
  if (lower.includes("customs")) return raw;
  if (lower.includes("delivered")) return raw;
  return null;
}

function clientSafeTimelineFromShipment(shipment: Awaited<ReturnType<typeof getShipmentById>>) {
  if (!shipment) return [] as PortalTimelineRow[];

  const milestoneRows: PortalTimelineRow[] = shipment.milestones
    .filter((row) => row.actualAt || row.expectedAt)
    .map((row) => {
      const when = row.actualAt ?? row.expectedAt ?? shipment.updatedAt;
      return {
        id: `ms-${row.id}`,
        timestamp: when,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        title: row.label,
        description: row.actualAt ? "Milestone completed" : "Milestone scheduled",
        actorName: null,
      };
    });

  const documentRows: PortalTimelineRow[] = shipment.documents
    .filter((row) => row.isClientVisible)
    .map((row) => ({
      id: `doc-${row.id}`,
      timestamp: row.uploadedAt,
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      title: "Document uploaded",
      description: `${row.docType} · ${row.fileName}`,
      actorName: null,
    }));

  const invoiceRows: PortalTimelineRow[] = shipment.invoices
    .map((row) => ({
      id: `inv-${row.id}`,
      timestamp: row.updatedAt,
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      title: row.status === "PAID" ? "Invoice paid" : "Invoice updated",
      description: `${row.invoiceNumber} · ${row.status}`,
      actorName: null,
    }));

  return [...milestoneRows, ...documentRows, ...invoiceRows].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}

export async function listPortalShipments(session: PortalSession) {
  const allRows = await listShipments(session.companyId);
  const scopedRows = allRows.filter((row) => session.customerIds.includes(row.customerId));

  const scopedShipmentIds = new Set(scopedRows.map((row) => row.id));
  const riskyShipmentIds = new Set<string>();
  const actionCenter = await getActionCenterData(session.companyId);
  for (const item of [
    ...actionCenter.criticalAlerts.delayedShipments,
    ...actionCenter.criticalAlerts.missingDocuments,
    ...actionCenter.criticalAlerts.stuckStatuses,
  ]) {
    if (scopedShipmentIds.has(item.shipmentId)) {
      riskyShipmentIds.add(item.shipmentId);
    }
  }

  return scopedRows.map<PortalShipmentRow>((row) => {
    const latestMilestone = statusLabel(row.status);
    const routeSummary = [row.originCode ?? "-", row.destinationCode ?? "-"].join(" -> ");
    return {
      id: row.id,
      shipmentNumber: row.shipmentNumber,
      mode: row.mode,
      status: row.status,
      origin: row.originCode,
      destination: row.destinationCode,
      etd: row.etd ?? null,
      eta: row.eta ?? null,
      atd: row.atd ?? null,
      ata: row.ata ?? null,
      deliveredAt: row.deliveredAt ?? null,
      routeSummary,
      latestMilestoneLabel: latestMilestone,
      progressPercent: computeProgressPercent(row.status),
      hasClientAlert: riskyShipmentIds.has(row.id),
    };
  });
}

export async function listPortalInvoices(session: PortalSession) {
  const allRows = await listInvoicesForAr(session.companyId);
  const scopedRows = allRows.filter((row) => session.customerIds.includes(row.customerId));

  const paymentsByInvoice = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: {
      companyId: session.companyId,
      invoiceId: { in: scopedRows.map((row) => row.id) },
    },
    _sum: { amount: true },
  });
  const paidById = new Map(paymentsByInvoice.map((row) => [row.invoiceId ?? "", Number(row._sum.amount ?? 0)]));

  return scopedRows.map<PortalInvoiceRow>((row) => {
    const paidAmount = paidById.get(row.id) ?? 0;
    const outstandingAmount = Math.max(row.total - paidAmount, 0);
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      shipmentId: row.shipmentId,
      shipmentNumber: row.shipmentNumber,
      customerName: row.customerName,
      currencyCode: row.currencyCode,
      subtotal: row.subtotal,
      taxes: row.taxes,
      total: row.total,
      paidAmount,
      outstandingAmount,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      status: row.status,
    };
  });
}

export async function listPortalDocuments(session: PortalSession) {
  const rows = await prisma.shipmentDocument.findMany({
    where: {
      shipment: {
        companyId: session.companyId,
        customerId: { in: session.customerIds },
      },
      isClientVisible: true,
    },
    include: {
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
        },
      },
    },
    orderBy: [{ uploadedAt: "desc" }],
  });

  return rows.map<PortalDocumentRow>((row) => ({
    id: row.id,
    shipmentId: row.shipmentId,
    shipmentNumber: row.shipment.shipmentNumber,
    docType: row.docType,
    fileName: row.fileName,
    referenceNumber: row.referenceNumber,
    issueDate: row.issueDate,
    uploadedAt: row.uploadedAt,
    status: row.status,
  }));
}

export async function listPortalAlerts(session: PortalSession) {
  const data = await getActionCenterData(session.companyId);
  const scopedShipmentIds = new Set(
    (await listShipments(session.companyId))
      .filter((row) => session.customerIds.includes(row.customerId))
      .map((row) => row.id),
  );

  const candidateAlerts = [
    ...data.criticalAlerts.delayedShipments,
    ...data.criticalAlerts.missingDocuments,
    ...data.criticalAlerts.stuckStatuses,
    ...data.financialRisks.overdueInvoices.map((row) => ({
      id: row.id,
      shipmentId: row.shipmentId,
      issue: row.issue,
      shipmentNumber: row.shipmentNumber,
      customer: row.customer,
      ctaHref: row.ctaHref,
    })),
  ];

  return candidateAlerts
    .filter((alert) => scopedShipmentIds.has(alert.shipmentId))
    .map((alert) => ({
      id: alert.id,
      shipmentId: alert.shipmentId,
      shipmentNumber: alert.shipmentNumber,
      title: clientVisibleAlertTitle(alert.issue),
      issue: alert.issue,
    }))
    .filter((alert): alert is PortalAlertRow => Boolean(alert.title));
}

export async function getPortalShipmentDetail(session: PortalSession, shipmentId: string) {
  const shipment = await getShipmentById(session.companyId, shipmentId);
  if (!shipment || !session.customerIds.includes(shipment.customerId)) {
    return null;
  }

  const invoices = await listPortalInvoices(session);
  const relatedInvoices = invoices.filter((row) => row.shipmentId === shipment.id);
  const relatedDocuments = shipment.documents.filter((row) => row.isClientVisible);
  const timeline = clientSafeTimelineFromShipment(shipment);
  const alerts = (await listPortalAlerts(session)).filter((row) => row.shipmentId === shipment.id);

  return {
    shipment,
    invoices: relatedInvoices,
    documents: relatedDocuments,
    timeline,
    alerts,
  };
}

export async function listPortalTracking(session: PortalSession) {
  const shipments = await listPortalShipments(session);
  const topShipmentIds = shipments.slice(0, 25).map((row) => row.id);
  const detailRows = await Promise.all(
    topShipmentIds.map(async (shipmentId) => getPortalShipmentDetail(session, shipmentId)),
  );

  return detailRows
    .flatMap((row) => row?.timeline ?? [])
    .filter((event) => {
      const lower = `${event.title} ${event.description}`.toLowerCase();
      return (
        lower.includes("book") ||
        lower.includes("depart") ||
        lower.includes("arriv") ||
        lower.includes("customs") ||
        lower.includes("deliver") ||
        lower.includes("document") ||
        lower.includes("invoice")
      );
    })
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
}

export async function getPortalDashboardData(session: PortalSession): Promise<PortalDashboardData> {
  const [shipments, alerts, invoices, documents, tracking] = await Promise.all([
    listPortalShipments(session),
    listPortalAlerts(session),
    listPortalInvoices(session),
    listPortalDocuments(session),
    listPortalTracking(session),
  ]);

  const openStatuses = new Set<ShipmentStatus>([
    ShipmentStatus.BOOKING_REQUESTED,
    ShipmentStatus.BOOKING_CONFIRMED,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.ARRIVED,
    ShipmentStatus.CUSTOMS,
  ]);
  const activeShipments = shipments.filter((row) => openStatuses.has(row.status)).length;
  const inTransit = shipments.filter((row) => row.status === ShipmentStatus.IN_TRANSIT).length;
  const inCustoms = shipments.filter((row) => row.status === ShipmentStatus.CUSTOMS).length;
  const delivered = shipments.filter(
    (row) => row.status === ShipmentStatus.DELIVERED || row.status === ShipmentStatus.CLOSED,
  ).length;
  const outstandingInvoices = invoices.filter((row) => row.outstandingAmount > 0).length;

  return {
    activeShipments,
    inTransit,
    inCustoms,
    delivered,
    openAlerts: alerts.length,
    outstandingInvoices,
    recentDocuments: documents.slice(0, 8),
    recentActivity: tracking.slice(0, 12),
  };
}

