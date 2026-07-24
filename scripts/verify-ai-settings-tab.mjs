import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace.html`;
const viewports = [
  { w: 1280, h: 800, n: "1280" },
  { w: 768, h: 1024, n: "768" },
  { w: 390, h: 844, n: "390" },
];
const settingKeys = [
  "responseLength",
  "detailLevel",
  "reasoningLevel",
  "webSearch",
  "fileAnalysis",
  "imageAnalysis",
  "autoRouting",
  "conversationMemory",
  "trainingOptIn",
  "contentFilter",
  "customInstructions",
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

    await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("ai"));

    const panel = page.locator("[data-ai-settings-panel='ai']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (!text.includes("AI動作モード")) errors.push(`${vp.n}: missing AI動作モード`);
    if (!text.includes("応答設定")) errors.push(`${vp.n}: missing 応答設定`);
    if (!text.includes("AIへの追加指示")) errors.push(`${vp.n}: missing 追加指示`);
    if (!text.includes("バランス（推奨）")) errors.push(`${vp.n}: missing mode cards`);
    if (!text.includes("0 / 500")) errors.push(`${vp.n}: missing char count`);

    for (const key of settingKeys) {
      const count = await panel.locator(`[data-setting-key="${key}"]`).count();
      if (!count) errors.push(`${vp.n}: missing data-setting-key=${key}`);
    }

    const modeCount = await panel.locator("[data-ai-mode-card]").count();
    if (modeCount !== 4) errors.push(`${vp.n}: expected 4 mode cards, got ${modeCount}`);

    const rowCount = await panel.locator(".ai-ref-ai-settings-row").count();
    if (rowCount !== 10) errors.push(`${vp.n}: expected 10 response rows, got ${rowCount}`);

    const dialog = page.locator("[data-ai-workspace-settings-dialog]");
    const box = await dialog.boundingBox();
    if (!box || box.width > vp.w + 2) errors.push(`${vp.n}: dialog overflow`);

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > vp.w + 2) errors.push(`${vp.n}: horizontal scroll ${scrollW}px`);

    await page.evaluate(() => window.TasuAiWorkspaceSettings?.activatePanel?.("general"));
    const general = await page.locator("[data-ai-settings-panel='general']").innerText();
    if (!general.includes("外観")) errors.push(`${vp.n}: general tab broken after switch`);

    await page.evaluate(() => window.TasuAiWorkspaceSettings?.activatePanel?.("model"));
    const model = await page.locator("[data-ai-settings-panel='model']").innerText();
    if (!model.includes("モード")) errors.push(`${vp.n}: model tab broken after switch`);

    if (severe.length) errors.push(`${vp.n}: console errors: ${severe.join(" | ")}`);
    await page.close();
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS AI settings tab at 1280/768/390");
