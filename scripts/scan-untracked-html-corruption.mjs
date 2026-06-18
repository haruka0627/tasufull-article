import fs from "fs";

const targets = [
  "job-top.html",
  "business-ui-preview.html",
  "legacy-job.html",
  "scripts/_ranking-sections.html",
  "dist/index.html",
  "dashboard.html",
  "shop-products.html",
  "business-portal.html",
  "ai-top.html",
  "gen-ai-workspace.html",
  "ai-workspace.html",
];

for (const rel of targets) {
  if (!fs.existsSync(rel)) {
    console.log("MISSING", rel);
    continue;
  }
  const t = fs.readFileSync(rel, "utf8");
  const ff = (t.match(/\uFFFD/g) || []).length;
  const eClose = (t.match(/E\/[a-z]+>/gi) || []).length;
  const stray = (t.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) || []).length;
  const q = (t.match(/\?\?/g) || []).length;
  const ok = !ff && !eClose && !stray && !q;
  console.log(ok ? "OK" : "BAD ", { rel, ff, eClose, stray, q });
}
