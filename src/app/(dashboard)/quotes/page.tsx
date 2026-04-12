import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { QuotesPipelineTable } from "@/components/quotes/quotes-pipeline-table";
import { canUser, enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function QuotesPage() {
  const session = await enforcePagePermission("QUOTES", "VIEW");
  const canCreateQuotes = await canUser(
    {
      id: session.userId,
      role: session.role,
      companyId: session.companyId,
    },
    PermissionResource.QUOTES,
    PermissionAction.CREATE,
  );

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
  const quoteRows = quotes.map((quote) => ({
    ...quote,
    approvedAt: quote.approvedAt ? quote.approvedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Quotes Pipeline</h1>
          <p className="text-sm text-slate-500">
            Commercial opportunities and conversion into operational files.
          </p>
        </div>
        {canCreateQuotes ? (
          <Link
            href="/quotes/new"
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500"
          >
            New Quote
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <QuotesPipelineTable quotes={quoteRows} />
      </div>
    </div>
  );
}
