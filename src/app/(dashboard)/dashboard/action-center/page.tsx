import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleCheck,
  CircleDollarSign,
  PackagePlus,
  Plus,
  Siren,
  UserPlus,
} from "lucide-react";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { enforcePagePermission } from "@/lib/permissions";
import { getActionCenterData } from "@/lib/action-center";
import { resolveActionCenterAlertAction } from "@/app/(dashboard)/dashboard/action-center/actions";
import { getStatusLabel } from "@/lib/shipment-state";

type Severity = "HIGH" | "MEDIUM" | "LOW";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function statusClass(severity: Severity) {
  if (severity === "HIGH") return "border-rose-200 bg-rose-50 text-rose-800";
  if (severity === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function badgeClass(severity: Severity) {
  if (severity === "HIGH") return "bg-rose-100 text-rose-700";
  if (severity === "MEDIUM") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function ActionCenterPage() {
  const session = await enforcePagePermission(PermissionResource.DASHBOARD, PermissionAction.VIEW);
  const data = await getActionCenterData(session.companyId);

  const criticalBlocks = [
    {
      key: "missing-docs",
      title: "Missing documents",
      description: "Shipments without booking/house/master references.",
      items: data.criticalAlerts.missingDocuments,
    },
    {
      key: "delayed",
      title: "Delayed shipments",
      description: "ETA passed and shipment is not delivered.",
      items: data.criticalAlerts.delayedShipments,
    },
    {
      key: "stuck-status",
      title: "Stuck status",
      description: "Shipments frozen in execution statuses beyond SLA.",
      items: data.criticalAlerts.stuckStatuses,
    },
    {
      key: "milestones",
      title: "Missing milestones",
      description: "IN_TRANSIT files without ATD/departure confirmation.",
      items: data.criticalAlerts.missingMilestones,
    },
  ];

  const financialBlocks = [
    {
      key: "no-invoice",
      title: "No invoice on executed shipments",
      description: "Shipment reached operational execution but has no invoice.",
      items: data.financialRisks.noInvoice,
    },
    {
      key: "low-margin",
      title: "Low / negative margin",
      description: "Actual margin below quote or gross profit negative.",
      items: data.financialRisks.lowOrNegativeMargin,
    },
    {
      key: "cost-no-revenue",
      title: "Costs with no revenue",
      description: "Supplier costs loaded without customer billing.",
      items: data.financialRisks.costWithoutRevenue,
    },
    {
      key: "overdue-invoices",
      title: "Overdue invoices",
      description: "Due date passed and invoice not paid.",
      items: data.financialRisks.overdueInvoices,
    },
  ];

  const totalCritical = criticalBlocks.reduce((sum, block) => sum + block.items.length, 0);
  const totalOperational =
    data.operationalRisks.HIGH.length + data.operationalRisks.MEDIUM.length + data.operationalRisks.LOW.length;
  const totalFinancial = financialBlocks.reduce((sum, block) => sum + block.items.length, 0);
  const openAlertsCount = data.alerts.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Action Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Decision hub for operational incidents, financial leakage, and required execution.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[560px]">
          <article className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Critical alerts</p>
            <p className="mt-1 text-2xl font-semibold text-rose-800">{totalCritical}</p>
          </article>
          <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Operational risks</p>
            <p className="mt-1 text-2xl font-semibold text-amber-800">{totalOperational}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Financial risks</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{totalFinancial}</p>
          </article>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <article className="overflow-hidden rounded-2xl border border-rose-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/80 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-rose-900">Critical Alerts</h2>
                <p className="mt-0.5 text-xs text-rose-700/80">Immediate intervention required today.</p>
              </div>
              <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                {totalCritical}
              </span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {criticalBlocks.map((block) => (
                <section key={block.key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {block.items.length}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">{block.description}</p>
                  <div className="space-y-2">
                    {block.items.length === 0 ? (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                        No issues detected.
                      </p>
                    ) : (
                      block.items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {item.shipmentNumber} · {item.customer}
                          </p>
                          <p className="mt-0.5 text-xs text-rose-800">{item.issue}</p>
                          <Link
                            href={item.ctaHref}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            Open shipment <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/80 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-indigo-900">Alerts</h2>
                <p className="mt-0.5 text-xs text-indigo-700/80">
                  Real-time alerts with in-app/email notifications.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                <Siren className="h-3.5 w-3.5" />
                {openAlertsCount}
              </span>
            </div>
            <div className="space-y-2 p-4">
              {data.alerts.length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  No open alerts.
                </p>
              ) : (
                data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      alert.severity === "HIGH"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : alert.severity === "MEDIUM"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {alert.shipmentNumber ? `${alert.shipmentNumber} · ` : ""}
                          {alert.customerName ?? "Operational alert"}
                        </p>
                        <p className="mt-0.5">{alert.message}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {alert.type} · {alert.createdAt.toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
                        {alert.severity}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={alert.ctaHref}
                        className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                      >
                        Open {alert.shipmentId ? "shipment" : "action center"}{" "}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <form action={resolveActionCenterAlertAction}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          <CircleCheck className="h-3.5 w-3.5" />
                          Mark resolved
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Operational Risks</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Routing, scheduling, carrier, and customs execution exposures.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {totalOperational}
              </span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {(Object.keys(data.operationalRisks) as Severity[]).map((severity) => {
                const rows = data.operationalRisks[severity];
                return (
                  <section key={severity} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(severity)}`}>
                        {severity}
                      </span>
                      <span className="text-xs text-slate-500">{rows.length}</span>
                    </div>
                    <div className="space-y-2">
                      {rows.length === 0 ? (
                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                          No current risks.
                        </p>
                      ) : (
                        rows.map((row) => (
                          <div
                            key={row.id}
                            className={`rounded-lg border px-2.5 py-2 text-xs ${statusClass(row.severity ?? severity)}`}
                          >
                            <p className="font-semibold text-slate-900">
                              {row.shipmentNumber} · {row.customer}
                            </p>
                            <p className="mt-0.5">{row.issue}</p>
                            <Link
                              href={row.ctaHref}
                              className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                            >
                              Open shipment <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Financial Risks</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Revenue leakage, overdue receivables, and margin deterioration.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {totalFinancial}
              </span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {financialBlocks.map((block) => (
                <section key={block.key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {block.items.length}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">{block.description}</p>
                  <div className="space-y-2">
                    {block.items.length === 0 ? (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                        No active risk.
                      </p>
                    ) : (
                      block.items.map((item) => {
                        return (
                          <div key={item.id} className={`rounded-lg border px-2.5 py-2 text-xs ${statusClass(item.severity)}`}>
                            <p className="font-semibold text-slate-900">
                              {item.shipmentNumber} · {item.customer}
                            </p>
                            <p className="mt-0.5">{item.issue}</p>
                            <p className="mt-0.5 font-semibold">
                              Impact: {formatMoney(item.amountImpact)}
                            </p>
                            <Link
                              href={item.ctaHref}
                              className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                            >
                              {item.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Tasks / Required Actions</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Auto-generated next actions from operational and financial exceptions.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {data.tasks.operations.length + data.tasks.finance.length}
              </span>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Operations</h3>
                <div className="mt-2 space-y-2">
                  {data.tasks.operations.length === 0 ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                      No pending operations tasks.
                    </p>
                  ) : (
                    data.tasks.operations.map((task) => (
                      <div key={task.id} className={`rounded-lg border px-2.5 py-2 text-xs ${statusClass(task.severity)}`}>
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="mt-0.5">{task.detail}</p>
                        <Link
                          href={task.ctaHref}
                          className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Finance</h3>
                <div className="mt-2 space-y-2">
                  {data.tasks.finance.length === 0 ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                      No pending finance tasks.
                    </p>
                  ) : (
                    data.tasks.finance.map((task) => (
                      <div key={task.id} className={`rounded-lg border px-2.5 py-2 text-xs ${statusClass(task.severity)}`}>
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="mt-0.5">{task.detail}</p>
                        <Link
                          href={task.ctaHref}
                          className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </article>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
              <Plus className="h-4 w-4 text-slate-400" />
            </div>
            <div className="grid gap-2">
              <Link
                href="/shipments/new"
                className="inline-flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
              >
                + New Shipment <PackagePlus className="h-4 w-4" />
              </Link>
              <Link
                href="/finance/invoices"
                className="inline-flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                + Create Invoice <CircleDollarSign className="h-4 w-4" />
              </Link>
              <Link
                href="/finance/ap"
                className="inline-flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                + Add Cost <Plus className="h-4 w-4" />
              </Link>
              <Link
                href="/customers/new"
                className="inline-flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
              >
                + New Customer <UserPlus className="h-4 w-4" />
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Recent Shipments</h2>
            <p className="mt-0.5 text-xs text-slate-500">Last 5 shipments edited.</p>
            <div className="mt-3 space-y-2">
              {data.quickActions.recentShipments.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  No recent shipments.
                </p>
              ) : (
                data.quickActions.recentShipments.map((item) => (
                  <Link
                    key={item.id}
                    href={`/shipments/${item.id}`}
                    className="block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 transition hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold text-slate-900">{item.shipmentNumber}</p>
                    <p className="text-xs text-slate-600">{item.customer}</p>
                    <p className="text-[11px] text-slate-500">
                      {getStatusLabel(item.status)} · {item.updatedAt.toLocaleString()}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Recent Invoices</h2>
            <p className="mt-0.5 text-xs text-slate-500">Last 5 invoices edited.</p>
            <div className="mt-3 space-y-2">
              {data.quickActions.recentInvoices.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  No recent invoices.
                </p>
              ) : (
                data.quickActions.recentInvoices.map((item) => (
                  <Link
                    key={item.id}
                    href={`/finance/invoices/${item.id}`}
                    className="block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 transition hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold text-slate-900">{item.invoiceNumber}</p>
                    <p className="text-xs text-slate-600">{item.customer}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.status} · {formatMoney(item.total)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Control objective</p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Prioritize today&apos;s incidents first, then recover margin and overdue cash.
                </p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
