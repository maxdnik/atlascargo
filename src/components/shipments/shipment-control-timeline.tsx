"use client";

import { useMemo, useState } from "react";
import type { ActivityActorType } from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Cog,
  FileText,
  ShipWheel,
} from "lucide-react";

export type ShipmentTimelineCategory =
  | "operations"
  | "finance"
  | "documents"
  | "alerts"
  | "system";

export type ShipmentControlTimelineItem = {
  id: string;
  shipmentId: string;
  eventType: string;
  category: ShipmentTimelineCategory;
  title: string;
  description: string;
  actorType: ActivityActorType;
  actorName: string;
  timestamp: string | Date;
  reference: {
    entityType: string;
    entityId: string;
    shipmentId: string | null;
    customerId: string | null;
    label: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
};

const CATEGORY_ORDER: ShipmentTimelineCategory[] = [
  "operations",
  "finance",
  "documents",
  "alerts",
  "system",
];

function categoryLabel(category: ShipmentTimelineCategory) {
  if (category === "operations") return "Operations";
  if (category === "finance") return "Finance";
  if (category === "documents") return "Documents";
  if (category === "alerts") return "Alerts";
  return "System";
}

function categoryPill(category: ShipmentTimelineCategory, active: boolean) {
  if (active) {
    if (category === "operations") return "bg-sky-600 text-white";
    if (category === "finance") return "bg-emerald-600 text-white";
    if (category === "documents") return "bg-violet-600 text-white";
    if (category === "alerts") return "bg-amber-600 text-white";
    return "bg-slate-700 text-white";
  }
  return "border border-slate-200 bg-white text-slate-600";
}

function categoryBadge(category: ShipmentTimelineCategory) {
  if (category === "operations") return "bg-sky-100 text-sky-700";
  if (category === "finance") return "bg-emerald-100 text-emerald-700";
  if (category === "documents") return "bg-violet-100 text-violet-700";
  if (category === "alerts") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function categoryIcon(category: ShipmentTimelineCategory) {
  if (category === "operations") return <ShipWheel className="h-3.5 w-3.5" />;
  if (category === "finance") return <CircleDollarSign className="h-3.5 w-3.5" />;
  if (category === "documents") return <FileText className="h-3.5 w-3.5" />;
  if (category === "alerts") return <Bell className="h-3.5 w-3.5" />;
  return <Cog className="h-3.5 w-3.5" />;
}

function actorPill(actorType: ActivityActorType) {
  return actorType === "SYSTEM"
    ? "bg-indigo-100 text-indigo-700"
    : "bg-slate-100 text-slate-700";
}

function formatTimestamp(value: string | Date) {
  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return (
    <dl className="mt-2 grid gap-1 text-[11px] text-slate-600 md:grid-cols-2">
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className="rounded-md border border-slate-200/80 bg-white px-2 py-1">
          <dt className="font-semibold text-slate-700">{key}</dt>
          <dd className="truncate text-slate-600">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShipmentControlTimeline({
  items,
}: {
  items: ShipmentControlTimelineItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<ShipmentTimelineCategory | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const counts = useMemo(() => {
    return items.reduce<Record<ShipmentTimelineCategory, number>>(
      (acc, item) => {
        acc[item.category] += 1;
        return acc;
      },
      {
        operations: 0,
        finance: 0,
        documents: 0,
        alerts: 0,
        system: 0,
      },
    );
  }, [items]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No timeline events found for this shipment yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            selectedCategory === "all" ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600"
          }`}
        >
          All ({items.length})
        </button>
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${categoryPill(
              category,
              selectedCategory === category,
            )}`}
          >
            {categoryIcon(category)}
            <span>
              {categoryLabel(category)} ({counts[category]})
            </span>
          </button>
        ))}
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No events in this category for the current shipment.
          </div>
        ) : null}

        <ol className="space-y-2">
          {filteredItems.map((item, index) => {
            const isExpanded = Boolean(expandedIds[item.id]);
            return (
              <li key={item.id} className="relative pl-6">
                {index < filteredItems.length - 1 ? (
                  <span className="absolute left-[8px] top-6 h-[calc(100%-10px)] w-px bg-slate-200" />
                ) : null}
                <span className="absolute left-[2px] top-2 h-3 w-3 rounded-full bg-sky-500/80" />

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryBadge(
                          item.category,
                        )}`}
                      >
                        {categoryIcon(item.category)}
                        {categoryLabel(item.category)}
                      </span>
                      <span className="font-semibold text-slate-900">{item.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatTimestamp(item.timestamp)}</span>
                  </div>

                  <p className="mt-1 text-[12px] text-slate-700">{item.description}</p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${actorPill(item.actorType)}`}>
                      {item.actorType}
                    </span>
                    <span>{item.actorName}</span>
                    <span className="text-slate-300">•</span>
                    <span>{item.eventType}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "Hide details" : "Show details"}
                  </button>

                  {isExpanded ? (
                    <div className="mt-1">
                      {renderMetadata(item.metadata) ?? (
                        <div className="rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500">
                          No additional metadata for this event.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Timeline is shown newest first.
      </div>
    </div>
  );
}
