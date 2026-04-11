import {
  ActivityAction,
  ActivityActorType,
  AlertStatus,
  EntityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ShipmentTimelineCategory =
  | "operations"
  | "finance"
  | "documents"
  | "alerts"
  | "system";

export type ShipmentTimelineEvent = {
  id: string;
  shipmentId: string;
  eventType: string;
  category: ShipmentTimelineCategory;
  title: string;
  description: string;
  actorType: ActivityActorType;
  actorName: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
};

type GetShipmentTimelineInput = {
  companyId: string;
  shipmentId: string;
  limit?: number;
  sortOrder?: "desc" | "asc";
};

function sentenceCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> | null {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

function classifyCategory(input: {
  entityType: EntityType;
  action: ActivityAction;
  actorType: ActivityActorType;
}): ShipmentTimelineCategory {
  if (
    input.action === ActivityAction.PARSE_DOCUMENT ||
    input.action === ActivityAction.APPLY_DOCUMENT_DATA ||
    input.entityType === EntityType.DOCUMENT
  ) {
    return "documents";
  }

  if (
    input.entityType === EntityType.INVOICE ||
    input.entityType === EntityType.SHIPMENT_COST ||
    input.entityType === EntityType.EXPENSE ||
    input.entityType === EntityType.REVENUE
  ) {
    return "finance";
  }

  if (input.entityType === EntityType.ALERT) {
    return "alerts";
  }

  if (input.actorType === ActivityActorType.SYSTEM) {
    return "system";
  }

  return "operations";
}

function deriveEventType(input: {
  entityType: EntityType;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actorType: ActivityActorType;
}) {
  if (
    input.entityType === EntityType.SHIPMENT &&
    input.action === ActivityAction.CREATE
  ) {
    return "SHIPMENT_CREATED";
  }
  if (
    input.entityType === EntityType.SHIPMENT &&
    input.action === ActivityAction.STATUS_CHANGE &&
    input.actorType === ActivityActorType.SYSTEM
  ) {
    return "SYSTEM_RECALCULATED_SHIPMENT_STATUS";
  }
  if (
    input.entityType === EntityType.SHIPMENT &&
    input.action === ActivityAction.STATUS_CHANGE
  ) {
    return "SHIPMENT_STATUS_CHANGED";
  }
  if (
    input.entityType === EntityType.MILESTONE &&
    input.field === "expectedAt"
  ) {
    return "MILESTONE_EXPECTED_DATE_CHANGED";
  }
  if (
    input.entityType === EntityType.MILESTONE &&
    input.field === "status" &&
    input.newValue === "COMPLETED"
  ) {
    return "MILESTONE_COMPLETED";
  }
  if (
    input.entityType === EntityType.MILESTONE &&
    input.field === "status" &&
    input.newValue === "DELAYED"
  ) {
    return "MILESTONE_DELAYED";
  }
  if (
    input.entityType === EntityType.DOCUMENT &&
    input.action === ActivityAction.CREATE
  ) {
    return "DOCUMENT_UPLOADED";
  }
  if (input.action === ActivityAction.PARSE_DOCUMENT) {
    return "DOCUMENT_PARSED";
  }
  if (input.action === ActivityAction.APPLY_DOCUMENT_DATA) {
    return "DOCUMENT_DATA_APPLIED";
  }
  if (
    input.entityType === EntityType.INVOICE &&
    input.action === ActivityAction.CREATE
  ) {
    return "INVOICE_CREATED";
  }
  if (input.entityType === EntityType.INVOICE && input.action === ActivityAction.ISSUE) {
    return "INVOICE_ISSUED";
  }
  if (
    input.entityType === EntityType.INVOICE &&
    input.action === ActivityAction.MARK_PAID
  ) {
    return "INVOICE_MARKED_PAID";
  }
  if (
    input.entityType === EntityType.SHIPMENT_COST &&
    input.action === ActivityAction.CREATE
  ) {
    return "SHIPMENT_COST_ADDED";
  }
  if (
    input.entityType === EntityType.EXPENSE &&
    input.action === ActivityAction.CREATE
  ) {
    return "EXPENSE_ADDED";
  }
  if (input.entityType === EntityType.ALERT && input.action === ActivityAction.CREATE) {
    return "ALERT_OPENED";
  }
  if (input.entityType === EntityType.ALERT && input.action === ActivityAction.RESOLVE) {
    return "ALERT_RESOLVED";
  }

  return `${input.entityType}_${input.action}`;
}

function buildTitle(eventType: string, row: {
  entityType: EntityType;
  action: ActivityAction;
  metadata: Record<string, unknown> | null;
}) {
  const milestoneCode =
    typeof row.metadata?.milestoneCode === "string"
      ? row.metadata.milestoneCode
      : null;
  if (eventType === "SHIPMENT_CREATED") return "Shipment created";
  if (eventType === "SHIPMENT_STATUS_CHANGED") return "Shipment status changed";
  if (eventType === "SYSTEM_RECALCULATED_SHIPMENT_STATUS") {
    return "System recalculated shipment status";
  }
  if (eventType === "MILESTONE_EXPECTED_DATE_CHANGED") {
    return `${milestoneCode ? sentenceCase(milestoneCode) : "Milestone"} expected date changed`;
  }
  if (eventType === "MILESTONE_COMPLETED") {
    return `${milestoneCode ? sentenceCase(milestoneCode) : "Milestone"} completed`;
  }
  if (eventType === "MILESTONE_DELAYED") {
    return `${milestoneCode ? sentenceCase(milestoneCode) : "Milestone"} delayed`;
  }
  if (eventType === "DOCUMENT_UPLOADED") return "Document uploaded";
  if (eventType === "DOCUMENT_PARSED") return "Document parsed";
  if (eventType === "DOCUMENT_DATA_APPLIED") return "Parsed document data applied";
  if (eventType === "INVOICE_CREATED") return "Invoice created";
  if (eventType === "INVOICE_ISSUED") return "Invoice issued";
  if (eventType === "INVOICE_MARKED_PAID") return "Invoice marked paid";
  if (eventType === "SHIPMENT_COST_ADDED") return "Shipment cost added";
  if (eventType === "EXPENSE_ADDED") return "Expense added";
  if (eventType === "ALERT_OPENED") return "Alert opened";
  if (eventType === "ALERT_RESOLVED") return "Alert resolved";
  return `${sentenceCase(row.entityType)} ${sentenceCase(row.action)}`;
}

function buildDescription(row: {
  summary: string | null;
  entityType: EntityType;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
}) {
  if (row.summary) return row.summary;
  if (row.field) {
    const fieldName = sentenceCase(row.field);
    return `${fieldName} changed from ${row.oldValue ?? "empty"} to ${row.newValue ?? "empty"}.`;
  }
  return `${sentenceCase(row.entityType)} ${sentenceCase(row.action)}.`;
}

export async function getShipmentTimeline(input: GetShipmentTimelineInput) {
  const [auditRows, shipment, milestones, documents, invoices, shipmentCosts, expenses, alerts] =
    await Promise.all([
      prisma.activityLog.findMany({
        where: {
          companyId: input.companyId,
          shipmentId: input.shipmentId,
        },
        include: {
          actor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.max(80, Math.min((input.limit ?? 160) * 3, 600)),
      }),
      prisma.shipment.findFirst({
        where: {
          id: input.shipmentId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          shipmentNumber: true,
          createdAt: true,
        },
      }),
      prisma.shipmentMilestone.findMany({
        where: { shipmentId: input.shipmentId },
        select: {
          id: true,
          code: true,
          label: true,
          status: true,
          expectedAt: true,
          actualAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.shipmentDocument.findMany({
        where: { shipmentId: input.shipmentId },
        select: {
          id: true,
          docType: true,
          fileName: true,
          createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          shipmentId: input.shipmentId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.shipmentCost.findMany({
        where: {
          shipmentId: input.shipmentId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          conceptCategory: true,
          createdAt: true,
        },
      }),
      prisma.expense.findMany({
        where: {
          shipmentId: input.shipmentId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          concept: true,
          createdAt: true,
        },
      }),
      prisma.alert.findMany({
        where: {
          companyId: input.companyId,
          shipmentId: input.shipmentId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
    ]);

  const timelineFromAudit: ShipmentTimelineEvent[] = auditRows.map((row) => {
    const eventType = deriveEventType({
      entityType: row.entityType,
      action: row.action,
      field: row.field ?? null,
      oldValue: row.oldValue ?? null,
      newValue: row.newValue ?? null,
      actorType: row.actorType,
    });

    return {
      id: row.id,
      shipmentId: input.shipmentId,
      eventType,
      category: classifyCategory({
        entityType: row.entityType,
        action: row.action,
        actorType: row.actorType,
      }),
      title: buildTitle(eventType, {
        entityType: row.entityType,
        action: row.action,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      }),
      description: buildDescription({
        summary: row.summary ?? null,
        entityType: row.entityType,
        action: row.action,
        field: row.field ?? null,
        oldValue: row.oldValue ?? null,
        newValue: row.newValue ?? null,
      }),
      actorType: row.actorType,
      actorName:
        row.actorType === ActivityActorType.SYSTEM
          ? row.actorName ?? "System"
          : row.actorName ?? row.actor?.name ?? "Unknown user",
      timestamp: row.createdAt,
      metadata: compactMetadata({
        source: "audit",
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        field: row.field ?? undefined,
        oldValue: row.oldValue ?? undefined,
        newValue: row.newValue ?? undefined,
        ...(row.metadata as Record<string, unknown> | null),
      }),
    };
  });

  const hasAuditCreate = new Set(
    auditRows
      .filter((row) => row.action === ActivityAction.CREATE)
      .map((row) => `${row.entityType}:${row.entityId}`),
  );

  const fallbackEvents: ShipmentTimelineEvent[] = [];

  if (shipment && !hasAuditCreate.has(`${EntityType.SHIPMENT}:${shipment.id}`)) {
    fallbackEvents.push({
      id: `fallback:shipment:${shipment.id}:created`,
      shipmentId: shipment.id,
      eventType: "SHIPMENT_CREATED",
      category: "operations",
      title: "Shipment created",
      description: `Shipment ${shipment.shipmentNumber} was created.`,
      actorType: ActivityActorType.SYSTEM,
      actorName: "System",
      timestamp: shipment.createdAt,
      metadata: {
        source: "shipment",
        entityType: EntityType.SHIPMENT,
        entityId: shipment.id,
      },
    });
  }

  for (const milestone of milestones) {
    const key = `${EntityType.MILESTONE}:${milestone.id}`;
    if (!hasAuditCreate.has(key)) {
      fallbackEvents.push({
        id: `fallback:milestone:${milestone.id}:created`,
        shipmentId: input.shipmentId,
        eventType: "MILESTONE_CREATED",
        category: "operations",
        title: `${milestone.label} milestone created`,
        description: `Milestone ${milestone.label} was added to the shipment workflow.`,
        actorType: ActivityActorType.SYSTEM,
        actorName: "System",
        timestamp: milestone.createdAt,
        metadata: {
          source: "milestone",
          entityType: EntityType.MILESTONE,
          entityId: milestone.id,
          milestoneCode: milestone.code,
          milestoneStatus: milestone.status,
        },
      });
    }
  }

  for (const document of documents) {
    const key = `${EntityType.DOCUMENT}:${document.id}`;
    if (hasAuditCreate.has(key)) continue;
    fallbackEvents.push({
      id: `fallback:document:${document.id}:uploaded`,
      shipmentId: input.shipmentId,
      eventType: "DOCUMENT_UPLOADED",
      category: "documents",
      title: `${sentenceCase(document.docType)} document uploaded`,
      description: `${document.fileName} was uploaded to shipment documents.`,
      actorType: ActivityActorType.SYSTEM,
      actorName: "System",
      timestamp: document.createdAt,
      metadata: {
        source: "document",
        entityType: EntityType.DOCUMENT,
        entityId: document.id,
        docType: document.docType,
      },
    });
  }

  for (const invoice of invoices) {
    const key = `${EntityType.INVOICE}:${invoice.id}`;
    if (!hasAuditCreate.has(key)) {
      fallbackEvents.push({
        id: `fallback:invoice:${invoice.id}:created`,
        shipmentId: input.shipmentId,
        eventType: "INVOICE_CREATED",
        category: "finance",
        title: "Invoice created",
        description: `Invoice ${invoice.invoiceNumber} was created.`,
        actorType: ActivityActorType.SYSTEM,
        actorName: "System",
        timestamp: invoice.createdAt,
        metadata: {
          source: "invoice",
          entityType: EntityType.INVOICE,
          entityId: invoice.id,
          invoiceStatus: invoice.status,
        },
      });
    }
  }

  for (const shipmentCost of shipmentCosts) {
    const key = `${EntityType.SHIPMENT_COST}:${shipmentCost.id}`;
    if (hasAuditCreate.has(key)) continue;
    fallbackEvents.push({
      id: `fallback:shipment-cost:${shipmentCost.id}:created`,
      shipmentId: input.shipmentId,
      eventType: "SHIPMENT_COST_ADDED",
      category: "finance",
      title: "Shipment cost added",
      description: `Shipment cost ${sentenceCase(shipmentCost.conceptCategory)} was registered.`,
      actorType: ActivityActorType.SYSTEM,
      actorName: "System",
      timestamp: shipmentCost.createdAt,
      metadata: {
        source: "shipment_cost",
        entityType: EntityType.SHIPMENT_COST,
        entityId: shipmentCost.id,
        conceptCategory: shipmentCost.conceptCategory,
      },
    });
  }

  for (const expense of expenses) {
    const key = `${EntityType.EXPENSE}:${expense.id}`;
    if (hasAuditCreate.has(key)) continue;
    fallbackEvents.push({
      id: `fallback:expense:${expense.id}:created`,
      shipmentId: input.shipmentId,
      eventType: "EXPENSE_ADDED",
      category: "finance",
      title: "Expense added",
      description: `Expense ${expense.concept} was registered for this shipment.`,
      actorType: ActivityActorType.SYSTEM,
      actorName: "System",
      timestamp: expense.createdAt,
      metadata: {
        source: "expense",
        entityType: EntityType.EXPENSE,
        entityId: expense.id,
      },
    });
  }

  for (const alert of alerts) {
    if (!hasAuditCreate.has(`${EntityType.ALERT}:${alert.id}`)) {
      fallbackEvents.push({
        id: `fallback:alert:${alert.id}:opened`,
        shipmentId: input.shipmentId,
        eventType: "ALERT_OPENED",
        category: "alerts",
        title: "Alert opened",
        description: alert.title,
        actorType: ActivityActorType.SYSTEM,
        actorName: "Alert engine",
        timestamp: alert.createdAt,
        metadata: {
          source: "alert",
          entityType: EntityType.ALERT,
          entityId: alert.id,
          status: alert.status,
        },
      });
    }

    const hasResolveAudit = auditRows.some(
      (row) =>
        row.entityType === EntityType.ALERT &&
        row.entityId === alert.id &&
        row.action === ActivityAction.RESOLVE,
    );

    if (alert.status === AlertStatus.RESOLVED && alert.resolvedAt && !hasResolveAudit) {
      fallbackEvents.push({
        id: `fallback:alert:${alert.id}:resolved`,
        shipmentId: input.shipmentId,
        eventType: "ALERT_RESOLVED",
        category: "alerts",
        title: "Alert resolved",
        description: alert.title,
        actorType: ActivityActorType.SYSTEM,
        actorName: "Alert engine",
        timestamp: alert.resolvedAt,
        metadata: {
          source: "alert",
          entityType: EntityType.ALERT,
          entityId: alert.id,
          status: AlertStatus.RESOLVED,
        },
      });
    }
  }

  const allEvents = [...timelineFromAudit, ...fallbackEvents].sort((left, right) => {
    const delta = right.timestamp.getTime() - left.timestamp.getTime();
    return delta === 0 ? left.id.localeCompare(right.id) : delta;
  });

  const sorted =
    input.sortOrder === "asc" ? allEvents.slice().reverse() : allEvents;

  return sorted.slice(0, Math.max(1, Math.min(input.limit ?? 160, 500)));
}
