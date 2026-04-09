import { prisma } from "@/lib/prisma";

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
