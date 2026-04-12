import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { updateQuoteAction } from "@/app/(dashboard)/quotes/actions";
import { QuoteForm } from "@/components/quotes/quote-form";
import { listCustomers } from "@/lib/customers";
import { enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type QuoteEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toDateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function EditQuotePage({ params }: QuoteEditPageProps) {
  const session = await enforcePagePermission(PermissionResource.QUOTES, PermissionAction.EDIT);
  const { id } = await params;

  const [quote, customers, currencies, incoterms] = await Promise.all([
    prisma.quote.findFirst({
      where: {
        id,
        companyId: session.companyId,
      },
      select: {
        id: true,
        status: true,
        customerId: true,
        mode: true,
        direction: true,
        currencyCode: true,
        loadType: true,
        packageCount: true,
        packageType: true,
        grossWeightKg: true,
        volumeM3: true,
        cargoReadyDate: true,
        serviceScope: true,
        customerReference: true,
        insuranceRequired: true,
        customsClearanceScope: true,
        equipmentType: true,
        incotermCode: true,
        originCode: true,
        destinationCode: true,
        validUntil: true,
        commodity: true,
        internalNotes: true,
        shipment: {
          select: {
            id: true,
          },
        },
        charges: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            concept: true,
            providerName: true,
            buyAmount: true,
            sellAmount: true,
            currencyCode: true,
          },
        },
      },
    }),
    listCustomers(session.companyId),
    prisma.currency.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: {
        code: true,
        name: true,
      },
    }),
    prisma.incoterm.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: {
        code: true,
        description: true,
      },
    }),
  ]);

  if (!quote) {
    notFound();
  }
  if (quote.shipment) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-2xl font-semibold text-amber-900">Quote locked</h1>
        <p className="text-sm text-amber-800">
          This quote is already linked to a shipment and can no longer be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit quote {quote.id}</h1>
        <p className="text-sm text-slate-600">Update commercial, routing, cargo, and pricing details.</p>
      </div>
      <QuoteForm
        action={updateQuoteAction}
        submitLabel="Save quote"
        redirectTo={`/quotes/${quote.id}`}
        customers={customers}
        currencies={currencies}
        incoterms={incoterms}
        defaults={{
          id: quote.id,
          customerId: quote.customerId,
          mode: quote.mode,
          direction: quote.direction,
          currencyCode: quote.currencyCode,
          loadType: quote.loadType,
          packageCount: quote.packageCount,
          packageType: quote.packageType,
          grossWeightKg: quote.grossWeightKg ? String(quote.grossWeightKg) : null,
          volumeM3: quote.volumeM3 ? String(quote.volumeM3) : null,
          cargoReadyDate: toDateInput(quote.cargoReadyDate),
          serviceScope: quote.serviceScope,
          customerReference: quote.customerReference,
          insuranceRequired: quote.insuranceRequired,
          customsClearanceScope: quote.customsClearanceScope,
          equipmentType: quote.equipmentType,
          incotermCode: quote.incotermCode,
          originCode: quote.originCode,
          destinationCode: quote.destinationCode,
          validUntil: toDateInput(quote.validUntil),
          commodity: quote.commodity,
          internalNotes: quote.internalNotes,
          charges: quote.charges.map((charge) => ({
            concept: charge.concept,
            providerName: charge.providerName,
            buyAmount: String(charge.buyAmount),
            sellAmount: String(charge.sellAmount),
            currencyCode: charge.currencyCode,
          })),
        }}
      />
    </div>
  );
}
