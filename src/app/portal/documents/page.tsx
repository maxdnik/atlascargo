import Link from "next/link";

import { getRequiredPortalSession, listPortalDocuments } from "@/lib/portal";

function dateLabel(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export default async function PortalDocumentsPage() {
  const session = await getRequiredPortalSession();
  const rows = await listPortalDocuments(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">
          Customer-visible shipment files grouped by shipment.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Shipment</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">File name</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Issue date</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                  No customer-visible documents available yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link className="hover:underline" href={`/portal/shipments/${row.shipmentId}`}>
                      {row.shipmentNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.docType}</td>
                  <td className="px-4 py-3">{row.fileName}</td>
                  <td className="px-4 py-3">{row.referenceNumber ?? "-"}</td>
                  <td className="px-4 py-3">{dateLabel(row.issueDate)}</td>
                  <td className="px-4 py-3">{dateLabel(row.uploadedAt)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
