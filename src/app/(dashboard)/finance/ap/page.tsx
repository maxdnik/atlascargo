import { redirect } from "next/navigation";
import { PaymentEntityType, PermissionAction, PermissionResource } from "@prisma/client";
import {
  registerFinanceExpensePaymentAction,
  registerFinanceGeneralExpensePaymentAction,
  registerFinanceShipmentCostPaymentAction,
} from "@/app/(dashboard)/finance/actions";
import { FinanceShell } from "@/components/finance/finance-shell";
import { getFinanceModuleData } from "@/lib/finance";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { canUser, getRequiredSession } from "@/lib/permissions";

type AccountsPayablePageProps = {
  searchParams: Promise<{
    status?: string;
    overdue?: string;
    aging?: string;
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

export default async function FinanceAccountsPayablePage({ searchParams }: AccountsPayablePageProps) {
  const session = await getRequiredSession();
  const [canViewRevenue, canViewExpenses, canEditExpenses] = await Promise.all([
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
      PermissionResource.EXPENSES,
      PermissionAction.EDIT,
    ),
  ]);
  if (!canViewExpenses) {
    redirect("/finance");
  }

  const filters = await searchParams;
  const data = await getFinanceModuleData(session.companyId);
  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const status = filters.status ?? "all";
  const overdue = filters.overdue ?? "all";
  const aging = filters.aging ?? "all";
  const filteredRows = data.accountsPayable.filter((row) => {
    if (status !== "all" && row.paymentStatus !== status) return false;
    if (overdue === "only" && !row.overdueFlag) return false;
    if (aging !== "all" && row.agingBucket !== aging) return false;
    return true;
  });
  const registerShipmentCostPayment = async (formData: FormData) => {
    "use server";
    const result = await registerFinanceShipmentCostPaymentAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to register shipment cost payment");
    }
  };
  const registerGeneralExpensePayment = async (formData: FormData) => {
    "use server";
    const result = await registerFinanceGeneralExpensePaymentAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to register general expense payment");
    }
  };
  const registerShipmentExpensePayment = async (formData: FormData) => {
    "use server";
    const result = await registerFinanceExpensePaymentAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to register shipment expense payment");
    }
  };

  return (
    <FinanceShell
      title="Accounts Payable"
      subtitle="Vendor obligations from shipment costs and general overhead expenses."
      navItems={navItems}
    >
      <section className="space-y-3">
        <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
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
                defaultValue={status}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
              >
                <option value="all">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="overdue"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Overdue
              </label>
              <select
                id="overdue"
                name="overdue"
                defaultValue={overdue}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
              >
                <option value="all">All payables</option>
                <option value="only">Overdue only</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="aging"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Aging bucket
              </label>
              <select
                id="aging"
                name="aging"
                defaultValue={aging}
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
      </section>
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
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Paid</th>
                <th className="px-4 py-2.5">Outstanding</th>
                <th className="px-4 py-2.5">Due date</th>
                <th className="px-4 py-2.5">Overdue days</th>
                <th className="px-4 py-2.5">Aging</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                    No AP records available.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">{row.vendor}</td>
                    <td className="px-4 py-2.5">{row.shipment}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.reference}</td>
                    <td className="px-4 py-2.5">{formatMoney(row.totalAmount, row.currencyCode)}</td>
                    <td className="px-4 py-2.5 text-emerald-700">
                      {formatMoney(row.paidAmount, row.currencyCode)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {formatMoney(row.outstandingAmount, row.currencyCode)}
                    </td>
                    <td className="px-4 py-2.5">{formatDate(row.dueDate)}</td>
                    <td
                      className={`px-4 py-2.5 ${
                        row.overdueFlag ? "font-medium text-rose-700" : "text-slate-700"
                      }`}
                    >
                      {row.overdueDays}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                      {agingBucketLabel(row.agingBucket)}
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
                      {canEditExpenses && row.outstandingAmount > 0 ? (
                        <form
                          action={
                            row.entityType === PaymentEntityType.SHIPMENT_COST
                              ? registerShipmentCostPayment
                              : row.entityType === PaymentEntityType.EXPENSE
                                ? registerShipmentExpensePayment
                                : registerGeneralExpensePayment
                          }
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="entityId" value={row.entityId} />
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={row.outstandingAmount.toFixed(2)}
                            name="amount"
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
      </section>
    </FinanceShell>
  );
}
