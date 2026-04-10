import { prisma } from "@/lib/prisma";

export async function createAutomationAlertIfMissing(input: {
  companyId: string;
  shipmentId: string;
  message: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
}) {
  const existing = await prisma.alert.findFirst({
    where: {
      companyId: input.companyId,
      shipmentId: input.shipmentId,
      status: "OPEN",
      message: input.message,
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.alert.create({
    data: {
      companyId: input.companyId,
      shipmentId: input.shipmentId,
      type: "MISSING_DOC",
      severity: input.severity ?? "LOW",
      message: input.message,
      status: "OPEN",
    },
  });
}

export async function listDocumentParsingQueue(limit = 80) {
  const capped = Math.max(1, Math.min(limit, 200));
  return prisma.documentParsingResult.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: capped,
    select: {
      id: true,
      status: true,
      documentType: true,
      createdAt: true,
      shipmentDocumentId: true,
      shipmentDocument: {
        select: {
          id: true,
          fileName: true,
          shipmentId: true,
          shipment: {
            select: {
              shipmentNumber: true,
              customer: {
                select: {
                  legalName: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
