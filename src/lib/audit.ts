import {
  ActivityAction,
  ActivityActorType,
  EntityType,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditWriteClient = Prisma.TransactionClient | typeof prisma;

type JsonRecord = Record<string, unknown>;

export type AuditActorContext = {
  actorType?: ActivityActorType;
  actorId?: string | null;
  actorName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type RecordAuditEventInput = {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  shipmentId?: string | null;
  customerId?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actor?: AuditActorContext;
};

export type RecordEntityDiffInput = {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  action?: ActivityAction;
  shipmentId?: string | null;
  customerId?: string | null;
  before: JsonRecord | null | undefined;
  after: JsonRecord | null | undefined;
  trackedFields?: string[];
  fieldLabels?: Record<string, string>;
  metadata?: Record<string, unknown> | null;
  actor?: AuditActorContext;
  fallbackSummary?: string;
};

export type AuditHistoryRow = {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  actorType: ActivityActorType;
  actorId: string | null;
  actorName: string;
  summary: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
};

type ListAuditHistoryInput = {
  companyId: string;
  entityType?: EntityType;
  entityId?: string;
  shipmentId?: string;
  customerId?: string;
  actionTypes?: ActivityAction[];
  limit?: number;
};

function jsonSafeValue(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => jsonSafeValue(item));
  if (typeof value === "object") {
    if ("toISOString" in (value as Record<string, unknown>) && typeof (value as { toISOString?: unknown }).toISOString === "function") {
      return (value as { toISOString: () => string }).toISOString();
    }
    if ("toString" in (value as Record<string, unknown>) && (value as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
      return String(value);
    }
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = jsonSafeValue(nested);
    }
    return result;
  }
  return String(value);
}

function stableSortJson(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortJson(item));
  }
  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const sorted: Record<string, Prisma.InputJsonValue> = {};
    for (const key of sortedKeys) {
      const nested = (value as Record<string, Prisma.InputJsonValue>)[key];
      sorted[key] = stableSortJson(nested);
    }
    return sorted;
  }
  return value;
}

function toCompareString(value: unknown) {
  return JSON.stringify(stableSortJson(jsonSafeValue(value)));
}

function formatFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(jsonSafeValue(value));
}

function sentenceCaseField(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part.toLowerCase(),
    )
    .join(" ");
}

function buildFieldSummary(fieldLabel: string, oldValue: string | null, newValue: string | null) {
  if (oldValue === null && newValue !== null) {
    return `${fieldLabel} set to ${newValue}.`;
  }
  if (oldValue !== null && newValue === null) {
    return `${fieldLabel} cleared (was ${oldValue}).`;
  }
  return `${fieldLabel} changed from ${oldValue ?? "empty"} to ${newValue ?? "empty"}.`;
}

async function resolveActorName(client: AuditWriteClient, actor: AuditActorContext): Promise<string | null> {
  if (actor.actorType === ActivityActorType.SYSTEM) {
    return actor.actorName ?? "System";
  }
  if (actor.actorName) return actor.actorName;
  if (!actor.actorId) return null;
  const user = await client.user.findUnique({
    where: { id: actor.actorId },
    select: { name: true } satisfies Record<keyof Pick<User, "name">, true>,
  });
  return user?.name ?? null;
}

export async function recordAuditEvent(
  input: RecordAuditEventInput,
  tx?: AuditWriteClient,
) {
  const client = tx ?? prisma;
  const actor = input.actor ?? {};
  const actorType = actor.actorType ?? ActivityActorType.USER;
  const actorName = await resolveActorName(client, { ...actor, actorType });

  await client.activityLog.create({
    data: {
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType,
      actorId: actorType === ActivityActorType.SYSTEM ? null : (actor.actorId ?? null),
      actorName,
      shipmentId: input.shipmentId ?? null,
      customerId: input.customerId ?? null,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ? (jsonSafeValue(input.metadata) as Prisma.InputJsonValue) : null,
      beforeJson: input.before ? (jsonSafeValue(input.before) as Prisma.InputJsonValue) : null,
      afterJson: input.after ? (jsonSafeValue(input.after) as Prisma.InputJsonValue) : null,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    },
  });
}

export async function recordEntityDiff(
  input: RecordEntityDiffInput,
  tx?: AuditWriteClient,
) {
  const before = input.before ?? {};
  const after = input.after ?? {};
  const trackedFields =
    input.trackedFields ??
    Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  let changedCount = 0;

  for (const field of trackedFields) {
    const previous = before[field];
    const next = after[field];
    if (toCompareString(previous) === toCompareString(next)) continue;

    const oldValue = formatFieldValue(previous);
    const newValue = formatFieldValue(next);
    const label = input.fieldLabels?.[field] ?? sentenceCaseField(field);
    await recordAuditEvent(
      {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        action:
          field.toLowerCase().includes("status") && (input.action ?? ActivityAction.UPDATE) === ActivityAction.UPDATE
            ? ActivityAction.STATUS_CHANGE
            : (input.action ?? ActivityAction.UPDATE),
        shipmentId: input.shipmentId ?? null,
        customerId: input.customerId ?? null,
        field,
        oldValue,
        newValue,
        summary: buildFieldSummary(label, oldValue, newValue),
        metadata: input.metadata ?? null,
        actor: input.actor,
      },
      tx,
    );
    changedCount += 1;
  }

  if (changedCount > 0) return changedCount;

  await recordAuditEvent(
    {
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action ?? ActivityAction.UPDATE,
      shipmentId: input.shipmentId ?? null,
      customerId: input.customerId ?? null,
      summary: input.fallbackSummary ?? "Record updated.",
      before,
      after,
      metadata: input.metadata ?? null,
      actor: input.actor,
    },
    tx,
  );

  return 1;
}

export async function listAuditHistory(input: ListAuditHistoryInput) {
  const rows = await prisma.activityLog.findMany({
    where: {
      companyId: input.companyId,
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.shipmentId ? { shipmentId: input.shipmentId } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.actionTypes?.length ? { action: { in: input.actionTypes } } : {}),
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(input.limit ?? 80, 300)),
  });

  return rows
    .slice()
    .reverse()
    .map(
    (row): AuditHistoryRow => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      actorType: row.actorType,
      actorId: row.actorId,
      actorName:
        row.actorType === ActivityActorType.SYSTEM
          ? row.actorName ?? "System"
          : row.actorName ?? row.actor?.name ?? "Unknown user",
      summary:
        row.summary ??
        (row.field
          ? buildFieldSummary(
              sentenceCaseField(row.field),
              row.oldValue ?? null,
              row.newValue ?? null,
            )
          : `${sentenceCaseField(row.entityType)} ${row.action.toLowerCase()}.`),
      field: row.field ?? null,
      oldValue: row.oldValue ?? null,
      newValue: row.newValue ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      timestamp: row.createdAt,
    }),
  );
}

export async function listShipmentAuditHistory(input: {
  companyId: string;
  shipmentId: string;
  limit?: number;
  actionTypes?: ActivityAction[];
}) {
  return listAuditHistory({
    companyId: input.companyId,
    shipmentId: input.shipmentId,
    limit: input.limit,
    actionTypes: input.actionTypes,
  });
}
