/**
 * Phase 2 investigation: untracked HTML recovery sources (read-only).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const histRoot = join(process.env.APPDATA || "", "Cursor", "User", "History");

const TARGETS = [
  "shop-store.html",
  "detail-shop.html",
  "detail-shop-product.html",
  "detail-business-service.html",
  "business-portal.html",
  "job-top.html",
  "ai-top.html",
  "ai-workspace.html",
  "gen-ai-workspace.html",
  "checkout.html",
  "order-complete.html",
  "service-fee-pay.html",
  "business-ui-preview.html",
  "legacy-job.html",
  "scripts/_ranking-sections.html",
  "dist/index.html",
];

function countCorruption(text) {
  const ufffd = (text.match(/\uFFFD/g) || []).length;
  const eMoj = (text.match(/E[^\s<]{0,3}\/(?:span|div|p|a|li|td|th|h[1-6]|button|label|option|strong|em|small|section|header|footer|nav|ul|ol|tr|dt|dd|meta|link|script|style|html|body|head|title)/g) || []).length;
  return { ufffd, eMoj };
}

function decodeResource(uri) {
  try {
    return decodeURIComponent(String(uri).replace(/^file:\/\//, ""));
  } catch {
    return String(uri);
  }
}

function scanCursorHistory() {
  const byTarget = Object.fromEntries(TARGETS.map((t) => [t, []]));
  if (!existsSync(histRoot)) return { histRoot, byTarget, error: "History dir missing" };

  for (const dir of readdirSync(histRoot)) {
    const entriesPath = join(histRoot, dir, "entries.json");
    if (!existsSync(entriesPath)) continue;
    let meta;
    try {
      meta = JSON.parse(readFileSync(entriesPath, "utf8"));
    } catch {
      continue;
    }
    const resource = decodeResource(meta.resource || "");
    if (!resource.includes("tasufull-article")) continue;

    for (const target of TARGETS) {
      if (!resource.replace(/\\/g, "/").endsWith(target.replace(/\\/g, "/"))) continue;
      const entries = (meta.entries || []).map((e) => {
        const snap = join(histRoot, dir, e.id);
        let snapUfffd = null;
        let snapBytes = null;
        if (existsSync(snap)) {
          const t = readFileSync(snap, "utf8");
          snapUfffd = countCorruption(t).ufffd;
          snapBytes = statSync(snap).size;
        }
        return {
          id: e.id,
          timestamp: e.timestamp,
          source: e.source || null,
          exists: existsSync(snap),
          bytes: snapBytes,
          ufffd: snapUfffd,
          clean: snapUfffd === 0,
        };
      });
      byTarget[target].push({ resource, historyDir: join(histRoot, dir), entries });
    }
  }
  return { histRoot, byTarget };
}

function gitNeverCommitted(file) {
  try {
    const out = execSync(`git log --all --oneline -- "${file}"`, { cwd: root, encoding: "utf8" }).trim();
    return out ? out.split("\n")[0] : null;
  } catch {
    return null;
  }
}

function findJsSibling(htmlPath) {
  const base = htmlPath.replace(/\.html$/, "");
  const js = `${base}.js`;
  const css = `${base}.css`;
  return {
    js: existsSync(join(root, js)) ? js : null,
    css: existsSync(join(root, css)) ? css : null,
    jsUfffd: existsSync(join(root, js)) ? countCorruption(readFileSync(join(root, js), "utf8")).ufffd : null,
  };
}

function inferRegen(htmlPath, siblings) {
  const notes = [];
  const trackedSimilar = {
    "shop-store.html": ["business.html", "index.html"],
    "detail-shop.html": ["detail-business.html"],
    "detail-shop-product.html": ["detail-product.html"],
    "detail-business-service.html": ["detail-business.html"],
    "job-top.html": ["job.html", "index-top.html"],
    "legacy-job.html": ["job.html"],
    "checkout.html": ["post.html"],
    "order-complete.html": ["checkout.html"],
    "service-fee-pay.html": ["checkout.html"],
    "dist/index.html": ["index.html", "index-top.html"],
    "business-portal.html": ["business.html", "index-top.html"],
    "business-ui-preview.html": ["business.html"],
    "ai-top.html": ["index-top.html"],
    "ai-workspace.html": ["gen-ai-workspace.html"],
    "scripts/_ranking-sections.html": ["index-top.html"],
  };
  if (siblings.js) notes.push(`paired JS exists: ${siblings.js} (U+FFFD=${siblings.jsUfffd})`);
  if (trackedSimilar[htmlPath]) notes.push(`similar tracked: ${trackedSimilar[htmlPath].join(", ")}`);
  if (htmlPath === "gen-ai-workspace.html") notes.push("many test scripts assert data-* selectors in HTML");
  if (htmlPath === "dist/index.html") notes.push("vite build artifact — rebuild from index.html");
  return notes;
}

const history = scanCursorHistory();
const report = [];

for (const rel of TARGETS) {
  const abs = join(root, rel);
  const exists = existsSync(abs);
  const corruption = exists ? countCorruption(readFileSync(abs, "utf8")) : null;
  const git = gitNeverCommitted(rel);
  const siblings = findJsSibling(rel);
  const histEntries = history.byTarget[rel] || [];
  const cleanSnaps = [];
  for (const h of histEntries) {
    for (const e of h.entries) {
      if (e.exists && e.clean) cleanSnaps.push({ ...e, historyDir: h.historyDir });
    }
  }
  report.push({
    file: rel,
    exists,
    bytes: exists ? statSync(abs).size : 0,
    ufffd: corruption?.ufffd ?? null,
    eMoj: corruption?.eMoj ?? null,
    gitHistory: git ? git : "never committed",
    cursorHistoryBuckets: histEntries.length,
    cleanHistorySnapshots: cleanSnaps.length,
    bestCleanSnapshot: cleanSnaps.sort((a, b) => b.timestamp - a.timestamp)[0] || null,
    siblings,
    regenNotes: inferRegen(rel, siblings),
  });
}

console.log(JSON.stringify({ historyRoot: history.histRoot, branches: execSync("git branch -a", { cwd: root, encoding: "utf8" }).trim().split("\n"), stash: execSync("git stash list", { cwd: root, encoding: "utf8" }).trim() || "(empty)", report }, null, 2));
