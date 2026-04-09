import { cp } from "node:fs/promises";
import { chromium } from "playwright";
import { MilestoneStatus, ShipmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SHIPMENT_ID = "shp_air_import_0001";
const SHIPMENT_NUMBER = "SHP-2026-0001";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function resetBaselineState() {
  const bookingRequestedAt = new Date("2026-04-04T10:00:00.000Z");
  await prisma.shipment.update({
    where: { id: SHIPMENT_ID },
    data: {
      status: ShipmentStatus.BOOKING_REQUESTED,
      atd: null,
      ata: null,
      deliveredAt: null,
    },
  });

  const baselineMilestones = [
    {
      code: "BOOKING_REQUESTED",
      label: "Booking Requested",
      actualAt: bookingRequestedAt,
      status: MilestoneStatus.COMPLETED,
    },
    {
      code: "BOOKING_CONFIRMED",
      label: "Booking Confirmed",
      actualAt: null,
      status: MilestoneStatus.PENDING,
    },
    {
      code: "DEPARTED",
      label: "Departed",
      actualAt: null,
      status: MilestoneStatus.PENDING,
    },
    {
      code: "ARRIVED",
      label: "Arrived",
      actualAt: null,
      status: MilestoneStatus.PENDING,
    },
    {
      code: "DELIVERED",
      label: "Delivered",
      actualAt: null,
      status: MilestoneStatus.PENDING,
    },
  ] as const;

  for (const row of baselineMilestones) {
    await prisma.shipmentMilestone.upsert({
      where: {
        shipmentId_code: {
          shipmentId: SHIPMENT_ID,
          code: row.code,
        },
      },
      create: {
        shipmentId: SHIPMENT_ID,
        code: row.code,
        label: row.label,
        expectedAt: row.actualAt,
        actualAt: row.actualAt,
        status: row.status,
        isCritical: true,
      },
      update: {
        label: row.label,
        expectedAt: row.actualAt,
        actualAt: row.actualAt,
        status: row.status,
      },
    });
  }
}

function expectedHeaderLabel(status: ShipmentStatus) {
  if (status === ShipmentStatus.BOOKING_REQUESTED) return "Booking Requested";
  if (status === ShipmentStatus.BOOKING_CONFIRMED) return "Booking Confirmed";
  if (status === ShipmentStatus.IN_TRANSIT) return "In Transit";
  if (status === ShipmentStatus.ARRIVED) return "Arrived";
  if (status === ShipmentStatus.DELIVERED) return "Delivered";
  return status;
}

async function expectDetailStatus(page: import("playwright").Page, expected: ShipmentStatus) {
  await page.goto(`${BASE_URL}/shipments/${SHIPMENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("heading", { name: new RegExp(SHIPMENT_NUMBER) }).waitFor({ timeout: 10000 });

  const shipmentForm = page
    .locator("form")
    .filter({ has: page.locator("select[name='mode']") })
    .first();
  await shipmentForm.waitFor({ state: "visible", timeout: 10000 });
  const formStatus = await shipmentForm.locator("select[name='status']").inputValue();
  assertCondition(formStatus === expected, `Detail form status expected ${expected}, got ${formStatus}`);

  const pillText = await page
    .locator("span[class*='px-3'][class*='py-1.5'][class*='text-sm'][class*='font-semibold']")
    .first()
    .innerText();
  const expectedLabel = expectedHeaderLabel(expected);
  assertCondition(
    pillText.toLowerCase().includes(expectedLabel.toLowerCase()),
    `Detail header status expected ${expectedLabel}, got ${pillText}`,
  );

  console.log(`PASS detail status ${expected}`);
}

async function updateMilestone(
  page: import("playwright").Page,
  code: "DEPARTED" | "ARRIVED" | "DELIVERED",
  actualAtValue: string,
) {
  const form = page.locator("form").filter({
    has: page.locator(`input[name='code'][value='${code}']`),
  });
  await form.first().waitFor({ state: "visible", timeout: 10000 });
  await form.locator("input[name='actualAt']").fill(actualAtValue);
  await form.locator("select[name='status']").selectOption("COMPLETED");
  await form.getByRole("button", { name: "Update milestone" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  console.log(`PASS updated milestone ${code} -> ${actualAtValue}`);
}

async function expectShipmentsListStatus(page: import("playwright").Page, expectedLabel: string) {
  await page.goto(`${BASE_URL}/shipments`, { waitUntil: "networkidle" });
  const row = page.locator("tr").filter({ hasText: SHIPMENT_NUMBER }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  const rowText = await row.innerText();
  assertCondition(
    rowText.toLowerCase().includes(expectedLabel.toLowerCase()),
    `Shipments list expected ${expectedLabel}, got row: ${rowText}`,
  );
  console.log(`PASS shipments list status ${expectedLabel}`);
}

async function expectDashboardStatus(page: import("playwright").Page, expected: ShipmentStatus) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const row = page.locator("tr").filter({ hasText: SHIPMENT_NUMBER }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  const rowText = await row.innerText();
  assertCondition(
    rowText.toUpperCase().includes(expected),
    `Dashboard expected ${expected}, got row: ${rowText}`,
  );
  console.log(`PASS dashboard status ${expected}`);
}

async function expectActionCenterRecentShipmentStatus(
  page: import("playwright").Page,
  expected: ShipmentStatus,
) {
  await page.goto(`${BASE_URL}/dashboard/action-center`, { waitUntil: "networkidle" });
  const recentShipmentsPanel = page.locator("article", {
    has: page.getByRole("heading", { name: "Recent Shipments", exact: true }),
  });
  const recentCard = recentShipmentsPanel.locator("a", { hasText: SHIPMENT_NUMBER }).first();
  await recentCard.waitFor({ state: "visible", timeout: 10000 });
  const cardText = await recentCard.innerText();
  assertCondition(
    cardText.toUpperCase().includes(expected),
    `Action center expected ${expected}, got card: ${cardText}`,
  );
  console.log(`PASS action center recent shipment status ${expected}`);
}

async function expectPersistedShipmentStatus(expected: ShipmentStatus) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: SHIPMENT_ID },
    select: { status: true, atd: true, ata: true, deliveredAt: true },
  });
  assertCondition(Boolean(shipment), "Shipment not found in DB");
  assertCondition(shipment!.status === expected, `DB status expected ${expected}, got ${shipment!.status}`);
  console.log(`PASS db status ${expected}`);
}

async function run() {
  await resetBaselineState();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: "/tmp", size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill("admin@atlascargo.local");
  await page.locator("#password").fill("Admin123!");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log("PASS login");

  await expectDetailStatus(page, ShipmentStatus.BOOKING_REQUESTED);

  await updateMilestone(page, "DEPARTED", "2026-04-06T09:00");
  await expectPersistedShipmentStatus(ShipmentStatus.IN_TRANSIT);
  await expectDetailStatus(page, ShipmentStatus.IN_TRANSIT);
  await expectShipmentsListStatus(page, "In Transit");

  await page.goto(`${BASE_URL}/shipments/${SHIPMENT_ID}`, { waitUntil: "networkidle" });
  await updateMilestone(page, "ARRIVED", "2026-04-08T12:00");
  await expectPersistedShipmentStatus(ShipmentStatus.ARRIVED);
  await expectDetailStatus(page, ShipmentStatus.ARRIVED);
  await expectShipmentsListStatus(page, "Arrived");
  await expectDashboardStatus(page, ShipmentStatus.ARRIVED);
  await page.screenshot({ path: "/opt/cursor/artifacts/status_sync_arrived_dashboard.png", fullPage: false });
  await expectActionCenterRecentShipmentStatus(page, ShipmentStatus.ARRIVED);
  await page.screenshot({
    path: "/opt/cursor/artifacts/status_sync_arrived_action_center.png",
    fullPage: false,
  });

  await page.goto(`${BASE_URL}/shipments/${SHIPMENT_ID}`, { waitUntil: "networkidle" });
  await updateMilestone(page, "DELIVERED", "2026-04-09T14:30");
  await expectPersistedShipmentStatus(ShipmentStatus.DELIVERED);
  await expectDetailStatus(page, ShipmentStatus.DELIVERED);
  await expectShipmentsListStatus(page, "Delivered");
  await expectDashboardStatus(page, ShipmentStatus.DELIVERED);
  await expectActionCenterRecentShipmentStatus(page, ShipmentStatus.DELIVERED);
  await page.screenshot({ path: "/opt/cursor/artifacts/status_sync_delivered_detail.png", fullPage: false });
  await page.screenshot({ path: "/opt/cursor/artifacts/status_sync_delivered_list.png", fullPage: false });

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const recordedPath = await video.path();
    await cp(recordedPath, "/opt/cursor/artifacts/status_sync_milestone_updates_flow.webm");
    console.log("PASS saved video /opt/cursor/artifacts/status_sync_milestone_updates_flow.webm");
  }

  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
