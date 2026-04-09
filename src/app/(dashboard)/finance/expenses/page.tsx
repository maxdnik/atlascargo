import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource, GeneralExpenseCategory, GeneralExpenseStatus } from "@prisma/client";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { listGeneralExpenses } from "@/lib/finance";
import { canUser, getRequiredSession } from "@/lib/permissions";
import { deleteGeneralExpenseAction, upsertGeneralExpenseAction } from "@/app/(dashboard)/finance/actions";

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

function statusBadge(status: GeneralExpenseStatus) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-800";
}

async function submitGeneralExpense(formData: FormData) {
  "use server";
  await upsertGeneralExpenseAction({ success: false }, formData);
}

async function removeGeneralExpense(formData: FormData) {
  "use server";
  await deleteGeneralExpenseAction({ success: false }, formData);
}

type FinanceExpensesPageProps = {
  searchParams: Promise<{
    category?: string;
    status?: string;
    dueFrom?: string;
    dueTo?: string;
  }>;
};

export default async function FinanceExpensesPage({ searchParams }: FinanceExpensesPageProps) {
  const session = await getRequiredSession();
  const [canViewRevenue, canViewExpenses, canEditExpenses, canDeleteExpenses] = await Promise.all([
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
    canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.EXPENSES,
      PermissionAction.DELETE,
    ),
  ]);
  if (!canViewExpenses) {
    redirect("/finance");
  }

  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const expenses = await listGeneralExpenses(session.companyId);
  const { category, status, dueFrom, dueTo } = await searchParams;

  const dueFromDate = dueFrom ? new Date(dueFrom) : null;
  const dueToDate = dueTo ? new Date(dueTo) : null;
  const filtered = expenses.filter((row) => {
    if (category && row.conceptCategory !== category) return false;
    if (status && row.status !== status) return false;
    if (dueFromDate && row.dueDate && row.dueDate < dueFromDate) return false;
    if (dueToDate && row.dueDate && row.dueDate > dueToDate) return false;
    return true;
  });

  return (
    <FinanceShell
      title="General Expenses"
      subtitle="Overhead expenses not tied to a shipment file."
      navItems={navItems}
    >
      <section className="space-y-4">
        <form className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <label
                htmlFor="category"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={category ?? ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {Object.values(GeneralExpenseCategory).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="status"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {Object.values(GeneralExpenseStatus).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="dueFrom"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Due from
              </label>
              <input
                id="dueFrom"
                type="date"
                name="dueFrom"
                defaultValue={dueFrom ?? ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="dueTo"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Due to
              </label>
              <input
                id="dueTo"
                type="date"
                name="dueTo"
                defaultValue={dueTo ?? ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
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

        {canEditExpenses ? (
          <form action={submitGeneralExpense} className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add general expense</p>
            <div className="grid gap-3 md:grid-cols-3">
              <select name="conceptCategory" required className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {Object.values(GeneralExpenseCategory).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <input
                name="customConcept"
                placeholder="Custom concept (required if OTHER)"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="Amount"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select name="currencyCode" defaultValue="USD" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
              </select>
              <input name="dueDate" type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select name="status" defaultValue="PENDING" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {Object.values(GeneralExpenseStatus).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="notes"
              rows={2}
              placeholder="Internal notes / description"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              Save expense
            </button>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Custom concept</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Currency</th>
                  <th className="px-4 py-2.5">Due date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Notes</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                      No general expenses for selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">{row.conceptCategory}</td>
                      <td className="px-4 py-2.5">{row.customConcept ?? "-"}</td>
                      <td className="px-4 py-2.5">{formatMoney(row.amount)}</td>
                      <td className="px-4 py-2.5">{row.currencyCode}</td>
                      <td className="px-4 py-2.5">{formatDate(row.dueDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{row.notes ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-2">
                          {canEditExpenses ? (
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-sky-700 hover:text-sky-600">
                                Edit
                              </summary>
                              <form action={submitGeneralExpense} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <input type="hidden" name="id" value={row.id} />
                                <select
                                  name="conceptCategory"
                                  defaultValue={row.conceptCategory}
                                  required
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                >
                                  {Object.values(GeneralExpenseCategory).map((entry) => (
                                    <option key={entry} value={entry}>
                                      {entry}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  name="customConcept"
                                  defaultValue={row.customConcept ?? ""}
                                  placeholder="Custom concept"
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    defaultValue={row.amount}
                                    required
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  />
                                  <select
                                    name="currencyCode"
                                    defaultValue={row.currencyCode}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="ARS">ARS</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    name="dueDate"
                                    type="date"
                                    defaultValue={row.dueDate ? row.dueDate.toISOString().slice(0, 10) : ""}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  />
                                  <select
                                    name="status"
                                    defaultValue={row.status}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                  >
                                    {Object.values(GeneralExpenseStatus).map((entry) => (
                                      <option key={entry} value={entry}>
                                        {entry}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <textarea
                                  name="notes"
                                  rows={2}
                                  defaultValue={row.notes ?? ""}
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white"
                                >
                                  Update
                                </button>
                              </form>
                            </details>
                          ) : null}
                          {canDeleteExpenses ? (
                            <form action={removeGeneralExpense}>
                              <input type="hidden" name="id" value={row.id} />
                              <button
                                type="submit"
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </form>
                          ) : null}
                        </div>
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
