import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace.html`;
const viewports = [
  { w: 1280, h: 800, n: "1280" },
  { w: 768, h: 1024, n: "768" },
  { w: 390, h: 844, n: "390" },
];
const errors = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const severe = [];
    page.on("console", (m) => {
      if (m.type() === "error") severe.push(m.text());
    });
    page.on("pageerror", (e) => severe.push(String(e)));

    const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!res || res.status() !== 200) {
      errors.push(`${vp.n}: HTTP ${res?.status() ?? "fail"}`);
      await page.close();
      continue;
    }

    await page.evaluate(() => {
      localStorage.removeItem("tasu_ai_billing_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("billing");
    });

    const panel = page.locator("[data-ai-settings-panel='billing']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("現在のプラン")) errors.push(`${vp.n}: missing current plan`);
    if (!text.includes("TASFUL AI Pro")) errors.push(`${vp.n}: missing plan name`);
    if (!text.includes("年間プラン")) errors.push(`${vp.n}: missing billing cycle`);
    if (!text.includes("本日の利用状況")) errors.push(`${vp.n}: missing usage section`);
    if (!text.includes("AIチャット")) errors.push(`${vp.n}: missing ai chat usage`);
    if (!text.includes("高性能モデル")) errors.push(`${vp.n}: missing heavy model note`);
    if (!text.includes("プラン比較")) errors.push(`${vp.n}: missing plan compare`);
    if (!text.includes("Lite")) errors.push(`${vp.n}: missing Lite plan`);
    if (!text.includes("Max")) errors.push(`${vp.n}: missing Max plan`);
    if (!text.includes("支払い方法")) errors.push(`${vp.n}: missing payment section`);
    if (!text.includes("請求履歴")) errors.push(`${vp.n}: missing history section`);
    if (!text.includes("領収書")) errors.push(`${vp.n}: missing receipt links`);
    if (!text.includes("プランのキャンセル")) errors.push(`${vp.n}: missing cancel section`);

    const currentCards = await panel.locator(".ai-ref-billing-current").count();
    if (currentCards !== 1) errors.push(`${vp.n}: expected 1 current plan card, got ${currentCards}`);

    const grids = await panel.locator(".ai-ref-billing-grid").count();
    if (grids !== 2) errors.push(`${vp.n}: expected 2 billing grids, got ${grids}`);

    const planCards = await panel.locator(".ai-ref-billing-plan-card").count();
    if (planCards !== 3) errors.push(`${vp.n}: expected 3 plan cards, got ${planCards}`);

    const usageBars = await panel.locator(".ai-ref-billing-usage-item__track").count();
    if (usageBars > 1) errors.push(`${vp.n}: expected at most 1 live usage bar, got ${usageBars}`);
    const detail = await panel.locator("[data-ai-usage-gauge-detail]").count();
    if (detail < 1) errors.push(`${vp.n}: missing usage gauge detail`);

    const historyRows = await panel.locator(".ai-ref-billing-history-row").count();
    if (historyRows !== 3) errors.push(`${vp.n}: expected 3 history rows, got ${historyRows}`);

    await page.click("[data-billing-action='cancel-plan']");
    const confirmVisible = await page.locator("[data-billing-confirm-dialog]").isVisible();
    if (!confirmVisible) errors.push(`${vp.n}: cancel confirm dialog not shown`);
    await page.click("[data-billing-confirm-cancel]");

    await page.evaluate(() => {
      window.TasuAiWorkspaceBillingSettings.setSetting("billingCycle", "monthly");
    });

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("billing");
    });

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceBillingSettings.formatForApiRequest());
    if (!apiPayload?.subscription?.currentPlan) errors.push(`${vp.n}: formatForApiRequest invalid`);
    if (apiPayload.subscription.currentPlan !== "pro") errors.push(`${vp.n}: currentPlan mismatch`);

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceBillingSettings.getSnapshot());
    if (persisted.currentPlanLabel !== "TASFUL AI Pro") errors.push(`${vp.n}: state not persisted`);
    if (persisted.billingCycle !== "monthly") errors.push(`${vp.n}: billingCycle not persisted`);

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > vp.w + 2) errors.push(`${vp.n}: horizontal scroll ${scrollW}px`);

    if (severe.length) errors.push(`${vp.n}: console: ${severe.join(" | ")}`);
    await page.close();
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS billing settings tab at 1280/768/390");
