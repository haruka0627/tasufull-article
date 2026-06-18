/**
 * Site-wide corruption diagnostic (read-only).
 * Usage: node scripts/site-wide-diagnostic.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "parse5";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TARGET_GLOBS = [
  "**/*.html",
  "scripts/**/*.js",
  "scripts/**/*.mjs",
  "assets/js/**/*.js",
  "css/**/*.css",
  "styles/**/*.css",
  "*.css",
  "*.js",
];

const CORRUPTION_PATTERNS = [
  { id: "question_marks", re: /\?{5,}/, label: "?????" },
  { id: "replacement_char", re: /\uFFFD|�/, label: "U+FFFD / �" },
  { id: "broken_label", re: /(?<![<\w])label>/, label: "bare label>" },
  { id: "broken_span", re: /(?<![<\w])span>/, label: "bare span>" },
  { id: "broken_legend", re: /(?<![<\w])legend>/, label: "bare legend>" },
  { id: "broken_fieldset", re: /(?<![<\w])fieldset>/, label: "bare fieldset>" },
  { id: "broken_close_button", re: /<\/button>(?!\s*<)/, label: "stray </button>" },
  { id: "broken_slash_button", re: /\/button>/, label: "/button>" },
  { id: "mojibake_e", re: /E�|�E|Ã|Â|ã|ï¿½/, label: "encoding mojibake fragments" },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".") || name.name === "node_modules" || name.name === "dist") continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function matchesTarget(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (norm.endsWith(".html")) return true;
  if (norm.startsWith("scripts/") && (norm.endsWith(".js") || norm.endsWith(".mjs"))) return true;
  if (norm.startsWith("assets/js/") && norm.endsWith(".js")) return true;
  if (norm.startsWith("css/") && norm.endsWith(".css")) return true;
  if (norm.startsWith("styles/") && norm.endsWith(".css")) return true;
  if (/^[^/]+\.(css|js)$/.test(norm) && !norm.includes("/")) return true;
  return false;
}

function readText(file) {
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) return { text: null, binary: true };
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, binary: false };
}

function countLines(text) {
  return text.split(/\r?\n/).length;
}

function htmlStructuralIssues(text, rel) {
  const issues = [];
  const openTags = (text.match(/<[a-zA-Z][^>]*>/g) || []).length;
  const closeTags = (text.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
  if (Math.abs(openTags - closeTags) > 5) {
    issues.push(`tag_count_skew open=${openTags} close=${closeTags}`);
  }
  if (!/<!DOCTYPE/i.test(text) && !/<html/i.test(text)) {
    issues.push("missing_doctype_or_html");
  }
  if ((text.match(/<html/gi) || []).length !== (text.match(/<\/html>/gi) || []).length) {
    issues.push("html_tag_mismatch");
  }
  if ((text.match(/<head/gi) || []).length !== (text.match(/<\/head>/gi) || []).length) {
    issues.push("head_tag_mismatch");
  }
  if ((text.match(/<body/gi) || []).length !== (text.match(/<\/body>/gi) || []).length) {
    issues.push("body_tag_mismatch");
  }
  return issues;
}

function gitDiffStat(rel) {
  try {
    const out = execSync(`git diff --numstat -- "${rel.replace(/\\/g, "/")}"`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (!out) return { added: 0, deleted: 0, changed: false };
    const [a, d] = out.split(/\s+/);
    return { added: Number(a) || 0, deleted: Number(d) || 0, changed: true };
  } catch {
    return { added: 0, deleted: 0, changed: false };
  }
}

function gitHeadExists(rel) {
  try {
    execSync(`git cat-file -e HEAD:"${rel.replace(/\\/g, "/")}"`, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function japaneseRatio(text) {
  const jp = (text.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
  const letters = (text.match(/[a-zA-Z\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
  return letters ? jp / letters : 0;
}

const allFiles = walk(root).filter((f) => matchesTarget(path.relative(root, f)));

const corruptionHits = [];
const htmlParseFailures = [];
const htmlStructural = [];
const htmlWarnings = [];
const largeDiffs = [];
const untrackedHtml = [];

for (const abs of allFiles.sort()) {
  const rel = path.relative(root, abs);
  const { text, binary } = readText(abs);
  if (binary) continue;

  const diff = gitDiffStat(rel);
  if (diff.changed && diff.added + diff.deleted > 200) {
    largeDiffs.push({ rel, ...diff, total: diff.added + diff.deleted });
  }

  for (const pat of CORRUPTION_PATTERNS) {
    const m = text.match(pat.re);
    if (m) {
      const idx = text.indexOf(m[0]);
      const line = text.slice(0, idx).split(/\r?\n/).length;
      corruptionHits.push({
        rel,
        pattern: pat.label,
        line,
        sample: text.slice(idx, idx + 80).replace(/\s+/g, " ").trim(),
      });
    }
  }

  if (rel.endsWith(".html")) {
    try {
      parse(text);
    } catch (e) {
      htmlParseFailures.push({ rel, error: String(e.message || e) });
    }
    const struct = htmlStructuralIssues(text, rel);
    if (struct.length) htmlStructural.push({ rel, issues: struct });

    const qmarks = (text.match(/\?{5,}/g) || []).length;
    const jpInHead = japaneseRatio(text.slice(0, Math.min(text.length, 8000)));
    if (qmarks > 3) htmlWarnings.push({ rel, qmarks, note: "heavy ????? runs" });
    if (jpInHead < 0.02 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(fs.readFileSync(abs, "latin1").slice(0, 5000))) {
      // skip false positive
    }
  }
}

// untracked html
try {
  const untracked = execSync("git ls-files --others --exclude-standard", {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) => f.endsWith(".html"));
  untracked.forEach((rel) => untrackedHtml.push(rel));
} catch {}

const byFile = new Map();
for (const hit of corruptionHits) {
  if (!byFile.has(hit.rel)) byFile.set(hit.rel, []);
  byFile.get(hit.rel).push(hit);
}

const severityScore = (rel) => {
  const hits = byFile.get(rel) || [];
  let score = hits.length * 10;
  if (htmlParseFailures.some((f) => f.rel === rel)) score += 100;
  if (htmlStructural.some((f) => f.rel === rel)) score += 40;
  if (htmlWarnings.some((f) => f.rel === rel)) score += 30;
  const diff = largeDiffs.find((d) => d.rel === rel);
  if (diff) score += Math.min(diff.total / 50, 50);
  return score;
};

const ranked = [...new Set([
  ...corruptionHits.map((h) => h.rel),
  ...htmlParseFailures.map((h) => h.rel),
  ...htmlStructural.map((h) => h.rel),
  ...htmlWarnings.map((h) => h.rel),
  ...largeDiffs.map((h) => h.rel),
])]
  .map((rel) => ({
    rel,
    score: severityScore(rel),
    corruption: byFile.get(rel) || [],
    parseFail: htmlParseFailures.find((f) => f.rel === rel),
    structural: htmlStructural.find((f) => f.rel === rel),
    diff: largeDiffs.find((d) => d.rel === rel),
    inGitHead: gitHeadExists(rel),
  }))
  .sort((a, b) => b.score - a.score);

const restoreCandidates = ranked.filter(
  (f) => f.score >= 30 && f.inGitHead && f.rel.endsWith(".html")
);
const handFixCandidates = ranked.filter(
  (f) => f.score > 0 && f.score < 30 && !f.parseFail
);

const report = {
  scannedFiles: allFiles.length,
  headCommit: execSync("git log -1 --oneline", { cwd: root, encoding: "utf8" }).trim(),
  summary: {
    filesWithCorruptionPatterns: byFile.size,
    htmlParseFailures: htmlParseFailures.length,
    htmlStructuralWarnings: htmlStructural.length,
    htmlHeavyQuestionMarks: htmlWarnings.length,
    largeGitDiffs: largeDiffs.length,
    untrackedHtml: untrackedHtml.length,
  },
  htmlParseFailures,
  htmlStructuralWarnings: htmlStructural,
  htmlHeavyQuestionMarks: htmlWarnings,
  corruptionByFile: Object.fromEntries(
    [...byFile.entries()].map(([k, v]) => [k, v.map(({ pattern, line, sample }) => ({ pattern, line, sample }))])
  ),
  largeGitDiffs: largeDiffs.sort((a, b) => b.total - a.total).slice(0, 40),
  topSuspectFiles: ranked.slice(0, 25).map(({ rel, score, inGitHead, corruption, parseFail, structural, diff }) => ({
    rel,
    score,
    inGitHead,
    patterns: [...new Set(corruption.map((c) => c.pattern))],
    parseFail: Boolean(parseFail),
    structural: structural?.issues,
    diffLines: diff ? diff.total : 0,
  })),
  restoreFromGitHead: restoreCandidates.map(({ rel, score, patterns: _p, corruption }) => ({
    rel,
    score,
    patterns: [...new Set(corruption.map((c) => c.pattern))],
    reason: "High corruption score + tracked in HEAD — restore then re-apply patches",
  })),
  handFixMaybe: handFixCandidates.slice(0, 20).map(({ rel, score }) => ({ rel, score })),
  untrackedHtml,
  missingDirs: {
    "assets/js": fs.existsSync(path.join(root, "assets/js")),
    css: fs.existsSync(path.join(root, "css")),
    styles: fs.existsSync(path.join(root, "styles")),
  },
};

console.log(JSON.stringify(report, null, 2));
