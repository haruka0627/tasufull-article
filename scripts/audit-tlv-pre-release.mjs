#!/usr/bin/env node
/**
 * TLV pre-release quality audit (read-only)
 *   node scripts/audit-tlv-pre-release.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "http://127.0.0.1:8788/live";
const WIDTHS = [390, 768, 1280];
const OUT = path.join(ROOT, "scripts", "tmp-tlv-pre-release-audit");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { id: "videos", file: "videos.html", query: "", studio: false },
  { id: "videos-following", file: "videos.html", query: "?feed=following&talkDev=1", studio: false, dev: true },
  { id: "watch-video", file: "watch-video.html", query: "?id=4d7e3650-b441-4598-9723-475a956cf68a&talkDev=1", studio: false, dev: true },
  { id: "watch-live", file: "watch-live.html", query: "?id=a1b2c3d4-e5f6-4789-a012-3456789abcde&talkDev=1", studio: false, dev: true },
  { id: "shorts", file: "shorts.html", query: "", studio: false },
  { id: "profile", file: "profile.html", query: "?userId=u_store&talkDev=1", studio: false, dev: true },
  { id: "notifications", file: "notifications.html", query: "?talkDev=1", studio: false, dev: true },
  { id: "creator-dashboard", file: "creator-dashboard.html", query: "?talkDev=1", studio: false, dev: true },
  { id: "analytics", file: "analytics.html", query: "?talkDev=1", studio: false, dev: true },
  { id: "channel-content", file: "channel-content.html", query: "?talkDev=1&userId=u_me", studio: true, dev: true },
  { id: "video-upload", file: "video-upload.html", query: "?talkDev=1", studio: false, dev: true },
  { id: "my-videos", file: "my-videos.html", query: "?talkDev=1", studio: false, dev: true },
];

const BENIGN_PATTERNS = [
  { re: /MIME type.*not executable/, reason: "local dev: parent-site JS 404 → text/html MIME" },
  { re: /Edge functions base URL/, reason: "local dev: Supabase functions URL unset" },
  { re: /Supabase が未設定/, reason: "local dev: no Supabase config injected" },
  { re: /talkDev stub/, reason: "intentional stub mode skip" },
  { re: /Failed to load resource.*401/, reason: "guest/unauth API 401 expected" },
  { re: /following videos fetch skipped/, reason: "dev: no follows in DB" },
  { re: /following shorts fetch skipped/, reason: "dev: no follows in DB" },
  { re: /notifications skipped/, reason: "dev: optional fetch fallback" },
  { re: /fetch skipped/, reason: "dev: optional Supabase fetch" },
  { re: /notify skipped/, reason: "non-blocking notify hook" },
];

function classifyConsole(text, type) {
  for (const { re, reason } of BENIGN_PATTERNS) {
    if (re.test(text)) return { benign: true, reason };
  }
  return { benign: false, reason: null };
}

function classifyNetwork(url, status) {
  if (status === 404) {
    if (/chat-supabase-config|talk-runtime|tasu-supabase-client/.test(url)) {
      return { benign: true, reason: "TLV pages load parent-site scripts; 404 on :8788 dev" };
    }
    return { benign: false, reason: "404" };
  }
  if (status >= 400) return { benign: false, reason: `HTTP ${status}` };
  return { benign: true, reason: null };
}

const browser = await chromium.launch();
const layoutResults = [];
const consoleResults = [];
const networkResults = [];
const prodLeakResults = [];

for (const pageDef of PAGES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    const label = `${pageDef.id}@${width}`;
    const url = `${BASE}/${pageDef.file}${pageDef.query || ""}`;

    const pageConsole = [];
    const pageNetwork = [];

    page.on("console", (msg) => {
      const text = msg.text();
      const cls = classifyConsole(text, msg.type());
      pageConsole.push({ type: msg.type(), text, ...cls });
    });
    page.on("pageerror", (err) => {
      pageConsole.push({ type: "pageerror", text: err.message, benign: false, reason: null });
    });
    page.on("response", (res) => {
      const status = res.status();
      if (status < 400) return;
      const reqUrl = res.url();
      const cls = classifyNetwork(reqUrl, status);
      pageNetwork.push({ url: reqUrl, status, ...cls });
    });

    if (pageDef.dev) {
      await page.addInitScript(() => {
        try {
          localStorage.removeItem("tlvDevForceGuest");
        } catch {
          /* ignore */
        }
      });
    }

    await page.setViewportSize({ width, height: 900 });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    } catch (err) {
      layoutResults.push({ page: pageDef.id, width, url, error: err.message, pass: false });
      await page.close();
      continue;
    }
    await page.waitForTimeout(1500);

    const metrics = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const hasError = Boolean(document.querySelector(".live-error:not([hidden])"));
      const hasLoading = Boolean(document.querySelector(".live-loading"));
      const modals = [...document.querySelectorAll("[role='dialog'], .tlv-modal, [data-tlv-modal]")].filter(visible).length;
      const buttons = document.querySelectorAll("button, .live-btn, a.live-btn").length;
      const dev = window.TasuTlvDevAuth;
      const cfg = window.TasuLiveConfig;
      return {
        scrollW,
        innerW,
        overflow: scrollW > innerW,
        hasError,
        hasLoading,
        modals,
        buttons,
        shouldUseTlvDevDemo: dev?.shouldUseTlvDevDemo?.() ?? null,
        followFallback: dev?.shouldUseTlvFollowLocalFallback?.() ?? null,
        notifyFallback: dev?.shouldUseTlvNotifyLocalFallback?.() ?? null,
        getTalkUserId: cfg?.getTalkUserId?.() ?? "",
        isStub: cfg?.isTalkDevStubMode?.() ?? null,
      };
    });

    layoutResults.push({
      page: pageDef.id,
      width,
      url,
      ...metrics,
      pass: !metrics.overflow && !metrics.hasError,
    });

    const badConsole = pageConsole.filter((c) => (c.type === "error" || c.type === "pageerror") && !c.benign);
    const badWarnings = pageConsole.filter((c) => c.type === "warning" && !c.benign);
    const badNetwork = pageNetwork.filter((n) => !n.benign);

    if (pageConsole.length) {
      consoleResults.push({ page: pageDef.id, width, entries: pageConsole, bad: badConsole, warnings: badWarnings });
    }
    if (pageNetwork.length) {
      networkResults.push({ page: pageDef.id, width, entries: pageNetwork, bad: badNetwork });
    }

    await page.screenshot({ path: path.join(OUT, `${pageDef.id}-${width}.png`), fullPage: false });
    await page.close();
  }
}

// Prod guest leak check (no talkDev)
{
  const prodPages = PAGES.filter((p) => !p.dev).concat([
    { id: "watch-video-prod", file: "watch-video.html", query: "", studio: false },
    { id: "profile-prod", file: "profile.html", query: "", studio: false },
    { id: "creator-dashboard-prod", file: "creator-dashboard.html", query: "", studio: false },
    { id: "my-videos-prod", file: "my-videos.html", query: "", studio: false },
    { id: "video-upload-prod", file: "video-upload.html", query: "", studio: false },
  ]);

  for (const pageDef of prodPages) {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tlvDevForceGuest", "1");
      } catch {
        /* ignore */
      }
    });
    const url = `${BASE}/${pageDef.file}${pageDef.query || ""}`;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1200);

    const leak = await page.evaluate(() => {
      const dev = window.TasuTlvDevAuth;
      const cfg = window.TasuLiveConfig;
      const bodyText = document.body?.innerText || "";
      return {
        shouldUseTlvDevDemo: dev?.shouldUseTlvDevDemo?.() ?? null,
        followFallback: dev?.shouldUseTlvFollowLocalFallback?.() ?? null,
        notifyFallback: dev?.shouldUseTlvNotifyLocalFallback?.() ?? null,
        getTalkUserId: cfg?.getTalkUserId?.() ?? "",
        hasTalkDevLink: Boolean([...document.querySelectorAll("a[href]")].some((a) => (a.getAttribute("href") || "").includes("talkDev=1"))),
        hasSystemNotifyDev: bodyText.includes("System 通知送信"),
        hasStubWatchLink: [...document.querySelectorAll("a[href]")].some((a) => /broadcast_id=stub/.test(a.getAttribute("href") || "")),
      };
    });

    prodLeakResults.push({
      page: pageDef.id,
      url,
      ...leak,
      pass:
        leak.shouldUseTlvDevDemo === false &&
        leak.followFallback === false &&
        leak.notifyFallback === false &&
        !leak.getTalkUserId &&
        !leak.hasSystemNotifyDev,
    });
    await page.close();
  }
}

await browser.close();

const layoutFails = layoutResults.filter((r) => !r.pass);
const allBadConsole = consoleResults.flatMap((r) => r.bad.map((b) => ({ page: r.page, width: r.width, ...b })));
const allBadNetwork = networkResults.flatMap((r) => r.bad.map((b) => ({ page: r.page, width: r.width, ...b })));
const prodFails = prodLeakResults.filter((r) => !r.pass);

const report = {
  generatedAt: new Date().toISOString(),
  layoutResults,
  layoutFails: layoutFails.map((r) => ({ page: r.page, width: r.width, overflow: r.overflow, hasError: r.hasError, error: r.error })),
  consoleSummary: {
    totalPages: consoleResults.length,
    badCount: allBadConsole.length,
    bad: [...new Map(allBadConsole.map((b) => [`${b.page}@${b.width}:${b.text}`, b])).values()],
    benignSamples: [...new Set(consoleResults.flatMap((r) => r.entries.filter((e) => e.benign).map((e) => e.text))).values()].slice(0, 20),
  },
  networkSummary: {
    badCount: allBadNetwork.length,
    bad: [...new Map(allBadNetwork.map((b) => [`${b.url}:${b.status}`, b])).values()],
  },
  prodLeakResults,
  prodFails,
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(layoutFails.length || allBadConsole.length || allBadNetwork.length || prodFails.length ? 1 : 0);
