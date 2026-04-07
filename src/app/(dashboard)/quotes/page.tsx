import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listQuotes } from "@/lib/quotes";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";

type SearchParams = Promise<{ q?: string; mode?: string; status?: string }>;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const params = await searchParams;
  const quotes = await listQuotes(companyId, {
    q: params.q,
    mode: params.mode,
    status: params.status,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Quotes</h1>
          <p className="text-sm text-zinc-600">
            {quotes.length} quote{quotes.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search quotes..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm w-48"
        />
        <select
          name="mode"
          defaultValue={params.mode ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Modes</option>
          <option value="AIR">Air</option>
          <option value="OCEAN">Ocean</option>
          <option value="ROAD">Road</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Quote #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Dir</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3 text-right">Sell</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => {
              const margin = Number(quote.marginAmount ?? 0);
              return (
                <tr key={quote.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {quote.customer.legalName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{quote.mode}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.direction}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {quote.origin ?? "—"} → {quote.destination ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatMoney(Number(quote.totalSell ?? 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(Number(quote.totalBuy ?? 0))}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      margin >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {formatMoney(margin)}
                  </td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                </tr>
              );
            })}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No quotes found. Create your first quote to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
