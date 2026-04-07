import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { createShipmentAction } from "../actions";

export default async function NewShipmentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    redirect("/login");
  }

  const customers = await listCustomers(session.user.companyId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New shipment</h1>
        <p className="text-sm text-slate-600">
          Open a new operational file for air, ocean or road movements.
        </p>
      </div>
      <ShipmentForm action={createShipmentAction} customers={customers} submitLabel="Create shipment" />
    </div>
  );
}
