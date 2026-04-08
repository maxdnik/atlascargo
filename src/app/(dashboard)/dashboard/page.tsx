import {
  AlertTriangle,
  ChartColumnBig,
  PackageCheck,
  Plane,
  SearchCheck,
  Ship,
  Truck,
} from "lucide-react";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { getDashboardKpis } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { enforcePagePermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await enforcePagePermission(PermissionResource.DASHBOARD, PermissionAction.VIEW);
  const companyId = session.companyId;
  const dashboardData = await getDashboardKpis(companyId);

  const kpis = [
    {
      label: "Shipments in Transit",
      value: formatNumber(dashboardData.shipmentsInTransit),
      tone: "text-blue-600",
      indicator: "bg-blue-500",
      status: `${dashboardData.weeklyActivity.at(-1)?.count ?? 0} updated this week`,
    },
    {
      label: "In Customs",
      value: formatNumber(dashboardData.shipmentsInCustoms),
      tone: "text-amber-600",
      indicator: "bg-amber-500",
      status: `${dashboardData.customsAgingCount} over 72h watchlist`,
    },
    {
      label: "Delivered",
      value: formatNumber(dashboardData.shipmentsDelivered),
      tone: "text-emerald-600",
      indicator: "bg-emerald-500",
      status: `${dashboardData.deliveredWeekOverWeekPct >= 0 ? "+" : ""}${dashboardData.deliveredWeekOverWeekPct.toFixed(1)}% vs prior week`,
    },
    {
      label: "Pending / Issues",
      value: formatNumber(dashboardData.pendingIssues),
      tone: "text-rose-600",
      indicator: "bg-rose-500",
      status: `${dashboardData.alerts.length} active alerts`,
    },
  ];

  const modeTotal = Math.max(
    1,
    dashboardData.modeBreakdown.reduce((acc, item) => acc + item.count, 0),
  );
  const weeklyMax = Math.max(1, ...dashboardData.weeklyActivity.map((item) => item.count));
  const activityRows = dashboardData.activityRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Operations control center</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time movement status, exceptions, and shipment execution overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/70"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${kpi.indicator}`} />
            </div>
            <p className={`mt-3 text-3xl font-semibold ${kpi.tone}`}>{kpi.value}</p>
            <p className="mt-2 text-xs text-slate-500">{kpi.status}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Shipments by mode</h2>
                <ChartColumnBig className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-3">
                {dashboardData.modeBreakdown.map((mode) => {
                  const pct = (mode.count / modeTotal) * 100;
                  const Icon = mode.mode === "AIR" ? Plane : mode.mode === "OCEAN" ? Ship : Truck;
                  return (
                    <div key={mode.mode}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                          <span>{mode.mode}</span>
                        </div>
                        <span className="font-medium text-slate-800">{mode.count}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div
                          className={`h-2.5 rounded-full ${
                            mode.mode === "AIR"
                              ? "bg-sky-500"
                              : mode.mode === "OCEAN"
                                ? "bg-violet-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(8, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Weekly activity</h2>
                <PackageCheck className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex h-40 items-end gap-2 rounded-xl bg-slate-50/80 px-3 pb-3 pt-4">
                {dashboardData.weeklyActivity.map((point) => (
                  <div key={point.weekLabel} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-end justify-center">
                      <div
                        className="w-6 rounded-t-md bg-blue-500/85 transition-all"
                        style={{ height: `${Math.max(8, Math.round((point.count / weeklyMax) * 110))}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{point.weekLabel}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Volume trend from newly created shipment files.
              </p>
            </article>
          </div>

          <article className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Operational activity table</h2>
              <span className="text-xs text-slate-500">{activityRows.length} active files</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Shipment #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Origin</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">ETA</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {activityRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        No shipment activity available yet.
                      </td>
                    </tr>
                  ) : (
                    activityRows.map((shipment) => (
                      <tr key={shipment.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              shipment.status === "IN_TRANSIT"
                                ? "bg-blue-100 text-blue-700"
                                : shipment.status === "CUSTOMS"
                                  ? "bg-amber-100 text-amber-700"
                                  : shipment.status === "DELIVERED"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : shipment.status === "CANCELLED"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {shipment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{shipment.shipmentNumber}</td>
                        <td className="px-4 py-3">{shipment.customer.legalName}</td>
                        <td className="px-4 py-3">{shipment.originCode ?? "-"}</td>
                        <td className="px-4 py-3">{shipment.destinationCode ?? "-"}</td>
                        <td className="px-4 py-3">
                          {shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/shipments/${shipment.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Open file
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Shipment tracking panel</h2>
              <SearchCheck className="h-4 w-4 text-slate-400" />
            </div>
            {dashboardData.trackingPanel ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Reference</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {dashboardData.trackingPanel.houseRef ??
                      dashboardData.trackingPanel.masterRef ??
                      dashboardData.trackingPanel.bookingRef ??
                      dashboardData.trackingPanel.shipmentNumber}
                  </p>
                </div>
                <div className="space-y-4">
                  {dashboardData.trackingPanel.steps.map((step, index) => (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            step.state === "done"
                              ? "bg-emerald-500"
                              : step.state === "current"
                                ? "bg-blue-500"
                                : "bg-slate-300"
                          }`}
                        />
                        {index < dashboardData.trackingPanel!.steps.length - 1 ? (
                          <span className="mt-1 h-8 w-px bg-slate-200" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{step.label}</p>
                        <p className="text-xs text-slate-500">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active shipment to track.</p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Alerts & notifications</h2>
              <AlertTriangle className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-3">
              {dashboardData.alerts.length === 0 ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  No urgent alerts right now.
                </p>
              ) : (
                dashboardData.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border px-3 py-2 ${
                      alert.level === "critical"
                        ? "border-rose-200 bg-rose-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        alert.level === "critical" ? "text-rose-800" : "text-amber-800"
                      }`}
                    >
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-600">{alert.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
