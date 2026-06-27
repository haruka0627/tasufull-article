#!/usr/bin/env node
/**
 * TASFUL AI Workspace Voice Integration Phase 1 (8788 smoke)
 *   BUILDER_BASE_URL=http://127.0.0.1:8788 node scripts/test-tasful-ai-voice-integration-phase1.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BUILDER_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:8788").replace(
  /\/$/,
  ""
);
const PAGE_URL = `${BASE}/ai-workspace.html`;
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

async function auditViewport(browser, width, height, runSubmitChecks) {
  const page = await browser.newPage({ viewport: { width, height } });
  const jsErrors = [];
  page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));

  const tag = `${width}x${height}`;
  let httpStatus = 0;

  try {
    const resp = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    httpStatus = resp?.status() ?? 0;
    if (httpStatus === 200) ok(`${tag} HTTP 200`);
    else bad(`${tag} HTTP 200`, String(httpStatus));

    await page.waitForFunction(
      () =>
        window.TasuVoiceCore &&
        window.TasuWorkspaceVoiceController &&
        window.TasuWorkspaceVoiceIntegration &&
        document.querySelector("[data-tasu-workspace-voice-composer-btn]"),
      { timeout: 30000 }
    );

    if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
    else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));

    const globals = await page.evaluate(() => ({
      voiceCore: Boolean(window.TasuVoiceCore),
      controller: Boolean(window.TasuWorkspaceVoiceController),
      integration: Boolean(window.TasuWorkspaceVoiceIntegration),
      composerBtn: Boolean(document.querySelector("[data-tasu-workspace-voice-composer-btn]")),
      stateBadge: Boolean(document.querySelector("[data-tasu-workspace-voice-state]")),
      legacyWrap: Boolean(document.querySelector(".tasful-ai-voice--legacy-hidden")),
      legacyToolbarInDom: Boolean(document.querySelector(".tasful-ai-voice__toolbar")),
      legacyToolbarVisible: (() => {
        const toolbar = document.querySelector(".tasful-ai-voice__toolbar");
        if (!toolbar) return false;
        const style = getComputedStyle(toolbar);
        return (
          toolbar.offsetWidth > 0 &&
          toolbar.offsetHeight > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })(),
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    if (globals.voiceCore) ok(`${tag} TasuVoiceCore exists`);
    else bad(`${tag} TasuVoiceCore exists`);
    if (globals.controller) ok(`${tag} TasuWorkspaceVoiceController exists`);
    else bad(`${tag} TasuWorkspaceVoiceController exists`);
    if (globals.integration) ok(`${tag} TasuWorkspaceVoiceIntegration exists`);
    else bad(`${tag} TasuWorkspaceVoiceIntegration exists`);
    if (globals.composerBtn) ok(`${tag} composer voice button exists`);
    else bad(`${tag} composer voice button exists`);
    if (globals.stateBadge) ok(`${tag} state badge exists`);
    else bad(`${tag} state badge exists`);
    if (globals.legacyWrap && globals.legacyToolbarInDom && !globals.legacyToolbarVisible) {
      ok(`${tag} legacy toolbar hidden in DOM`);
    } else {
      bad(
        `${tag} legacy toolbar hidden in DOM`,
        JSON.stringify({
          legacyWrap: globals.legacyWrap,
          legacyToolbarInDom: globals.legacyToolbarInDom,
          legacyToolbarVisible: globals.legacyToolbarVisible,
        })
      );
    }

    if (globals.scrollW <= globals.clientW + 1) ok(`${tag} no horizontal scroll`);
    else bad(`${tag} no horizontal scroll`, `${globals.scrollW} > ${globals.clientW}`);

    if (runSubmitChecks) {
      const submitChecks = await page.evaluate(async () => {
        const before = document.querySelectorAll(".user-bubble-row").length;

        window.TasuAiVoiceCore.speechToText = async () => ({
          ok: true,
          text: "tasful workspace voice phase1 smoke",
        });
        window.TasuWorkspaceVoiceController?.init?.({
          mockCompatible: true,
          useWebSocketTransport: false,
        });

        let captureCalled = false;
        const Integration = window.TasuWorkspaceVoiceIntegration;
        const origCapture = Integration.submitVoiceCapture.bind(Integration);
        Integration.submitVoiceCapture = async (...args) => {
          captureCalled = true;
          return origCapture(...args);
        };

        document.querySelector("[data-tasu-workspace-voice-composer-btn]")?.click();
        await new Promise((r) => setTimeout(r, 12000));
        const afterVoice = document.querySelectorAll(".user-bubble-row").length;

        const input = document.querySelector("[data-ai-chat-input]");
        input.value = "tasful workspace text phase1 smoke";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector("[data-ai-chat-send]")?.click();
        await new Promise((r) => setTimeout(r, 12000));
        const afterText = document.querySelectorAll(".user-bubble-row").length;

        return { captureCalled, before, afterVoice, afterText };
      });

      if (submitChecks.captureCalled) ok(`${tag} voice submit uses submitVoiceCapture`);
      else bad(`${tag} voice submit uses submitVoiceCapture`);
      if (submitChecks.afterVoice > submitChecks.before) ok(`${tag} voice submit reaches user bubble`);
      else bad(`${tag} voice submit reaches user bubble`, JSON.stringify(submitChecks));
      if (submitChecks.afterText > submitChecks.afterVoice) ok(`${tag} text submit works`);
      else bad(`${tag} text submit works`, JSON.stringify(submitChecks));
    }
  } finally {
    await page.close();
  }

  return { httpStatus, jsErrors };
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {
    for (let i = 0; i < VIEWPORTS.length; i++) {
      const [w, h] = VIEWPORTS[i];
      await auditViewport(browser, w, h, i === 0);
    }
  });

  console.log(`\n=== TASFUL AI Workspace Voice Integration Phase 1: ${pass}/${pass + fail} PASS ===`);
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
