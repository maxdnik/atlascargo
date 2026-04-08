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

function statusBadge(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "OVERDUE") return "bg-rose-100 text-rose-700";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

export default async function FinanceAccountsPayablePage() {
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
  if (!canViewExpenses) {
    redirect("/finance");
  }

  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });

  return (
    <FinanceShell
      title="Accounts Payable"
      subtitle="Vendor obligations from shipment costs and general overhead expenses."
      navItems={navItems}
    >
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Accounts payable</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Includes shipment-linked vendor costs and general overhead liabilities.
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
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(
                          row.status,
                        )}`}
                      >
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
    </FinanceShell>
  );
}
