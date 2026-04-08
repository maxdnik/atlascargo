"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShipmentStatus, TradeDirection, TransportMode } from "@prisma/client";

import type { ShipmentActionState } from "@/app/(dashboard)/shipments/actions";

type ShipmentDefaults = {
  id?: string;
  shipmentNumber?: string;
  customerId?: string;
  quoteId?: string;
  quoteNumber?: string;
  mode?: TransportMode;
  direction?: TradeDirection;
  status?: ShipmentStatus;
  incotermCode?: string;
  serviceLevel?: string;
  originCode?: string;
  destinationCode?: string;
  pol?: string;
  pod?: string;
  airportOrigin?: string;
  airportDestination?: string;
  placeOfReceipt?: string;
  placeOfDelivery?: string;
  shipperName?: string;
  consigneeName?: string;
  notifyPartyName?: string;
  agentOriginName?: string;
  agentDestinationName?: string;
  carrierName?: string;
  vesselOrFlight?: string;
  referenceClient?: string;
  referenceInternal?: string;
  bookingRef?: string;
  houseRef?: string;
  masterRef?: string;
  commodity?: string;
  packageCount?: number | null;
  packageType?: string;
  grossWeightKg?: string | null;
  chargeableWeightKg?: string | null;
  volumeM3?: string | null;
  containerCount?: number | null;
  containerType?: string;
  cargoReadyDate?: string;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
  deliveredAt?: string;
  notes?: string;
};

type ShipmentFormProps = {
  action: (
    prevState: ShipmentActionState,
    formData: FormData,
  ) => Promise<ShipmentActionState>;
  defaults?: ShipmentDefaults;
  customers: Array<{ id: string; code: string; legalName: string }>;
  submitLabel: string;
};

const initialState: ShipmentActionState = { success: false };

const modeOptions: TransportMode[] = ["AIR", "OCEAN", "ROAD"];
const directionOptions: TradeDirection[] = ["IMPORT", "EXPORT"];
const statusOptions: ShipmentStatus[] = [
  "DRAFT",
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
];

function statusLabel(status: ShipmentStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ShipmentForm({ action, defaults, customers, submitLabel }: ShipmentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const fromQuote = Boolean(defaults?.quoteId);

  useEffect(() => {
    if (state.success) {
      router.push("/shipments");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {defaults?.quoteId ? <input type="hidden" name="quoteId" value={defaults.quoteId} /> : null}

      {fromQuote ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          File linked to approved quote <strong>{defaults?.quoteNumber ?? defaults?.quoteId}</strong>. Core
          commercial fields are inherited.
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Core</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shipment # *</label>
            <input
              name="shipmentNumber"
              required
              defaultValue={defaults?.shipmentNumber ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
            {fromQuote ? <input type="hidden" name="customerId" value={defaults?.customerId ?? ""} /> : null}
            <select
              name="customerId"
              required
              disabled={fromQuote}
              defaultValue={defaults?.customerId ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
            <select
              name="status"
              required
              defaultValue={defaults?.status ?? "DRAFT"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
            {fromQuote ? <input type="hidden" name="mode" value={defaults?.mode ?? "OCEAN"} /> : null}
            <select
              name="mode"
              required
              disabled={fromQuote}
              defaultValue={defaults?.mode ?? "OCEAN"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {modeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Direction *</label>
            {fromQuote ? (
              <input type="hidden" name="direction" value={defaults?.direction ?? "EXPORT"} />
            ) : null}
            <select
              name="direction"
              required
              disabled={fromQuote}
              defaultValue={defaults?.direction ?? "EXPORT"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {directionOptions.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incoterm</label>
            <input
              name="incotermCode"
              defaultValue={defaults?.incotermCode ?? ""}
              placeholder="FOB, EXW, CIF..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Commodity</label>
            <input
              name="commodity"
              defaultValue={defaults?.commodity ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Service Level</label>
            <input
              name="serviceLevel"
              defaultValue={defaults?.serviceLevel ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Parties</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="shipperName"
            defaultValue={defaults?.shipperName ?? ""}
            placeholder="Shipper"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="consigneeName"
            defaultValue={defaults?.consigneeName ?? ""}
            placeholder="Consignee"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="notifyPartyName"
            defaultValue={defaults?.notifyPartyName ?? ""}
            placeholder="Notify party"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="agentOriginName"
            defaultValue={defaults?.agentOriginName ?? ""}
            placeholder="Origin agent"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="agentDestinationName"
            defaultValue={defaults?.agentDestinationName ?? ""}
            placeholder="Destination agent"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Routing</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <input
            name="originCode"
            defaultValue={defaults?.originCode ?? ""}
            placeholder="Origin code"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="destinationCode"
            defaultValue={defaults?.destinationCode ?? ""}
            placeholder="Destination code"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="pol"
            defaultValue={defaults?.pol ?? ""}
            placeholder="Port of loading (POL)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="pod"
            defaultValue={defaults?.pod ?? ""}
            placeholder="Port of discharge (POD)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="airportOrigin"
            defaultValue={defaults?.airportOrigin ?? ""}
            placeholder="Airport origin"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="airportDestination"
            defaultValue={defaults?.airportDestination ?? ""}
            placeholder="Airport destination"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
          <input
            name="placeOfReceipt"
            defaultValue={defaults?.placeOfReceipt ?? ""}
            placeholder="Place of receipt"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="placeOfDelivery"
            defaultValue={defaults?.placeOfDelivery ?? ""}
            placeholder="Place of delivery"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Transport references
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <input
            name="carrierName"
            defaultValue={defaults?.carrierName ?? ""}
            placeholder="Carrier"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="vesselOrFlight"
            defaultValue={defaults?.vesselOrFlight ?? ""}
            placeholder="Vessel or flight"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="bookingRef"
            defaultValue={defaults?.bookingRef ?? ""}
            placeholder="Booking ref"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="houseRef"
            defaultValue={defaults?.houseRef ?? ""}
            placeholder="House ref"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="masterRef"
            defaultValue={defaults?.masterRef ?? ""}
            placeholder="Master ref"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="referenceClient"
            defaultValue={defaults?.referenceClient ?? ""}
            placeholder="Client ref"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="referenceInternal"
            defaultValue={defaults?.referenceInternal ?? ""}
            placeholder="Internal ref"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cargo details</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <input
            type="number"
            min={0}
            name="packageCount"
            defaultValue={defaults?.packageCount ?? ""}
            placeholder="Package count"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="packageType"
            defaultValue={defaults?.packageType ?? ""}
            placeholder="Package type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.001"
            min={0}
            name="grossWeightKg"
            defaultValue={defaults?.grossWeightKg ?? ""}
            placeholder="Gross kg"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.001"
            min={0}
            name="chargeableWeightKg"
            defaultValue={defaults?.chargeableWeightKg ?? ""}
            placeholder="Chargeable kg"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.001"
            min={0}
            name="volumeM3"
            defaultValue={defaults?.volumeM3 ?? ""}
            placeholder="Volume m3"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            name="containerCount"
            defaultValue={defaults?.containerCount ?? ""}
            placeholder="Container count"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="containerType"
            defaultValue={defaults?.containerType ?? ""}
            placeholder="Container type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Operational dates</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cargo Ready</label>
            <input
              type="datetime-local"
              name="cargoReadyDate"
              defaultValue={defaults?.cargoReadyDate ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ETD</label>
            <input
              type="datetime-local"
              name="etd"
              defaultValue={defaults?.etd ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ETA</label>
            <input
              type="datetime-local"
              name="eta"
              defaultValue={defaults?.eta ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ATD</label>
            <input
              type="datetime-local"
              name="atd"
              defaultValue={defaults?.atd ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ATA</label>
            <input
              type="datetime-local"
              name="ata"
              defaultValue={defaults?.ata ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Delivered At</label>
            <input
              type="datetime-local"
              name="deliveredAt"
              defaultValue={defaults?.deliveredAt ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
