#!/usr/bin/env node
/**
 * Independent Judge — TLV Go Live Canonical Route Migration V1.
 * Re-reads source + QA JSON. Does not trust the markdown closeout.
 *
 *   node scripts/judge-tlv-go-live-canonical-route-migration-v1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "tlv-go-live-canonical-route-migration-v1.judge.json");
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

check("canonical_route_is_formal_studio", () => {
  const bridge = read("one-tlv-route-bridge.js");
  const chrome = read("tlv-v0-react/lib/tlv-one-chrome.ts");
  assert(/create:\s*"\/one-tlv-go-live"/.test(bridge), "bridge create not canonical");
  assert(/create: '\/one-tlv-go-live'/.test(chrome), "chrome create not canonical");
  assert(!/create:\s*"\/live\/create\//.test(bridge), "bridge still points at legacy create");
});

check("legacy_create_is_redirect_not_dual_studio", () => {
  const page = read("tlv-v0-react/app/create/page.tsx");
  const stub = read("live/go-live-canonical-redirect.html");
  assert(/CANONICAL_GO_LIVE = '\/one-tlv-go-live'/.test(page), "page redirect missing");
  assert(!/insertBroadcast/.test(page), "V0 studio still mounted on create page");
  assert(/\/one-tlv-go-live/.test(stub) && /location\.replace/.test(stub), "HTML stub missing");
});

check("redirects_exact_no_splat_no_loop", () => {
  const redirects = read("deploy/cloudflare/_redirects");
  const rules = redirects.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  assert(rules.some((l) => /\/live\/create\s+\/one-tlv-go-live\s+302/.test(l)), "missing /live/create rule");
  assert(rules.some((l) => /\/live\/create\/\s+\/one-tlv-go-live\s+302/.test(l)), "missing /live/create/ rule");
  assert(rules.some((l) => /\/live\/create\.html\s+\/one-tlv-go-live\s+302/.test(l)), "missing /live/create.html rule");
  assert(!rules.some((l) => /\/live\/create\/\*/.test(l)), "splat would catch _next or live-create resources");
  assert(!/\/one-tlv-go-live\s+\/live\/create/.test(redirects), "canonical→legacy loop");
  assert(!/\/live\/live-create\.js/.test(redirects), "must not redirect live-create.js");
});

check("user_entrypoints_not_legacy", () => {
  const files = [
    "tlv-v0-react/components/discover/live-discovery-screen.tsx",
    "tlv-v0-react/components/shorts/shorts-discovery-screen.tsx",
    "tlv-v0-react/components/game-live/left-nav.tsx",
    "tlv-v0-react/components/tlv-sidebar.tsx",
    "tlv-v0-react/components/studio/tlv-studio-sidebar.tsx",
    "tlv-v0-react/lib/tlv-settings-contracts.ts",
    "live/live-config.js",
  ];
  for (const rel of files) {
    const src = read(rel);
    assert(!src.includes('href="/live/create/"'), `${rel} still href /live/create/`);
    assert(!/href="\/create"/.test(src), `${rel} still Next /create`);
  }
});

check("live_pipeline_not_rewritten", () => {
  const service = read("one-tlv-go-live-service.js");
  const livekit = read("live/providers/livekit-live-provider.js");
  const html = read("one-tlv-go-live.html");
  assert(/TasuTlvLiveKitFormal\.startHost/.test(service), "startHost removed");
  assert(/compositedStream/.test(service), "compositedStream contract removed");
  assert(/publishTrack/.test(livekit), "LiveKit publish removed");
  assert(/data-tlv-vroid-hub/.test(html), "VRoid Hub markup removed");
  assert(/data-tlv-go-live-cta="start"/.test(html), "START LIVE markup removed");
});

check("qa_evidence_pass", () => {
  const test = read("scripts/test-tlv-go-live-canonical-route-migration-v1.mjs");
  assert(/390/.test(test) && /live\/live-create\.js/.test(test), "runtime QA incomplete");
  const reportPath = path.join(ROOT, "reports", "tlv-go-live-canonical-route-migration-v1.json");
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
console.log("\nINDEPENDENT_JUDGE: " + out.verdict);
process.exit(failed.length ? 1 : 0);
