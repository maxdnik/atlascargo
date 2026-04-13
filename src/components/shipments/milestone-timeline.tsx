"use client";

import { useActionState } from "react";
import { MilestoneStatus } from "@prisma/client";

import {
  upsertMilestoneAction,
  type ShipmentActionState,
} from "@/app/(dashboard)/shipments/actions";
import {
  filterShipmentWorkflowMilestones,
  sortShipmentMilestones,
} from "@/lib/shipment-milestones";

type MilestoneRow = {
  id: string;
  code: string;
  label: string;
  actualAt: string | null;
  status: MilestoneStatus;
  comment: string | null;
};

type MilestoneTimelineProps = {
  shipmentId: string;
  milestones: MilestoneRow[];
};

const initialState: ShipmentActionState = { success: false };

function formatDate(value: string | null) {
  if (!value) return "No date recorded";
  return new Date(value).toLocaleString();
}

function toInputValue(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function milestoneBadgeClass(status: MilestoneStatus) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  if (status === "DELAYED") return "bg-amber-100 text-amber-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function MilestoneRowForm({
  shipmentId,
  milestone,
}: {
  shipmentId: string;
  milestone: MilestoneRow;
}) {
  const [state, action, pending] = useActionState(upsertMilestoneAction, initialState);

  return (
    <form action={action} className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="code" value={milestone.code} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{milestone.label}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${milestoneBadgeClass(
            milestone.status,
          )}`}
        >
          {milestone.status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Actual</label>
          <input
            type="datetime-local"
            name="actualAt"
            defaultValue={toInputValue(milestone.actualAt)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Current: {formatDate(milestone.actualAt)}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select
            name="status"
            defaultValue={milestone.status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.values(MilestoneStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={milestone.comment ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Update milestone"}
      </button>
    </form>
  );
}

export function MilestoneTimeline({ shipmentId, milestones }: MilestoneTimelineProps) {
  if (milestones.length === 0) {
    return <p className="text-sm text-slate-500">No milestones configured for this shipment.</p>;
  }

  const orderedMilestones = sortShipmentMilestones(filterShipmentWorkflowMilestones(milestones));

  return (
    <div className="space-y-3">
      {orderedMilestones.map((milestone) => (
        <MilestoneRowForm key={milestone.id} shipmentId={shipmentId} milestone={milestone} />
      ))}
    </div>
  );
}
