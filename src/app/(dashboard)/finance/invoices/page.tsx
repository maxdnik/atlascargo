import Link from "next/link";
import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { listInvoicesForAr } from "@/lib/finance";
import { canUser, getRequiredSession } from "@/lib/permissions";
import {
  cancelFinanceInvoiceAction,
  createFinanceInvoiceAction,
  deleteFinanceInvoiceAction,
  issueFinanceInvoiceAfipAction,
  registerFinanceInvoicePaymentAction,
} from "@/app/(dashboard)/finance/actions";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/app/(dashboard)/finance/invoices/invoice-form";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function dateLabel(value: Date | null) {
  return value ? value.toLocaleDateString() : "-";
}

function statusBadge(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "ISSUED") return "bg-sky-100 text-sky-700";
  if (status === "READY_TO_ISSUE") return "bg-amber-100 text-amber-800";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default async function FinanceInvoicesPage() {
  const session = await getRequiredSession();
  const [canViewRevenue, canViewExpenses, canCreateRevenue, canEditRevenue, canDeleteRevenue] =
    await Promise.all([
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
        PermissionAction.CREATE,
      ),
      canUser(
        { id: session.userId, role: session.role, companyId: session.companyId },
        PermissionResource.REVENUE,
        PermissionAction.EDIT,
      ),
      canUser(
        { id: session.userId, role: session.role, companyId: session.companyId },
        PermissionResource.REVENUE,
        PermissionAction.DELETE,
      ),
    ]);

  if (!canViewRevenue) {
    redirect("/finance");
  }

  const [invoices, shipments] = await Promise.all([
    listInvoicesForAr(session.companyId),
    prisma.shipment.findMany({
      where: {
        companyId: session.companyId,
      },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        customer: {
          select: {
            legalName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    }),
  ]);

  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });
  const issueInvoice = async (formData: FormData) => {
    "use server";
    await issueFinanceInvoiceAfipAction({ success: false }, formData);
  };
  const markPaid = async (formData: FormData) => {
    "use server";
    await registerFinanceInvoicePaymentAction({ success: false }, formData);
  };
  const cancelInvoice = async (formData: FormData) => {
    "use server";
    await cancelFinanceInvoiceAction({ success: false }, formData);
  };
  const deleteInvoice = async (formData: FormData) => {
    "use server";
    await deleteFinanceInvoiceAction({ success: false }, formData);
  };

  return (
    <FinanceShell
      title="Invoices"
      subtitle="Shipment-linked invoices with AFIP issuance controls."
      navItems={navItems}
    >
      {canCreateRevenue ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Create invoice</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Invoice belongs to one shipment and auto-links customer from shipment.
          </p>
          <div className="mt-3">
            <InvoiceForm
              mode="create"
              shipments={shipments.map((shipment) => ({
                id: shipment.id,
                shipmentNumber: shipment.shipmentNumber,
                customerName: shipment.customer.legalName,
                status: shipment.status,
              }))}
              submitAction={createFinanceInvoiceAction}
              submitLabel="Create invoice"
            />
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Shipment</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Currency</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Due date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">AFIP</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={9}>
                    No invoices available.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-2.5">{invoice.shipmentNumber}</td>
                    <td className="px-4 py-2.5">{invoice.customerName}</td>
                    <td className="px-4 py-2.5">{invoice.currencyCode}</td>
                    <td className="px-4 py-2.5">{money(invoice.total)}</td>
                    <td className="px-4 py-2.5">{dateLabel(invoice.dueDate)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(
                          invoice.status,
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {invoice.afipStatus ?? "NOT_ISSUED"}
                      {invoice.afipCAE ? ` · CAE ${invoice.afipCAE}` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Detail
                        </Link>
                        {canEditRevenue ? (
                          <form action={issueInvoice}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                            >
                              Issue AFIP
                            </button>
                          </form>
                        ) : null}
                        {canEditRevenue ? (
                          <form action={markPaid}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="amount" value={invoice.total.toFixed(2)} />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                            >
                              Register payment
                            </button>
                          </form>
                        ) : null}
                        {canEditRevenue ? (
                          <form action={cancelInvoice}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : null}
                        {canDeleteRevenue ? (
                          <form action={deleteInvoice}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
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
      </section>
    </FinanceShell>
  );
}
