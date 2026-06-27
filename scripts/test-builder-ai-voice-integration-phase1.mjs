#!/usr/bin/env node
/**
 * Builder AI Voice Integration Phase 1 (8788 smoke)
 *   BUILDER_BASE_URL=http://127.0.0.1:8788 node scripts/test-builder-ai-voice-integration-phase1.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BUILDER_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:8788").replace(
  /\/$/,
  ""
);
const PAGE_URL = `${BASE}/builder/builder-ai.html`;
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
        window.TasuBuilderVoiceController &&
        window.TasuBuilderVoiceIntegration &&
        document.querySelector("[data-builder-ai-ui-voice-composer]"),
      { timeout: 30000 }
    );

    if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
    else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));

    const globals = await page.evaluate(() => ({
      voiceCore: Boolean(window.TasuVoiceCore),
      controller: Boolean(window.TasuBuilderVoiceController),
      integration: Boolean(window.TasuBuilderVoiceIntegration),
      sessionClient: Boolean(window.TasuVoiceRealtimeSessionClient),
      liveOptIn: window.TasuBuilderVoiceController?.isLiveOptInEnabled?.() === true,
      voiceComposerBtn: Boolean(document.querySelector("[data-builder-ai-ui-voice-composer]")),
      stateBadge: Boolean(document.querySelector("[data-builder-ai-voice-state]")),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    if (globals.voiceCore) ok(`${tag} TasuVoiceCore exists`);
    else bad(`${tag} TasuVoiceCore exists`);
    if (globals.controller) ok(`${tag} TasuBuilderVoiceController exists`);
    else bad(`${tag} TasuBuilderVoiceController exists`);
    if (globals.integration) ok(`${tag} TasuBuilderVoiceIntegration exists`);
    else bad(`${tag} TasuBuilderVoiceIntegration exists`);
    if (globals.sessionClient) ok(`${tag} TasuVoiceRealtimeSessionClient exists`);
    else bad(`${tag} TasuVoiceRealtimeSessionClient exists`);
    if (!globals.liveOptIn) ok(`${tag} live opt-in OFF by default`);
    else bad(`${tag} live opt-in OFF by default`);
    if (globals.voiceComposerBtn) ok(`${tag} voice composer button exists`);
    else bad(`${tag} voice composer button exists`);
    if (globals.stateBadge) ok(`${tag} voice state badge exists`);
    else bad(`${tag} voice state badge exists`);
    if (globals.scrollW <= globals.clientW + 1) ok(`${tag} no horizontal scroll`);
    else bad(`${tag} no horizontal scroll`, `${globals.scrollW} > ${globals.clientW}`);

    if (runLiveChecks) {
      const liveChecks = await page.evaluate(async () => {
        window.__TASU_VOICE_CORE_OPENAI_LIVE__ = true;
        window.__TASU_VOICE_LIVE_BUILDER_AI__ = true;
        await window.TasuBuilderVoiceController.init({ mockCompatible: true, useWebSocketTransport: false });
        const start = await window.TasuBuilderVoiceController.startSession();
        await new Promise((r) => setTimeout(r, 8000));
        const state = window.TasuBuilderVoiceController?.getState?.();
        const policy = window.TasuVoiceRealtimeSessionClient?.getPolicySnapshot?.({ mockCompatible: false });
        const injectors = window.TasuVoiceRealtimeSessionClient?.getInjectorsStatus?.();
        const session = window.TasuVoiceRealtimeSessionClient?.getCurrentSession?.();
        return {
          start,
          state,
          liveOptIn: window.TasuBuilderVoiceController?.isLiveOptInEnabled?.() === true,
          policyMode: policy?.mode,
          injectorsRegistered: injectors?.registered === true,
          sessionSurface: session?.surface,
        };
      });

      if (liveChecks.liveOptIn) ok(`${tag} live flags enable opt-in`);
      else bad(`${tag} live flags enable opt-in`);
      if (liveChecks.sessionSurface === "builder_ai") ok(`${tag} refresh surface builder_ai`);
      else bad(`${tag} refresh surface builder_ai`, JSON.stringify(liveChecks));
      if (liveChecks.injectorsRegistered) ok(`${tag} injectors registered`);
      else bad(`${tag} injectors registered`, JSON.stringify(liveChecks));
      if (liveChecks.policyMode === "live") ok(`${tag} policy live`);
      else bad(`${tag} policy live`, JSON.stringify(liveChecks));
      const mockFallback =
        !liveChecks.injectorsRegistered || liveChecks.policyMode === "mock";
      const edgeLiveOk =
        liveChecks.liveOptIn &&
        liveChecks.injectorsRegistered &&
        liveChecks.policyMode === "live" &&
        liveChecks.start?.mode === "live";
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

  console.log(`\n=== Builder AI Voice Integration Phase 1: ${pass}/${pass + fail} PASS ===`);
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
