#!/usr/bin/env node
/**
 * TLV → TASFUL AI 導線テスト
 *   node scripts/test-tlv-tasful-ai-entry.mjs
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "deploy/cloudflare/dist");
const PORT = Number(process.env.TLV_TEST_PORT || 8793);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function startDistServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const file = join(dist, p.replace(/^\//, "") || "index.html");
      try {
        const data = readFileSync(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

const BASE = `http://127.0.0.1:${PORT}`;
const STUDIO_URL = `${BASE}/live/studio-dashboard.html?talkDev=1&userId=u_me`;
const UPLOAD_URL = `${BASE}/live/video-upload.html?talkDev=1&userId=u_me`;
const WORKSPACE_TLV = `${BASE}/ai-workspace.html?source=tlv`;

/** @type {{ name: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

for (const rel of [
  "live/tlv-tasful-ai-entry.js",
  "ai-workspace-tlv-source.js",
  "deploy/cloudflare/dist/live/tlv-tasful-ai-entry.js",
  "deploy/cloudflare/dist/ai-workspace-tlv-source.js",
]) {
  assert(`file exists: ${rel}`, existsSync(join(root, rel)));
}

const entryJs = readFileSync(join(root, "live/tlv-tasful-ai-entry.js"), "utf8");
assert("entry defines tlv source param", /SOURCE\s*=\s*"tlv"/.test(entryJs) && /ai-workspace\.html/.test(entryJs));
assert("entry does not define new AI gateway", !/TasuAiModelGateway|completeTurn/.test(entryJs));

const tlvSourceJs = readFileSync(join(root, "ai-workspace-tlv-source.js"), "utf8");
assert("tlv source has 8 templates", (tlvSourceJs.match(/label:/g) || []).length >= 8);
assert("tlv source free quota UI", /data-tlv-free-quota/.test(tlvSourceJs));

const server = await startDistServer();
const browser = await chromium.launch();
try {
  const studio = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await studio.goto(STUDIO_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await studio.waitForSelector("[data-tlv-tasful-ai-entry]", { timeout: 15000 });
  const studioHref = await studio.locator("[data-tlv-tasful-ai-entry]").first().getAttribute("href");
  assert("studio dashboard entry link", /ai-workspace\.html\?source=tlv/.test(studioHref || ""), studioHref || "");
  assert(
    "studio entry label",
    (await studio.locator("[data-tlv-tasful-ai-entry]").first().textContent())?.includes("TASFUL AI")
  );

  const upload = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await upload.goto(UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await upload.waitForSelector("[data-tlv-tasful-ai-entry]", { timeout: 15000, state: "attached" });
  const uploadHref = await upload.locator("[data-tlv-tasful-ai-entry]").first().getAttribute("href");
  assert("video upload entry link", /ai-workspace\.html\?source=tlv/.test(uploadHref || ""), uploadHref || "");

  const ws = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await ws.goto(WORKSPACE_TLV, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ws.waitForSelector("[data-tlv-ai-templates]", { timeout: 15000 });
  const templateCount = await ws.locator("[data-tlv-template]").count();
  assert("workspace tlv templates", templateCount >= 8, `count=${templateCount}`);
  assert("workspace free quota banner", Boolean(await ws.locator("[data-tlv-free-quota]").count()));
  assert("workspace tlv body class", await ws.evaluate(() => document.body.classList.contains("ai-workspace-page--tlv-source")));
  assert(
    "gateway unchanged",
    await ws.evaluate(() => typeof window.TasuAiModelGateway?.completeTurn === "function")
  );

  const chip = ws.locator("[data-tlv-template]").first();
  await chip.click();
  const filled = await ws.inputValue("[data-ai-chat-input]");
  assert("template fills composer", filled.length > 5, filled.slice(0, 40));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n--- Summary ---`);
const failed = results.filter((r) => !r.ok);
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
if (failed.length) process.exitCode = 1;
