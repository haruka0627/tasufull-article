#!/usr/bin/env node
/**
 * TASFUL AI Production Preflight — URL / Edge / secrets presence / MIME
 *   node scripts/test-tasful-ai-production-preflight.mjs
 *
 * Env:
 *   PAGES_BASE_URL — production/staging Pages base (default: https://tasufull-article.pages.dev)
 *   SKIP_BROWSER=1 — skip Playwright URL/console checks
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_BASE = (process.env.PAGES_BASE_URL || "https://tasufull-article.pages.dev").replace(/\/$/, "");
const SKIP_BROWSER = process.env.SKIP_BROWSER === "1";

/** @type {{ section: string, name: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, name, detail = "") {
  results.push({ section, name, ok: true, detail });
  console.log(`PASS [${section}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(section, name, detail = "") {
  results.push({ section, name, ok: false, detail });
  console.error(`FAIL [${section}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(section, name, cond, detail = "") {
  if (cond) pass(section, name, detail);
  else fail(section, name, detail);
}

function loadSupabaseConfig() {
  const text = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
  const url = text.match(/url:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, "") || "";
  const anonKey = text.match(/anonKey:\s*["']([^"']+)["']/)?.[1] || "";
  return { url, anonKey };
}

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const IMAGE_ATTACHMENT = {
  name: "preflight.png",
  mimeType: "image/png",
  kind: "image",
  base64: TINY_PNG_B64,
  sizeBytes: 68,
};

function inferSecretPresence(httpStatus, body) {
  const err = String(body?.error || body?.message || "").trim();
  const errLower = err.toLowerCase();
  if (/not configured|is not configured/i.test(err)) {
    return { present: false, note: "Edge returned not-configured (503)" };
  }
  if (httpStatus === 503 && /not configured/i.test(errLower)) {
    return { present: false, note: "503" };
  }
  if (httpStatus === 200 && (body?.reply || body?.ok === true || body?.results?.length)) {
    return { present: true, working: true, note: "200 OK" };
  }
  if (httpStatus === 429) {
    return { present: true, working: false, note: "429 rate limit (secret referenced)" };
  }
  if (httpStatus === 502 || httpStatus === 500) {
    return { present: true, working: false, note: `${httpStatus} upstream/server` };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return { present: "unknown", note: `${httpStatus} auth` };
  }
  return { present: "unknown", note: `HTTP ${httpStatus}${err ? `: ${err.slice(0, 80)}` : ""}` };
}

async function edgePost(config, edge, payload) {
  const endpoint = `${config.url}/functions/v1/${edge}`;
  const started = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json().catch(() => ({}));
    return {
      edge,
      httpStatus: res.status,
      data,
      elapsedMs: Date.now() - started,
      replyPreview: String(data?.reply || data?.message || "").slice(0, 120).replace(/\n/g, " "),
      hasReply: Boolean(data?.reply),
      ok: Boolean(data?.reply) || data?.ok === true,
      secret: inferSecretPresence(res.status, data),
    };
  } catch (err) {
    return {
      edge,
      httpStatus: 0,
      data: {},
      elapsedMs: Date.now() - started,
      replyPreview: "",
      hasReply: false,
      ok: false,
      secret: { present: "unknown", note: err instanceof Error ? err.message : String(err) },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkProductionUrls() {
  const assets = [
    { path: "/ai-workspace.html", expectMime: "text/html" },
    { path: "/ai-workspace-chat.js", expectMime: "javascript" },
    { path: "/ai-workspace-attachments.js", expectMime: "javascript" },
    { path: "/ai-model-gateway.js", expectMime: "javascript" },
    { path: "/ai-search-orchestrator.js", expectMime: "javascript" },
    { path: "/ai-workspace-voice.js", expectMime: "javascript" },
    { path: "/ai-generate-ui.js", expectMime: "javascript" },
    { path: "/tasful-ai-voice.css", expectMime: "css" },
    { path: "/gen-ai-workspace.html", expectMime: "text/html" },
  ];

  for (const asset of assets) {
    const url = `${PAGES_BASE}${asset.path}`;
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
      const ct = String(res.headers.get("content-type") || "").toLowerCase();
      const mimeOk =
        asset.expectMime === "javascript"
          ? ct.includes("javascript") || ct.includes("ecmascript")
          : ct.includes(asset.expectMime);
      assert("url", `${asset.path} HTTP`, res.status >= 200 && res.status < 400, `status=${res.status}`);
      assert("mime", `${asset.path} Content-Type`, mimeOk, ct || "(empty)");
    } catch (err) {
      fail("url", asset.path, err instanceof Error ? err.message : String(err));
    }
  }
}

async function checkLocalStagingDist() {
  const distRoot = join(root, "deploy/cloudflare/dist");
  const required = [
    "ai-workspace.html",
    "ai-workspace-chat.js",
    "ai-model-gateway.js",
    "gen-ai-workspace.html",
  ];
  for (const rel of required) {
    const full = join(distRoot, rel);
    assert("staging", `dist/${rel}`, existsSync(full), existsSync(full) ? "exists" : "missing");
  }
}

async function probeLiveEdge(config) {
  const textPayload = {
    message: "preflight ping（1語で応答）",
    history: [],
    mode: "cross-matching",
    intent: "work",
  };

  const visionPayload = {
    message: "添付画像について1語で説明してください",
    history: [],
    mode: "cross-matching",
    intent: "work",
    attachments: [IMAGE_ATTACHMENT],
  };

  const probes = [
    { name: "Gemini text", edge: "gemini-chat", payload: textPayload, secretKey: "GEMINI_API_KEY" },
    { name: "OpenAI text", edge: "openai-chat", payload: textPayload, secretKey: "OPENAI_API_KEY" },
    { name: "Claude text", edge: "claude-chat", payload: textPayload, secretKey: "ANTHROPIC_API_KEY" },
    {
      name: "Serper search",
      edge: "serper-search",
      payload: { query: "TASFUL AI preflight", num: 3 },
      secretKey: "SERPER_API_KEY",
      okFn: (r) => r.data?.ok === true,
    },
    { name: "Gemini Vision", edge: "gemini-chat", payload: visionPayload, secretKey: "GEMINI_API_KEY" },
    { name: "OpenAI Vision", edge: "openai-chat", payload: visionPayload, secretKey: "OPENAI_API_KEY" },
    { name: "Claude Vision", edge: "claude-chat", payload: visionPayload, secretKey: "ANTHROPIC_API_KEY" },
  ];

  /** @type {Record<string, { present: boolean|string, working?: boolean, note: string }>} */
  const secretSummary = {};

  for (const probe of probes) {
    const result = await edgePost(config, probe.edge, probe.payload);
    const ok = probe.okFn ? probe.okFn(result) : result.hasReply;
    assert(
      "edge",
      probe.name,
      ok || result.secret?.present === true,
      `HTTP ${result.httpStatus}, secret=${JSON.stringify(result.secret?.note || "")}${result.replyPreview ? `, preview=${result.replyPreview.slice(0, 60)}` : ""}`
    );

    const prev = secretSummary[probe.secretKey];
    const present = result.secret?.present;
    if (!prev || present === true) {
      secretSummary[probe.secretKey] = {
        present: present === true ? true : present === false ? false : "unknown",
        working: ok,
        note: result.secret?.note || "",
      };
    }
  }

  for (const [key, info] of Object.entries(secretSummary)) {
    const label =
      info.present === true
        ? "present (value not logged)"
        : info.present === false
          ? "MISSING (not configured on Edge)"
          : "unknown";
    assert("secret", key, info.present !== false, label + (info.note ? ` — ${info.note}` : ""));
  }

  return secretSummary;
}

async function checkBrowserConsole() {
  if (SKIP_BROWSER) {
    pass("browser", "skipped", "SKIP_BROWSER=1");
    return { consoleErrors: [], layoutOk: true };
  }

  const url = `${PAGES_BASE}/ai-workspace.html`;
  /** @type {string[]} */
  const consoleErrors = [];

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (!/favicon|404.*\.map/i.test(t)) consoleErrors.push(t.slice(0, 200));
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(String(err?.message || err).slice(0, 200));
    });

    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert("browser", "ai-workspace.html loads", (res?.status() || 0) < 400, `status=${res?.status()}`);

    await page.waitForFunction(
      () => window.TasuAiChat?.sendMessage && window.TasuAiModelGateway?.completeTurn,
      null,
      { timeout: 25000 }
    ).catch(() => {});

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        hasInput: Boolean(document.querySelector("[data-ai-chat-input]")),
        hasSend: Boolean(document.querySelector("[data-ai-chat-send]")),
        hasModelBar: Boolean(document.querySelector("[data-ai-model-bar]")),
      };
    });

    assert(
      "browser",
      "390px no horizontal overflow",
      layout.scrollW <= layout.clientW + 2,
      `scroll=${layout.scrollW} client=${layout.clientW}`
    );
    assert("browser", "composer visible", layout.hasInput && layout.hasSend);
    assert("browser", "model bar visible", layout.hasModelBar);
    assert("browser", "console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ") || "none");
  });

  return { consoleErrors, layoutOk: consoleErrors.length === 0 };
}

async function main() {
  console.log(`\n=== TASFUL AI Production Preflight ===`);
  console.log(`Pages base: ${PAGES_BASE}`);
  console.log(`Edge base: ${loadSupabaseConfig().url}/functions/v1\n`);

  await checkProductionUrls();
  await checkLocalStagingDist();

  const config = loadSupabaseConfig();
  if (!config.url || !config.anonKey) {
    fail("config", "chat-supabase-config.js", "url or anonKey missing");
  } else {
    pass("config", "Supabase config loaded", config.url.replace(/https:\/\//, ""));
    await probeLiveEdge(config);
  }

  await checkBrowserConsole();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Summary ---`);
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);

  const outPath = join(root, "reports", "tasful-ai-production-preflight-probe.json");
  try {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(root, "reports"), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          pagesBase: PAGES_BASE,
          edgeBase: config.url,
          results,
          failed: failed.map((f) => ({ section: f.section, name: f.name, detail: f.detail })),
        },
        null,
        2
      )
    );
    console.log(`Probe JSON: ${outPath}`);
  } catch {
    /* ignore */
  }

  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAllBrowsers());
