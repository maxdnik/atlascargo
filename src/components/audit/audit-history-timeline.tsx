"use client";

import { ActivityActorType } from "@prisma/client";

type AuditHistoryTimelineItem = {
  id: string;
  actorType: ActivityActorType;
  actorName: string;
  action: string;
  summary: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string | Date;
};

function dateLabel(value: string | Date) {
  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actorBadgeClass(actorType: ActivityActorType) {
  return actorType === ActivityActorType.SYSTEM
    ? "bg-indigo-100 text-indigo-700"
    : "bg-slate-100 text-slate-700";
}

export function AuditHistoryTimeline({
  items,
  emptyLabel = "No history records yet.",
}: {
  items: AuditHistoryTimelineItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item.id} className="relative pl-6">
          {index < items.length - 1 ? (
            <span className="absolute left-[8px] top-6 h-[calc(100%-10px)] w-px bg-slate-200" />
          ) : null}
          <span className="absolute left-[2px] top-2 h-3 w-3 rounded-full bg-sky-500/80" />
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{item.summary}</span>
              <span className="text-[11px] text-slate-500">{dateLabel(item.timestamp)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${actorBadgeClass(item.actorType)}`}
              >
                {item.actorType}
              </span>
              <span>{item.actorName}</span>
              <span className="text-slate-300">•</span>
              <span>{item.action}</span>
              {item.field ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{item.field}</span>
                </>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
