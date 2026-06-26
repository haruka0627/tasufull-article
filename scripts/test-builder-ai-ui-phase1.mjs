#!/usr/bin/env node
/**
 * Builder AI UI Phase 1 — static + browser smoke
 * Vision / Live / Voice API 非接続 · stub UI のみ
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

if (!js.includes("ai-model-gateway") && !js.includes("TasuBuilderAICore")) ok("ui js no gateway/core");
else bad("ui js no gateway/core");

if (js.includes("UI準備中") && js.includes("カメラ診断は次フェーズ") && js.includes("音声相談は次フェーズ")) ok("stub messages");
else bad("stub messages");

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
    await page.waitForTimeout(700);
    const text = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (text.includes("UI準備中")) ok("browser: stub reply");
    else bad("browser: stub reply", text.slice(0, 80));

    await page.locator("[data-builder-ai-ui-camera]").click();
    await page.waitForTimeout(200);
    const afterCam = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (afterCam.includes("カメラ診断は次フェーズ")) ok("browser: camera stub");
    else bad("browser: camera stub");

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
