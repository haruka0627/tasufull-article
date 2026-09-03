#!/usr/bin/env node
/**
 * Independent Judge — TLV Camera Adjust Launch Simplification.
 * Re-reads source + QA JSON. Does not trust the markdown closeout.
 *
 *   node scripts/judge-tlv-camera-adjust-launch-simplification-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "tlv-camera-adjust-launch-simplification-v1.judge.json");
const checks = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, pass: true });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({ name, pass: false, error: error.message });
    console.error("FAIL " + name + ": " + error.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

check("basic_webgl_not_deleted", () => {
  const beauty = read("one-tlv-go-live-beauty.js");
  assert(fs.existsSync(path.join(ROOT, "one-tlv-go-live-beauty.js")), "beauty module missing");
  assert(/gl_FragColor|uBrightness|smoothing/.test(beauty), "shader/grade uniforms removed");
  assert(/AD-040|keep this module/.test(beauty), "AD-040 keep note missing");
});

check("launch_branding_camera_adjust", () => {
  const html = read("one-tlv-go-live.html");
  const labels = read("live/tlv-go-live-labels-ja.js");
  assert(/data-tlv-camera-adjust="1"/.test(html), "camera-adjust attr missing");
  assert(/カメラ調整/.test(html), "JA first-paint missing");
  assert(/"golive.beauty": "Camera Adjust"/.test(labels), "EN semantic name missing");
  assert(/"golive.beauty": "カメラ調整"/.test(labels), "JA semantic name missing");
  assert(!/face_retouching_natural/.test(html), "face beauty icon still launch");
});

check("face_specific_controls_not_public", () => {
  const html = read("one-tlv-go-live.html");
  assert(/data-tlv-camera-adjust-advanced/.test(html), "advanced grade not retained as hidden");
  const adv = html.match(/data-tlv-camera-adjust-advanced[\s\S]{0,120}/g) || [];
  assert(adv.length >= 1 && adv.every((s) => /hidden/.test(s)), "smoothing/skin still public");
  assert(/data-tlv-beauty-param="brightness"/.test(html), "brightness removed");
  assert(/data-tlv-camera-adjust-reset/.test(html), "reset missing");
});

check("snap_tencent_deferred_not_launch", () => {
  const html = read("one-tlv-go-live.html");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  assert(/data-tlv-effects-panel/.test(html) && /hidden/.test(html.match(/<div[^>]*data-tlv-effects-panel[^>]*>/)?.[0] || ""), "effects panel not hidden");
  assert(/isSnapEffectsLaunchSurface/.test(adapter) && /tlvEffectsQa/.test(adapter), "snap launch gate missing");
  assert(/data-tlv-beauty-poc-panel/.test(html) && /hidden/.test(html.match(/<div[^>]*data-tlv-beauty-poc-panel[^>]*>/)?.[0] || ""), "tencent panel visible");
  assert(/data-tlv-beauty-snow-panel/.test(html), "snow poc markup deleted");
});

check("dead_av_hidden_if_unwired", () => {
  const html = read("one-tlv-go-live.html");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  assert(/data-tlv-dead-av-controls/.test(html), "dead av wrapper missing");
  assert(/syncUiOnly/.test(adapter) && /noiseCancel/.test(adapter), "collectDetails should stay; UI hidden only");
});

check("avatar_only_skip_no_vtuber_rewrite", () => {
  const beauty = read("one-tlv-go-live-beauty.js");
  const vtuber = read("one-tlv-go-live-vtuber-basic.mjs");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  assert(/isAvatarOnlyVtuber/.test(beauty) && /getOutputStream/.test(beauty), "skip missing");
  assert(/avatar_only/.test(beauty), "avatar_only reason missing");
  assert(/loadVrmFile/.test(vtuber) && /setCameraVisMode/.test(vtuber), "vtuber engine rewritten");
  assert(/refreshCameraAdjustAfterVtuber/.test(adapter), "vis-mode resync missing");
});

check("no_new_sdk_no_livekit_arch_change", () => {
  const html = read("one-tlv-go-live.html");
  const beauty = read("one-tlv-go-live-beauty.js");
  const service = read("one-tlv-go-live-service.js");
  const livekit = read("live/providers/livekit-live-provider.js");
  assert(!/Banuba|BytePlus/i.test(html + beauty), "new beauty SDK");
  assert(/TasuTlvLiveKitFormal\.startHost/.test(service), "startHost removed");
  assert(/publishTrack/.test(livekit), "LiveKit publish removed");
  assert(/compositedStream/.test(service), "compositedStream contract removed");
});

check("virtual_camera_untouched", () => {
  const media = read("one-tlv-go-live-media-controller.js");
  assert(/videoinput/.test(media), "videoinput path missing");
  assert(!/device\.label.*BeautyCam/.test(media), "vendor detection added");
});

check("qa_evidence_pass", () => {
  const test = read("scripts/test-tlv-camera-adjust-launch-simplification-v1.mjs");
  assert(/390/.test(test) && /avatar_only/.test(test), "runtime QA incomplete");
  const reportPath = path.join(ROOT, "reports", "tlv-camera-adjust-launch-simplification-v1.json");
  assert(fs.existsSync(reportPath), "run test first");
  const json = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(json.ok === true, "runtime report not ok");
});

const failed = checks.filter((c) => !c.pass);
const out = {
  at: new Date().toISOString(),
  judge: "INDEPENDENT",
  verdict: failed.length ? "FAIL" : "PASS",
  checks,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(failed.length ? "\nINDEPENDENT_JUDGE: FAIL" : "\nINDEPENDENT_JUDGE: PASS");
process.exit(failed.length ? 1 : 0);
