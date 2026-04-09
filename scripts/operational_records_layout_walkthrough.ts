import { cp } from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SHIPMENT_ID = "shp_air_import_0001";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
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

  await page.goto(`${BASE_URL}/shipments/${SHIPMENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  console.log("PASS shipment detail loaded");

  const rightColumn = page.locator("div.grid.gap-5.xl\\:grid-cols-3 > div.space-y-5").nth(1);
  await rightColumn.waitFor({ state: "visible", timeout: 10000 });

  const operationalCard = rightColumn.locator("section").filter({
    has: page.getByRole("heading", { name: "Operational records", exact: true }),
  });
  await operationalCard.waitFor({ state: "visible", timeout: 10000 });

  const countBadge = operationalCard.locator("span.rounded-full.bg-slate-200");
  await countBadge.waitFor({ state: "visible", timeout: 10000 });
  console.log("PASS operational records card badge visible");

  const collapsedText = operationalCard.getByText("Collapsed to reduce page height.", { exact: false });
  const isCollapsedByDefault = await collapsedText.isVisible();
  assertCondition(isCollapsedByDefault, "Operational records should be collapsed by default");
  console.log("PASS collapsed by default");

  await page.screenshot({
    path: "/opt/cursor/artifacts/operational_records_collapsed.png",
    fullPage: false,
  });

  const expandButton = operationalCard.getByRole("button", { name: "Expand" });
  await expandButton.click();
  await page.waitForTimeout(500);

  const internalScrollArea = operationalCard.locator("div.max-h-\\[360px\\].overflow-y-auto");
  await internalScrollArea.waitFor({ state: "visible", timeout: 10000 });
  const scrollMetrics = await internalScrollArea.evaluate((node) => {
    const previousScrollTop = node.scrollTop;
    node.scrollTop = 24;
    const scrolled = node.scrollTop > previousScrollTop;
    node.scrollTop = previousScrollTop;
    return {
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowY: window.getComputedStyle(node).overflowY,
      scrolled,
    };
  });
  assertCondition(
    scrollMetrics.overflowY === "auto",
    `Expected internal scroll area overflowY auto, got ${scrollMetrics.overflowY}`,
  );
  assertCondition(
    scrollMetrics.scrollHeight >= scrollMetrics.clientHeight,
    "Expected scrollable or bounded internal area",
  );
  assertCondition(scrollMetrics.scrolled, "Expected internal scroll container to accept scroll input");
  console.log("PASS expanded with bounded internal scroll container");

  await internalScrollArea.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.waitForTimeout(400);
  console.log("PASS internal area scrolled");

  await page.screenshot({
    path: "/opt/cursor/artifacts/operational_records_expanded_scroll.png",
    fullPage: false,
  });

  const collapseButton = operationalCard.getByRole("button", { name: "Collapse" });
  await collapseButton.click();
  await page.waitForTimeout(400);
  await collapsedText.waitFor({ state: "visible", timeout: 10000 });
  console.log("PASS collapse toggles back");

  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const recordedPath = await video.path();
    await cp(recordedPath, "/opt/cursor/artifacts/operational_records_layout_demo.webm");
    console.log("PASS saved video /opt/cursor/artifacts/operational_records_layout_demo.webm");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
