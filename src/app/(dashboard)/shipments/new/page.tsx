import { listCustomers } from "@/lib/customers";
import { enforcePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { createShipmentAction } from "../actions";

type NewShipmentPageProps = {
  searchParams: Promise<{
    quoteId?: string;
  }>;
};

export default async function NewShipmentPage({ searchParams }: NewShipmentPageProps) {
  const session = await enforcePagePermission("SHIPMENTS", "CREATE");

  const { quoteId } = await searchParams;
  const customers = await listCustomers(session.companyId);
  const quote = quoteId
    ? await prisma.quote.findFirst({
        where: {
          id: quoteId,
          companyId: session.companyId,
          status: QuoteStatus.APPROVED,
          shipment: null,
        },
        select: {
          id: true,
          quoteNumber: true,
          customerId: true,
          mode: true,
          direction: true,
          incotermCode: true,
          commodity: true,
          originCode: true,
          destinationCode: true,
          pol: true,
          pod: true,
          airportOrigin: true,
          airportDestination: true,
          placeOfReceipt: true,
          placeOfDelivery: true,
        },
      })
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New shipment</h1>
        <p className="text-sm text-slate-600">
          Open a new operational file for air, ocean or road movements.
        </p>
      </div>
      <ShipmentForm
        action={createShipmentAction}
        customers={customers}
        submitLabel="Create shipment"
        defaults={
          quote
            ? {
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber,
                customerId: quote.customerId,
                mode: quote.mode,
                direction: quote.direction,
                incotermCode: quote.incotermCode ?? "",
                commodity: quote.commodity ?? "",
                originCode: quote.originCode ?? "",
                destinationCode: quote.destinationCode ?? "",
                pol: quote.pol ?? "",
                pod: quote.pod ?? "",
                airportOrigin: quote.airportOrigin ?? "",
                airportDestination: quote.airportDestination ?? "",
                placeOfReceipt: quote.placeOfReceipt ?? "",
                placeOfDelivery: quote.placeOfDelivery ?? "",
              }
            : undefined
        }
      />
    </div>
  );
}
