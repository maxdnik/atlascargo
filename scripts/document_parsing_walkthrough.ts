import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill("#email", "admin@atlascargo.local");
  await page.fill("#password", "Admin123!");
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30000 }),
    page.click("button[type='submit']"),
  ]);

  await page.goto("http://localhost:3000/shipments", { waitUntil: "networkidle" });
  const shipmentLink = page.locator("a", { hasText: "Edit" }).first();
  await shipmentLink.waitFor({ state: "visible", timeout: 30000 });
  await shipmentLink.click();
  await page.waitForURL("**/shipments/**", { timeout: 30000 });

  const documentsTab = page.locator("button").filter({ hasText: "Documents" }).first();
  await documentsTab.waitFor({ state: "visible", timeout: 30000 });
  await documentsTab.click();
  await page.waitForTimeout(1200);

  const parseButtons = page.getByRole("button", { name: "Parse document", exact: true });
  await parseButtons.first().waitFor({ state: "visible", timeout: 20000 });
  await parseButtons.first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  if ((await page.getByText("Internal Server Error").count()) > 0) {
    throw new Error("Internal Server Error after parse");
  }

  const applyButtons = page.getByRole("button", { name: "Apply to shipment", exact: true });
  await applyButtons.first().waitFor({ state: "visible", timeout: 20000 });
  await applyButtons.first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  if ((await page.getByText("Internal Server Error").count()) > 0) {
    throw new Error("Internal Server Error after apply");
  }

  const errorBanner = page.locator("text=/Unable to parse document|Unable to apply parsed data/i");
  if ((await errorBanner.count()) > 0) {
    throw new Error("Detected parse/apply error banner in UI");
  }

  await page.screenshot({
    path: "/opt/cursor/artifacts/document_parsing_panel_after_apply.png",
    fullPage: true,
  });

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
