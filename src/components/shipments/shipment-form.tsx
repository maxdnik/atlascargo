"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShipmentStatus, TradeDirection, TransportMode } from "@prisma/client";

import type { ShipmentActionState } from "@/app/(dashboard)/shipments/actions";

type ShipmentDefaults = {
  id?: string;
  shipmentNumber?: string;
  customerId?: string;
  mode?: TransportMode;
  direction?: TradeDirection;
  status?: ShipmentStatus;
  incotermCode?: string;
  referenceClient?: string;
  referenceInternal?: string;
  bookingRef?: string;
  houseRef?: string;
  masterRef?: string;
  commodity?: string;
  packageCount?: number | null;
  grossWeightKg?: string | null;
  volumeM3?: string | null;
  etd?: string;
  eta?: string;
  atd?: string;
  ata?: string;
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

const modeOptions: TransportMode[] = ["AIR", "OCEAN", "ROAD", "SPECIAL"];
const directionOptions: TradeDirection[] = ["IMPORT", "EXPORT", "CROSS_TRADE"];
const statusOptions: ShipmentStatus[] = [
  "DRAFT",
  "OPEN",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "INVOICED",
  "CLOSED",
  "CANCELLED",
];

export function ShipmentForm({ action, defaults, customers, submitLabel }: ShipmentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/shipments");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
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
          <select
            name="customerId"
            required
            defaultValue={defaults?.customerId ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
          <select
            name="mode"
            required
            defaultValue={defaults?.mode ?? "OCEAN"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <select
            name="direction"
            required
            defaultValue={defaults?.direction ?? "EXPORT"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {directionOptions.map((direction) => (
              <option key={direction} value={direction}>
                {direction}
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
                {status}
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Client Ref</label>
          <input
            name="referenceClient"
            defaultValue={defaults?.referenceClient ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Internal Ref</label>
          <input
            name="referenceInternal"
            defaultValue={defaults?.referenceInternal ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Booking Ref</label>
          <input
            name="bookingRef"
            defaultValue={defaults?.bookingRef ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">House Ref</label>
          <input
            name="houseRef"
            defaultValue={defaults?.houseRef ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Master Ref</label>
          <input
            name="masterRef"
            defaultValue={defaults?.masterRef ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Packages</label>
          <input
            type="number"
            min={0}
            name="packageCount"
            defaultValue={defaults?.packageCount ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Gross Weight (kg)</label>
          <input
            type="number"
            step="0.001"
            min={0}
            name="grossWeightKg"
            defaultValue={defaults?.grossWeightKg ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Volume (m3)</label>
          <input
            type="number"
            step="0.001"
            min={0}
            name="volumeM3"
            defaultValue={defaults?.volumeM3 ?? ""}
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
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

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
