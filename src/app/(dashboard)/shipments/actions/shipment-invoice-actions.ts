"use server";

import { revalidatePath } from "next/cache";

import { enforceActionPermission } from "@/lib/permissions";
import {
  addInvoiceLine,
  cancelInvoice,
  createInvoiceForShipment,
  deleteInvoice,
  issueInvoiceWithAfip,
  markInvoicePaid,
  updateInvoiceHeader,
} from "@/lib/invoices";
import { runAlertChecksForInvoiceMutation } from "@/lib/alerts";

import {
  invoiceCreateSchema,
  invoiceLineUpsertSchema,
} from "./schemas";
import type { ShipmentActionState } from "./types";
import { getContext } from "./shared";

export async function createInvoiceAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "CREATE");
    const parsed = invoiceCreateSchema.parse({
      shipmentId: formData.get("shipmentId"),
      invoiceNumber: formData.get("invoiceNumber") || undefined,
      currencyCode: formData.get("currencyCode") || undefined,
      lineDescription: formData.get("lineDescription"),
      lineAmount: formData.get("lineAmount"),
      lineType: formData.get("lineType"),
      taxes: formData.get("taxes") || undefined,
      issueDate: String(formData.get("issueDate") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      notes: formData.get("notes") || undefined,
    });

    const created = await createInvoiceForShipment({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      shipmentId: parsed.shipmentId,
      invoiceNumber: parsed.invoiceNumber?.trim(),
      currencyCode: parsed.currencyCode,
      taxes: parsed.taxes,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      notes: parsed.notes,
      firstLine: {
        description: parsed.lineDescription.trim(),
        amount: parsed.lineAmount,
        type: parsed.lineType,
      },
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsed.shipmentId,
    });

    revalidatePath(`/shipments/${parsed.shipmentId}`);
    revalidatePath(`/finance/invoices/${created.id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function createInvoiceDirectAction(formData: FormData): Promise<void> {
  const result = await createInvoiceAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to create invoice");
  }
}

export async function upsertInvoiceAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "EDIT");
    const parsed = invoiceLineUpsertSchema.parse({
      id: formData.get("id"),
      shipmentId: formData.get("shipmentId"),
      lineId: formData.get("lineId") || undefined,
      lineDescription: formData.get("lineDescription"),
      lineAmount: formData.get("lineAmount"),
      lineType: formData.get("lineType"),
      invoiceNumber: formData.get("invoiceNumber") || undefined,
      currencyCode: formData.get("currencyCode") || undefined,
      issueDate: String(formData.get("issueDate") || ""),
      dueDate: String(formData.get("dueDate") || ""),
      notes: formData.get("notes") || undefined,
    });

    await addInvoiceLine({
      companyId: ctx.companyId,
      invoiceId: parsed.id,
      description: parsed.lineDescription.trim(),
      amount: parsed.lineAmount,
      type: parsed.lineType,
    });

    if (parsed.issueDate || parsed.dueDate || parsed.invoiceNumber || parsed.currencyCode) {
      await updateInvoiceHeader({
        companyId: ctx.companyId,
        invoiceId: parsed.id,
        invoiceNumber: parsed.invoiceNumber,
        currencyCode: parsed.currencyCode,
        issueDate: parsed.issueDate,
        dueDate: parsed.dueDate,
        notes: parsed.notes,
      });
    }

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: parsed.shipmentId,
    });

    revalidatePath(`/shipments/${parsed.shipmentId}`);
    revalidatePath(`/finance/invoices/${parsed.id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function upsertInvoiceDirectAction(formData: FormData): Promise<void> {
  const result = await upsertInvoiceAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to update invoice");
  }
}

export async function issueInvoiceAFIPAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Invoice id is required");
    }

    const issued = await issueInvoiceWithAfip({
      companyId: ctx.companyId,
      invoiceId: id,
    });

    revalidatePath(`/shipments/${issued.shipmentId}`);
    revalidatePath(`/finance/invoices/${issued.id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function issueInvoiceAFIPDirectAction(formData: FormData): Promise<void> {
  const result = await issueInvoiceAFIPAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to issue invoice in AFIP flow");
  }
}

export async function markInvoicePaidAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Invoice id is required");
    }

    const updated = await markInvoicePaid({
      companyId: ctx.companyId,
      invoiceId: id,
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: updated.shipmentId,
    });

    revalidatePath(`/shipments/${updated.shipmentId}`);
    revalidatePath(`/finance/invoices/${updated.id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function markInvoicePaidDirectAction(formData: FormData): Promise<void> {
  const result = await markInvoicePaidAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to mark invoice paid");
  }
}

export async function cancelInvoiceAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Invoice id is required");
    }

    const updated = await cancelInvoice({
      companyId: ctx.companyId,
      invoiceId: id,
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: updated.shipmentId,
    });

    revalidatePath(`/shipments/${updated.shipmentId}`);
    revalidatePath(`/finance/invoices/${updated.id}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function cancelInvoiceDirectAction(formData: FormData): Promise<void> {
  const result = await cancelInvoiceAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to cancel invoice");
  }
}

export async function deleteInvoiceAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    await enforceActionPermission("REVENUE", "DELETE");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Invoice id is required");
    }

    const deleted = await deleteInvoice({
      companyId: ctx.companyId,
      invoiceId: id,
    });

    await runAlertChecksForInvoiceMutation({
      companyId: ctx.companyId,
      shipmentId: deleted.shipmentId,
    });

    revalidatePath(`/shipments/${deleted.shipmentId}`);
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/ar");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteInvoiceDirectAction(formData: FormData): Promise<void> {
  const result = await deleteInvoiceAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to delete invoice");
  }
}
