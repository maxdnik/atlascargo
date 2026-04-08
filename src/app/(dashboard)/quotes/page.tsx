import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listQuotes } from "@/lib/quotes";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{ q?: string; mode?: string; status?: string; customerId?: string }>;

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const params = await searchParams;

  const [quotes, customers] = await Promise.all([
    listQuotes(companyId, {
      q: params.q,
      mode: params.mode,
      status: params.status,
      customerId: params.customerId,
    }),
    prisma.customer.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Quotes</h1>
          <p className="text-sm text-zinc-600">{quotes.length} quote{quotes.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/quotes/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search…"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm w-44" />
        <select name="customerId" defaultValue={params.customerId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.legalName}</option>)}
        </select>
        <select name="mode" defaultValue={params.mode ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Modes</option>
          <option value="AIR">Air</option>
          <option value="OCEAN">Ocean</option>
          <option value="ROAD">Road</option>
        </select>
        <select name="status" defaultValue={params.status ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <button type="submit"
          className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
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
              <th className="px-4 py-3">Validity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => {
              const m = Number(quote.grossMarginAmount ?? 0);
              return (
                <tr key={quote.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/quotes/${quote.id}`} className="text-blue-600 hover:underline">
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-[180px]">{quote.customer.legalName}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.mode}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.direction}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{quote.origin ?? "—"} → {quote.destination ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(Number(quote.totalSell ?? 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(Number(quote.totalCost ?? 0))}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${m >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatMoney(m)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{fmtDate(quote.validUntil)}</td>
                  <td className="px-4 py-3"><QuoteStatusBadge status={quote.status} /></td>
                </tr>
              );
            })}
            {quotes.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No quotes found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
