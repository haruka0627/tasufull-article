#!/usr/bin/env node
/**
 * Builder Project Hub Phase 6-A tests
 *   node scripts/test-builder-project-hub-phase6a.mjs
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

const storage = {};

function loadStore() {
  const sandbox = {
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = String(v);
      },
      removeItem(k) {
        delete storage[k];
      },
    },
    console,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(
    fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8"),
    sandbox,
    { filename: "builder-project-store.js" }
  );
  return sandbox.TasuBuilderProjectStore;
}

// --- static ---
const hubHtml = fs.readFileSync(path.join(builder, "project-hub.html"), "utf8");
const detailHtml = fs.readFileSync(path.join(builder, "project-detail.html"), "utf8");
const aiHtml = fs.readFileSync(path.join(builder, "builder-ai.html"), "utf8");
const uiJs = fs.readFileSync(path.join(builder, "builder-ai-ui.js"), "utf8");
const storeSrc = fs.readFileSync(path.join(builder, "builder-project-store.js"), "utf8");

assert(hubHtml.includes("builder-project-store.js") && hubHtml.includes("builder-project-hub.js"), "hub html scripts");
assert(detailHtml.includes("builder-project-detail.js"), "detail html scripts");
assert(hubHtml.includes("data-builder-ph-table"), "hub table");
assert(detailHtml.includes("data-builder-pd-timeline"), "detail timeline");
assert(aiHtml.includes("builder-project-store.js"), "builder-ai loads project store");
assert(uiJs.includes("saveDiagnosisToProject"), "builder-ai-ui project save");
assert(storeSrc.includes("saveVisionDiagnosis"), "store vision save");
assert(!storeSrc.includes("TasuAdmin") && !storeSrc.includes("secretary"), "builder-only store");

const Store = loadStore();
Store.clearForTests();
Store.ensureSeed();
const all = Store.listProjects();
assert(all.length >= 3, "seed projects", String(all.length));

const one = Store.getProject("PRJ-2026-001");
assert(one?.name?.includes("外壁"), "get project");

const searched = Store.searchProjects({ q: "水回り", status: "inquiry" });
assert(searched.length === 1 && searched[0].id === "PRJ-2026-002", "search filter");

const diag = {
  version: "1",
  category: "exterior_wall",
  categoryLabel: "外壁",
  condition: "テスト状態",
  checkItems: ["A"],
  possibleCauses: ["B"],
  additionalChecks: ["C"],
  aiComment: "テスト",
  safetyNotice: "本診断はAIの参考診断であり、断定・保証するものではありません。",
};
const saved = Store.saveVisionDiagnosis("PRJ-2026-001", diag, { userText: "外壁診断" });
assert(saved.ok && saved.project.visionDiagnoses.length >= 1, "vision diagnosis saved");
assert(
  saved.project.timeline.some((e) => e.type === "ai_diagnosis"),
  "timeline ai_diagnosis event"
);

const memo = Store.updateProject("PRJ-2026-001", { memo: "更新メモ" });
assert(memo.ok && memo.project.memo === "更新メモ", "memo update");

console.log(`\n--- Phase 6-A unit ${pass}/${pass + fail} ---`);
if (fail) process.exit(1);

console.log("\nRunning vision phase5 regression …");
const p5 = spawnSync("node", ["scripts/test-builder-ai-vision-phase5.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (p5.status !== 0) {
  bad("phase5 vision regression");
  process.exit(1);
}
ok("phase5 vision regression");

console.log("\nRunning build:pages …");
const build = spawnSync("npm", ["run", "build:pages"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  bad("build:pages");
  process.exit(1);
}
ok("build:pages PASS");

assert(fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/project-hub.html")), "dist project-hub");
assert(
  fs.existsSync(path.join(root, "deploy/cloudflare/dist/builder/builder-project-store.js")),
  "dist project store"
);

console.log(`\n=== ALL ${pass}/${pass + fail} PASS ===`);
if (fail) process.exit(1);
