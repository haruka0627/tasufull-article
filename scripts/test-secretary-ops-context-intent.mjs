#!/usr/bin/env node
/**
 * OpsContextBuilder intent resolution tests
 *   node scripts/test-secretary-ops-context-intent.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadBuilder() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  const ctx = vm.createContext(sandbox);
  for (const file of ["admin-ai-secretary-ops-context-sanitize.js", "admin-ai-secretary-ops-context.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  }
  return sandbox.window.TasuSecretaryOpsContextBuilder;
}

const Builder = loadBuilder();
const cases = [
  ["Builderだけ見せて", ["builder"]],
  ["Platformだけ", ["platform"]],
  ["Connect問題", ["stripe_connect"]],
  ["Support 通報", ["support"]],
  ["TLVの状況", ["tlv"]],
  ["AI利用状況", ["ai_usage"]],
  ["昨日から増えたもの", null],
];

let pass = 0;
let fail = 0;

for (const [text, expectedDomains] of cases) {
  const intent = Builder.resolveIntent(text);
  if (expectedDomains === null) {
    if (intent.filters?.diffOnly) {
      console.log(`PASS: ${text} → diffOnly`);
      pass += 1;
    } else {
      console.error(`FAIL: ${text} — expected diffOnly`);
      fail += 1;
    }
    continue;
  }
  const got = intent.filters?.domains;
  const ok =
    Array.isArray(got) &&
    got.length === expectedDomains.length &&
    got.every((d, i) => d === expectedDomains[i]);
  if (ok) {
    console.log(`PASS: ${text} → ${got.join(",")}`);
    pass += 1;
  } else {
    console.error(`FAIL: ${text} — got ${JSON.stringify(got)} expected ${expectedDomains.join(",")}`);
    fail += 1;
  }
}

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
process.exit(fail ? 1 : 0);
