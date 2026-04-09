import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import {
  cancelFinanceInvoiceAction,
  issueFinanceInvoiceAfipAction,
  markFinanceInvoicePaidAction,
} from "@/app/(dashboard)/finance/actions";
import { FinanceInvoiceEditor } from "@/components/finance/invoice-editor";
import { FinanceShell } from "@/components/finance/finance-shell";
import { resolveFinanceNavItems } from "@/lib/finance-navigation";
import { getInvoiceById } from "@/lib/invoices";
import { canUser, getRequiredSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type FinanceInvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function dateLabel(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString();
}

function statusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "ISSUED") return "bg-sky-100 text-sky-700";
  if (status === "READY_TO_ISSUE") return "bg-amber-100 text-amber-800";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default async function FinanceInvoiceDetailPage({ params }: FinanceInvoiceDetailPageProps) {
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
    redirect("/dashboard");
  }

  const canEditRevenue = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.EDIT,
  );
  const issueInvoiceAfip = async (formData: FormData) => {
    "use server";
    const result = await issueFinanceInvoiceAfipAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to issue invoice in AFIP");
    }
  };
  const markInvoicePaid = async (formData: FormData) => {
    "use server";
    const result = await markFinanceInvoicePaidAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to mark invoice paid");
    }
  };
  const cancelInvoice = async (formData: FormData) => {
    "use server";
    const result = await cancelFinanceInvoiceAction({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? "Unable to cancel invoice");
    }
  };

  const { id } = await params;
  const invoice = await getInvoiceById(session.companyId, id);
  if (!invoice) {
    notFound();
  }

  const shipments = await prisma.shipment.findMany({
    where: {
      companyId: session.companyId,
      status: {
        in: ["CLOSED", "DELIVERED"],
      },
    },
    select: {
      id: true,
      shipmentNumber: true,
      customer: {
        select: {
          legalName: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  const navItems = resolveFinanceNavItems({ canViewRevenue, canViewExpenses });

  return (
    <FinanceShell
      title={`Invoice ${invoice.invoiceNumber}`}
      subtitle="AFIP-ready invoice detail with shipment/customer linkage and operational controls."
      navItems={navItems}
    >
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice detail</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{invoice.invoiceNumber}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Shipment{" "}
                <Link
                  href={`/shipments/${invoice.shipmentId}`}
                  className="font-medium text-sky-700 hover:text-sky-600"
                >
                  {invoice.shipment.shipmentNumber}
                </Link>{" "}
                · Customer {invoice.customer.legalName}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(
                invoice.status,
              )}`}
            >
              {invoice.status}
            </span>
          </div>

          {canEditRevenue ? (
            <div className="mt-4">
              <FinanceInvoiceEditor
                mode="edit"
                shipments={shipments.map((shipment) => ({
                  id: shipment.id,
                  shipmentNumber: shipment.shipmentNumber,
                  customerName: shipment.customer.legalName,
                }))}
                initialValue={{
                  invoiceId: invoice.id,
                  shipmentId: invoice.shipmentId,
                  invoiceNumber: invoice.invoiceNumber,
                  currencyCode: invoice.currencyCode,
                  issueDate: invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : "",
                  dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "",
                  notes: invoice.notes ?? "",
                  lines: invoice.lines.map((line) => ({
                    description: line.description,
                    amount: Number(line.amount),
                    type: line.type,
                  })),
                }}
              />
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Breakdown</h3>
            {invoice.lines.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No lines configured.
              </p>
            ) : (
              <table className="mt-3 min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5">{line.description}</td>
                      <td className="px-3 py-2.5">{line.type}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{money(Number(line.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Totals</h3>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>
                Subtotal: <span className="font-semibold text-slate-900">{money(Number(invoice.subtotal))}</span>
              </p>
              <p>
                Taxes: <span className="font-semibold text-slate-900">{money(Number(invoice.taxes))}</span>
              </p>
              <p>
                Total: <span className="font-semibold text-slate-900">{money(Number(invoice.total))}</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">AFIP</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>Status: {invoice.afipStatus ?? "NOT_ISSUED"}</p>
              <p>CAE: {invoice.afipCAE ?? "-"}</p>
              <p>AFIP Number: {invoice.afipNumber ?? "-"}</p>
              <p>Issue date: {dateLabel(invoice.issueDate)}</p>
              <p>Due date: {dateLabel(invoice.dueDate)}</p>
            </div>
            {invoice.status !== "ISSUED" ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                Warning: invoice exists but is not issued in AFIP.
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Notes</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{invoice.notes ?? "-"}</p>
          </div>

          {canEditRevenue ? (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <form action={issueInvoiceAfip}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Issue AFIP
                </button>
              </form>
              <form action={markInvoicePaid}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Mark paid
                </button>
              </form>
              <form action={cancelInvoice}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                >
                  Cancel
                </button>
              </form>
            </div>
          ) : null}
        </aside>
      </div>
    </FinanceShell>
  );
}
