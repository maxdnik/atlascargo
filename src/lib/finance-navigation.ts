export type FinanceNavItemId =
  | "overview"
  | "invoices"
  | "expenses"
  | "ar"
  | "ap"
  | "profitability"
  | "forecast";

export type FinanceNavItem = {
  id: FinanceNavItemId;
  label: string;
  href: string;
  gate: "all" | "revenue" | "expenses" | "both";
};

export const financeNavItems: ReadonlyArray<FinanceNavItem> = [
  { id: "overview", label: "Finance Overview", href: "/finance", gate: "all" },
  { id: "invoices", label: "Invoices", href: "/finance/invoices", gate: "revenue" },
  { id: "expenses", label: "General Expenses", href: "/finance/expenses", gate: "expenses" },
  { id: "ar", label: "Accounts Receivable", href: "/finance/ar", gate: "revenue" },
  { id: "ap", label: "Accounts Payable", href: "/finance/ap", gate: "expenses" },
  { id: "profitability", label: "Shipment Profitability", href: "/finance/profitability", gate: "both" },
  { id: "forecast", label: "Cash Forecast", href: "/finance/forecast", gate: "all" },
];

export function resolveFinanceNavItems(input: {
  canViewRevenue: boolean;
  canViewExpenses: boolean;
}): FinanceNavItem[] {
  return financeNavItems.filter((item) => {
    if (item.gate === "all") return true;
    if (item.gate === "revenue") return input.canViewRevenue;
    if (item.gate === "expenses") return input.canViewExpenses;
    return input.canViewRevenue && input.canViewExpenses;
  });
}
