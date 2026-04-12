import { getRequiredPortalSession, listPortalTracking } from "@/lib/portal";

function dateLabel(value: Date) {
  return new Date(value).toLocaleString();
}

export default async function PortalTrackingPage() {
  const session = await getRequiredPortalSession();
  const timeline = await listPortalTracking(session);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Tracking timeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          Customer-safe timeline projected from shared shipment milestones, documents, and invoice updates.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {timeline.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No recent timeline activity.
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((event) => (
              <li key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <span className="text-xs text-slate-500">{dateLabel(event.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{event.description}</p>
                <p className="mt-1 text-xs text-slate-500">Shipment {event.shipmentNumber}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
