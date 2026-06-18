import fs from "fs";

const t = fs.readFileSync("detail-business-service.html", "utf8");
for (const m of t.matchAll(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g)) {
  console.log(JSON.stringify(m[0]));
}
