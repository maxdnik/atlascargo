"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuoteCustomsClearanceScope,
  QuoteLoadType,
  QuoteServiceScope,
  TradeDirection,
  TransportMode,
  type Currency,
  type Customer,
  type Incoterm,
} from "@prisma/client";

import type { QuoteActionState } from "@/app/(dashboard)/quotes/actions";

type QuoteFormProps = {
  action: (prevState: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;
  submitLabel: string;
  customers: Array<Pick<Customer, "id" | "code" | "legalName">>;
  currencies: Array<Pick<Currency, "code" | "name">>;
  incoterms: Array<Pick<Incoterm, "code" | "description">>;
  redirectTo?: string;
  defaults?: {
    id?: string;
    customerId?: string;
    mode?: TransportMode;
    direction?: TradeDirection;
    currencyCode?: string;
    loadType?: QuoteLoadType | null;
    packageCount?: number | null;
    packageType?: string | null;
    grossWeightKg?: string | null;
    volumeM3?: string | null;
    cargoReadyDate?: string | null;
    serviceScope?: QuoteServiceScope | null;
    customerReference?: string | null;
    insuranceRequired?: boolean;
    customsClearanceScope?: QuoteCustomsClearanceScope;
    equipmentType?: string | null;
    incotermCode?: string | null;
    originCode?: string | null;
    destinationCode?: string | null;
    validUntil?: string | null;
    commodity?: string | null;
    internalNotes?: string | null;
    charges?: Array<{
      concept?: string | null;
      providerName?: string | null;
      buyAmount?: string | null;
      sellAmount?: string | null;
      currencyCode?: string | null;
    }>;
  };
};

const initialState: QuoteActionState = { success: false };

const modeOptions: TransportMode[] = [
  TransportMode.AIR,
  TransportMode.OCEAN,
  TransportMode.ROAD,
  TransportMode.COURIER,
];

const directionOptions: TradeDirection[] = [TradeDirection.IMPORT, TradeDirection.EXPORT];

type ChargeRow = {
  id: string;
  concept: string;
  providerName: string;
  buyAmount: string;
  sellAmount: string;
  currencyCode: string;
};

function createChargeRow(currencyCode: string): ChargeRow {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    concept: "",
    providerName: "",
    buyAmount: "",
    sellAmount: "",
    currencyCode,
  };
}

function createChargeRowsFromDefaults(
  rows: NonNullable<QuoteFormProps["defaults"]>["charges"],
  fallbackCurrency: string,
): ChargeRow[] {
  if (!rows || rows.length === 0) {
    return [createChargeRow(fallbackCurrency)];
  }
  return rows.map((row, index) => ({
    id: `default-${index}`,
    concept: row.concept ?? "",
    providerName: row.providerName ?? "",
    buyAmount: row.buyAmount ?? "",
    sellAmount: row.sellAmount ?? "",
    currencyCode: row.currencyCode ?? fallbackCurrency,
  }));
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function QuoteForm({
  action,
  submitLabel,
  customers,
  currencies,
  incoterms,
  redirectTo = "/quotes",
  defaults,
}: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const initialCurrency = defaults?.currencyCode ?? "USD";
  const [charges, setCharges] = useState<ChargeRow[]>(() => createChargeRowsFromDefaults(defaults?.charges, initialCurrency));
  const [selectedCurrency, setSelectedCurrency] = useState(initialCurrency);

  useEffect(() => {
    if (state.success) {
      router.push(redirectTo);
      router.refresh();
    }
  }, [redirectTo, router, state.success]);

  const totals = useMemo(() => {
    const totalBuy = charges.reduce((sum, row) => sum + toNumber(row.buyAmount), 0);
    const totalSell = charges.reduce((sum, row) => sum + toNumber(row.sellAmount), 0);
    const marginAmount = totalSell - totalBuy;
    const marginPct = totalSell > 0 ? (marginAmount / totalSell) * 100 : 0;
    return { totalBuy, totalSell, marginAmount, marginPct };
  }, [charges]);

  const chargesPayload = useMemo(
    () =>
      JSON.stringify(
        charges.map((row) => ({
          concept: row.concept.trim(),
          providerName: row.providerName.trim(),
          buyAmount: toNumber(row.buyAmount),
          sellAmount: toNumber(row.sellAmount),
          currencyCode: (row.currencyCode || selectedCurrency).trim().toUpperCase(),
        })),
      ),
    [charges, selectedCurrency],
  );

  const updateCharge = (id: string, field: keyof ChargeRow, value: string) => {
    setCharges((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleQuoteCurrencyChange = (value: string) => {
    setSelectedCurrency(value);
    setCharges((prev) =>
      prev.map((row) => ({
        ...row,
        currencyCode: value,
      })),
    );
  };

  const addCharge = () => {
    setCharges((prev) => [...prev, createChargeRow(selectedCurrency)]);
  };

  const removeCharge = (id: string) => {
    setCharges((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  };

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Core quote data</h2>
        <p className="text-xs text-slate-500">
          Start with a lightweight draft: customer, mode, direction, origin, and destination.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
            <select
              name="customerId"
              required
              defaultValue={defaults?.customerId ?? ""}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <select
              name="currencyCode"
              defaultValue={defaults?.currencyCode ?? "USD"}
              onChange={(event) => handleQuoteCurrencyChange(event.target.value)}
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
              defaultValue={defaults?.mode ?? TransportMode.OCEAN}
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
              defaultValue={defaults?.direction ?? TradeDirection.EXPORT}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Shipment type / load type</label>
            <select
              name="loadType"
              defaultValue={defaults?.loadType ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select load type</option>
              {Object.values(QuoteLoadType).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer reference</label>
            <input
              name="customerReference"
              placeholder="PO / RFQ / customer reference"
              defaultValue={defaults?.customerReference ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
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
              defaultValue={defaults?.incotermCode ?? ""}
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
              defaultValue={defaults?.validUntil ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Origin code *</label>
            <input
              name="originCode"
              required
              placeholder="Origin code (e.g. ARBUE, CNSHA, JFK)"
              defaultValue={defaults?.originCode ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destination code *</label>
            <input
              name="destinationCode"
              required
              placeholder="Destination code (e.g. USMIA, DEHAM, CLVAP)"
              defaultValue={defaults?.destinationCode ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Service scope</label>
            <select
              name="serviceScope"
              defaultValue={defaults?.serviceScope ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select service scope</option>
              {Object.values(QuoteServiceScope).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Commodity</label>
            <input
              name="commodity"
              placeholder="Commodity description"
              defaultValue={defaults?.commodity ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cargo ready date</label>
            <input
              type="date"
              name="cargoReadyDate"
              defaultValue={defaults?.cargoReadyDate ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cargo details</h2>
        <p className="mt-1 text-xs text-slate-500">Optional at draft stage. Complete when commercial data is ready.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Packages</label>
            <input
              type="number"
              min={1}
              name="packageCount"
              defaultValue={defaults?.packageCount ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Package type</label>
            <input
              name="packageType"
              placeholder="pallets, cartons, crates..."
              defaultValue={defaults?.packageType ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Gross weight (kg)</label>
            <input
              type="number"
              min={0.001}
              step="0.001"
              name="grossWeightKg"
              defaultValue={defaults?.grossWeightKg ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Volume (m3)</label>
            <input
              type="number"
              min={0.001}
              step="0.001"
              name="volumeM3"
              defaultValue={defaults?.volumeM3 ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Equipment type</label>
            <input
              name="equipmentType"
              placeholder="20DV, 40HC, REEFER..."
              defaultValue={defaults?.equipmentType ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Services / notes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="insuranceRequired"
              defaultChecked={defaults?.insuranceRequired ?? false}
              className="h-4 w-4 rounded border-slate-300"
            />
            Insurance required
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customs clearance required</label>
            <select
              name="customsClearanceScope"
              defaultValue={defaults?.customsClearanceScope ?? QuoteCustomsClearanceScope.NONE}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.values(QuoteCustomsClearanceScope).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Internal notes</label>
            <textarea
              name="internalNotes"
              rows={3}
              defaultValue={defaults?.internalNotes ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Internal commercial notes (optional)"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Pricing / charges</h2>
          <button
            type="button"
            onClick={addCharge}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Add charge
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Tip: you can save a draft without pricing and complete charges later.
        </p>

        <input type="hidden" name="chargesJson" value={chargesPayload} />

        <div className="space-y-2">
          {charges.map((charge, index) => (
            <div
              key={charge.id}
              className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">Concept</label>
                <input
                  value={charge.concept}
                  onChange={(event) => updateCharge(charge.id, "concept", event.target.value)}
                  placeholder="Freight, THC, Docs..."
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Provider</label>
                <input
                  value={charge.providerName}
                  onChange={(event) => updateCharge(charge.id, "providerName", event.target.value)}
                  placeholder="Carrier / agent"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Buy</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={charge.buyAmount}
                  onChange={(event) => updateCharge(charge.id, "buyAmount", event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Sell</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={charge.sellAmount}
                  onChange={(event) => updateCharge(charge.id, "sellAmount", event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Currency</label>
                <select
                  value={charge.currencyCode}
                  onChange={(event) => updateCharge(charge.id, "currencyCode", event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1 md:flex md:items-end md:justify-end">
                <button
                  type="button"
                  onClick={() => removeCharge(charge.id)}
                  disabled={charges.length === 1}
                  className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
              <div className="md:col-span-12 text-xs text-slate-500">
                Line {index + 1} margin:{" "}
                <span className="font-medium text-slate-700">{money(toNumber(charge.sellAmount) - toNumber(charge.buyAmount))}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total buy</p>
            <p className="font-semibold text-slate-900">{money(totals.totalBuy)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total sell</p>
            <p className="font-semibold text-slate-900">{money(totals.totalSell)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Margin</p>
            <p className={`font-semibold ${totals.marginAmount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {money(totals.marginAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Margin %</p>
            <p className={`font-semibold ${totals.marginAmount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {totals.marginPct.toFixed(2)}%
            </p>
          </div>
        </div>
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
