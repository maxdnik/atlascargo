"use server";

import { revalidatePath } from "next/cache";
import { MilestoneStatus } from "@prisma/client";

import {
  AUTO_COMPLETE_MISSING_SEQUENCE_MILESTONES,
  MilestoneSequenceError,
  validateMilestoneCompletionSequence,
} from "@/lib/milestone-sequence";
import { runAlertChecksForShipmentUpdate } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { syncShipmentStatusFromMilestones } from "@/lib/shipment-status";

import { milestoneUpdateSchema } from "./schemas";
import { getDefaultMilestones } from "./shared";
import { getContext, normalizeOptional, toDate } from "./shared";
import type { ShipmentActionState } from "./types";

export async function upsertMilestoneAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  try {
    const ctx = await getContext("MILESTONES", "EDIT");

    const parsed = milestoneUpdateSchema.parse({
      shipmentId: formData.get("shipmentId"),
      code: formData.get("code"),
      label: formData.get("label"),
      expectedAt: String(formData.get("expectedAt") || ""),
      actualAt: String(formData.get("actualAt") || ""),
      status: formData.get("status") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const shipment = await prisma.shipment.findFirst({
      where: {
        id: parsed.shipmentId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
      },
    });
    if (!shipment) {
      throw new Error("Shipment not found");
    }

    const expectedAt = toDate(parsed.expectedAt);
    const actualAt = toDate(parsed.actualAt);
    const normalizedNotes = normalizeOptional(parsed.notes);
    const status = parsed.status ?? (actualAt ? MilestoneStatus.COMPLETED : MilestoneStatus.PENDING);

    const currentMilestones = await prisma.shipmentMilestone.findMany({
      where: {
        shipmentId: shipment.id,
      },
      select: {
        code: true,
        status: true,
        actualAt: true,
      },
    });

    const sequenceValidation = validateMilestoneCompletionSequence({
      targetCode: parsed.code,
      targetStatus: status,
      targetActualAt: actualAt,
      milestones: currentMilestones,
      autoCompleteMissing: AUTO_COMPLETE_MISSING_SEQUENCE_MILESTONES,
    });

    await prisma.$transaction(async (tx) => {
      if (sequenceValidation.autoCompleteCodes.length > 0) {
        for (const code of sequenceValidation.autoCompleteCodes) {
          await tx.shipmentMilestone.updateMany({
            where: {
              shipmentId: shipment.id,
              code,
            },
            data: {
              status: MilestoneStatus.COMPLETED,
            },
          });
        }
      }

      await tx.shipmentMilestone.upsert({
        where: {
          shipmentId_code: {
            shipmentId: shipment.id,
            code: parsed.code,
          },
        },
        create: {
          shipmentId: shipment.id,
          code: parsed.code,
          label: parsed.label,
          expectedAt,
          actualAt,
          status,
          comment: normalizedNotes,
          isCritical: getDefaultMilestones().some((m) => m.code === parsed.code && m.isCritical),
        },
        update: {
          label: parsed.label,
          expectedAt,
          actualAt,
          status,
          comment: normalizedNotes,
        },
      });
    });

    const syncResult = await syncShipmentStatusFromMilestones({
      companyId: ctx.companyId,
      shipmentId: shipment.id,
    });

    if (syncResult.statusChanged || syncResult.datesChanged || syncResult.milestoneStatusesChanged) {
      await prisma.activityLog.create({
        data: {
          companyId: ctx.companyId,
          entityType: "SHIPMENT",
          entityId: shipment.id,
          action: "UPDATE",
          actorId: ctx.userId,
          beforeJson: {
            previousStatus: syncResult.previousStatus,
          },
          afterJson: {
            nextStatus: syncResult.nextStatus,
            statusChanged: syncResult.statusChanged,
            datesChanged: syncResult.datesChanged,
            milestoneStatusesChanged: syncResult.milestoneStatusesChanged,
            source: "MILESTONE_UPDATE",
            milestoneCode: parsed.code,
          },
        },
      });
    }

    await runAlertChecksForShipmentUpdate({
      companyId: ctx.companyId,
      shipmentId: shipment.id,
    });

    revalidatePath(`/shipments/${shipment.id}`);
    revalidatePath("/shipments");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/action-center");
    return { success: true };
  } catch (error) {
    if (error instanceof MilestoneSequenceError) {
      return {
        success: false,
        errorCode: error.code,
        error: error.message,
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
