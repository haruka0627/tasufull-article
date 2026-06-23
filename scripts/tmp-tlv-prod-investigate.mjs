import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URLS = {
  deploy564: "https://48d49d9c.tasufull-article.pages.dev",
  deploy538: "https://6407eaf4.tasufull-article.pages.dev",
  production: "https://tasufull-article.pages.dev",
};

async function fetchText(url) {
  const r = await fetch(url, { redirect: "follow" });
  return {
    status: r.status,
    finalUrl: r.url,
    headers: Object.fromEntries(r.headers.entries()),
    text: await r.text(),
  };
}

function cssMarkers(text) {
  return {
    hasV2Comment: text.includes("YouTube-style grid v2"),
    has72px: text.includes("--tlv-sidebar-w: 72px") && text.includes('body[data-page="live-videos"]'),
    has1280_3cols: /min-width:\s*1280px[\s\S]{0,200}repeat\(3/.test(text),
    has1920_4cols: /min-width:\s*1920px[\s\S]{0,200}repeat\(4/.test(text),
    has2560_5cols: /min-width:\s*2560px/.test(text),
    has1600_5cols: /min-width:\s*1600px[\s\S]{0,200}repeat\(5/.test(text),
  };
}

function jsMarkers(text) {
  return {
    hasYtCard: text.includes("live-video-card--yt"),
    hasMiddleDot: text.includes("・${cfg.escapeHtml(dateLabel)}"),
  };
}

async function probePage(base, label) {
  const paths = ["/live/videos", "/live/videos.html", "/live/live.css", "/live/live-videos.js"];
  const out = { label, base, pages: {} };
  for (const p of paths) {
    const res = await fetchText(base + p);
    out.pages[p] = {
      status: res.status,
      finalUrl: res.finalUrl,
      cfCacheStatus: res.headers["cf-cache-status"] || res.headers["CF-Cache-Status"] || "",
      age: res.headers["age"] || res.headers["Age"] || "",
      contentType: res.headers["content-type"] || "",
      isAccess: res.text.includes("Cloudflare Access") || res.text.includes("cdn-cgi/access"),
      length: res.text.length,
      css: p.endsWith(".css") ? cssMarkers(res.text) : undefined,
      js: p.endsWith(".js") ? jsMarkers(res.text) : undefined,
      html: p.includes("videos") && !p.endsWith(".css") && !p.endsWith(".js")
        ? {
            hasVideosHtml: res.text.includes("data-page=\"live-videos\""),
            hasLiveCss: res.text.includes("live.css"),
            hasLiveVideosJs: res.text.includes("live-videos.js"),
            title: (res.text.match(/<title>([^<]*)<\/title>/i) || [])[1] || "",
          }
        : undefined,
    };
  }
  return out;
}

async function probeDom(base, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = base + "/live/videos";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => ({
    title: document.title,
    isAccess: document.title.includes("Cloudflare Access"),
    hasYtCard: Boolean(document.querySelector(".live-video-card--yt")),
    cols: (() => {
      const f = document.querySelector("[data-live-videos-feed]");
      return f ? getComputedStyle(f).gridTemplateColumns : "";
    })(),
    sidebarW: document.querySelector(".tlv-desktop-sidebar")?.getBoundingClientRect().width || 0,
    cssHref: document.querySelector('link[href*="live.css"]')?.getAttribute("href") || "",
    jsSrc: [...document.querySelectorAll("script[src]")]
      .map((s) => s.getAttribute("src") || "")
      .filter((s) => s.includes("live-videos.js") || s.includes("live.css")),
  }));
  await browser.close();
  return { label, url, ...data };
}

const distCss = fs.readFileSync(path.join(ROOT, "deploy/cloudflare/dist/live/live.css"), "utf8");
const distJs = fs.readFileSync(path.join(ROOT, "deploy/cloudflare/dist/live/live-videos.js"), "utf8");
const srcCss = fs.readFileSync(path.join(ROOT, "live/live.css"), "utf8");

const cacheBust = await Promise.all([
  fetchText(URLS.production + "/live/videos?cachebust=5388084"),
  fetchText(URLS.production + "/live/live.css?cachebust=5388084"),
]);

const http = await Promise.all([
  probePage(URLS.deploy564, "deploy-564ffef-48d49d9c"),
  probePage(URLS.deploy538, "deploy-5388084-6407eaf4"),
  probePage(URLS.production, "production-tasufull-article"),
]);

const dom = await Promise.all([
  probeDom(URLS.deploy564, "deploy-564ffef"),
  probeDom(URLS.deploy538, "deploy-5388084"),
  probeDom(URLS.production, "production"),
]);

const report = {
  wranglerNote: "Production Active = 5388084 (6407eaf4), NOT 564ffef. 48d49d9c is older Production at 564ffef.",
  dist: { css: cssMarkers(distCss), js: jsMarkers(distJs), cssMatchesSrc: distCss === srcCss },
  cacheBust: {
    videos: {
      status: cacheBust[0].status,
      isAccess: cacheBust[0].text.includes("Cloudflare Access"),
      cfCacheStatus: cacheBust[0].headers["cf-cache-status"],
    },
    css: {
      status: cacheBust[1].status,
      isAccess: cacheBust[1].text.includes("Cloudflare Access"),
      markers: cssMarkers(cacheBust[1].text),
      cfCacheStatus: cacheBust[1].headers["cf-cache-status"],
    },
  },
  http,
  dom,
};

console.log(JSON.stringify(report, null, 2));
