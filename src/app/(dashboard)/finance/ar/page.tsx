import Link from "next/link";
import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { getFinanceModuleData } from "@/lib/finance";
import { canUser, getRequiredSession } from "@/lib/permissions";

type AccountsReceivablePageProps = {
  searchParams: Promise<{
    overdue?: string;
    customerId?: string;
  }>;
};

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
  if (status === "ISSUED") return "bg-sky-100 text-sky-700";
  if (status === "READY_TO_ISSUE") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function AccountsReceivablePage({ searchParams }: AccountsReceivablePageProps) {
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
  if (!canViewRevenue) {
    redirect("/finance");
  }

  const { overdue, customerId } = await searchParams;
  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const showOnlyOverdue = overdue === "only";
  const filteredRows = data.accountsReceivable.filter((row) => {
    if (showOnlyOverdue && row.daysOverdue <= 0) return false;
    if (customerId && row.customerId !== customerId) return false;
    return true;
  });

  return (
    <FinanceShell
      title="Accounts Receivable"
      subtitle="Customer invoices linked to shipments, with overdue and AFIP controls."
      navItems={navItems}
    >
      <section className="space-y-3">
        <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
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
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                      No AR records for current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">{row.customer}</td>
                      <td className="px-4 py-2.5">{row.shipment}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        <Link href={`/finance/invoices/${row.invoiceId}`} className="hover:text-sky-700">
                          {row.invoice}
                        </Link>
                        <div className="mt-1 text-[11px] text-slate-500">
                          AFIP: {row.afipStatus ?? "PENDING"}
                          {row.afipCAE ? ` · CAE ${row.afipCAE}` : ""}
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
        </div>
      </section>
    </FinanceShell>
  );
}
