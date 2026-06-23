#!/usr/bin/env node
/**
 * MATCH → TALK room bridge smoke
 *
 *   node scripts/smoke-match-talk-room.mjs
 *   node scripts/smoke-match-talk-room.mjs --base http://127.0.0.1:8788
 *   node scripts/smoke-match-talk-room.mjs --live --functions-base https://xxx.supabase.co/functions/v1
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const UI_PAGES = [
  { key: "list", file: "match/match-list.html", probe: "[data-match-talk-cta]" },
  { key: "talk-bridge", file: "match/match-talk-bridge.html", probe: "[data-match-talk-cta]" },
];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/match/match-list.html" : urlPath.replace(/^\//, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function checkClientStubApi() {
  const apiPath = path.join(ROOT, "match", "match-api.js");
  const wiringPath = path.join(ROOT, "match", "match-wiring.js");
  const apiSrc = fs.readFileSync(apiPath, "utf8");
  const wiringSrc = fs.readFileSync(wiringPath, "utf8");

  if (!apiSrc.includes('mode: "client_stub"') || !apiSrc.includes("ensureTalkRoom")) {
    fail("client_stub API", "ensureTalkRoom / client_stub missing");
    return;
  }
  if (!wiringSrc.includes("talkRoomErrorMessage") || !wiringSrc.includes('apiMode === "client_stub"')) {
    fail("wiring stub guard", "talk room wiring missing stub/live split");
    return;
  }
  pass("client_stub API + wiring", "ensureTalkRoom default stub preserved");
}

async function runUiSmoke(baseUrl) {
  for (const vp of MATCH_UI_VIEWPORTS) {
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: matchViewportSize(vp) });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));

      for (const spec of UI_PAGES) {
        const url = `${baseUrl}/${spec.file}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(spec.probe, { timeout: 8000 });
        const label = await page.locator(spec.probe).first().textContent();
        if (!label || !/メッセージする/.test(label)) {
          fail(`UI label ${spec.key} @${vp.label}`, `expected メッセージする got ${label}`);
        } else {
          pass(`UI label ${spec.key} @${vp.label}`, label.trim());
        }
        await assertMatchNoHorizontalOverflow(page, spec.key, vp);
        if (errors.length) {
          fail(`console ${spec.key} @${vp.label}`, errors.join("; "));
        } else {
          pass(`console ${spec.key} @${vp.label}`, "0 errors");
        }
      }
      await page.close();
    });
  }

  for (const wide of [
    { width: 768, height: 1024, label: "768×1024" },
    { width: 1280, height: 900, label: "1280×900" },
  ]) {
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: { width: wide.width, height: wide.height } });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      for (const spec of UI_PAGES) {
        await page.goto(`${baseUrl}/${spec.file}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(spec.probe, { timeout: 8000 });
        await assertMatchNoHorizontalOverflow(page, spec.key, wide);
      }
      if (errors.length) {
        fail(`console wide @${wide.label}`, errors.join("; "));
      } else {
        pass(`console wide @${wide.label}`, "0 errors");
      }
      await page.close();
    });
  }
}

async function runLiveEdgeSmoke(functionsBase) {
  const base = functionsBase.replace(/\/$/, "");
  const url = `${base}/match-ensure-talk-room`;

  async function post(body, token, extra = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || "invalid"}`,
        ...extra,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  const stub = await post({ pair_id: "00000000-0000-4000-8000-000000000001" }, "stub-match-token");
  if (stub.status === 200 && stub.json.ok && stub.json.mode === "stub") {
    pass("live edge stub token", "mode=stub");
  } else {
    fail("live edge stub token", JSON.stringify(stub));
  }

  const noAuth = await post({ pair_id: "00000000-0000-4000-8000-000000000001" }, "");
  if (noAuth.status === 401) {
    pass("live edge anon", "401");
  } else {
    fail("live edge anon", `status ${noAuth.status}`);
  }
}

async function main() {
  const baseArg = parseArg("--base");
  const live = process.argv.includes("--live");
  const functionsBase = parseArg("--functions-base") || process.env.MATCH_FUNCTIONS_BASE;

  console.log("smoke-match-talk-room\n");

  await checkClientStubApi();

  let server;
  let baseUrl = baseArg;
  if (!baseUrl) {
    const port = 8792;
    server = await startStaticServer(ROOT, port);
    baseUrl = `http://127.0.0.1:${port}`;
  }

  try {
    await runUiSmoke(baseUrl);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await closeAllBrowsers();
  }

  if (live && functionsBase) {
    await runLiveEdgeSmoke(functionsBase);
  } else {
    pass("live edge", "skipped (use --live --functions-base URL)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSmoke result: ${failed.length ? "FAIL" : "PASS"} (${results.length} checks)`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
