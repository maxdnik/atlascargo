import { FinancialRecordStatus, InvoiceStatus, ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ShipmentFinanceRecord = {
  shipmentId: string;
  shipmentNumber: string;
  customer: string;
  status: ShipmentStatus;
  revenue: number;
  cost: number;
};

type ForecastTransaction = {
  id: string;
  type: "INFLOW" | "OUTFLOW";
  source: "AR_INVOICE" | "AP_COST";
  date: Date;
  amount: number;
  shipmentNumber: string;
  party: string;
  reference: string;
  expectedDate: Date;
  actualDate: Date | null;
};

export type FinanceOverview = {
  revenueCurrentMonth: number;
  costsCurrentMonth: number;
  grossMargin: number;
  grossMarginPct: number;
  netCashFlow: number;
  accountsReceivable: number;
  accountsPayable: number;
};

export type FinanceAlert = {
  kind: "missing-data" | "overdue-invoice" | "negative-margin";
  title: string;
  detail: string;
};

export type ShipmentProfitabilityRow = {
  shipmentId: string;
  shipmentNumber: string;
  customer: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  status: ShipmentStatus;
  incomplete: boolean;
};

export type AccountsReceivableRow = {
  id: string;
  invoiceId: string;
  customerId: string;
  customer: string;
  shipment: string;
  invoice: string;
  amount: number;
  dueDate: Date | null;
  daysOverdue: number;
  status: "PAID" | "OVERDUE" | "CANCELLED" | InvoiceStatus;
  outstanding: number;
  afipStatus: string | null;
  afipCAE: string | null;
  afipNumber: string | null;
};

export type AccountsPayableRow = {
  id: string;
  vendor: string;
  shipment: string;
  reference: string;
  amount: number;
  dueDate: Date | null;
  status: "PAID" | "OVERDUE" | "CANCELLED" | InvoiceStatus | FinancialRecordStatus;
  outstanding: number;
};

export type ForecastDayRow = {
  date: Date;
  expectedInflows: number;
  expectedOutflows: number;
  net: number;
  cumulativeBalance: number;
  detail: ForecastTransaction[];
};

export type FinanceModuleData = {
  overview: FinanceOverview;
  topShipmentsByMargin: ShipmentProfitabilityRow[];
  alerts: FinanceAlert[];
  cashForecast: ForecastDayRow[];
  shipmentProfitability: ShipmentProfitabilityRow[];
  accountsReceivable: AccountsReceivableRow[];
  accountsPayable: AccountsPayableRow[];
  arCustomers: Array<{ id: string; name: string }>;
};

export type InvoiceArListRow = {
  id: string;
  invoiceNumber: string;
  shipmentId: string;
  shipmentNumber: string;
  customerName: string;
  currencyCode: string;
  subtotal: number;
  taxes: number;
  total: number;
  dueDate: Date | null;
  issueDate: Date | null;
  status: InvoiceStatus;
  afipStatus: string | null;
  afipCAE: string | null;
  afipNumber: string | null;
};

const COMPLETE_INVOICE_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELLED,
]);

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function latestDate(dates: Date[]) {
  if (dates.length === 0) return null;
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}

function getOutstanding(total: number, paid: number) {
  return Math.max(total - paid, 0);
}

function getDaysOverdue(dueDate: Date | null, today: Date, outstanding: number) {
  if (!dueDate || outstanding <= 0) return 0;
  const diffMs = dayStart(today).getTime() - dayStart(dueDate).getTime();
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}

function toMapRow(
  map: Map<string, ShipmentFinanceRecord>,
  shipmentId: string,
  fallback: {
    shipmentNumber?: string | null;
    customer?: string | null;
    status?: ShipmentStatus | null;
  },
) {
  const existing = map.get(shipmentId);
  if (existing) return existing;

  const created: ShipmentFinanceRecord = {
    shipmentId,
    shipmentNumber: fallback.shipmentNumber ?? `Shipment ${shipmentId.slice(0, 8)}`,
    customer: fallback.customer ?? "-",
    status: fallback.status ?? ShipmentStatus.DRAFT,
    revenue: 0,
    cost: 0,
  };
  map.set(shipmentId, created);
  return created;
}

function invoiceStatusLabel(
  status: InvoiceStatus,
  dueDate: Date | null,
  today: Date,
  outstanding: number,
): "PAID" | "OVERDUE" | "CANCELLED" | InvoiceStatus {
  if (outstanding <= 0 || status === InvoiceStatus.PAID) return "PAID";
  if (status === InvoiceStatus.CANCELLED) return "CANCELLED";
  if (dueDate && dayStart(dueDate) < dayStart(today)) return "OVERDUE";
  return status;
}

function payableStatusLabel(
  status: FinancialRecordStatus | InvoiceStatus,
  dueDate: Date | null,
  today: Date,
  outstanding: number,
): "PAID" | "OVERDUE" | "CANCELLED" | InvoiceStatus | FinancialRecordStatus {
  if (outstanding <= 0 || status === FinancialRecordStatus.PAID) {
    return "PAID";
  }
  if (status === InvoiceStatus.CANCELLED) return "CANCELLED";
  if (dueDate && dayStart(dueDate) < dayStart(today)) return "OVERDUE";
  return status;
}

export async function getFinanceModuleData(companyId: string): Promise<FinanceModuleData> {
  const today = new Date();
  const currentMonthStart = monthStart(today);
  const currentMonthEnd = monthEnd(today);

  const [shipments, revenues, expenses, invoices, monthlyPayments] = await Promise.all([
    prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        customer: { select: { legalName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.revenue.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentId: true,
        amountBase: true,
        dueDate: true,
        status: true,
        createdAt: true,
        concept: true,
        shipment: {
          select: {
            shipmentNumber: true,
            status: true,
            customer: { select: { legalName: true } },
          },
        },
        customer: { select: { legalName: true } },
        payments: {
          select: {
            amount: true,
            paymentDate: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentId: true,
        supplierName: true,
        concept: true,
        amountBase: true,
        dueDate: true,
        status: true,
        createdAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
            status: true,
            customer: { select: { legalName: true } },
          },
        },
        payments: {
          select: {
            amount: true,
            paymentDate: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        shipmentId: {
          not: "",
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        dueDate: true,
        issueDate: true,
        total: true,
        afipStatus: true,
        afipCAE: true,
        afipNumber: true,
        customerId: true,
        customer: { select: { id: true, legalName: true } },
        shipment: { select: { shipmentNumber: true } },
        payments: {
          select: {
            amount: true,
            paymentDate: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        companyId,
        paymentDate: {
          gte: currentMonthStart,
          lt: currentMonthEnd,
        },
      },
      select: {
        amount: true,
        revenueId: true,
        expenseId: true,
        invoice: { select: { customerId: true } },
      },
    }),
  ]);

  const shipmentMap = new Map<string, ShipmentFinanceRecord>();

  for (const shipment of shipments) {
    shipmentMap.set(shipment.id, {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      customer: shipment.customer.legalName,
      status: shipment.status,
      revenue: 0,
      cost: 0,
    });
  }

  const revenueCurrentMonth = revenues
    .filter((entry) => entry.createdAt >= currentMonthStart && entry.createdAt < currentMonthEnd)
    .reduce((sum, entry) => sum + asNumber(entry.amountBase), 0);

  const costsCurrentMonth = expenses
    .filter((entry) => entry.createdAt >= currentMonthStart && entry.createdAt < currentMonthEnd)
    .reduce((sum, entry) => sum + asNumber(entry.amountBase), 0);

  for (const revenue of revenues) {
    const row = toMapRow(shipmentMap, revenue.shipmentId, {
      shipmentNumber: revenue.shipment.shipmentNumber,
      customer: revenue.shipment.customer.legalName,
      status: revenue.shipment.status,
    });
    row.revenue += asNumber(revenue.amountBase);
  }

  for (const expense of expenses) {
    const row = toMapRow(shipmentMap, expense.shipmentId, {
      shipmentNumber: expense.shipment.shipmentNumber,
      customer: expense.shipment.customer.legalName,
      status: expense.shipment.status,
    });
    row.cost += asNumber(expense.amountBase);
  }

  const shipmentProfitability = Array.from(shipmentMap.values())
    .map<ShipmentProfitabilityRow>((entry) => {
      const margin = entry.revenue - entry.cost;
      const marginPct = entry.revenue > 0 ? (margin / entry.revenue) * 100 : 0;
      const incomplete = entry.revenue === 0 || entry.cost === 0;
      return {
        shipmentId: entry.shipmentId,
        shipmentNumber: entry.shipmentNumber,
        customer: entry.customer,
        revenue: entry.revenue,
        cost: entry.cost,
        margin,
        marginPct,
        status: entry.status,
        incomplete,
      };
    })
    .sort((a, b) => a.margin - b.margin);

  const shipmentInvoices = invoices.filter((invoice) => Boolean(invoice.shipment));

  const accountsReceivable = shipmentInvoices
    .filter((invoice) => invoice.customerId && invoice.customer)
    .map<AccountsReceivableRow>((invoice) => {
      const amount = asNumber(invoice.total);
      const paid = invoice.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
      const outstanding = getOutstanding(amount, paid);
      const daysOverdue = getDaysOverdue(invoice.dueDate, today, outstanding);
      return {
        id: invoice.id,
        invoiceId: invoice.id,
        customerId: invoice.customer!.id,
        customer: invoice.customer!.legalName,
        shipment: invoice.shipment?.shipmentNumber ?? "-",
        invoice: invoice.invoiceNumber,
        amount,
        dueDate: invoice.dueDate,
        daysOverdue,
        status: invoiceStatusLabel(invoice.status, invoice.dueDate, today, outstanding),
        outstanding,
        afipStatus: invoice.afipStatus,
        afipCAE: invoice.afipCAE,
        afipNumber: invoice.afipNumber,
      };
    })
    .sort((a, b) => {
      const aTime = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

  const payablesFromVendorCosts = expenses.map<AccountsPayableRow>((expense) => {
    const amount = asNumber(expense.amountBase);
    const paid = expense.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    const outstanding = getOutstanding(amount, paid);
    return {
      id: expense.id,
      vendor: expense.supplierName,
      shipment: expense.shipment.shipmentNumber,
      reference: expense.concept,
      amount,
      dueDate: expense.dueDate,
      status: payableStatusLabel(expense.status, expense.dueDate, today, outstanding),
      outstanding,
    };
  });

  const accountsPayable = [...payablesFromVendorCosts].sort((a, b) => {
    const aTime = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const accountsReceivableTotal = accountsReceivable.reduce((sum, row) => sum + row.outstanding, 0);
  const accountsPayableTotal = accountsPayable.reduce((sum, row) => sum + row.outstanding, 0);

  const currentMonthInflows = monthlyPayments
    .filter((payment) => payment.revenueId || payment.invoice?.customerId)
    .reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const currentMonthOutflows = monthlyPayments
    .filter((payment) => payment.expenseId)
    .reduce((sum, payment) => sum + asNumber(payment.amount), 0);

  const overview: FinanceOverview = {
    revenueCurrentMonth,
    costsCurrentMonth,
    grossMargin: revenueCurrentMonth - costsCurrentMonth,
    grossMarginPct: revenueCurrentMonth > 0 ? ((revenueCurrentMonth - costsCurrentMonth) / revenueCurrentMonth) * 100 : 0,
    netCashFlow: currentMonthInflows - currentMonthOutflows,
    accountsReceivable: accountsReceivableTotal,
    accountsPayable: accountsPayableTotal,
  };

  const topShipmentsByMargin = shipmentProfitability
    .filter((row) => !row.incomplete)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const missingFinancials = shipmentProfitability
    .filter(
      (row) =>
        row.incomplete &&
        row.status !== ShipmentStatus.DRAFT &&
        row.status !== ShipmentStatus.CANCELLED,
    )
    .slice(0, 4);

  const overdueInvoices = accountsReceivable
    .filter((row) => row.daysOverdue > 0 && row.outstanding > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 4);

  const negativeMargins = shipmentProfitability
    .filter((row) => !row.incomplete && row.margin < 0)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 4);

  const alerts: FinanceAlert[] = [
    ...missingFinancials.map((row) => ({
      kind: "missing-data" as const,
      title: `${row.shipmentNumber} missing financial data`,
      detail: row.revenue === 0 ? "No revenue posted for shipment." : "No costs posted for shipment.",
    })),
    ...overdueInvoices.map((row) => ({
      kind: "overdue-invoice" as const,
      title: `${row.invoice} overdue (${row.daysOverdue}d)`,
      detail: `${row.customer} · Outstanding ${row.outstanding.toFixed(2)} USD`,
    })),
    ...negativeMargins.map((row) => ({
      kind: "negative-margin" as const,
      title: `${row.shipmentNumber} negative margin`,
      detail: `${row.customer} · Margin ${row.margin.toFixed(2)} USD`,
    })),
  ];

  const forecastTransactions: ForecastTransaction[] = [];

  for (const invoice of shipmentInvoices) {
    if (COMPLETE_INVOICE_STATUSES.has(invoice.status) && invoice.payments.length === 0) {
      continue;
    }

    const paid = invoice.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    const amount = asNumber(invoice.total);
    const outstanding = getOutstanding(amount, paid);
    const expectedDate = (invoice.dueDate ?? invoice.issueDate) as Date;
    const actualDate = outstanding <= 0 ? latestDate(invoice.payments.map((p) => p.paymentDate)) : null;
    const forecastDate = actualDate ?? expectedDate;

    if (!forecastDate) continue;
    if (invoice.status === InvoiceStatus.CANCELLED) continue;

    const movementAmount = outstanding > 0 ? outstanding : Math.max(paid, amount);
    const isAR = Boolean(invoice.customerId && invoice.customer);

    if (isAR) {
      forecastTransactions.push({
        id: `arinv-${invoice.id}`,
        type: "INFLOW",
        source: "AR_INVOICE",
        date: forecastDate,
        amount: movementAmount,
        shipmentNumber: invoice.shipment?.shipmentNumber ?? "-",
        party: invoice.customer!.legalName,
        reference: invoice.invoiceNumber,
        expectedDate,
        actualDate,
      });
    }

  }

  for (const expense of expenses) {
    if (expense.status === FinancialRecordStatus.PAID && expense.payments.length === 0) {
      continue;
    }

    const paid = expense.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    const amount = asNumber(expense.amountBase);
    const outstanding = getOutstanding(amount, paid);
    const expectedDate = expense.dueDate ?? expense.createdAt;
    const actualDate =
      expense.status === FinancialRecordStatus.PAID
        ? latestDate(expense.payments.map((payment) => payment.paymentDate))
        : null;
    const forecastDate = actualDate ?? expectedDate;
    if (!forecastDate) continue;

    forecastTransactions.push({
      id: `cost-${expense.id}`,
      type: "OUTFLOW",
      source: "AP_COST",
      date: forecastDate,
      amount: outstanding > 0 ? outstanding : Math.max(paid, amount),
      shipmentNumber: expense.shipment.shipmentNumber,
      party: expense.supplierName,
      reference: expense.concept,
      expectedDate,
      actualDate,
    });
  }

  const groupedForecast = new Map<
    string,
    {
      expectedInflows: number;
      expectedOutflows: number;
      detail: ForecastTransaction[];
    }
  >();

  for (const movement of forecastTransactions) {
    const key = dateKey(movement.date);
    const bucket = groupedForecast.get(key) ?? {
      expectedInflows: 0,
      expectedOutflows: 0,
      detail: [],
    };
    if (movement.type === "INFLOW") {
      bucket.expectedInflows += movement.amount;
    } else {
      bucket.expectedOutflows += movement.amount;
    }
    bucket.detail.push(movement);
    groupedForecast.set(key, bucket);
  }

  let cumulativeBalance = 0;
  const cashForecast = Array.from(groupedForecast.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map<ForecastDayRow>(([key, value]) => {
      const net = value.expectedInflows - value.expectedOutflows;
      cumulativeBalance += net;
      return {
        date: parseDateKey(key),
        expectedInflows: value.expectedInflows,
        expectedOutflows: value.expectedOutflows,
        net,
        cumulativeBalance,
        detail: value.detail.sort((a, b) => a.party.localeCompare(b.party)),
      };
    });

  const arCustomers = Array.from(
    new Map(
      accountsReceivable
        .filter((row) => row.customerId)
        .map((row) => [row.customerId, { id: row.customerId, name: row.customer }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    overview,
    topShipmentsByMargin,
    alerts,
    cashForecast,
    shipmentProfitability,
    accountsReceivable,
    accountsPayable,
    arCustomers,
  };
}

export async function listInvoicesForAr(companyId: string): Promise<InvoiceArListRow[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
    },
    select: {
      id: true,
      invoiceNumber: true,
      shipmentId: true,
      dueDate: true,
      issueDate: true,
      status: true,
      afipStatus: true,
      afipCAE: true,
      afipNumber: true,
      currencyCode: true,
      subtotal: true,
      taxes: true,
      total: true,
      shipment: {
        select: {
          shipmentNumber: true,
        },
      },
      customer: {
        select: {
          legalName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return invoices
    .filter((invoice) => Boolean(invoice.shipment) && Boolean(invoice.customer))
    .map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    shipmentId: invoice.shipmentId,
      shipmentNumber: invoice.shipment!.shipmentNumber,
      customerName: invoice.customer!.legalName,
      currencyCode: invoice.currencyCode,
      subtotal: asNumber(invoice.subtotal),
      taxes: asNumber(invoice.taxes),
      total: asNumber(invoice.total),
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      status: invoice.status,
      afipStatus: invoice.afipStatus,
      afipCAE: invoice.afipCAE,
      afipNumber: invoice.afipNumber,
    }));
}
