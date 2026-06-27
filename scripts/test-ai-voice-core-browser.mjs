#!/usr/bin/env node
/**
 * TASFUL AI Voice Core E2E
 *   BUILDER_BASE_URL=http://127.0.0.1:8788 node scripts/test-ai-voice-core-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BUILDER_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:8788").replace(
  /\/$/,
  ""
);

function pageUrl(rel) {
  return `${BASE}/${rel.replace(/^\//, "")}`;
}

function fail(msg) {
  console.error("FAIL:", msg);
  throw new Error(msg);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function testVoiceCoreApi(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuAiVoiceCore?.speechToText, null, { timeout: 15000 });

  const api = await page.evaluate(async () => {
    const V = window.TasuAiVoiceCore;
    const sup = V.isVoiceSupported();
    V.initSurface("ops_secretary");
    V.setSpeakerEnabled(false, "ops_secretary");
    const off = await V.playVoice("テスト");
    return {
      hasApi: Boolean(
        V.speechToText &&
          V.textToSpeech &&
          V.playVoice &&
          V.stopVoice &&
          V.isVoiceSupported &&
          V.mountToolbar
      ),
      sup,
      speakerOffSkipped: off && off.skipped === true && off.reason === "speaker_off",
      adapterId: V.getTtsAdapter?.()?.id || "",
    };
  });

  if (!api.hasApi) fail("TasuAiVoiceCore API incomplete");
  pass("TasuAiVoiceCore — public API exposed");

  if (!api.sup || typeof api.sup.stt !== "boolean" || typeof api.sup.tts !== "boolean") {
    fail("isVoiceSupported shape invalid");
  }
  pass(`isVoiceSupported — stt:${api.sup.stt} tts:${api.sup.tts}`);

  if (!api.speakerOffSkipped) fail("playVoice should skip when speaker OFF");
  pass("playVoice — speaker OFF skips read-aloud");

  if (api.adapterId !== "browser-speech-synthesis") {
    fail(`expected browser TTS adapter, got ${api.adapterId}`);
  }
  pass("TTS adapter — browser-speech-synthesis default");
}

async function testSecretaryVoiceUi(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuAdminAiSecretaryVoice?.mountSecretaryVoice, null, {
    timeout: 15000,
  });

  const voiceBtn = page.locator("#ops-ai-command-center [data-ops-secretary-voice]").first();
  const voiceState = page.locator("#ops-ai-command-center [data-ops-secretary-voice-state]").first();
  if (!(await voiceBtn.count())) fail("composer voice button missing on command center");
  pass("AI秘書 — composer voice button present");

  if (!(await voiceState.count())) fail("voice state badge missing on command center");
  pass("AI秘書 — voice state badge present");

  const input = page.locator("#ops-ai-command-center [data-ops-secretary-input]").first();
  const send = page.locator("#ops-ai-command-center [data-ops-secretary-send]").first();
  if (!(await input.isVisible())) fail("text input hidden after voice mount");
  pass("AI秘書 — text input still visible");

  await input.fill("Voice Core テスト");
  await send.click();
  await page.waitForFunction(
    () => {
      const log = document.querySelector(
        "#ops-ai-command-center [data-ops-phase2-chat-log]"
      );
      return log && log.querySelectorAll(".ops-p2-chat__msg--assistant").length >= 1;
    },
    null,
    { timeout: 20000 }
  );
  pass("AI秘書 — text chat works with composer voice UI");

  const spoke = await page.evaluate(() => {
    let speakCount = 0;
    const orig = window.speechSynthesis?.speak;
    if (orig) {
      window.speechSynthesis.speak = function mockSpeak() {
        speakCount += 1;
      };
    }
    window.TasuAiVoiceCore.setSpeakerEnabled(false, "ops_secretary");
    window.dispatchEvent(
      new CustomEvent("tasu:ai-voice-assistant-reply", {
        detail: { text: "読み上げOFFテスト", surface: "ops_secretary" },
      })
    );
    return speakCount;
  });
  if (spoke !== 0) fail("speechSynthesis invoked while speaker OFF");
  pass("AI秘書 — speaker OFF does not read aloud");

  const spokeOn = await page.evaluate(async () => {
    let speakCount = 0;
    const orig = window.speechSynthesis?.speak;
    if (orig) {
      window.speechSynthesis.speak = function mockSpeak() {
        speakCount += 1;
      };
    }
    window.TasuAiVoiceCore.setSpeakerEnabled(true, "ops_secretary");
    window.dispatchEvent(
      new CustomEvent("tasu:ai-voice-assistant-reply", {
        detail: { text: "読み上げONテスト", surface: "ops_secretary" },
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    window.TasuAiVoiceCore.setSpeakerEnabled(false, "ops_secretary");
    return { speakCount, tts: window.TasuAiVoiceCore.isVoiceSupported().tts };
  });
  if (spokeOn.tts && spokeOn.speakCount < 1) {
    fail("speechSynthesis not invoked when speaker ON and TTS supported");
  }
  if (spokeOn.tts) {
    pass("AI秘書 — speaker ON triggers read-aloud path");
  } else {
    pass("AI秘書 — TTS unsupported in headless; ON path skipped");
  }
}

async function testWorkspaceExpose(page) {
  await page.goto(pageUrl("ai-workspace.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.TasuAiVoiceCore && window.TasuAiWorkspaceVoice,
    null,
    { timeout: 20000 }
  );

  const exposed = await page.evaluate(() => {
    const toolbar = document.querySelector(".tasful-ai-voice__toolbar");
    const style = toolbar ? getComputedStyle(toolbar) : null;
    return {
      core: Boolean(window.TasuAiVoiceCore),
      workspace: Boolean(window.TasuAiWorkspaceVoice),
      composerBtn: Boolean(document.querySelector("[data-tasu-workspace-voice-composer-btn]")),
      legacyToolbarInDom: Boolean(toolbar),
      legacyToolbarVisible:
        Boolean(toolbar) &&
        toolbar.offsetWidth > 0 &&
        toolbar.offsetHeight > 0 &&
        style?.display !== "none" &&
        style?.visibility !== "hidden",
      legacyHiddenWrap: Boolean(document.querySelector(".tasful-ai-voice--legacy-hidden")),
    };
  });

  if (!exposed.core) fail("TasuAiVoiceCore not on ai-workspace");
  pass("TASFUL AI — TasuAiVoiceCore exposed");

  if (!exposed.workspace) fail("TasuAiWorkspaceVoice missing");
  pass("TASFUL AI — TasuAiWorkspaceVoice bridge loaded");

  if (!exposed.composerBtn) fail("workspace composer voice button missing");
  pass("TASFUL AI — composer voice button present");

  if (!exposed.legacyToolbarInDom) fail("workspace legacy voice toolbar missing from DOM");
  pass("TASFUL AI — legacy voice toolbar retained in DOM");

  if (exposed.legacyHiddenWrap && !exposed.legacyToolbarVisible) {
    pass("TASFUL AI — legacy voice toolbar hidden");
  } else {
    fail(
      "workspace legacy voice toolbar should be hidden",
      JSON.stringify({
        legacyHiddenWrap: exposed.legacyHiddenWrap,
        legacyToolbarVisible: exposed.legacyToolbarVisible,
      })
    );
  }
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await testVoiceCoreApi(page);
    await testSecretaryVoiceUi(page);
    await testWorkspaceExpose(page);
  });
  pass("all voice core checks");
  await closeAllBrowsers();
}

main()
  .then(async () => {
    await closeAllBrowsers();
  })
  .catch(async (err) => {
    console.error(err?.message || err);
    await closeAllBrowsers();
    process.exit(1);
  });
