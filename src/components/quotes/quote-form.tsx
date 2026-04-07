"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";

import { formatMoney } from "@/lib/format";
import type { QuoteActionState } from "@/app/(dashboard)/quotes/actions";

type ChargeRow = {
  key: string;
  concept: string;
  chargeType: string;
  buyAmount: number;
  sellAmount: number;
};

type QuoteDefaults = {
  id?: string;
  customerId?: string;
  mode?: string;
  direction?: string;
  origin?: string | null;
  destination?: string | null;
  incotermCode?: string | null;
  validUntil?: string | null;
  currencyCode?: string;
  internalNotes?: string | null;
  charges?: Array<{
    concept: string;
    chargeType: string | null;
    buyAmount: unknown;
    sellAmount: unknown;
  }>;
};

type QuoteFormProps = {
  action: (
    prevState: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  defaults?: QuoteDefaults;
  customers: Array<{ id: string; code: string; legalName: string }>;
  submitLabel: string;
  isLocked?: boolean;
};

const modeOptions = ["AIR", "OCEAN", "ROAD", "RAIL", "MULTIMODAL", "SPECIAL"];
const directionOptions = ["IMPORT", "EXPORT", "CROSS_TRADE"];
const chargeTypes = [
  { value: "FREIGHT", label: "Freight" },
  { value: "ORIGIN", label: "Origin Charges" },
  { value: "DESTINATION", label: "Destination Charges" },
  { value: "ADDITIONAL", label: "Additional Charges" },
];

const initialState: QuoteActionState = { success: false };

let keyCounter = 0;
function nextKey() {
  return `charge_${++keyCounter}`;
}

export function QuoteForm({ action, defaults, customers, submitLabel, isLocked }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  const initCharges = useCallback((): ChargeRow[] => {
    if (defaults?.charges && defaults.charges.length > 0) {
      return defaults.charges.map((c) => ({
        key: nextKey(),
        concept: c.concept,
        chargeType: c.chargeType ?? "FREIGHT",
        buyAmount: Number(c.buyAmount ?? 0),
        sellAmount: Number(c.sellAmount ?? 0),
      }));
    }
    return [];
  }, [defaults?.charges]);

  const [charges, setCharges] = useState<ChargeRow[]>(initCharges);

  useEffect(() => {
    if (state.success) {
      router.push("/quotes");
      router.refresh();
    }
  }, [router, state.success]);

  function addCharge() {
    setCharges((prev) => [
      ...prev,
      { key: nextKey(), concept: "", chargeType: "FREIGHT", buyAmount: 0, sellAmount: 0 },
    ]);
  }

  function removeCharge(key: string) {
    setCharges((prev) => prev.filter((c) => c.key !== key));
  }

  function updateCharge(key: string, field: keyof ChargeRow, value: string | number) {
    setCharges((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)),
    );
  }

  const totalSell = charges.reduce((s, c) => s + c.sellAmount, 0);
  const totalBuy = charges.reduce((s, c) => s + c.buyAmount, 0);
  const margin = totalSell - totalBuy;
  const marginPct = totalSell > 0 ? (margin / totalSell) * 100 : 0;

  function onSubmit(formData: FormData) {
    const serialized = charges.map(({ concept, chargeType, buyAmount, sellAmount }) => ({
      concept,
      chargeType,
      buyAmount,
      sellAmount,
    }));
    formData.set("charges", JSON.stringify(serialized));
    formAction(formData);
  }

  return (
    <form action={onSubmit} className="space-y-6">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      {/* Header fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Quote Details
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
            <select
              name="customerId"
              required
              disabled={isLocked}
              defaultValue={defaults?.customerId ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.legalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
            <select
              name="mode"
              required
              disabled={isLocked}
              defaultValue={defaults?.mode ?? "OCEAN"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {modeOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Direction *</label>
            <select
              name="direction"
              required
              disabled={isLocked}
              defaultValue={defaults?.direction ?? "IMPORT"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {directionOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incoterm</label>
            <input
              name="incotermCode"
              disabled={isLocked}
              defaultValue={defaults?.incotermCode ?? ""}
              placeholder="FOB, EXW, CIF, DDP..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Origin (POL)</label>
            <input
              name="origin"
              disabled={isLocked}
              defaultValue={defaults?.origin ?? ""}
              placeholder="CNSHA, MIA..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Destination (POD)</label>
            <input
              name="destination"
              disabled={isLocked}
              defaultValue={defaults?.destination ?? ""}
              placeholder="ARBUE, EZE..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valid Until</label>
            <input
              type="date"
              name="validUntil"
              disabled={isLocked}
              defaultValue={
                defaults?.validUntil
                  ? new Date(defaults.validUntil).toISOString().split("T")[0]
                  : ""
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <select
              name="currencyCode"
              disabled={isLocked}
              defaultValue={defaults?.currencyCode ?? "USD"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Internal Notes</label>
          <textarea
            name="internalNotes"
            rows={2}
            disabled={isLocked}
            defaultValue={defaults?.internalNotes ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          />
        </div>
      </div>

      {/* Pricing Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Pricing
          </h3>
          {!isLocked && (
            <button
              type="button"
              onClick={addCharge}
              className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-3 w-3" /> Add Line
            </button>
          )}
        </div>

        {charges.length === 0 && (
          <p className="text-sm text-slate-500">
            No pricing lines yet. Add freight, origin, destination, or additional charges.
          </p>
        )}

        {charges.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 font-medium text-slate-500 w-[30%]">Concept</th>
                  <th className="pb-2 font-medium text-slate-500 w-[22%]">Type</th>
                  <th className="pb-2 font-medium text-slate-500 text-right w-[18%]">Buy (Cost)</th>
                  <th className="pb-2 font-medium text-slate-500 text-right w-[18%]">Sell (Revenue)</th>
                  <th className="pb-2 w-[12%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {charges.map((charge) => (
                  <tr key={charge.key}>
                    <td className="py-2 pr-2">
                      <input
                        value={charge.concept}
                        onChange={(e) => updateCharge(charge.key, "concept", e.target.value)}
                        disabled={isLocked}
                        placeholder="e.g. Ocean Freight"
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={charge.chargeType}
                        onChange={(e) => updateCharge(charge.key, "chargeType", e.target.value)}
                        disabled={isLocked}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                      >
                        {chargeTypes.map((ct) => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={charge.buyAmount}
                        onChange={(e) => updateCharge(charge.key, "buyAmount", parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums disabled:bg-slate-100"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={charge.sellAmount}
                        onChange={(e) => updateCharge(charge.key, "sellAmount", parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums disabled:bg-slate-100"
                      />
                    </td>
                    <td className="py-2 text-center">
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeCharge(charge.key)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Live Totals */}
        {charges.length > 0 && (
          <div className="grid gap-3 md:grid-cols-4 border-t border-slate-200 pt-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">Total Sell</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMoney(totalSell)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">Total Cost</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMoney(totalBuy)}</p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                margin >= 0 ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <p className="text-xs text-slate-500">Gross Margin</p>
              <p
                className={`text-lg font-semibold tabular-nums ${
                  margin >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatMoney(margin)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">Margin %</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums">
                {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      {!isLocked && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
      )}
    </form>
  );
}
