import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getShipmentById } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import { ShipmentForm } from "@/components/shipments/shipment-form";
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit shipment</h1>
        <p className="text-sm text-slate-600">
          Update operational references, routing dates and responsible data.
        </p>
      </div>
      <ShipmentForm
        action={updateShipmentAction}
        customers={customers}
        submitLabel="Update shipment"
        defaults={{
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customerId: shipment.customerId,
          mode: shipment.mode,
          direction: shipment.direction,
          status: shipment.status,
          incotermCode: shipment.incotermCode ?? "",
          referenceClient: shipment.referenceClient ?? "",
          referenceInternal: shipment.referenceInternal ?? "",
          bookingRef: shipment.bookingRef ?? "",
          houseRef: shipment.houseRef ?? "",
          masterRef: shipment.masterRef ?? "",
          commodity: shipment.commodity ?? "",
          packageCount: shipment.packageCount ?? undefined,
          grossWeightKg: shipment.grossWeightKg?.toString() ?? "",
          volumeM3: shipment.volumeM3?.toString() ?? "",
          etd: shipment.etd ? shipment.etd.toISOString().slice(0, 16) : "",
          eta: shipment.eta ? shipment.eta.toISOString().slice(0, 16) : "",
          notes: shipment.notes ?? "",
        }}
      />
    </div>
  );
}
