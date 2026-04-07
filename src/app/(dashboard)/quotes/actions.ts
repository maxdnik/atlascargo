"use server";

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

const chargeSchema = z.object({
  concept: z.string().min(1),
  chargeType: z.enum(["FREIGHT", "ORIGIN", "DESTINATION", "ADDITIONAL"]),
  buyAmount: z.coerce.number().min(0).default(0),
  sellAmount: z.coerce.number().min(0).default(0),
});

const quoteCreateSchema = z.object({
  customerId: z.string().min(1),
  mode: z.enum(["AIR", "OCEAN", "ROAD", "RAIL", "MULTIMODAL", "SPECIAL"]),
  direction: z.enum(["IMPORT", "EXPORT", "CROSS_TRADE"]),
  origin: z.string().max(120).optional(),
  destination: z.string().max(120).optional(),
  incotermCode: z.string().max(10).optional(),
  validUntil: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  internalNotes: z.string().max(1000).optional(),
  charges: z.array(chargeSchema).default([]),
});

function normalizeOptional(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function computeTotals(charges: Array<{ buyAmount: number; sellAmount: number }>) {
  const totalBuy = charges.reduce((sum, c) => sum + c.buyAmount, 0);
  const totalSell = charges.reduce((sum, c) => sum + c.sellAmount, 0);
  const marginAmount = totalSell - totalBuy;
  const marginPct = totalSell > 0 ? marginAmount / totalSell : 0;
  return { totalBuy, totalSell, marginAmount, marginPct };
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

export async function createQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await getQuoteContext("CREATE");

    const chargesRaw = formData.get("charges");
    let parsedCharges: Array<{ concept: string; chargeType: string; buyAmount: number; sellAmount: number }> = [];
    if (chargesRaw && typeof chargesRaw === "string" && chargesRaw.length > 0) {
      parsedCharges = JSON.parse(chargesRaw);
    }

    const parsed = quoteCreateSchema.parse({
      customerId: formData.get("customerId"),
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      origin: formData.get("origin") || undefined,
      destination: formData.get("destination") || undefined,
      incotermCode: formData.get("incotermCode") || undefined,
      validUntil: formData.get("validUntil") || undefined,
      currencyCode: formData.get("currencyCode") || "USD",
      internalNotes: formData.get("internalNotes") || undefined,
      charges: parsedCharges,
    });

    const customer = await prisma.customer.findFirst({
      where: { id: parsed.customerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found for this company");

    const quoteNumber = await getNextQuoteNumber(ctx.companyId);
    const totals = computeTotals(parsed.charges);

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
        origin: normalizeOptional(parsed.origin),
        destination: normalizeOptional(parsed.destination),
        incotermCode: normalizeOptional(parsed.incotermCode),
        validUntil,
        currencyCode: parsed.currencyCode,
        internalNotes: normalizeOptional(parsed.internalNotes),
        totalBuy: totals.totalBuy,
        totalSell: totals.totalSell,
        marginAmount: totals.marginAmount,
        marginPct: totals.marginPct,
        charges: {
          create: parsed.charges.map((c) => ({
            concept: c.concept,
            chargeType: c.chargeType,
            buyAmount: c.buyAmount,
            sellAmount: c.sellAmount,
            currencyCode: parsed.currencyCode,
          })),
        },
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

    const chargesRaw = formData.get("charges");
    let parsedCharges: Array<{ concept: string; chargeType: string; buyAmount: number; sellAmount: number }> = [];
    if (chargesRaw && typeof chargesRaw === "string" && chargesRaw.length > 0) {
      parsedCharges = JSON.parse(chargesRaw);
    }

    const parsed = quoteCreateSchema.parse({
      customerId: formData.get("customerId"),
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      origin: formData.get("origin") || undefined,
      destination: formData.get("destination") || undefined,
      incotermCode: formData.get("incotermCode") || undefined,
      validUntil: formData.get("validUntil") || undefined,
      currencyCode: formData.get("currencyCode") || "USD",
      internalNotes: formData.get("internalNotes") || undefined,
      charges: parsedCharges,
    });

    const customer = await prisma.customer.findFirst({
      where: { id: parsed.customerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found for this company");

    const totals = computeTotals(parsed.charges);

    const validUntil = parsed.validUntil ? new Date(parsed.validUntil) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new Error("Invalid validity date");
    }

    await prisma.quoteCharge.deleteMany({ where: { quoteId: id } });

    const updated = await prisma.quote.update({
      where: { id },
      data: {
        customerId: parsed.customerId,
        mode: parsed.mode,
        direction: parsed.direction,
        origin: normalizeOptional(parsed.origin),
        destination: normalizeOptional(parsed.destination),
        incotermCode: normalizeOptional(parsed.incotermCode),
        validUntil,
        currencyCode: parsed.currencyCode,
        internalNotes: normalizeOptional(parsed.internalNotes),
        totalBuy: totals.totalBuy,
        totalSell: totals.totalSell,
        marginAmount: totals.marginAmount,
        marginPct: totals.marginPct,
        charges: {
          create: parsed.charges.map((c) => ({
            concept: c.concept,
            chargeType: c.chargeType,
            buyAmount: c.buyAmount,
            sellAmount: c.sellAmount,
            currencyCode: parsed.currencyCode,
          })),
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: updated.id,
        action: "UPDATE",
        actorId: ctx.userId,
        beforeJson: existing,
        afterJson: updated,
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
      include: { charges: true },
    });
    if (!quote) throw new Error("Quote not found");

    if (quote.status !== "DRAFT") {
      throw new Error("Only draft quotes can be sent");
    }

    await prisma.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: id,
        action: "UPDATE",
        actorId: ctx.userId,
        afterJson: { action: "SENT" },
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
      include: { charges: true },
    });
    if (!quote) throw new Error("Quote not found");

    if (quote.status !== "SENT") {
      throw new Error("Only sent quotes can be approved");
    }

    if (quote.charges.length === 0) {
      throw new Error("Cannot approve a quote without pricing");
    }

    await prisma.quote.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: id,
        action: "APPROVE",
        actorId: ctx.userId,
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

    if (quote.status !== "SENT") {
      throw new Error("Only sent quotes can be rejected");
    }

    await prisma.quote.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: id,
        action: "UPDATE",
        actorId: ctx.userId,
        afterJson: { action: "REJECTED" },
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function convertQuoteToShipmentAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.companyId) {
      throw new Error("Unauthorized");
    }

    if (!hasPermission(session.user.role, "QUOTES", "UPDATE")) {
      throw new Error("Insufficient permissions for quotes");
    }
    if (!hasPermission(session.user.role, "SHIPMENTS", "CREATE")) {
      throw new Error("Insufficient permissions to create shipments");
    }

    const ctx = {
      userId: session.user.id,
      companyId: session.user.companyId,
      branchId: session.user.branchId,
    };

    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Quote id is required");

    const quote = await prisma.quote.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        customer: { select: { id: true } },
        shipment: { select: { id: true } },
      },
    });
    if (!quote) throw new Error("Quote not found");

    if (quote.status !== "APPROVED") {
      throw new Error("Only approved quotes can be converted to shipments");
    }

    if (quote.shipment) {
      throw new Error("Quote has already been converted to a shipment");
    }

    const year = new Date().getFullYear();
    const lastShipment = await prisma.shipment.findFirst({
      where: {
        companyId: ctx.companyId,
        shipmentNumber: { startsWith: `SHP-${year}-` },
      },
      orderBy: { shipmentNumber: "desc" },
      select: { shipmentNumber: true },
    });

    let nextSeq = 1;
    if (lastShipment) {
      const lastNum = parseInt(lastShipment.shipmentNumber.replace(`SHP-${year}-`, ""), 10);
      nextSeq = lastNum + 1;
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
        notes: `Converted from quote ${quote.quoteNumber}`,
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: quote.id,
        action: "CONVERT",
        actorId: ctx.userId,
        afterJson: { shipmentId: shipment.id, shipmentNumber },
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "SHIPMENT",
        entityId: shipment.id,
        action: "CREATE",
        actorId: ctx.userId,
        afterJson: { fromQuote: quote.quoteNumber, status: "DRAFT" },
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/shipments");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
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
      companyId: ctx.companyId,
      entityType: "QUOTE",
      entityId: id,
      action: "DELETE",
      actorId: ctx.userId,
    },
  });

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}
