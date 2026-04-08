import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function FinanceProfitabilityPage() {
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
  if (!canViewRevenue || !canViewExpenses) {
    redirect("/finance");
  }

  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });

  return (
    <FinanceShell
      title="Shipment Profitability"
      subtitle="Revenue, cost, margin and completion quality per shipment."
      navItems={navItems}
    >
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Shipment profitability</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Margin under 10% is highlighted; missing financial data is marked as incomplete.
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
                  <td
                    className={`px-4 py-2.5 font-medium ${
                      row.margin < 0 ? "text-rose-700" : "text-slate-900"
                    }`}
                  >
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
    </FinanceShell>
  );
}
