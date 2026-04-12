import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource, QuoteStatus, TransportMode } from "@prisma/client";
import { ArrowRight, Plane, ShipWheel, Truck } from "lucide-react";

import { canUser, enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type QuoteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function statusBadgeClass(status: QuoteStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "SENT") return "bg-blue-100 text-blue-700";
  if (status === "EXPIRED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function transportIcon(mode: TransportMode) {
  if (mode === "AIR") return <Plane className="h-4 w-4" />;
  if (mode === "ROAD") return <Truck className="h-4 w-4" />;
  return <ShipWheel className="h-4 w-4" />;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateValue(value: Date | null) {
  return value ? value.toLocaleDateString() : "-";
}

function textValue(value: string | null) {
  return value && value.trim() ? value : "-";
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const session = await enforcePagePermission(PermissionResource.QUOTES, PermissionAction.VIEW);
  const { id } = await params;

  const [quote, canApproveQuotes] = await Promise.all([
    prisma.quote.findFirst({
      where: {
        id,
        companyId: session.companyId,
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        mode: true,
        direction: true,
        currencyCode: true,
        incotermCode: true,
        validUntil: true,
        createdAt: true,
        originCode: true,
        destinationCode: true,
        commodity: true,
        packageCount: true,
        packageType: true,
        grossWeightKg: true,
        volumeM3: true,
        totalBuy: true,
        totalSell: true,
        marginAmount: true,
        customer: {
          select: {
            legalName: true,
            code: true,
          },
        },
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
          },
        },
        charges: {
          select: {
            id: true,
            concept: true,
            providerName: true,
            buyAmount: true,
            sellAmount: true,
            currencyCode: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    }),
    canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.QUOTES,
      PermissionAction.APPROVE,
    ),
  ]);

  if (!quote) {
    notFound();
  }

  const totalBuy = Number(quote.totalBuy);
  const totalSell = Number(quote.totalSell);
  const marginAmount = Number(quote.marginAmount);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote detail</p>
            <h1 className="text-2xl font-semibold text-slate-900">{quote.quoteNumber}</h1>
            <p className="text-sm text-slate-600">
              {quote.customer.code} - {quote.customer.legalName}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(quote.status)}`}>
            {quote.status}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {transportIcon(quote.mode)}
            {quote.mode}
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{quote.direction}</span>
          {quote.shipment ? (
            <Link
              href={`/shipments/${quote.shipment.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
            >
              Shipment {quote.shipment.shipmentNumber}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-slate-500">No shipment linked</span>
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Core data</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-500">Currency</dt>
            <dd className="font-medium text-slate-800">{quote.currencyCode}</dd>
            <dt className="text-slate-500">Incoterm</dt>
            <dd className="font-medium text-slate-800">{textValue(quote.incotermCode)}</dd>
            <dt className="text-slate-500">Valid until</dt>
            <dd className="font-medium text-slate-800">{dateValue(quote.validUntil)}</dd>
            <dt className="text-slate-500">Created at</dt>
            <dd className="font-medium text-slate-800">{quote.createdAt.toLocaleString()}</dd>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Routing</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-500">Origin code</dt>
            <dd className="font-medium text-slate-800">{textValue(quote.originCode)}</dd>
            <dt className="text-slate-500">Destination code</dt>
            <dd className="font-medium text-slate-800">{textValue(quote.destinationCode)}</dd>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cargo</h2>
        <dl className="mt-3 grid gap-x-4 gap-y-3 text-sm md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <dt className="text-slate-500">Commodity</dt>
            <dd className="font-medium text-slate-800">{textValue(quote.commodity)}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <dt className="text-slate-500">Packages</dt>
            <dd className="font-medium text-slate-800">{quote.packageCount ?? "-"}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <dt className="text-slate-500">Package type</dt>
            <dd className="font-medium text-slate-800">{textValue(quote.packageType)}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <dt className="text-slate-500">Gross weight (kg)</dt>
            <dd className="font-medium text-slate-800">
              {quote.grossWeightKg ? Number(quote.grossWeightKg).toLocaleString() : "-"}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <dt className="text-slate-500">Volume (m3)</dt>
            <dd className="font-medium text-slate-800">{quote.volumeM3 ? Number(quote.volumeM3).toLocaleString() : "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Pricing</h2>
        {quote.charges.length > 0 ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Concept</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2 text-right">Buy</th>
                    <th className="px-3 py-2 text-right">Sell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.charges.map((charge) => (
                    <tr key={charge.id} className="text-slate-700">
                      <td className="px-3 py-2 font-medium text-slate-900">{charge.concept}</td>
                      <td className="px-3 py-2">{textValue(charge.providerName)}</td>
                      <td className="px-3 py-2">{charge.currencyCode}</td>
                      <td className="px-3 py-2 text-right">{money(Number(charge.buyAmount))}</td>
                      <td className="px-3 py-2 text-right">{money(Number(charge.sellAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total buy</p>
                <p className="font-semibold text-slate-900">{money(totalBuy)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total sell</p>
                <p className="font-semibold text-slate-900">{money(totalSell)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Margin</p>
                <p className={`font-semibold ${marginAmount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {money(marginAmount)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No pricing lines added yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400"
          >
            Edit (coming soon)
          </button>

          {quote.status === "DRAFT" ? (
            <button
              type="button"
              disabled={!canApproveQuotes}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400"
              title={canApproveQuotes ? "Approval flow coming soon" : "Missing QUOTES:APPROVE permission"}
            >
              Approve (coming soon)
            </button>
          ) : null}

          {quote.status === "APPROVED" && !quote.shipment ? (
            <Link
              href={`/shipments/new?quoteId=${quote.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
            >
              Convert to shipment
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">
              Convert to shipment unavailable
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
