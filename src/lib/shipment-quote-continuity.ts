import {
  FinancialRecordStatus,
  InvoiceStatus,
  Prisma,
  type TradeDirection,
  type TransportMode,
} from "@prisma/client";
import { deriveShipmentFinancialTruth } from "@/lib/finance-truth";

const DAY_MS = 1000 * 60 * 60 * 24;

export type QuoteChargeSnapshot = {
  concept: string;
  chargeType: string | null;
  buyAmount: number;
  sellAmount: number;
  currencyCode: string;
};

export type QuotedSupplierSuggestions = {
  suggestedCarrier: string | null;
  suggestedSupplier: string | null;
  serviceLevelAssumption: string | null;
  routeAssumption: string | null;
};

export type QuoteContinuitySnapshot = {
  quoteId: string;
  quoteNumber: string;
  quotedSellAmount: number;
  quotedCostAmount: number;
  quotedGrossProfit: number;
  quotedMarginPercent: number;
  quotedTransitTimeDays: number | null;
  quotedMode: TransportMode;
  quotedDirection: TradeDirection;
  quotedOrigin: string | null;
  quotedDestination: string | null;
  quotedChargeBreakdown: QuoteChargeSnapshot[];
  quotedSupplierSuggestions: QuotedSupplierSuggestions;
  quotedAssumptionsNotes: string | null;
  quotedCurrencyCode: string;
  capturedAt: string;
};

type QuoteForSnapshot = {
  id: string;
  quoteNumber: string;
  mode: TransportMode;
  direction: TradeDirection;
  originCode: string | null;
  destinationCode: string | null;
  pol: string | null;
  pod: string | null;
  totalSell: Prisma.Decimal | number | string;
  totalBuy: Prisma.Decimal | number | string;
  marginAmount: Prisma.Decimal | number | string;
  marginPct: Prisma.Decimal | number | string;
  currencyCode: string;
  estimatedTransitTimeDays?: number | null;
  suggestedCarrier?: string | null;
  suggestedSupplier?: string | null;
  serviceLevelAssumption?: string | null;
  routeAssumption?: string | null;
  assumptionsNotes?: string | null;
  internalNotes?: string | null;
  serviceLevel?: string | null;
  charges?: Array<{
    concept: string;
    chargeType: string | null;
    buyAmount: Prisma.Decimal | number | string;
    sellAmount: Prisma.Decimal | number | string;
    currencyCode: string;
  }>;
};

type ShipmentLikeForContinuity = {
  quotedSellAmount: Prisma.Decimal | number | string | null;
  quotedCostAmount: Prisma.Decimal | number | string | null;
  quotedGrossProfit: Prisma.Decimal | number | string | null;
  quotedMarginPercent: Prisma.Decimal | number | string | null;
  quotedTransitTimeDays: number | null;
  quotedMode: TransportMode | null;
  quotedDirection: TradeDirection | null;
  quotedOrigin: string | null;
  quotedDestination: string | null;
  quotedAssumptionsNotes: string | null;
  quotedChargeBreakdown: unknown;
  quotedSupplierSuggestions: unknown;
  quoteSnapshot: unknown;
  originCode: string | null;
  destinationCode: string | null;
  pol: string | null;
  pod: string | null;
  carrierName: string | null;
  serviceLevel: string | null;
  atd: Date | null;
  ata: Date | null;
  milestones: Array<{
    code: string;
    actualAt: Date | null;
  }>;
  invoices: Array<{
    status: InvoiceStatus;
    total: Prisma.Decimal | number | string;
  }>;
  revenues: Array<{
    amountBase: Prisma.Decimal | number | string;
    status: FinancialRecordStatus;
  }>;
  shipmentCosts: Array<{
    supplierName: string;
    amount: Prisma.Decimal | number | string;
    conceptCategory: string;
    customConcept: string | null;
  }>;
  expenses: Array<{
    supplierName: string;
    amountBase: Prisma.Decimal | number | string;
    concept: string;
  }>;
  quote?: {
    totalSell: Prisma.Decimal | number | string;
    totalBuy: Prisma.Decimal | number | string;
    marginAmount: Prisma.Decimal | number | string;
    marginPct: Prisma.Decimal | number | string;
    mode: TransportMode;
    direction: TradeDirection;
    originCode: string | null;
    destinationCode: string | null;
    pol: string | null;
    pod: string | null;
    estimatedTransitTimeDays?: number | null;
    suggestedCarrier?: string | null;
    suggestedSupplier?: string | null;
    serviceLevelAssumption?: string | null;
    routeAssumption?: string | null;
    assumptionsNotes?: string | null;
  } | null;
};

export type ShipmentQuoteContinuity = {
  quoted: {
    revenue: number | null;
    cost: number | null;
    grossProfit: number | null;
    marginPercent: number | null;
    transitTimeDays: number | null;
    mode: string | null;
    direction: string | null;
    origin: string | null;
    destination: string | null;
    chargeBreakdown: QuoteChargeSnapshot[];
    supplierSuggestions: QuotedSupplierSuggestions | null;
    assumptionsNotes: string | null;
  };
  actual: {
    revenue: number;
    cost: number;
    grossProfit: number;
    marginPercent: number | null;
    transitTimeDays: number | null;
    supplierCarrier: string | null;
    supplierName: string | null;
    origin: string | null;
    destination: string | null;
  };
  variance: {
    revenue: number | null;
    cost: number | null;
    grossProfit: number | null;
    marginPercent: number | null;
    transitTimeDays: number | null;
  };
  transitPerformanceStatus:
    | "UNKNOWN"
    | "ON_TARGET"
    | "FASTER_THAN_QUOTED"
    | "SLOWER_THAN_QUOTED";
  warnings: {
    marginDroppedBelowQuote: boolean;
    costsExceedQuotedEstimate: boolean;
    transitSlowerThanQuoted: boolean;
    supplierDifferentFromSuggestion: boolean;
  };
};

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumberishUnknown(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") {
    return asNumber(value);
  }
  return null;
}

function asQuotedMarginPercent(value: Prisma.Decimal | number | string | null | undefined) {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseQuotedChargeBreakdown(value: unknown): QuoteChargeSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      const concept = typeof candidate.concept === "string" ? candidate.concept : null;
      if (!concept) return null;
      const chargeType = typeof candidate.chargeType === "string" ? candidate.chargeType : null;
      const buyAmount = asNumber(candidate.buyAmount as Prisma.Decimal | number | string) ?? 0;
      const sellAmount = asNumber(candidate.sellAmount as Prisma.Decimal | number | string) ?? 0;
      const currencyCode =
        typeof candidate.currencyCode === "string" && candidate.currencyCode.length > 0
          ? candidate.currencyCode
          : "USD";
      return {
        concept,
        chargeType,
        buyAmount,
        sellAmount,
        currencyCode,
      };
    })
    .filter((row): row is QuoteChargeSnapshot => row !== null);
}

function parseSupplierSuggestions(value: unknown): QuotedSupplierSuggestions | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return {
    suggestedCarrier:
      typeof candidate.suggestedCarrier === "string" ? candidate.suggestedCarrier : null,
    suggestedSupplier:
      typeof candidate.suggestedSupplier === "string" ? candidate.suggestedSupplier : null,
    serviceLevelAssumption:
      typeof candidate.serviceLevelAssumption === "string"
        ? candidate.serviceLevelAssumption
        : null,
    routeAssumption:
      typeof candidate.routeAssumption === "string" ? candidate.routeAssumption : null,
  };
}

function getActualTransitTimeDays(input: {
  atd: Date | null;
  ata: Date | null;
  milestones: Array<{ code: string; actualAt: Date | null }>;
}) {
  const departedMilestone = input.milestones.find((row) => row.code === "DEPARTED")?.actualAt ?? null;
  const arrivedMilestone = input.milestones.find((row) => row.code === "ARRIVED")?.actualAt ?? null;
  const departure = input.atd ?? departedMilestone;
  const arrival = input.ata ?? arrivedMilestone;
  if (!departure || !arrival) return null;
  const diffDays = Math.round((arrival.getTime() - departure.getTime()) / DAY_MS);
  return diffDays >= 0 ? diffDays : null;
}

function getMostRepresentativeSupplier(shipment: ShipmentLikeForContinuity) {
  const suppliers = new Map<string, number>();
  for (const row of shipment.shipmentCosts) {
    const name = row.supplierName?.trim();
    if (!name) continue;
    suppliers.set(name, (suppliers.get(name) ?? 0) + (asNumber(row.amount) ?? 0));
  }
  for (const row of shipment.expenses) {
    const name = row.supplierName?.trim();
    if (!name) continue;
    suppliers.set(name, (suppliers.get(name) ?? 0) + (asNumber(row.amountBase) ?? 0));
  }
  return [...suppliers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function coalesceRouteOrigin(shipment: ShipmentLikeForContinuity) {
  return shipment.originCode ?? shipment.pol ?? null;
}

function coalesceRouteDestination(shipment: ShipmentLikeForContinuity) {
  return shipment.destinationCode ?? shipment.pod ?? null;
}

export function buildQuoteContinuitySnapshot(quote: QuoteForSnapshot): QuoteContinuitySnapshot {
  const quotedRevenue = asNumber(quote.totalSell) ?? 0;
  const quotedCost = asNumber(quote.totalBuy) ?? 0;
  const quotedGrossProfit = asNumber(quote.marginAmount) ?? quotedRevenue - quotedCost;
  const quotedMarginPercent = asQuotedMarginPercent(quote.marginPct) ?? 0;
  const chargeBreakdown: QuoteChargeSnapshot[] = (quote.charges ?? []).map((row) => ({
    concept: row.concept,
    chargeType: row.chargeType,
    buyAmount: asNumber(row.buyAmount) ?? 0,
    sellAmount: asNumber(row.sellAmount) ?? 0,
    currencyCode: row.currencyCode,
  }));
  const quotedAssumptionsNotes = quote.assumptionsNotes ?? quote.internalNotes ?? null;

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    quotedSellAmount: quotedRevenue,
    quotedCostAmount: quotedCost,
    quotedGrossProfit,
    quotedMarginPercent,
    quotedTransitTimeDays: quote.estimatedTransitTimeDays ?? null,
    quotedMode: quote.mode,
    quotedDirection: quote.direction,
    quotedOrigin: quote.originCode ?? quote.pol ?? null,
    quotedDestination: quote.destinationCode ?? quote.pod ?? null,
    quotedChargeBreakdown: chargeBreakdown,
    quotedSupplierSuggestions: {
      suggestedCarrier: quote.suggestedCarrier ?? null,
      suggestedSupplier: quote.suggestedSupplier ?? null,
      serviceLevelAssumption: quote.serviceLevelAssumption ?? quote.serviceLevel ?? null,
      routeAssumption:
        quote.routeAssumption ??
        (quote.originCode && quote.destinationCode
          ? `${quote.originCode} -> ${quote.destinationCode}`
          : null),
    },
    quotedAssumptionsNotes,
    quotedCurrencyCode: quote.currencyCode,
    capturedAt: new Date().toISOString(),
  };
}

export function deriveQuotedVsActualMetrics(shipment: ShipmentLikeForContinuity): ShipmentQuoteContinuity {
  const fallbackSnapshot =
    shipment.quoteSnapshot && typeof shipment.quoteSnapshot === "object"
      ? (shipment.quoteSnapshot as Record<string, unknown>)
      : null;
  const canUseLiveQuoteFallback = !fallbackSnapshot;

  const quotedRevenue =
    asNumberishUnknown(fallbackSnapshot?.quotedSellAmount) ??
    asNumber(shipment.quotedSellAmount) ??
    (canUseLiveQuoteFallback ? asNumber(shipment.quote?.totalSell) : null) ??
    null;
  const quotedCost =
    asNumberishUnknown(fallbackSnapshot?.quotedCostAmount) ??
    asNumber(shipment.quotedCostAmount) ??
    (canUseLiveQuoteFallback ? asNumber(shipment.quote?.totalBuy) : null) ??
    null;
  const quotedGrossProfit =
    asNumberishUnknown(fallbackSnapshot?.quotedGrossProfit) ??
    asNumber(shipment.quotedGrossProfit) ??
    (canUseLiveQuoteFallback ? asNumber(shipment.quote?.marginAmount) : null) ??
    null;
  const quotedMarginPercent =
    asNumberishUnknown(fallbackSnapshot?.quotedMarginPercent) ??
    asNumber(shipment.quotedMarginPercent) ??
    (canUseLiveQuoteFallback ? asQuotedMarginPercent(shipment.quote?.marginPct) : null) ??
    null;
  const quotedTransitTimeDays =
    (asNumberishUnknown(fallbackSnapshot?.quotedTransitTimeDays) ?? shipment.quotedTransitTimeDays) ??
    (canUseLiveQuoteFallback ? shipment.quote?.estimatedTransitTimeDays ?? null : null);
  const quotedOrigin =
    (typeof fallbackSnapshot?.quotedOrigin === "string" ? fallbackSnapshot.quotedOrigin : shipment.quotedOrigin) ??
    (canUseLiveQuoteFallback ? shipment.quote?.originCode ?? shipment.quote?.pol ?? null : null);
  const quotedDestination =
    (typeof fallbackSnapshot?.quotedDestination === "string"
      ? fallbackSnapshot.quotedDestination
      : shipment.quotedDestination) ??
    (canUseLiveQuoteFallback
      ? shipment.quote?.destinationCode ?? shipment.quote?.pod ?? null
      : null);
  const quotedAssumptionsNotes =
    (typeof fallbackSnapshot?.quotedAssumptionsNotes === "string"
      ? fallbackSnapshot.quotedAssumptionsNotes
      : shipment.quotedAssumptionsNotes) ??
    (canUseLiveQuoteFallback ? shipment.quote?.assumptionsNotes ?? null : null);

  const quotedChargeBreakdown =
    parseQuotedChargeBreakdown(fallbackSnapshot?.quotedChargeBreakdown).length > 0
      ? parseQuotedChargeBreakdown(fallbackSnapshot?.quotedChargeBreakdown)
      : parseQuotedChargeBreakdown(shipment.quotedChargeBreakdown);
  const supplierSuggestions =
    parseSupplierSuggestions(fallbackSnapshot?.quotedSupplierSuggestions) ??
    parseSupplierSuggestions(shipment.quotedSupplierSuggestions) ??
    (canUseLiveQuoteFallback
      ? {
          suggestedCarrier: shipment.quote?.suggestedCarrier ?? null,
          suggestedSupplier: shipment.quote?.suggestedSupplier ?? null,
          serviceLevelAssumption: shipment.quote?.serviceLevelAssumption ?? null,
          routeAssumption: shipment.quote?.routeAssumption ?? null,
        }
      : null);

  const financialTruth = deriveShipmentFinancialTruth({
    invoices: shipment.invoices.map((row) => ({
      total: row.total,
      status: row.status,
    })),
    revenues: shipment.revenues.map((row) => ({
      amountBase: row.amountBase,
      status: row.status,
    })),
    shipmentCosts: shipment.shipmentCosts.map((row) => ({
      amount: row.amount,
    })),
    expenses: shipment.expenses.map((row) => ({
      amountBase: row.amountBase,
      status: FinancialRecordStatus.PENDING,
    })),
  });
  const actualRevenue = financialTruth.revenue;
  const actualCost = financialTruth.cost;
  const actualGrossProfit = financialTruth.grossProfit;
  const actualMarginPercent = financialTruth.marginPercent;
  const actualTransitTimeDays = getActualTransitTimeDays({
    atd: shipment.atd,
    ata: shipment.ata,
    milestones: shipment.milestones,
  });
  const actualSupplierName = getMostRepresentativeSupplier(shipment);
  const actualCarrier = shipment.carrierName ?? null;
  const actualOrigin = coalesceRouteOrigin(shipment);
  const actualDestination = coalesceRouteDestination(shipment);

  const revenueVariance = quotedRevenue === null ? null : round2(actualRevenue - quotedRevenue);
  const costVariance = quotedCost === null ? null : round2(actualCost - quotedCost);
  const grossProfitVariance =
    quotedGrossProfit === null ? null : round2(actualGrossProfit - quotedGrossProfit);
  const marginVariance =
    quotedMarginPercent === null || actualMarginPercent === null
      ? null
      : round2(actualMarginPercent - quotedMarginPercent);
  const transitVariance =
    quotedTransitTimeDays === null || actualTransitTimeDays === null
      ? null
      : actualTransitTimeDays - quotedTransitTimeDays;

  const transitPerformanceStatus: ShipmentQuoteContinuity["transitPerformanceStatus"] =
    transitVariance === null
      ? "UNKNOWN"
      : transitVariance === 0
        ? "ON_TARGET"
        : transitVariance < 0
          ? "FASTER_THAN_QUOTED"
          : "SLOWER_THAN_QUOTED";

  const supplierSuggestion = supplierSuggestions?.suggestedSupplier?.toLowerCase() ?? null;
  const actualSupplierNormalized = actualSupplierName?.toLowerCase() ?? null;
  const supplierDifferentFromSuggestion = Boolean(
    supplierSuggestion &&
      actualSupplierNormalized &&
      supplierSuggestion !== actualSupplierNormalized,
  );

  return {
    quoted: {
      revenue: quotedRevenue,
      cost: quotedCost,
      grossProfit: quotedGrossProfit,
      marginPercent: quotedMarginPercent,
      transitTimeDays: quotedTransitTimeDays,
      mode:
        (fallbackSnapshot?.quotedMode as string | null) ??
        shipment.quotedMode ??
        (canUseLiveQuoteFallback ? shipment.quote?.mode ?? null : null),
      direction:
        (fallbackSnapshot?.quotedDirection as string | null) ??
        shipment.quotedDirection ??
        (canUseLiveQuoteFallback ? shipment.quote?.direction ?? null : null),
      origin: quotedOrigin,
      destination: quotedDestination,
      chargeBreakdown: quotedChargeBreakdown,
      supplierSuggestions,
      assumptionsNotes: quotedAssumptionsNotes,
    },
    actual: {
      revenue: actualRevenue,
      cost: actualCost,
      grossProfit: actualGrossProfit,
      marginPercent: actualMarginPercent,
      transitTimeDays: actualTransitTimeDays,
      supplierCarrier: actualCarrier,
      supplierName: actualSupplierName,
      origin: actualOrigin,
      destination: actualDestination,
    },
    variance: {
      revenue: revenueVariance,
      cost: costVariance,
      grossProfit: grossProfitVariance,
      marginPercent: marginVariance,
      transitTimeDays: transitVariance,
    },
    transitPerformanceStatus,
    warnings: {
      marginDroppedBelowQuote:
        quotedMarginPercent !== null &&
        actualMarginPercent !== null &&
        actualMarginPercent < quotedMarginPercent,
      costsExceedQuotedEstimate:
        quotedCost !== null && quotedCost > 0 && actualCost > quotedCost * 1.1,
      transitSlowerThanQuoted: transitVariance !== null && transitVariance > 0,
      supplierDifferentFromSuggestion,
    },
  };
}

export function getShipmentQuoteContinuity(shipment: ShipmentLikeForContinuity) {
  return deriveQuotedVsActualMetrics(shipment);
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
