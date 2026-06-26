#!/usr/bin/env node
/**
 * Builder AI UI — static + browser smoke
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const htmlPath = path.join(root, "builder/builder-ai.html");
const uiJs = path.join(root, "builder/builder-ai-ui.js");
const uiCss = path.join(root, "builder/builder-ai-ui.css");

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

const html = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(uiJs, "utf8");
const css = fs.readFileSync(uiCss, "utf8");

if (html.includes("builder-ai-ui.css") && html.includes("builder-ai-ui.js")) ok("html loads ui assets");
else bad("html loads ui assets");

if (html.includes("現場写真・補修判断・見積補助を支援します")) ok("hero description");
else bad("hero description");

if (html.includes("AI回答は参考情報です。最終判断は現場確認・専門業者判断を優先してください。")) ok("hero notice");
else bad("hero notice");

if (html.includes("data-builder-ai-ui-send") && html.includes("data-builder-ai-ui-photo-input")) ok("field ui hooks");
else bad("field ui hooks");

if (html.includes("data-builder-ai-ui-camera") && html.includes("data-builder-ai-ui-voice")) ok("camera/voice hooks");
else bad("camera/voice hooks");

if (html.includes("builder-ai-legacy")) ok("legacy gateway section preserved");
else bad("legacy gateway section preserved");

if (html.includes("builder-ai-live.js") && html.includes("builder-ai-voice.js")) ok("html loads live phase4 modules");
else bad("html loads live phase4 modules");

if (!js.includes("次フェーズで対応予定")) ok("camera/voice stubs removed");
else bad("camera/voice stubs removed");

if (js.includes("TasuBuilderAILive") && js.includes("TasuBuilderAIVoice")) ok("ui delegates to live/voice modules");
else bad("ui delegates to live/voice modules");

if (js.includes("外壁の補修判断") && js.includes("概算見積を作りたい")) ok("quick prompts");
else bad("quick prompts");

if (css.includes("builder-ai-ui-field-chat")) ok("ui css present");
else bad("ui css present");

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
    console.log("SKIP: dist/builder/builder-ai.html missing — run npm run build:pages for browser smoke");
    return;
  }

  const fileUrl = "file:///" + distHtml.replace(/\\/g, "/");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-builder-ai-ui-send]", { timeout: 10000 });

    const fabCount = await page.locator("[data-builder-ai-ui-send]").count();
    if (fabCount === 1) ok("browser: send button mounted");
    else bad("browser: send button mounted", String(fabCount));

    await page.locator("[data-builder-ai-ui-input]").fill("外壁テスト");
    await page.locator("[data-builder-ai-ui-send]").click();
    await page.waitForTimeout(900);
    const text = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (text.includes("確定判断") || text.includes("写真") || text.includes("モック")) ok("browser: vision/mock reply");
    else bad("browser: vision/mock reply", text.slice(0, 80));

    await page.locator("[data-builder-ai-ui-camera]").click();
    await page.waitForTimeout(300);
    const afterCam = await page.locator("[data-builder-ai-ui-messages]").innerText();
    const panelVisible = await page.locator("[data-builder-ai-live-panel]").isVisible().catch(() => false);
    if (panelVisible || !afterCam.includes("次フェーズで対応予定")) ok("browser: camera live handler");
    else bad("browser: camera live handler");

    const reqUrls = [];
    page.on("request", (req) => reqUrls.push(req.url()));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const badReq = reqUrls.filter(
      (u) => /deepseek|secretary|site-assistant|gemini.*vision|generativelanguage/i.test(u)
    );
    if (!badReq.length) ok("browser: no forbidden api requests on load");
    else bad("browser: no forbidden api requests on load", badReq.join(", "));
  } finally {
    await browser.close();
  }
}

await browserSmoke();

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
