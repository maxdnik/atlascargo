import { InvoiceLineType, InvoiceStatus, type Prisma, ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BASE_CURRENCY = "USD";
const READY_FOR_BILLING_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.CLOSED,
  ShipmentStatus.DELIVERED,
]);

type InvoiceRecordForStatus = {
  id: string;
  dueDate: Date | null;
  status: InvoiceStatus;
};

function isEditableStatus(status: InvoiceStatus) {
  return status === InvoiceStatus.DRAFT || status === InvoiceStatus.READY_TO_ISSUE;
}

function resolveInvoiceStatus(invoice: InvoiceRecordForStatus, lineCount: number): InvoiceStatus {
  if (invoice.status === InvoiceStatus.CANCELLED) return InvoiceStatus.CANCELLED;
  if (invoice.status === InvoiceStatus.PAID) return InvoiceStatus.PAID;
  if (invoice.status === InvoiceStatus.ISSUED) return InvoiceStatus.ISSUED;
  return lineCount > 0 && invoice.dueDate ? InvoiceStatus.READY_TO_ISSUE : InvoiceStatus.DRAFT;
}

function calculateTaxes(subtotal: number, manualTaxes?: number | null) {
  if (manualTaxes !== undefined && manualTaxes !== null) {
    return Math.round(manualTaxes * 100) / 100;
  }
  return Math.round(subtotal * 0.21 * 100) / 100;
}

function dateFromInput(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value");
  }
  return parsed;
}

async function getNextInvoiceNumber(companyId: string, tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await tx.invoice.findFirst({
    where: {
      companyId,
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });

  const latestSequence = latest?.invoiceNumber
    ? Number(latest.invoiceNumber.replace(prefix, "")) || 0
    : 0;
  const nextSequence = String(latestSequence + 1).padStart(4, "0");
  return `${prefix}${nextSequence}`;
}

async function assertShipmentReadyForBilling(
  input: { companyId: string; shipmentId: string },
  tx: Prisma.TransactionClient,
) {
  const shipment = await tx.shipment.findFirst({
    where: {
      id: input.shipmentId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      status: true,
      customerId: true,
      customer: {
        select: {
          paymentTermsDays: true,
        },
      },
      quote: {
        select: {
          currencyCode: true,
        },
      },
      revenues: {
        select: {
          currencyCode: true,
        },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }
  if (!READY_FOR_BILLING_STATUSES.has(shipment.status)) {
    throw new Error("Shipment must be CLOSED or DELIVERED before invoicing");
  }

  return shipment;
}

async function refreshInvoiceTotalsAndStatus(invoiceId: string, tx: Prisma.TransactionClient) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      dueDate: true,
      status: true,
      taxes: true,
      lines: {
        select: { amount: true },
      },
    },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.amount), 0);
  const taxes = calculateTaxes(subtotal, Number(invoice.taxes));
  const total = subtotal + taxes;
  const nextStatus = resolveInvoiceStatus(invoice, invoice.lines.length);

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal,
      taxes,
      total,
      status: nextStatus,
    },
  });
}

export async function createInvoiceForShipment(input: {
  companyId: string;
  branchId?: string | null;
  shipmentId: string;
  invoiceNumber?: string | null;
  currencyCode?: string | null;
  taxes?: number | null;
  issueDate?: string | null;
  dueDate?: string | null;
  firstLine: {
    description: string;
    amount: number;
    type: InvoiceLineType;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const shipment = await assertShipmentReadyForBilling(
      { companyId: input.companyId, shipmentId: input.shipmentId },
      tx,
    );

    const existingOpen = await tx.invoice.findFirst({
      where: {
        companyId: input.companyId,
        shipmentId: shipment.id,
        status: {
          in: [InvoiceStatus.DRAFT, InvoiceStatus.READY_TO_ISSUE],
        },
      },
      select: { id: true },
    });
    if (existingOpen) {
      throw new Error("Shipment already has an open invoice");
    }

    const invoiceNumber =
      input.invoiceNumber && input.invoiceNumber.trim()
        ? input.invoiceNumber.trim().toUpperCase()
        : await getNextInvoiceNumber(input.companyId, tx);
    const issueDate = dateFromInput(input.issueDate ?? null);
    const dueDate =
      dateFromInput(input.dueDate ?? null) ??
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + (shipment.customer.paymentTermsDays || 30));
        return d;
      })();
    const currencyCode =
      input.currencyCode && input.currencyCode.trim()
        ? input.currencyCode.trim().toUpperCase()
        : shipment.quote?.currencyCode ?? shipment.revenues[0]?.currencyCode ?? BASE_CURRENCY;

    const created = await tx.invoice.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? undefined,
        invoiceNumber,
        shipmentId: shipment.id,
        customerId: shipment.customerId,
        currencyCode,
        subtotal: 0,
        taxes: input.taxes ?? calculateTaxes(input.firstLine.amount),
        total: 0,
        status: InvoiceStatus.DRAFT,
        issueDate,
        dueDate,
        afipStatus: "NOT_ISSUED",
      },
      select: { id: true },
    });

    await tx.invoiceLine.create({
      data: {
        invoiceId: created.id,
        description: input.firstLine.description.trim(),
        amount: input.firstLine.amount,
        type: input.firstLine.type,
      },
    });

    return refreshInvoiceTotalsAndStatus(created.id, tx);
  });
}

export async function addInvoiceLine(input: {
  companyId: string;
  invoiceId: string;
  description: string;
  amount: number;
  type: InvoiceLineType;
}) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (!isEditableStatus(invoice.status)) {
      throw new Error("Invoice is not editable in current status");
    }

    await tx.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        description: input.description.trim(),
        amount: input.amount,
        type: input.type,
      },
    });

    return refreshInvoiceTotalsAndStatus(invoice.id, tx);
  });
}

export async function updateInvoiceHeader(input: {
  companyId: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  currencyCode?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  taxes?: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (!isEditableStatus(invoice.status)) {
      throw new Error("Invoice is not editable in current status");
    }

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        invoiceNumber:
          input.invoiceNumber && input.invoiceNumber.trim()
            ? input.invoiceNumber.trim().toUpperCase()
            : undefined,
        currencyCode:
          input.currencyCode && input.currencyCode.trim()
            ? input.currencyCode.trim().toUpperCase()
            : undefined,
        issueDate: input.issueDate !== undefined ? dateFromInput(input.issueDate) : undefined,
        dueDate: input.dueDate !== undefined ? dateFromInput(input.dueDate) : undefined,
        taxes: input.taxes ?? undefined,
      },
    });

    return refreshInvoiceTotalsAndStatus(invoice.id, tx);
  });
}

export async function issueInvoiceAFIP(invoiceId: string) {
  const numericBase = invoiceId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString();
  const cae = `${Date.now()}${numericBase}`.slice(0, 14);
  const afipNumber = `0001-${String(Date.now()).slice(-8)}`;

  return {
    cae,
    afipNumber,
    afipStatus: "AUTHORIZED",
  };
}

export async function issueInvoiceWithAfip(input: { companyId: string; invoiceId: string }) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        total: true,
        lines: {
          select: { id: true },
        },
      },
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== InvoiceStatus.READY_TO_ISSUE) {
      throw new Error("Invoice must be READY_TO_ISSUE before AFIP issuing");
    }
    if (!invoice.dueDate || invoice.lines.length === 0 || Number(invoice.total) <= 0) {
      throw new Error("Invoice missing required data for AFIP issuing");
    }

    const afipResponse = await issueInvoiceAFIP(invoice.id);
    return tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.ISSUED,
        issueDate: new Date(),
        afipCAE: afipResponse.cae,
        afipNumber: afipResponse.afipNumber,
        afipStatus: afipResponse.afipStatus,
      },
    });
  });
}

export async function markInvoicePaid(input: { companyId: string; invoiceId: string }) {
  return prisma.invoice.update({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
    data: {
      status: InvoiceStatus.PAID,
    },
  });
}

export async function cancelInvoice(input: { companyId: string; invoiceId: string }) {
  return prisma.invoice.update({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
    data: {
      status: InvoiceStatus.CANCELLED,
      afipStatus: "CANCELLED",
    },
  });
}

export async function deleteInvoice(input: { companyId: string; invoiceId: string }) {
  return prisma.invoice.delete({
    where: {
      id: input.invoiceId,
      companyId: input.companyId,
    },
  });
}

export async function getInvoiceById(companyId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      customer: {
        select: {
          id: true,
          legalName: true,
          code: true,
        },
      },
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          mode: true,
          direction: true,
        },
      },
      lines: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}
