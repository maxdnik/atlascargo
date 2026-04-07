import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listShipments } from "@/lib/shipments";
import { deleteShipmentDirectAction } from "./actions";

type ShipmentsPageProps = {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    status?: string;
  }>;
};

export default async function ShipmentsPage({ searchParams }: ShipmentsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return null;
  }

  const { q, mode, status } = await searchParams;
  const shipments = await listShipments(session.user.companyId, {
    q,
    mode,
    status,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shipments</h1>
          <p className="text-sm text-slate-500">
            Operational files for air, ocean and road movements.
          </p>
        </div>
        <Link
          href="/shipments/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Shipment
        </Link>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ref, booking, house/master..."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 md:col-span-2"
          />
          <select
            name="mode"
            defaultValue={mode ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All modes</option>
            <option value="AIR">Air</option>
            <option value="OCEAN">Ocean</option>
            <option value="ROAD">Road</option>
            <option value="SPECIAL">Special</option>
          </select>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Shipment #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">ETD</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
                  No shipments found.
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr key={shipment.id} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-medium">{shipment.shipmentNumber}</td>
                  <td className="px-4 py-3">{shipment.customer.legalName}</td>
                  <td className="px-4 py-3">{shipment.mode}</td>
                  <td className="px-4 py-3">{shipment.direction}</td>
                  <td className="px-4 py-3">{shipment.status}</td>
                  <td className="px-4 py-3">
                    {shipment.etd ? new Date(shipment.etd).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/shipments/${shipment.id}`} className="text-slate-700 hover:underline">
                        Edit
                      </Link>
                      <form action={deleteShipmentDirectAction}>
                        <input type="hidden" name="id" value={shipment.id} />
                        <button className="text-rose-700 hover:underline" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
