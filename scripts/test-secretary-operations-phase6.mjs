#!/usr/bin/env node
/**
 * AI 秘書 Phase 6 — Operations Engine (Insight · Suggestion · Priority)
 *   node scripts/test-secretary-operations-phase6.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PHASE6_FILES = [
  "admin-ai-secretary-ops-data-provider.js",
  "admin-ai-secretary-insight-engine.js",
  "admin-ai-secretary-priority-engine.js",
  "admin-ai-secretary-suggestion-engine.js",
  "admin-ai-secretary-operations-engine.js",
  "admin-ai-secretary-phase6.js",
];

const LOAD_ORDER = [
  "admin-ai-secretary-ops-data-provider.js",
  "admin-ai-secretary-insight-engine.js",
  "admin-ai-secretary-priority-engine.js",
  "admin-ai-secretary-suggestion-engine.js",
  "admin-ai-secretary-operations-engine.js",
  "admin-ai-secretary-phase6.js",
];

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function loadModules(extra = {}) {
  const sandbox = { global: {}, window: {}, ...extra };
  sandbox.global = sandbox.window;
  for (const name of LOAD_ORDER) {
    const code = fs.readFileSync(path.join(root, name), "utf8");
    vm.runInNewContext(code, sandbox, { filename: name });
  }
  return sandbox;
}

for (const name of PHASE6_FILES) {
  if (fs.existsSync(path.join(root, name))) ok(`file exists: ${name}`);
  else bad(`file exists: ${name}`);
}

let combined = "";
for (const name of PHASE6_FILES) {
  combined += fs.readFileSync(path.join(root, name), "utf8") + "\n";
}

const secretForbidden = [/sk-[a-zA-Z0-9]{10,}/, /\bDEEPSEEK_API_KEY\b/, /Bearer\s+[a-zA-Z0-9_-]{20,}/];
let secretHit = false;
for (const re of secretForbidden) {
  if (re.test(combined)) {
    bad("no secrets in phase6 files", re.toString());
    secretHit = true;
  }
}
if (!secretHit) ok("no secrets in phase6 files");

if (!/\bfetch\s*\(/.test(combined.replace(/readyForAdapter[\s\S]*?sendMessage/, ""))) {
  ok("no fetch in phase6 core (DeepSeek stub only)");
} else bad("no fetch in phase6 core");

if (!combined.includes("executable: false")) bad("action candidates marked non-executable");
else ok("action candidates non-executable");

console.log("\nRunning data provider …");
const ctx = loadModules();
const DP = ctx.global.TasuSecretaryOpsDataProvider;
const mock = DP.createMockDataProvider({ augmentFromGlobals: false });
const fetched = await mock.fetchSnapshots({});
if (fetched.ok && fetched.snapshots.length === 4) ok("mock provider 4 domains");
else bad("mock provider 4 domains", String(fetched.snapshots?.length));

const deepseek = DP.createDeepSeekDataProvider({ augmentFromGlobals: false });
const dsFetched = await deepseek.fetchSnapshots({});
if (dsFetched.providerId === "deepseek" && dsFetched.enrichment?.mode === "stub") ok("deepseek provider stub");
else bad("deepseek provider stub");

console.log("\nRunning insight engine …");
const Insight = ctx.global.TasuSecretaryInsightEngine;
const insights = Insight.analyzeSnapshots(fetched.snapshots);
if (insights.length >= 5) ok(`insights detected (${insights.length})`);
else bad("insights detected", String(insights.length));

const builderInquiry = insights.find((i) => i.metricId === "inquiry_count" && i.domain === "builder");
if (builderInquiry?.title === "問い合わせ急増") ok("builder inquiry surge insight");
else bad("builder inquiry surge insight");

const ngPost = insights.find((i) => i.metricId === "ng_post_count");
if (ngPost?.severity === "critical") ok("platform ng_post critical");
else bad("platform ng_post critical");

console.log("\nRunning priority engine …");
const Priority = ctx.global.TasuSecretaryPriorityEngine;
const prioritized = Priority.sortForDisplay(Priority.classifyInsights(insights));
if (prioritized[0]?.sortScore >= (prioritized[prioritized.length - 1]?.sortScore || 0)) {
  ok("priority sort descending");
} else bad("priority sort descending");

const groups = Priority.groupByPriority(prioritized);
if ((groups.critical?.length || 0) >= 1) ok("priority group critical");
else bad("priority group critical");

console.log("\nRunning suggestion engine …");
const Suggestion = ctx.global.TasuSecretarySuggestionEngine;
const suggestions = Suggestion.buildSuggestions(prioritized);
if (suggestions.length === insights.length) ok("suggestions per insight");
else bad("suggestions per insight", `${suggestions.length}/${insights.length}`);

const builderSug = suggestions.find((s) => s.headline.includes("問い合わせ"));
if (builderSug?.body?.includes("原因分析")) ok("builder suggestion question");
else bad("builder suggestion question", builderSug?.body);

const tlvSug = suggestions.find((s) => s.domain === "tlv" && s.body.includes("広告流入"));
if (tlvSug) ok("tlv registration suggestion");
else bad("tlv registration suggestion");

const allNonExec = suggestions.every((s) => (s.actionCandidates || []).every((a) => a.executable === false));
if (allNonExec) ok("all action candidates non-executable");
else bad("all action candidates non-executable");

console.log("\nRunning operations engine …");
const Engine = ctx.global.TasuSecretaryOperationsEngine;
const analysis = await Engine.runAnalysis({ augmentFromGlobals: false });
if (analysis.ok && analysis.version?.includes("phase6")) ok("operations engine runAnalysis");
else bad("operations engine runAnalysis", analysis.error);

if (analysis.suggestions?.length >= 5 && analysis.groups) ok("operations bundle complete");
else bad("operations bundle complete");

console.log("\nRunning phase6 panel API …");
const Phase6 = ctx.global.TasuAdminAiSecretaryPhase6;
if (typeof Phase6.renderIntelligencePanel === "function") ok("phase6 renderIntelligencePanel");
else bad("phase6 renderIntelligencePanel");

console.log("\nRunning Phase 5 orchestrator isolation …");
const orchPath = path.join(root, "admin-ai-secretary-orchestrator.js");
const orchSrc = fs.readFileSync(orchPath, "utf8");
if (!orchSrc.includes("TasuSecretaryOperationsEngine")) ok("orchestrator independent of phase6 engine");
else bad("orchestrator independent of phase6 engine");
if (fs.existsSync(orchPath)) ok("orchestrator module present");
else bad("orchestrator module present");

console.log(`\n=== AI Secretary Phase 6: ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
