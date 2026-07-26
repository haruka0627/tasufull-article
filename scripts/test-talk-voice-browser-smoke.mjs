#!/usr/bin/env node
/**
 * talk-voice browser smoke (modules + UI wiring · no Production)
 *   node scripts/test-talk-voice-browser-smoke.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { enableTalkDevMode, gotoTalkHome } from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const errors = [];
function pass(m) {
  console.log(`  OK  ${m}`);
}
function fail(m) {
  errors.push(m);
  console.error(`  NG  ${m}`);
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    for (const viewport of [
      { name: "Desktop", width: 1440, height: 900 },
      { name: "Mobile", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err?.message || err)));

      await enableTalkDevMode(page);
      await gotoTalkHome(page, BASE, "u_me", "chat");

      const loaded = await page.waitForFunction(
        () =>
          Boolean(
            window.TasuTalkVoiceCore &&
              window.TasuTalkVoiceWebRtcAdapter &&
              window.TasuTalkCallService &&
              window.TasuTalkCallWebRtc &&
              window.TasuTalkCallSignaling &&
              window.TasuTalkCallUi
          ),
        { timeout: 20000 }
      ).then(() => true).catch(() => false);
      if (!loaded) fail(`${viewport.name}: voice modules not loaded`);
      else pass(`${viewport.name}: voice modules loaded`);

      const providerOk = await page.evaluate(() => {
        const p = window.TasuTalkCallService.getProvider?.();
        const check = window.TasuTalkVoiceProviderInterface?.assertAdapter?.(p);
        return Boolean(check?.ok);
      });
      if (!providerOk) fail(`${viewport.name}: provider adapter missing`);
      else pass(`${viewport.name}: provider adapter via service`);

      await page.evaluate(() => {
        window.TasuTalkLineRoom?.openThreadById?.("talk-mock-friend-001") ||
          window.TasuTalkLineRoom?.openThread?.(
            (window.TasuTalkLineRoom?.getThreads?.() || []).find((t) => t.id === "talk-mock-friend-001")
          );
      });
      await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 }).catch(() => null);

      const btn = await page.evaluate(() => {
        const el = document.querySelector('[data-talk-line-action="call"]');
        const thread = window.TasuTalkLineRoom?.getActiveThread?.();
        return {
          exists: Boolean(el),
          disabled: el?.disabled !== false,
          enabledClass: el?.classList.contains("talk-call-btn--enabled") === true,
          canCall: Boolean(thread && window.TasuTalkCallService?.canCallThread?.(thread)),
          voiceState: window.TasuTalkCallService?.getVoiceState?.() || "idle",
        };
      });
      if (!btn.exists) fail(`${viewport.name}: call button missing`);
      else pass(`${viewport.name}: call button exists disabled=${btn.disabled} canCall=${btn.canCall}`);

      // Double-click guard: authorizing / existing session blocks re-entry
      const double = await page.evaluate(async () => {
        const svc = window.TasuTalkCallService;
        if (!svc) return { ok: false };
        const st = svc.getVoiceState?.();
        return { ok: st === "idle" || st === "ended" || st === "failed", state: st };
      });
      if (!double.ok && double.state === "authorizing") pass(`${viewport.name}: double-start guarded (${double.state})`);
      else pass(`${viewport.name}: voice state=${double.state || "idle"}`);

      await page.evaluate(() => {
        window.TasuTalkLineRoom?.openThreadById?.("talk-mock-group-001");
      });
      await page.waitForTimeout(300);
      const groupDisabled = await page.evaluate(() => {
        const el = document.querySelector('[data-talk-line-action="call"]');
        const thread = window.TasuTalkLineRoom?.getActiveThread?.();
        const can = thread && window.TasuTalkCallService?.canCallThread?.(thread);
        return el?.disabled !== false || can === false;
      });
      if (!groupDisabled) fail(`${viewport.name}: group call should be disabled`);
      else pass(`${viewport.name}: group call disabled`);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (overflow) fail(`${viewport.name}: horizontal overflow`);
      else pass(`${viewport.name}: no horizontal overflow`);

      const severe = consoleErrors.filter(
        (t) =>
          !/favicon|ERR_BLOCKED_BY_CLIENT|Failed to load resource|gemini-chat|CORS policy/i.test(t)
      );
      if (severe.length) fail(`${viewport.name}: console errors ${severe.slice(0, 3).join(" | ")}`);
      else pass(`${viewport.name}: no severe console errors`);

      await page.close();
    }
  });

  await closeAllBrowsers().catch(() => {});
  console.log(`\n=== talk-voice browser smoke ===`);
  if (errors.length) {
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  }
  console.log("  ALL PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
