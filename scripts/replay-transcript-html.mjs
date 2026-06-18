/**
 * Replay transcript Write + StrReplace chain to reconstruct clean HTML.
 * Read-only diagnostic; optional --write-out path
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRANSCRIPT = join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-rubih-tasufull-article",
  "agent-transcripts",
  "1f9951ce-8378-42ff-a3b9-8d56d2481616",
  "1f9951ce-8378-42ff-a3b9-8d56d2481616.jsonl",
);

const target = process.argv[2];
const outPath = process.argv[3];
if (!target) {
  console.error("Usage: node replay-transcript-html.mjs <file.html> [outPath]");
  process.exit(1);
}

function normPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/^c:/, "");
}

function countCorruption(text) {
  return {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    eMoj: (
      text.match(
        /E[^\s<]{0,3}\/(?:span|div|p|a|li|td|th|h[1-6]|button|label|option|strong|em|small|section|header|footer|nav|ul|ol|tr|dt|dd|meta|link|script|style|html|body|head|title)/g,
      ) || []
    ).length,
  };
}

const ops = [];
const raw = readFileSync(TRANSCRIPT, "utf8");
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  const ts = row.timestamp || 0;
  for (const part of row?.message?.content || []) {
    if (part?.type !== "tool_use") continue;
    const p = normPath(part?.input?.path);
    if (!p.endsWith("/" + target.toLowerCase())) continue;
    if (part.name === "Write" && typeof part.input?.contents === "string") {
      ops.push({ kind: "Write", ts, content: part.input.contents });
    }
    if (part.name === "StrReplace") {
      ops.push({
        kind: "StrReplace",
        ts,
        old_string: part.input?.old_string ?? "",
        new_string: part.input?.new_string ?? "",
        replace_all: !!part.input?.replace_all,
      });
    }
  }
}

ops.sort((a, b) => a.ts - b.ts);

let html = "";
let writeCount = 0;
let replaceOk = 0;
let replaceFail = 0;
const failed = [];

for (const op of ops) {
  if (op.kind === "Write") {
    html = op.content;
    writeCount++;
    continue;
  }
  const { old_string, new_string, replace_all } = op;
  if (!old_string || html.indexOf(old_string) === -1) {
    replaceFail++;
    failed.push({ reason: "old_string not found", preview: old_string.slice(0, 80) });
    continue;
  }
  if (replace_all) {
    html = html.split(old_string).join(new_string);
  } else {
    html = html.replace(old_string, new_string);
  }
  replaceOk++;
}

const cur = existsSync(join(root, target)) ? readFileSync(join(root, target), "utf8") : "";
const curScripts = (cur.match(/<script/g) || []).length;
const repScripts = (html.match(/<script/g) || []).length;
const curData = new Set([...(cur.matchAll(/\s(data-[a-z0-9-]+)=/gi))].map((m) => m[1]));
const repData = new Set([...(html.matchAll(/\s(data-[a-z0-9-]+)=/gi))].map((m) => m[1]));
const missingData = [...curData].filter((d) => !repData.has(d));
const extraData = [...repData].filter((d) => !curData.has(d));

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
}

console.log(
  JSON.stringify(
    {
      target,
      writeCount,
      replaceOps: ops.filter((o) => o.kind === "StrReplace").length,
      replaceOk,
      replaceFail,
      replayBytes: html.length,
      currentBytes: cur.length,
      replayLines: html.split("\n").length,
      currentLines: cur.split("\n").length,
      replayCorruption: countCorruption(html),
      currentCorruption: countCorruption(cur),
      scripts: { current: curScripts, replay: repScripts },
      dataAttrs: {
        current: curData.size,
        replay: repData.size,
        missingInReplay: missingData.slice(0, 20),
        extraInReplay: extraData.slice(0, 20),
        missingCount: missingData.length,
      },
      failedSamples: failed.slice(0, 8),
      outPath: outPath || null,
    },
    null,
    2,
  ),
);
