#!/usr/bin/env node
/**
 * Independent Judge: TLV LIVE Japanese-first i18n.
 * Re-reads source. Does not trust the markdown/json verdict.
 *
 *   node scripts/judge-tlv-golive-i18n-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "tlv-live-japanese-first-i18n-v1.judge.json");
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

check("reuse_existing_i18n_engine", () => {
  const labels = read("live/tlv-go-live-labels-ja.js");
  const html = read("one-tlv-go-live.html");
  assert(/TasuShortVideoI18n/.test(labels), "labels must reuse TasuShortVideoI18n");
  assert(/tasful\.shortVideo\.uiLocale/.test(labels) || /I18n\.STORAGE_KEY/.test(labels), "must reuse shared storage key");
  assert(!/tasful\.tlv\.uiLocale/.test(labels), "must not invent a TLV-only locale key");
  assert(/short-video\/short-video-i18n\.js/.test(html), "Go Live must load short-video-i18n.js");
  assert(/data-sv-ui-locale/.test(html), "language selector missing");
});

check("default_japanese_not_browser_en", () => {
  const labels = read("live/tlv-go-live-labels-ja.js");
  const html = read("one-tlv-go-live.html");
  assert(/DEFAULT_LOCALE = "ja-JP"/.test(labels), "DEFAULT_LOCALE not ja-JP");
  assert(/lang="ja"/.test(html), "html lang not ja");
  assert(!/navigator\.language/.test(labels), "must not auto-switch from navigator.language");
  assert(/配信スタジオ/.test(html), "JA first-paint copy missing");
  assert(!/<html[^>]*lang="en"/.test(html), "html still lang=en");
});

check("ja_en_dict_complete", () => {
  const src = read("live/tlv-go-live-labels-ja.js");
  const jaBlock = src.match(/var JA = \{([\s\S]*?)\n  \};/)?.[1] || "";
  const enBlock = src.match(/var EN = \{([\s\S]*?)\n  \};/)?.[1] || "";
  const keys = (block) => [...block.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  const ja = keys(jaBlock);
  const en = keys(enBlock);
  const jaSet = new Set(ja);
  const enSet = new Set(en);
  assert(ja.length >= 80, "JA dict too small: " + ja.length);
  assert(ja.length === new Set(ja).size, "duplicate JA keys");
  assert(en.length === new Set(en).size, "duplicate EN keys");
  const missingEn = ja.filter((k) => !enSet.has(k));
  const missingJa = en.filter((k) => !jaSet.has(k));
  assert(!missingEn.length && !missingJa.length, JSON.stringify({ missingEn, missingJa }));
  for (const k of [
    "golive.startLive",
    "golive.endLive",
    "golive.cameraDevice",
    "golive.connectVroidHub",
    "golive.myModels",
    "golive.trackingOn",
    "golive.code.BLOCKED_LIVEKIT_CREDENTIALS",
    "golive.code.UNKNOWN_FAIL_CLOSED",
  ]) {
    assert(jaSet.has(k) && enSet.has(k), "missing " + k);
  }
});

check("user_codes_separated", () => {
  const labels = read("live/tlv-go-live-labels-ja.js");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  const service = read("one-tlv-go-live-service.js");
  const hub = read("one-tlv-vroid-hub-client.js");
  assert(/function userMessage/.test(labels), "userMessage helper missing");
  assert(/userMsg\(/.test(adapter) && /userMsg\(/.test(service), "runtime not using userMsg");
  assert(!/Formal Publish Input:/.test(service), "technical confirm still present");
  assert(!/st\.textContent = name/.test(hub), "hub still dumps raw state name");
  assert(/userMsg\(/.test(hub), "hub missing userMsg");
});

check("cta_and_persistence_wired", () => {
  const html = read("one-tlv-go-live.html");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  assert(/data-tlv-go-live-cta="start"/.test(html), "start CTA attr missing");
  assert(/data-tlv-go-live-cta="start-now"/.test(html), "mobile CTA attr missing");
  assert(/tasful:ui-locale-change/.test(adapter), "locale change listener missing");
  assert(/querySelectorAll\("\[data-tlv-go-live-cta\]"\)/.test(adapter), "CTA lookup not data-attr based");
});

check("no_pipeline_or_beauty_rewrite", () => {
  const service = read("one-tlv-go-live-service.js");
  assert(/TasuTlvLiveKitFormal\.startHost/.test(service), "LiveKit startHost removed");
  assert(/assertStartLiveLicense/.test(service), "license gate removed");
  const adapter = read("one-tlv-go-live-data-adapter.js");
  assert(/wireBeautyControls/.test(adapter) && /wireVtuberBasicControls/.test(adapter), "beauty/vtuber wiring removed");
});

check("qa_evidence_present", () => {
  const test = read("scripts/test-tlv-golive-i18n-v1.mjs");
  assert(/390/.test(test) && /selectOption/.test(test), "runtime QA incomplete");
  const report = path.join(ROOT, "reports", "tlv-live-japanese-first-i18n-v1.json");
  assert(fs.existsSync(report), "unit/runtime report missing — run test first");
  const json = JSON.parse(fs.readFileSync(report, "utf8"));
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
console.log(failed.length ? "\nJUDGE: FAIL" : "\nJUDGE: PASS");
process.exit(failed.length ? 1 : 0);
