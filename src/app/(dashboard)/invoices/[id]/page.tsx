import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { enforcePagePermission } from "@/lib/permissions";
import { getInvoiceById } from "@/lib/invoices";

type InvoiceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
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

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const session = await enforcePagePermission(PermissionResource.REVENUE, PermissionAction.VIEW);
  const { id } = await params;
  const invoice = await getInvoiceById(session.companyId, id);
  if (!invoice) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice detail</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{invoice.invoiceNumber}</h1>
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
          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(invoice.status)}`}>
            {invoice.status}
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Breakdown</h2>
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
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Totals</h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">AFIP status</h2>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>Status: {invoice.afipStatus ?? "NOT_ISSUED"}</p>
              <p>CAE: {invoice.afipCAE ?? "-"}</p>
              <p>AFIP Number: {invoice.afipNumber ?? "-"}</p>
              <p>Issue date: {dateLabel(invoice.issueDate)}</p>
              <p>Due date: {dateLabel(invoice.dueDate)}</p>
            </div>
            {invoice.status === "ISSUED" && !invoice.afipCAE ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                Warning: invoice issued but AFIP response data is incomplete.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
