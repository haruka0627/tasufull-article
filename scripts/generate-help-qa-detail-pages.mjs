#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHelpDetailPage, renderHelpHubPage } from "./lib/help-page-template.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELP = path.join(ROOT, "help");
const GENERATED = path.join(ROOT, "platform-qa-articles.generated.js");

function loadSlugs() {
  const raw = fs.readFileSync(GENERATED, "utf8");
  const marker = "global.PLATFORM_QA_ARTICLES_GENERATED = ";
  const start = raw.indexOf(marker);
  if (start < 0) throw new Error("PLATFORM_QA_ARTICLES_GENERATED not found");
  const jsonStart = start + marker.length;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = jsonStart; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        const json = raw.slice(jsonStart, i + 1);
        const articles = JSON.parse(json);
        return articles.map((a) => a.slug);
      }
    }
  }
  throw new Error("Failed to parse generated articles JSON");
}

fs.writeFileSync(path.join(HELP, "index.html"), renderHelpHubPage(), "utf8");
console.log("[generate-help-qa-detail-pages] wrote help/index.html");

const SLUGS = loadSlugs();
const slugSet = new Set(SLUGS);
let pruned = 0;
for (const ent of fs.readdirSync(HELP, { withFileTypes: true })) {
  if (!ent.isDirectory() || slugSet.has(ent.name)) continue;
  fs.rmSync(path.join(HELP, ent.name), { recursive: true, force: true });
  pruned += 1;
}
if (pruned) console.log(`[generate-help-qa-detail-pages] pruned ${pruned} stale help/ directories`);

let written = 0;
for (const slug of SLUGS) {
  const dir = path.join(HELP, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderHelpDetailPage(slug), "utf8");
  written += 1;
}

console.log(`[generate-help-qa-detail-pages] wrote ${written} detail pages under help/`);
