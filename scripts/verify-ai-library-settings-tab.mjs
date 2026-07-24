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
      localStorage.removeItem("tasu_ai_library_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("library");
    });

    const panel = page.locator("[data-ai-settings-panel='library']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("保存先の管理")) errors.push(`${vp.n}: missing save section`);
    if (!text.includes("ライブラリーの表示設定")) errors.push(`${vp.n}: missing display section`);
    if (!text.includes("ライブラリーの整理")) errors.push(`${vp.n}: missing organize section`);
    if (!text.includes("ゴミ箱を空にする")) errors.push(`${vp.n}: missing danger zone`);
    if (!text.includes("ストレージ使用状況")) errors.push(`${vp.n}: missing storage card`);
    if (!text.includes("ファイルの種類")) errors.push(`${vp.n}: missing file types card`);
    if (!text.includes("42%")) errors.push(`${vp.n}: missing donut percent`);
    if (!text.includes("2.1 GB")) errors.push(`${vp.n}: missing image size stat`);

    const groups = await panel.locator(".ai-ref-library-group").count();
    if (groups !== 3) errors.push(`${vp.n}: expected 3 groups, got ${groups}`);

    const sideCards = await panel.locator(".ai-ref-library-side-card").count();
    if (sideCards !== 2) errors.push(`${vp.n}: expected 2 side cards, got ${sideCards}`);

    await page.click("[data-library-view-mode='list']");
    await page.selectOption("#ai-library-settings-sort-order", "name");
    await page.evaluate(() => {
      window.TasuAiWorkspaceLibrarySettings.setSetting("autoSave", false);
      window.TasuAiWorkspaceLibrarySettings.setSetting("itemsPerPage", 48);
    });

    await page.evaluate(() => window.TasuAiWorkspaceSettings.syncLibrarySettingsUi());

    const state = await page.evaluate(() => window.TasuAiWorkspaceLibrarySettings.getSnapshot());
    if (state.viewMode !== "list") errors.push(`${vp.n}: viewMode not saved`);
    if (state.sortOrder !== "name") errors.push(`${vp.n}: sortOrder not saved`);
    if (state.autoSave !== false) errors.push(`${vp.n}: autoSave not saved`);
    if (state.itemsPerPage !== 48) errors.push(`${vp.n}: itemsPerPage not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("library");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceLibrarySettings.getSnapshot());
    if (persisted.viewMode !== "list") errors.push(`${vp.n}: viewMode not persisted`);
    if (persisted.itemsPerPage !== 48) errors.push(`${vp.n}: itemsPerPage not persisted`);

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceLibrarySettings.formatForApiRequest());
    if (!apiPayload?.storage || apiPayload.storage.percent !== 42) {
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
console.log("PASS library settings tab at 1280/768/390");
