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
      localStorage.removeItem("tasu_ai_voice_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("voice");
    });

    const panel = page.locator("[data-ai-settings-panel='voice']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("音声会話・読み上げ・音声モデルの設定")) errors.push(`${vp.n}: missing lead`);
    if (!text.includes("Maple")) errors.push(`${vp.n}: missing default voice`);
    if (!text.includes("試聴")) errors.push(`${vp.n}: missing preview button`);
    if (!text.includes("基本設定")) errors.push(`${vp.n}: missing basic settings`);
    if (!text.includes("音声機能")) errors.push(`${vp.n}: missing feature toggles`);
    if (!text.includes("高度な設定")) errors.push(`${vp.n}: missing advanced section`);

    const hero = await panel.locator(".ai-ref-voice-hero").count();
    if (hero !== 1) errors.push(`${vp.n}: expected voice hero`);

    await page.click("[data-voice-next]");
    const afterNext = await page.evaluate(() => window.TasuAiWorkspaceVoiceSettings.getSnapshot());
    if (afterNext.selectedVoice === "maple") errors.push(`${vp.n}: carousel next failed`);

    await page.selectOption("#ai-voice-settings-model", "gemini-live");
    await page.evaluate(() => {
      window.TasuAiWorkspaceVoiceSettings.setSetting("textToSpeech", false);
      window.TasuAiWorkspaceVoiceSettings.setSetting("speakingSpeed", 80);
    });

    await page.evaluate(() => window.TasuAiWorkspaceSettings.syncVoiceSettingsUi());

    const state = await page.evaluate(() => window.TasuAiWorkspaceVoiceSettings.getSnapshot());
    if (state.voiceModel !== "gemini-live") errors.push(`${vp.n}: voiceModel not saved`);
    if (state.textToSpeech !== false) errors.push(`${vp.n}: textToSpeech not saved`);
    if (state.speakingSpeed !== 80) errors.push(`${vp.n}: speakingSpeed not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("voice");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceVoiceSettings.getSnapshot());
    if (persisted.voiceModel !== "gemini-live") errors.push(`${vp.n}: voiceModel not persisted`);
    if (persisted.speakingSpeed !== 80) errors.push(`${vp.n}: speakingSpeed not persisted`);

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceVoiceSettings.formatForApiRequest());
    if (!apiPayload?.features || typeof apiPayload.features.textToSpeech !== "boolean") {
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
console.log("PASS voice settings tab at 1280/768/390");
