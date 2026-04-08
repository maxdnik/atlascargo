import Link from "next/link";
import { QuoteStatus } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function statusBadgeClass(status: QuoteStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "SENT") return "bg-blue-100 text-blue-700";
  if (status === "EXPIRED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function QuotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return null;
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: session.user.companyId },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Quotes</h1>
        <p className="text-sm text-zinc-600">Commercial pipeline and conversion to shipment files.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Quote #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shipment</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                  No quotes found.
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-medium">{quote.quoteNumber}</td>
                  <td className="px-4 py-3">{quote.customer.legalName}</td>
                  <td className="px-4 py-3">{quote.mode}</td>
                  <td className="px-4 py-3">{quote.direction}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(quote.status)}`}
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
                  <td className="px-4 py-3">
                    {quote.status === "APPROVED" && !quote.shipment ? (
                      <Link
                        href={`/shipments/new?quoteId=${quote.id}`}
                        className="text-slate-700 hover:underline"
                      >
                        Convert to shipment
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
