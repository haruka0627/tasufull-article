#!/usr/bin/env node
/**
 * TLV Production Ready audit (read-only)
 *   node scripts/audit-tlv-production-ready.mjs
 *   node scripts/audit-tlv-production-ready.mjs --base https://tasufull-article.pages.dev
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROD_BASE = (process.argv.find((a) => a.startsWith("--base="))?.split("=")[1]
  || process.env.TLV_PROD_BASE
  || "https://tasufull-article.pages.dev").replace(/\/$/, "");
const LIVE = `${PROD_BASE}/live`;
const WIDTHS = [390, 1280];
const OUT = path.join(ROOT, "scripts", "tmp-tlv-production-ready");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: "videos", file: "videos.html", query: "" },
  { id: "watch-video", file: "watch-video.html", query: "" },
  { id: "watch-live", file: "watch-live.html", query: "" },
  { id: "shorts", file: "shorts.html", query: "" },
  { id: "profile", file: "profile.html", query: "" },
  { id: "notifications", file: "notifications.html", query: "" },
  { id: "creator-dashboard", file: "creator-dashboard.html", query: "" },
  { id: "analytics", file: "analytics.html", query: "" },
  { id: "channel-content", file: "channel-content.html", query: "" },
  { id: "video-upload", file: "video-upload.html", query: "" },
  { id: "my-videos", file: "my-videos.html", query: "" },
];

const BENIGN_CONSOLE = [
  { re: /Failed to load resource.*\b(401|403|404)\b/, reason: "guest/unauth or optional asset" },
  { re: /the server responded with a status of (401|403|404)/, reason: "guest API response" },
];

function classifyConsole(text) {
  for (const { re, reason } of BENIGN_CONSOLE) {
    if (re.test(text)) return { harmful: false, reason };
  }
  return { harmful: true, reason: null };
}

function scanDist() {
  const distRoot = path.join(ROOT, "deploy", "cloudflare", "dist");
  const hits = [];
  const patterns = [
    { id: "localhost", re: /localhost|127\.0\.0\.1/ },
    { id: "talkDev-hardcoded", re: /talkDev=1/ },
    { id: "system-notify-dev", re: /system-notify-dev/ },
    { id: "console-debug", re: /console\.(debug|log)\(/ },
    { id: "debugger", re: /\bdebugger\b/ },
  ];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".wrangler") continue;
        walk(p);
        continue;
      }
      if (!/\.(html|js|css|json)$/.test(ent.name)) continue;
      const rel = path.relative(distRoot, p).replace(/\\/g, "/");
      if (!rel.startsWith("live/") && rel !== "chat-supabase-config.js") continue;
      const text = fs.readFileSync(p, "utf8");
      for (const { id, re } of patterns) {
        if (!re.test(text)) continue;
        if (id === "talkDev-hardcoded" && /isTalkDevStubMode|talkDev/.test(text)) {
          const lines = text.split("\n").filter((l) => /talkDev=1/.test(l));
          for (const line of lines.slice(0, 3)) {
            if (/isTalkDevStubMode|isLocalTlvDevHost|localhost/.test(line)) continue;
            hits.push({ file: rel, pattern: id, sample: line.trim().slice(0, 120) });
          }
          continue;
        }
        if (id === "console-debug") {
          const count = (text.match(/console\.(debug|log)\(/g) || []).length;
          if (count > 0) hits.push({ file: rel, pattern: id, sample: `${count} occurrence(s)` });
          continue;
        }
        hits.push({ file: rel, pattern: id, sample: text.match(re)?.[0] || "" });
      }
    }
  }
  if (fs.existsSync(distRoot)) walk(distRoot);
  return hits;
}

const distScan = scanDist();
const pageResults = [];
const allHarmfulConsole = [];
const allNetworkBad = [];
const leakResults = [];

const browser = await chromium.launch();

for (const pageDef of PAGES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    const label = `${pageDef.id}@${width}`;
    const url = `${LIVE}/${pageDef.file}${pageDef.query}`;
    const pageConsole = [];
    const pageNetwork = [];

    page.on("console", (msg) => {
      const text = msg.text();
      const cls = classifyConsole(text);
      pageConsole.push({ type: msg.type(), text, ...cls });
    });
    page.on("pageerror", (err) => {
      pageConsole.push({ type: "pageerror", text: err.message, harmful: true });
    });
    page.on("response", (res) => {
      const status = res.status();
      const reqUrl = res.url();
      if (status < 400) {
        if (reqUrl.startsWith("http://") && !reqUrl.includes("127.0.0.1")) {
          pageNetwork.push({ url: reqUrl, status, issue: "mixed-content-http" });
        }
        return;
      }
      const benign = status === 401 || status === 403 || status === 404;
      pageNetwork.push({ url: reqUrl, status, benign, issue: benign ? "guest-expected" : `http-${status}` });
    });

    await page.setViewportSize({ width, height: 900 });
    let httpStatus = 0;
    let navError = null;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      httpStatus = resp?.status() ?? 0;
    } catch (err) {
      navError = err.message;
    }
    await page.waitForTimeout(1500);

    const metrics = await page.evaluate(() => {
      const dev = window.TasuTlvDevAuth;
      const cfg = window.TasuLiveConfig;
      const bodyText = document.body?.innerText || "";
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        hasError: Boolean(document.querySelector(".live-error")),
        hasLoading: Boolean(document.querySelector(".live-loading:not(.live-loading--inline)")),
        shouldUseTlvDevDemo: dev?.shouldUseTlvDevDemo?.() ?? null,
        followFallback: dev?.shouldUseTlvFollowLocalFallback?.() ?? null,
        notifyFallback: dev?.shouldUseTlvNotifyLocalFallback?.() ?? null,
        getTalkUserId: cfg?.getTalkUserId?.() ?? "",
        hasTalkDevInLinks: [...document.querySelectorAll("a[href]")].some((a) =>
          (a.getAttribute("href") || "").includes("talkDev=1"),
        ),
        hasSystemNotifyDev: bodyText.includes("System 通知送信") || bodyText.includes("system-notify-dev"),
        hasStubWatchLink: [...document.querySelectorAll("a[href]")].some((a) =>
          /broadcast_id=stub/.test(a.getAttribute("href") || ""),
        ),
        hostname: location.hostname,
        cspMeta: cspMeta?.getAttribute("content")?.slice(0, 80) || null,
      };
    }).catch(() => ({}));

    const harmful = pageConsole.filter((c) => c.harmful && (c.type === "error" || c.type === "pageerror"));
    const badNet = pageNetwork.filter((n) => !n.benign && n.issue !== "guest-expected");
    allHarmfulConsole.push(...harmful.map((c) => ({ page: label, ...c })));
    allNetworkBad.push(...badNet.map((n) => ({ page: label, ...n })));

    if (width === 1280) {
      leakResults.push({
        page: pageDef.id,
        url,
        ...metrics,
        leakPass:
          metrics.shouldUseTlvDevDemo === false &&
          metrics.followFallback === false &&
          metrics.notifyFallback === false &&
          !metrics.getTalkUserId &&
          !metrics.hasTalkDevInLinks &&
          !metrics.hasSystemNotifyDev &&
          !metrics.hasStubWatchLink,
      });
    }

    pageResults.push({
      page: pageDef.id,
      width,
      url,
      httpStatus,
      navError,
      overflow: metrics.scrollW > metrics.innerW,
      harmfulConsole: harmful.length,
      badNetwork: badNet.length,
      pass:
        !navError &&
        httpStatus >= 200 &&
        httpStatus < 400 &&
        !metrics.overflow &&
        harmful.length === 0 &&
        badNet.length === 0,
    });

    await page.close();
  }
}

// Resolve a watch-video id from prod videos page
{
  const page = await browser.newPage();
  await page.goto(`${LIVE}/videos.html`, { waitUntil: "networkidle", timeout: 120000 });
  const videoId = await page.evaluate(() => {
    const a = document.querySelector('a[href*="watch-video"][href*="id="]');
    const href = a?.getAttribute("href") || "";
    const m = href.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  });
  await page.close();
  if (videoId) {
    const page = await browser.newPage();
    const url = `${LIVE}/watch-video.html?id=${encodeURIComponent(videoId)}`;
    const harmful = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const cls = classifyConsole(msg.text());
        if (cls.harmful) harmful.push(msg.text());
      }
    });
    page.on("pageerror", (err) => harmful.push(err.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2000);
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      hasError: Boolean(document.querySelector(".live-error")),
      title: document.title,
    }));
    pageResults.push({
      page: "watch-video-with-id",
      width: 1280,
      url,
      httpStatus: resp?.status() ?? 0,
      overflow: m.scrollW > m.innerW,
      harmfulConsole: harmful.length,
      videoId,
      pass: harmful.length === 0 && !m.overflow && (resp?.status() ?? 0) < 400,
    });
    await page.close();
  }
}

await browser.close();

// Lighthouse (optional)
const lighthouseResults = [];
for (const p of ["videos.html", "watch-video.html"]) {
  const url = `${LIVE}/${p}`;
  const out = path.join(OUT, `lighthouse-${p.replace(".html", "")}.json`);
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `import('playwright').then(async ({ chromium }) => {
        const { default: lighthouse } = await import('lighthouse').catch(() => ({ default: null }));
        if (!lighthouse) { console.log(JSON.stringify({ skip: true, reason: 'lighthouse not installed' })); return; }
        const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
        const result = await lighthouse(${JSON.stringify(url)}, { port: 9222, onlyCategories: ['performance','accessibility','best-practices'], output: 'json', logLevel: 'error' });
        await browser.close();
        const c = result.lhr.categories;
        console.log(JSON.stringify({ performance: Math.round(c.performance.score*100), accessibility: Math.round(c.accessibility.score*100), bestPractices: Math.round(c['best-practices'].score*100) }));
      })`,
    ],
    { encoding: "utf8", timeout: 180000 },
  );
  try {
    const parsed = JSON.parse((r.stdout || "").trim().split("\n").pop() || "{}");
    lighthouseResults.push({ page: p, url, ...parsed });
  } catch {
    lighthouseResults.push({ page: p, url, skip: true, reason: (r.stderr || r.stdout || "").slice(0, 200) });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  prodBase: PROD_BASE,
  pageResults,
  pageFails: pageResults.filter((r) => !r.pass),
  leakResults,
  leakFails: leakResults.filter((r) => !r.leakPass),
  harmfulConsole: [...new Map(allHarmfulConsole.map((c) => [`${c.page}:${c.text}`, c])).values()].slice(0, 30),
  harmfulConsoleCount: allHarmfulConsole.length,
  networkBad: [...new Map(allNetworkBad.map((n) => [`${n.page}:${n.url}:${n.status}`, n])).values()].slice(0, 30),
  networkBadCount: allNetworkBad.length,
  distScan,
  lighthouse: lighthouseResults,
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(
  report.pageFails.length || report.leakFails.length || report.harmfulConsoleCount || report.networkBadCount
    ? 1
    : 0,
);
