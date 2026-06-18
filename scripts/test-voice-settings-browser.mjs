#!/usr/bin/env node
/**
 * TASFUL — AI音声選択 Phase1 smoke
 *
 *   node scripts/test-voice-settings-browser.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const errors = [];

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

async function main() {
  const html = readFileSync(join(root, "voice-settings.html"), "utf8");
  if (!html.includes("voice-settings.html")) pass("voice-settings.html exists");
  if (html.includes("data-voice-settings-standard-list")) pass("static: standard list hook");
  else fail("static: standard list hook missing");
  if (html.includes("data-voice-settings-premium-list")) pass("static: premium list hook");
  else fail("static: premium list hook missing");
  if (html.includes("tasu-voice-catalog.js")) pass("static: catalog script");
  else fail("static: catalog script missing");

  const profileHtml = readFileSync(join(root, "profile-settings.html"), "utf8");
  if (profileHtml.includes('href="voice-settings.html"')) pass("profile-settings link");
  else fail("profile-settings link missing");

  const genHtml = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
  if (genHtml.includes("tasu-voice-catalog.js") && genHtml.includes("voice-settings.html")) {
    pass("gen-ai-workspace hooks");
  } else fail("gen-ai-workspace hooks missing");

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/voice-settings.html`, { waitUntil: "load", timeout: 30000 });

    await page.waitForFunction(
      () => Boolean(window.TasuVoiceCatalog && window.TasuVoicePreferences),
      { timeout: 10000 }
    );
    pass("modules loaded");

    const counts = await page.evaluate(() => ({
      standard: window.TasuVoiceCatalog.listStandard().length,
      premium: window.TasuVoiceCatalog.listPremium().length,
      premiumDisabled: document.querySelectorAll("[data-voice-settings-premium-list] input[disabled]").length,
    }));
    if (counts.standard >= 3) pass(`standard voices=${counts.standard}`);
    else fail(`standard voices too few: ${counts.standard}`);
    if (counts.premium >= 1 && counts.premiumDisabled === counts.premium) {
      pass("premium voices disabled");
    } else fail("premium voices should be disabled");

    await page.evaluate(() => {
      document.querySelector("[data-voice-settings-enabled]").checked = false;
    });
    await page.evaluate(() => document.querySelector("[data-voice-settings-save]")?.click());
    await page.waitForTimeout(300);
    const offSaved = await page.evaluate(() => ({
      legacy: localStorage.getItem("tasu_ai_voice_enabled"),
      enabled: window.TasuVoicePreferences.getVoiceEnabled(),
    }));
    if (offSaved.legacy === "0" && offSaved.enabled === false) pass("ON/OFF save OFF");
    else fail(`ON/OFF save OFF failed: ${JSON.stringify(offSaved)}`);

    await page.evaluate(() => {
      document.querySelector("[data-voice-settings-enabled]").checked = true;
    });
    await page.evaluate(() => document.querySelector("[data-voice-settings-save]")?.click());
    await page.waitForTimeout(200);

    const targetVoice = await page.evaluate(() => {
      const voices = window.TasuVoiceCatalog.listStandard();
      return voices[1]?.id || voices[0]?.id || "";
    });
    await page.evaluate((voiceId) => {
      const radio = document.querySelector(`#voice-${voiceId}`);
      if (radio) radio.checked = true;
      const rate = document.querySelector("[data-voice-settings-rate]");
      if (rate) rate.value = "1.2";
      document.querySelector("[data-voice-settings-save]")?.click();
    }, targetVoice);
    await page.waitForTimeout(300);

    const prefs = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("tasu_voice_preferences_v1") || "{}");
      return raw;
    });
    if (prefs.selectedVoiceId === targetVoice) pass(`selectedVoiceId saved=${targetVoice}`);
    else fail(`selectedVoiceId expected ${targetVoice}, got ${prefs.selectedVoiceId}`);
    if (Math.abs(Number(prefs.rate) - 1.2) < 0.01) pass("rate saved");
    else fail(`rate save failed: ${prefs.rate}`);

    const premiumClick = await page.evaluate(() => {
      const input = document.querySelector("[data-voice-settings-premium-list] input");
      if (!input) return { ok: false, reason: "no premium input" };
      const before = window.TasuVoicePreferences.load().selectedVoiceId;
      try {
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) {
        return { ok: false, reason: String(err.message) };
      }
      const after = window.TasuVoicePreferences.load().selectedVoiceId;
      return { ok: input.disabled && after === before, disabled: input.disabled, before, after };
    });
    if (premiumClick.ok) pass("premium not selectable");
    else fail(`premium selectable? ${JSON.stringify(premiumClick)}`);

    const speakOk = await page.evaluate(() => {
      try {
        localStorage.setItem("tasu_ai_voice_enabled", "1");
        const result = window.TasuAiConcierge.speak("テスト読み上げ", { mode: { speechEnabled: true } });
        window.speechSynthesis?.cancel?.();
        return { ok: result === true || result === false, threw: false };
      } catch (err) {
        return { ok: false, threw: true, msg: err.message };
      }
    });
    if (speakOk.ok && !speakOk.threw) pass("ai-concierge speak safe");
    else fail(`ai-concierge speak failed: ${JSON.stringify(speakOk)}`);

    await page.goto(`${BASE}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForSelector("[data-ai-voice-toggle]", { timeout: 15000 });
    const genAiSpeak = await page.evaluate(() => {
      try {
        const r = window.TasuAiConcierge?.speak?.("連携テスト", { mode: { speechEnabled: true } });
        window.speechSynthesis?.cancel?.();
        return { ok: typeof r === "boolean" };
      } catch (err) {
        return { ok: false, msg: err.message };
      }
    });
    if (genAiSpeak.ok) pass("gen-ai-workspace speak integration");
    else fail(`gen-ai speak: ${genAiSpeak.msg || "failed"}`);

    const voiceLink = await page.evaluate(() =>
      Boolean(document.querySelector('a[href="voice-settings.html"]'))
    );
    if (voiceLink) pass("gen-ai voice-settings link visible");
    else fail("gen-ai voice-settings link missing");
    });
  

  console.log(`\n=== ${errors.length ? "FAIL" : "PASS"} (${errors.length} errors) ===`);
  if (errors.length) {
    errors.forEach((e) => console.error(` - ${e}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
