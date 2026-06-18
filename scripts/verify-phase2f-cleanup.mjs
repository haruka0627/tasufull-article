#!/usr/bin/env node
/**
 * Phase 2-F verification: ranking regen + deleted HTML refs + full HTML scan.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DELETED = ["legacy-job.html", "job.html", "business-ui-preview.html", "dist/index.html"];

function walkHtml(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function scanRefs() {
  const hits = [];
  const skipDir = new Set(["node_modules", ".git", "backups", "scripts/_step-a-extract"]);
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDir.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "agent-transcripts") continue;
        walk(p);
        continue;
      }
      if (!/\.(html|js|mjs|json|md)$/i.test(e.name)) continue;
      if (path.basename(p) === "verify-phase2f-cleanup.mjs") continue;
      if (e.name.startsWith("_") && dir.includes(`${path.sep}scripts${path.sep}`)) continue;
      if (
        e.name.includes("investigate-phase2") ||
        e.name.includes("_phase2-investigation") ||
        e.name.includes("_diagnostic-output") ||
        e.name === "scan-untracked-html-corruption.mjs"
      ) {
        continue;
      }
      const text = fs.readFileSync(p, "utf8");
      for (const target of DELETED) {
        const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(?<![\\w./-])${escaped}(?![\\w-])`);
        if (re.test(text)) hits.push({ file: path.relative(root, p), target });
      }
    }
  }
  walk(root);
  return hits;
}

const rankingPath = path.join(root, "scripts", "_ranking-sections.html");
const ranking = fs.readFileSync(rankingPath, "utf8");
const rankingOk =
  !/\uFFFD/.test(ranking) &&
  !/\?\?/.test(ranking) &&
  !(ranking.match(/E\/[a-z]+>/gi) || []).length &&
  !(ranking.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) || []).length;

const htmlFiles = walkHtml(root);
const corrupt = [];
const parseFailures = [];
for (const abs of htmlFiles) {
  const rel = path.relative(root, abs);
  const t = fs.readFileSync(abs, "utf8");
  const ufffd = (t.match(/\uFFFD/g) || []).length;
  const eClose = (t.match(/E\/[a-z]+>/gi) || []).length;
  if (ufffd || eClose) corrupt.push({ rel, ufffd, eClose });
  try {
    parse(t);
  } catch (e) {
    parseFailures.push({ rel, error: String(e.message || e) });
  }
}

const refHits = scanRefs();
const deletedGone = DELETED.every((f) => !fs.existsSync(path.join(root, f)));

const result = {
  rankingOk,
  deletedGone,
  refHits,
  htmlCount: htmlFiles.length,
  corruptHtml: corrupt,
  parseFailures,
  ok: rankingOk && deletedGone && refHits.length === 0 && corrupt.length === 0 && parseFailures.length === 0,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
