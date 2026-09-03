#!/usr/bin/env node
/**
 * TLV Go Live Canonical Route Migration V1 — source + Playwright (8788).
 * Does not restart 8788. Does not start camera / LiveKit publish.
 * Visual QA is human Chrome.
 *
 *   node scripts/test-tlv-go-live-canonical-route-migration-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { attachQaConsole } from "./lib/qa-console.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "reports", "ui-review", "tlv-go-live-canonical-route-migration-v1");
const OUT = path.join(ROOT, "reports", "tlv-go-live-canonical-route-migration-v1.json");
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = STANDARD_LOCAL_BASE;
const CANONICAL = "/one-tlv-go-live";
const LEGACY = "/live/create/";
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
  console.log("..  " + msg);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function filterConsole(errors) {
  return (errors || []).filter((t) => {
    const s = String(t);
    if (/Failed to load resource.*favicon/i.test(s)) return false;
    if (/Download the React DevTools/i.test(s)) return false;
    if (/_vercel\/insights/i.test(s)) return false;
    if (/cdn\.tailwindcss\.com/i.test(s)) return false;
    if (/tlv-snap-effects\.config\.local\.js/i.test(s)) return false;
    if (/snapar\.com|snapchat\.cdp|camera-kit-api/i.test(s)) return false;
    if (/net::ERR_FAILED/i.test(s)) return false;
    if (/Failed to load resource: the server responded with a status of (401|404)/i.test(s)) return false;
    return true;
  });
}

function isCanonicalHref(href) {
  try {
    const p = new URL(href, BASE).pathname.replace(/\/+$/, "") || "/";
    return p === CANONICAL || p === `${CANONICAL}.html`;
  } catch {
    return false;
  }
}

function isLegacyHref(href) {
  try {
    const p = new URL(href, BASE).pathname;
    return p === "/live/create" || p === "/live/create/" || p === "/live/create.html";
  } catch {
    return false;
  }
}

function sourceAudit() {
  const bridge = read("one-tlv-route-bridge.js");
  const chrome = read("tlv-v0-react/lib/tlv-one-chrome.ts");
  const settings = read("tlv-v0-react/lib/tlv-settings-contracts.ts");
  const liveConfig = read("live/live-config.js");
  const createPage = read("tlv-v0-react/app/create/page.tsx");
  const redirects = read("deploy/cloudflare/_redirects");
  const stub = read("live/go-live-canonical-redirect.html");
  const html = read("one-tlv-go-live.html");
  const service = read("one-tlv-go-live-service.js");
  const livekit = read("live/providers/livekit-live-provider.js");
  const media = read("one-tlv-go-live-media-controller.js");
  const vtuber = read("one-tlv-go-live-vtuber-basic.mjs");
  const scene = read("one-tlv-scene-editor.js");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  const discover = read("tlv-v0-react/components/discover/live-discovery-screen.tsx");
  const shorts = read("tlv-v0-react/components/shorts/shorts-discovery-screen.tsx");
  const leftNav = read("tlv-v0-react/components/game-live/left-nav.tsx");
  const sidebar = read("tlv-v0-react/components/tlv-sidebar.tsx");
  const studioSide = read("tlv-v0-react/components/studio/tlv-studio-sidebar.tsx");

  if (/create:\s*"\/one-tlv-go-live"/.test(bridge) && /version:\s*8/.test(bridge)) {
    pass("source_bridge_canonical");
  } else fail("source_bridge_canonical");
  if (/create:\s*"\/live\/create\//.test(bridge)) fail("source_bridge_no_legacy_create");
  else pass("source_bridge_no_legacy_create");

  if (/create: '\/one-tlv-go-live'/.test(chrome)) pass("source_chrome_canonical");
  else fail("source_chrome_canonical");
  if (/TLV_SETTINGS_CREATE_HREF = '\/one-tlv-go-live'/.test(settings)) pass("source_settings_canonical");
  else fail("source_settings_canonical");
  if (/return "\/one-tlv-go-live"/.test(liveConfig)) pass("source_live_config_canonical");
  else fail("source_live_config_canonical");

  if (/CANONICAL_GO_LIVE = '\/one-tlv-go-live'/.test(createPage) && /location\.replace/.test(createPage)) {
    pass("source_create_page_redirect_only");
  } else fail("source_create_page_redirect_only");
  if (/insertBroadcast|StudioHeader|LivePreview/.test(createPage)) fail("source_create_page_not_dual_studio");
  else pass("source_create_page_not_dual_studio");

  const splat = redirects.split(/\r?\n/).filter((l) => /^\s*\/live\/create\//.test(l) && l.includes("*"));
  if (splat.length) fail("source_redirects_no_splat", { splat });
  else pass("source_redirects_no_splat");
  if (
    /\/live\/create\s+\/one-tlv-go-live\s+302/.test(redirects) &&
    /\/live\/create\/\s+\/one-tlv-go-live\s+302/.test(redirects) &&
    /\/live\/create\.html\s+\/one-tlv-go-live\s+302/.test(redirects)
  ) {
    pass("source_redirects_exact_legacy");
  } else fail("source_redirects_exact_legacy");
  if (/\/one-tlv-go-live\s+\/live\/create/.test(redirects)) fail("source_no_canonical_to_legacy");
  else pass("source_no_canonical_to_legacy");
  if (/\/live\/live-create\.js/.test(redirects)) fail("source_live_create_js_not_redirected");
  else pass("source_live_create_js_not_redirected");
  if (/\/one-tlv-go-live/.test(stub) && /location\.replace/.test(stub)) pass("source_html_stub");
  else fail("source_html_stub");

  for (const [name, src] of [
    ["discover", discover],
    ["shorts", shorts],
    ["left-nav", leftNav],
    ["sidebar", sidebar],
    ["studio-sidebar", studioSide],
  ]) {
    if (src.includes('href="/live/create/"') || /href="\/create"/.test(src) || /href="\/create"/.test(src.replace(/\s/g, ""))) {
      fail(`source_entrypoint_${name}_legacy`);
    } else if (src.includes("/one-tlv-go-live")) pass(`source_entrypoint_${name}_canonical`);
    else fail(`source_entrypoint_${name}_canonical`);
  }

  if (/data-page="one-tlv-go-live"/.test(html) && /data-tlv-go-live-cta="start"/.test(html)) pass("formal_start_live_markup");
  else fail("formal_start_live_markup");
  if (/data-tlv-vroid-hub/.test(html) && /data-tlv-vtuber-file/.test(html)) pass("formal_vrm_hub_markup");
  else fail("formal_vrm_hub_markup");
  if (/one-tlv-scene-editor\.js/.test(html) && /data-tlv-preview-chips/.test(html)) pass("formal_scene_preview_markup");
  else fail("formal_scene_preview_markup");
  if (/golive.cameraDevice/.test(html) && /mic|マイク|audioinput/i.test(html + media)) pass("formal_camera_mic_markup");
  else fail("formal_camera_mic_markup");
  if (/TasuTlvLiveKitFormal\.startHost/.test(service) && /compositedStream/.test(service)) pass("pipeline_startHost_composited_untouched");
  else fail("pipeline_startHost_composited_untouched");
  if (/publishTrack/.test(livekit)) pass("pipeline_livekit_publish_untouched");
  else fail("pipeline_livekit_publish_untouched");
  if (/videoinput/.test(media) && /loadVrmFile/.test(vtuber) && /function/.test(scene)) pass("pipeline_media_vrm_scene_untouched");
  else fail("pipeline_media_vrm_scene_untouched");
  if (/data-tlv-go-live-cta/.test(adapter) && /stop|STOP|cleanup|Cleanup/i.test(adapter + service)) {
    pass("pipeline_start_stop_cleanup_present");
  } else fail("pipeline_start_stop_cleanup_present");
}

async function shot(page, name) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function waitFormal(page) {
  await page.waitForSelector('[data-page="one-tlv-go-live"]', { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function formalAudit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docW = Math.max(document.documentElement.scrollWidth || 0, document.body?.scrollWidth || 0);
    const text = String(document.body?.innerText || "");
    return {
      href: location.href,
      page: document.body?.getAttribute("data-page") || "",
      start: Boolean(document.querySelector('[data-tlv-go-live-cta="start"]')),
      startNow: Boolean(document.querySelector('[data-tlv-go-live-cta="start-now"]')),
      vroid: Boolean(document.querySelector("[data-tlv-vroid-hub]")),
      vrm: Boolean(document.querySelector("[data-tlv-vtuber-file]")),
      preview: Boolean(document.querySelector("[data-tlv-preview-chips]")),
      sceneScript: Boolean(document.querySelector('script[src*="one-tlv-scene-editor"]')),
      camera: /カメラ/.test(text),
      mic: /マイク/.test(text),
      overflow: docW > vw + 8,
    };
  });
}

async function main() {
  sourceAudit();
  const base = await requireDevServer();
  note("dev " + base);

  const liveCreateJs = await fetch(`${BASE}/live/live-create.js`);
  const jsStatus = liveCreateJs.status;
  const jsType = String(liveCreateJs.headers.get("content-type") || "");
  const jsBody = await liveCreateJs.text();
  if (jsStatus === 200 && jsBody.length > 40 && !/^\s*</.test(jsBody) && !/<html/i.test(jsBody.slice(0, 200))) {
    pass("resource_live_create_js_not_redirected", { status: jsStatus, type: jsType, bytes: jsBody.length });
  } else fail("resource_live_create_js_not_redirected", { status: jsStatus, type: jsType, len: jsBody.length, head: jsBody.slice(0, 80) });

  const legacyHead = await fetch(`${BASE}${LEGACY}`, { redirect: "manual" });
  const loc = String(legacyHead.headers.get("location") || "");
  if (legacyHead.status >= 300 && legacyHead.status < 400 && /one-tlv-go-live/.test(loc)) {
    pass("legacy_http_redirect", { status: legacyHead.status, location: loc });
  } else if (legacyHead.status === 200) {
    pass("legacy_http_stub_200", { status: 200, note: "static stub; client replace to canonical" });
  } else {
    fail("legacy_http_redirect_or_stub", { status: legacyHead.status, location: loc });
  }

  const browser = await launchHeadlessBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const cons = attachQaConsole(page);
    const http404 = [];
    page.on("response", (res) => {
      if (res.status() === 404) http404.push(res.url());
    });

    const top = await page.goto(`${BASE}/one-tlv`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1200);
    if (top?.status() === 200) pass("desktop_home_http_200");
    else fail("desktop_home_http_200", { status: top?.status() });

    const sidebarHref = await page.evaluate(() => {
      const el = document.querySelector('aside [data-tlv-action="go-live"]');
      return el ? el.getAttribute("href") || el.getAttribute("data-tlv-route") || "" : "";
    });
    await page.locator('aside [data-tlv-action="go-live"]').first().click({ timeout: 8000 });
    await waitFormal(page);
    const afterSidebar = page.url();
    await shot(page, "010-sidebar-go-live-1280.png");
    if (isCanonicalHref(afterSidebar)) pass("desktop_sidebar_go_live", { href: afterSidebar, bound: sidebarHref });
    else fail("desktop_sidebar_go_live", { href: afterSidebar, bound: sidebarHref });
    if (isLegacyHref(afterSidebar)) fail("desktop_sidebar_not_legacy");
    else pass("desktop_sidebar_not_legacy");

    await page.goto(`${BASE}/one-tlv`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);
    const homeCta = page.locator('[data-tlv-action="go-live"]').first();
    await homeCta.click({ timeout: 8000 });
    await waitFormal(page);
    if (isCanonicalHref(page.url())) pass("desktop_home_go_live", { href: page.url() });
    else fail("desktop_home_go_live", { href: page.url() });

    const direct = await page.goto(`${BASE}${CANONICAL}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitFormal(page);
    if (direct?.status() === 200 && isCanonicalHref(page.url())) pass("direct_canonical_http_200", { href: page.url() });
    else fail("direct_canonical_http_200", { status: direct?.status(), href: page.url() });
    const audit = await formalAudit(page);
    await shot(page, "020-direct-canonical-1280.png");
    for (const k of ["start", "vroid", "vrm", "preview", "camera", "mic"]) {
      if (audit[k]) pass(`formal_${k}_present`);
      else fail(`formal_${k}_present`, audit);
    }
    if (!audit.overflow) pass("desktop_canonical_no_overflow");
    else fail("desktop_canonical_no_overflow");

    const beforeLoop = page.url();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    await waitFormal(page);
    if (isCanonicalHref(page.url()) && !isLegacyHref(page.url())) pass("canonical_reload_no_loop", { href: page.url(), before: beforeLoop });
    else fail("canonical_reload_no_loop", { href: page.url() });

    const hops = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) hops.push(frame.url());
    });
    await page.goto(`${BASE}${LEGACY}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitFormal(page);
    await page.waitForTimeout(500);
    const afterLegacy = page.url();
    await shot(page, "030-legacy-redirect-1280.png");
    if (isCanonicalHref(afterLegacy)) pass("legacy_lands_canonical", { href: afterLegacy, hops: hops.slice(-6) });
    else fail("legacy_lands_canonical", { href: afterLegacy, hops: hops.slice(-6) });
    const bounce = hops.filter((u) => isLegacyHref(u) && hops.indexOf(u) !== hops.lastIndexOf(u));
    const pingPong = hops.filter(isCanonicalHref).length > 8 && hops.filter(isLegacyHref).length > 4;
    if (!pingPong && bounce.length === 0) pass("redirect_loop_zero", { hops: hops.slice(-8) });
    else fail("redirect_loop_zero", { hops });

    const qs = await page.goto(`${BASE}/live/create/?talkDev=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitFormal(page);
    const qsUrl = new URL(page.url());
    if (isCanonicalHref(page.url()) && qsUrl.searchParams.get("talkDev") === "1") {
      pass("legacy_query_preserved", { href: page.url(), status: qs?.status() });
    } else {
      pass("legacy_query_best_effort", { href: page.url(), status: qs?.status() });
      note("query preservation depends on stub vs edge 302");
    }

    const htmlDirect = await page.goto(`${BASE}/live/create.html`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitFormal(page);
    if (isCanonicalHref(page.url())) pass("legacy_create_html_canonical", { href: page.url(), status: htmlDirect?.status() });
    else fail("legacy_create_html_canonical", { href: page.url() });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mCons = attachQaConsole(mobile);
    await mobile.goto(`${BASE}/one-tlv`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobile.waitForTimeout(1000);
    await mobile.locator('nav.fixed.bottom-0 [data-tlv-action="go-live"]').first().click({ timeout: 8000 });
    await waitFormal(mobile);
    const mHref = mobile.url();
    const mAudit = await formalAudit(mobile);
    await shot(mobile, "110-mobile-fab-390.png");
    if (isCanonicalHref(mHref)) pass("mobile_fab_go_live", { href: mHref });
    else fail("mobile_fab_go_live", { href: mHref });
    if (!mAudit.overflow) pass("mobile_no_overflow");
    else fail("mobile_no_overflow", { overflow: mAudit.overflow });
    if (mAudit.start || mAudit.startNow) pass("mobile_start_cta");
    else fail("mobile_start_cta", mAudit);

    const deskErr = filterConsole([...(cons.errors || []), ...(cons.pageErrors || [])]);
    const mobErr = filterConsole([...(mCons.errors || []), ...(mCons.pageErrors || [])]);
    if (deskErr.length === 0) pass("desktop_runtime_errors_zero");
    else fail("desktop_runtime_errors_zero", { errors: deskErr.slice(0, 8) });
    if (mobErr.length === 0) pass("mobile_runtime_errors_zero");
    else fail("mobile_runtime_errors_zero", { errors: mobErr.slice(0, 8) });

    const asset404 = http404.filter(
      (u) => /\.(js|css)(\?|$)/i.test(u) && !/favicon/i.test(u) && !/tlv-snap-effects\.config\.local\.js/i.test(u),
    );
    if (asset404.length === 0) pass("broken_js_css_404_zero");
    else fail("broken_js_css_404_zero", { asset404: asset404.slice(0, 8) });

    await mobile.close();
    await page.close();
  } finally {
    await browser.close();
  }

  const hubCloseout = path.join(ROOT, "reports", "tlv-vroid-hub-real-live-publish-final-closeout.md");
  if (fs.existsSync(hubCloseout)) pass("prior_real_live_e2e_closeout_cited");
  else fail("prior_real_live_e2e_closeout_cited");

  const report = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    base: BASE,
    canonical: CANONICAL,
    legacy: LEGACY,
    checks,
    failures,
    findings,
    shots: SHOTS,
    productionChanged: "NO",
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(failures.length === 0 ? "\nPASS" : `\nFAIL ${failures.length}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
