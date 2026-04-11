import {
  ActivityAction,
  ActivityActorType,
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
  reference: ShipmentTimelineReference | null;
  metadata: Record<string, unknown> | null;
};

export type ShipmentTimelineReference = {
  entityType: EntityType;
  entityId: string;
  shipmentId: string | null;
  customerId: string | null;
  label: string | null;
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

function readMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

function readMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function shouldIncludeTimelineRow(input: {
  action: ActivityAction;
  metadata: Record<string, unknown> | null;
}) {
  if (input.action !== ActivityAction.APPLY_DOCUMENT_DATA) return true;

  const appliedChangesCountRaw = input.metadata?.appliedChangesCount;
  if (typeof appliedChangesCountRaw === "number" && appliedChangesCountRaw > 0) {
    return true;
  }

  const appliedFieldsRaw = input.metadata?.appliedFieldNames;
  if (Array.isArray(appliedFieldsRaw) && appliedFieldsRaw.length > 0) {
    return true;
  }

  const appliedRecordsRaw = input.metadata?.appliedRecords;
  if (Array.isArray(appliedRecordsRaw) && appliedRecordsRaw.length > 0) {
    return true;
  }

  return false;
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
    input.action === ActivityAction.MARK_PAID
  ) {
    return "SHIPMENT_COST_MARKED_PAID";
  }
  if (
    input.entityType === EntityType.EXPENSE &&
    input.action === ActivityAction.MARK_PAID
  ) {
    return "EXPENSE_MARKED_PAID";
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
  if (eventType === "DOCUMENT_PARSED") return "Document parsing attempted";
  if (eventType === "DOCUMENT_DATA_APPLIED") return "Parsed document data applied";
  if (eventType === "INVOICE_CREATED") return "Invoice created";
  if (eventType === "INVOICE_ISSUED") return "Invoice issued";
  if (eventType === "INVOICE_MARKED_PAID") return "Invoice marked paid";
  if (eventType === "SHIPMENT_COST_MARKED_PAID") return "Shipment cost marked as paid";
  if (eventType === "EXPENSE_MARKED_PAID") return "Expense marked as paid";
  if (eventType === "SHIPMENT_COST_ADDED") return "Shipment cost added";
  if (eventType === "EXPENSE_ADDED") return "Expense added";
  if (eventType === "ALERT_OPENED") return "Alert opened";
  if (eventType === "ALERT_RESOLVED") return "Alert resolved";
  return `${sentenceCase(row.entityType)} ${sentenceCase(row.action)}`;
}

function buildReference(row: {
  entityType: EntityType;
  entityId: string;
  shipmentId: string | null;
  customerId: string | null;
  metadata: Record<string, unknown> | null;
}): ShipmentTimelineReference {
  const label =
    readMetadataString(row.metadata, "invoiceNumber") ??
    readMetadataString(row.metadata, "fileName") ??
    readMetadataString(row.metadata, "docType") ??
    readMetadataString(row.metadata, "concept") ??
    readMetadataString(row.metadata, "conceptCategory") ??
    readMetadataString(row.metadata, "title");

  return {
    entityType: row.entityType,
    entityId: row.entityId,
    shipmentId: row.shipmentId,
    customerId: row.customerId,
    label,
  };
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
  const auditRows = await prisma.activityLog.findMany({
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
  });

  const timelineFromAudit: ShipmentTimelineEvent[] = auditRows
    .filter((row) =>
      shouldIncludeTimelineRow({
        action: row.action,
        metadata: readMetadata(row.metadata),
      }),
    )
    .map((row) => {
      const metadata = readMetadata(row.metadata);
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
          metadata,
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
        reference: buildReference({
          entityType: row.entityType,
          entityId: row.entityId,
          shipmentId: row.shipmentId ?? null,
          customerId: row.customerId ?? null,
          metadata,
        }),
        metadata: compactMetadata({
          source: "audit",
          entityType: row.entityType,
          entityId: row.entityId,
          action: row.action,
          field: row.field ?? undefined,
          oldValue: row.oldValue ?? undefined,
          newValue: row.newValue ?? undefined,
          ...metadata,
        }),
      };
    });

  const allEvents = timelineFromAudit.sort((left, right) => {
    const delta = right.timestamp.getTime() - left.timestamp.getTime();
    return delta === 0 ? left.id.localeCompare(right.id) : delta;
  });

  const sorted =
    input.sortOrder === "asc" ? allEvents.slice().reverse() : allEvents;

  return sorted.slice(0, Math.max(1, Math.min(input.limit ?? 160, 500)));
}
