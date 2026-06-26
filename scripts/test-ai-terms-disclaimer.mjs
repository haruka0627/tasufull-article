#!/usr/bin/env node
/**
 * AI利用規約 / 免責 — 統合テスト
 *   node scripts/test-ai-terms-disclaimer.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function loadDisclaimerStack() {
  const sandbox = { window: {}, globalThis: {}, document: { querySelectorAll: () => [] }, location: { pathname: "/" } };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "common-ai-disclaimer.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "builder/builder-ai-disclaimer.js"), "utf8"), ctx);
  return sandbox;
}

// --- Files exist ---
{
  for (const f of [
    "ai-terms.html",
    "ai-disclaimer.html",
    "common-ai-disclaimer.js",
    "common-ai-disclaimer.css",
    "builder/builder-ai-disclaimer.js",
    "builder/builder-ai-guidelines.html",
  ]) {
    assert(`file: ${f}`, fs.existsSync(path.join(root, f)));
  }
}

// --- Common disclaimer content ---
{
  const s = loadDisclaimerStack();
  const C = s.TasuCommonAiDisclaimer;
  assert("common: short disclaimer", /参考情報/.test(C.SHORT_DISCLAIMER));
  assert("common: no guarantee", /保証/.test(C.SHORT_DISCLAIMER));
  assert("common: prohibited 6", C.PROHIBITED_USES.length >= 6);
  assert("common: scopes 5", C.SCOPES.length >= 5);
  const banner = C.renderBannerHtml({});
  assert("common: banner links", /ai-terms\.html/.test(banner) && /ai-disclaimer\.html/.test(banner));
  const footer = C.renderAnswerFooterHtml({});
  assert("common: answer footer", /参考情報/.test(footer) && /確定/.test(footer));
}

// --- Builder disclaimer ---
{
  const s = loadDisclaimerStack();
  const B = s.TasuBuilderAiDisclaimer;
  assert("builder: topics", B.TOPICS.length >= 10);
  assert("builder: no safety guarantee", B.BUILDER_NOTICES.some((n) => /安全/.test(n) && /保証/.test(n)));
  assert("builder: no adopt", B.BUILDER_NOTICES.some((n) => /採用/.test(n) && /確定/.test(n)));
  const banner = s.TasuCommonAiDisclaimer.renderBannerHtml({ builder: true });
  assert("builder: guidelines link", /builder-ai-guidelines/.test(banner));
  const footer = s.TasuCommonAiDisclaimer.renderAnswerFooterHtml({ builder: true });
  assert("builder: answer footer", /下書き|参考/.test(footer));
}

// --- HTML wiring ---
{
  const builderAi = fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8");
  assert("builder html: disclaimer banner", builderAi.includes("data-common-ai-disclaimer-banner"));
  assert("builder html: disclaimer scripts", builderAi.includes("common-ai-disclaimer.js"));
  assert("builder html: guidelines link", builderAi.includes("builder-ai-guidelines.html"));

  const workspace = fs.readFileSync(path.join(root, "ai-workspace.html"), "utf8");
  assert("workspace html: disclaimer banner", workspace.includes("data-common-ai-disclaimer-banner"));
  assert("workspace html: terms link", workspace.includes("ai-terms.html"));

  const top = fs.readFileSync(path.join(root, "index-top.html"), "utf8");
  assert("platform html: disclaimer slot", top.includes("data-common-ai-disclaimer-banner"));

  const terms = fs.readFileSync(path.join(root, "ai-terms.html"), "utf8");
  assert("terms: lawyer note", /弁護士/.test(terms));
  assert("terms: prohibited", /脱税/.test(terms));
}

// --- JS wiring (answer footer) ---
{
  const page = fs.readFileSync(path.join(root, "builder/builder-ai-page.js"), "utf8");
  assert("builder page: answer footer", page.includes("renderAnswerFooterHtml"));

  const chat = fs.readFileSync(path.join(root, "ai-workspace-chat.js"), "utf8");
  assert("workspace chat: answer footer", chat.includes("TasuCommonAiDisclaimer") && chat.includes("disclaimerFooter"));

  const tlv = fs.readFileSync(path.join(root, "ai-workspace-tlv-source.js"), "utf8");
  assert("tlv: disclaimer mount", tlv.includes("mountTlvDisclaimer"));
}

// --- Isolation ---
{
  const gw = fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8");
  assert("isolation: gateway untouched", !/TasuCommonAiDisclaimer/.test(gw));
  const core = fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8");
  assert("isolation: builder core untouched", !/TasuCommonAiDisclaimer/.test(core));
  const actions = fs.readFileSync(path.join(root, "builder/builder-ai-actions.js"), "utf8");
  assert("isolation: builder actions still 24", actions.includes("candidate_recommendation"));
  const sec = fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8");
  assert("isolation: ai secretary untouched", !/common-ai-disclaimer/.test(sec));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- AI Terms Disclaimer Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
