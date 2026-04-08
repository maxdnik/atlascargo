import Link from "next/link";
import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Banknote,
  HandCoins,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { canUser, getRequiredSession } from "@/lib/permissions";
import { getFinanceModuleData } from "@/lib/finance";

type FinancePageProps = {
  searchParams: Promise<{
    tab?: string;
    overdue?: string;
    customerId?: string;
  }>;
};

type FinanceTab = "overview" | "forecast" | "profitability" | "ar" | "ap";

const TAB_ITEMS: Array<{ id: FinanceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "forecast", label: "Cash Forecast" },
  { id: "profitability", label: "Shipment Profitability" },
  { id: "ar", label: "Accounts Receivable" },
  { id: "ap", label: "Accounts Payable" },
];

function resolveTab(tab: string | undefined): FinanceTab {
  if (tab === "forecast") return tab;
  if (tab === "profitability") return tab;
  if (tab === "ar") return tab;
  if (tab === "ap") return tab;
  return "overview";
}

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

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString();
}

function statusBadge(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "OVERDUE") return "bg-rose-100 text-rose-700";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
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

  const { tab, overdue, customerId } = await searchParams;
  const requestedTab = resolveTab(tab);
  const availableTabs = TAB_ITEMS.filter((item) => {
    if (item.id === "overview") return true;
    if (item.id === "forecast") return canViewRevenue || canViewExpenses;
    if (item.id === "profitability") return canViewRevenue && canViewExpenses;
    if (item.id === "ar") return canViewRevenue;
    if (item.id === "ap") return canViewExpenses;
    return false;
  });

  const activeTab = availableTabs.some((item) => item.id === requestedTab)
    ? requestedTab
    : availableTabs[0]?.id ?? "overview";
  if (activeTab !== requestedTab) {
    redirect(`/finance?tab=${activeTab}`);
  }

  const data = await getFinanceModuleData(session.companyId);
  const filteredAlerts = data.alerts.filter((alert) => {
    if (canViewRevenue && canViewExpenses) return true;
    if (canViewRevenue) return alert.kind === "overdue-invoice";
    return false;
  });

  const showOnlyOverdue = overdue === "only";
  const filteredAR = data.accountsReceivable.filter((row) => {
    if (showOnlyOverdue && row.daysOverdue <= 0) return false;
    if (customerId && row.customerId !== customerId) return false;
    return true;
  });

  const cashForecast = data.cashForecast
    .map((row) => ({
      ...row,
      expectedInflows: canViewRevenue ? row.expectedInflows : 0,
      expectedOutflows: canViewExpenses ? row.expectedOutflows : 0,
      detail: row.detail.filter(
        (movement) =>
          (movement.type === "INFLOW" && canViewRevenue) ||
          (movement.type === "OUTFLOW" && canViewExpenses),
      ),
    }))
    .map((row, index, allRows) => {
      const net = row.expectedInflows - row.expectedOutflows;
      const cumulativeBalance = net + allRows.slice(0, index).reduce((sum, prev) => {
        return sum + (prev.expectedInflows - prev.expectedOutflows);
      }, 0);
      return {
        ...row,
        net,
        cumulativeBalance,
      };
    });

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Finance Control Center
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Structured financial operations connected directly to shipment files.
            </p>
          </div>
        </div>
      </header>

      <nav className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <ul className="flex flex-wrap gap-1">
          {availableTabs.map((item) => {
            const isActive = item.id === activeTab;
            return (
              <li key={item.id}>
                <Link
                  href={`/finance?tab=${item.id}`}
                  className={`inline-flex rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeTab === "overview" ? (
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
                Costs (current month)
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {canViewExpenses ? formatMoney(data.overview.costsCurrentMonth) : "Restricted"}
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
                  data.overview.netCashFlow >= 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.overview.netCashFlow >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Net cash flow
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatMoney(
                  (canViewRevenue ? data.overview.netCashFlow + 0 : 0) -
                    (canViewExpenses ? 0 : 0),
                )}
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
      ) : null}

      {activeTab === "forecast" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Daily cash forecast</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Based on AR/AP invoices, vendor costs, expected dates and registered payments.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Expected inflows</th>
                  <th className="px-4 py-2.5">Expected outflows</th>
                  <th className="px-4 py-2.5">Net</th>
                  <th className="px-4 py-2.5">Cumulative balance</th>
                  <th className="px-4 py-2.5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {cashForecast.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No forecast transactions available.
                    </td>
                  </tr>
                ) : (
                  cashForecast.map((row) => (
                    <tr key={row.date.toISOString()} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-emerald-700">{formatMoney(row.expectedInflows)}</td>
                      <td className="px-4 py-2.5 text-rose-700">{formatMoney(row.expectedOutflows)}</td>
                      <td
                        className={`px-4 py-2.5 font-medium ${
                          row.net < 0 ? "text-rose-700" : "text-slate-900"
                        }`}
                      >
                        {formatMoney(row.net)}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-medium ${
                          row.cumulativeBalance < 0 ? "bg-rose-50 text-rose-700" : "text-slate-900"
                        }`}
                      >
                        {formatMoney(row.cumulativeBalance)}
                      </td>
                      <td className="px-4 py-2.5">
                        <details className="group max-w-md">
                          <summary className="cursor-pointer text-xs font-medium text-sky-700 hover:text-sky-600">
                            Expand day
                          </summary>
                          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <table className="min-w-full text-xs">
                              <thead className="text-slate-500">
                                <tr>
                                  <th className="px-2 py-1 text-left">Type</th>
                                  <th className="px-2 py-1 text-left">Shipment</th>
                                  <th className="px-2 py-1 text-left">Party</th>
                                  <th className="px-2 py-1 text-left">Reference</th>
                                  <th className="px-2 py-1 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.detail.map((movement) => (
                                  <tr key={movement.id} className="border-t border-slate-200">
                                    <td className="px-2 py-1">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 ${
                                          movement.type === "INFLOW"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-rose-100 text-rose-700"
                                        }`}
                                      >
                                        {movement.type}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1">{movement.shipmentNumber}</td>
                                    <td className="px-2 py-1">{movement.party}</td>
                                    <td className="px-2 py-1">{movement.reference}</td>
                                    <td className="px-2 py-1 text-right">{formatMoney(movement.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "profitability" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Shipment profitability</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Revenue, cost and margin by shipment file linked through shipmentId.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Shipment</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Revenue</th>
                  <th className="px-4 py-2.5">Cost</th>
                  <th className="px-4 py-2.5">Margin</th>
                  <th className="px-4 py-2.5">Margin %</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {data.shipmentProfitability.map((row) => (
                  <tr key={row.shipmentId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <Link href={`/shipments/${row.shipmentId}`} className="hover:text-sky-700">
                        {row.shipmentNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{row.customer}</td>
                    <td className="px-4 py-2.5">{formatMoney(row.revenue)}</td>
                    <td className="px-4 py-2.5">{formatMoney(row.cost)}</td>
                    <td className={`px-4 py-2.5 font-medium ${row.margin < 0 ? "text-rose-700" : "text-slate-900"}`}>
                      {formatMoney(row.margin)}
                    </td>
                    <td
                      className={`px-4 py-2.5 ${
                        row.incomplete
                          ? "text-slate-500"
                          : row.marginPct < 10
                            ? "font-semibold text-amber-700"
                            : "text-slate-900"
                      }`}
                    >
                      {row.incomplete ? "Incomplete" : formatPct(row.marginPct)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "ar" ? (
        <section className="space-y-3">
          <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <input type="hidden" name="tab" value="ar" />
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label
                  htmlFor="overdue"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Overdue filter
                </label>
                <select
                  id="overdue"
                  name="overdue"
                  defaultValue={overdue ?? "all"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
                >
                  <option value="all">All invoices</option>
                  <option value="only">Overdue only</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="customerId"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Customer
                </label>
                <select
                  id="customerId"
                  name="customerId"
                  defaultValue={customerId ?? ""}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
                >
                  <option value="">All customers</option>
                  {data.arCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Apply filters
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Shipment</th>
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Due date</th>
                    <th className="px-4 py-2.5">Days overdue</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredAR.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                        No AR records for current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAR.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5">{row.customer}</td>
                        <td className="px-4 py-2.5">{row.shipment}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          <Link href={`/invoices/${row.invoiceId}`} className="hover:text-sky-700">
                            {row.invoice}
                          </Link>
                          <div className="mt-1 text-[11px] text-slate-500">
                            AFIP: {row.afipStatus ?? "PENDING"}{row.afipCAE ? ` · CAE ${row.afipCAE}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">{formatMoney(row.amount)}</td>
                        <td className="px-4 py-2.5">{formatDate(row.dueDate)}</td>
                        <td
                          className={`px-4 py-2.5 ${
                            row.daysOverdue > 0 ? "font-medium text-rose-700" : "text-slate-700"
                          }`}
                        >
                          {row.daysOverdue}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "ap" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Accounts payable</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Vendor obligations from AP invoices and shipment-linked costs.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5">Shipment</th>
                  <th className="px-4 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Due date</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {data.accountsPayable.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No AP records available.
                    </td>
                  </tr>
                ) : (
                  data.accountsPayable.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">{row.vendor}</td>
                      <td className="px-4 py-2.5">{row.shipment}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.reference}</td>
                      <td className="px-4 py-2.5">{formatMoney(row.amount)}</td>
                      <td className="px-4 py-2.5">{formatDate(row.dueDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
