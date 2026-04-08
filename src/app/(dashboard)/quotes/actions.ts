"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextQuoteNumber } from "@/lib/quotes";

import { getServerSession } from "next-auth";

export type QuoteActionState = {
  success: boolean;
  error?: string;
};

const pricingSchema = z.object({
  freightSell: z.coerce.number().min(0).default(0),
  originChargesSell: z.coerce.number().min(0).default(0),
  destinationChargesSell: z.coerce.number().min(0).default(0),
  additionalChargesSell: z.coerce.number().min(0).default(0),
  freightCost: z.coerce.number().min(0).default(0),
  originChargesCost: z.coerce.number().min(0).default(0),
  destinationChargesCost: z.coerce.number().min(0).default(0),
  additionalChargesCost: z.coerce.number().min(0).default(0),
});

const quoteSchema = z.object({
  customerId: z.string().min(1),
  mode: z.enum(["AIR", "OCEAN", "ROAD", "RAIL", "MULTIMODAL", "SPECIAL"]),
  direction: z.enum(["IMPORT", "EXPORT", "CROSS_TRADE"]),
  origin: z.string().max(120).optional(),
  destination: z.string().max(120).optional(),
  incotermCode: z.string().max(10).optional(),
  commodity: z.string().max(200).optional(),
  validUntil: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  internalNotes: z.string().max(2000).optional(),
}).merge(pricingSchema);

function norm(value?: string | null) {
  if (!value) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function computeTotals(p: z.infer<typeof pricingSchema>) {
  const totalSell =
    p.freightSell + p.originChargesSell + p.destinationChargesSell + p.additionalChargesSell;
  const totalCost =
    p.freightCost + p.originChargesCost + p.destinationChargesCost + p.additionalChargesCost;
  const grossMarginAmount = totalSell - totalCost;
  const grossMarginPercent = totalSell > 0 ? grossMarginAmount / totalSell : 0;
  return { totalSell, totalCost, grossMarginAmount, grossMarginPercent };
}

async function getQuoteContext(permission: "UPDATE" | "CREATE" | "APPROVE" | "DELETE") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    throw new Error("Unauthorized");
  }
  if (!hasPermission(session.user.role, "QUOTES", permission)) {
    throw new Error("Insufficient permissions");
  }
  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    branchId: session.user.branchId,
  };
}

function parseForm(formData: FormData) {
  return quoteSchema.parse({
    customerId: formData.get("customerId"),
    mode: formData.get("mode"),
    direction: formData.get("direction"),
    origin: formData.get("origin") || undefined,
    destination: formData.get("destination") || undefined,
    incotermCode: formData.get("incotermCode") || undefined,
    commodity: formData.get("commodity") || undefined,
    validUntil: formData.get("validUntil") || undefined,
    currencyCode: formData.get("currencyCode") || "USD",
    internalNotes: formData.get("internalNotes") || undefined,
    freightSell: formData.get("freightSell") || 0,
    originChargesSell: formData.get("originChargesSell") || 0,
    destinationChargesSell: formData.get("destinationChargesSell") || 0,
    additionalChargesSell: formData.get("additionalChargesSell") || 0,
    freightCost: formData.get("freightCost") || 0,
    originChargesCost: formData.get("originChargesCost") || 0,
    destinationChargesCost: formData.get("destinationChargesCost") || 0,
    additionalChargesCost: formData.get("additionalChargesCost") || 0,
  });
}

export async function createQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("CREATE");
    const parsed = parseForm(formData);

    const customer = await prisma.customer.findFirst({
      where: { id: parsed.customerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found for this company");

    const quoteNumber = await getNextQuoteNumber(ctx.companyId);
    const totals = computeTotals(parsed);

    const validUntil = parsed.validUntil ? new Date(parsed.validUntil) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new Error("Invalid validity date");
    }

    const created = await prisma.quote.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId ?? undefined,
        ownerUserId: ctx.userId,
        quoteNumber,
        customerId: parsed.customerId,
        mode: parsed.mode,
        direction: parsed.direction,
        origin: norm(parsed.origin),
        destination: norm(parsed.destination),
        incotermCode: norm(parsed.incotermCode),
        commodity: norm(parsed.commodity),
        validUntil,
        currencyCode: parsed.currencyCode,
        internalNotes: norm(parsed.internalNotes),
        freightSell: parsed.freightSell,
        originChargesSell: parsed.originChargesSell,
        destinationChargesSell: parsed.destinationChargesSell,
        additionalChargesSell: parsed.additionalChargesSell,
        freightCost: parsed.freightCost,
        originChargesCost: parsed.originChargesCost,
        destinationChargesCost: parsed.destinationChargesCost,
        additionalChargesCost: parsed.additionalChargesCost,
        ...totals,
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: created.id,
        action: "CREATE",
        actorId: ctx.userId,
        afterJson: { quoteNumber, status: "DRAFT", mode: parsed.mode },
      },
    });

    revalidatePath("/quotes");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("UPDATE");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const existing = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!existing) throw new Error("Quote not found");

    if (existing.status === "APPROVED") {
      throw new Error("Cannot edit an approved quote");
    }
    if (existing.status === "REJECTED" || existing.status === "EXPIRED") {
      throw new Error("Cannot edit a " + existing.status.toLowerCase() + " quote");
    }

    const parsed = parseForm(formData);
    const totals = computeTotals(parsed);

    const customer = await prisma.customer.findFirst({
      where: { id: parsed.customerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found for this company");

    const validUntil = parsed.validUntil ? new Date(parsed.validUntil) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new Error("Invalid validity date");
    }

    const statusReset = existing.status === "SENT" ? "DRAFT" : existing.status;

    await prisma.quote.update({
      where: { id },
      data: {
        status: statusReset,
        customerId: parsed.customerId,
        mode: parsed.mode,
        direction: parsed.direction,
        origin: norm(parsed.origin),
        destination: norm(parsed.destination),
        incotermCode: norm(parsed.incotermCode),
        commodity: norm(parsed.commodity),
        validUntil,
        currencyCode: parsed.currencyCode,
        internalNotes: norm(parsed.internalNotes),
        freightSell: parsed.freightSell,
        originChargesSell: parsed.originChargesSell,
        destinationChargesSell: parsed.destinationChargesSell,
        additionalChargesSell: parsed.additionalChargesSell,
        freightCost: parsed.freightCost,
        originChargesCost: parsed.originChargesCost,
        destinationChargesCost: parsed.destinationChargesCost,
        additionalChargesCost: parsed.additionalChargesCost,
        ...totals,
        sentAt: statusReset === "DRAFT" ? null : existing.sentAt,
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: id,
        action: "UPDATE",
        actorId: ctx.userId,
        afterJson: { revertedToDraft: statusReset === "DRAFT" && existing.status === "SENT" },
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function sendQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("UPDATE");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "DRAFT") throw new Error("Only draft quotes can be sent");

    await prisma.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId, entityType: "QUOTE", entityId: id,
        action: "UPDATE", actorId: ctx.userId,
        afterJson: { action: "SENT" },
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function approveQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("APPROVE");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "SENT") throw new Error("Only sent quotes can be approved");

    if (Number(quote.totalSell) === 0) {
      throw new Error("Cannot approve a quote without sell pricing");
    }

    await prisma.quote.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: ctx.userId },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId, entityType: "QUOTE", entityId: id,
        action: "APPROVE", actorId: ctx.userId,
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function rejectQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("UPDATE");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "SENT") throw new Error("Only sent quotes can be rejected");

    await prisma.quote.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId, entityType: "QUOTE", entityId: id,
        action: "UPDATE", actorId: ctx.userId,
        afterJson: { action: "REJECTED" },
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function expireQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("UPDATE");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "DRAFT" && quote.status !== "SENT") {
      throw new Error("Only draft or sent quotes can be expired");
    }

    await prisma.quote.update({
      where: { id },
      data: { status: "EXPIRED" },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function convertQuoteToShipmentAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  let shipmentId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.companyId) throw new Error("Unauthorized");
    if (!hasPermission(session.user.role, "QUOTES", "UPDATE")) throw new Error("Insufficient permissions for quotes");
    if (!hasPermission(session.user.role, "SHIPMENTS", "CREATE")) throw new Error("Insufficient permissions to create shipments");

    const ctx = {
      userId: session.user.id,
      companyId: session.user.companyId,
      branchId: session.user.branchId,
    };

    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
      include: { shipment: { select: { id: true } } },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "APPROVED") throw new Error("Only approved quotes can be converted to shipments");
    if (quote.shipment) throw new Error("Quote has already been converted to a shipment");

    const year = new Date().getFullYear();
    const lastShipment = await prisma.shipment.findFirst({
      where: { companyId: ctx.companyId, shipmentNumber: { startsWith: `SHP-${year}-` } },
      orderBy: { shipmentNumber: "desc" },
      select: { shipmentNumber: true },
    });
    let nextSeq = 1;
    if (lastShipment) {
      nextSeq = parseInt(lastShipment.shipmentNumber.replace(`SHP-${year}-`, ""), 10) + 1;
    }
    const shipmentNumber = `SHP-${year}-${String(nextSeq).padStart(4, "0")}`;

    const shipment = await prisma.shipment.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId ?? undefined,
        ownerUserId: ctx.userId,
        shipmentNumber,
        customerId: quote.customerId,
        quoteId: quote.id,
        mode: quote.mode,
        direction: quote.direction,
        status: "DRAFT",
        incotermCode: quote.incotermCode ?? undefined,
        commodity: quote.commodity ?? undefined,
        notes: `Converted from quote ${quote.quoteNumber}. Origin: ${quote.origin ?? "N/A"}, Destination: ${quote.destination ?? "N/A"}.`,
      },
    });
    shipmentId = shipment.id;

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId, entityType: "QUOTE", entityId: quote.id,
        action: "CONVERT", actorId: ctx.userId,
        afterJson: { shipmentId: shipment.id, shipmentNumber },
      },
    });
    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId, entityType: "SHIPMENT", entityId: shipment.id,
        action: "CREATE", actorId: ctx.userId,
        afterJson: { fromQuote: quote.quoteNumber, status: "DRAFT" },
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/shipments");
    revalidatePath("/dashboard");
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }

  redirect(`/shipments/${shipmentId}`);
}

export async function deleteQuoteDirectAction(formData: FormData): Promise<void> {
  const ctx = await getQuoteContext("DELETE");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Quote id is required");

  const existing = await prisma.quote.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Quote not found");
  if (existing.status === "APPROVED") throw new Error("Cannot delete an approved quote");

  await prisma.quote.delete({ where: { id: existing.id } });

  await prisma.activityLog.create({
    data: {
      companyId: ctx.companyId, entityType: "QUOTE", entityId: id,
      action: "DELETE", actorId: ctx.userId,
    },
  });

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}
