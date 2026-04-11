"use server";

import { revalidatePath } from "next/cache";
import { DocumentParsingStatus } from "@prisma/client";

import { createAutomationAlertIfMissing } from "@/lib/automation";
import {
  applyParsedDocumentToShipment,
  parseShipmentDocumentWithMock,
  type ParsedShipmentFieldKey,
} from "@/lib/document-parsing";
import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { applyDocumentParsingSchema, triggerDocumentParsingSchema } from "./schemas";
import { assertShipmentAccess, getContext } from "./shared";
import type { ShipmentActionState } from "./types";

async function resolveActionPermissionForDocumentParsing(input: {
  shipmentId: string;
  requireEdit?: boolean;
}) {
  const viewCtx = await getContext("SHIPMENTS", "EDIT");
  const shipment = await assertShipmentAccess(viewCtx.companyId, input.shipmentId);
  if (input.requireEdit) {
    await enforceActionPermission("SHIPMENTS", "EDIT");
  }
  return { ctx: viewCtx, shipment };
}

async function createParsingFailureAlert(input: {
  companyId: string;
  shipmentId: string;
  fileName: string;
}) {
  const message = `Document parsing failed for ${input.fileName}. Manual review required.`;
  await createAutomationAlertIfMissing({
    companyId: input.companyId,
    shipmentId: input.shipmentId,
    message,
  });
}

export async function triggerDocumentParsingAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const parsed = triggerDocumentParsingSchema.parse({
      shipmentId: formData.get("shipmentId"),
      shipmentDocumentId: formData.get("shipmentDocumentId"),
    });

    const { ctx, shipment } = await resolveActionPermissionForDocumentParsing({
      shipmentId: parsed.shipmentId,
      requireEdit: false,
    });

    const document = await prisma.shipmentDocument.findFirst({
      where: {
        id: parsed.shipmentDocumentId,
        shipmentId: shipment.id,
        shipment: { companyId: ctx.companyId },
      },
      select: {
        id: true,
        fileName: true,
      },
    });
    if (!document) {
      throw new Error("Document not found for this shipment");
    }

    const result = await parseShipmentDocumentWithMock({
      companyId: ctx.companyId,
      userId: ctx.userId,
      shipmentDocumentId: document.id,
    });

    if (result.status === DocumentParsingStatus.FAILED) {
      await createParsingFailureAlert({
        companyId: ctx.companyId,
        shipmentId: shipment.id,
        fileName: document.fileName,
      });
    }

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function triggerDocumentParsingDirectAction(formData: FormData): Promise<void> {
  const result = await triggerDocumentParsingAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to parse document");
  }
}

export async function applyDocumentParsingAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const parsed = applyDocumentParsingSchema.parse({
      shipmentId: formData.get("shipmentId"),
      parsingResultId: formData.get("parsingResultId"),
      strategy: formData.get("strategy") || undefined,
      overrideFields: formData.get("overrideFields") || undefined,
    });

    const { ctx, shipment } = await resolveActionPermissionForDocumentParsing({
      shipmentId: parsed.shipmentId,
      requireEdit: true,
    });

    const overrideFields = String(parsed.overrideFields ?? "")
      .split(",")
      .map((field) => field.trim())
      .filter((field): field is ParsedShipmentFieldKey => Boolean(field));

    const applyResult = await applyParsedDocumentToShipment({
      companyId: ctx.companyId,
      userId: ctx.userId,
      parsingResultId: parsed.parsingResultId,
      strategy: parsed.strategy ?? "ONLY_EMPTY",
      confirmedOverrideFields: overrideFields,
    });

    if (applyResult.shipmentId !== shipment.id) {
      throw new Error("Parsing result does not belong to this shipment");
    }

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function applyDocumentParsingDirectAction(formData: FormData): Promise<void> {
  const result = await applyDocumentParsingAction({ success: false }, formData);
  if (!result.success) {
    throw new Error(result.error ?? "Unable to apply parsed document data");
  }
}
