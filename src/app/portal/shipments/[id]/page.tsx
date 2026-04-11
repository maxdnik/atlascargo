import { notFound } from "next/navigation";

import { getPortalShipmentDetail, getRequiredPortalSession } from "@/lib/portal";

function dateLabel(value?: Date | null) {
  return value ? value.toLocaleDateString() : "-";
}

function dateTimeLabel(value?: Date | null) {
  return value ? value.toLocaleString() : "-";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

type PortalShipmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PortalShipmentDetailPage({ params }: PortalShipmentDetailPageProps) {
  const session = await getRequiredPortalSession();
  const { id } = await params;
  const detail = await getPortalShipmentDetail(session, id);
  if (!detail) {
    notFound();
  }

  const { shipment, alerts, documents, invoices, timeline } = detail;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipment</p>
            <h1 className="text-2xl font-semibold text-slate-900">{shipment.shipmentNumber}</h1>
            <p className="text-sm text-slate-600">
              {shipment.mode} · {shipment.direction} · {shipment.customer.legalName}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {shipment.status}
          </span>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Route</p>
            <p className="font-medium text-slate-900">
              {shipment.originCode ?? "-"} → {shipment.destinationCode ?? "-"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">ETD</p>
            <p className="font-medium text-slate-900">{dateLabel(shipment.etd)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">ETA</p>
            <p className="font-medium text-slate-900">{dateLabel(shipment.eta)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Delivered</p>
            <p className="font-medium text-slate-900">{dateLabel(shipment.deliveredAt)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tracking timeline</h2>
            {timeline.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No timeline events available yet.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {timeline.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{dateTimeLabel(item.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Documents</h2>
            {documents.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No client-visible documents available.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-900">{doc.fileName}</p>
                    <p className="text-xs text-slate-600">
                      {doc.docType} · Ref {doc.referenceNumber ?? "-"} · {doc.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No invoices for this shipment yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-600">
                      {invoice.status} · Due {dateLabel(invoice.dueDate)}
                    </p>
                    <p className="text-xs text-slate-700">
                      Total {money(invoice.total)} · Outstanding {money(invoice.outstandingAmount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Alerts</h2>
            {alerts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No client alerts for this shipment.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-sm font-semibold text-amber-800">{alert.title}</p>
                    <p className="text-xs text-amber-700">{alert.issue}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
