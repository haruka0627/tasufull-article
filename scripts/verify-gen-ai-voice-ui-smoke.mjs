/**
 * 生成AI 音声会話 UI スモーク（静的 + Playwright）
 *
 * 手動確認: docs/gen-ai-voice-manual-checklist.md
 *
 *   node scripts/verify-gen-ai-voice-ui-smoke.mjs
 *   GEN_AI_UI_SMOKE_SKIP_BROWSER=1 node scripts/verify-gen-ai-voice-ui-smoke.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");

const baseUrl =
  process.env.GEN_AI_TEST_URL ||
  "http://127.0.0.1:5173/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1";

const SKIP_BROWSER = process.env.GEN_AI_UI_SMOKE_SKIP_BROWSER === "1";

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function countAttr(attr) {
  const re = new RegExp(attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  return (html.match(re) || []).length;
}

console.log("=== Static UI smoke ===\n");

record("Mic button (form)", html.includes("data-gen-ai-mic-form"));
record("Mic button (panel)", html.includes("data-gen-ai-mic-panel"));
record("Mic buttons count >= 2", countAttr("data-gen-ai-mic") >= 2, `count=${countAttr("data-gen-ai-mic")}`);
record("Voice status (panel)", html.includes("data-gen-ai-voice-status"));
record("Voice status (form)", html.includes("data-gen-ai-voice-status-form"));
record("Auto send voice toggle", html.includes("data-gen-ai-auto-send-voice"));
record("Voice unsupported note", html.includes("data-gen-ai-voice-unsupported"));
record("Voice read-aloud toggle", html.includes("data-ai-voice-toggle"));
record("Voice debug hook (HTML)", html.includes("data-gen-ai-voice-debug"));
record("Character stage", html.includes("data-ai-character-stage"));
record("Stage renderer 2D/live/3D", countAttr("data-gen-ai-stage-renderer") >= 3);
record("Character mouth element", html.includes("data-character-mouth"));
record("JS setMouthSpeaking", js.includes("function setMouthSpeaking"));
record("JS body data-ai-speaking", /data-ai-speaking/.test(js));
record("JS voice debug helper", js.includes("updateVoiceDebugPanel"));
record("CSS voice status styles", css.includes(".chat-area__voice-status"));
record("3D canvas hook (HTML)", html.includes("data-gen-ai-char-3d-canvas"));
record("3D module script", html.includes("gen-ai-character-3d.js"));
record("VRM module script", html.includes("gen-ai-character-vrm.js"));
record("Ai concierge script", html.includes("ai-concierge.js"));

if (SKIP_BROWSER) {
  console.log("\n=== Browser UI smoke (skipped: GEN_AI_UI_SMOKE_SKIP_BROWSER=1) ===\n");
} else {
  console.log("\n=== Browser UI smoke ===\n");
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-gen-ai-root]", { timeout: 15000 });

    const ui = await page.evaluate(() => {
      const mics = document.querySelectorAll("[data-gen-ai-mic]");
      const panel = document.querySelector("[data-gen-ai-character-panel]");
      const stage = document.querySelector("[data-ai-character-stage]");
      const img = document.querySelector("[data-ai-character-img]");
      const voiceToggle = document.querySelector("[data-ai-voice-toggle]");
      const autoSend = document.querySelector("[data-gen-ai-auto-send-voice]");
      const unsupported = document.querySelector("[data-gen-ai-voice-unsupported]");
      const debugEl = document.querySelector("[data-gen-ai-voice-debug]");
      const renderers = document.querySelectorAll("[data-gen-ai-stage-renderer]");
      const canvas3d = document.querySelector("[data-gen-ai-char-3d-canvas]");
      const mouth = document.querySelector("[data-character-mouth]");
      return {
        micCount: mics.length,
        panelHidden: panel?.hidden ?? true,
        stagePresent: Boolean(stage),
        imgPresent: Boolean(img),
        imgComplete: img?.complete && (img.naturalWidth > 0 || img.naturalHeight > 0),
        voiceToggle: Boolean(voiceToggle),
        autoSend: Boolean(autoSend),
        unsupported: Boolean(unsupported),
        debugHiddenDefault: debugEl?.hidden !== false,
        rendererCount: renderers.length,
        canvas3dPresent: Boolean(canvas3d),
        mouthPresent: Boolean(mouth),
        hasWorkspace: typeof window.TasuGenAiWorkspace?.setMouthSpeaking === "function",
        hasConcierge: typeof window.TasuAiConcierge?.isSpeechSupported === "function",
      };
    });

    record("Browser mic count === 2", ui.micCount === 2, `count=${ui.micCount}`);
    record("Browser character panel visible", !ui.panelHidden);
    record("Browser stage present", ui.stagePresent);
    record("Browser 2D image loaded", ui.imgPresent && ui.imgComplete);
    record("Browser voice toggle", ui.voiceToggle);
    record("Browser auto-send toggle", ui.autoSend);
    record("Browser unsupported node", ui.unsupported);
    record("Browser voice debug hidden by default", ui.debugHiddenDefault);
    record("Browser stage renderers >= 3", ui.rendererCount >= 3, `count=${ui.rendererCount}`);
    record("Browser 3D canvas in DOM", ui.canvas3dPresent);
    record("Browser mouth element", ui.mouthPresent);
    record("Browser TasuGenAiWorkspace API", ui.hasWorkspace);
    record("Browser TasuAiConcierge API", ui.hasConcierge);

    await page.evaluate(() => {
      window.TasuGenAiWorkspace?.setMouthSpeaking?.(true);
    });
    const speakingOn = await page.evaluate(() => ({
      body: document.body?.getAttribute("data-ai-speaking") === "true",
      mouth: document.querySelector("[data-character-mouth]")?.classList.contains("is-speaking"),
      stage: document.querySelector("[data-ai-character-stage]")?.classList.contains("is-speaking"),
    }));
    record(
      "Browser data-ai-speaking toggles ON",
      speakingOn.body && (speakingOn.mouth || speakingOn.stage)
    );

    await page.evaluate(() => {
      window.TasuGenAiWorkspace?.setMouthSpeaking?.(false);
    });
    const speakingOff = await page.evaluate(() => ({
      body: document.body?.hasAttribute("data-ai-speaking"),
      mouth: document.querySelector("[data-character-mouth]")?.classList.contains("is-speaking"),
      stage: document.querySelector("[data-ai-character-stage]")?.classList.contains("is-speaking"),
    }));
    record(
      "Browser data-ai-speaking toggles OFF",
      !speakingOff.body && !speakingOff.mouth && !speakingOff.stage
    );

    const debugUrl =
      baseUrl + (baseUrl.includes("?") ? "&" : "?") + "voice_debug=1";
    await page.goto(debugUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("[data-gen-ai-voice-debug]", { timeout: 10000 });
    const debugVisible = await page.evaluate(() => {
      const el = document.querySelector("[data-gen-ai-voice-debug]");
      return Boolean(el && !el.hidden && String(el.textContent || "").includes("voice-status="));
    });
    record("Browser voice_debug panel shows status", debugVisible);

    await page.locator('[data-gen-ai-stage-renderer="3d"]').click();
    await page.waitForFunction(
      () => document.querySelector("[data-ai-character-stage]")?.classList.contains("ai-character-stage--3d"),
      { timeout: 8000 }
    );
    const after3d = await page.evaluate(() => {
      const stage = document.querySelector("[data-ai-character-stage]");
      const canvas3d = document.querySelector("[data-gen-ai-char-3d-canvas]");
      const img2d = document.querySelector("[data-ai-character-img]");
      return {
        mode3d: stage?.classList.contains("ai-character-stage--3d"),
        canvas3d: Boolean(canvas3d),
        pageOk: Boolean(stage),
        img2dOk: Boolean(img2d),
      };
    });
    record(
      "Browser 3D tab does not break stage",
      after3d.pageOk && after3d.canvas3d && after3d.mode3d,
      `mode3d=${after3d.mode3d}`
    );
  } catch (err) {
    record("Browser UI smoke execution", false, err.message);
  }  });
  
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- Summary ---`);
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
if (!failed.length) {
  console.log("\nManual checklist: docs/gen-ai-voice-manual-checklist.md");
}
await closeAllBrowsers();
process.exit(failed.length ? 1 : 0);

await closeAllBrowsers();
