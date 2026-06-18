#!/usr/bin/env node
/**
 * Restore broken codemod files from HEAD and re-apply safe Playwright migration.
 *   node scripts/restore-and-remigrate-playwright.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP = new Set([
  "scripts/lib/playwright-browser.mjs",
  "scripts/test-playwright-browser-cleanup.mjs",
  "scripts/test-playwright-leak-compare.mjs",
  "scripts/audit-playwright-browser-leak.mjs",
  "scripts/codemod-playwright-browser-leak.mjs",
  "scripts/restore-and-remigrate-playwright.mjs",
  "scripts/check-playwright-scripts-syntax.mjs",
]);

function rel(f) {
  return path.relative(ROOT, f).replace(/\\/g, "/");
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.mjs$/.test(ent.name)) out.push(p);
  }
  return out;
}

function libImportPath(file) {
  return rel(file).startsWith("scripts/lib/") ? "./playwright-browser.mjs" : "./lib/playwright-browser.mjs";
}

function priority(file) {
  const r = rel(file);
  if (r.startsWith("scripts/capture-")) return 1;
  if (r.startsWith("scripts/verify-")) return 2;
  if (r.startsWith("scripts/audit-")) return 3;
  if (/chromium\.launch/.test(fs.readFileSync(file, "utf8"))) return 4;
  return 99;
}

function gitShow(relPath) {
  try {
    return execSync(`git show HEAD:${relPath}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function hasSyntaxError(file) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

function fixImports(text, file) {
  const libPath = libImportPath(file);
  const libImportRe = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']${libPath.replace(/\./g, "\\.")}[\"'];?`
  );

  text = text.replace(/import\s*\{([^}]*)\}\s*from\s*[\"']playwright[\"'];?/g, (_, inner) => {
    const kept = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => !/^chromium\b/.test(n));
    return kept.length ? `import { ${kept.join(", ")} } from "playwright";` : "";
  });

  const needLib = ["withPlaywrightBrowser", "closeAllBrowsers"];
  const libMatch = text.match(libImportRe);
  if (libMatch) {
    const existing = libMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => n !== "chromium");
    for (const n of needLib) {
      if (!existing.some((e) => e.split(/\s+as\s+/)[0] === n)) existing.push(n);
    }
    text = text.replace(libImportRe, `import { ${[...new Set(existing)].join(", ")} } from "${libPath}";`);
  } else if (/chromium\.launch/.test(text)) {
    const insert = `import { withPlaywrightBrowser, closeAllBrowsers } from "${libPath}";\n`;
    const shebangMatch = text.match(/^#![^\n]*\n/);
    const shebang = shebangMatch ? shebangMatch[0] : "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const m = rest.match(/^((?:import[^\n]+\n)+)/);
    text = m ? shebang + m[1] + insert + rest.slice(m[1].length) : shebang + insert + rest;
  }

  text = text.replace(
    new RegExp(`import\\s*\\{[^}]*\\bchromium\\b[^}]*\\}\\s*from\\s*[\"']${libPath.replace(/\./g, "\\.")}[\"'];?\\n?`, "g"),
    (block) => {
      const names = block
        .match(/\{([^}]*)\}/)[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => !/^chromium\b/.test(n));
      if (!names.length) return "";
      return `import { ${names.join(", ")} } from "${libPath}";\n`;
    }
  );

  return text.replace(/\n{3,}/g, "\n\n");
}

function findLaunchLines(lines) {
  const re = /^(\s*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\s*\(/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) out.push({ index: i, indent: m[1], varName: m[2] });
  }
  return out;
}

function findLastCloseLine(lines, varName, fromIndex) {
  const re = new RegExp(`^\\s*await\\s+${varName}\\.close\\s*\\(`);
  let last = -1;
  for (let i = fromIndex; i < lines.length; i++) {
    if (re.test(lines[i])) last = i;
  }
  return last;
}

function stripBrowserCloseLines(lines, varName, start, end) {
  const re = new RegExp(`^\\s*await\\s+${varName}\\.close`);
  return lines.filter((line, i) => !(i > start && i < end && re.test(line)));
}

function migrateSafe(text) {
  if (/withPlaywrightBrowser/.test(text)) {
    text = text.replace(/\n\s*await\s+browser\.close[^\n]*/g, "");
    return text;
  }
  if (!/chromium\.launch\s*\(/.test(text)) return text;

  let lines = text.split("\n");
  let launches = findLaunchLines(lines);

  for (let li = launches.length - 1; li >= 0; li--) {
    const { index, indent, varName } = launches[li];
    let closeIdx = findLastCloseLine(lines, varName, index);
    if (closeIdx < 0) continue;

    lines[index] = `${indent}await withPlaywrightBrowser(async (browser) => {`;
    lines[closeIdx] = `${indent}});`;

    if (varName !== "browser") {
      for (let j = index + 1; j < closeIdx; j++) {
        lines[j] = lines[j].replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      }
    }

    lines = stripBrowserCloseLines(lines, "browser", index, closeIdx);
    launches = findLaunchLines(lines);
  }

  return lines.join("\n");
}

function addCloseAllBeforeExit(text) {
  if (!/process\.exit\s*\(/.test(text)) {
    if (/withPlaywrightBrowser/.test(text) && !/closeAllBrowsers\s*\(/.test(text)) {
      return `${text.trimEnd()}\n\nawait closeAllBrowsers();\n`;
    }
    return text;
  }
  const lines = text.split("\n");
  const out = [];
  for (const line of lines) {
    if (/^\s*process\.exit\s*\(/.test(line) && !/closeAllBrowsers/.test(out[out.length - 1] || "")) {
      out.push(`${line.match(/^(\s*)/)[1]}await closeAllBrowsers();`);
    }
    out.push(line);
  }
  return out.join("\n");
}

function shouldMigrate(file, text) {
  const r = rel(file);
  if (SKIP.has(r)) return false;
  if (!/chromium\.launch|withPlaywrightBrowser|from\s*[\"']playwright[\"']/.test(text)) return false;
  if (r.startsWith("scripts/capture-")) return true;
  if (r.startsWith("scripts/verify-")) return true;
  if (r.startsWith("scripts/audit-")) return true;
  if (/chromium\.launch/.test(text)) return true;
  return false;
}

function processFile(file) {
  const r = rel(file);
  if (SKIP.has(r)) return { file: r, status: "skipped" };

  let text = fs.readFileSync(file, "utf8");
  const broken = hasSyntaxError(file) || /\}\);\s*\n\s*await browser\.close/.test(text) || /finally\s*\{\s*\n\s*\}\);/.test(text);

  if (broken) {
    const restored = gitShow(r);
    if (restored) {
      text = restored;
      fs.writeFileSync(file, text);
    } else {
      return { file: r, status: "broken-no-git" };
    }
  }

  if (!shouldMigrate(file, text)) return { file: r, status: "no-op" };

  const before = text;
  text = fixImports(text, file);
  text = migrateSafe(text);
  text = addCloseAllBeforeExit(text);

  if (/chromium\.launch\s*\(/.test(text)) {
    return { file: r, status: "manual", remaining: (text.match(/chromium\.launch\s*\(/g) || []).length };
  }

  if (text !== before) fs.writeFileSync(file, text);

  if (hasSyntaxError(file)) return { file: r, status: "syntax-error-after" };

  return { file: r, status: text !== before ? "migrated" : "unchanged" };
}

const files = walk(path.join(ROOT, "scripts")).sort((a, b) => priority(a) - priority(b) || rel(a).localeCompare(rel(b)));
const results = files.map(processFile);
const summary = {
  migrated: results.filter((r) => r.status === "migrated").length,
  unchanged: results.filter((r) => r.status === "unchanged").length,
  manual: results.filter((r) => r.status === "manual"),
  syntaxErrorAfter: results.filter((r) => r.status === "syntax-error-after"),
  brokenNoGit: results.filter((r) => r.status === "broken-no-git"),
  skipped: results.filter((r) => r.status === "skipped").length,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.manual.length) console.log("manual:", summary.manual.map((m) => m.file).join(", "));
if (summary.syntaxErrorAfter.length) console.log("syntax:", summary.syntaxErrorAfter.map((m) => m.file).join(", "));

fs.writeFileSync(path.join(ROOT, "reports/playwright-browser-leak-codemod-result.json"), JSON.stringify({ summary, results }, null, 2));
