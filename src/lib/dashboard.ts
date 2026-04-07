import { prisma } from "@/lib/prisma";
import { MilestoneStatus, QuoteStatus, ShipmentStatus } from "@prisma/client";

const DEFAULT_COMPANY_ID = "comp_atlascargo";

export async function getDashboardKpis(companyId = DEFAULT_COMPANY_ID) {
  const [
    openShipments,
    delayedMilestones,
    totalQuotes,
    approvedQuotes,
    allQuotesDecided,
    approvedQuoteMargins,
  ] = await Promise.all([
    prisma.shipment.count({
      where: {
        companyId,
        status: {
          in: [
            ShipmentStatus.OPEN,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.ARRIVED,
            ShipmentStatus.CUSTOMS,
          ],
        },
      },
    }),
    prisma.shipmentMilestone.count({
      where: {
        shipment: { companyId },
        status: MilestoneStatus.DELAYED,
      },
    }),
    prisma.quote.count({
      where: { companyId },
    }),
    prisma.quote.count({
      where: { companyId, status: QuoteStatus.APPROVED },
    }),
    prisma.quote.count({
      where: {
        companyId,
        status: {
          in: [QuoteStatus.APPROVED, QuoteStatus.REJECTED],
        },
      },
    }),
    prisma.quote.findMany({
      where: {
        companyId,
        status: QuoteStatus.APPROVED,
      },
      select: {
        marginAmount: true,
      },
    }),
  ]);

  const totalApprovedMargin = approvedQuoteMargins.reduce(
    (acc, q) => acc + Number(q.marginAmount ?? 0),
    0,
  );

  const approvalRate =
    allQuotesDecided > 0
      ? Math.round((approvedQuotes / allQuotesDecided) * 100)
      : 0;

  return {
    openShipments,
    delayedMilestones,
    totalQuotes,
    approvalRate,
    totalApprovedMargin,
  };
}
