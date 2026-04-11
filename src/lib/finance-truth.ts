import { FinancialRecordStatus, InvoiceStatus } from "@prisma/client";

type NumberLike = unknown;

export type ShipmentFinancialTruthInput = {
  invoices: Array<{
    total: NumberLike;
    status: InvoiceStatus;
  }>;
  revenues?: Array<{
    amountBase: NumberLike;
    status: FinancialRecordStatus;
  }>;
  shipmentCosts: Array<{
    amount: NumberLike;
  }>;
  expenses: Array<{
    amountBase: NumberLike;
    status?: FinancialRecordStatus;
  }>;
};

export type ShipmentFinancialTruth = {
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number | null;
  revenueSource: "INVOICES" | "REVENUES_FALLBACK" | "NONE";
  components: {
    invoiceRevenue: number;
    revenueRecordRevenue: number;
    shipmentCosts: number;
    shipmentExpenses: number;
  };
};

function asNumber(value: NumberLike) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumOpenInvoiceRevenueAmountBase(
  invoices: Array<{ total: NumberLike; status: InvoiceStatus }>,
) {
  return round2(
    invoices
      .filter((invoice) => invoice.status !== InvoiceStatus.CANCELLED)
      .reduce((sum, invoice) => sum + asNumber(invoice.total), 0),
  );
}

export function sumRevenueRecordsAmountBase(
  revenues: Array<{ amountBase: NumberLike; status: FinancialRecordStatus }>,
) {
  return round2(revenues.reduce((sum, revenue) => sum + asNumber(revenue.amountBase), 0));
}

export function sumShipmentCostsAmountBase(shipmentCosts: Array<{ amount: NumberLike }>) {
  return round2(shipmentCosts.reduce((sum, shipmentCost) => sum + asNumber(shipmentCost.amount), 0));
}

export function sumShipmentExpensesAmountBase(expenses: Array<{ amountBase: NumberLike }>) {
  return round2(expenses.reduce((sum, expense) => sum + asNumber(expense.amountBase), 0));
}

export function deriveShipmentFinancialTruth(input: ShipmentFinancialTruthInput): ShipmentFinancialTruth {
  const invoiceRevenue = sumOpenInvoiceRevenueAmountBase(input.invoices);
  const revenueRecordRevenue = sumRevenueRecordsAmountBase(input.revenues ?? []);
  const shipmentCosts = sumShipmentCostsAmountBase(input.shipmentCosts);
  const shipmentExpenses = sumShipmentExpensesAmountBase(input.expenses);

  const revenueSource: ShipmentFinancialTruth["revenueSource"] =
    invoiceRevenue > 0 ? "INVOICES" : revenueRecordRevenue > 0 ? "REVENUES_FALLBACK" : "NONE";
  const revenue = revenueSource === "INVOICES" ? invoiceRevenue : revenueRecordRevenue;
  const cost = round2(shipmentCosts + shipmentExpenses);
  const grossProfit = round2(revenue - cost);
  const marginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : null;

  return {
    revenue,
    cost,
    grossProfit,
    marginPercent,
    revenueSource,
    components: {
      invoiceRevenue,
      revenueRecordRevenue,
      shipmentCosts,
      shipmentExpenses,
    },
  };
}
