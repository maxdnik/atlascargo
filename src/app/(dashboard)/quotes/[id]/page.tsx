import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuoteById } from "@/lib/quotes";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { QuoteDetailActions } from "@/components/quotes/quote-detail-actions";
import {
  sendQuoteAction,
  approveQuoteAction,
  rejectQuoteAction,
  expireQuoteAction,
  convertQuoteToShipmentAction,
} from "@/app/(dashboard)/quotes/actions";

type Params = Promise<{ id: string }>;

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function QuoteDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const quote = await getQuoteById(companyId, id);
  if (!quote) notFound();

  const isEditable = quote.status === "DRAFT" || quote.status === "SENT";

  const totalSell = Number(quote.totalSell ?? 0);
  const totalCost = Number(quote.totalCost ?? 0);
  const margin = Number(quote.grossMarginAmount ?? 0);
  const marginPct = Number(quote.grossMarginPercent ?? 0);

  const pricingRows = [
    { label: "Freight", sell: Number(quote.freightSell), cost: Number(quote.freightCost) },
    { label: "Origin charges", sell: Number(quote.originChargesSell), cost: Number(quote.originChargesCost) },
    { label: "Destination charges", sell: Number(quote.destinationChargesSell), cost: Number(quote.destinationChargesCost) },
    { label: "Additional charges", sell: Number(quote.additionalChargesSell), cost: Number(quote.additionalChargesCost) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">{quote.quoteNumber}</h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {quote.customer.legalName} ({quote.customer.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Link href={`/quotes/${quote.id}/edit`}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
              Edit
            </Link>
          )}
          <Link href="/quotes"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back
          </Link>
        </div>
      </div>

      {/* Actions */}
      <QuoteDetailActions
        quoteId={quote.id}
        status={quote.status}
        hasPricing={totalSell > 0}
        hasShipment={!!quote.shipment}
        sendAction={sendQuoteAction}
        approveAction={approveQuoteAction}
        rejectAction={rejectQuoteAction}
        expireAction={expireQuoteAction}
        convertAction={convertQuoteToShipmentAction}
      />

      {/* Shipment link */}
      {quote.shipment && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-800">
            Converted to shipment{" "}
            <Link href={`/shipments/${quote.shipment.id}`} className="font-medium underline">
              {quote.shipment.shipmentNumber}
            </Link>{" "}
            ({quote.shipment.status})
          </p>
        </div>
      )}

      {/* Commercial Summary Card */}
      <div className={`rounded-xl border p-5 ${margin >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Commercial Summary</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Total Sell</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatMoney(totalSell)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total Cost</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatMoney(totalCost)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Gross Margin</p>
            <p className={`text-2xl font-bold tabular-nums ${margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatMoney(margin)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Margin %</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {(marginPct * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Details + Timeline */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quote Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Mode</dt>
            <dd className="text-slate-900 font-medium">{quote.mode}</dd>
            <dt className="text-slate-500">Direction</dt>
            <dd className="text-slate-900 font-medium">{quote.direction}</dd>
            <dt className="text-slate-500">Incoterm</dt>
            <dd className="text-slate-900">{quote.incotermCode ?? "—"}</dd>
            <dt className="text-slate-500">Origin (POL)</dt>
            <dd className="text-slate-900">{quote.origin ?? "—"}</dd>
            <dt className="text-slate-500">Destination (POD)</dt>
            <dd className="text-slate-900">{quote.destination ?? "—"}</dd>
            <dt className="text-slate-500">Commodity</dt>
            <dd className="text-slate-900">{quote.commodity ?? "—"}</dd>
            <dt className="text-slate-500">Valid Until</dt>
            <dd className="text-slate-900">{fmtDate(quote.validUntil)}</dd>
            <dt className="text-slate-500">Currency</dt>
            <dd className="text-slate-900">{quote.currencyCode}</dd>
          </dl>
          {quote.internalNotes && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-xs text-slate-500">Internal Notes</p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{quote.internalNotes}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timeline &amp; Audit</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-900">{fmtDate(quote.createdAt)}</dd>
            <dt className="text-slate-500">Created by</dt>
            <dd className="text-slate-900">{quote.owner?.name ?? "—"}</dd>
            {quote.sentAt && (
              <>
                <dt className="text-slate-500">Sent</dt>
                <dd className="text-slate-900">{fmtDate(quote.sentAt)}</dd>
              </>
            )}
            {quote.approvedAt && (
              <>
                <dt className="text-slate-500">Approved</dt>
                <dd className="text-emerald-700 font-medium">{fmtDate(quote.approvedAt)}</dd>
                <dt className="text-slate-500">Approved by</dt>
                <dd className="text-slate-900">{quote.approvedBy?.name ?? "—"}</dd>
              </>
            )}
            {quote.rejectedAt && (
              <>
                <dt className="text-slate-500">Rejected</dt>
                <dd className="text-red-700 font-medium">{fmtDate(quote.rejectedAt)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Pricing Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pricing Breakdown</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2 text-left font-medium text-slate-500">Concept</th>
              <th className="pb-2 text-right font-medium text-slate-500">Sell</th>
              <th className="pb-2 text-right font-medium text-slate-500">Cost</th>
              <th className="pb-2 text-right font-medium text-slate-500">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pricingRows.map((row) => {
              const rowMargin = row.sell - row.cost;
              return (
                <tr key={row.label}>
                  <td className="py-2 text-slate-700">{row.label}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{formatMoney(row.sell)}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(row.cost)}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${rowMargin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatMoney(rowMargin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-2 text-slate-900">Total</td>
              <td className="py-2 text-right tabular-nums text-slate-900">{formatMoney(totalSell)}</td>
              <td className="py-2 text-right tabular-nums text-slate-900">{formatMoney(totalCost)}</td>
              <td className={`py-2 text-right tabular-nums ${margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatMoney(margin)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
