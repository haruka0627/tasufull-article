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
      localStorage.removeItem("tasu_ai_image_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("image");
    });

    const panel = page.locator("[data-ai-settings-panel='image']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("画像生成・解析の設定")) errors.push(`${vp.n}: missing lead`);
    if (!text.includes("画像モデル")) errors.push(`${vp.n}: missing model section`);
    if (!text.includes("画質")) errors.push(`${vp.n}: missing quality section`);
    if (!text.includes("アスペクト比")) errors.push(`${vp.n}: missing aspect ratio section`);
    if (!text.includes("スタイル")) errors.push(`${vp.n}: missing style section`);
    if (!text.includes("ネガティブプロンプト")) errors.push(`${vp.n}: missing negative prompt`);
    if (!text.includes("セーフサーチ")) errors.push(`${vp.n}: missing nsfw filter`);
    if (!text.includes("デフォルトの画像生成枚数")) errors.push(`${vp.n}: missing default count`);
    if (!text.includes("画像保存先")) errors.push(`${vp.n}: missing save destination`);

    const aspectCards = await panel.locator(".ai-ref-image-aspect-card").count();
    if (aspectCards !== 6) errors.push(`${vp.n}: expected 6 aspect cards, got ${aspectCards}`);

    const styleCards = await panel.locator(".ai-ref-image-style-card").count();
    if (styleCards !== 8) errors.push(`${vp.n}: expected 8 style cards, got ${styleCards}`);

    await page.click("[data-image-aspect-ratio='16:9']");
    await page.click("[data-image-style='anime']");
    await page.selectOption("#ai-image-settings-model", "gpt-image");
    await page.evaluate(() => {
      window.TasuAiWorkspaceImageSettings.setSetting("quality", "high");
      window.TasuAiWorkspaceImageSettings.setSetting("textRendering", false);
      window.TasuAiWorkspaceImageSettings.setSetting("defaultCount", 2);
    });

    await page.evaluate(() => window.TasuAiWorkspaceSettings.syncImageSettingsUi());

    const state = await page.evaluate(() => window.TasuAiWorkspaceImageSettings.getSnapshot());
    if (state.aspectRatio !== "16:9") errors.push(`${vp.n}: aspectRatio not saved`);
    if (state.style !== "anime") errors.push(`${vp.n}: style not saved`);
    if (state.model !== "gpt-image") errors.push(`${vp.n}: model not saved`);
    if (state.quality !== "high") errors.push(`${vp.n}: quality not saved`);
    if (state.textRendering !== false) errors.push(`${vp.n}: textRendering not saved`);
    if (state.defaultCount !== 2) errors.push(`${vp.n}: defaultCount not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("image");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceImageSettings.getSnapshot());
    if (persisted.aspectRatio !== "16:9") errors.push(`${vp.n}: aspectRatio not persisted`);
    if (persisted.defaultCount !== 2) errors.push(`${vp.n}: defaultCount not persisted`);

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceImageSettings.formatForApiRequest());
    if (apiPayload.aspectWidth !== 16 || apiPayload.aspectHeight !== 9) {
      errors.push(`${vp.n}: formatForApiRequest aspect invalid`);
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
console.log("PASS image settings tab at 1280/768/390");
