import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createQuoteAction } from "@/app/(dashboard)/quotes/actions";

export default async function NewQuotePage() {
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";

  const customers = await prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New Quote</h1>
        <p className="text-sm text-zinc-600">
          Create a new freight quote with pricing breakdown.
        </p>
      </div>
      <QuoteForm
        action={createQuoteAction}
        customers={customers}
        submitLabel="Create Quote"
      />
    </div>
  );
}
