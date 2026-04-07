import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuoteById } from "@/lib/quotes";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/quotes/quote-form";
import { updateQuoteAction } from "@/app/(dashboard)/quotes/actions";

type Params = Promise<{ id: string }>;

export default async function EditQuotePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const quote = await getQuoteById(companyId, id);

  if (!quote) notFound();

  if (quote.status === "APPROVED") {
    redirect(`/quotes/${id}`);
  }

  const customers = await prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Edit {quote.quoteNumber}
        </h1>
        <p className="text-sm text-zinc-600">
          Update quote details and pricing.
        </p>
      </div>
      <QuoteForm
        action={updateQuoteAction}
        defaults={{
          id: quote.id,
          customerId: quote.customerId,
          mode: quote.mode,
          direction: quote.direction,
          origin: quote.origin,
          destination: quote.destination,
          incotermCode: quote.incotermCode,
          validUntil: quote.validUntil?.toISOString() ?? null,
          currencyCode: quote.currencyCode,
          internalNotes: quote.internalNotes,
          charges: quote.charges.map((c) => ({
            concept: c.concept,
            chargeType: c.chargeType,
            buyAmount: c.buyAmount,
            sellAmount: c.sellAmount,
          })),
        }}
        customers={customers}
        submitLabel="Update Quote"
      />
    </div>
  );
}
