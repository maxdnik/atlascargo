import Link from "next/link";
import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { registerFinanceInvoicePaymentAction } from "@/app/(dashboard)/finance/actions";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { getFinanceModuleData } from "@/lib/finance";
import { canUser, getRequiredSession } from "@/lib/permissions";

type AccountsReceivablePageProps = {
  searchParams: Promise<{
    overdue?: string;
    customerId?: string;
    status?: string;
    agingBucket?: string;
  }>;
};

function formatMoney(value: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString();
}

function statusBadge(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIALLY_PAID") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function agingBucketLabel(bucket: string) {
  if (bucket === "CURRENT") return "Current";
  if (bucket === "OVERDUE_0_30") return "0-30";
  if (bucket === "OVERDUE_31_60") return "31-60";
  if (bucket === "OVERDUE_61_90") return "61-90";
  return "90+";
}

export default async function AccountsReceivablePage({ searchParams }: AccountsReceivablePageProps) {
  const session = await getRequiredSession();
  const [canViewRevenue, canViewExpenses, canEditRevenue] = await Promise.all([
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
    canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.REVENUE,
      PermissionAction.EDIT,
    ),
  ]);
  if (!canViewRevenue) {
    redirect("/finance");
  }

  const { overdue, customerId, status, agingBucket } = await searchParams;
  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const showOnlyOverdue = overdue === "only";
  const showOnlyCurrent = overdue === "current";
  const statusFilter = status ?? "all";
  const agingFilter = agingBucket ?? "all";
  const filteredRows = data.accountsReceivable.filter((row) => {
    if (showOnlyOverdue && !row.overdueFlag) return false;
    if (showOnlyCurrent && row.overdueFlag) return false;
    if (customerId && row.customerId !== customerId) return false;
    if (statusFilter !== "all" && row.paymentStatus !== statusFilter) return false;
    if (agingFilter !== "all" && row.agingBucket !== agingFilter) return false;
    return true;
  });
  const registerInvoicePayment = async (formData: FormData) => {
    "use server";
    const result = await registerFinanceInvoicePaymentAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to register payment");
    }
  };

  return (
    <FinanceShell
      title="Accounts Receivable"
      subtitle="Customer invoices linked to shipments, with overdue and AFIP controls."
      navItems={navItems}
    >
      <section className="space-y-3">
        <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
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
                <option value="current">Current only</option>
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
            <div>
              <label
                htmlFor="status"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Payment status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? "all"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
              >
                <option value="all">All</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="agingBucket"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Aging bucket
              </label>
              <select
                id="agingBucket"
                name="agingBucket"
                defaultValue={agingBucket ?? "all"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
              >
                <option value="all">All buckets</option>
                <option value="CURRENT">Current</option>
                <option value="OVERDUE_0_30">0-30</option>
                <option value="OVERDUE_31_60">31-60</option>
                <option value="OVERDUE_61_90">61-90</option>
                <option value="OVERDUE_90_PLUS">90+</option>
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
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Paid</th>
                  <th className="px-4 py-2.5">Outstanding</th>
                  <th className="px-4 py-2.5">Due date</th>
                  <th className="px-4 py-2.5">Aging</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
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
                        <div className="mt-1 text-[11px] text-slate-500">
                          Invoice status: {row.invoiceStatus}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{formatMoney(row.totalAmount, row.currencyCode)}</td>
                      <td className="px-4 py-2.5">{formatMoney(row.paidAmount, row.currencyCode)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {formatMoney(row.outstandingAmount, row.currencyCode)}
                      </td>
                      <td className="px-4 py-2.5">{formatDate(row.dueDate)}</td>
                      <td className={`px-4 py-2.5 ${row.overdueFlag ? "font-medium text-rose-700" : ""}`}>
                        {agingBucketLabel(row.agingBucket)}
                        {row.overdueFlag ? ` · ${row.overdueDays}d` : ""}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(
                            row.paymentStatus,
                          )}`}
                        >
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {canEditRevenue && row.outstandingAmount > 0 ? (
                          <form action={registerInvoicePayment} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="invoiceId" value={row.invoiceId} />
                            <input
                              type="number"
                              name="amount"
                              min="0.01"
                              step="0.01"
                              max={row.outstandingAmount.toFixed(2)}
                              placeholder={row.outstandingAmount.toFixed(2)}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <input
                              type="date"
                              name="paymentDate"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                            >
                              Register
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
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
