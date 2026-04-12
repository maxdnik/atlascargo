import { PermissionAction, PermissionResource } from "@prisma/client";

import { createQuoteAction } from "@/app/(dashboard)/quotes/actions";
import { QuoteForm } from "@/components/quotes/quote-form";
import { listCustomers } from "@/lib/customers";
import { enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function NewQuotePage() {
  const session = await enforcePagePermission(PermissionResource.QUOTES, PermissionAction.CREATE);

  const [customers, currencies, incoterms, shipmentLocations] = await Promise.all([
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
    prisma.shipment.findMany({
      where: {
        companyId: session.companyId,
      },
      select: {
        originCode: true,
        destinationCode: true,
      },
      take: 500,
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const originOptions = Array.from(
    new Set(shipmentLocations.map((row) => row.originCode).filter((row): row is string => Boolean(row))),
  ).sort((left, right) => left.localeCompare(right));
  const destinationOptions = Array.from(
    new Set(
      shipmentLocations
        .map((row) => row.destinationCode)
        .filter((row): row is string => Boolean(row)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New quote</h1>
        <p className="text-sm text-slate-600">
          Create a draft commercial quote for a customer and route it through approval.
        </p>
      </div>
      <QuoteForm
        action={createQuoteAction}
        submitLabel="Create quote"
        customers={customers}
        currencies={currencies}
        incoterms={incoterms}
        originOptions={originOptions}
        destinationOptions={destinationOptions}
      />
    </div>
  );
}
