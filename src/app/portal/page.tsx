import Link from "next/link";

import { getPortalDashboardData, getRequiredPortalSession } from "@/lib/portal";

function statusCard(title: string, value: number, tone: string) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </article>
  );
}

export default async function PortalDashboardPage() {
  const session = await getRequiredPortalSession();
  const data = await getPortalDashboardData(session);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Client portal dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live view of your shipments, documents, invoices, and shipment activity.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statusCard("Active shipments", data.activeShipments, "text-slate-900")}
        {statusCard("In transit", data.inTransit, "text-sky-700")}
        {statusCard("In customs", data.inCustoms, "text-amber-700")}
        {statusCard("Delivered", data.delivered, "text-emerald-700")}
        {statusCard("Open alerts", data.openAlerts, "text-rose-700")}
        {statusCard("Outstanding invoices", data.outstandingInvoices, "text-indigo-700")}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent documents</h3>
            <Link href="/portal/documents" className="text-xs font-medium text-sky-700">
              Open center
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentDocuments.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No client-visible documents yet.
              </p>
            ) : (
              data.recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">{doc.fileName}</p>
                  <p className="text-xs text-slate-600">
                    {doc.docType} · {doc.shipmentNumber} · {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent shipment activity</h3>
            <Link href="/portal/tracking" className="text-xs font-medium text-sky-700">
              View tracking
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentActivity.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No recent tracking events.
              </p>
            ) : (
              data.recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">{event.title}</p>
                  <p className="text-xs text-slate-600">
                    {event.shipmentNumber} · {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

