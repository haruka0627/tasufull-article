#!/usr/bin/env node
/**
 * Restore syntax-error files from git HEAD, then remigrate + repair.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = path.join(ROOT, "reports/syntax-error-files.txt");

function gitShow(rel) {
  try {
    return execSync(`git show "HEAD:${rel}"`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

if (!fs.existsSync(LIST)) {
  console.error("Run node scripts/check-playwright-scripts-syntax.mjs first");
  process.exit(1);
}

const files = fs.readFileSync(LIST, "utf8").trim().split("\n").filter(Boolean);
let restored = 0;
let skipped = 0;
for (const rel of files) {
  const content = gitShow(rel);
  if (content) {
    fs.writeFileSync(path.join(ROOT, rel), content);
    restored++;
  } else skipped++;
}
console.log({ restored, skipped, total: files.length });

execSync("node scripts/remigrate-playwright-safe.mjs", { cwd: ROOT, stdio: "inherit" });
execSync("node scripts/repair-playwright-finally-artifacts.mjs", { cwd: ROOT, stdio: "inherit" });
execSync("node scripts/strip-catch-closeall.mjs", { cwd: ROOT, stdio: "inherit" });
