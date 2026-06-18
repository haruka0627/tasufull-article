/**
 * Step A: Extract HTML from Agent transcript Write ops (read-only report).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "scripts", "_step-a-extract");
mkdirSync(outDir, { recursive: true });

const TARGETS = [
  { html: "gen-ai-workspace.html", js: "gen-ai-workspace.js" },
  { html: "ai-top.html", js: null },
  { html: "ai-workspace.html", js: "ai-workspace-chat.js" },
  { html: "business-portal.html", js: null },
];

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

function normPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/^c:/, "");
}

function countCorruption(text) {
  return {
    ufffd: (text.match(/\uFFFD/g) || []).length,
    eMoj: (text.match(/E[^\s<]{0,3}\/(?:span|div|p|a|li|td|th|h[1-6]|button|label|option|strong|em|small|section|header|footer|nav|ul|ol|tr|dt|dd|meta|link|script|style|html|body|head|title)/g) || []).length,
  };
}

function isCompleteHtml(text) {
  const t = String(text || "").trim();
  return (
    t.startsWith("<!DOCTYPE") &&
    /<\/html>\s*$/i.test(t) &&
    t.length > 500
  );
}

function extractSelectorsFromJs(jsPath) {
  if (!jsPath || !existsSync(join(root, jsPath))) return [];
  const js = readFileSync(join(root, jsPath), "utf8");
  const sels = new Set();
  for (const m of js.matchAll(/querySelector(?:All)?\(\s*['"`](\[[^\`'"]+\])['"`]/g)) {
    sels.add(m[1]);
  }
  for (const m of js.matchAll(/\$\(\s*['"`](\[[^\`'"]+\])['"`]/g)) {
    sels.add(m[1]);
  }
  return [...sels];
}

function extractDataAttrsFromHtml(html) {
  const attrs = new Set();
  for (const m of html.matchAll(/\s(data-[a-z0-9-]+)=/gi)) attrs.add(m[1]);
  return [...attrs];
}

function diffSummary(current, extracted) {
  const curLines = current.split("\n").length;
  const extLines = extracted.split("\n").length;
  let added = 0;
  let removed = 0;
  try {
    writeFileSync(join(outDir, "_cur.tmp"), current, "utf8");
    writeFileSync(join(outDir, "_ext.tmp"), extracted, "utf8");
    const stat = execSync(`git diff --numstat -- "${join(outDir, "_cur.tmp")}" "${join(outDir, "_ext.tmp")}"`, {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (stat) {
      const [a, r] = stat.split(/\s+/);
      added = Number(a) || 0;
      removed = Number(r) || 0;
    }
  } catch {
    /* fallback: rough line delta */
    added = Math.max(0, extLines - curLines);
    removed = Math.max(0, curLines - extLines);
  }
  return { curLines, extLines, added, removed, lineDelta: extLines - curLines };
}

function jsIntegrity(html, jsPath) {
  const selectors = extractSelectorsFromJs(jsPath);
  const missing = selectors.filter((s) => !html.includes(s));
  const currentHtml = existsSync(join(root, TARGETS.find((t) => t.js === jsPath)?.html || ""))
    ? readFileSync(join(root, TARGETS.find((t) => t.js === jsPath)?.html || ""), "utf8")
    : "";
  const curMissing = selectors.filter((s) => !currentHtml.includes(s));
  return { selectorCount: selectors.length, missingInExtract: missing, missingInCurrent: curMissing };
}

/** Parse JSONL and collect all Write contents for target HTML files. */
function collectWrites() {
  const raw = readFileSync(TRANSCRIPT, "utf8");
  const byFile = Object.fromEntries(TARGETS.map((t) => [t.html, []]));

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const parts = row?.message?.content;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part?.type !== "tool_use" || part?.name !== "Write") continue;
      const path = normPath(part?.input?.path);
      const contents = part?.input?.contents;
      if (typeof contents !== "string") continue;
      for (const t of TARGETS) {
        if (path.endsWith("/" + t.html.toLowerCase()) || path.endsWith(t.html.toLowerCase())) {
          byFile[t.html].push({
            path: part.input.path,
            bytes: contents.length,
            complete: isCompleteHtml(contents),
            corruption: countCorruption(contents),
            contents,
          });
        }
      }
    }
  }
  return byFile;
}

const writes = collectWrites();
const report = [];

for (const { html, js } of TARGETS) {
  const entries = writes[html] || [];
  const complete = entries.filter((e) => e.complete);
  const cleanComplete = complete.filter((e) => e.corruption.ufffd === 0);
  const best =
    cleanComplete.sort((a, b) => b.bytes - a.bytes)[0] ||
    complete.sort((a, b) => b.bytes - a.bytes)[0] ||
    entries.sort((a, b) => b.bytes - a.bytes)[0] ||
    null;

  const currentPath = join(root, html);
  const current = existsSync(currentPath) ? readFileSync(currentPath, "utf8") : "";
  const curCor = countCorruption(current);

  let extractStatus = "failed";
  let restorable = false;
  let restoreNote = "";
  let diff = null;
  let jsCheck = null;
  let scriptTagsCur = [];
  let scriptTagsExt = [];

  if (best) {
    extractStatus = best.complete ? (best.corruption.ufffd === 0 ? "success" : "partial") : "fragment";
    writeFileSync(join(outDir, html), best.contents, "utf8");

    if (best.complete && best.corruption.ufffd === 0) {
      restorable = true;
      restoreNote = "完全HTML・U+FFFD 0 — そのまま復元候補（後続パッチ要確認）";
    } else if (best.complete) {
      restoreNote = `完全HTMLだが U+FFFD=${best.corruption.ufffd} — そのまま復元不可`;
    } else {
      restoreNote = "Write は存在するが完全HTMLではない";
    }

    diff = diffSummary(current, best.contents);
    scriptTagsCur = [...current.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    scriptTagsExt = [...best.contents.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);

    if (js) {
      jsCheck = jsIntegrity(best.contents, js);
    }
  } else {
    restoreNote = "Agent Write に該当HTMLが見つからない";
  }

  report.push({
    file: html,
    writeOpsTotal: entries.length,
    writeOpsComplete: complete.length,
    writeOpsCleanComplete: cleanComplete.length,
    extractStatus,
    extractedBytes: best?.bytes ?? 0,
    extractedUfffd: best?.corruption.ufffd ?? null,
    extractedEMoj: best?.corruption.eMoj ?? null,
    currentBytes: current.length,
    currentUfffd: curCor.ufffd,
    currentEMoj: curCor.eMoj,
    diff,
    scriptTags: {
      current: scriptTagsCur,
      extracted: scriptTagsExt,
      onlyInCurrent: scriptTagsCur.filter((s) => !scriptTagsExt.includes(s)),
      onlyInExtracted: scriptTagsExt.filter((s) => !scriptTagsCur.includes(s)),
    },
    jsCheck,
    restorable,
    restoreNote,
    extractPath: best ? join(outDir, html) : null,
  });
}

const success = report.filter((r) => r.extractStatus === "success").length;
const partial = report.filter((r) => r.extractStatus === "partial" || r.extractStatus === "fragment").length;
const failed = report.filter((r) => r.extractStatus === "failed").length;
const restorableCount = report.filter((r) => r.restorable).length;

const summary = {
  transcript: TRANSCRIPT,
  extractOutDir: outDir,
  targets: 4,
  extractSuccess: success,
  extractPartial: partial,
  extractFailed: failed,
  restorableAsIs: restorableCount,
  restoreSuccessRate: `${Math.round((restorableCount / 4) * 100)}%`,
  report,
};

writeFileSync(join(outDir, "report.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
