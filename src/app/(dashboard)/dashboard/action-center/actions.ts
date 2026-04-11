"use server";

import { revalidatePath } from "next/cache";
import { resolveAlertForCompany } from "@/lib/alerts";
import { enforceActionPermission } from "@/lib/permissions";
import { ActivityActorType } from "@prisma/client";

export async function resolveActionCenterAlertAction(formData: FormData) {
  const ctx = await enforceActionPermission("DASHBOARD", "VIEW");
  const alertId = String(formData.get("alertId") ?? "").trim();
  if (!alertId) {
    throw new Error("alertId is required");
  }

  await resolveAlertForCompany({
    companyId: ctx.companyId,
    alertId,
    actor: {
      actorType: ActivityActorType.USER,
      actorId: ctx.userId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/action-center");
}
