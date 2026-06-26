#!/usr/bin/env node
/**
 * Builder AI Live Phase 4-A — static + browser smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const html = read("builder/builder-ai.html");
const uiJs = read("builder/builder-ai-ui.js");
const liveJs = read("builder/builder-ai-live.js");
const voiceJs = read("builder/builder-ai-voice.js");
const gateJs = read("builder/builder-ai-live-gate.js");
const uiCss = read("builder/builder-ai-ui.css");

if (html.includes("builder-ai-live-gate.js")) ok("html loads live gate");
else bad("html loads live gate");

if (html.includes("builder-ai-live.js") && html.includes("builder-ai-voice.js")) ok("html loads live + voice modules");
else bad("html loads live + voice modules");

if (html.includes("tasful-ai-voice-core.js") && html.includes("tasful-ai-voice.css")) ok("html loads voice core assets");
else bad("html loads voice core assets");

if (html.includes("data-builder-ai-live-panel") && html.includes("data-builder-ai-live-snapshot")) ok("html live panel hooks");
else bad("html live panel hooks");

if (!uiJs.includes("次フェーズで対応予定")) ok("ui stubs removed");
else bad("ui stubs removed");

if (uiJs.includes("TasuBuilderAILive") && uiJs.includes("TasuBuilderAIVoice")) ok("ui wires live + voice");
else bad("ui wires live + voice");

if (uiJs.includes("camera_snapshot") && uiJs.includes("source: \"voice\"")) ok("ui message source tags");
else bad("ui message source tags");

if (liveJs.includes("getUserMedia") && liveJs.includes("takeSnapshotDiagnosis")) ok("live camera + snapshot");
else bad("live camera + snapshot");

if (voiceJs.includes('surface: SURFACE') && voiceJs.includes("builder_ai")) ok("voice surface builder_ai");
else bad("voice surface builder_ai");

if (voiceJs.includes("quickVoiceCapture") && voiceJs.includes("notifyAssistantReply")) ok("voice adapter api");
else bad("voice adapter api");

if (gateJs.includes("canUse") && gateJs.includes("resolveBuilderTier")) ok("gate stub api");
else bad("gate stub api");

if (uiCss.includes("builder-ai-ui-live")) ok("live panel css");
else bad("live panel css");

const scriptOrder = html.indexOf("builder-ai-live-gate.js");
const uiOrder = html.indexOf("builder-ai-ui.js");
if (scriptOrder > 0 && uiOrder > scriptOrder) ok("script order gate before ui");
else bad("script order gate before ui");

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed — static checks only");
    return;
  }

  const distHtml = path.join(root, "deploy/cloudflare/dist/builder/builder-ai.html");
  if (!fs.existsSync(distHtml)) {
    console.log("SKIP: dist missing — run npm run build:pages");
    return;
  }

  const fileUrl = `file:///${distHtml.replace(/\\/g, "/")}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => globalThis.TasuBuilderAILive && globalThis.TasuBuilderAIVoice, null, {
      timeout: 10000,
    });
    ok("browser: live modules on window");

    const hasPanel = (await page.locator("[data-builder-ai-live-panel]").count()) === 1;
    if (hasPanel) ok("browser: live panel in dom");
    else bad("browser: live panel in dom");

    await page.locator("[data-builder-ai-ui-input]").fill("30坪 外壁塗装 概算");
    await page.locator("[data-builder-ai-ui-send]").click();
    await page.waitForTimeout(600);
    const calcText = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (/計算|外壁|㎡|坪/.test(calcText)) ok("browser: calc route from text");
    else bad("browser: calc route from text", calcText.slice(0, 100));

    await page.locator("[data-builder-ai-ui-camera]").click();
    await page.waitForTimeout(300);
    const panelHidden = await page.locator("[data-builder-ai-live-panel]").isHidden();
    const msgs = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (!panelHidden || /カメラ|ブラウザ|拒否|起動/.test(msgs)) ok("browser: camera click handled safely");
    else bad("browser: camera click handled safely");

    const voiceCore = await page.evaluate(() => Boolean(globalThis.TasuAiVoiceCore?.isVoiceSupported));
    if (voiceCore) ok("browser: voice core loaded");
    else bad("browser: voice core loaded");
  } finally {
    await browser.close();
  }
}

await browserSmoke();

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
