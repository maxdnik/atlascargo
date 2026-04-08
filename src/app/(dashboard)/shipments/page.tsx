import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { listShipments } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { deleteShipmentDirectAction } from "./actions";
import { QuoteToShipmentForm } from "@/components/shipments/quote-to-shipment-form";
import { enforcePagePermission } from "@/lib/permissions";

type ShipmentsPageProps = {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    status?: string;
    customerId?: string;
  }>;
};

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: string) {
  if (status === "CLOSED") return "bg-slate-200 text-slate-800";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  if (status === "DELIVERED") return "bg-emerald-100 text-emerald-700";
  if (status === "IN_TRANSIT") return "bg-blue-100 text-blue-700";
  if (status === "BOOKING_REQUESTED" || status === "BOOKING_CONFIRMED") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

export default async function ShipmentsPage({ searchParams }: ShipmentsPageProps) {
  const session = await enforcePagePermission(PermissionResource.SHIPMENTS, PermissionAction.VIEW);
  const companyId = session.companyId;

  const { q, mode, status, customerId } = await searchParams;
  const shipments = await listShipments(companyId, {
    q,
    mode,
    status,
    customerId,
  });
  const customers = await listCustomers(companyId);
  const approvedQuotes = await prisma.quote.findMany({
    where: {
      companyId,
      status: "APPROVED",
      shipment: null,
    },
    select: {
      id: true,
      quoteNumber: true,
      mode: true,
      direction: true,
      approvedAt: true,
      customer: {
        select: {
          legalName: true,
        },
      },
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
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

      <QuoteToShipmentForm
        quotes={approvedQuotes.map((quote) => ({
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          customerName: quote.customer.legalName,
          mode: quote.mode,
          direction: quote.direction,
        }))}
      />

      <form className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Shipment #, refs, booking, house/master..."
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
          </select>
          <select
            name="customerId"
            defaultValue={customerId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} - {customer.legalName}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="BOOKING_REQUESTED">Booking Requested</option>
            <option value="BOOKING_CONFIRMED">Booking Confirmed</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
            <option value="CUSTOMS">Customs</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
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
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Refs</th>
              <th className="px-4 py-3">ETD</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={10}>
                  No shipments found.
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr key={shipment.id} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-medium">
                    <div>{shipment.shipmentNumber}</div>
                    <div className="text-xs text-slate-500">
                      {shipment.quote ? `Quote ${shipment.quote.quoteNumber}` : "No quote"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{shipment.customer.legalName}</td>
                  <td className="px-4 py-3">{shipment.mode}</td>
                  <td className="px-4 py-3">{shipment.direction}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(shipment.status)}`}
                    >
                      {statusLabel(shipment.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {shipment.originCode || shipment.destinationCode
                      ? `${shipment.originCode ?? "-"} → ${shipment.destinationCode ?? "-"}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>BKG: {shipment.bookingRef ?? "-"}</div>
                    <div>H: {shipment.houseRef ?? "-"}</div>
                    <div>M: {shipment.masterRef ?? "-"}</div>
                  </td>
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
