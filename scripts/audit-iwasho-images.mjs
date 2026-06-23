#!/usr/bin/env node
/**
 * IWASHO 全ページ画像監査（390 / 768 / 1280）
 *   node scripts/audit-iwasho-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = path.join(ROOT, "reports/iwasho-image-audit.json");
const OUT_MD = path.join(ROOT, "reports/iwasho-image-audit-report.md");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];

const PAGES = [
  { slug: "home", path: "/iwasho/", label: "ホーム" },
  { slug: "about", path: "/iwasho/about.html", label: "事業内容" },
  { slug: "services", path: "/iwasho/services.html", label: "対応業務" },
  { slug: "partners", path: "/iwasho/partners.html", label: "パートナー募集" },
  { slug: "team", path: "/iwasho/team.html", label: "チーム紹介" },
  { slug: "company", path: "/iwasho/company.html", label: "会社概要" },
  { slug: "contact", path: "/iwasho/contact.html", label: "お問い合わせ" },
];

function extractUrlsFromCss(cssText, baseUrl) {
  const urls = [];
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(cssText))) {
    const raw = m[1].trim();
    if (raw.startsWith("data:")) continue;
    try {
      urls.push(new URL(raw, baseUrl).href);
    } catch {
      urls.push(raw);
    }
  }
  return urls;
}

async function auditPage(page, pageUrl) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });

  const domAudit = await page.evaluate(() => {
    const items = [];

    for (const img of document.querySelectorAll("img")) {
      const r = img.getBoundingClientRect();
      items.push({
        kind: "img",
        url: img.currentSrc || img.src || img.getAttribute("src") || "",
        ok: img.complete && img.naturalWidth > 0,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayW: Math.round(r.width),
        displayH: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
        alt: img.alt || "",
        selector: img.className || img.id || "img",
      });
    }

    for (const el of document.querySelectorAll("*")) {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none" || bg.includes("gradient")) continue;
      const match = bg.match(/url\("([^"]+)"\)|url\('([^']+)'\)|url\(([^)]+)\)/);
      if (!match) continue;
      const raw = (match[1] || match[2] || match[3] || "").trim();
      if (raw.startsWith("data:")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      items.push({
        kind: "background",
        url: raw,
        ok: null,
        naturalWidth: null,
        naturalHeight: null,
        displayW: Math.round(r.width),
        displayH: Math.round(r.height),
        visible: true,
        alt: "",
        selector: el.className?.toString().slice(0, 80) || el.tagName,
      });
    }

    for (const el of document.querySelectorAll("[style*='background-image']")) {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (!match) continue;
      const raw = match[1].trim();
      if (raw.startsWith("data:")) continue;
      const r = el.getBoundingClientRect();
      items.push({
        kind: "inline-bg",
        url: raw,
        ok: null,
        naturalWidth: null,
        naturalHeight: null,
        displayW: Math.round(r.width),
        displayH: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
        alt: "",
        selector: el.className?.toString().slice(0, 80) || el.tagName,
      });
    }

    return items;
  });

  const uniqueUrls = [...new Set(domAudit.map((i) => i.url).filter(Boolean))];
  const httpResults = {};

  for (const url of uniqueUrls) {
    try {
      const resolved = new URL(url, pageUrl).href;
      const resp = await page.request.get(resolved, { timeout: 30000 });
      const ct = resp.headers()["content-type"] || "";
      httpResults[url] = {
        resolved,
        status: resp.status(),
        ok: resp.ok(),
        contentType: ct,
      };
      if (resp.ok() && ct.startsWith("image/")) {
        const buf = await resp.body();
        httpResults[url].bytes = buf.length;
      }
    } catch (err) {
      httpResults[url] = {
        resolved: url,
        status: 0,
        ok: false,
        error: String(err.message || err),
      };
    }
  }

  const enriched = domAudit.map((item) => {
    const http = httpResults[item.url] || {};
    const is404 = http.status === 404;
    const failed = item.kind === "img" ? !item.ok : http.ok === false;
    const blackPlaceholder =
      item.kind === "img"
        ? item.visible && item.displayW > 40 && item.displayH > 40 && !item.ok
        : item.visible && item.displayW > 40 && item.displayH > 40 && (http.ok === false || http.status === 0);

    return {
      ...item,
      resolved: http.resolved || item.url,
      httpStatus: http.status ?? null,
      is404,
      loadOk: item.kind === "img" ? item.ok : http.ok === true,
      failed,
      blackPlaceholder,
      contentType: http.contentType || null,
    };
  });

  const deduped = [];
  const seen = new Set();
  for (const row of enriched) {
    const key = `${row.kind}|${row.resolved}|${row.selector}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return {
    consoleErrors: [...new Set(consoleErrors)],
    items: deduped,
    failures: deduped.filter((i) => i.failed || i.blackPlaceholder || i.is404),
  };
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/" });
const report = { generatedAt: new Date().toISOString(), base, pages: {} };

await withPlaywrightBrowser(async (browser) => {
  for (const pageDef of PAGES) {
    report.pages[pageDef.slug] = { label: pageDef.label, path: pageDef.path, viewports: {} };
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const result = await auditPage(page, `${base}${pageDef.path}`);
      report.pages[pageDef.slug].viewports[vp.id] = result;
      await page.close();
    }
  }
});

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

const lines = [
  "# IWASHO 画像監査レポート",
  "",
  `生成: ${report.generatedAt}`,
  `Base: ${base}`,
  "",
];

let totalFailures = 0;

for (const pageDef of PAGES) {
  const pdata = report.pages[pageDef.slug];
  lines.push(`## ${pageDef.label} (${pageDef.path})`, "");

  for (const vp of VIEWPORTS) {
    const v = pdata.viewports[vp.id];
    const fails = v.failures;
    totalFailures += fails.length;
    lines.push(`### ${vp.id}px — 失敗 ${fails.length}件`, "");
    if (fails.length === 0) {
      lines.push("- なし", "");
      continue;
    }
    lines.push("| 種別 | URL | HTTP | naturalWxH | 表示WxH | selector |");
    lines.push("|------|-----|------|------------|---------|----------|");
    for (const f of fails) {
      const nw = f.naturalWidth ?? "-";
      const nh = f.naturalHeight ?? "-";
      lines.push(
        `| ${f.kind} | \`${f.resolved}\` | ${f.httpStatus ?? "-"} | ${nw}x${nh} | ${f.displayW}x${f.displayH} | ${f.selector} |`
      );
    }
    if (v.consoleErrors.length) {
      lines.push("", "Console errors:", ...v.consoleErrors.map((e) => `- ${e}`));
    }
    lines.push("");
  }
}

lines.push("## サマリー", "", `- 総失敗件数（全viewport合算）: **${totalFailures}**`, "");

fs.writeFileSync(OUT_MD, lines.join("\n"));
console.log("JSON:", OUT_JSON);
console.log("MD:", OUT_MD);
console.log("total failures:", totalFailures);
process.exit(totalFailures > 0 ? 1 : 0);
