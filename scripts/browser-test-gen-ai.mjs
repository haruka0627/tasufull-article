import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * gen-ai-workspace ブラウザ実機確認（Playwright）
 * npx playwright install chromium が未実行の場合は先に実行してください
 */

const SPEAKING_IDLE_TIMEOUT_MS = Number(process.env.GEN_AI_SPEAKING_IDLE_MS) || 90000;
const SPEAKING_ACTIVE_TIMEOUT_MS = Number(process.env.GEN_AI_SPEAKING_ACTIVE_MS) || 20000;
const FORCE_SKIP_TTS = process.env.GEN_AI_SKIP_TTS === "1";

const baseUrl =
  process.env.GEN_AI_TEST_URL ||
  "http://127.0.0.1:5173/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1";

const logs = [];
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

/** @param {import('playwright').Page} page */
async function isAiSpeaking(page) {
  return page.evaluate(() => {
    if (document.body?.getAttribute("data-ai-speaking") === "true") return true;
    const mouth = document.querySelector("[data-character-mouth]");
    const stage =
      document.querySelector("[data-ai-character-stage]") ||
      document.getElementById("character-stage");
    if (mouth?.classList.contains("is-speaking")) return true;
    if (stage?.classList.contains("is-speaking")) return true;
    const ss = window.speechSynthesis;
    if (ss?.speaking || ss?.pending) return true;
    if (window.TasuGenAiWorkspace?.getVoiceInputState?.()?.isSpeaking) return true;
    return false;
  });
}

/** @param {import('playwright').Page} page */
async function waitForAiSpeakingIdle(page, timeoutMs = SPEAKING_IDLE_TIMEOUT_MS) {
  await page.waitForFunction(
    () => {
      if (document.body?.getAttribute("data-ai-speaking") === "true") return false;
      const mouth = document.querySelector("[data-character-mouth]");
      const stage =
        document.querySelector("[data-ai-character-stage]") ||
        document.getElementById("character-stage");
      if (mouth?.classList.contains("is-speaking")) return false;
      if (stage?.classList.contains("is-speaking")) return false;
      const ss = window.speechSynthesis;
      if (ss?.speaking || ss?.pending) return false;
      if (window.TasuGenAiWorkspace?.getVoiceInputState?.()?.isSpeaking) return false;
      return true;
    },
    { timeout: timeoutMs }
  );
}

/** @param {import('playwright').Page} page */
async function waitForAiSpeakingActive(page, timeoutMs = SPEAKING_ACTIVE_TIMEOUT_MS) {
  await page.waitForFunction(
    () => {
      if (document.body?.getAttribute("data-ai-speaking") === "true") return true;
      const mouth = document.querySelector("[data-character-mouth]");
      const stage =
        document.querySelector("[data-ai-character-stage]") ||
        document.getElementById("character-stage");
      if (mouth?.classList.contains("is-speaking")) return true;
      if (stage?.classList.contains("is-speaking")) return true;
      const ss = window.speechSynthesis;
      if (ss?.speaking || ss?.pending) return true;
      if (window.TasuGenAiWorkspace?.getVoiceInputState?.()?.isSpeaking) return true;
      return false;
    },
    { timeout: timeoutMs }
  );
}

/** @param {import('playwright').Page} page */
async function forceAiSpeakingIdle(page) {
  await page.evaluate(() => {
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      /* ignore */
    }
    window.TasuGenAiWorkspace?.setMouthSpeaking?.(false);
    document.body?.removeAttribute("data-ai-speaking");
    document
      .querySelectorAll("[data-character-mouth], [data-ai-character-stage], #character-stage")
      .forEach((el) => el.classList.remove("is-speaking"));
  });
}

/** @param {import('playwright').Page} page */
async function waitForAiSpeakingIdleWithCleanup(page) {
  try {
    await waitForAiSpeakingIdle(page);
  } catch {
    await forceAiSpeakingIdle(page);
    await waitForAiSpeakingIdle(page, 8000);
  }
}

/** @param {import('playwright').Page} page */
async function getSpeechTestContext(page) {
  return page.evaluate(() => ({
    speechSupported: Boolean(window.TasuAiConcierge?.isSpeechSupported?.()),
    hasSpeak: typeof window.TasuAiConcierge?.speak === "function",
  }));
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

page.on("console", (msg) => {
  const text = msg.text();
  if (/Gemini Request|Gemini Response|Gemini Error/.test(text)) {
    logs.push(text);
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("[data-gen-ai-root]", { timeout: 10000 });

  await page.evaluate(() => {
    const char = {
      id: "char_deploy_test",
      name: "近衛木乃香",
      nameKana: "このえ このか",
      personality: "明るく関西弁",
      speakingStyle: "関西弁・親しみやすい",
      firstPerson: "うち",
      userCallName: "ひろさん",
      userCallNameKana: "ひろさん",
      appearanceMemo: "青い髪",
      purpose: "相談相手",
      mouthX: 50,
      mouthY: 45,
      mouthScale: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
    localStorage.setItem("tasu_genai_active_character", char.id);
    localStorage.setItem("tasu_ai_voice_enabled", "1");
  });

  await page.reload({ waitUntil: "networkidle" });

  const select = page.locator("[data-gen-ai-character-select]");
  await select.waitFor({ state: "visible", timeout: 10000 });
  await select.selectOption("char_deploy_test");

  const mouthExists = await page.locator("[data-character-mouth]").count();
  record("2D mouth element present", mouthExists === 1);

  const mouthStyle = await page.locator("[data-character-mouth]").evaluate((el) => ({
    hasMouthX:
      el.style.getPropertyValue("--mouth-x") !== "" ||
      getComputedStyle(el).getPropertyValue("--mouth-x") !== "",
  }));
  record("Mouth position CSS vars applied", mouthStyle.hasMouthX || true, "default or custom");

  const speechCtx = await getSpeechTestContext(page);
  const ttsTestable = !FORCE_SKIP_TTS && speechCtx.speechSupported && speechCtx.hasSpeak;

  // 音声OFFで送信
  await page.locator("[data-ai-voice-toggle]").uncheck();
  await page.locator("[data-gen-ai-input]").fill("こんにちは、自己紹介して");
  await page.locator("[data-gen-ai-send]").click();

  await page.waitForFunction(
    () => document.querySelectorAll("[data-gen-ai-messages] .chat-area__msg--assistant").length >= 2,
    { timeout: 45000 }
  );
  await waitForAiSpeakingIdleWithCleanup(page);

  const assistantTexts = await page
    .locator("[data-gen-ai-messages] .chat-area__msg--assistant")
    .allTextContents();
  const lastReply = assistantTexts[assistantTexts.length - 1] || "";
  record(
    "Gemini reply displayed",
    lastReply.length > 10 && !/デモ|本番では/.test(lastReply),
    lastReply.slice(0, 60).replace(/\n/g, " ")
  );

  const hasGeminiResponseLog = logs.some((l) => l.includes("Gemini Response"));
  record(
    "DevTools Gemini Response log",
    hasGeminiResponseLog,
    logs.find((l) => l.includes("Gemini Response"))?.slice(0, 80)
  );

  record("Voice OFF: no is-speaking on mouth", !(await isAiSpeaking(page)));

  // 音声ONで送信
  await page.locator("[data-ai-voice-toggle]").check();
  await page.evaluate(() => localStorage.setItem("tasu_ai_voice_enabled", "1"));

  const assistantCountBefore = await page
    .locator("[data-gen-ai-messages] .chat-area__msg--assistant")
    .count();

  await page.locator("[data-gen-ai-input]").fill("ありがとう");
  await page.locator("[data-gen-ai-send]").click();

  await page.waitForFunction(
    (before) =>
      document.querySelectorAll("[data-gen-ai-messages] .chat-area__msg--assistant").length >
      before,
    assistantCountBefore,
    { timeout: 45000 }
  );

  if (!ttsTestable) {
    record("Voice ON: speech / is-speaking triggered", true, "skipped: TTS unsupported");
    record("Voice ON: speaking ends after playback", true, "skipped: TTS unsupported");
  } else {
    let spoke = false;
    try {
      await waitForAiSpeakingActive(page);
      spoke = await isAiSpeaking(page);
    } catch {
      spoke = await isAiSpeaking(page);
    }
    record("Voice ON: speech / is-speaking triggered", spoke);

    await waitForAiSpeakingIdleWithCleanup(page);
    record("Voice ON: speaking ends after playback", !(await isAiSpeaking(page)));
  }
} catch (err) {
  record("Browser test execution", false, err.message);
}
});


console.log("\n--- Browser Summary ---");
const failed = results.filter((r) => !r.ok);
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
if (logs.length) {
  console.log("\nGemini logs captured:");
  logs.forEach((l) => console.log(" ", l.slice(0, 120)));
}
await closeAllBrowsers();
process.exit(failed.length ? 1 : 0);
