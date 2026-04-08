import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getShipmentById } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { MilestoneTimeline } from "@/components/shipments/milestone-timeline";
import { updateShipmentAction } from "@/app/(dashboard)/shipments/actions";

type ShipmentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ShipmentEditPage({ params }: ShipmentEditPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const { id } = await params;
  const shipment = await getShipmentById(session.user.companyId, id);
  const customers = await listCustomers(session.user.companyId);
  if (!shipment) {
    notFound();
  }

  const operationalSummary = [
    { label: "Mode", value: shipment.mode },
    { label: "Direction", value: shipment.direction },
    { label: "Status", value: shipment.status },
    {
      label: "Routing",
      value:
        shipment.originCode || shipment.destinationCode
          ? `${shipment.originCode ?? "-"} → ${shipment.destinationCode ?? "-"}`
          : "-",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit shipment</h1>
        <p className="text-sm text-slate-600">
          Update operational references, routing dates and responsible data.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Header summary
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <article className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Shipment #</p>
            <p className="text-sm font-semibold text-slate-900">{shipment.shipmentNumber}</p>
          </article>
          {operationalSummary.map((item) => (
            <article key={item.label} className="rounded-md border border-slate-200 p-3">
              <p className="text-xs uppercase text-slate-500">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Quote reference</h2>
        {shipment.quote ? (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Commercial source:</span>{" "}
              {shipment.quote.quoteNumber} ({shipment.quote.status})
            </p>
            <p>
              <span className="font-medium text-slate-900">Customer:</span>{" "}
              {shipment.quote.customer.legalName}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted lane:</span>{" "}
              {(shipment.quote.originCode ?? "-") + " → " + (shipment.quote.destinationCode ?? "-")}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted incoterm:</span>{" "}
              {shipment.quote.incotermCode ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted commodity:</span>{" "}
              {shipment.quote.commodity ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Margin reference:</span>{" "}
              {shipment.quote.marginAmount.toString()} ({shipment.quote.marginPct.toString()})
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No linked quote.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Customer and parties
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Customer:</span>{" "}
            {shipment.customer.legalName}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Shipper:</span> {shipment.shipperName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Consignee:</span>{" "}
            {shipment.consigneeName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Notify Party:</span>{" "}
            {shipment.notifyPartyName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Origin Agent:</span>{" "}
            {shipment.agentOriginName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Destination Agent:</span>{" "}
            {shipment.agentDestinationName ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Routing</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Origin / Destination:</span>{" "}
            {(shipment.originCode ?? "-") + " / " + (shipment.destinationCode ?? "-")}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">POL / POD:</span> {shipment.pol ?? "-"} /{" "}
            {shipment.pod ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Airport O/D:</span>{" "}
            {shipment.airportOrigin ?? "-"} / {shipment.airportDestination ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Place of receipt/delivery:</span>{" "}
            {(shipment.placeOfReceipt ?? "-") + " / " + (shipment.placeOfDelivery ?? "-")}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Transport references
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Carrier:</span> {shipment.carrierName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Vessel / Flight:</span>{" "}
            {shipment.vesselOrFlight ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Booking Ref:</span> {shipment.bookingRef ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">House Ref:</span> {shipment.houseRef ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Master Ref:</span> {shipment.masterRef ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cargo details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Packages:</span>{" "}
            {(shipment.packageCount ?? "-") + " " + (shipment.packageType ?? "")}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Gross Weight (kg):</span>{" "}
            {shipment.grossWeightKg?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Chargeable Weight (kg):</span>{" "}
            {shipment.chargeableWeightKg?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Volume (m3):</span>{" "}
            {shipment.volumeM3?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Containers:</span>{" "}
            {(shipment.containerCount ?? "-") + " / " + (shipment.containerType ?? "-")}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Operational dates
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Cargo Ready:</span>{" "}
            {shipment.cargoReadyDate?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ETD:</span>{" "}
            {shipment.etd?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ETA:</span>{" "}
            {shipment.eta?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ATD:</span>{" "}
            {shipment.atd?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ATA:</span>{" "}
            {shipment.ata?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Delivered At:</span>{" "}
            {shipment.deliveredAt?.toLocaleString() ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Notes</h2>
        <p className="mt-2 text-sm text-slate-700">{shipment.notes ?? "-"}</p>
      </section>

      <ShipmentForm
        action={updateShipmentAction}
        customers={customers}
        submitLabel="Update shipment"
        defaults={{
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customerId: shipment.customerId,
          quoteId: shipment.quoteId ?? undefined,
          quoteNumber: shipment.quote?.quoteNumber,
          mode: shipment.mode,
          direction: shipment.direction,
          status: shipment.status,
          incotermCode: shipment.incotermCode ?? "",
          serviceLevel: shipment.serviceLevel ?? "",
          originCode: shipment.originCode ?? "",
          destinationCode: shipment.destinationCode ?? "",
          pol: shipment.pol ?? "",
          pod: shipment.pod ?? "",
          airportOrigin: shipment.airportOrigin ?? "",
          airportDestination: shipment.airportDestination ?? "",
          placeOfReceipt: shipment.placeOfReceipt ?? "",
          placeOfDelivery: shipment.placeOfDelivery ?? "",
          shipperName: shipment.shipperName ?? "",
          consigneeName: shipment.consigneeName ?? "",
          notifyPartyName: shipment.notifyPartyName ?? "",
          agentOriginName: shipment.agentOriginName ?? "",
          agentDestinationName: shipment.agentDestinationName ?? "",
          carrierName: shipment.carrierName ?? "",
          vesselOrFlight: shipment.vesselOrFlight ?? "",
          referenceClient: shipment.referenceClient ?? "",
          referenceInternal: shipment.referenceInternal ?? "",
          bookingRef: shipment.bookingRef ?? "",
          houseRef: shipment.houseRef ?? "",
          masterRef: shipment.masterRef ?? "",
          commodity: shipment.commodity ?? "",
          packageCount: shipment.packageCount ?? undefined,
          packageType: shipment.packageType ?? "",
          grossWeightKg: shipment.grossWeightKg?.toString() ?? "",
          chargeableWeightKg: shipment.chargeableWeightKg?.toString() ?? "",
          volumeM3: shipment.volumeM3?.toString() ?? "",
          containerCount: shipment.containerCount ?? undefined,
          containerType: shipment.containerType ?? "",
          cargoReadyDate: shipment.cargoReadyDate
            ? shipment.cargoReadyDate.toISOString().slice(0, 16)
            : "",
          etd: shipment.etd ? shipment.etd.toISOString().slice(0, 16) : "",
          eta: shipment.eta ? shipment.eta.toISOString().slice(0, 16) : "",
          atd: shipment.atd ? shipment.atd.toISOString().slice(0, 16) : "",
          ata: shipment.ata ? shipment.ata.toISOString().slice(0, 16) : "",
          deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString().slice(0, 16) : "",
          notes: shipment.notes ?? "",
        }}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Milestones timeline
        </h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">
          Update expected/actual dates and operational notes by milestone.
        </p>
        <MilestoneTimeline
          shipmentId={shipment.id}
          milestones={shipment.milestones.map((milestone) => ({
            id: milestone.id,
            code: milestone.code,
            label: milestone.label,
            expectedAt: milestone.expectedAt ? milestone.expectedAt.toISOString() : null,
            actualAt: milestone.actualAt ? milestone.actualAt.toISOString() : null,
            status: milestone.status,
            comment: milestone.comment,
          }))}
        />
      </section>
    </div>
  );
}
