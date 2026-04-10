"use server";

import { DocumentRecordStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { runAlertChecksForShipmentUpdate } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";

import { shipmentDocumentSchema } from "./schemas";
import {
  assertShipmentAccess,
  getContext,
  normalizeOptional,
  parseDocumentStatus,
  parseDocumentType,
  persistShipmentDocumentFile,
  toDate,
} from "./shared";
import type { ShipmentActionState } from "./types";

export async function upsertShipmentDocumentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      throw new Error("Document file is required");
    }

    const parsed = shipmentDocumentSchema.parse({
      replaceOfId: formData.get("replaceOfId") || undefined,
      shipmentId: formData.get("shipmentId"),
      docType: parseDocumentType(formData.get("docType")),
      referenceNumber: formData.get("referenceNumber") || undefined,
      issueDate: String(formData.get("issueDate") || ""),
      status: parseDocumentStatus(formData.get("status") ?? DocumentRecordStatus.PENDING),
      notes: formData.get("notes") || undefined,
    });

    const shipment = await assertShipmentAccess(ctx.companyId, parsed.shipmentId);
    const issueDate = toDate(parsed.issueDate);

    if (parsed.replaceOfId) {
      const existing = await prisma.shipmentDocument.findFirst({
        where: {
          id: parsed.replaceOfId,
          shipment: { companyId: ctx.companyId },
        },
        select: { id: true, shipmentId: true, docType: true },
      });
      if (!existing) {
        throw new Error("Document not found");
      }
      if (existing.shipmentId !== shipment.id) {
        throw new Error("Document does not belong to this shipment");
      }
      if (existing.docType !== parsed.docType) {
        throw new Error("Replacement document must keep the same type");
      }
    }

    const fileMeta = await persistShipmentDocumentFile({ shipmentId: shipment.id, file });
    const latestVersion = await prisma.shipmentDocument.aggregate({
      where: {
        shipmentId: shipment.id,
        docType: parsed.docType,
      },
      _max: { version: true },
    });

    await prisma.shipmentDocument.create({
      data: {
        shipmentId: shipment.id,
        docType: parsed.docType,
        fileName: fileMeta.fileName,
        fileUrl: fileMeta.fileUrl,
        referenceNumber: normalizeOptional(parsed.referenceNumber),
        issueDate,
        version: (latestVersion._max.version ?? 0) + 1,
        status: parsed.status ?? DocumentRecordStatus.PENDING,
        notes: normalizeOptional(parsed.notes),
        uploadedById: ctx.userId,
      },
    });

    await runAlertChecksForShipmentUpdate({
      companyId: ctx.companyId,
      shipmentId: shipment.id,
    });
    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function upsertShipmentDocumentDirectAction(formData: FormData): Promise<void> {
  const result = await upsertShipmentDocumentAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to save shipment document");
  }
}

export async function uploadShipmentDocumentDirectAction(formData: FormData): Promise<void> {
  const result = await upsertShipmentDocumentAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to upload shipment document");
  }
}

export async function replaceShipmentDocumentDirectAction(formData: FormData): Promise<void> {
  const result = await upsertShipmentDocumentAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to replace shipment document");
  }
}

export async function deleteShipmentDocumentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("SHIPMENTS", "EDIT");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      throw new Error("Document id is required");
    }

    const existing = await prisma.shipmentDocument.findFirst({
      where: {
        id,
        shipment: { companyId: ctx.companyId },
      },
      select: {
        id: true,
        shipmentId: true,
      },
    });
    if (!existing) {
      throw new Error("Document not found");
    }

    await prisma.shipmentDocument.delete({ where: { id: existing.id } });
    await runAlertChecksForShipmentUpdate({
      companyId: ctx.companyId,
      shipmentId: existing.shipmentId,
    });
    revalidatePath(`/shipments/${existing.shipmentId}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteShipmentDocumentDirectAction(formData: FormData): Promise<void> {
  const result = await deleteShipmentDocumentAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to delete document");
  }
}
