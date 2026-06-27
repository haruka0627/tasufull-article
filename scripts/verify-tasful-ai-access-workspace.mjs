#!/usr/bin/env node
/**
 * Cloudflare Access 配下の ai-workspace MIME / routing 確認
 *   node --env-file=.env scripts/verify-tasful-ai-access-workspace.mjs
 *
 * Env (optional): CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
 *   PAGES_BASE_URL (default: https://tasufull-article.pages.dev)
 *
 * Service Token headers (Cloudflare docs):
 *   CF-Access-Client-Id
 *   CF-Access-Client-Secret
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { isCloudflareAccessLoginPage } from "./lib/smoke-access-detect.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.PAGES_BASE_URL || "https://tasufull-article.pages.dev").replace(/\/$/, "");

const ACCESS_HEADER_ID = "CF-Access-Client-Id";
const ACCESS_HEADER_SECRET = "CF-Access-Client-Secret";

const ASSETS = [
  { path: "/ai-workspace.html", expectMime: /text\/html/i, expectWorkspace: true },
  { path: "/ai-workspace-chat.js", expectMime: /javascript|ecmascript/i, expectWorkspace: false },
  { path: "/ai-model-gateway.js", expectMime: /javascript|ecmascript/i, expectWorkspace: false },
  { path: "/tasful-ai-voice.css", expectMime: /css/i, expectWorkspace: false },
];

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function normalizeAccessEnv(value) {
  let v = String(value ?? "").trim().replace(/[\r\n]+/g, "");
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function buildServiceTokenHeaders() {
  const accessId = normalizeAccessEnv(process.env.CF_ACCESS_CLIENT_ID);
  const accessSecret = normalizeAccessEnv(process.env.CF_ACCESS_CLIENT_SECRET);
  if (!accessId || !accessSecret) return null;
  if (/^(true|false|null|undefined)$/i.test(accessId) || /^(true|false|null|undefined)$/i.test(accessSecret)) {
    return null;
  }
  return {
    [ACCESS_HEADER_ID]: accessId,
    [ACCESS_HEADER_SECRET]: accessSecret,
  };
}

function decodeAccessLoginMeta(location) {
  try {
    const u = new URL(location);
    const meta = u.searchParams.get("meta");
    if (!meta) return null;
    const payload = meta.split(".")[1];
    if (!payload) return null;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function isAccessLoginRedirect(status, location) {
  return (
    (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
    /cloudflareaccess\.com|cdn-cgi\/access\/login/i.test(String(location || ""))
  );
}

function serviceTokenRejectDetail(meta) {
  if (meta?.service_token_status === false) {
    return "Cloudflare rejected Service Token (service_token_status=false — policy Action must be Service Auth; Include must match this token)";
  }
  if (meta?.auth_status === "NONE") {
    return "Access login redirect (auth_status=NONE)";
  }
  return "redirect to Cloudflare Access login";
}

function looksLikeAccessBody(body, url = "") {
  return isCloudflareAccessLoginPage({ body, url }) || /Cloudflare Access/i.test(String(body || "").slice(0, 800));
}

function looksLikeWorkspaceHtml(body) {
  // Static HTML markers only (TasuAiChat / TasuAiModelGateway are JS globals — not in fetched HTML).
  return /data-ai-workspace-chat|data-ai-workspace-categories|data-ai-chat-input|data-ai-composer-frame/i.test(
    String(body || "")
  );
}

async function fetchAsset(path, accessHeaders = null) {
  const url = `${BASE}${path}`;
  const headers = accessHeaders ? { ...accessHeaders } : {};

  const manual = await fetch(url, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });

  const location = manual.headers.get("location") || "";
  if (accessHeaders && isAccessLoginRedirect(manual.status, location)) {
    const meta = decodeAccessLoginMeta(location);
    return {
      status: manual.status,
      ct: "",
      isAccess: true,
      serviceTokenRejected: meta?.service_token_status === false,
      detail: serviceTokenRejectDetail(meta),
      url,
    };
  }

  const res =
    manual.status >= 300 && manual.status < 400
      ? await fetch(url, { method: "GET", headers, redirect: "follow", signal: AbortSignal.timeout(30000) })
      : manual;

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  const bodySample = text.slice(0, 8192);
  const finalUrl = res.url || url;
  return {
    status: res.status,
    ct,
    isAccess: looksLikeAccessBody(bodySample, finalUrl),
    isWorkspace: looksLikeWorkspaceHtml(text),
    detail: "",
    url: finalUrl,
  };
}

async function main() {
  const accessHeaders = buildServiceTokenHeaders();

  console.log(`Base: ${BASE}`);
  console.log(`Service token: ${accessHeaders ? "configured" : "NOT configured"}`);
  if (accessHeaders) {
    console.log(`Auth headers: ${ACCESS_HEADER_ID}, ${ACCESS_HEADER_SECRET}\n`);
  } else {
    console.log("");
  }

  // Unauthenticated baseline (Access-protected host → login HTML; open preview → real assets)
  {
    const r = await fetchAsset("/ai-workspace.html");
    if (r.isAccess) {
      record("Unauthenticated — Access gate active", true, "Cloudflare Access login HTML");
    } else {
      record("Unauthenticated — direct asset access", r.status >= 200 && r.status < 400, `status=${r.status} ct=${r.ct}`);
    }
  }

  if (!accessHeaders) {
    const jsProbe = await fetchAsset("/ai-workspace-chat.js");
    const mimeOk = /javascript|ecmascript/i.test(jsProbe.ct) && !jsProbe.isAccess;
    if (mimeOk) {
      for (const asset of ASSETS) {
        const r = await fetchAsset(asset.path);
        const ok = asset.expectMime.test(r.ct) && !r.isAccess && r.status >= 200 && r.status < 400;
        record(`MIME ${asset.path}`, ok, `status=${r.status} ct=${r.ct}`);
      }
      await runBrowserChecks(null);
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
    const r = await fetchAsset(asset.path, accessHeaders);
    const mimeOk = asset.expectMime.test(r.ct);
    const workspaceOk = !asset.expectWorkspace || r.isWorkspace;
    const ok =
      !r.isAccess &&
      !r.serviceTokenRejected &&
      r.status >= 200 &&
      r.status < 400 &&
      mimeOk &&
      workspaceOk;
    let detail = r.detail || `status=${r.status} ct=${r.ct}`;
    if (r.isAccess && !r.detail) detail += " (still Access page)";
    if (asset.expectWorkspace && !r.isWorkspace && !r.isAccess) detail += " (ai-workspace markers missing)";
    record(`MIME ${asset.path}`, ok, detail);
  }

  await runBrowserChecks(accessHeaders);
  writeReport({
    accessHeaders: true,
    serviceTokenFailed: results.some((r) => !r.ok && /Service Token|Access login/i.test(r.detail)),
  });
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

async function runBrowserChecks(accessHeaders) {
  await withPlaywrightBrowser(async (browser) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: accessHeaders || undefined,
      viewport: { width: 390, height: 900 },
    });
    const page = await ctx.newPage();

    if (accessHeaders) {
      await page.route("**/*", async (route) => {
        const reqHeaders = route.request().headers();
        await route.continue({
          headers: {
            ...reqHeaders,
            [ACCESS_HEADER_ID]: accessHeaders[ACCESS_HEADER_ID],
            [ACCESS_HEADER_SECRET]: accessHeaders[ACCESS_HEADER_SECRET],
          },
        });
      });
    }

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !/favicon/i.test(msg.text())) consoleErrors.push(msg.text().slice(0, 160));
    });

    const res = await page.goto(`${BASE}/ai-workspace.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const finalUrl = page.url();
    const html = await page.content();

    if (/cloudflareaccess\.com|cdn-cgi\/access\/login/i.test(finalUrl)) {
      const meta = decodeAccessLoginMeta(finalUrl);
      record(
        "Workspace HTML load",
        false,
        serviceTokenRejectDetail(meta) || "redirected to Cloudflare Access login"
      );
      return;
    }

    if (looksLikeAccessBody(html, finalUrl)) {
      record("Workspace HTML load", false, "Cloudflare Access login HTML — Service Token or OTP required");
      return;
    }

    if (!looksLikeWorkspaceHtml(html)) {
      record("Workspace HTML load", false, "ai-workspace markers missing (not authenticated app HTML)");
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
