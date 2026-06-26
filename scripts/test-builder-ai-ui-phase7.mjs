#!/usr/bin/env node
/**
 * Builder AI UI Phase 7 — AD-012 chat-first · local consult · hub links
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
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

const htmlPath = path.join(root, "builder/builder-ai.html");
const uiJs = path.join(root, "builder/builder-ai-ui.js");
const uiCss = path.join(root, "builder/builder-ai-ui.css");

const html = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(uiJs, "utf8");
const css = fs.readFileSync(uiCss, "utf8");

if (html.includes("builder-ai-ui-chat-shell")) ok("html chat shell");
else bad("html chat shell");

if (html.includes("data-builder-ai-ui-capability")) ok("html capability header");
else bad("html capability header");

if (html.includes("data-builder-ai-ui-hub-links")) ok("html hub links nav");
else bad("html hub links nav");

if (html.includes("建設現場の相談をテキストで")) ok("capability lead copy");
else bad("capability lead copy");

if (html.includes("AI回答は参考情報です")) ok("disclaimer notice");
else bad("disclaimer notice");

if (js.includes("現場写真の相談") && js.includes("未入金確認") && js.includes("通知確認")) ok("quick action labels");
else bad("quick action labels");

if (html.includes("builder-ai-legacy")) ok("legacy gateway preserved");
else bad("legacy gateway preserved");

if (js.includes("UI_LOCAL_ONLY")) ok("ui local-only flag");
else bad("ui local-only flag");

if (js.includes("buildLocalStoreConsultReply") && js.includes("bindHubLinks")) ok("local consult + hub links js");
else bad("local consult + hub links js");

if (js.includes("preferRemote: UI_LOCAL_ONLY")) ok("vision preferRemote local");
else bad("vision preferRemote local");

if (js.includes("現場写真の相談") && js.includes('intent: "unpaid"')) ok("quick prompts updated");
else bad("quick prompts updated");

if (css.includes("builder-ai-ui-capability") && css.includes("builder-ai-ui-hub-links")) ok("phase7 css");
else bad("phase7 css");

async function browserSmoke() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.log("SKIP: playwright not installed");
    return;
  }

  const distHtml = path.join(root, "deploy/cloudflare/dist/builder/builder-ai.html");
  if (!fs.existsSync(distHtml)) {
    console.log("SKIP: dist missing — run build:pages");
    return;
  }

  const fileUrl = "file:///" + distHtml.replace(/\\/g, "/");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-builder-ai-ui-send]", { timeout: 10000 });

    const hubCount = await page.locator(".builder-ai-ui-hub-links__link").count();
    if (hubCount >= 5) ok(`browser: hub links (${hubCount})`);
    else bad("browser: hub links", String(hubCount));

    await page.locator("[data-builder-ai-ui-quick] button").filter({ hasText: "未入金確認" }).click();
    await page.waitForTimeout(400);
    const unpaidText = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (unpaidText.includes("未入金") || unpaidText.includes("ローカル参考")) ok("browser: unpaid quick local reply");
    else bad("browser: unpaid quick local reply", unpaidText.slice(0, 100));

    await page.locator("[data-builder-ai-ui-input]").fill("外壁テスト");
    await page.locator("[data-builder-ai-ui-send]").click();
    await page.waitForTimeout(900);
    const visionText = await page.locator("[data-builder-ai-ui-messages]").innerText();
    if (visionText.includes("確定判断") || visionText.includes("写真") || visionText.includes("モック")) ok("browser: vision/mock reply");
    else bad("browser: vision/mock reply", visionText.slice(0, 80));
  } finally {
    await browser.close();
  }
}

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, shell: true, encoding: "utf8" });
if (build.status === 0) ok("build:pages PASS");
else bad("build:pages", build.stderr?.slice(0, 200) || String(build.status));

await browserSmoke();

console.log("\nRunning phase6h dashboard regression …");
const dash = spawnSync("node", ["scripts/test-builder-dashboard-phase6h.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
if (/ALL 32\/32 PASS/.test(dash.stdout || "")) ok("phase6h dashboard 32/32");
else bad("phase6h dashboard", (dash.stdout || dash.stderr || "").slice(-120));

console.log("\nRunning phase6g notification regression …");
const note = spawnSync("node", ["scripts/test-builder-notification-center-phase6g.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
if (/47\/47 PASS|ALL 47\/47 PASS/.test(note.stdout || "")) ok("phase6g notification 47/47");
else bad("phase6g notification", (note.stdout || note.stderr || "").slice(-120));

console.log(`\n=== ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
