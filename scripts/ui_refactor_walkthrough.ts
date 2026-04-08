import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill("#email", "admin@atlascargo.local");
  await page.fill("#password", "Admin123!");
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20000 }),
    page.click("button[type=submit]"),
  ]);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/opt/cursor/artifacts/ui_dashboard_refactor.png", fullPage: true });

  await page.goto("http://localhost:3000/shipments", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/opt/cursor/artifacts/ui_shipments_refactor.png", fullPage: true });

  const firstShipmentLink = page.locator("a", { hasText: "Edit" }).first();
  if ((await firstShipmentLink.count()) > 0) {
    await firstShipmentLink.click();
    await page.waitForURL("**/shipments/**", { timeout: 20000 });
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: "/opt/cursor/artifacts/ui_shipment_detail_refactor.png",
      fullPage: true,
    });
  }

  await page.goto("http://localhost:3000/customers", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/opt/cursor/artifacts/ui_customers_refactor.png", fullPage: true });

  await page.goto("http://localhost:3000/quotes", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/opt/cursor/artifacts/ui_quotes_refactor.png", fullPage: true });

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
