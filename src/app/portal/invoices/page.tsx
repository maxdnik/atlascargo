import Link from "next/link";

import { getRequiredPortalSession, listPortalInvoices } from "@/lib/portal";

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

function invoiceStatusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "ISSUED") return "bg-sky-100 text-sky-700";
  if (status === "READY_TO_ISSUE") return "bg-amber-100 text-amber-800";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default async function PortalInvoicesPage() {
  const session = await getRequiredPortalSession();
  const invoices = await listPortalInvoices(session);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-600">
          Customer-facing AR view with issued amounts, paid amounts, and outstanding balances.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Shipment</th>
              <th className="px-4 py-3">Issue date</th>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Outstanding</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Open shipment</th>
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
                <tr key={invoice.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3">{invoice.shipmentNumber}</td>
                  <td className="px-4 py-3">{dateLabel(invoice.issueDate)}</td>
                  <td className="px-4 py-3">{dateLabel(invoice.dueDate)}</td>
                  <td className="px-4 py-3">
                    {money(invoice.total)} {invoice.currencyCode}
                  </td>
                  <td className="px-4 py-3">{money(invoice.paidAmount)}</td>
                  <td className="px-4 py-3">{money(invoice.outstandingAmount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass(
                        invoice.status,
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/shipments/${invoice.shipmentId}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
