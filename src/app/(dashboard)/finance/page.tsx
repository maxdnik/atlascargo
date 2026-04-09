import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  HandCoins,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { getFinanceModuleData } from "@/lib/finance";
import { canUser, getRequiredSession } from "@/lib/permissions";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function FinanceOverviewPage() {
  const session = await getRequiredSession();
  const [canViewRevenue, canViewExpenses] = await Promise.all([
    canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.REVENUE,
      PermissionAction.VIEW,
    ),
    canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.EXPENSES,
      PermissionAction.VIEW,
    ),
  ]);
  if (!canViewRevenue && !canViewExpenses) {
    redirect("/dashboard");
  }

  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const filteredAlerts = data.alerts.filter((alert) => {
    if (canViewRevenue && canViewExpenses) return true;
    if (canViewRevenue) return alert.kind === "overdue-invoice";
    return false;
  });

  return (
    <FinanceShell
      title="Finance Overview"
      subtitle="Shipment financials plus overhead control in one operational board."
      navItems={navItems}
    >
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <ArrowUpToLine className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue (current month)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewRevenue ? formatMoney(data.overview.revenueCurrentMonth) : "Restricted"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-rose-50 p-2 text-rose-600">
              <ArrowDownToLine className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shipment costs (current month)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewExpenses ? formatMoney(data.overview.shipmentCostsCurrentMonth) : "Restricted"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-violet-50 p-2 text-violet-700">
              <HandCoins className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              General overhead (current month)
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewExpenses ? formatMoney(data.overview.generalOverheadCurrentMonth) : "Restricted"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-sky-50 p-2 text-sky-600">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gross margin
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewRevenue && canViewExpenses
                ? formatMoney(data.overview.grossMargin)
                : "Restricted"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canViewRevenue && canViewExpenses
                ? formatPct(data.overview.grossMarginPct)
                : "Requires revenue + costs access"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div
              className={`inline-flex rounded-xl p-2 ${
                data.overview.netOperatingResult >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {data.overview.netOperatingResult >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Net operating result
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatMoney(data.overview.netOperatingResult)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-amber-50 p-2 text-amber-600">
              <Wallet className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Accounts receivable
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewRevenue ? formatMoney(data.overview.accountsReceivable) : "Restricted"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="inline-flex rounded-xl bg-violet-50 p-2 text-violet-600">
              <HandCoins className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Accounts payable
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {canViewExpenses ? formatMoney(data.overview.accountsPayable) : "Restricted"}
            </p>
          </article>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Top shipments by margin</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Highest gross profit files based on recorded revenue and costs.
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Shipment</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Margin</th>
                  <th className="px-4 py-2.5">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {!canViewRevenue || !canViewExpenses ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      Requires revenue and expense access.
                    </td>
                  </tr>
                ) : data.topShipmentsByMargin.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      No complete profitability data yet.
                    </td>
                  </tr>
                ) : (
                  data.topShipmentsByMargin.map((row) => (
                    <tr key={row.shipmentId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.shipmentNumber}</td>
                      <td className="px-4 py-2.5">{row.customer}</td>
                      <td className="px-4 py-2.5">{formatMoney(row.margin)}</td>
                      <td className="px-4 py-2.5">{formatPct(row.marginPct)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Alerts</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Missing costs/revenue, overdue invoices, and negative margin shipments.
            </p>
            <ul className="mt-3 space-y-2">
              {filteredAlerts.length === 0 ? (
                <li className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  No active finance alerts.
                </li>
              ) : (
                filteredAlerts.map((alert, index) => (
                  <li
                    key={`${alert.kind}-${index}`}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      alert.kind === "negative-margin"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : alert.kind === "overdue-invoice"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-xs opacity-90">{alert.detail}</p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </section>
    </FinanceShell>
  );
}
