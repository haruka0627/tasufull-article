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
      localStorage.removeItem("tasu_ai_data_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("data");
    });

    const panel = page.locator("[data-ai-settings-panel='data']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("ストレージ使用状況")) errors.push(`${vp.n}: missing storage section`);
    if (!text.includes("データエクスポート")) errors.push(`${vp.n}: missing export section`);
    if (!text.includes("データインポート")) errors.push(`${vp.n}: missing import section`);
    if (!text.includes("データ削除")) errors.push(`${vp.n}: missing delete section`);
    if (!text.includes("データ保持設定")) errors.push(`${vp.n}: missing retention section`);
    if (!text.includes("容量を増やす")) errors.push(`${vp.n}: missing increase storage button`);
    if (!text.includes("プレミアムプラン")) errors.push(`${vp.n}: missing premium card`);
    if (!text.includes("エクスポートする")) errors.push(`${vp.n}: missing export button`);
    if (!text.includes("インポートする")) errors.push(`${vp.n}: missing import button`);
    if (!text.includes("すべて削除する")) errors.push(`${vp.n}: missing delete all button`);

    const sections = await panel.locator(".ai-ref-data-section").count();
    if (sections !== 5) errors.push(`${vp.n}: expected 5 sections, got ${sections}`);

    const exportCards = await panel.locator(".ai-ref-data-export-card").count();
    if (exportCards !== 4) errors.push(`${vp.n}: expected 4 export cards, got ${exportCards}`);

    const donut = await panel.locator(".ai-ref-data-donut").count();
    if (donut !== 1) errors.push(`${vp.n}: expected donut chart`);

    await page.click("[data-data-export-type='chat']");
    await page.selectOption("#ai-data-settings-export-format", "zip");
    await page.selectOption("#ai-data-settings-auto-delete", "90d");
    await page.evaluate(() => {
      window.TasuAiWorkspaceDataSettings.setSetting("inactiveDelete", true);
    });

    await page.evaluate(() => window.TasuAiWorkspaceSettings.syncDataSettingsUi());

    const state = await page.evaluate(() => window.TasuAiWorkspaceDataSettings.getSnapshot());
    if (state.exportType !== "chat") errors.push(`${vp.n}: exportType not saved`);
    if (state.exportFormat !== "zip") errors.push(`${vp.n}: exportFormat not saved`);
    if (state.autoDeletePeriod !== "90d") errors.push(`${vp.n}: autoDeletePeriod not saved`);
    if (state.inactiveDelete !== true) errors.push(`${vp.n}: inactiveDelete not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("data");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceDataSettings.getSnapshot());
    if (persisted.exportType !== "chat") errors.push(`${vp.n}: exportType not persisted`);
    if (persisted.autoDeletePeriod !== "90d") errors.push(`${vp.n}: autoDeletePeriod not persisted`);

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceDataSettings.formatForApiRequest());
    if (!apiPayload?.storage || apiPayload.storage.usageGb !== 2.4) {
      errors.push(`${vp.n}: formatForApiRequest invalid`);
    }

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
console.log("PASS data settings tab at 1280/768/390");
