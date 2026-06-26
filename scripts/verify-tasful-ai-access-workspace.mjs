#!/usr/bin/env node
/**
 * Cloudflare Access 配下の ai-workspace MIME / routing 確認
 *   node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
 *
 * Env (optional): CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
 *   PAGES_BASE_URL (default: https://tasufull-article.pages.dev)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { isCloudflareAccessLoginPage } from "./lib/smoke-access-detect.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.PAGES_BASE_URL || "https://tasufull-article.pages.dev").replace(/\/$/, "");

const ASSETS = [
  { path: "/ai-workspace.html", expectMime: /text\/html/i },
  { path: "/ai-workspace-chat.js", expectMime: /javascript|ecmascript/i },
  { path: "/ai-model-gateway.js", expectMime: /javascript|ecmascript/i },
  { path: "/tasful-ai-voice.css", expectMime: /css/i },
];

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchHead(path, headers = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { method: "GET", headers, redirect: "follow", signal: AbortSignal.timeout(30000) });
  const ct = res.headers.get("content-type") || "";
  const text = (await res.text()).slice(0, 120);
  return { url, status: res.status, ct, isAccess: isCloudflareAccessLoginPage(text) || /Cloudflare Access/i.test(text) };
}

async function main() {
  const accessId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
  const accessHeaders =
    accessId && accessSecret
      ? { "CF-Access-Client-Id": accessId, "CF-Access-Client-Secret": accessSecret }
      : null;

  console.log(`Base: ${BASE}`);
  console.log(`Service token: ${accessHeaders ? "configured" : "NOT configured"}\n`);

  const probeHeaders = accessHeaders || {};

  // Unauthenticated baseline (Access-protected host → login HTML; open preview → real assets)
  {
    const r = await fetchHead("/ai-workspace.html");
    if (r.isAccess) {
      record("Unauthenticated — Access gate active", true, "Cloudflare Access login HTML");
    } else {
      record("Unauthenticated — direct asset access", r.status >= 200 && r.status < 400, `ct=${r.ct}`);
    }
  }

  if (!accessHeaders) {
    const jsProbe = await fetchHead("/ai-workspace-chat.js");
    const mimeOk = /javascript|ecmascript/i.test(jsProbe.ct) && !jsProbe.isAccess;
    if (mimeOk) {
      for (const asset of ASSETS) {
        const r = await fetchHead(asset.path);
        const ok = asset.expectMime.test(r.ct) && !r.isAccess && r.status >= 200 && r.status < 400;
        record(`MIME ${asset.path}`, ok, `status=${r.status} ct=${r.ct}`);
      }
      await runBrowserChecks({});
      writeReport({ accessHeaders: false, accessBypass: "preview-or-public" });
      if (results.some((x) => !x.ok)) process.exitCode = 1;
      return;
    }
    record(
      "Authenticated MIME/routing",
      false,
      "CF_ACCESS_CLIENT_ID/SECRET not set — set Service Token for Access-protected host"
    );
    writeReport({ accessHeaders: false });
    process.exitCode = 1;
    return;
  }

  for (const asset of ASSETS) {
    const r = await fetchHead(asset.path, probeHeaders);
    const mimeOk = asset.expectMime.test(r.ct);
    record(
      `MIME ${asset.path}`,
      r.status >= 200 && r.status < 400 && mimeOk && !r.isAccess,
      `status=${r.status} ct=${r.ct}${r.isAccess ? " (still Access page)" : ""}`
    );
  }

  await runBrowserChecks(probeHeaders);
  writeReport({ accessHeaders: true, serviceTokenFailed: false });
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

async function runBrowserChecks(extraHeaders) {
  await withPlaywrightBrowser(async (browser) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: Object.keys(extraHeaders).length ? extraHeaders : undefined,
      viewport: { width: 390, height: 900 },
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !/favicon/i.test(msg.text())) consoleErrors.push(msg.text().slice(0, 160));
    });

    const res = await page.goto(`${BASE}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const html = await page.content();
    if (isCloudflareAccessLoginPage(html)) {
      record("Workspace HTML load", false, "Cloudflare Access login — Service Token or OTP required");
      return;
    }

    record("Workspace HTML load", (res?.status() || 0) < 400, `status=${res?.status()}`);
    await page
      .waitForFunction(
        () => window.TasuAiChat?.sendMessage && document.querySelector("[data-ai-chat-input]"),
        null,
        { timeout: 25000 }
      )
      .then(() => record("Composer + Gateway loaded", true))
      .catch(() => record("Composer + Gateway loaded", false, "timeout"));

    const layout = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      modelBar: Boolean(document.querySelector("[data-ai-model-bar]")),
    }));
    record(
      "390px layout",
      layout.scrollW <= layout.clientW + 2 && layout.modelBar,
      `scroll=${layout.scrollW} modelBar=${layout.modelBar}`
    );
    record("Console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | ") || "none");
  });
}

function writeReport(extra) {
  const out = join(root, "reports", "tasful-ai-access-workspace-check.json");
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, results, ...extra }, null, 2)
  );
  console.log(`\nWrote ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeAllBrowsers());
