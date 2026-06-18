#!/usr/bin/env node
/**
 * Write scripts/.stage-production-files.txt from docs/deploy-git-stage-manifest.json
 * Omits paths that only exist as deletions (handled by git add -u).
 */
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(ROOT, "docs", "deploy-git-stage-manifest.json");
const outPath = path.join(ROOT, "scripts", ".stage-production-files.txt");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const SKIP = new Set(["supabase/.temp/cli-latest"]);

/** Deletions (e.g. dist/*.css) are staged via git add -u only. */
const paths = manifest.stagePaths
  .filter((p) => p && !SKIP.has(p))
  .filter((p) => fs.existsSync(path.join(ROOT, p)))
  .filter((p, i, a) => a.indexOf(p) === i)
  .sort();

fs.writeFileSync(outPath, `${paths.join("\n")}\n`, "utf8");
console.log(`Wrote ${paths.length} paths → ${outPath}`);
