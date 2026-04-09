import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { ArrowRight, FileText, Plane, Search, ShipWheel, Truck, TriangleAlert } from "lucide-react";
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
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Shipments Control Board</h1>
          <p className="text-sm text-slate-500">
            Real-time operational files across air, ocean, and road movements.
          </p>
        </div>
        <Link
          href="/shipments/new"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500"
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

      <form className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 md:grid-cols-5 lg:grid-cols-6">
          <div className="relative md:col-span-2 lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search shipment, booking, BL/AWB, refs..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
            />
          </div>
          <select
            name="mode"
            defaultValue={mode ?? ""}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
          >
            <option value="">All modes</option>
            <option value="AIR">Air</option>
            <option value="OCEAN">Ocean</option>
            <option value="ROAD">Road</option>
          </select>
          <select
            name="customerId"
            defaultValue={customerId ?? ""}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
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
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/80">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shipment #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Refs</th>
              <th className="px-4 py-3">ETD</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-500" colSpan={9}>
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <ShipWheel className="h-5 w-5 text-slate-400" />
                    <p className="font-medium text-slate-700">No operational files found</p>
                    <p className="text-xs text-slate-500">
                      Try changing filters or create a shipment from an approved quote.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              shipments.map((shipment) => (
                <tr
                  key={shipment.id}
                  className="text-sm text-slate-700 transition hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(shipment.status)}`}
                    >
                      {statusLabel(shipment.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="font-semibold text-slate-900">{shipment.shipmentNumber}</div>
                    <div className="text-xs text-slate-500">
                      {shipment.quote ? `Quote ${shipment.quote.quoteNumber}` : "No quote"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{shipment.customer.legalName}</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {shipment.mode === "AIR" ? (
                        <Plane className="h-3.5 w-3.5" />
                      ) : shipment.mode === "ROAD" ? (
                        <Truck className="h-3.5 w-3.5" />
                      ) : (
                        <ShipWheel className="h-3.5 w-3.5" />
                      )}
                      {shipment.mode}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{shipment.direction}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1 text-slate-700">
                      <span className="font-medium">{shipment.originCode ?? "-"}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{shipment.destinationCode ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      BKG: {shipment.bookingRef ?? "-"}
                    </div>
                    <div>House: {shipment.houseRef ?? "-"}</div>
                    <div>Master: {shipment.masterRef ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {shipment.etd ? new Date(shipment.etd).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {shipment.status === "IN_TRANSIT" ? (
                        <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                      ) : null}
                      {shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/shipments/${shipment.id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <form action={deleteShipmentDirectAction}>
                        <input type="hidden" name="id" value={shipment.id} />
                        <button
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          type="submit"
                        >
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
