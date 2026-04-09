import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { FinanceShell } from "@/components/finance/finance-shell";
import { getFinanceModuleData } from "@/lib/finance";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { canUser, getRequiredSession } from "@/lib/permissions";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString();
}

export default async function FinanceForecastPage() {
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
      const cumulativeBalance =
        net +
        allRows.slice(0, index).reduce((sum, prev) => {
          return sum + (prev.expectedInflows - prev.expectedOutflows);
        }, 0);
      return {
        ...row,
        net,
        cumulativeBalance,
      };
    });

  return (
    <FinanceShell
      title="Cash Forecast"
      subtitle="Daily expected inflows and outflows from AR invoices, shipment costs, and overhead."
      navItems={navItems}
    >
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Daily cash forecast</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Negative net and cumulative balance are highlighted; overhead outflows are included.
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
                                  <td className="px-2 py-1">
                                    {movement.shipmentNumber === "OVERHEAD" ? "-" : movement.shipmentNumber}
                                  </td>
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
    </FinanceShell>
  );
}
