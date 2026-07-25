import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace`;
const errors = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of [
    { w: 1280, h: 800, n: "1280" },
    { w: 390, h: 844, n: "390" },
  ]) {
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

    const apis = await page.evaluate(() => ({
      gauge: Boolean(window.TasuAiUsageGauge?.buildUsageGauge),
      usage: Boolean(window.TasuAiWorkspaceUsage?.getGaugeSnapshot),
    }));
    if (!apis.gauge) errors.push(`${vp.n}: TasuAiUsageGauge missing`);
    if (!apis.usage) errors.push(`${vp.n}: getGaugeSnapshot missing`);

    await page.evaluate(() => {
      const welcome = document.getElementById("welcome-screen");
      if (welcome) welcome.hidden = true;
      window.__TASU_WORKSPACE_USAGE_PHASE2__ = false;
      const g = window.TasuAiUsageGauge.buildUsageGauge({ used: 2, limit: 5, dateJst: "2026/07/26" });
      window.TasuAiWorkspaceUsage.applyServerStatusToCache({
        ok: true,
        dailyLimit: 5,
        used: 2,
        remaining: 3,
        allowed: true,
        dateJst: "2026/07/26",
        planCode: "free",
        planLabel: "無料枠",
        usage: g,
        authMode: "claimed",
      });
      window.TasuAiWorkspaceUsage.updateUsageUi();
    });

    const compact = page.locator("[data-ai-usage-gauge-compact]");
    await compact.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      errors.push(`${vp.n}: compact gauge not visible`);
    });
    const compactText = await page.locator("[data-ai-workspace-usage-status]").innerText();
    if (!/40%|本日/.test(compactText)) errors.push(`${vp.n}: compact text unexpected: ${compactText}`);

    const meter = await page.locator(".ai-workspace-usage__meter").getAttribute("aria-valuenow");
    if (meter !== "40") errors.push(`${vp.n}: meter aria-valuenow=${meter}`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceModelRouterSettings?.setAutoRoutingEnabled?.(false);
      window.TasuAiPlanModels?.setSelectedModelId?.("claude");
      window.TasuAiWorkspaceUsage.updateUsageUi();
    });
    const hintVisible = await page.locator("[data-ai-usage-heavy-hint]").isVisible();
    if (!hintVisible) errors.push(`${vp.n}: manual heavy hint not shown`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceModelRouterSettings?.setAutoRoutingEnabled?.(true);
      window.TasuAiWorkspaceUsage.updateUsageUi();
      window.TasuAiWorkspaceSettings?.openSettings?.("billing");
    });

    const panel = page.locator("[data-ai-settings-panel='billing']");
    await panel.waitFor({ state: "visible", timeout: 10000 });
    const billingText = await panel.innerText();
    if (!billingText.includes("本日の利用状況")) errors.push(`${vp.n}: billing missing daily usage`);
    if (!billingText.includes("次回更新")) errors.push(`${vp.n}: billing missing reset`);
    if (billingText.includes("unit_price") || billingText.includes("estimated_cost")) {
      errors.push(`${vp.n}: cost leaked into billing UI`);
    }

    const retry = panel.locator("[data-ai-usage-gauge-retry]");
    if ((await retry.count()) < 1) errors.push(`${vp.n}: retry missing`);
    else {
      await retry.focus();
      const tag = await page.evaluate(() => document.activeElement?.getAttribute("data-ai-usage-gauge-retry"));
      if (tag == null) errors.push(`${vp.n}: retry not keyboard focusable`);
    }

    if (severe.length) errors.push(`${vp.n}: console ${severe.join(" | ")}`);
    await page.close();
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS usage gauge Playwright");
