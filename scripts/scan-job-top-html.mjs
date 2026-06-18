import fs from "fs";

const t = fs.readFileSync("job-top.html", "utf8");
console.log({
  ufffd: (t.match(/\uFFFD/g) || []).length,
  eClose: (t.match(/E\/[a-z]+>/gi) || []).length,
  stray: (t.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<>"']/g) || []).length,
  q: (t.match(/\?\?/g) || []).length,
});

const set = new Set();
for (const m of t.matchAll(/[^\n]{0,40}(?:\uFFFD|E\/[a-z]+>|E\uFFFD|[ぁ-ん一-龥ァ-ヶ]E[^/\s<"'])[^\n]{0,40}/gi)) {
  set.add(m[0].trim());
}
console.log([...set].join("\n---\n"));
