"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  QuoteCustomsClearanceScope,
  QuoteLoadType,
  QuoteServiceScope,
  QuoteStatus,
  TradeDirection,
  TransportMode,
} from "@prisma/client";
import { z } from "zod";

import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const quoteCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  mode: z.nativeEnum(TransportMode),
  direction: z.nativeEnum(TradeDirection),
  originCode: z.string().trim().min(2, "Origin is required").max(32),
  destinationCode: z.string().trim().min(2, "Destination is required").max(32),
  currencyCode: z.string().trim().min(1).default("USD"),
  loadType: z.nativeEnum(QuoteLoadType).optional(),
  packageCount: z.coerce.number().int().min(1).max(1_000_000).optional(),
  packageType: z.string().trim().min(1).max(80).optional(),
  grossWeightKg: z.coerce.number().positive().max(10_000_000).optional(),
  volumeM3: z.coerce.number().positive().max(100_000).optional(),
  cargoReadyDate: z.string().optional(),
  serviceScope: z.nativeEnum(QuoteServiceScope).optional(),
  customerReference: z.string().trim().max(80).optional(),
  insuranceRequired: z.boolean().default(false),
  customsClearanceScope: z.nativeEnum(QuoteCustomsClearanceScope).default(QuoteCustomsClearanceScope.NONE),
  equipmentType: z.string().trim().max(80).optional(),
  incotermCode: z.string().trim().max(10).optional(),
  validUntil: z.string().optional(),
  commodity: z.string().trim().max(160).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  chargesJson: z.string().trim().optional().default("[]"),
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

type QuoteChargeInput = {
  concept: string;
  providerName?: string;
  buyAmount: number;
  sellAmount: number;
  currencyCode: string;
};

function parseCharges(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid charges payload");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid charges payload");
  }

  const rows: QuoteChargeInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") {
      throw new Error("Invalid charge row");
    }
    const record = row as Record<string, unknown>;
    const concept = typeof record.concept === "string" ? record.concept.trim() : "";
    const providerName = typeof record.providerName === "string" ? record.providerName.trim() : "";
    const buyAmount = Number(record.buyAmount);
    const sellAmount = Number(record.sellAmount);
    const currencyCode =
      typeof record.currencyCode === "string" ? record.currencyCode.trim().toUpperCase() : "";

    const isEmptyRow = !concept && !providerName && buyAmount === 0 && sellAmount === 0;
    if (isEmptyRow) {
      continue;
    }
    if (!concept) throw new Error("Each filled charge row requires a concept");
    if (!Number.isFinite(buyAmount) || buyAmount < 0) throw new Error("Invalid buy amount");
    if (!Number.isFinite(sellAmount) || sellAmount < 0) throw new Error("Invalid sell amount");
    if (!currencyCode) throw new Error("Invalid charge currency");

    rows.push({
      concept,
      providerName: providerName || undefined,
      buyAmount,
      sellAmount,
      currencyCode,
    });
  }

  return rows;
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
    if (error.message.includes("charge")) {
      return "Unable to create quote because one or more pricing rows are invalid.";
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
      loadType: formData.get("loadType") || undefined,
      packageCount: formData.get("packageCount") || undefined,
      packageType: formData.get("packageType") || undefined,
      grossWeightKg: formData.get("grossWeightKg") || undefined,
      volumeM3: formData.get("volumeM3") || undefined,
      cargoReadyDate: String(formData.get("cargoReadyDate") || ""),
      serviceScope: formData.get("serviceScope") || undefined,
      customerReference: formData.get("customerReference") || undefined,
      insuranceRequired: formData.get("insuranceRequired") === "on",
      customsClearanceScope: formData.get("customsClearanceScope") || QuoteCustomsClearanceScope.NONE,
      equipmentType: formData.get("equipmentType") || undefined,
      incotermCode: formData.get("incotermCode") || undefined,
      originCode: formData.get("originCode"),
      destinationCode: formData.get("destinationCode"),
      validUntil: String(formData.get("validUntil") || ""),
      commodity: formData.get("commodity") || undefined,
      internalNotes: formData.get("internalNotes") || undefined,
      chargesJson: String(formData.get("chargesJson") || ""),
    });

    const validUntil = parseDate(parsed.validUntil);
    const cargoReadyDate = parseDate(parsed.cargoReadyDate);
    const currencyCode = (parsed.currencyCode || "USD").trim().toUpperCase();
    const incotermCode = normalizeOptional(parsed.incotermCode)?.toUpperCase();
    const charges = parseCharges(parsed.chargesJson);

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
      const totalBuy = charges.reduce((sum, row) => sum + row.buyAmount, 0);
      const totalSell = charges.reduce((sum, row) => sum + row.sellAmount, 0);
      const marginAmount = totalSell - totalBuy;
      const marginPct = totalSell > 0 ? (marginAmount / totalSell) * 100 : 0;

      const created = await tx.quote.create({
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
          loadType: parsed.loadType,
          packageCount: parsed.packageCount,
          packageType: normalizeOptional(parsed.packageType),
          grossWeightKg: parsed.grossWeightKg,
          volumeM3: parsed.volumeM3,
          cargoReadyDate: cargoReadyDate ?? undefined,
          serviceScope: parsed.serviceScope,
          customerReference: normalizeOptional(parsed.customerReference),
          insuranceRequired: parsed.insuranceRequired,
          customsClearanceScope: parsed.customsClearanceScope,
          equipmentType: normalizeOptional(parsed.equipmentType),
          commodity: normalizeOptional(parsed.commodity),
          validUntil,
          currencyCode,
          totalBuy,
          totalSell,
          marginAmount,
          marginPct,
          internalNotes: normalizeOptional(parsed.internalNotes),
        },
      });

      if (charges.length > 0) {
        await tx.quoteCharge.createMany({
          data: charges.map((row) => ({
            quoteId: created.id,
            concept: row.concept,
            providerName: row.providerName ?? null,
            buyAmount: row.buyAmount,
            sellAmount: row.sellAmount,
            currencyCode: row.currencyCode,
          })),
        });
      }

      return created;
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
