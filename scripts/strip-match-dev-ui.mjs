#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const dir = path.join(ROOT, "match");

for (const f of fs.readdirSync(dir).filter((name) => name.endsWith(".html"))) {
  const filePath = path.join(dir, f);
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;

  html = html.replace(/\s*<span class="match-mock-badge"[^>]*>UI MOCK<\/span>\s*/g, "\n");
  html = html.replace(/\s*<a class="match-review-link"[^>]*>レビュー一覧へ戻る<\/a>\s*/g, "\n");

  if (f === "match-top.html") {
    html = html.replace(/\s*<a href="match-review.html">レビュー一覧<\/a>\s*/g, "");
    html = html.replace(/© TASFUL MATCH — UIモック（未接続）/g, "© TASFUL MATCH");
  }

  if (html !== before) {
    fs.writeFileSync(filePath, html);
    console.log("updated", f);
  }
}
