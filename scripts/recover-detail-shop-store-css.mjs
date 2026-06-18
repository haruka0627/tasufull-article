import fs from "fs";

const transcriptPaths = [
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/agent-transcripts/a6f2c7a4-db62-42f8-9254-f50780fd61cf/a6f2c7a4-db62-42f8-9254-f50780fd61cf.jsonl",
  "C:/Users/rubih/.cursor/projects/c-Users-rubih-tasufull-article/agent-transcripts/21e7283b-c1c5-47c1-89ec-1bc8b91abbec/21e7283b-c1c5-47c1-89ec-1bc8b91abbec.jsonl",
];

const outPath = "C:/Users/rubih/tasufull-article/detail-shop-store.css";

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function extractFromToolUse(obj) {
  const blocks = obj?.message?.content;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (block?.type !== "tool_use") continue;
    const path = block?.input?.path || "";
    if (!path.replace(/\\/g, "/").endsWith("detail-shop-store.css")) continue;
    if (block.name === "Write" && block.input?.contents) {
      return { kind: "write", text: block.input.contents, len: block.input.contents.length };
    }
    if (block.name === "StrReplace" && block.input?.new_string) {
      return {
        kind: "replace",
        text: block.input.new_string,
        old: block.input.old_string || "",
        len: (block.input.new_string || "").length,
      };
    }
  }
  return null;
}

let bestWrite = null;
let patches = [];

for (const p of transcriptPaths) {
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const obj = parseLine(lines[i]);
    if (!obj) continue;
    const hit = extractFromToolUse(obj);
    if (!hit) continue;
    if (hit.kind === "write" && (!bestWrite || hit.len > bestWrite.len)) {
      bestWrite = { ...hit, line: i + 1, file: p };
    }
    if (hit.kind === "replace") {
      patches.push({ ...hit, line: i + 1, file: p });
    }
  }
}

if (bestWrite) {
  fs.writeFileSync(outPath, bestWrite.text);
  console.log("Restored from Write:", bestWrite.len, "chars, line", bestWrite.line);
  process.exit(0);
}

// Reconstruct from largest diff chunk in raw lines
let bestDiff = "";
for (const p of transcriptPaths) {
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf8").split("\n");
  for (const line of lines) {
    if (!line.includes("detail-shop-store.css")) continue;
    if (line.includes("shop-detail-page") && line.length > bestDiff.length) {
      bestDiff = line;
    }
  }
}

if (bestDiff.includes("\\n+")) {
  const chunks = bestDiff.split("\\n+").slice(1);
  const text =
    "/* detail-shop.html — 仕上げ用（shop_store 専用） */\n" +
    chunks
      .map((c) => c.replace(/\\n/g, "\n").replace(/^ /, "").replace(/\\"/g, '"'))
      .join("\n");
  if (text.length > 5000) {
    fs.writeFileSync(outPath, text);
    console.log("Restored from diff fragment:", text.length);
    process.exit(0);
  }
}

console.log("Could not restore. Patches:", patches.length, "bestWrite:", bestWrite?.len || 0);
process.exit(1);
