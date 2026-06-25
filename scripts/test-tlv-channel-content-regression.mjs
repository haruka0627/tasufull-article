#!/usr/bin/env node
/**
 * TLV channel-content.html regression
 *   node scripts/test-tlv-channel-content-regression.mjs
 *   node scripts/test-tlv-channel-content-regression.mjs --skip-prod
 *
 * Detects: mojibake HTML, unclosed aria-label, ME duplication, horizontal overflow.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "http://127.0.0.1:8788/live";
const URL = `${BASE}/channel-content.html?talkDev=1&userId=u_me`;
const WIDTHS = [390, 768, 1280];
const OUT = path.join(ROOT, "scripts", "tmp-channel-content-regression");
const SKIP_PROD = process.argv.includes("--skip-prod");
const BAD_SCREEN = ["\uFFFD", "作E", "ヘルチE", "アカウンチE", "EE/a", "E/h1", "コンチEチE"];
const BAD_SOURCE = [...BAD_SCREEN, 'aria-label="ヘルチE', "チャンネルE検索"];
const MOBILE_HEADER_ORDER = ["menu", "title", "me", "upload"];

fs.mkdirSync(OUT, { recursive: true });

/** @type {{ id: string; pass: boolean; detail?: string }[]} */
const checks = [];

function record(id, pass, detail = "") {
  checks.push({ id, pass, detail });
}

function readUtf8(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of ["live/channel-content.html", "deploy/cloudflare/dist/live/channel-content.html"]) {
  const html = readUtf8(rel);
  const found = BAD_SOURCE.filter((s) => html.includes(s));
  record(`source:${rel}:no-bad-patterns`, found.length === 0, found.length ? found.join(", ") : "clean");
  record(
    `source:${rel}:utf8-title`,
    html.includes("<title>コンテンツ | TLV Studio</title>"),
    html.match(/<title>[^<]*<\/title>/)?.[0] || "missing title",
  );
}

const consoleErrors = [];
const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage();
  const label = `viewport:${width}`;
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${label}][pageerror] ${err.message}`);
  });

  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const m = await page.evaluate(
    ({ badScreen, mobileHeaderOrder }) => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };

      const bodyText = document.body.innerText;
      const foundBad = badScreen.filter((s) => bodyText.includes(s));

      const shell = document.querySelector(".tlv-studio-mobile-shell");
      const header = shell?.querySelector(":scope > header.tlv-studio-mobile-header");
      const main = shell?.querySelector(":scope > main.tlv-studio-mobile-content");
      const upload = header?.querySelector(".tlv-studio-mobile-header__upload");
      const mainAncestorUpload = Boolean(main && upload && upload.contains(main));

      function mobileChildKind(el) {
        if (el.matches(".tlv-studio-mobile-header__menu")) return "menu";
        if (el.matches(".tlv-studio-mobile-header__title")) return "title";
        if (el.matches("[data-tlv-studio-acct-menu]")) return "me";
        if (el.matches(".tlv-studio-mobile-header__upload")) return "upload";
        return "other";
      }

      const mobileChildKinds = header ? [...header.children].map(mobileChildKind) : [];
      const mobileChildLabels = header
        ? [...header.children].map((el) => {
            if (el.matches(".tlv-studio-mobile-header__menu")) return el.textContent?.trim() || "";
            if (el.matches(".tlv-studio-mobile-header__title")) return el.textContent?.trim() || "";
            if (el.matches("[data-tlv-studio-acct-menu]")) {
              return el.querySelector(".tlv-studio-acct__trigger-avatar")?.textContent?.trim() || "ME";
            }
            if (el.matches(".tlv-studio-mobile-header__upload")) return el.textContent?.trim() || "";
            return el.className || el.tagName;
          })
        : [];

      const acctMenuCount = document.querySelectorAll("[data-tlv-studio-acct-menu]").length;
      const acctCount = document.querySelectorAll(".tlv-studio-acct").length;

      const visibleMeMobile = [
        ...document.querySelectorAll(".tlv-studio-mobile-header .tlv-studio-acct__trigger-avatar"),
      ].filter(visible).length;
      const visibleMeTopbar = [
        ...document.querySelectorAll(".tlv-studio-topbar .tlv-studio-acct__trigger-avatar"),
      ].filter(visible).length;

      const searchInput = document.querySelector("[data-tlv-studio-search-input]");
      const createSpan = document.querySelector(".tlv-studio-topbar__create span");
      const helpBtn = document.querySelector("[data-tlv-studio-topbar-help]");
      const accountLink = document.querySelector("[data-tlv-studio-topbar-avatar]");
      const accountToggle = document.querySelector(".tlv-studio-topbar [data-tlv-studio-acct-toggle]");
      const accountAria =
        accountLink?.getAttribute("aria-label") ||
        accountToggle?.getAttribute("aria-label") ||
        "";

      return {
        foundBad,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasMobileHeader: Boolean(header),
        mobileTitle: header?.querySelector(".tlv-studio-mobile-header__title")?.textContent?.trim() || "",
        mobileUpload: upload?.textContent?.trim() || "",
        mainAncestorUpload,
        mobileChildKinds,
        mobileChildLabels,
        mobileHeaderOrderOk:
          JSON.stringify(mobileChildKinds) === JSON.stringify(mobileHeaderOrder),
        acctMenuCount,
        acctCount,
        visibleMeMobile,
        visibleMeTopbar,
        searchPlaceholder: searchInput?.getAttribute("placeholder") || "",
        createLabel: createSpan?.textContent?.trim() || "",
        helpAria: helpBtn?.getAttribute("aria-label") || "",
        accountAria,
      };
    },
    { badScreen: BAD_SCREEN, mobileHeaderOrder: MOBILE_HEADER_ORDER },
  );

  await page.screenshot({ path: path.join(OUT, `channel-content-${width}.png`), fullPage: false });

  record(`${width}:no-bad-screen-text`, m.foundBad.length === 0, m.foundBad.join(", ") || "clean");
  record(`${width}:scroll-match`, m.scrollWidth === m.innerWidth, `${m.scrollWidth} vs ${m.innerWidth}`);
  record(`${width}:acct-menu-one`, m.acctMenuCount === 1, `count=${m.acctMenuCount}`);
  record(`${width}:acct-one`, m.acctCount === 1, `count=${m.acctCount}`);
  record(`${width}:mobile-header-exists`, m.hasMobileHeader);
  record(`${width}:mobile-title`, m.mobileTitle === "コンテンツ", m.mobileTitle);
  record(`${width}:mobile-upload-plus`, m.mobileUpload === "+", m.mobileUpload);
  record(`${width}:main-not-in-upload`, m.mainAncestorUpload === false, String(m.mainAncestorUpload));

  if (width === 390 || width === 768) {
    record(`${width}:me-mobile-one`, m.visibleMeMobile === 1, `count=${m.visibleMeMobile}`);
    record(`${width}:mobile-header-order`, m.mobileHeaderOrderOk, m.mobileChildLabels.join(" / "));
    record(
      `${width}:mobile-header-labels`,
      m.mobileChildLabels.join("|") === "☰|コンテンツ|ME|+",
      m.mobileChildLabels.join("|"),
    );
  }

  if (width === 1280) {
    record(`${width}:me-topbar-one`, m.visibleMeTopbar === 1, `count=${m.visibleMeTopbar}`);
    record(`${width}:search-placeholder`, m.searchPlaceholder === "チャンネル内を検索", m.searchPlaceholder);
    record(`${width}:create-label`, m.createLabel === "作成", m.createLabel);
    record(`${width}:help-aria`, m.helpAria === "ヘルプ", m.helpAria);
    record(
      `${width}:account-aria`,
      m.accountAria === "アカウント" || m.accountAria === "アカウントメニュー",
      m.accountAria,
    );
  }

  await page.close();
}

await browser.close();

record("console:no-errors", consoleErrors.length === 0, `${consoleErrors.length} error(s)`);

if (!SKIP_PROD) {
  const prod = spawnSync(process.execPath, [path.join(__dirname, "test-tlv-prod-guest-check.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300000,
  });

  let prodSummary = { failed: ["spawn-failed"], consoleErrorCount: -1 };
  try {
    prodSummary = JSON.parse(prod.stdout || "{}");
  } catch {
    prodSummary.parseError = (prod.stderr || prod.stdout || "").slice(-400);
  }

  record("prod-guest:exit-0", prod.status === 0, `exit=${prod.status}`);
  record("prod-guest:no-failed-pages", (prodSummary.failed || []).length === 0, (prodSummary.failed || []).join(", ") || "none");
  record("prod-guest:console-0", prodSummary.consoleErrorCount === 0, String(prodSummary.consoleErrorCount));

  for (const r of prodSummary.results || []) {
    record(`prod-guest:${r.file}:talk-empty`, r.checks?.talkUserIdEmpty === true);
    record(`prod-guest:${r.file}:not-ume`, r.checks?.notUme === true);
    record(`prod-guest:${r.file}:no-dashboard`, r.checks?.noDashboard === true);
  }
}

const failed = checks.filter((c) => !c.pass);
const report = {
  script: "scripts/test-tlv-channel-content-regression.mjs",
  url: URL,
  widths: WIDTHS,
  screenshots: OUT,
  summary: {
    total: checks.length,
    pass: checks.filter((c) => c.pass).length,
    fail: failed.length,
  },
  checks,
  consoleErrors: [...new Set(consoleErrors)],
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log("\n# TLV channel-content regression\n");
console.log("| Check | Result | Detail |");
console.log("|-------|--------|--------|");
for (const c of checks) {
  console.log(`| ${c.id} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail || ""} |`);
}
console.log(`\nTOTAL: ${report.summary.pass}/${report.summary.total} PASS`);
if (consoleErrors.length) {
  console.log("\nConsole errors:", consoleErrors);
}

process.exit(failed.length ? 1 : 0);
