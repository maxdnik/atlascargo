"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuoteStatus, TradeDirection, TransportMode } from "@prisma/client";
import { ArrowRight, FileText, Plane, ShipWheel, Truck } from "lucide-react";

type QuoteRow = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  mode: TransportMode;
  direction: TradeDirection;
  approvedAt: string | null;
  customer: {
    legalName: string;
  };
  shipment: {
    id: string;
    shipmentNumber: string;
  } | null;
};

type QuotesPipelineTableProps = {
  quotes: QuoteRow[];
};

function statusBadgeClass(status: QuoteRow["status"]) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "SENT") return "bg-blue-100 text-blue-700";
  if (status === "EXPIRED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export function QuotesPipelineTable({ quotes }: QuotesPipelineTableProps) {
  const router = useRouter();

  if (quotes.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-4 py-12 text-center">
          <FileText className="h-5 w-5 text-slate-400" />
          <p className="font-medium text-slate-700">No quotes found</p>
          <p className="text-xs text-slate-500">Once the sales team generates quotes, they will appear here.</p>
        </div>
      </div>
    );
  }

  return (
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
        {quotes.map((quote) => (
          <tr
            key={quote.id}
            className="cursor-pointer text-sm text-slate-700 transition hover:bg-slate-50/80 focus-within:bg-slate-50/80"
            role="link"
            tabIndex={0}
            onClick={() => router.push(`/quotes/${quote.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/quotes/${quote.id}`);
              }
            }}
          >
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
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(quote.status)}`}>
                {quote.status}
              </span>
            </td>
            <td className="px-4 py-3">
              {quote.shipment ? (
                <Link
                  href={`/shipments/${quote.shipment.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="relative z-10 text-slate-700 hover:underline"
                >
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
                  onClick={(event) => event.stopPropagation()}
                  className="relative z-10 inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                >
                  Convert to shipment
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
