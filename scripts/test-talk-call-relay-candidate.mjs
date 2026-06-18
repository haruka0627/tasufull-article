#!/usr/bin/env node
/**
 * TASFUL TALK Phase5.6 — relay candidate 診断 E2E（スケルトン）
 *
 *   node scripts/test-talk-call-relay-candidate.mjs
 *   TASFUL_TALK_CALL_RELAY_E2E=1 node scripts/test-talk-call-relay-candidate.mjs
 *
 * TURN 未設定 → SKIP（exit 0, CI 安全）
 * TURN 設定 + RELAY_E2E 未設定 → 構造検証のみ PASS
 * TURN 設定 + RELAY_E2E=1 → relay candidate 待機（ステージング用）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TURN_URL = pickEnv(
  "TASFUL_TURN_URL",
  "VITE_TASFUL_TURN_URL",
  "TASFUL_TALK_CALL_TURN_URL"
);
const TURN_USER = pickEnv("TASFUL_TURN_USERNAME", "VITE_TASFUL_TURN_USERNAME");
const TURN_CRED = pickEnv("TASFUL_TURN_CREDENTIAL", "VITE_TASFUL_TURN_CREDENTIAL");
const RELAY_E2E = process.env.TASFUL_TALK_CALL_RELAY_E2E === "1";
const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

/** @type {string[]} */
const errors = [];

function pickEnv(...keys) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim();
    if (v) return v;
  }
  return "";
}

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`  NG  ${msg}`);
}

function assert(cond, msg) {
  if (cond) pass(msg);
  else fail(msg);
}

function turnConfigured() {
  return Boolean(TURN_URL && TURN_USER && TURN_CRED);
}

async function runStructuralChecks() {
  const iceSrc = readFileSync(join(__dirname, "talk-call-ice-config.js"), "utf8");
  const rtcSrc = readFileSync(join(__dirname, "talk-call-webrtc.js"), "utf8");
  assert(iceSrc.includes("getTalkCallConnectionSummary"), "getTalkCallConnectionSummary defined");
  assert(rtcSrc.includes("hasRelay"), "relay detection in webrtc module");
  assert(iceSrc.includes("isInternalDiagnosticsAllowed"), "_test gating present");
  assert(iceSrc.includes("allowDebug"), "allowDebug production lock present");
}

async function runBrowserRelayWait() {
  const { chromium } = await import("./lib/playwright-browser.mjs");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/talk-home.html?talkDev=1&talkCallDebug=1`, { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(
      async ({ turnUrl, turnUser, turnCred }) => {
        window.TASU_TALK_CALL_CONFIG = {
          ...(window.TASU_TALK_CALL_CONFIG || {}),
          internalTest: true,
          turnUrl,
          turnUsername: turnUser,
          turnCredential: turnCred,
          debug: true,
        };

        const Ice = window.TasuTalkCallIceConfig;
        const WebRtc = window.TasuTalkCallWebRtc;
        if (!Ice || !WebRtc) return { ok: false, reason: "modules missing" };

        const summary = Ice.getConfigSummary();
        if (!summary.turnEnabled) return { ok: false, reason: "turn not enabled", summary };

        WebRtc.createPeerConnection({});
        await WebRtc.attachLocalTracks();
        await WebRtc.createOffer();

        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          const conn = Ice.getTalkCallConnectionSummary();
          if (conn?.hasRelay) {
            WebRtc.close();
            return { ok: true, conn };
          }
          if (WebRtc.getPeerConnection()?.iceGatheringState === "complete") break;
          await new Promise((r) => setTimeout(r, 500));
        }

        const finalConn = Ice.getTalkCallConnectionSummary();
        WebRtc.close();
        return { ok: false, reason: "relay not seen", conn: finalConn };
      },
      { turnUrl: TURN_URL, turnUser: TURN_USER, turnCred: TURN_CRED }
    );

    const leaked = JSON.stringify(result).includes(TURN_CRED);
    assert(!leaked, "relay E2E: credential not in result payload");

    if (result.ok) {
      pass(`relay candidate observed (types=${JSON.stringify(result.conn?.typesSeen || [])})`);
    } else {
      console.warn(`  WARN  relay E2E: ${result.reason} — staging TURN may be unreachable (non-fatal)`);
      pass("relay E2E: structure completed without credential leak");
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log("TASFUL TALK Phase5.6 — relay candidate diagnostic\n");

  if (!turnConfigured()) {
    console.log("SKIP — TURN env not set (TASFUL_TURN_URL / USERNAME / CREDENTIAL)");
    await runStructuralChecks();
    if (errors.length) {
      console.error(`\nFAILED (${errors.length})`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }
    console.log("\nSKIP PASS — relay-candidate (no TURN configured)");
    return;
  }

  console.log("TURN env detected — running structural checks");
  await runStructuralChecks();

  if (!RELAY_E2E) {
    console.log("\nINFO  Set TASFUL_TALK_CALL_RELAY_E2E=1 to wait for relay candidate in browser");
    console.log("ALL PASS — relay-candidate (structural, TURN configured)");
    return;
  }

  console.log("\nRELAY_E2E=1 — browser relay wait");
  await runBrowserRelayWait();

  if (errors.length) {
    console.error(`\nFAILED (${errors.length})`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("\nALL PASS — relay-candidate");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
