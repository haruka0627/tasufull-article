/**
 * Phase 1 restore verification
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { parse } from "parse5";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RESTORED = [
  "index-top.html",
  "index.html",
  "business.html",
  "_worker_shared_sections.html",
  "detail-business.html",
  "detail-skill.html",
  "detail-product.html",
  "detail-job.html",
  "detail-worker.html",
  "chat-detail.html",
  "chat-list.html",
  "product.html",
  "skill.html",
  "worker.html",
  "job-top.html",
  "favorites-list.html",
  "detail.html",
];

function walkHtml(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

const restoredScan = RESTORED.map((rel) => {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  const ufffd = (t.match(/\uFFFD/g) || []).length;
  const eMoj = (t.match(/E�|�E|ï¿½/g) || []).length;
  return { rel, ufffd, eMoj, ok: ufffd === 0 && eMoj === 0 };
});

const parseFailures = [];
for (const abs of walkHtml(root)) {
  const rel = path.relative(root, abs);
  try {
    parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    parseFailures.push({ rel, error: String(e.message || e) });
  }
}

const business = fs.readFileSync(path.join(root, "business.html"), "utf8");
const indexTop = fs.readFileSync(path.join(root, "index-top.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const jpChecks = {
  business: {
    title: (business.match(/<title>([^<]+)/) || [])[1],
    hasCompany: business.includes("会社名") || business.includes("サービス名"),
    hasCategory: business.includes("カテゴリー") || business.includes("カテゴリ"),
    hasArea: business.includes("対応地域"),
    hasEstimate: business.includes("見積無料") || business.includes("見積"),
  },
  indexTop: {
    title: (indexTop.match(/<title>([^<]+)/) || [])[1],
    sample: indexTop.includes("TasuFull") || indexTop.includes("TASFUL"),
    noUfffd: !indexTop.includes("\uFFFD"),
  },
  index: {
    title: (index.match(/<title>([^<]+)/) || [])[1],
    hasJapanese: /[\u3040-\u30ff\u4e00-\u9fff]/.test(index.slice(0, 5000)),
    noUfffd: !index.includes("\uFFFD"),
  },
};

const postDiff = execSync("git diff --name-only -- post.html post.js post.css", {
  cwd: root,
  encoding: "utf8",
}).trim();

const gitStat = execSync("git diff --stat", { cwd: root, encoding: "utf8" });

const report = {
  restoredScan,
  allRestoredOk: restoredScan.every((r) => r.ok),
  parseFailures,
  parseOk: parseFailures.length === 0,
  jpChecks,
  untouched: {
    postHtmlDiff: postDiff || "(none — only path if listed)",
    postFilesChanged: postDiff.split(/\n/).filter(Boolean),
  },
  gitDiffStatLines: gitStat.split(/\n/).slice(-5),
};

console.log(JSON.stringify(report, null, 2));
process.exit(
  report.allRestoredOk && report.parseOk && report.untouched.postFilesChanged.length === 0
    ? 0
    : 1
);
