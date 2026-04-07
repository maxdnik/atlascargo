import { formatMoney } from "@/lib/format";

type Charge = {
  id: string;
  concept: string;
  chargeType: string | null;
  buyAmount: unknown;
  sellAmount: unknown;
};

type PricingBreakdownProps = {
  charges: Charge[];
  totalBuy: unknown;
  totalSell: unknown;
  marginAmount: unknown;
  marginPct: unknown;
  currencyCode: string;
};

const chargeTypeLabels: Record<string, string> = {
  FREIGHT: "Freight",
  ORIGIN: "Origin Charges",
  DESTINATION: "Destination Charges",
  ADDITIONAL: "Additional Charges",
};

type GroupedCharges = Record<string, Charge[]>;

export function PricingBreakdown({
  charges,
  totalBuy,
  totalSell,
  marginAmount,
  marginPct,
}: PricingBreakdownProps) {
  const numBuy = Number(totalBuy ?? 0);
  const numSell = Number(totalSell ?? 0);
  const numMargin = Number(marginAmount ?? 0);
  const numPct = Number(marginPct ?? 0);

  const grouped = charges.reduce<GroupedCharges>((acc, charge) => {
    const type = charge.chargeType ?? "ADDITIONAL";
    if (!acc[type]) acc[type] = [];
    acc[type].push(charge);
    return acc;
  }, {});

  const sellGroups = ["FREIGHT", "ORIGIN", "DESTINATION", "ADDITIONAL"].filter(
    (t) => grouped[t] && grouped[t].length > 0,
  );

  if (charges.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Pricing</h3>
        <p className="mt-2 text-sm text-slate-500">
          No pricing has been defined for this quote yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sell Side */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Sell Side (to Client)
        </h3>
        <div className="space-y-3">
          {sellGroups.map((type) => (
            <div key={type}>
              <p className="text-xs font-medium text-slate-500 mb-1">
                {chargeTypeLabels[type] ?? type}
              </p>
              <div className="divide-y divide-slate-100">
                {grouped[type].map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-700">{charge.concept}</span>
                    <span className="text-sm font-medium text-slate-900 tabular-nums">
                      {formatMoney(Number(charge.sellAmount ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Total Sell</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {formatMoney(numSell)}
            </span>
          </div>
        </div>
      </div>

      {/* Buy Side */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Buy Side (Costs)
        </h3>
        <div className="space-y-1">
          {charges.map((charge) => (
            <div key={charge.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-700">
                {charge.concept}
                <span className="ml-1.5 text-xs text-slate-400">
                  ({chargeTypeLabels[charge.chargeType ?? ""] ?? charge.chargeType})
                </span>
              </span>
              <span className="text-sm font-medium text-slate-900 tabular-nums">
                {formatMoney(Number(charge.buyAmount ?? 0))}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Total Cost</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {formatMoney(numBuy)}
            </span>
          </div>
        </div>
      </div>

      {/* Margin */}
      <div
        className={`rounded-xl border p-5 ${
          numMargin >= 0
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <h3 className="mb-2 text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Gross Margin
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold tabular-nums">
              {formatMoney(numMargin)}
            </span>
            <span className="ml-2 text-sm text-slate-600">
              ({(numPct * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Sell {formatMoney(numSell)}</p>
            <p>Cost {formatMoney(numBuy)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
