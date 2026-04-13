import Link from "next/link";

import { getRequiredPortalSession, listPortalShipments } from "@/lib/portal";

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: string) {
  if (status === "DELIVERED" || status === "CLOSED") return "bg-emerald-100 text-emerald-700";
  if (status === "CUSTOMS") return "bg-amber-100 text-amber-800";
  if (status === "IN_TRANSIT" || status === "ARRIVED") return "bg-sky-100 text-sky-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function progressClass(progressPercent: number) {
  if (progressPercent >= 100) return "bg-emerald-500";
  if (progressPercent >= 70) return "bg-sky-500";
  if (progressPercent >= 35) return "bg-blue-500";
  return "bg-slate-400";
}

function dateLabel(value: Date | null) {
  return value ? value.toLocaleDateString() : "-";
}

export default async function PortalShipmentsPage() {
  const session = await getRequiredPortalSession();
  const shipments = await listPortalShipments(session);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your shipments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live operational view powered by shared shipment state.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Shipment</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">ETD / ETA</th>
                <th className="px-4 py-3">Latest stage</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {shipments.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={8}>
                    No shipments available for your account.
                  </td>
                </tr>
              ) : (
                shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{shipment.shipmentNumber}</span>
                        {shipment.hasClientAlert ? (
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            Alert
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{shipment.routeSummary}</td>
                    <td className="px-4 py-3">{shipment.mode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                          shipment.status,
                        )}`}
                      >
                        {statusLabel(shipment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>ETD: {dateLabel(shipment.etd)}</p>
                      <p>ETA: {dateLabel(shipment.eta)}</p>
                    </td>
                    <td className="px-4 py-3">{shipment.latestMilestoneLabel ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${progressClass(shipment.progressPercent)}`}
                            style={{ width: `${Math.max(4, shipment.progressPercent)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{shipment.progressPercent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/portal/shipments/${shipment.id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
