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
  await Promise.all([page.waitForURL("**/dashboard", { timeout: 30000 }), page.click("button[type='submit']")]);

  const financeButton = page.getByRole("button", { name: /Finance/i }).first();
  await financeButton.waitFor({ state: "visible", timeout: 15000 });

  const submenuContainer = page.locator("#finance-submenu");
  await submenuContainer.waitFor({ state: "attached", timeout: 10000 });

  const collapsedAria = await financeButton.getAttribute("aria-expanded");
  if (collapsedAria !== "false") {
    throw new Error(`Expected finance collapsed aria-expanded=false, got ${collapsedAria}`);
  }

  await financeButton.click();
  await page.waitForTimeout(250);
  await page.locator("a[href='/finance/invoices']").waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({
    path: "/opt/cursor/artifacts/sidebar_finance_expanded_state.png",
    fullPage: true,
  });

  await financeButton.click();
  await page.waitForTimeout(250);
  const collapsedAfterToggleAria = await financeButton.getAttribute("aria-expanded");
  if (collapsedAfterToggleAria !== "false") {
    throw new Error(
      `Expected finance collapsed aria-expanded=false after second click, got ${collapsedAfterToggleAria}`,
    );
  }

  await page.goto("http://localhost:3000/finance/forecast", { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  const expandedOnFinanceRoute = await financeButton.getAttribute("aria-expanded");
  if (expandedOnFinanceRoute !== "true") {
    throw new Error("Expected finance submenu expanded on /finance/* route");
  }
  await page.locator("a[href='/finance/forecast']").first().waitFor({ state: "visible", timeout: 10000 });

  await page.goto("http://localhost:3000/shipments/shp_air_import_0001", { waitUntil: "networkidle" });
  const shipperInput = page.locator("input[name='shipperName']");
  await shipperInput.waitFor({ state: "visible", timeout: 15000 });
  const shipperInputColor = await shipperInput.evaluate((el) => getComputedStyle(el).color);

  const sidebarNav = page.locator("aside nav").first();
  const overflowY = await sidebarNav.evaluate((el) => getComputedStyle(el).overflowY);
  if (overflowY !== "auto") {
    throw new Error(`Expected sidebar nav overflow-y auto, got ${overflowY}`);
  }

  await page.screenshot({
    path: "/opt/cursor/artifacts/input_readability_shipment_form.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        financeCollapsedByDefault: true,
        financeExpandCollapseWorks: true,
        financeAutoExpandsOnFinanceRoute: true,
        sidebarOverflowY: overflowY,
        shipperInputColor,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
