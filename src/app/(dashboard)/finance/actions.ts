"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  ActivityActorType,
  EntityType,
  GeneralExpenseCategory,
  GeneralExpenseStatus,
  InvoiceLineType,
  InvoiceStatus,
  PaymentEntityType,
} from "@prisma/client";
import { z } from "zod";
import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runAlertChecksForInvoiceMutation } from "@/lib/alerts";
import { recordAuditEvent, recordEntityDiff } from "@/lib/audit";
import { registerEntityPayment } from "@/lib/payments";
import {
  addInvoiceLine,
  cancelInvoice,
  createInvoiceForShipment,
  issueInvoiceWithAfip,
  updateInvoiceHeader,
} from "@/lib/invoices";

export type FinanceActionState = {
  success: boolean;
  error?: string;
};

const invoiceHeaderSchema = z.object({
  shipmentId: z.string().min(1),
  invoiceNumber: z.string().min(3).max(40).optional(),
  currencyCode: z.enum(["USD", "EUR", "ARS"]),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1200).optional(),
});

const invoiceLineSchema = z.object({
  description: z.string().min(2).max(240),
  amount: z.coerce.number().positive().max(100_000_000),
  type: z.nativeEnum(InvoiceLineType),
});

const ALLOWED_LINE_TYPES = [
  InvoiceLineType.FREIGHT,
  InvoiceLineType.HANDLING,
  InvoiceLineType.CUSTOMS,
  InvoiceLineType.DOCUMENTATION,
  InvoiceLineType.OTHER,
] as const;

const registerInvoicePaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive().optional(),
  paymentDate: z.string().optional(),
  method: z.string().max(50).optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
});

const registerPayablePaymentSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.nativeEnum(PaymentEntityType).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentDate: z.string().optional(),
  method: z.string().max(50).optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
});

function parseInvoiceLines(formData: FormData) {
  const descriptions = formData
    .getAll("lineDescription")
    .map((value) => String(value).trim());
  const amounts = formData.getAll("lineAmount").map((value) => Number(value));
  const types = formData
    .getAll("lineType")
    .map((value) => String(value).trim().toUpperCase() as InvoiceLineType);

  if (descriptions.length === 0 || amounts.length === 0 || types.length === 0) {
    throw new Error("At least one invoice line is required");
  }
  if (descriptions.length !== amounts.length || descriptions.length !== types.length) {
    throw new Error("Invoice lines are inconsistent");
  }

  const lines = descriptions.map((description, index) => {
    const amount = amounts[index];
    const type = types[index];
    if (!ALLOWED_LINE_TYPES.includes(type)) {
      throw new Error("Invalid invoice line type");
    }
    return invoiceLineSchema.parse({ description, amount, type });
  });

  return lines;
}

function toDateOrNull(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}

function calculateTaxes(subtotal: number) {
  return Math.round(subtotal * 0.21 * 100) / 100;
}

function getAuditActor(ctx: { userId: string }) {
  return {
    actorType: ActivityActorType.USER,
    actorId: ctx.userId,
  };
}

export async function createFinanceInvoiceAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("REVENUE", "CREATE");
    const parsedHeader = invoiceHeaderSchema.parse({
      shipmentId: formData.get("shipmentId"),
      invoiceNumber: formData.get("invoiceNumber") || undefined,
      currencyCode: formData.get("currencyCode"),
      issueDate: String(formData.get("issueDate") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      notes: formData.get("notes") || undefined,
    });
    const lines = parseInvoiceLines(formData);

    const created = await createInvoiceForShipment({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      shipmentId: parsedHeader.shipmentId,
      invoiceNumber: parsedHeader.invoiceNumber,
      currencyCode: parsedHeader.currencyCode,
      issueDate: parsedHeader.issueDate,
      dueDate: parsedHeader.dueDate,
      notes: parsedHeader.notes,
      firstLine: lines[0],
    });
    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.INVOICE,
      entityId: created.id,
      action: ActivityAction.CREATE,
      shipmentId: created.shipmentId,
      customerId: created.customerId,
      summary: `Invoice ${created.invoiceNumber} created.`,
      after: created as unknown as Record<string, unknown>,
      actor: getAuditActor(ctx),
    });

    for (const line of lines.slice(1)) {
      await addInvoiceLine({
        companyId: ctx.companyId,
        invoiceId: created.id,
        description: line.description,
        amount: line.amount,
        type: line.type,
      });
    }

    await updateInvoiceHeader({
      companyId: ctx.companyId,
      invoiceId: created.id,
      invoiceNumber: parsedHeader.invoiceNumber,
      currencyCode: parsedHeader.currencyCode,
      issueDate: parsedHeader.issueDate,
      dueDate: parsedHeader.dueDate,
      notes: parsedHeader.notes,
    });
    const afterInvoice = await prisma.invoice.findFirst({
      where: {
        id: created.id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
        customerId: true,
        invoiceNumber: true,
        currencyCode: true,
        issueDate: true,
        dueDate: true,
        status: true,
        notes: true,
        subtotal: true,
        taxes: true,
        total: true,
        lines: {
          select: {
            description: true,
            amount: true,
            type: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!afterInvoice) {
      throw new Error("Invoice not found after creation");
    }
    await recordEntityDiff({
      companyId: ctx.companyId,
      entityType: EntityType.INVOICE,
      entityId: created.id,
      shipmentId: created.shipmentId,
      customerId: created.customerId,
      before: {
        invoiceNumber: created.invoiceNumber,
        status: created.status,
        subtotal: created.subtotal,
        taxes: created.taxes,
        total: created.total,
      },
      after: afterInvoice as unknown as Record<string, unknown>,
      trackedFields: [
        "invoiceNumber",
        "currencyCode",
        "issueDate",
        "dueDate",
        "status",
        "subtotal",
        "taxes",
        "total",
        "notes",
        "lines",
      ],
      actor: getAuditActor(ctx),
      fallbackSummary: `Invoice ${created.invoiceNumber} initialized.`,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${created.id}`);
    revalidatePath("/finance/ar");
    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsedHeader.shipmentId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to create invoice",
    };
  }
}

export async function updateFinanceInvoiceAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("REVENUE", "EDIT");
    const invoiceId = String(formData.get("invoiceId") || "").trim();
    if (!invoiceId) {
      throw new Error("Invoice id is required");
    }

    const parsedHeader = invoiceHeaderSchema.parse({
      shipmentId: formData.get("shipmentId"),
      invoiceNumber: formData.get("invoiceNumber") || undefined,
      currencyCode: formData.get("currencyCode"),
      issueDate: String(formData.get("issueDate") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      notes: formData.get("notes") || undefined,
    });
    const lines = parseInvoiceLines(formData);

    const beforeInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
        customerId: true,
        invoiceNumber: true,
        currencyCode: true,
        issueDate: true,
        dueDate: true,
        status: true,
        notes: true,
        subtotal: true,
        taxes: true,
        total: true,
        lines: {
          select: {
            description: true,
            amount: true,
            type: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!beforeInvoice) {
      throw new Error("Invoice not found");
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          companyId: ctx.companyId,
        },
        select: {
          id: true,
          status: true,
          shipmentId: true,
        },
      });
      if (!existing) {
        throw new Error("Invoice not found");
      }
      if (
        existing.status !== InvoiceStatus.DRAFT &&
        existing.status !== InvoiceStatus.READY_TO_ISSUE
      ) {
        throw new Error("Invoice is not editable");
      }

      const selectedShipment = await tx.shipment.findFirst({
        where: {
          id: parsedHeader.shipmentId,
          companyId: ctx.companyId,
        },
        select: {
          id: true,
          customerId: true,
          status: true,
        },
      });
      if (!selectedShipment) {
        throw new Error("Shipment not found");
      }
      if (selectedShipment.status !== "CLOSED" && selectedShipment.status !== "DELIVERED") {
        throw new Error("Shipment must be CLOSED or DELIVERED before invoicing");
      }

      const issueDate = toDateOrNull(parsedHeader.issueDate);
      const dueDate = toDateOrNull(parsedHeader.dueDate);
      const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
      const taxes = calculateTaxes(subtotal);
      const total = subtotal + taxes;

      await tx.invoiceLine.deleteMany({
        where: { invoiceId: existing.id },
      });

      await tx.invoiceLine.createMany({
        data: lines.map((line) => ({
          invoiceId: existing.id,
          description: line.description,
          amount: line.amount,
          type: line.type,
        })),
      });

      await tx.invoice.update({
        where: { id: existing.id },
        data: {
          shipmentId: selectedShipment.id,
          customerId: selectedShipment.customerId,
          invoiceNumber: parsedHeader.invoiceNumber?.trim()
            ? parsedHeader.invoiceNumber.trim().toUpperCase()
            : undefined,
          currencyCode: parsedHeader.currencyCode,
          issueDate,
          dueDate,
          notes: parsedHeader.notes?.trim() ? parsedHeader.notes.trim() : null,
          subtotal,
          taxes,
          total,
          status:
            dueDate && lines.length > 0 ? InvoiceStatus.READY_TO_ISSUE : InvoiceStatus.DRAFT,
        },
      });
    });
    const afterInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
        customerId: true,
        invoiceNumber: true,
        currencyCode: true,
        issueDate: true,
        dueDate: true,
        status: true,
        notes: true,
        subtotal: true,
        taxes: true,
        total: true,
        lines: {
          select: {
            description: true,
            amount: true,
            type: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!afterInvoice) {
      throw new Error("Invoice not found after update");
    }
    await recordEntityDiff({
      companyId: ctx.companyId,
      entityType: EntityType.INVOICE,
      entityId: invoiceId,
      shipmentId: afterInvoice.shipmentId,
      customerId: afterInvoice.customerId,
      before: beforeInvoice as unknown as Record<string, unknown>,
      after: afterInvoice as unknown as Record<string, unknown>,
      trackedFields: [
        "invoiceNumber",
        "currencyCode",
        "issueDate",
        "dueDate",
        "status",
        "subtotal",
        "taxes",
        "total",
        "notes",
        "lines",
      ],
      actor: getAuditActor(ctx),
    });

    revalidatePath("/finance");
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${invoiceId}`);
    revalidatePath(`/finance/invoices/${invoiceId}/edit`);
    revalidatePath("/finance/ar");
    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsedHeader.shipmentId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to update invoice",
    };
  }
}

export async function deleteFinanceInvoiceAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  return mutateInvoiceStatus(
    formData,
    async ({ companyId, invoiceId }) => {
      const existing = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          companyId,
        },
        select: {
          id: true,
          shipmentId: true,
        },
      });
      if (!existing) {
        throw new Error("Invoice not found");
      }
      await prisma.invoice.delete({
        where: { id: existing.id },
      });
      return existing;
    },
    "DELETE",
  );
}

async function mutateInvoiceStatus(
  formData: FormData,
  mutation: (input: { companyId: string; invoiceId: string }) => Promise<{ id: string; shipmentId: string }>,
  permission: "EDIT" | "DELETE",
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("REVENUE", permission);
    const invoiceId = String(formData.get("invoiceId") || "").trim();
    if (!invoiceId) {
      throw new Error("Invoice id is required");
    }
    const before = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
        customerId: true,
        status: true,
        invoiceNumber: true,
      },
    });
    if (!before) {
      throw new Error("Invoice not found");
    }
    const updated = await mutation({
      companyId: ctx.companyId,
      invoiceId,
    });
    const after = await prisma.invoice.findFirst({
      where: {
        id: updated.id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        shipmentId: true,
        customerId: true,
        status: true,
        invoiceNumber: true,
      },
    });
    if (!after) {
      await recordAuditEvent({
        companyId: ctx.companyId,
        entityType: EntityType.INVOICE,
        entityId: updated.id,
        action: ActivityAction.DELETE,
        shipmentId: before.shipmentId,
        customerId: before.customerId,
        summary: `Invoice ${before.invoiceNumber} deleted.`,
        before: before as unknown as Record<string, unknown>,
        actor: getAuditActor(ctx),
      });
    } else {
      await recordEntityDiff({
        companyId: ctx.companyId,
        entityType: EntityType.INVOICE,
        entityId: updated.id,
        shipmentId: after.shipmentId,
        customerId: after.customerId,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        trackedFields: ["status"],
        actor: getAuditActor(ctx),
        fallbackSummary: `Invoice ${after.invoiceNumber} updated.`,
      });
    }
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${updated.id}`);
    revalidatePath("/finance/ar");
    revalidatePath(`/shipments/${updated.shipmentId}`);
    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: updated.shipmentId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invoice update failed",
    };
  }
}

export async function issueFinanceInvoiceAfipAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  return mutateInvoiceStatus(formData, issueInvoiceWithAfip, "EDIT");
}

export async function markFinanceInvoicePaidAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  return registerFinanceInvoicePaymentAction(_prevState, formData);
}

function defaultPaymentDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function registerFinanceInvoicePaymentAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("REVENUE", "EDIT");
    const parsed = registerInvoicePaymentSchema.parse({
      invoiceId: String(formData.get("invoiceId") || formData.get("id") || "").trim(),
      amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
      paymentDate: String(formData.get("paymentDate") || defaultPaymentDate()),
      method: formData.get("method") ? String(formData.get("method")) : undefined,
      reference: formData.get("reference") ? String(formData.get("reference")) : undefined,
      notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
    });

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: parsed.invoiceId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        currencyCode: true,
        shipmentId: true,
        total: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    const totalAmount = Number(invoice.total);
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
    if (outstandingAmount <= 0) {
      throw new Error("Invoice is already fully paid");
    }
    const amountToRegister = parsed.amount ?? outstandingAmount;

    await registerEntityPayment({
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? null,
      entityType: PaymentEntityType.INVOICE,
      entityId: invoice.id,
      amount: amountToRegister,
      currencyCode: invoice.currencyCode,
      paymentDate: parsed.paymentDate || defaultPaymentDate(),
      method: parsed.method,
      reference: parsed.reference,
      notes: parsed.notes,
      actor: {
        actorId: ctx.userId,
      },
    });

    revalidatePath("/finance");
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${invoice.id}`);
    revalidatePath("/finance/ar");
    revalidatePath("/finance/forecast");
    revalidatePath(`/shipments/${invoice.shipmentId}`);
    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: invoice.shipmentId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to register invoice payment",
    };
  }
}

export async function registerFinanceShipmentCostPaymentAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("EXPENSES", "EDIT");
    const parsed = registerPayablePaymentSchema.parse({
      entityId: String(formData.get("entityId") || formData.get("id") || "").trim(),
      amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
      paymentDate: String(formData.get("paymentDate") || defaultPaymentDate()),
      method: formData.get("method") ? String(formData.get("method")) : undefined,
      reference: formData.get("reference") ? String(formData.get("reference")) : undefined,
      notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
    });

    const cost = await prisma.shipmentCost.findFirst({
      where: {
        id: parsed.entityId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        currencyCode: true,
        shipmentId: true,
        amount: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });
    if (!cost) {
      throw new Error("Shipment cost not found");
    }
    const totalAmount = Number(cost.amount);
    const paidAmount = cost.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
    if (outstandingAmount <= 0) {
      throw new Error("Shipment cost is already fully paid");
    }
    const amountToRegister = parsed.amount ?? outstandingAmount;

    await registerEntityPayment({
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? null,
      entityType: PaymentEntityType.SHIPMENT_COST,
      entityId: cost.id,
      amount: amountToRegister,
      currencyCode: cost.currencyCode,
      paymentDate: parsed.paymentDate || defaultPaymentDate(),
      method: parsed.method,
      reference: parsed.reference,
      notes: parsed.notes,
      actor: {
        actorId: ctx.userId,
      },
    });

    revalidatePath("/finance");
    revalidatePath("/finance/ap");
    revalidatePath("/finance/forecast");
    revalidatePath(`/shipments/${cost.shipmentId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to register shipment cost payment",
    };
  }
}

export async function registerFinanceGeneralExpensePaymentAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("EXPENSES", "EDIT");
    const parsed = registerPayablePaymentSchema.parse({
      entityId: String(formData.get("entityId") || formData.get("id") || "").trim(),
      amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
      paymentDate: String(formData.get("paymentDate") || defaultPaymentDate()),
      method: formData.get("method") ? String(formData.get("method")) : undefined,
      reference: formData.get("reference") ? String(formData.get("reference")) : undefined,
      notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
    });

    const expense = await prisma.generalExpense.findFirst({
      where: {
        id: parsed.entityId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        currencyCode: true,
        amount: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });
    if (!expense) {
      throw new Error("General expense not found");
    }
    const totalAmount = Number(expense.amount);
    const paidAmount = expense.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
    if (outstandingAmount <= 0) {
      throw new Error("General expense is already fully paid");
    }
    const amountToRegister = parsed.amount ?? outstandingAmount;

    await registerEntityPayment({
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? null,
      entityType: PaymentEntityType.GENERAL_EXPENSE,
      entityId: expense.id,
      amount: amountToRegister,
      currencyCode: expense.currencyCode,
      paymentDate: parsed.paymentDate || defaultPaymentDate(),
      method: parsed.method,
      reference: parsed.reference,
      notes: parsed.notes,
      actor: {
        actorId: ctx.userId,
      },
    });

    revalidatePath("/finance");
    revalidatePath("/finance/ap");
    revalidatePath("/finance/expenses");
    revalidatePath("/finance/forecast");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to register general expense payment",
    };
  }
}

export async function registerFinancePayablePaymentAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const entityType = String(formData.get("entityType") || "").trim();
  if (entityType === PaymentEntityType.SHIPMENT_COST) {
    return registerFinanceShipmentCostPaymentAction(_prevState, formData);
  }
  if (entityType === PaymentEntityType.GENERAL_EXPENSE) {
    return registerFinanceGeneralExpensePaymentAction(_prevState, formData);
  }
  return {
    success: false,
    error: "Unsupported payable payment entity type",
  };
}

export async function cancelFinanceInvoiceAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  return mutateInvoiceStatus(formData, cancelInvoice, "EDIT");
}

const generalExpenseSchema = z.object({
  id: z.string().optional(),
  conceptCategory: z.nativeEnum(GeneralExpenseCategory),
  customConcept: z.string().max(160).optional(),
  amount: z.coerce.number().positive().max(100_000_000),
  currencyCode: z.enum(["USD", "EUR", "ARS"]),
  dueDate: z.string().optional(),
  status: z.nativeEnum(GeneralExpenseStatus),
  notes: z.string().max(1200).optional(),
});

export async function upsertGeneralExpenseAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("EXPENSES", "EDIT");
    const parsed = generalExpenseSchema.parse({
      id: formData.get("id") || undefined,
      conceptCategory: formData.get("conceptCategory"),
      customConcept: formData.get("customConcept") || undefined,
      amount: formData.get("amount"),
      currencyCode: formData.get("currencyCode"),
      dueDate: String(formData.get("dueDate") || ""),
      status: formData.get("status"),
      notes: formData.get("notes") || undefined,
    });

    if (
      parsed.conceptCategory === GeneralExpenseCategory.OTHER &&
      !parsed.customConcept?.trim()
    ) {
      throw new Error("Custom concept is required when category is OTHER");
    }

    const payload = {
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? undefined,
      conceptCategory: parsed.conceptCategory,
      customConcept: parsed.customConcept?.trim() ? parsed.customConcept.trim() : null,
      amount: parsed.amount,
      currencyCode: parsed.currencyCode,
      dueDate: toDateOrNull(parsed.dueDate),
      status: parsed.status,
      notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
    };

    if (parsed.id) {
      const existing = await prisma.generalExpense.findFirst({
        where: { id: parsed.id, companyId: ctx.companyId },
        select: {
          id: true,
          conceptCategory: true,
          customConcept: true,
          amount: true,
          currencyCode: true,
          dueDate: true,
          status: true,
          notes: true,
        },
      });
      if (!existing) {
        throw new Error("General expense not found");
      }
      const updated = await prisma.generalExpense.update({
        where: { id: existing.id },
        data: payload,
      });
      await recordEntityDiff({
        companyId: ctx.companyId,
        entityType: EntityType.EXPENSE,
        entityId: existing.id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
        trackedFields: [
          "conceptCategory",
          "customConcept",
          "amount",
          "currencyCode",
          "dueDate",
          "status",
          "notes",
        ],
        actor: getAuditActor(ctx),
        fallbackSummary: "General expense updated.",
      });
    } else {
      const created = await prisma.generalExpense.create({
        data: payload,
      });
      await recordAuditEvent({
        companyId: ctx.companyId,
        entityType: EntityType.EXPENSE,
        entityId: created.id,
        action: ActivityAction.CREATE,
        summary: "General expense created.",
        after: created as unknown as Record<string, unknown>,
        actor: getAuditActor(ctx),
      });
    }

    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/finance/ap");
    revalidatePath("/finance/forecast");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save general expense",
    };
  }
}

export async function deleteGeneralExpenseAction(
  _prevState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  try {
    const ctx = await enforceActionPermission("EXPENSES", "DELETE");
    const id = String(formData.get("id") || "").trim();
    if (!id) {
      throw new Error("General expense id is required");
    }
    const existing = await prisma.generalExpense.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        conceptCategory: true,
        amount: true,
        currencyCode: true,
        status: true,
      },
    });
    if (!existing) {
      throw new Error("General expense not found");
    }
    await prisma.generalExpense.delete({ where: { id: existing.id } });
    await recordAuditEvent({
      companyId: ctx.companyId,
      entityType: EntityType.EXPENSE,
      entityId: existing.id,
      action: ActivityAction.DELETE,
      summary: `General expense ${existing.conceptCategory} deleted.`,
      before: existing as unknown as Record<string, unknown>,
      actor: getAuditActor(ctx),
    });
    revalidatePath("/finance");
    revalidatePath("/finance/expenses");
    revalidatePath("/finance/ap");
    revalidatePath("/finance/forecast");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to delete general expense",
    };
  }
}
