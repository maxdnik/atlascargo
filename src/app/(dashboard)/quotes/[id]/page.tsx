import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuoteById } from "@/lib/quotes";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { PricingBreakdown } from "@/components/quotes/pricing-breakdown";
import { QuoteActions } from "@/components/quotes/quote-actions";
import {
  sendQuoteAction,
  approveQuoteAction,
  rejectQuoteAction,
  expireQuoteAction,
  convertQuoteToShipmentAction,
} from "@/app/(dashboard)/quotes/actions";

type Params = Promise<{ id: string }>;

export default async function QuoteDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const quote = await getQuoteById(companyId, id);

  if (!quote) notFound();

  const isEditable = quote.status === "DRAFT" || quote.status === "SENT";
  const validUntilStr = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">
              {quote.quoteNumber}
            </h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {quote.customer.legalName} ({quote.customer.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Link
              href={`/quotes/${quote.id}/edit`}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
            >
              Edit
            </Link>
          )}
          <Link
            href="/quotes"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Actions */}
      <QuoteActions
        quoteId={quote.id}
        status={quote.status}
        hasCharges={quote.charges.length > 0}
        hasShipment={!!quote.shipment}
        sendAction={sendQuoteAction}
        approveAction={approveQuoteAction}
        rejectAction={rejectQuoteAction}
        expireAction={expireQuoteAction}
        convertAction={convertQuoteToShipmentAction}
      />

      {/* Shipment Link */}
      {quote.shipment && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-800">
            Converted to shipment{" "}
            <Link
              href={`/shipments/${quote.shipment.id}`}
              className="font-medium underline"
            >
              {quote.shipment.shipmentNumber}
            </Link>{" "}
            ({quote.shipment.status})
          </p>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Quote Details
          </h3>
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
            <dt className="text-slate-500">Valid Until</dt>
            <dd className="text-slate-900">{validUntilStr}</dd>
            <dt className="text-slate-500">Currency</dt>
            <dd className="text-slate-900">{quote.currencyCode}</dd>
          </dl>
          {quote.internalNotes && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-xs text-slate-500">Internal Notes</p>
              <p className="text-sm text-slate-700 mt-1">{quote.internalNotes}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Timeline
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-900">
              {new Date(quote.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </dd>
            {quote.sentAt && (
              <>
                <dt className="text-slate-500">Sent</dt>
                <dd className="text-slate-900">
                  {new Date(quote.sentAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </>
            )}
            {quote.approvedAt && (
              <>
                <dt className="text-slate-500">Approved</dt>
                <dd className="text-emerald-700 font-medium">
                  {new Date(quote.approvedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </>
            )}
            {quote.rejectedAt && (
              <>
                <dt className="text-slate-500">Rejected</dt>
                <dd className="text-red-700 font-medium">
                  {new Date(quote.rejectedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Pricing Breakdown */}
      <PricingBreakdown
        charges={quote.charges}
        totalBuy={quote.totalBuy}
        totalSell={quote.totalSell}
        marginAmount={quote.marginAmount}
        marginPct={quote.marginPct}
        currencyCode={quote.currencyCode}
      />
    </div>
  );
}
