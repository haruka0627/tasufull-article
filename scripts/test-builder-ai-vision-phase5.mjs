#!/usr/bin/env node
/**
 * Builder AI Vision Phase 5 — structured diagnosis / analyzer tests
 *   node scripts/test-builder-ai-vision-phase5.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "builder");

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

function assert(cond, label, detail) {
  if (cond) ok(label);
  else bad(label, detail);
}

const MockFileReader = class {
  readAsDataURL() {
    this.result = "data:image/jpeg;base64,/9j/4AAQ";
    setTimeout(() => this.onload?.(), 0);
  }
};

function loadBuilderModules(extra = {}) {
  const files = [
    "builder-ai-actions.js",
    "builder-ai-context.js",
    "builder-ai-core.js",
    "builder-ai-vision.js",
    "builder-ai-vision-analyzer.js",
  ];
  const sandbox = {
    FileReader: MockFileReader,
    window: {
      FileReader: MockFileReader,
      ...extra,
      document: { readyState: "complete", querySelector() { return null; }, addEventListener() {} },
      addEventListener() {},
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
    },
    console,
  };
  sandbox.window.globalThis = sandbox.window;
  for (const f of files) {
    vm.runInNewContext(fs.readFileSync(path.join(builder, f), "utf8"), sandbox, { filename: f });
  }
  return sandbox.window;
}

const html = fs.readFileSync(path.join(builder, "builder-ai.html"), "utf8");
const ui = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");
const analyzerSrc = fs.readFileSync(path.join(builder, "builder-ai-vision-analyzer.js"), "utf8");
const coreSrc = fs.readFileSync(path.join(builder, "builder-ai-core.js"), "utf8");

const vIdx = html.indexOf("builder-ai-vision.js");
const aIdx = html.indexOf("builder-ai-vision-analyzer.js");
const uiIdx = html.indexOf("builder-ai-ui.js");
assert(vIdx > 0 && aIdx > vIdx && uiIdx > aIdx, "script order: vision → analyzer → ui");
assert(html.includes("data-builder-ai-ui-vision-result"), "vision result UI slot");
assert(ui.includes("setVisionState") && ui.includes("renderVisionDiagnosis"), "ui vision states");
assert(analyzerSrc.includes("TasuBuilderAIVisionAnalyzer"), "analyzer module export");
assert(coreSrc.includes("systemPromptOverride") && coreSrc.includes("rawOutput"), "core structured vision opts");
assert(analyzerSrc.includes("AIの参考診断"), "safety notice unified");
assert(!analyzerSrc.includes("secretary") && !analyzerSrc.includes("deepseek"), "builder isolation");

const win = loadBuilderModules({
  TasuBuilderAIContext: { resolveActor: () => ({ actorType: "partner", label: "協力会社" }) },
  TasuAiModelGateway: null,
});

const A = win.TasuBuilderAIVisionAnalyzer;
assert(A?.DIAGNOSIS_CATEGORIES?.length === 11, "11 diagnosis categories");
assert(A.detectCategory("外壁の補修判断").id === "exterior_wall", "category: 外壁");
assert(A.detectCategory("屋根の状態確認").id === "roof", "category: 屋根");
assert(A.detectCategory("キズが付いた").id === "scratch", "category: キズ");
assert(A.detectCategory("汚れが気になる").id === "stain", "category: 汚れ");

for (const [id, label] of [
  ["exterior_wall", "外壁 mock"],
  ["roof", "屋根 mock"],
  ["scratch", "キズ mock"],
  ["stain", "汚れ mock"],
]) {
  const d = A.mockDiagnosis(id, `${label} test`, true);
  assert(d.category === id && d.checkItems.length > 0, `mock: ${label}`);
  assert(d.safetyNotice.includes("参考診断"), `mock safety: ${label}`);
}

const file = { name: "wall.jpg", type: "image/jpeg", size: 500 };

const winFail = loadBuilderModules({
  TasuBuilderAIContext: { resolveActor: () => ({ actorType: "guest", label: "ゲスト" }) },
  TasuAiModelGateway: {
    completeTurn: async () => ({ reply: "", usedRemote: false, fallback_used: true, apiError: "mock_fail" }),
  },
});

const gatewayFail = await winFail.TasuBuilderAIVisionAnalyzer.analyze({
  userText: "外壁のひびを見てください",
  photoFile: file,
});
assert(gatewayFail.ok && gatewayFail.diagnosis?.category === "exterior_wall", "gateway fail → mock fallback");
assert(gatewayFail.fallback_used, "gateway fail flagged");
assert(gatewayFail.visionState === "complete", "gateway fail → complete state");

const winJson = loadBuilderModules({
  TasuBuilderAIContext: { resolveActor: () => ({ actorType: "guest", label: "ゲスト" }) },
  TasuAiModelGateway: {
    completeTurn: async () => ({
      reply: JSON.stringify({
        version: "1",
        category: "stain",
        categoryLabel: "汚れ",
        condition: "局所シミ",
        checkItems: ["浸透"],
        possibleCauses: ["漏水"],
        additionalChecks: ["触診"],
        aiComment: "清掃候補",
      }),
      usedRemote: true,
      fallback_used: false,
    }),
  },
});

const jsonReply = await winJson.TasuBuilderAIVisionAnalyzer.analyze({
  userText: "汚れの状態を見て",
  photoFile: file,
});
assert(jsonReply.diagnosis?.category === "stain", "structured JSON parse");
assert(jsonReply.usedRemote, "remote JSON path");

const noImg = await win.TasuBuilderAIVisionAnalyzer.analyze({
  userText: "外壁の補修が必要かどうか判断したいです。",
});
assert(noImg.visionState === "no_image" && noImg.photoRequired, "no image guide");

console.log(`\n--- Phase 5 unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("npm run build:pages");
  process.exit(1);
}
ok("build:pages PASS");

assert(
  fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/builder-ai-vision-analyzer.js")),
  "dist analyzer mirror"
);

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
