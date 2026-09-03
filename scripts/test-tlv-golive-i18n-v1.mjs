/**
 * TLV Go Live Japanese-first i18n — unit + Playwright (8788).
 * Does not restart 8788. Visual QA is human Chrome.
 *
 *   node scripts/test-tlv-golive-i18n-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { attachQaConsole } from "./lib/qa-console.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "reports", "ui-review", "tlv-live-japanese-first-i18n-v1");
const OUT = path.join(ROOT, "reports", "tlv-live-japanese-first-i18n-v1.json");
fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const checks = [];
const findings = [];

function pass(name, extra) {
  checks.push({ name, ok: true, ...extra });
  console.log("PASS " + name);
}
function fail(name, extra) {
  failures.push(name);
  checks.push({ name, ok: false, ...extra });
  console.error("FAIL " + name + (extra?.detail ? " · " + extra.detail : ""));
}
function note(msg) {
  findings.push(msg);
  console.log("NOTE " + msg);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractKeys(src, objName) {
  const m = src.match(new RegExp("var " + objName + " = \\{([\\s\\S]*?)\\n  \\};"));
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)":/g)].map((x) => x[1]);
}

function loadLabels(storageSeed) {
  const store = new Map(Object.entries(storageSeed || {}));
  const sandbox = {
    console,
    Date,
    Math,
    Object,
    Array,
    String,
    JSON,
    document: undefined,
    navigator: { language: "en-US", languages: ["en-US", "en"] },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(String(k), String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("short-video/short-video-i18n.js"), sandbox, { filename: "short-video-i18n.js" });
  vm.runInNewContext(read("live/tlv-go-live-labels-ja.js"), sandbox, { filename: "tlv-go-live-labels-ja.js" });
  sandbox.__store = store;
  return sandbox;
}

{
  const src = read("live/tlv-go-live-labels-ja.js");
  const ja = extractKeys(src, "JA");
  const en = extractKeys(src, "EN");
  const jaSet = new Set(ja);
  const enSet = new Set(en);
  const dupJa = ja.filter((k, i) => ja.indexOf(k) !== i);
  const dupEn = en.filter((k, i) => en.indexOf(k) !== i);
  const missingEn = ja.filter((k) => !enSet.has(k));
  const missingJa = en.filter((k) => !jaSet.has(k));
  if (ja.length && en.length && !dupJa.length && !dupEn.length && !missingEn.length && !missingJa.length) {
    pass("dict_key_parity", { ja: ja.length, en: en.length });
  } else {
    fail("dict_key_parity", { detail: JSON.stringify({ dupJa, dupEn, missingEn, missingJa, ja: ja.length, en: en.length }) });
  }
}

{
  const src = read("live/tlv-go-live-labels-ja.js");
  if (!/navigator\.language/.test(src) && !/navigator\.languages/.test(src)) {
    pass("no_browser_language_override_source");
  } else fail("no_browser_language_override_source");
  if (src.includes('tasful.shortVideo.uiLocale') || src.includes("I18n.STORAGE_KEY")) {
    pass("reuses_tasful_locale_store");
  } else fail("reuses_tasful_locale_store");
}

{
  const L = loadLabels({});
  const api = L.TasuTlvGoLiveLabelsJa;
  if (api.DEFAULT_LOCALE === "ja-JP" && api.getDisplayLocale() === "ja-JP") pass("default_japanese");
  else fail("default_japanese", { detail: String(api.getDisplayLocale()) });
  if (api.t("watchingN", { n: 12 }) === "視聴中 12人") pass("ja_watchingN");
  else fail("ja_watchingN", { detail: api.t("watchingN", { n: 12 }) });
  if (api.t("startLive") === "配信開始") pass("ja_startLive");
  else fail("ja_startLive", { detail: api.t("startLive") });
  const mapped = api.userMessage("BLOCKED_LIVEKIT_CREDENTIALS", "BLOCKED_LIVEKIT_CREDENTIALS");
  if (mapped && !/BLOCKED_LIVEKIT/.test(mapped)) pass("user_message_hides_technical_code");
  else fail("user_message_hides_technical_code", { detail: mapped });
  const unk = api.userMessage("UNKNOWN_FAIL_CLOSED", "UNKNOWN_FAIL_CLOSED");
  if (unk && !/UNKNOWN_FAIL_CLOSED/.test(unk)) pass("unknown_fail_closed_hidden");
  else fail("unknown_fail_closed_hidden", { detail: unk });
}

{
  const L = loadLabels({ "tasful.shortVideo.uiLocale": "en" });
  const api = L.TasuTlvGoLiveLabelsJa;
  if (api.getDisplayLocale() === "en" && api.t("startLive") === "Start Live") pass("stored_en_used");
  else fail("stored_en_used", { detail: api.getDisplayLocale() + " " + api.t("startLive") });
}

{
  const L = loadLabels({ "tasful.shortVideo.uiLocale": "ko-KR" });
  const api = L.TasuTlvGoLiveLabelsJa;
  if (api.getDisplayLocale() === "ja-JP" && L.__store.get("tasful.shortVideo.uiLocale") === "ko-KR") {
    pass("ko_stored_displays_ja_without_overwrite");
  } else fail("ko_stored_displays_ja_without_overwrite", { detail: api.getDisplayLocale() });
}

{
  const html = read("one-tlv-go-live.html");
  if (/lang="ja"/.test(html) && /data-sv-ui-locale/.test(html) && /short-video\/short-video-i18n\.js/.test(html)) {
    pass("html_ja_default_and_selector");
  } else fail("html_ja_default_and_selector");
  if (/data-i18n="golive.goLiveStudio"/.test(html) && /配信スタジオ/.test(html)) pass("html_ja_visible_copy");
  else fail("html_ja_visible_copy");
  if (/data-tlv-go-live-cta="start"/.test(html) && /data-tlv-go-live-cta="start-now"/.test(html)) {
    pass("cta_data_attrs");
  } else fail("cta_data_attrs");
  if (!/navigator\.language/.test(html)) pass("html_no_navigator_lang");
  else fail("html_no_navigator_lang");
}

{
  const svc = read("one-tlv-go-live-service.js");
  if (/confirmStartLive/.test(svc) && !/Formal Publish Input:/.test(svc)) pass("confirm_not_technical");
  else fail("confirm_not_technical");
}

{
  const ux = read("scripts/test-tlv-broadcaster-ux-v1.mjs");
  if (ux.includes('LABELS') && ux.includes("watchingN")) pass("broadcaster_ux_contract_still_asserts_labels");
  else fail("broadcaster_ux_contract_still_asserts_labels");
}

async function runtimeQa() {
  let base;
  try {
    base = await requireDevServer();
  } catch (err) {
    fail("dev_server", { detail: String(err.message || err) });
    return;
  }
  pass("dev_server", { base });

  const browser = await launchHeadlessBrowser();
  try {
    const context = await browser.newContext({
      locale: "en-US",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const cons = attachQaConsole(page);
    const url = `${STANDARD_LOCAL_BASE}/one-tlv-go-live.html`;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem("tasful.shortVideo.uiLocale");
      } catch (_) {}
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const status = res ? res.status() : 0;
    if (status === 200) pass("http_200", { url });
    else fail("http_200", { detail: String(status) });

    await page.waitForSelector("[data-sv-ui-locale]", { timeout: 15000 });
    const desktop = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const sel = document.querySelector("[data-sv-ui-locale]");
      return {
        lang: document.documentElement.lang,
        h1: String(h1 && h1.textContent || "").trim(),
        selValue: sel && sel.value,
        options: sel ? [...sel.options].map((o) => o.value) : [],
        stored: localStorage.getItem("tasful.shortVideo.uiLocale"),
        codesVisible: /UNKNOWN_FAIL_CLOSED|BLOCKED_LIVEKIT_CREDENTIALS/.test(document.body.innerText || ""),
      };
    });
    if (desktop.lang === "ja" && /配信スタジオ/.test(desktop.h1)) pass("runtime_default_japanese", desktop);
    else fail("runtime_default_japanese", { detail: JSON.stringify(desktop) });
    if (desktop.options.join(",") === "ja-JP,en") pass("selector_ja_en_only", desktop);
    else fail("selector_ja_en_only", { detail: JSON.stringify(desktop.options) });
    if (!desktop.codesVisible) pass("no_technical_codes_in_body");
    else fail("no_technical_codes_in_body");

    await page.screenshot({ path: path.join(SHOTS, "desktop-1280-ja.png"), fullPage: true });

    await page.selectOption("[data-sv-ui-locale]", "en");
    await page.waitForTimeout(250);
    const enState = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      h1: String(document.querySelector("h1") && document.querySelector("h1").textContent || "").trim(),
      stored: localStorage.getItem("tasful.shortVideo.uiLocale"),
      start: String(document.querySelector('[data-tlv-go-live-cta="start"]') && document.querySelector('[data-tlv-go-live-cta="start"]').textContent || "").trim(),
    }));
    if (enState.lang === "en" && /Go Live Studio/i.test(enState.h1) && enState.stored === "en") {
      pass("english_switch", enState);
    } else fail("english_switch", { detail: JSON.stringify(enState) });
    await page.screenshot({ path: path.join(SHOTS, "desktop-1280-en.png"), fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-sv-ui-locale]", { timeout: 15000 });
    const enReload = await page.evaluate(() => ({
      stored: localStorage.getItem("tasful.shortVideo.uiLocale"),
      h1: String(document.querySelector("h1") && document.querySelector("h1").textContent || "").trim(),
    }));
    if (enReload.stored === "en" && /Go Live Studio/i.test(enReload.h1)) pass("reload_persists_en", enReload);
    else fail("reload_persists_en", { detail: JSON.stringify(enReload) });

    await page.selectOption("[data-sv-ui-locale]", "ja-JP");
    await page.waitForTimeout(250);
    const jaBack = await page.evaluate(() => ({
      stored: localStorage.getItem("tasful.shortVideo.uiLocale"),
      h1: String(document.querySelector("h1") && document.querySelector("h1").textContent || "").trim(),
    }));
    if (jaBack.stored === "ja-JP" && /配信スタジオ/.test(jaBack.h1)) pass("switch_back_japanese", jaBack);
    else fail("switch_back_japanese", { detail: JSON.stringify(jaBack) });

    const pageErrors = cons.pageErrors.filter((e) => !/tailwindcss\.com|cdn\.tailwind/i.test(e));
    const consoleErrors = cons.errors.filter((e) => !/tailwindcss\.com|cdn\.tailwind|favicon/i.test(e));
    if (!pageErrors.length) pass("runtime_pageerror_0");
    else fail("runtime_pageerror_0", { detail: pageErrors.slice(0, 5).join(" | ") });
    if (consoleErrors.length) note("console.error (non-tailwind): " + consoleErrors.slice(0, 4).join(" | "));

    const mobile = await browser.newContext({
      locale: "en-US",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.addInitScript(() => {
      try {
        localStorage.removeItem("tasful.shortVideo.uiLocale");
      } catch (_) {}
    });
    const mpage = await mobile.newPage();
    attachQaConsole(mpage);
    await mpage.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mpage.waitForSelector("[data-sv-ui-locale]", { timeout: 15000 });
    const layout = await mpage.evaluate(() => {
      const sel = document.querySelector("[data-sv-ui-locale]");
      const cta = document.querySelector('[data-tlv-go-live-cta="start-now"]');
      const r = sel ? sel.getBoundingClientRect() : { right: 0, width: 0, top: 0, bottom: 0 };
      const cr = cta ? cta.getBoundingClientRect() : { width: 0, height: 0 };
      const dx = document.documentElement.scrollWidth - window.innerWidth;
      return {
        h1: String(document.querySelector("h1") && document.querySelector("h1").textContent || "").trim(),
        selOverflow: r.right > window.innerWidth + 2 || r.width < 40,
        pageOverflowX: dx > 2,
        ctaHeight: cr.height,
        ctaWidth: cr.width,
        lang: document.documentElement.lang,
      };
    });
    if (/配信スタジオ/.test(layout.h1) && layout.lang === "ja") pass("mobile_390_default_ja", layout);
    else fail("mobile_390_default_ja", { detail: JSON.stringify(layout) });
    if (!layout.selOverflow && !layout.pageOverflowX) pass("mobile_390_no_overflow", layout);
    else fail("mobile_390_no_overflow", { detail: JSON.stringify(layout) });
    if (layout.ctaWidth > 200 && layout.ctaHeight >= 44) pass("mobile_390_cta_intact", layout);
    else fail("mobile_390_cta_intact", { detail: JSON.stringify(layout) });
    await mpage.screenshot({ path: path.join(SHOTS, "mobile-390x844-ja.png"), fullPage: true });
    await mobile.close();
  } finally {
    await browser.close();
  }
}

await runtimeQa();

const report = {
  at: new Date().toISOString(),
  phase: "TLV_LIVE_JAPANESE_FIRST_I18N_V1",
  ok: failures.length === 0,
  failures,
  checks,
  findings,
  shots: SHOTS,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(failures.length ? "\nTLV_LIVE_JAPANESE_FIRST_I18N_V1: FAIL" : "\nTLV_LIVE_JAPANESE_FIRST_I18N_V1: PASS");
process.exit(failures.length ? 1 : 0);
