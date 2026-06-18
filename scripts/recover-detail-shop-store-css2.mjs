import fs from "fs";

const p =
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/agent-transcripts/a6f2c7a4-db62-42f8-9254-f50780fd61cf/a6f2c7a4-db62-42f8-9254-f50780fd61cf.jsonl";
const outPath = "C:/Users/rubih/tasufull-article/detail-shop-store.css";

const lines = fs.readFileSync(p, "utf8").split("\n");

function unescapeDiff(s) {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

function extractNewStringFromLine(line) {
  const obj = JSON.parse(line);
  const blocks = obj?.message?.content || [];
  for (const b of blocks) {
    if (b?.type !== "tool_use" || b?.name !== "StrReplace") continue;
    const path = (b.input?.path || "").replace(/\\/g, "/");
    if (!path.endsWith("detail-shop-store.css")) continue;
    return b.input?.new_string || "";
  }
  return "";
}

let best = "";
for (const line of lines) {
  if (!line.includes("detail-shop-store.css")) continue;
  try {
    const ns = extractNewStringFromLine(line);
    if (ns.length > best.length) best = ns;
  } catch {
    /* ignore */
  }
}

if (best.length < 3000) {
  console.error("No large StrReplace found, best", best.length);
  process.exit(1);
}

fs.writeFileSync(outPath, best);
console.log("Wrote", best.length, "chars,", best.split("\n").length, "lines");
