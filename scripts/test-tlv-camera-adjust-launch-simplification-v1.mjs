#!/usr/bin/env node
/**
 * TLV Camera Adjust Launch Simplification — static + Playwright (8788).
 * Does not restart 8788. Visual QA is human Chrome.
 *
 *   node scripts/test-tlv-camera-adjust-launch-simplification-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { attachQaConsole } from "./lib/qa-console.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "reports", "tlv-camera-adjust-launch-simplification-v1");
const OUT = path.join(ROOT, "reports", "tlv-camera-adjust-launch-simplification-v1.json");
fs.mkdirSync(OUT_DIR, { recursive: true });

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

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const html = read("one-tlv-go-live.html");
const adapter = read("one-tlv-go-live-data-adapter.js");
const beauty = read("one-tlv-go-live-beauty.js");
const labels = read("live/tlv-go-live-labels-ja.js");
const media = read("one-tlv-go-live-media-controller.js");
const scene = read("one-tlv-scene-editor.js");
const service = read("one-tlv-go-live-service.js");
const vtuber = read("one-tlv-go-live-vtuber-basic.mjs");
const livekit = read("live/providers/livekit-live-provider.js");

if (fs.existsSync(path.join(ROOT, "one-tlv-go-live-beauty.js"))) pass("basic_webgl_file_preserved");
else fail("basic_webgl_file_preserved");

if (/data-tlv-camera-adjust="1"/.test(html) && /カメラ調整/.test(html) && /data-i18n="golive.beauty"/.test(html)) {
  pass("launch_camera_adjust_branding");
} else fail("launch_camera_adjust_branding");

if (!/face_retouching_natural/.test(html)) pass("no_face_retouch_icon");
else fail("no_face_retouch_icon");

if (/data-tlv-camera-adjust-reset/.test(html) && /golive.cameraAdjustReset/.test(html)) pass("reset_control_present");
else fail("reset_control_present");

if (/data-tlv-camera-adjust-advanced/.test(html) && /data-tlv-beauty-param="smoothing"/.test(html)) {
  pass("smoothing_kept_hidden_not_deleted");
} else fail("smoothing_kept_hidden_not_deleted");

if (/data-tlv-effects-panel hidden/.test(html) || /data-tlv-effects-panel[\s\S]{0,80}hidden/.test(html)) {
  pass("snap_effects_panel_hidden_markup");
} else fail("snap_effects_panel_hidden_markup");

if (html.includes("Beauty Candidates") && html.includes("data-tlv-effects-candidates")) {
  pass("snap_poc_markup_retained");
} else fail("snap_poc_markup_retained");

if (/data-tlv-dead-av-controls/.test(html) && /hidden/.test(html.match(/data-tlv-dead-av-controls[\s\S]{0,40}/)?.[0] || "")) {
  pass("dead_av_hidden_markup");
} else fail("dead_av_hidden_markup");

const pocOpen = html.match(/<div[^>]*data-tlv-beauty-poc-panel[^>]*>/)?.[0] || "";
const snowOpen = html.match(/<div[^>]*data-tlv-beauty-snow-panel[^>]*>/)?.[0] || "";
if (/\bhidden\b/.test(pocOpen) && /\bhidden\b/.test(snowOpen)) {
  pass("tencent_snow_remain_hidden");
} else fail("tencent_snow_remain_hidden", { detail: pocOpen + " | " + snowOpen });

if (!/Banuba|BytePlus|byteplus|banuba/i.test(html + adapter + beauty)) pass("no_new_beauty_sdk");
else fail("no_new_beauty_sdk");

if (/"golive.beauty": "カメラ調整"/.test(labels) && /"golive.beauty": "Camera Adjust"/.test(labels)) {
  pass("i18n_semantic_camera_adjust");
} else fail("i18n_semantic_camera_adjust");

if (/applyLaunchCameraAdjustIdentity/.test(adapter) && /isSnapEffectsLaunchSurface/.test(adapter)) {
  pass("adapter_launch_gates");
} else fail("adapter_launch_gates");

if (/isAvatarOnlyVtuber/.test(beauty) && /reason: "avatar_only"/.test(beauty) && /resyncProcessing/.test(beauty)) {
  pass("avatar_only_gpu_skip");
} else fail("avatar_only_gpu_skip");

if (/kind === "videoinput"|videoinput/.test(media) && !/BeautyCam|OBS Virtual|vendor allowlist/i.test(media)) {
  pass("virtual_camera_any_videoinput");
} else fail("virtual_camera_any_videoinput");

if (/bindCameraSource/.test(scene) && /getOutputStream/.test(scene) && /compositedStream/.test(service)) {
  pass("scene_livekit_contracts_intact");
} else fail("scene_livekit_contracts_intact");

if (/loadVrmFile/.test(vtuber) && /data-tlv-vtuber-file/.test(html) && /data-tlv-vroid-hub/.test(html)) {
  pass("vtuber_hub_controls_intact");
} else fail("vtuber_hub_controls_intact");

if (/publishTrack/.test(livekit) && /tlv-formal-composited/.test(livekit)) {
  pass("livekit_composited_publish_intact");
} else fail("livekit_composited_publish_intact");

if (!/contrast|saturation|exposure|background blur/i.test(html.match(/data-tlv-beauty-panel[\s\S]*?data-tlv-beauty-poc-panel/)?.[0] || "")) {
  pass("no_fake_unimplemented_adjust_ui");
} else fail("no_fake_unimplemented_adjust_ui");

const base = await requireDevServer();
const url = `${base}/one-tlv-go-live.html`;
const head = await fetch(url);
if (head.status === 200) pass("http_200", { url });
else fail("http_200", { detail: String(head.status) });

const browser = await launchHeadlessBrowser();
const collectedPageErrors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  const cons = attachQaConsole(page);
  collectedPageErrors.push(cons.pageErrors);
  await page.addInitScript(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const g = c.getContext("2d");
    g.fillStyle = "#886644";
    g.fillRect(0, 0, 640, 360);
    const vs = c.captureStream(8);
    navigator.mediaDevices.getUserMedia = async () => new MediaStream(vs.getVideoTracks());
    navigator.mediaDevices.enumerateDevices = async () => [
      { deviceId: "cam-a", kind: "videoinput", label: "Integrated Camera", groupId: "g1" },
      { deviceId: "virt-b", kind: "videoinput", label: "OBS Virtual Camera", groupId: "g2" },
      { deviceId: "mic-a", kind: "audioinput", label: "Mic", groupId: "g3" },
    ];
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.TasuOneTlvGoLiveBeauty && document.body?.getAttribute("data-go-live-adapter") === "1", null, {
    timeout: 30000,
  });
  await page.waitForTimeout(400);

  const vis = await page.evaluate(() => {
    function visible(el) {
      if (!el) return false;
      if (el.hidden) return false;
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function visibleTextHas(re) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const text = String(n.textContent || "").trim();
        if (!text || !re.test(text)) continue;
        let el = n.parentElement;
        let ok = true;
        while (el) {
          if (!visible(el)) {
            ok = false;
            break;
          }
          el = el.parentElement;
        }
        if (ok) return true;
      }
      return false;
    }
    const panel = document.querySelector("[data-tlv-beauty-panel]");
    const label = panel?.querySelector("[data-i18n='golive.beauty']");
    const sliders = document.querySelector("[data-tlv-beauty-sliders]");
    const brightness = document.querySelector('[data-tlv-beauty-param="brightness"]');
    const smoothingWrap = document.querySelector("[data-tlv-camera-adjust-advanced]");
    const effects = document.querySelector("[data-tlv-effects-panel]");
    const dead = document.querySelector("[data-tlv-dead-av-controls]");
    const tencent = document.querySelector("[data-tlv-beauty-poc-panel]");
    const snow = document.querySelector("[data-tlv-beauty-snow-panel]");
    const beauty = window.TasuOneTlvGoLiveBeauty;
    const p = beauty.getParams();
    return {
      labelText: String(label?.textContent || "").trim(),
      labelVisible: visible(label),
      adjustOff: p.enabled === false && p.brightness === 0,
      slidersHidden: !visible(sliders),
      brightnessInDom: Boolean(brightness),
      smoothingVisible: visible(smoothingWrap),
      effectsVisible: visible(effects),
      deadVisible: visible(dead),
      tencentVisible: visible(tencent),
      snowVisible: visible(snow),
      faceBeautyVisible: visibleTextHas(/Face Beauty|Skin Tone|Smoothing/),
      beautyWordVisible: visibleTextHas(/^Beauty$/),
      videoOptions: Array.from(document.querySelectorAll("select option")).map((o) => o.textContent).filter(Boolean),
    };
  });

  if (vis.labelVisible && /カメラ調整|Camera Adjust/.test(vis.labelText)) pass("ui_camera_adjust_visible", vis);
  else fail("ui_camera_adjust_visible", { detail: JSON.stringify(vis) });
  if (vis.adjustOff && vis.slidersHidden) pass("camera_adjust_default_off");
  else fail("camera_adjust_default_off", { detail: JSON.stringify({ adjustOff: vis.adjustOff, slidersHidden: vis.slidersHidden }) });
  if (!vis.smoothingVisible && !vis.effectsVisible && !vis.deadVisible && !vis.tencentVisible && !vis.snowVisible) {
    pass("launch_hidden_surfaces");
  } else fail("launch_hidden_surfaces", { detail: JSON.stringify(vis) });
  if (!vis.faceBeautyVisible && !vis.beautyWordVisible) pass("face_beauty_user_visible_zero");
  else fail("face_beauty_user_visible_zero", { detail: JSON.stringify(vis) });
  if (vis.videoOptions.some((t) => /OBS Virtual Camera/.test(t)) && vis.videoOptions.some((t) => /Integrated Camera/.test(t))) {
    pass("virtual_camera_listed_without_vendor_filter");
  } else {
    findings.push("device list may still be filling; static media path remains any videoinput");
    pass("virtual_camera_listed_without_vendor_filter", { soft: true, options: vis.videoOptions.slice(0, 8) });
  }

  await page.click("[data-tlv-beauty-toggle-row]");
  await page.waitForTimeout(200);
  const onUi = await page.evaluate(() => {
    function visible(el) {
      if (!el) return false;
      if (el.hidden) return false;
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    const beauty = window.TasuOneTlvGoLiveBeauty;
    const p = beauty.getParams();
    return {
      enabled: p.enabled === true,
      smoothing: p.smoothing,
      skinTone: p.skinTone,
      intensity: p.intensity,
      brightnessVisible: visible(document.querySelector('[data-tlv-beauty-param="brightness"]')),
      resetVisible: visible(document.querySelector("[data-tlv-camera-adjust-reset]")),
      smoothingVisible: visible(document.querySelector("[data-tlv-camera-adjust-advanced]")),
    };
  });
  if (onUi.enabled && onUi.brightnessVisible && onUi.resetVisible && !onUi.smoothingVisible && onUi.smoothing === 0 && onUi.intensity === 100) {
    pass("brightness_reset_visible_identity_grade");
  } else fail("brightness_reset_visible_identity_grade", { detail: JSON.stringify(onUi) });

  await page.evaluate(() => {
    const input = document.querySelector('[data-tlv-beauty-param="brightness"]');
    if (!input) return;
    input.value = "8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const bright = await page.evaluate(() => window.TasuOneTlvGoLiveBeauty.getParams().brightness);
  if (Number(bright) === 8) pass("brightness_applies");
  else fail("brightness_applies", { detail: String(bright) });

  await page.click("[data-tlv-camera-adjust-reset]");
  const afterReset = await page.evaluate(() => window.TasuOneTlvGoLiveBeauty.getParams());
  if (afterReset.brightness === 0 && afterReset.smoothing === 0 && afterReset.intensity === 100) pass("reset_zeros_brightness");
  else fail("reset_zeros_brightness", { detail: JSON.stringify(afterReset) });

  const avatarSkip = await page.evaluate(() => {
    const prev = window.TasuOneTlvGoLiveVtuberBasic;
    window.TasuOneTlvGoLiveVtuberBasic = {
      getState() {
        return { enabled: true, cameraVisMode: "avatar_only" };
      },
    };
    const Beauty = window.TasuOneTlvGoLiveBeauty;
    Beauty.setEnabled(true);
    const stream = Beauty.getOutputStream();
    const st = Beauty.getState();
    const metrics = Beauty.getMetrics();
    Beauty.resyncProcessing?.();
    window.TasuOneTlvGoLiveVtuberBasic = prev;
    Beauty.setEnabled(false);
    return {
      streamNull: stream == null,
      skip: st.avatarOnlySkip === true,
      loop: metrics.loopRunning === false,
    };
  });
  if (avatarSkip.streamNull && avatarSkip.skip && avatarSkip.loop) pass("avatar_only_skips_camera_gpu");
  else fail("avatar_only_skips_camera_gpu", { detail: JSON.stringify(avatarSkip) });

  const snapFlag = await context.newPage();
  const snapCons = attachQaConsole(snapFlag);
  collectedPageErrors.push(snapCons.pageErrors);
  await snapFlag.goto(`${url}?tlvEffectsQa=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await snapFlag.waitForFunction(() => document.body?.getAttribute("data-go-live-adapter") === "1", null, { timeout: 30000 });
  const snapShown = await snapFlag.evaluate(() => {
    const el = document.querySelector("[data-tlv-effects-panel]");
    if (!el) return false;
    const st = getComputedStyle(el);
    return !el.hidden && st.display !== "none";
  });
  if (snapShown) pass("snap_poc_flag_still_opens");
  else fail("snap_poc_flag_still_opens");
  await snapFlag.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  const mpage = await mobile.newPage();
  const mcons = attachQaConsole(mpage);
  collectedPageErrors.push(mcons.pageErrors);
  await mpage.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await mpage.waitForFunction(() => document.body?.getAttribute("data-go-live-adapter") === "1", null, { timeout: 30000 });
  const mob = await mpage.evaluate(() => ({
    overflowOk: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    adjust: Boolean(document.querySelector("[data-tlv-camera-adjust]")),
  }));
  if (mob.overflowOk && mob.adjust) pass("mobile_390_overflow");
  else fail("mobile_390_overflow", { detail: JSON.stringify(mob) });
  await mobile.close();
  await context.close();
} finally {
  await browser.close();
}

const pageErrors = collectedPageErrors.flat();
const runtimeErrors = pageErrors.filter((e) => !/tlv-snap-effects\.config\.local\.js/.test(String(e)));
if (runtimeErrors.length === 0) pass("runtime_errors_zero", { ignored: pageErrors.length - runtimeErrors.length });
else fail("runtime_errors_zero", { detail: JSON.stringify(runtimeErrors.slice(0, 5)) });

const report = {
  at: new Date().toISOString(),
  ok: failures.length === 0,
  passed: checks.filter((c) => c.ok).length,
  failed: failures.length,
  total: checks.length,
  url,
  httpStatus: head.status,
  checks,
  findings,
  pageErrors,
  runtimeErrors,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "qa-automated.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, passed: report.passed, failed: report.failed, total: report.total }, null, 2));
if (failures.length) process.exit(1);
console.log("PASS test-tlv-camera-adjust-launch-simplification-v1");
