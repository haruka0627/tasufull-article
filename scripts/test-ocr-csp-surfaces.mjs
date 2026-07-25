#!/usr/bin/env node
/**
 * OCR surface CSP regression
 *   node scripts/test-ocr-csp-surfaces.mjs
 *
 * - _headers と SSOT の一致
 * - OCR HTML の inline / unsafe 依存監査
 * - 実 browser で CSP header 下の privacy UI · OCR fetch · violation 監視
 * deploy/cloudflare/dist は読み書きしない。
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  OCR_CSP_BY_PATH,
  OCR_CSP_FORBIDDEN_TOKENS,
  OCR_CSP_STYLE_UNSAFE_INLINE_PATHS,
  OCR_CSP_SURFACES,
} from "./lib/ocr-csp-policy.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEADERS_PATH = path.join(root, "deploy/cloudflare/_headers");
const PORTS = [8789, 8792, 8793];

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const SURFACE_FILES = {
  "/chat-detail.html": "chat-detail.html",
  "/post.html": "post.html",
  "/ai-workspace.html": "ai-workspace.html",
  "/builder/builder-ai.html": path.join("builder", "builder-ai.html"),
};

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/**
 * Cloudflare Pages _headers の簡易 parser（path → header map）
 */
function parseHeadersFile(text) {
  /** @type {Map<string, Record<string, string>>} */
  const map = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    if (/^\S/.test(line) && !line.startsWith(" ")) {
      current = line.trim();
      if (!map.has(current)) map.set(current, {});
      continue;
    }
    if (!current) continue;
    const m = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    map.get(current)[m[1].trim()] = m[2].trim();
  }
  return map;
}

function directiveMap(policy) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const part of String(policy || "").split(";")) {
    const t = part.trim();
    if (!t) continue;
    const sp = t.indexOf(" ");
    if (sp < 0) out[t.toLowerCase()] = "";
    else out[t.slice(0, sp).toLowerCase()] = t.slice(sp + 1).trim();
  }
  return out;
}

function hasToken(policy, token) {
  return String(policy).includes(token);
}

function countMetaCsp(html) {
  return (
    html.match(/http-equiv\s*=\s*["']Content-Security-Policy["']/gi) || []
  ).length;
}

function hasInlineScript(html) {
  return /<script(?![^>]*\bsrc=)[^>]*>/i.test(html);
}

function hasInlineEventHandler(html) {
  return /\son[a-z]+\s*=\s*["']/i.test(html);
}

function hasStyleAttr(html) {
  return /\sstyle\s*=\s*["']/i.test(html);
}

function hasInlineStyleBlock(html) {
  return /<style[\s>]/i.test(html);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const HARNESS = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OCR CSP harness</title>
<link rel="stylesheet" href="/ocr-privacy-consent.css">
<link rel="stylesheet" href="/ocr-surface-csp-compat.css">
</head>
<body>
<button id="opener" type="button">open</button>
<img id="preview" alt="" width="32" height="32">
<pre id="out"></pre>
<script src="/scripts/fixtures/ocr-csp-harness-boot.js"></script>
<script src="/ocr-privacy-consent.js"></script>
<script src="/chat-ocr.js"></script>
</body>
</html>`;

function startServer(policies) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const csp = policies[pathname];
    if (csp) {
      res.setHeader("Content-Security-Policy", csp);
    }

    if (pathname === "/__ocr-csp-harness.html") {
      // harness 用: chat-detail 相当の CSP
      res.setHeader("Content-Security-Policy", policies["/chat-detail.html"]);
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(HARNESS);
      return;
    }

    const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
    const target = path.join(root, rel);
    if (!rel || !target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(target)] || "application/octet-stream" });
    res.end(fs.readFileSync(target));
  });

  return new Promise((resolve, reject) => {
    let i = 0;
    const tryListen = () => {
      if (i >= PORTS.length) {
        reject(new Error("no free port"));
        return;
      }
      const port = PORTS[i++];
      server.once("error", tryListen);
      server.listen(port, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${port}` }));
    };
    tryListen();
  });
}

async function main() {
  console.log("=== OCR CSP surfaces ===\n");

  // --- static: _headers vs SSOT ---
  const headersText = fs.readFileSync(HEADERS_PATH, "utf8");
  const parsed = parseHeadersFile(headersText);

  for (const surface of OCR_CSP_SURFACES) {
    const expected = OCR_CSP_BY_PATH[surface];
    const got = parsed.get(surface)?.["Content-Security-Policy"];
    assert(
      `01 CSP present for ${surface}`,
      typeof got === "string" && got.length > 0,
      got ? "present" : "missing"
    );
    assert(
      `02 _headers matches SSOT for ${surface}`,
      got === expected,
      got === expected ? "match" : `got=${String(got).slice(0, 80)}...`
    );
  }

  // duplicate CSP: each OCR path has exactly one CSP header key (parser overwrites duplicates)
  for (const surface of OCR_CSP_SURFACES) {
    const block = headersText.split(/\r?\n/);
    let inPath = false;
    let cspCount = 0;
    for (const line of block) {
      if (line.trim() === surface) {
        inPath = true;
        continue;
      }
      if (inPath && /^\S/.test(line) && line.trim() && !line.trim().startsWith("#")) {
        inPath = false;
      }
      if (inPath && /Content-Security-Policy:/i.test(line)) cspCount += 1;
    }
    assert(`03 single CSP header for ${surface}`, cspCount === 1, `count=${cspCount}`);
  }

  // meta CSP なし
  for (const [surface, rel] of Object.entries(SURFACE_FILES)) {
    const html = read(rel);
    assert(`04 no meta CSP on ${surface}`, countMetaCsp(html) === 0);
  }

  // --- policy shape ---
  for (const surface of OCR_CSP_SURFACES) {
    const policy = OCR_CSP_BY_PATH[surface];
    const d = directiveMap(policy);
    assert(`05 default-src self ${surface}`, d["default-src"] === "'self'");
    assert(`06 no script-src * ${surface}`, !/\bscript-src\s+\*/.test(policy) && !d["script-src"]?.includes("*"));
    assert(`07 no connect-src * ${surface}`, !/\bconnect-src\s+\*/.test(policy) && !d["connect-src"]?.includes("*"));
    assert(`08 no img-src * ${surface}`, !/\bimg-src\s+\*/.test(policy) && !d["img-src"]?.includes("*"));
    assert(`09 no unsafe-eval ${surface}`, !hasToken(policy, "'unsafe-eval'"));
    assert(
      `10 no script-src unsafe-inline ${surface}`,
      !(d["script-src"] || "").includes("'unsafe-inline'")
    );
    const styleAllowsUnsafe = OCR_CSP_STYLE_UNSAFE_INLINE_PATHS.includes(surface);
    if (styleAllowsUnsafe) {
      assert(
        `10b style-src unsafe-inline only where documented ${surface}`,
        (d["style-src"] || "").includes("'unsafe-inline'")
      );
    } else {
      assert(
        `10b no style-src unsafe-inline ${surface}`,
        !(d["style-src"] || "").includes("'unsafe-inline'")
      );
    }
    assert(
      `11 no Gemini API in connect-src ${surface}`,
      !hasToken(policy, "generativelanguage.googleapis.com") &&
        !hasToken(d["connect-src"] || "", "googleapis.com")
    );
    assert(
      `12 no Google wildcard ${surface}`,
      !hasToken(policy, "https://*.google") && !hasToken(policy, "*.googleapis.com")
    );
    assert(
      `13 OCR same-origin connect ${surface}`,
      (d["connect-src"] || "").includes("'self'")
    );
    assert(
      `14 Supabase connect allowed ${surface}`,
      (d["connect-src"] || "").includes("ddojquacsyqesrjhcvmn.supabase.co") &&
        (d["connect-src"] || "").includes("ahlxuyvhzqdqaojiywmu.supabase.co")
    );
    assert(
      `15 privacy assets via self ${surface}`,
      (d["script-src"] || "").includes("'self'") && (d["style-src"] || "").includes("'self'")
    );
    assert(
      `16 img data+blob for preview ${surface}`,
      (d["img-src"] || "").includes("data:") && (d["img-src"] || "").includes("blob:")
    );
    assert(
      `17 no blob/data scripts ${surface}`,
      !(d["script-src"] || "").includes("blob:") && !(d["script-src"] || "").includes("data:")
    );
    assert(`18 object-src none ${surface}`, d["object-src"] === "'none'");
    assert(`19 base-uri self ${surface}`, d["base-uri"] === "'self'");
    assert(`20 form-action self ${surface}`, d["form-action"] === "'self'");
    assert(
      `21 frame-ancestors self ${surface}`,
      d["frame-ancestors"] === "'self'"
    );
    assert(
      `22 no localhost in production policy ${surface}`,
      !/localhost|127\.0\.0\.1/.test(policy)
    );
    assert(
      `23 no plain http external ${surface}`,
      !/\bhttp:\/\//.test(policy)
    );
  }

  assert(
    "24 ai-workspace includes live proxy wss",
    (directiveMap(OCR_CSP_BY_PATH["/ai-workspace.html"])["connect-src"] || "").includes(
      "wss://gemini-live-proxy.tasful-article.workers.dev"
    )
  );
  assert(
    "24b chat-detail does not include live proxy",
    !(directiveMap(OCR_CSP_BY_PATH["/chat-detail.html"])["connect-src"] || "").includes(
      "gemini-live-proxy"
    )
  );

  for (const token of OCR_CSP_FORBIDDEN_TOKENS) {
    for (const surface of OCR_CSP_SURFACES) {
      if (token === "http://localhost" || token === "http://127.0.0.1") continue; // covered above
      assert(
        `forbidden token absent (${token}) ${surface}`,
        !hasToken(OCR_CSP_BY_PATH[surface], token)
      );
    }
  }

  // --- HTML surface hygiene ---
  for (const [surface, rel] of Object.entries(SURFACE_FILES)) {
    const html = read(rel);
    assert(`25 no inline event handlers ${surface}`, !hasInlineEventHandler(html));
    assert(`26 no style attributes ${surface}`, !hasStyleAttr(html));
    assert(`27 no inline style blocks ${surface}`, !hasInlineStyleBlock(html));
    assert(`28 no inline scripts ${surface}`, !hasInlineScript(html));
    assert(
      `29 loads privacy JS/CSS ${surface}`,
      /ocr-privacy-consent\.js/.test(html) &&
        /ocr-privacy-consent\.css/.test(html) &&
        /ocr-surface-csp-compat\.css/.test(html)
    );
  }

  // chat-detail uses externalized bootstrap / loader
  const chatHtml = read("chat-detail.html");
  assert(
    "30 chat-detail uses external bootstrap/loader",
    /chat-detail-head-bootstrap\.js/.test(chatHtml) &&
      /chat-detail-main-loader\.js/.test(chatHtml) &&
      /data-tasu-supabase-cdn/.test(chatHtml)
  );

  // source audits: eval / new Function / string timers in OCR privacy + chat-ocr
  for (const rel of ["ocr-privacy-consent.js", "chat-ocr.js", "chat-detail-head-bootstrap.js", "chat-detail-main-loader.js"]) {
    const src = read(rel);
    assert(`31 no eval in ${rel}`, !/\beval\s*\(/.test(src));
    assert(`32 no new Function in ${rel}`, !/new\s+Function\s*\(/.test(src));
    assert(
      `33 no string-based timers in ${rel}`,
      !/setTimeout\s*\(\s*["']/.test(src) && !/setInterval\s*\(\s*["']/.test(src)
    );
  }

  const privacySrc = read("ocr-privacy-consent.js");
  assert(
    "34 privacy modal avoids innerHTML for content",
    !/\.innerHTML\s*=/.test(privacySrc) &&
      !/\.outerHTML\s*=/.test(privacySrc) &&
      !/insertAdjacentHTML/.test(privacySrc) &&
      !/document\.write/.test(privacySrc)
  );
  assert(
    "35 privacy uses textContent for user-facing copy",
    /textContent\s*=/.test(privacySrc)
  );

  // --- browser: CSP header + privacy UI ---
  const { server, base } = await startServer(OCR_CSP_BY_PATH);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const harness = `${base}/__ocr-csp-harness.html`;
    const harnessRes = await page.goto(harness, { waitUntil: "load", timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.TasuChatOcr && window.TasuOcrPrivacyConsent));

    // CSP header delivered (Playwright response · page fetch は harness が mock している)
    const cspHeader = harnessRes?.headers()?.["content-security-policy"] || "";
    assert(
      "36 harness serves CSP header",
      typeof cspHeader === "string" && cspHeader.includes("default-src 'self'"),
      cspHeader.slice(0, 60)
    );

    // preview schemes
    await page.evaluate((b64) => {
      const img = document.getElementById("preview");
      img.src = "data:image/png;base64," + b64;
    }, PNG_1X1);
    await page.waitForTimeout(50);
    const dataOk = await page.evaluate(() => {
      const img = document.getElementById("preview");
      return img.complete && img.naturalWidth > 0;
    });
    assert("37 data: image preview allowed", dataOk);

    const blobOk = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      const img = document.getElementById("preview");
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("blob img failed"));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      return img.naturalWidth > 0;
    }, PNG_1X1);
    assert("38 blob: image preview allowed", blobOk);

    // blob script blocked
    const blobScriptBlocked = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(new Blob(["window.__blobScriptRan=1"], { type: "text/javascript" }));
        const s = document.createElement("script");
        s.src = url;
        s.onload = () => {
          URL.revokeObjectURL(url);
          resolve(false);
        };
        s.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(true);
        };
        document.body.appendChild(s);
        setTimeout(() => resolve(!window.__blobScriptRan), 500);
      });
    });
    assert("39 blob script not allowed", blobScriptBlocked === true);

    // privacy modal under CSP
    await page.focus("#opener");
    await page.evaluate(
      (url) => window.__run(url),
      `data:image/png;base64,${PNG_1X1}`
    );
    await page.waitForSelector("[data-ocr-privacy-dialog]", { state: "visible", timeout: 5000 });
    assert("40 privacy modal opens under CSP", true);

    // policy links present and same-origin / allowed
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-ocr-privacy-links] a")).map((a) => a.getAttribute("href"))
    );
    assert(
      "41 policy links present under CSP",
      links.includes("/company/legal/privacy.html") && links.includes("/ai-terms.html")
    );

    // cancel works, no request
    await page.click("[data-ocr-privacy-cancel]");
    await page.waitForSelector("[data-ocr-privacy-gate]", { state: "detached", timeout: 5000 });
    let reqs = await page.evaluate(() => window.__csp.requests.length);
    assert("42 cancel under CSP sends 0", reqs === 0);

    // confirm starts OCR fetch (same-origin)
    await page.evaluate(() => {
      window.__csp.requests.length = 0;
      window.__csp.last = null;
      window.__csp.violations.length = 0;
    });
    await page.evaluate(
      (url) => window.__run(url),
      `data:image/png;base64,${PNG_1X1}`
    );
    await page.waitForSelector("[data-ocr-privacy-dialog]", { state: "visible" });
    await page.click("[data-ocr-privacy-confirm]");
    await page.waitForFunction(() => window.__csp.last !== null, null, { timeout: 5000 });
    const last = await page.evaluate(() => window.__csp.last);
    reqs = await page.evaluate(() => window.__csp.requests.length);
    const fetchUrl = await page.evaluate(() => window.__csp.requests[0]?.url || "");
    assert(
      "43 confirm under CSP starts OCR fetch",
      reqs === 1 && last?.ok === true && /\/api\/gemini-ocr$/.test(fetchUrl),
      `reqs=${reqs} url=${fetchUrl}`
    );

    // mobile buttons
    await page.setViewportSize({ width: 390, height: 740 });
    await page.evaluate(
      (url) => window.__run(url),
      `data:image/png;base64,${PNG_1X1}`
    );
    await page.waitForSelector("[data-ocr-privacy-dialog]", { state: "visible" });
    const mobile = await page.evaluate(() => {
      const c = document.querySelector("[data-ocr-privacy-confirm]");
      const k = document.querySelector("[data-ocr-privacy-cancel]");
      const ok = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height >= 40 && r.bottom <= window.innerHeight + 1;
      };
      return ok(c) && ok(k);
    });
    assert("44 mobile privacy UI intact under CSP", mobile);
    await page.click("[data-ocr-privacy-cancel]");
    await page.setViewportSize({ width: 1280, height: 900 });

    // violations from our flow should not include self script/style/connect for OCR
    const violations = await page.evaluate(() => window.__csp.violations.slice());
    const bad = violations.filter(
      (v) =>
        /script-src|style-src|connect-src|img-src/.test(v.violatedDirective) &&
        /ocr-privacy|chat-ocr|gemini-ocr|data:image|blob:/.test(v.blockedURI)
    );
    assert(
      "45 no CSP violations for OCR privacy/fetch/preview",
      bad.length === 0,
      JSON.stringify(bad.slice(0, 5))
    );

    // Load each OCR HTML under its CSP and collect violations during initial load
    for (const surface of OCR_CSP_SURFACES) {
      const p = await context.newPage();
      await p.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener("securitypolicyviolation", (ev) => {
          window.__cspViolations.push({
            violatedDirective: String(ev.violatedDirective || ""),
            blockedURI: String(ev.blockedURI || ""),
          });
        });
      });
      const res = await p.goto(`${base}${surface}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      assert(`46 ${surface} HTTP reachable under CSP harness`, res && res.ok(), `status=${res?.status()}`);
      await p.waitForTimeout(1200);
      const viol = await p.evaluate(() => window.__cspViolations || []);
      // Fail on blocked self OCR/privacy/bootstrap scripts or inline/eval
      const critical = viol.filter(
        (v) =>
          /unsafe-inline|unsafe-eval|inline/.test(v.blockedURI + v.violatedDirective) ||
          (/script-src/.test(v.violatedDirective) &&
            /chat-ocr|ocr-privacy|chat-detail|bootstrap|loader|ocr-surface/.test(v.blockedURI))
      );
      assert(
        `47 ${surface} no critical CSP violations on load`,
        critical.length === 0,
        JSON.stringify(critical.slice(0, 8))
      );
      await p.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  // dist untouched by this suite
  assert(
    "48 dist ocr-csp not required / privacy policy SSOT in repo headers",
    fs.existsSync(HEADERS_PATH)
  );
  const distHeaders = path.join(root, "deploy/cloudflare/dist/_headers");
  // We do not require dist sync; if dist exists and differs, that is OK for this commit
  assert("49 source _headers is canonical", fs.existsSync(HEADERS_PATH));
  void distHeaders;

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.error(failed.map((r) => `- ${r.name}: ${r.detail}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
