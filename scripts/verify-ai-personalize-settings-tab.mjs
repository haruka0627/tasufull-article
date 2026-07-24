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
      localStorage.removeItem("tasu_ai_personalization_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("personalize");
    });

    const panel = page.locator("[data-ai-settings-panel='personalize']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("応答スタイル")) errors.push(`${vp.n}: missing response style section`);
    if (!text.includes("あなたについて")) errors.push(`${vp.n}: missing about section`);
    if (!text.includes("メモリ")) errors.push(`${vp.n}: missing memory section`);
    if (!text.includes("AIへの追加指示")) errors.push(`${vp.n}: missing instruction section`);
    if (!text.includes("用途プリセット")) errors.push(`${vp.n}: missing preset section`);
    if (!text.includes("保存する")) errors.push(`${vp.n}: missing save button`);
    if (!text.includes("野球")) errors.push(`${vp.n}: missing default interest tag`);

    const occupation = await page.inputValue("#ai-personalize-occupation");
    if (occupation !== "エンジニア") errors.push(`${vp.n}: missing default occupation value`);

    const styleCards = await panel.locator(".ai-ref-personalize-style-card").count();
    if (styleCards !== 4) errors.push(`${vp.n}: expected 4 style cards, got ${styleCards}`);

    const presetCards = await panel.locator(".ai-ref-personalize-preset-card").count();
    if (presetCards !== 5) errors.push(`${vp.n}: expected 5 preset cards, got ${presetCards}`);

    const sliders = await panel.locator("[data-personalize-setting-slider]").count();
    if (sliders !== 4) errors.push(`${vp.n}: expected 4 sliders, got ${sliders}`);

    await page.click("[data-personalize-preset='programming']");
    await page.fill("#ai-personalize-nickname", "Tasu");
    await page.fill("#ai-personalize-custom-instruction", "結論から回答してください。");

    await page.click("[data-personalize-action='save']");

    const state = await page.evaluate(() => window.TasuAiWorkspacePersonalizationSettings.getSnapshot());
    if (state.preset !== "programming") errors.push(`${vp.n}: preset not saved`);
    if (state.style !== "professional") errors.push(`${vp.n}: preset style not applied`);
    if (state.nickname !== "Tasu") errors.push(`${vp.n}: nickname not saved`);
    if (!state.customInstruction.includes("結論")) errors.push(`${vp.n}: customInstruction not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("personalize");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspacePersonalizationSettings.getSnapshot());
    if (persisted.nickname !== "Tasu") errors.push(`${vp.n}: nickname not persisted`);
    if (persisted.preset !== "programming") errors.push(`${vp.n}: preset not persisted`);

    const apiPayload = await page.evaluate(() =>
      window.TasuAiWorkspacePersonalizationSettings.formatForApiRequest()
    );
    if (!apiPayload?.profile || apiPayload.profile.nickname !== "Tasu") {
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
console.log("PASS personalize settings tab at 1280/768/390");
