#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "detail-skill.html",
      "detail-worker.html",
      "detail-job.html",
      "detail-product.html",
      "detail-shop.html",
      "detail-business-service.html",
      "ai-workspace.html",
      "gen-ai-workspace.html",
      "index-top.html",
      "builder/builder-top.html",
      "index.html",
      "post.html",
      "dashboard.html",
      "chat-list.html",
      "chat-detail.html",
      "my-listings.html",
      "detail-general.html",
      "detail-shop-product.html",
      "builder/threads.html",
      "builder/mvp-project-detail.html",
    ];

export function metrics(text) {
  return {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    eClose: (text.match(/E\/[a-z]+>/gi) || []).length,
    strayE: (text.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<>"']/g) || []).length,
    q2: (text.match(/\?\?/g) || []).length,
    q5: (text.match(/\?{5,}/g) || []).length,
    ebr: (text.match(/Ebr>/g) || []).length,
    garbledE: (text.match(/[ぁ-ん一-龥ァ-ヶ]E[ぁ-ん一-龥ァ-ヶ]/g) || []).length,
  };
}

export function total(m) {
  return m.ufffd + m.eClose + m.strayE + m.q2 + m.q5 + m.ebr + m.garbledE;
}

const rows = [];
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    rows.push({ file: rel, missing: true });
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  const m = metrics(text);
  rows.push({ file: rel, ...m, total: total(m) });
}

rows.sort((a, b) => (b.total || 0) - (a.total || 0));
console.log(JSON.stringify(rows, null, 2));
