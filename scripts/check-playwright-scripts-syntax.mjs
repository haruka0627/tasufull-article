#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.mjs$/.test(ent.name)) out.push(p);
  }
  return out;
}

const bad = [];
for (const f of walk(path.join(ROOT, "scripts"))) {
  if (f.includes("codemod-playwright")) continue;
  if (f.endsWith("_debug-talk-save2.mjs")) continue;
  try {
    execSync(`node --check "${f}"`, { stdio: "pipe" });
  } catch {
    bad.push(path.relative(ROOT, f).replace(/\\/g, "/"));
  }
}
console.log("syntax errors:", bad.length);
for (const b of bad) console.log(b);
fs.writeFileSync(path.join(ROOT, "reports/syntax-error-files.txt"), bad.join("\n") + (bad.length ? "\n" : ""));
