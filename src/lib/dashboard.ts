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
              ShipmentStatus.BOOKING_REQUESTED,
              ShipmentStatus.BOOKING_CONFIRMED,
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

  const [shipments, delayedMilestoneEntries, pendingDocuments, pendingFinancialRecords] = await Promise.all([
    prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        mode: true,
        houseRef: true,
        masterRef: true,
        bookingRef: true,
        deliveredAt: true,
        customer: {
          select: {
            legalName: true,
          },
        },
        originCode: true,
        destinationCode: true,
        eta: true,
        createdAt: true,
        milestones: {
          where: {
            code: {
              in: ["ORIGIN_PICKED_UP", "IN_TRANSIT", "CUSTOMS", "DELIVERED"],
            },
          },
          select: {
            code: true,
            status: true,
            actualAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 140,
    }),
    prisma.shipmentMilestone.findMany({
      where: {
        shipment: { companyId },
        status: MilestoneStatus.DELAYED,
      },
      select: {
        updatedAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    prisma.shipmentDocument.findMany({
      where: {
        shipment: { companyId },
        status: "PENDING",
      },
      select: {
        updatedAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    prisma.revenue.findMany({
      where: {
        companyId,
        status: "PENDING",
      },
      select: {
        updatedAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  const inTransit = shipments.filter((shipment) => shipment.status === ShipmentStatus.IN_TRANSIT).length;
  const inCustoms = shipments.filter((shipment) => shipment.status === ShipmentStatus.CUSTOMS).length;
  const delivered = shipments.filter((shipment) => shipment.status === ShipmentStatus.DELIVERED).length;
  const pendingIssues = delayedMilestones + pendingDocuments.length + pendingFinancialRecords.length;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const weeklyActivity = Array.from({ length: 7 }).map((_, idx) => {
    const start = new Date(now - (6 - idx) * dayMs);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + dayMs);
    const count = shipments.filter((shipment) => {
      const created = shipment.createdAt.getTime();
      return created >= start.getTime() && created < end.getTime();
    }).length;
    return {
      weekLabel: start.toLocaleDateString("en-US", { weekday: "short" }),
      count,
    };
  });

  const currentWeekDelivered = shipments.filter((shipment) => {
    if (!shipment.deliveredAt) return false;
    const deliveredAt = shipment.deliveredAt.getTime();
    return deliveredAt >= now - 7 * dayMs && deliveredAt <= now;
  }).length;
  const previousWeekDelivered = shipments.filter((shipment) => {
    if (!shipment.deliveredAt) return false;
    const deliveredAt = shipment.deliveredAt.getTime();
    return deliveredAt >= now - 14 * dayMs && deliveredAt < now - 7 * dayMs;
  }).length;
  const deliveredWeekOverWeekPct =
    previousWeekDelivered === 0
      ? currentWeekDelivered > 0
        ? 100
        : 0
      : ((currentWeekDelivered - previousWeekDelivered) / previousWeekDelivered) * 100;

  const modeBreakdown = [
    {
      mode: "AIR" as const,
      count: shipments.filter((shipment) => shipment.mode === "AIR").length,
    },
    {
      mode: "OCEAN" as const,
      count: shipments.filter((shipment) => shipment.mode === "OCEAN").length,
    },
    {
      mode: "ROAD" as const,
      count: shipments.filter((shipment) => shipment.mode === "ROAD").length,
    },
  ];

  const alerts = [
    ...delayedMilestoneEntries.map((entry, index) => ({
      id: `delayed-${index}-${entry.shipment.shipmentNumber}`,
      title: `Delayed shipment · ${entry.shipment.shipmentNumber}`,
      level: "critical" as const,
      timestamp: entry.updatedAt.toLocaleString(),
    })),
    ...pendingDocuments.map((entry, index) => ({
      id: `docs-${index}-${entry.shipment.shipmentNumber}`,
      title: `Missing documents · ${entry.shipment.shipmentNumber}`,
      level: "warning" as const,
      timestamp: entry.updatedAt.toLocaleString(),
    })),
    ...pendingFinancialRecords.map((entry, index) => ({
      id: `finance-${index}-${entry.shipment.shipmentNumber}`,
      title: `Pending actions · ${entry.shipment.shipmentNumber}`,
      level: "warning" as const,
      timestamp: entry.updatedAt.toLocaleString(),
    })),
  ]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 8);

  const activityRows = shipments.slice(0, 12).map((shipment) => ({
    id: shipment.id,
    status: shipment.status,
    shipmentNumber: shipment.shipmentNumber,
    customer: shipment.customer,
    originCode: shipment.originCode,
    destinationCode: shipment.destinationCode,
    eta: shipment.eta,
  }));

  const trackingSource = shipments.find(
    (shipment) =>
      shipment.status === ShipmentStatus.IN_TRANSIT ||
      shipment.status === ShipmentStatus.CUSTOMS ||
      shipment.status === ShipmentStatus.ARRIVED,
  );
  const trackingPanel = trackingSource
    ? {
        shipmentNumber: trackingSource.shipmentNumber,
        houseRef: trackingSource.houseRef,
        masterRef: trackingSource.masterRef,
        bookingRef: trackingSource.bookingRef,
        steps: [
          {
            label: "Origin picked up",
            state: trackingSource.milestones.some(
              (item) => item.code === "ORIGIN_PICKED_UP" && item.status === MilestoneStatus.COMPLETED,
            )
              ? "done"
              : "pending",
            description: "Origin handover and consolidation",
          },
          {
            label: "In transit",
            state:
              trackingSource.status === ShipmentStatus.IN_TRANSIT
                ? "current"
                : trackingSource.status === ShipmentStatus.ARRIVED ||
                    trackingSource.status === ShipmentStatus.CUSTOMS ||
                    trackingSource.status === ShipmentStatus.DELIVERED ||
                    trackingSource.status === ShipmentStatus.CLOSED
                  ? "done"
                  : "pending",
            description: "Main carriage movement",
          },
          {
            label: "Customs",
            state:
              trackingSource.status === ShipmentStatus.CUSTOMS
                ? "current"
                : trackingSource.status === ShipmentStatus.DELIVERED ||
                    trackingSource.status === ShipmentStatus.CLOSED
                  ? "done"
                  : "pending",
            description: "Clearance and inspections",
          },
          {
            label: "Delivered",
            state:
              trackingSource.status === ShipmentStatus.DELIVERED ||
              trackingSource.status === ShipmentStatus.CLOSED
                ? "done"
                : "pending",
            description: "Final handover completed",
          },
        ],
      }
    : null;

  return {
    openShipments,
    delayedMilestones,
    quotesSent,
    estimatedGrossMargin: totalRevenueBase - totalExpenseBase,
    shipmentsInTransit: inTransit,
    shipmentsInCustoms: inCustoms,
    shipmentsDelivered: delivered,
    pendingIssues,
    customsAgingCount: delayedMilestones,
    deliveredWeekOverWeekPct,
    modeBreakdown,
    weeklyActivity,
    alerts,
    activityRows,
    trackingPanel,
  };
}
