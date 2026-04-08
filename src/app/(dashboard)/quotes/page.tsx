import Link from "next/link";
import { QuoteStatus } from "@prisma/client";
import { ArrowRight, FileText, Plane, ShipWheel, Truck } from "lucide-react";
import { enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function statusBadgeClass(status: QuoteStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "SENT") return "bg-blue-100 text-blue-700";
  if (status === "EXPIRED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function QuotesPage() {
  const session = await enforcePagePermission("QUOTES", "VIEW");

  const quotes = await prisma.quote.findMany({
    where: { companyId: session.companyId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      mode: true,
      direction: true,
      approvedAt: true,
      customer: {
        select: {
          legalName: true,
        },
      },
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Quotes Pipeline</h1>
          <p className="text-sm text-slate-500">
            Commercial opportunities and conversion into operational files.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/80">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Quote #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Transport</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shipment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-500" colSpan={6}>
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-400" />
                    <p className="font-medium text-slate-700">No quotes found</p>
                    <p className="text-xs text-slate-500">
                      Once the sales team generates quotes, they will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="text-sm text-slate-700 transition hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium">
                    <div className="font-semibold text-slate-900">{quote.quoteNumber}</div>
                    <div className="text-xs text-slate-500">
                      {quote.approvedAt ? `Approved ${new Date(quote.approvedAt).toLocaleDateString()}` : "Pending approval"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{quote.customer.legalName}</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {quote.mode === "AIR" ? (
                        <Plane className="h-3.5 w-3.5" />
                      ) : quote.mode === "ROAD" ? (
                        <Truck className="h-3.5 w-3.5" />
                      ) : (
                        <ShipWheel className="h-3.5 w-3.5" />
                      )}
                      {quote.mode}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{quote.direction}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(quote.status)}`}
                    >
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {quote.shipment ? (
                      <Link href={`/shipments/${quote.shipment.id}`} className="text-slate-700 hover:underline">
                        {quote.shipment.shipmentNumber}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {quote.status === "APPROVED" && !quote.shipment ? (
                      <Link
                        href={`/shipments/new?quoteId=${quote.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                      >
                        Convert to shipment
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
