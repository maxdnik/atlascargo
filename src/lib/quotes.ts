import { QuoteStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type QuoteListFilters = {
  q?: string;
  mode?: string;
  status?: string;
  customerId?: string;
};

function isTransportMode(value?: string): value is TransportMode {
  return value !== undefined && Object.values(TransportMode).includes(value as TransportMode);
}

function isQuoteStatus(value?: string): value is QuoteStatus {
  return value !== undefined && Object.values(QuoteStatus).includes(value as QuoteStatus);
}

export async function autoExpireQuotes(companyId: string) {
  const now = new Date();
  await prisma.quote.updateMany({
    where: {
      companyId,
      status: { in: ["DRAFT", "SENT"] },
      validUntil: { lt: now, not: null },
    },
    data: { status: "EXPIRED" },
  });
}

export async function listQuotes(companyId: string, filters?: QuoteListFilters) {
  await autoExpireQuotes(companyId);

  const search = filters?.q?.trim();
  const modeFilter = isTransportMode(filters?.mode) ? filters?.mode : undefined;
  const statusFilter = isQuoteStatus(filters?.status) ? filters?.status : undefined;
  const customerFilter = filters?.customerId?.trim() || undefined;

  return prisma.quote.findMany({
    where: {
      companyId,
      ...(modeFilter ? { mode: modeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(customerFilter ? { customerId: customerFilter } : {}),
      ...(search
        ? {
            OR: [
              { quoteNumber: { contains: search } },
              { origin: { contains: search } },
              { destination: { contains: search } },
              { commodity: { contains: search } },
              { customer: { legalName: { contains: search } } },
            ],
          }
        : {}),
    },
    include: {
      customer: {
        select: { id: true, code: true, legalName: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function getQuoteById(companyId: string, id: string) {
  await autoExpireQuotes(companyId);

  return prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: { id: true, code: true, legalName: true },
      },
      owner: {
        select: { id: true, name: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      shipment: {
        select: { id: true, shipmentNumber: true, status: true },
      },
    },
  });
}

export async function getNextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;

  const lastQuote = await prisma.quote.findFirst({
    where: { companyId, quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  if (!lastQuote) return `${prefix}0001`;

  const lastSeq = parseInt(lastQuote.quoteNumber.replace(prefix, ""), 10);
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}
