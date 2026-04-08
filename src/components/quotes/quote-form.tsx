"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/format";
import type { QuoteActionState } from "@/app/(dashboard)/quotes/actions";

type QuoteDefaults = {
  id?: string;
  customerId?: string;
  mode?: string;
  direction?: string;
  origin?: string | null;
  destination?: string | null;
  incotermCode?: string | null;
  commodity?: string | null;
  validUntil?: string | null;
  currencyCode?: string;
  internalNotes?: string | null;
  freightSell?: number;
  originChargesSell?: number;
  destinationChargesSell?: number;
  additionalChargesSell?: number;
  freightCost?: number;
  originChargesCost?: number;
  destinationChargesCost?: number;
  additionalChargesCost?: number;
};

type QuoteFormProps = {
  action: (
    prevState: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  defaults?: QuoteDefaults;
  customers: Array<{ id: string; code: string; legalName: string }>;
  submitLabel: string;
  readOnly?: boolean;
};

const initialState: QuoteActionState = { success: false };

const modeOptions = ["AIR", "OCEAN", "ROAD"] as const;
const directionOptions = ["IMPORT", "EXPORT"] as const;

const pricingRows = [
  { label: "Freight", sellName: "freightSell", costName: "freightCost" },
  { label: "Origin charges", sellName: "originChargesSell", costName: "originChargesCost" },
  { label: "Destination charges", sellName: "destinationChargesSell", costName: "destinationChargesCost" },
  { label: "Additional charges", sellName: "additionalChargesSell", costName: "additionalChargesCost" },
] as const;

type PricingKey =
  | "freightSell" | "originChargesSell" | "destinationChargesSell" | "additionalChargesSell"
  | "freightCost" | "originChargesCost" | "destinationChargesCost" | "additionalChargesCost";

export function QuoteForm({ action, defaults, customers, submitLabel, readOnly }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  const [pricing, setPricing] = useState<Record<PricingKey, number>>(() => ({
    freightSell: defaults?.freightSell ?? 0,
    originChargesSell: defaults?.originChargesSell ?? 0,
    destinationChargesSell: defaults?.destinationChargesSell ?? 0,
    additionalChargesSell: defaults?.additionalChargesSell ?? 0,
    freightCost: defaults?.freightCost ?? 0,
    originChargesCost: defaults?.originChargesCost ?? 0,
    destinationChargesCost: defaults?.destinationChargesCost ?? 0,
    additionalChargesCost: defaults?.additionalChargesCost ?? 0,
  }));

  useEffect(() => {
    if (state.success) {
      router.push("/quotes");
      router.refresh();
    }
  }, [router, state.success]);

  function setField(key: PricingKey, val: number) {
    setPricing((prev) => ({ ...prev, [key]: val }));
  }

  const totalSell =
    pricing.freightSell + pricing.originChargesSell +
    pricing.destinationChargesSell + pricing.additionalChargesSell;
  const totalCost =
    pricing.freightCost + pricing.originChargesCost +
    pricing.destinationChargesCost + pricing.additionalChargesCost;
  const margin = totalSell - totalCost;
  const marginPct = totalSell > 0 ? (margin / totalSell) * 100 : 0;

  const dis = readOnly;

  return (
    <form action={formAction} className="space-y-6">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quote Details</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
            <select name="customerId" required disabled={dis} defaultValue={defaults?.customerId ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500">
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.legalName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
            <select name="mode" required disabled={dis} defaultValue={defaults?.mode ?? "OCEAN"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500">
              {modeOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Direction *</label>
            <select name="direction" required disabled={dis} defaultValue={defaults?.direction ?? "IMPORT"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500">
              {directionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incoterm</label>
            <input name="incotermCode" disabled={dis} defaultValue={defaults?.incotermCode ?? ""}
              placeholder="FOB, CIF, EXW, DDP…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Origin (POL)</label>
            <input name="origin" disabled={dis} defaultValue={defaults?.origin ?? ""}
              placeholder="CNSHA, MIA, ARBUE…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destination (POD)</label>
            <input name="destination" disabled={dis} defaultValue={defaults?.destination ?? ""}
              placeholder="ARBUE, EZE, CNSHA…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Commodity</label>
            <input name="commodity" disabled={dis} defaultValue={defaults?.commodity ?? ""}
              placeholder="Electronic components, soybean meal…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valid Until</label>
            <input type="date" name="validUntil" disabled={dis}
              defaultValue={defaults?.validUntil ? new Date(defaults.validUntil).toISOString().split("T")[0] : ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <select name="currencyCode" disabled={dis} defaultValue={defaults?.currencyCode ?? "USD"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Internal Notes</label>
          <textarea name="internalNotes" rows={2} disabled={dis} defaultValue={defaults?.internalNotes ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 text-left font-medium text-slate-500 w-[36%]">Concept</th>
                <th className="pb-2 text-right font-medium text-slate-500 w-[32%]">Sell (Revenue)</th>
                <th className="pb-2 text-right font-medium text-slate-500 w-[32%]">Cost (Buy)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pricingRows.map((row) => (
                <tr key={row.sellName}>
                  <td className="py-2.5 text-slate-700 font-medium">{row.label}</td>
                  <td className="py-2.5">
                    <input type="number" step="0.01" min={0} name={row.sellName}
                      value={pricing[row.sellName]}
                      onChange={(e) => setField(row.sellName, parseFloat(e.target.value) || 0)}
                      disabled={dis}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-500" />
                  </td>
                  <td className="py-2.5 pl-2">
                    <input type="number" step="0.01" min={0} name={row.costName}
                      value={pricing[row.costName]}
                      onChange={(e) => setField(row.costName, parseFloat(e.target.value) || 0)}
                      disabled={dis}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Margin summary */}
        <div className="grid gap-3 md:grid-cols-4 border-t border-slate-200 pt-3">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Total Sell</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMoney(totalSell)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Total Cost</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMoney(totalCost)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${margin >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className="text-xs text-slate-500">Gross Margin</p>
            <p className={`text-lg font-semibold tabular-nums ${margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatMoney(margin)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Margin %</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{marginPct.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {!readOnly && (
        <button type="submit" disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Saving…" : submitLabel}
        </button>
      )}
    </form>
  );
}
