"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  createShipmentFromQuoteAction,
  type ShipmentActionState,
} from "@/app/(dashboard)/shipments/actions";

type QuoteOption = {
  id: string;
  quoteNumber: string;
  customerName: string;
  mode: string;
  direction: string;
};

const initialState: ShipmentActionState = { success: false };

type QuoteToShipmentFormProps = {
  quotes: QuoteOption[];
};

export function QuoteToShipmentForm({ quotes }: QuoteToShipmentFormProps) {
  const [state, formAction, pending] = useActionState(createShipmentFromQuoteAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/shipments");
      router.refresh();
    }
  }, [router, state.success]);

  if (quotes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No approved quotes available for conversion. Approve a quote first.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        Convert approved quote
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Approved Quote</label>
          <select
            name="quoteId"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select approved quote</option>
            {quotes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.quoteNumber} - {quote.customerName} ({quote.mode}/{quote.direction})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">New Shipment #</label>
          <input
            name="shipmentNumber"
            required
            placeholder="SHP-2026-0003"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Converting..." : "Create Shipment from Quote"}
      </button>
    </form>
  );
}
