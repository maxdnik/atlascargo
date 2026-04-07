import { QuoteStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type QuoteListFilters = {
  q?: string;
  mode?: string;
  status?: string;
};

function isTransportMode(value?: string): value is TransportMode {
  return value !== undefined && Object.values(TransportMode).includes(value as TransportMode);
}

function isQuoteStatus(value?: string): value is QuoteStatus {
  return value !== undefined && Object.values(QuoteStatus).includes(value as QuoteStatus);
}

export async function listQuotes(companyId: string, filters?: QuoteListFilters) {
  const search = filters?.q?.trim();
  const modeFilter = isTransportMode(filters?.mode) ? filters?.mode : undefined;
  const statusFilter = isQuoteStatus(filters?.status) ? filters?.status : undefined;

  return prisma.quote.findMany({
    where: {
      companyId,
      ...(modeFilter ? { mode: modeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { quoteNumber: { contains: search } },
              { origin: { contains: search } },
              { destination: { contains: search } },
              {
                customer: {
                  legalName: { contains: search },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          legalName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function getQuoteById(companyId: string, id: string) {
  return prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          legalName: true,
        },
      },
      charges: {
        orderBy: { createdAt: "asc" },
      },
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
        },
      },
    },
  });
}

export async function getNextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;

  const lastQuote = await prisma.quote.findFirst({
    where: {
      companyId,
      quoteNumber: { startsWith: prefix },
    },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  if (!lastQuote) {
    return `${prefix}0001`;
  }

  const lastSeq = parseInt(lastQuote.quoteNumber.replace(prefix, ""), 10);
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function deleteQuoteById(companyId: string, id: string) {
  const existing = await prisma.quote.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new Error("Quote not found");
  }

  if (existing.status === "APPROVED") {
    throw new Error("Cannot delete an approved quote");
  }

  await prisma.quote.delete({ where: { id: existing.id } });
}
