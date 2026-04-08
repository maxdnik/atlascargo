import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { listInvoicesForAr } from "@/lib/finance";
import { enforcePagePermission } from "@/lib/permissions";

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

export default async function InvoicesPage() {
  const session = await enforcePagePermission(PermissionResource.REVENUE, PermissionAction.VIEW);
  const invoices = await listInvoicesForAr(session.companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shipment-linked AR invoices with AFIP operational status.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Shipment</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Issue date</th>
                <th className="px-4 py-2.5">Due date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">AFIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    No invoices available.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <Link href={`/invoices/${invoice.id}`} className="hover:text-sky-700">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{invoice.shipmentNumber}</td>
                    <td className="px-4 py-2.5">{invoice.customerName}</td>
                    <td className="px-4 py-2.5">{money(invoice.total)}</td>
                    <td className="px-4 py-2.5">{dateLabel(invoice.issueDate)}</td>
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
                      {invoice.afipStatus ?? "PENDING"}
                      {invoice.afipCAE ? ` · CAE ${invoice.afipCAE}` : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
