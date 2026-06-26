#!/usr/bin/env node
/**
 * Builder AI Tool Integration Phase 3 — calc intent + orchestrator
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;

function ok(label, detail = "") {
  pass += 1;
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label, detail = "") {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assert(label, cond, detail = "") {
  if (cond) ok(label, detail);
  else bad(label, detail);
}

function loadStack() {
  const sandbox = { window: {}, globalThis: {}, console, location: { search: "" } };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.BuilderConstructionTools = {
    calculate(id, input) {
      if (id !== "material-calculator") throw new Error("unknown");
      const area = Number(input?.area) || 0;
      const coverage = Number(input?.coverage) || 25;
      return { area, coverage, quantity: coverage > 0 ? Math.ceil(area / coverage) : 0 };
    },
  };
  const ctx = vm.createContext(sandbox);
  for (const rel of [
    "builder/builder-ai-calculators.js",
    "builder/builder-tool-material-calculator.js",
    "builder/builder-ai-calc-intent.js",
    "builder/builder-ai-calc-orchestrator.js",
    "builder/builder-ai-actions.js",
    "builder/builder-ai-context.js",
    "builder/builder-ai-core.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return sandbox;
}

const html = fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8");
assert("html loads calc modules", html.includes("builder-ai-calc-intent.js") && html.includes("builder-ai-calc-orchestrator.js"));
assert("html loads material tool", html.includes("builder-tool-material-calculator.js"));
assert("script order: core before orchestrator", html.indexOf("builder-ai-core.js") < html.indexOf("builder-ai-calc-orchestrator.js"));

const sb = loadStack();
const Intent = sb.TasuBuilderAICalcIntent;
const Orch = sb.TasuBuilderAICalcOrchestrator;

assert("intent: exterior paint", Intent.detect("30坪の外壁塗装の概算を出して").chainId === "exterior_paint");
assert("intent: material cans", Intent.detect("塗料は何缶必要？ 外壁120㎡").chainId === "material_units");
assert("intent: target profit", Intent.detect("利益率25%で見積を作って 原価800000").chainId === "target_profit");
assert("intent: invoice", Intent.detect("インボイス込みで請求額を出して 税込110000").actionId === "invoice_tax_calc");
assert("intent: exterior 120sqm", Intent.detect("外壁120㎡、シリコン2回塗りで材料を出して").chainId === "exterior_paint");

const ext = Orch.runExteriorPaintChain(Intent.detect("30坪の外壁塗装の概算を出して").slots);
assert("chain: 30 tsubo paint", ext.ok && ext.result.cans >= 1, `cans=${ext?.result?.cans}`);

const mat = Orch.runMaterialUnits({ area: 120, coverage: 25, unit: "缶" });
assert("chain: 120sqm cans", mat.ok && mat.result.quantity === 5, `qty=${mat?.result?.quantity}`);

const profit = Orch.runTargetProfitChain({ targetRate: 25, cost: 800000 });
assert("chain: target profit estimate", profit.ok && profit.result.requiredEstimate > 800000, String(profit?.result?.requiredEstimate));

const inv = sb.TasuBuilderAICalculators.run("invoice_tax_calc", "税込 110000 消費税10%");
assert("invoice tax incl", inv.ok && inv.result.incl === 110000);

const asyncTests = async () => {
  const r1 = await Orch.runFromNaturalLanguage({ userText: "外壁120㎡、シリコン2回塗りで材料を出して", preferRemote: false });
  assert("nl: exterior material", r1.ok && /缶/.test(r1.reply));

  const r2 = await Orch.runFromNaturalLanguage({ userText: "利益率25%で見積を作って", preferRemote: false });
  assert("nl: profit needs cost", !r2.ok && /原価/.test(r2.reply));

  const r3 = await Orch.runFromNaturalLanguage({ userText: "利益率25%で見積 原価800000", preferRemote: false });
  assert("nl: profit with cost", r3.ok && /1066667|1,066,667/.test(r3.reply.replace(/,/g, "")));
};

await asyncTests();

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
