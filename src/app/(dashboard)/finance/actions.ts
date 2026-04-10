"use server";

import { revalidatePath } from "next/cache";
import {
  GeneralExpenseCategory,
  GeneralExpenseStatus,
  InvoiceLineType,
  InvoiceStatus,
} from "@prisma/client";
import { z } from "zod";
import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runAlertChecksForInvoiceMutation } from "@/lib/alerts";
import {
  addInvoiceLine,
  cancelInvoice,
  createInvoiceForShipment,
  issueInvoiceWithAfip,
  markInvoicePaid,
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

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsedHeader.shipmentId,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${created.id}`);
    revalidatePath("/finance/ar");
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

      return selectedShipment.id;
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsedHeader.shipmentId,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${invoiceId}`);
    revalidatePath(`/finance/invoices/${invoiceId}/edit`);
    revalidatePath("/finance/ar");
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
    const updated = await mutation({
      companyId: ctx.companyId,
      invoiceId,
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: updated.shipmentId,
    });

    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${updated.id}`);
    revalidatePath("/finance/ar");
    revalidatePath(`/shipments/${updated.shipmentId}`);
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
  return mutateInvoiceStatus(formData, markInvoicePaid, "EDIT");
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
        select: { id: true },
      });
      if (!existing) {
        throw new Error("General expense not found");
      }
      await prisma.generalExpense.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.generalExpense.create({
        data: payload,
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
      select: { id: true },
    });
    if (!existing) {
      throw new Error("General expense not found");
    }
    await prisma.generalExpense.delete({ where: { id: existing.id } });
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
