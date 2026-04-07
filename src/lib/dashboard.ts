import { prisma } from "@/lib/prisma";
import { MilestoneStatus, QuoteStatus, ShipmentStatus } from "@prisma/client";

const DEFAULT_COMPANY_ID = "comp_atlascargo";

export async function getDashboardKpis(companyId = DEFAULT_COMPANY_ID) {
  const [openShipments, delayedMilestones, quotesSent, financeAgg] =
    await Promise.all([
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
        where: {
          companyId,
          status: {
            in: [QuoteStatus.SENT, QuoteStatus.APPROVED, QuoteStatus.REJECTED],
          },
        },
      }),
      prisma.shipment.findMany({
        where: { companyId },
        select: {
          revenues: { select: { amountBase: true } },
          expenses: { select: { amountBase: true } },
        },
      }),
    ]);

  const totalRevenueBase = financeAgg
    .flatMap((shipment) => shipment.revenues)
    .reduce((acc, row) => acc + Number(row.amountBase ?? 0), 0);
  const totalExpenseBase = financeAgg
    .flatMap((shipment) => shipment.expenses)
    .reduce((acc, row) => acc + Number(row.amountBase ?? 0), 0);

  return {
    openShipments,
    delayedMilestones,
    quotesSent,
    estimatedGrossMargin: totalRevenueBase - totalExpenseBase,
  };
}
