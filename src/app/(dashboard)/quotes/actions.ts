"use server";

import { revalidatePath } from "next/cache";
import { Prisma, QuoteStatus, TradeDirection, TransportMode } from "@prisma/client";
import { z } from "zod";

import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const quoteCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  mode: z.nativeEnum(TransportMode),
  direction: z.nativeEnum(TradeDirection),
  currencyCode: z.string().trim().min(1, "Currency is required"),
  incotermCode: z.string().trim().max(10).optional(),
  originCode: z.string().trim().max(32).optional(),
  destinationCode: z.string().trim().max(32).optional(),
  validUntil: z.string().optional(),
  commodity: z.string().trim().max(160).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
});

export type QuoteActionState = {
  success: boolean;
  error?: string;
};

function normalizeOptional(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value");
  }
  return parsed;
}

async function nextQuoteNumber(tx: Prisma.TransactionClient, companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const counter = await tx.shipmentNumberCounter.upsert({
      where: {
        companyId_prefix: {
          companyId,
          prefix,
        },
      },
      create: {
        companyId,
        prefix,
        nextValue: 2,
      },
      update: {
        nextValue: { increment: 1 },
      },
      select: {
        nextValue: true,
      },
    });

    const sequence = counter.nextValue - 1;
    const quoteNumber = `${prefix}-${String(sequence).padStart(4, "0")}`;
    const exists = await tx.quote.findFirst({
      where: {
        companyId,
        quoteNumber,
      },
      select: { id: true },
    });
    if (!exists) {
      return quoteNumber;
    }
  }
  throw new Error("Unable to generate quote number");
}

function safeQuoteError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "Please review the required quote fields and try again.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "A quote with this number already exists. Please retry.";
    }
    if (error.code === "P2003") {
      return "Unable to create quote because related master data is invalid.";
    }
  }
  if (error instanceof Error) {
    if (error.message === "Customer not found") {
      return "Unable to create quote because the selected customer is invalid.";
    }
    if (error.message === "Currency not found") {
      return "Unable to create quote because the selected currency is invalid.";
    }
    if (error.message === "Invalid incoterm") {
      return "Unable to create quote because the selected incoterm is invalid.";
    }
  }
  return "Unable to create quote right now. Please try again.";
}

export async function createQuoteAction(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  try {
    const ctx = await enforceActionPermission("QUOTES", "CREATE");
    const parsed = quoteCreateSchema.parse({
      customerId: formData.get("customerId"),
      mode: formData.get("mode"),
      direction: formData.get("direction"),
      currencyCode: formData.get("currencyCode"),
      incotermCode: formData.get("incotermCode") || undefined,
      originCode: formData.get("originCode") || undefined,
      destinationCode: formData.get("destinationCode") || undefined,
      validUntil: String(formData.get("validUntil") || ""),
      commodity: formData.get("commodity") || undefined,
      internalNotes: formData.get("internalNotes") || undefined,
    });

    const validUntil = parseDate(parsed.validUntil);
    const currencyCode = parsed.currencyCode.trim().toUpperCase();
    const incotermCode = normalizeOptional(parsed.incotermCode)?.toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      const [customer, currency, incoterm] = await Promise.all([
        tx.customer.findFirst({
          where: {
            id: parsed.customerId,
            companyId: ctx.companyId,
          },
          select: { id: true },
        }),
        tx.currency.findUnique({
          where: { code: currencyCode },
          select: { code: true },
        }),
        incotermCode
          ? tx.incoterm.findUnique({
              where: { code: incotermCode },
              select: { code: true },
            })
          : Promise.resolve(null),
      ]);

      if (!customer) {
        throw new Error("Customer not found");
      }
      if (!currency) {
        throw new Error("Currency not found");
      }
      if (incotermCode && !incoterm) {
        throw new Error("Invalid incoterm");
      }

      const quoteNumber = await nextQuoteNumber(tx, ctx.companyId);
      return tx.quote.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          ownerUserId: ctx.userId,
          quoteNumber,
          customerId: customer.id,
          mode: parsed.mode,
          direction: parsed.direction,
          status: QuoteStatus.DRAFT,
          incotermCode: incotermCode ?? undefined,
          originCode: normalizeOptional(parsed.originCode)?.toUpperCase(),
          destinationCode: normalizeOptional(parsed.destinationCode)?.toUpperCase(),
          commodity: normalizeOptional(parsed.commodity),
          validUntil,
          currencyCode,
          internalNotes: normalizeOptional(parsed.internalNotes),
        },
      });
    });

    await prisma.activityLog.create({
      data: {
        companyId: ctx.companyId,
        entityType: "QUOTE",
        entityId: created.id,
        action: "CREATE",
        actorId: ctx.userId,
        afterJson: {
          quoteNumber: created.quoteNumber,
          customerId: created.customerId,
          mode: created.mode,
          direction: created.direction,
          status: created.status,
        },
      },
    });

    revalidatePath("/quotes");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[createQuoteAction] failed", {
      error,
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: safeQuoteError(error) };
  }
}
