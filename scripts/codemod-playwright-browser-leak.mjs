#!/usr/bin/env node
/**
 * Bulk migrate Playwright scripts → withPlaywrightBrowser + closeAllBrowsers
 *   node scripts/codemod-playwright-browser-leak.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const SKIP = new Set([
  "scripts/lib/playwright-browser.mjs",
  "scripts/test-playwright-browser-cleanup.mjs",
  "scripts/test-playwright-leak-compare.mjs",
  "scripts/audit-playwright-browser-leak.mjs",
  "scripts/codemod-playwright-browser-leak.mjs",
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
  const r = rel(file);
  if (r.startsWith("scripts/lib/")) return "./playwright-browser.mjs";
  return "./lib/playwright-browser.mjs";
}

function priority(file) {
  const r = rel(file);
  if (r.startsWith("scripts/capture-")) return 1;
  if (r.startsWith("scripts/verify-")) return 2;
  if (r.startsWith("scripts/audit-")) return 3;
  if (/chromium\.launch|launchHeadlessBrowser/.test(fs.readFileSync(file, "utf8"))) return 4;
  return 99;
}

function fixImports(text, file) {
  const libPath = libImportPath(file);
  const libImportRe = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']${libPath.replace(/\./g, "\\.")}[\"'];?`
  );
  const playwrightRe = /import\s*\{([^}]*)\}\s*from\s*[\"']playwright[\"'];?/g;

  let playwrightImports = [];
  text = text.replace(playwrightRe, (_, inner) => {
    const names = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const kept = names.filter((n) => !/^chromium\b/.test(n));
    if (kept.length) playwrightImports.push(...kept);
    return kept.length ? `import { ${kept.join(", ")} } from "playwright";` : "";
  });

  const needLib = ["withPlaywrightBrowser", "closeAllBrowsers"];
  const libMatch = text.match(libImportRe);
  if (libMatch) {
    const existing = libMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const n of needLib) {
      if (!existing.some((e) => e.split(/\s+as\s+/)[0] === n)) existing.push(n);
    }
    const uniq = [...new Set(existing)];
    text = text.replace(libImportRe, `import { ${uniq.join(", ")} } from "${libPath}";`);
  } else if (/chromium\.launch|withPlaywrightBrowser|withPlaywrightSession|launchHeadlessBrowser/.test(text)) {
    const insert = `import { withPlaywrightBrowser, closeAllBrowsers } from "${libPath}";\n`;
    const shebangMatch = text.match(/^#![^\n]*\n/);
    const shebang = shebangMatch ? shebangMatch[0] : "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const importEnd = rest.search(/\n(?:const|let|var|async function|function|import|\/\*\*|\/\/)/);
    if (importEnd > 0) {
      const head = rest.slice(0, importEnd);
      const tail = rest.slice(importEnd);
      text = shebang + head + (head.endsWith("\n") ? "" : "\n") + insert + tail;
    } else {
      text = shebang + insert + rest;
    }
  }

  // Remove unused chromium-only lib imports
  text = text.replace(
    new RegExp(`import\\s*\\{\\s*chromium\\s*\\}\\s*from\\s*[\"']${libPath.replace(/\./g, "\\.")}[\"'];?\\n?`),
    ""
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

function findCloseLine(lines, varName, fromIndex) {
  const closeRe = new RegExp(`^\\s*await\\s+${varName}\\.close\\s*\\(`);
  let last = -1;
  for (let i = fromIndex; i < lines.length; i++) {
    if (closeRe.test(lines[i])) last = i;
  }
  return last;
}

function removeFinallyBrowserClose(lines, varName) {
  const closeRe = new RegExp(`await\\s+${varName}\\.close`);
  return lines.filter((line, i, arr) => {
    if (!closeRe.test(line)) return true;
    // drop line if inside finally block (heuristic: nearby finally)
    for (let j = Math.max(0, i - 8); j <= Math.min(arr.length - 1, i + 2); j++) {
      if (/^\s*finally\s*\{/.test(arr[j])) return false;
    }
    return true;
  });
}

function migrateSingleLaunch(text) {
  let lines = text.split("\n");
  const launches = findLaunchLines(lines);
  if (launches.length !== 1) return text;

  const { index, indent, varName } = launches[0];
  let closeIdx = findCloseLine(lines, varName, index);
  if (closeIdx < 0) return text;

  // Rename var to browser if different
  const bodyVar = varName === "browser" ? "browser" : varName;
  const openLine = `${indent}await withPlaywrightBrowser(async (${bodyVar}) => {`;

  lines.splice(index, 1, openLine);
  if (closeIdx > index) closeIdx -= 1;

  const closeIndent = lines[closeIdx].match(/^(\s*)/)[1];
  lines[closeIdx] = `${closeIndent}});`;

  if (varName !== "browser") {
    const slice = lines.slice(index + 1, closeIdx).join("\n");
    // only rename standalone varName references, not substrings
    const renamed = slice.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    lines.splice(index + 1, closeIdx - index - 1, ...renamed.split("\n"));
  }

  lines = removeFinallyBrowserClose(lines, bodyVar);
  return lines.join("\n");
}

function migrateMultiLaunch(text) {
  let lines = text.split("\n");
  const launches = findLaunchLines(lines);
  if (launches.length < 2) return text;

  // bottom-up so indices stay valid
  for (let li = launches.length - 1; li >= 0; li--) {
    const { index, indent, varName } = launches[li];
    let closeIdx = findCloseLine(lines, varName, index);
    if (closeIdx < 0) continue;
    const openLine = `${indent}await withPlaywrightBrowser(async (browser) => {`;
    lines.splice(index, 1, openLine);
    if (closeIdx > index) closeIdx -= 1;
    const closeIndent = lines[closeIdx].match(/^(\s*)/)[1];
    lines[closeIdx] = `${closeIndent}});`;
    if (varName !== "browser") {
      for (let i = index + 1; i < closeIdx; i++) {
        lines[i] = lines[i].replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      }
    }
    lines = removeFinallyBrowserClose(lines, "browser");
  }
  return lines.join("\n");
}

function addCloseAllBeforeExit(text) {
  if (!/process\.exit\s*\(/.test(text)) {
    if (/chromium\.launch|withPlaywrightBrowser/.test(text) && !/closeAllBrowsers/.test(text)) {
      return `${text.trimEnd()}\n\nawait closeAllBrowsers();\n`;
    }
    return text;
  }

  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*process\.exit\s*\(/.test(line) && !/closeAllBrowsers/.test(lines[i - 1] || "")) {
      const indent = line.match(/^(\s*)/)[1];
      out.push(`${indent}await closeAllBrowsers();`);
    }
    out.push(line);
  }
  return out.join("\n");
}

function migrateFile(file) {
  const r = rel(file);
  if (SKIP.has(r)) return { file: r, status: "skipped" };

  let text = fs.readFileSync(file, "utf8");
  if (!/chromium\.launch\s*\(/.test(text) && !/from\s*[\"']playwright[\"']/.test(text)) {
    return { file: r, status: "no-op" };
  }
  if (/withPlaywrightBrowser/.test(text) && !/chromium\.launch\s*\(/.test(text)) {
    text = fixImports(text, file);
    text = addCloseAllBeforeExit(text);
    if (!DRY) fs.writeFileSync(file, text);
    return { file: r, status: "imports-only" };
  }

  const before = text;
  text = fixImports(text, file);
  const launches = (text.match(/\bchromium\.launch\s*\(/g) || []).length;
  if (launches === 1) text = migrateSingleLaunch(text);
  else if (launches > 1) text = migrateMultiLaunch(text);
  text = addCloseAllBeforeExit(text);

  // Strip remaining direct launch if any (fallback: launchHeadlessBrowser comment)
  if (/chromium\.launch\s*\(/.test(text)) {
    return { file: r, status: "manual-needed", remaining: (text.match(/\bchromium\.launch\s*\(/g) || []).length };
  }

  if (text !== before) {
    if (!DRY) fs.writeFileSync(file, text);
    return { file: r, status: "migrated" };
  }
  return { file: r, status: "unchanged" };
}

const allFiles = walk(path.join(ROOT, "scripts"))
  .sort((a, b) => priority(a) - priority(b) || rel(a).localeCompare(rel(b)));

const results = [];
for (const f of allFiles) {
  results.push(migrateFile(f));
}

const summary = {
  migrated: results.filter((r) => r.status === "migrated").length,
  importsOnly: results.filter((r) => r.status === "imports-only").length,
  manualNeeded: results.filter((r) => r.status === "manual-needed"),
  skipped: results.filter((r) => r.status === "skipped").length,
  noOp: results.filter((r) => r.status === "no-op").length,
  unchanged: results.filter((r) => r.status === "unchanged").length,
};

console.log(JSON.stringify(summary, null, 2));
if (summary.manualNeeded.length) {
  console.log("\nmanual-needed:");
  for (const m of summary.manualNeeded) console.log(`  ${m.file} (${m.remaining} launches)`);
}

if (!DRY) {
  fs.writeFileSync(
    path.join(ROOT, "reports/playwright-browser-leak-codemod-result.json"),
    JSON.stringify({ summary, results }, null, 2)
  );
}
