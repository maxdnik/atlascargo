import { prisma } from "@/lib/prisma";
import { AlertSeverity, MilestoneStatus, QuoteStatus, ShipmentStatus } from "@prisma/client";
import { listOpenAlertsForCompany } from "@/lib/alerts";
import { deriveShipmentState, getStatusLabel } from "@/lib/shipment-state";

const DEFAULT_COMPANY_ID = "comp_atlascargo";

export async function getDashboardKpis(companyId = DEFAULT_COMPANY_ID) {
  const [quotesSent, financeAgg] =
    await Promise.all([
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

  const [shipments, pendingDocuments, pendingFinancialRecords, openAlerts] = await Promise.all([
    prisma.shipment.findMany({
      where: { companyId },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
        mode: true,
        updatedAt: true,
        atd: true,
        ata: true,
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
          select: {
            code: true,
            status: true,
            expectedAt: true,
            actualAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 140,
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
    listOpenAlertsForCompany(companyId, 8),
  ]);

  const shipmentsWithDerivedState = shipments.map((shipment) => {
    const derived = deriveShipmentState(
      {
        status: shipment.status,
        atd: shipment.atd,
        ata: shipment.ata,
        deliveredAt: shipment.deliveredAt,
      },
      shipment.milestones.map((milestone) => ({
        code: milestone.code,
        status: milestone.status,
        expectedAt: milestone.expectedAt,
        actualAt: milestone.actualAt,
      })),
    );
    return {
      ...shipment,
      status: derived.masterStatus as ShipmentStatus,
      derivedState: derived,
    };
  });

  const openShipmentStatuses: ShipmentStatus[] = [
    ShipmentStatus.BOOKING_REQUESTED,
    ShipmentStatus.BOOKING_CONFIRMED,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.ARRIVED,
    ShipmentStatus.CUSTOMS,
  ];
  const openShipments = shipmentsWithDerivedState.filter((shipment) =>
    openShipmentStatuses.includes(shipment.status as ShipmentStatus),
  ).length;
  const delayedMilestones = shipmentsWithDerivedState.reduce((sum, shipment) => {
    if (!shipment.derivedState.isDelayed) return sum;
    return sum + shipment.derivedState.delayedMilestones.length;
  }, 0);
  const inTransit = shipmentsWithDerivedState.filter(
    (shipment) => shipment.status === ShipmentStatus.IN_TRANSIT,
  ).length;
  const inCustoms = shipmentsWithDerivedState.filter(
    (shipment) => shipment.status === ShipmentStatus.CUSTOMS,
  ).length;
  const delivered = shipmentsWithDerivedState.filter(
    (shipment) => shipment.status === ShipmentStatus.DELIVERED,
  ).length;
  const derivedOperationalIssues = shipmentsWithDerivedState.filter(
    (shipment) => shipment.derivedState.isDelayed,
  ).length;
  const pendingIssues = derivedOperationalIssues + pendingDocuments.length + pendingFinancialRecords.length;

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

  const currentWeekDelivered = shipmentsWithDerivedState.filter((shipment) => {
    if (!shipment.deliveredAt) return false;
    const deliveredAt = shipment.deliveredAt.getTime();
    return deliveredAt >= now - 7 * dayMs && deliveredAt <= now;
  }).length;
  const previousWeekDelivered = shipmentsWithDerivedState.filter((shipment) => {
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
      count: shipmentsWithDerivedState.filter((shipment) => shipment.mode === "AIR").length,
    },
    {
      mode: "OCEAN" as const,
      count: shipmentsWithDerivedState.filter((shipment) => shipment.mode === "OCEAN").length,
    },
    {
      mode: "ROAD" as const,
      count: shipmentsWithDerivedState.filter((shipment) => shipment.mode === "ROAD").length,
    },
  ];

  const fallbackAlerts = [
    ...shipmentsWithDerivedState
      .filter((shipment) => shipment.derivedState.delayedMilestones.length > 0)
      .slice(0, 5)
      .map((shipment) => ({
        id: `delayed-${shipment.id}-${shipment.shipmentNumber}`,
        title: `Delayed shipment · ${shipment.shipmentNumber}`,
        level: "critical" as const,
        timestamp: shipment.updatedAt.toLocaleString(),
        createdAt: shipment.updatedAt,
        ctaHref: "/dashboard/action-center",
        shipmentLabel: shipment.shipmentNumber,
        shipmentId: shipment.id,
      })),
    ...pendingDocuments.map((entry) => ({
      id: `docs-${entry.shipment.shipmentNumber}-${entry.updatedAt.getTime()}`,
      title: `Missing documents · ${entry.shipment.shipmentNumber}`,
      level: "warning" as const,
      timestamp: entry.updatedAt.toLocaleString(),
      createdAt: entry.updatedAt,
      ctaHref: "/dashboard/action-center",
      shipmentLabel: entry.shipment.shipmentNumber,
      shipmentId: null,
    })),
    ...pendingFinancialRecords.map((entry) => ({
      id: `finance-${entry.shipment.shipmentNumber}-${entry.updatedAt.getTime()}`,
      title: `Pending actions · ${entry.shipment.shipmentNumber}`,
      level: "warning" as const,
      timestamp: entry.updatedAt.toLocaleString(),
      createdAt: entry.updatedAt,
      ctaHref: "/dashboard/action-center",
      shipmentLabel: entry.shipment.shipmentNumber,
      shipmentId: null,
    })),
  ];
  const alerts = (
    openAlerts.length > 0
      ? openAlerts.map((alert) => ({
          id: alert.id,
          title: alert.message,
          level: alert.severity === AlertSeverity.HIGH ? ("critical" as const) : ("warning" as const),
          timestamp: alert.createdAt.toLocaleString(),
          createdAt: alert.createdAt,
          ctaHref: alert.ctaHref,
          shipmentId: alert.shipmentId,
        }))
      : fallbackAlerts
  )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  const activityRows = shipmentsWithDerivedState.slice(0, 12).map((shipment) => ({
    id: shipment.id,
    status: shipment.derivedState.masterStatus,
    statusLabel: getStatusLabel(shipment.derivedState.masterStatus),
    shipmentNumber: shipment.shipmentNumber,
    customer: shipment.customer,
    originCode: shipment.originCode,
    destinationCode: shipment.destinationCode,
    eta: shipment.eta,
  }));

  const trackingSource = shipmentsWithDerivedState.find(
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
              trackingSource.derivedState.masterStatus === ShipmentStatus.IN_TRANSIT
                ? "current"
                : trackingSource.derivedState.masterStatus === ShipmentStatus.ARRIVED ||
                    trackingSource.derivedState.masterStatus === ShipmentStatus.CUSTOMS ||
                    trackingSource.derivedState.masterStatus === ShipmentStatus.DELIVERED ||
                    trackingSource.derivedState.masterStatus === ShipmentStatus.CLOSED
                  ? "done"
                  : "pending",
            description: "Main carriage movement",
          },
          {
            label: "Customs",
            state:
              trackingSource.derivedState.masterStatus === ShipmentStatus.CUSTOMS
                ? "current"
                : trackingSource.derivedState.masterStatus === ShipmentStatus.DELIVERED ||
                    trackingSource.derivedState.masterStatus === ShipmentStatus.CLOSED
                  ? "done"
                  : "pending",
            description: "Clearance and inspections",
          },
          {
            label: "Delivered",
            state:
              trackingSource.derivedState.masterStatus === ShipmentStatus.DELIVERED ||
              trackingSource.derivedState.masterStatus === ShipmentStatus.CLOSED
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
