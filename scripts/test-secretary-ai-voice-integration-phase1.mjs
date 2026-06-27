#!/usr/bin/env node
/**
 * AI 秘書 Voice Integration — 8788 browser smoke
 *   node scripts/test-secretary-ai-voice-integration-phase1.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const PAGE_URL = `${BASE}/admin-operations-dashboard.html`;
const VIEWPORTS = [
  [1280, 900],
  [768, 1024],
  [390, 844],
];

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

async function auditViewport(browser, width, height, runLiveChecks) {
  const page = await browser.newPage({ viewport: { width, height } });
  const jsErrors = [];
  page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));

  const tag = `${width}x${height}`;

  try {
    const resp = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    const httpStatus = resp?.status() ?? 0;
    if (httpStatus === 200) ok(`${tag} HTTP 200`);
    else bad(`${tag} HTTP 200`, String(httpStatus));

    await page.waitForFunction(
      () =>
        window.TasuVoiceCore &&
        window.TasuSecretaryVoiceController &&
        window.TasuSecretaryVoiceIntegration &&
        document.querySelector("[data-ops-secretary-voice]"),
      { timeout: 30000 }
    );

    if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
    else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));

    const globals = await page.evaluate(() => ({
      voiceCore: Boolean(window.TasuVoiceCore),
      controller: Boolean(window.TasuSecretaryVoiceController),
      integration: Boolean(window.TasuSecretaryVoiceIntegration),
      sessionClient: Boolean(window.TasuVoiceRealtimeSessionClient),
      liveOptIn: window.TasuSecretaryVoiceController?.isLiveOptInEnabled?.() === true,
      voiceBtn: Boolean(document.querySelector("[data-ops-secretary-voice]")),
      stateBadge: Boolean(document.querySelector("[data-ops-secretary-voice-state]")),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    if (globals.voiceCore) ok(`${tag} TasuVoiceCore exists`);
    else bad(`${tag} TasuVoiceCore exists`);
    if (globals.controller) ok(`${tag} TasuSecretaryVoiceController exists`);
    else bad(`${tag} TasuSecretaryVoiceController exists`);
    if (globals.integration) ok(`${tag} TasuSecretaryVoiceIntegration exists`);
    else bad(`${tag} TasuSecretaryVoiceIntegration exists`);
    if (globals.sessionClient) ok(`${tag} TasuVoiceRealtimeSessionClient exists`);
    else bad(`${tag} TasuVoiceRealtimeSessionClient exists`);
    if (!globals.liveOptIn) ok(`${tag} live opt-in OFF by default`);
    else bad(`${tag} live opt-in OFF by default`);
    if (globals.voiceBtn) ok(`${tag} voice button exists`);
    else bad(`${tag} voice button exists`);
    if (globals.stateBadge) ok(`${tag} voice state badge exists`);
    else bad(`${tag} voice state badge exists`);
    if (globals.scrollW <= globals.clientW + 1) ok(`${tag} no horizontal scroll`);
    else bad(`${tag} no horizontal scroll`, `${globals.scrollW} > ${globals.clientW}`);

    if (runLiveChecks) {
      const liveChecks = await page.evaluate(async () => {
        window.__TASU_VOICE_CORE_OPENAI_LIVE__ = true;
        window.__TASU_VOICE_LIVE_OPS_SECRETARY__ = true;
        await window.TasuSecretaryVoiceController.init({ mockCompatible: true, useWebSocketTransport: false });
        const start = await window.TasuSecretaryVoiceController.startSession();
        await new Promise((r) => setTimeout(r, 8000));
        const state = window.TasuSecretaryVoiceController?.getState?.();
        const policy = window.TasuVoiceRealtimeSessionClient?.getPolicySnapshot?.({ mockCompatible: false });
        const injectors = window.TasuVoiceRealtimeSessionClient?.getInjectorsStatus?.();
        const session = window.TasuVoiceRealtimeSessionClient?.getCurrentSession?.();
        return {
          start,
          state,
          liveOptIn: window.TasuSecretaryVoiceController?.isLiveOptInEnabled?.() === true,
          policyMode: policy?.mode,
          injectorsRegistered: injectors?.registered === true,
          sessionSurface: session?.surface,
        };
      });

      if (liveChecks.liveOptIn) ok(`${tag} live flags enable opt-in`);
      else bad(`${tag} live flags enable opt-in`);
      if (liveChecks.sessionSurface === "ops_secretary") ok(`${tag} refresh surface ops_secretary`);
      else bad(`${tag} refresh surface ops_secretary`, JSON.stringify(liveChecks));
      if (liveChecks.injectorsRegistered) ok(`${tag} injectors registered`);
      else bad(`${tag} injectors registered`, JSON.stringify(liveChecks));
      if (liveChecks.policyMode === "live") ok(`${tag} policy live`);
      else bad(`${tag} policy live`, JSON.stringify(liveChecks));
      const edgeLiveOk =
        liveChecks.liveOptIn &&
        liveChecks.injectorsRegistered &&
        liveChecks.policyMode === "live" &&
        liveChecks.start?.mode === "live";
      const mockFallback =
        !liveChecks.injectorsRegistered || liveChecks.policyMode === "mock";
      if (mockFallback || edgeLiveOk) ok(`${tag} controller startSession live or mock fallback`);
      else bad(`${tag} controller startSession live or mock fallback`, JSON.stringify(liveChecks));
    }
  } finally {
    await page.close();
  }
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    for (let i = 0; i < VIEWPORTS.length; i++) {
      const [w, h] = VIEWPORTS[i];
      await auditViewport(browser, w, h, i === 0);
    }
  });

  console.log(`\n=== AI 秘書 Voice Integration Phase 1 (8788): ${pass}/${pass + fail} PASS ===`);
  if (fail) process.exit(1);
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
