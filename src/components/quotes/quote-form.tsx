"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TradeDirection, TransportMode, type Currency, type Customer, type Incoterm } from "@prisma/client";

import type { QuoteActionState } from "@/app/(dashboard)/quotes/actions";

type QuoteFormProps = {
  action: (prevState: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;
  submitLabel: string;
  customers: Array<Pick<Customer, "id" | "code" | "legalName">>;
  currencies: Array<Pick<Currency, "code" | "name">>;
  incoterms: Array<Pick<Incoterm, "code" | "description">>;
  originOptions: string[];
  destinationOptions: string[];
};

const initialState: QuoteActionState = { success: false };

const modeOptions: TransportMode[] = [
  TransportMode.AIR,
  TransportMode.OCEAN,
  TransportMode.ROAD,
  TransportMode.COURIER,
];

const directionOptions: TradeDirection[] = [TradeDirection.IMPORT, TradeDirection.EXPORT];

export function QuoteForm({
  action,
  submitLabel,
  customers,
  currencies,
  incoterms,
  originOptions,
  destinationOptions,
}: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/quotes");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Core quote data</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
            <select
              name="customerId"
              required
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency *</label>
            <select
              name="currencyCode"
              required
              defaultValue="USD"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
            <select
              name="mode"
              required
              defaultValue={TransportMode.OCEAN}
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
              defaultValue={TradeDirection.EXPORT}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {directionOptions.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Routing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incoterm</label>
            <select
              name="incotermCode"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select incoterm</option>
              {incoterms.map((incoterm) => (
                <option key={incoterm.code} value={incoterm.code}>
                  {incoterm.code} - {incoterm.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valid until</label>
            <input
              type="date"
              name="validUntil"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Origin code</label>
            <select
              name="originCode"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select origin code</option>
              {originOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destination code</label>
            <select
              name="destinationCode"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select destination code</option>
              {destinationOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Commodity</label>
            <input
              name="commodity"
              placeholder="Commodity description"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section>
        <label className="mb-1 block text-sm font-medium text-slate-700">Internal notes</label>
        <textarea
          name="internalNotes"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Internal commercial notes (optional)"
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
