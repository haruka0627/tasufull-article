#!/usr/bin/env node
/**
 * Safe Playwright migration (multiline launch support)
 *   node scripts/remigrate-playwright-safe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP = new Set([
  "scripts/lib/playwright-browser.mjs",
  "scripts/test-playwright-browser-cleanup.mjs",
  "scripts/test-playwright-leak-compare.mjs",
  "scripts/audit-playwright-browser-leak.mjs",
  "scripts/codemod-playwright-browser-leak.mjs",
  "scripts/restore-and-remigrate-playwright.mjs",
  "scripts/remigrate-playwright-safe.mjs",
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

function shouldProcess(file, text) {
  const r = rel(file);
  if (SKIP.has(r)) return false;
  if (!/chromium\.launch/.test(text)) return false;
  if (r.startsWith("scripts/capture-")) return true;
  if (r.startsWith("scripts/verify-")) return true;
  if (r.startsWith("scripts/audit-")) return true;
  return true;
}

function fixImports(text, file) {
  const libPath = libImportPath(file);

  text = text.replace(/import\s*\{([^}]*)\}\s*from\s*[\"']playwright[\"'];?/g, (_, inner) => {
    const kept = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => !/^chromium\b/.test(n));
    return kept.length ? `import { ${kept.join(", ")} } from "playwright";` : "";
  });

  const libRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']${libPath.replace(/\./g, "\\.")}[\"'];?`);
  const need = ["withPlaywrightBrowser", "closeAllBrowsers"];

  if (libRe.test(text)) {
    text = text.replace(libRe, (_, inner) => {
      const names = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((n) => !/^chromium\b/.test(n));
      for (const n of need) {
        if (!names.some((x) => x.split(/\s+as\s+/)[0] === n)) names.push(n);
      }
      return `import { ${[...new Set(names)].join(", ")} } from "${libPath}";`;
    });
  } else {
    const insert = `import { withPlaywrightBrowser, closeAllBrowsers } from "${libPath}";\n`;
    const shebangMatch = text.match(/^#![^\n]*\n/);
    const shebang = shebangMatch ? shebangMatch[0] : "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const m = rest.match(/^((?:import[^\n]+\n)+)/);
    text = m ? shebang + m[1] + insert + rest.slice(m[1].length) : shebang + insert + rest;
  }

  return text.replace(/\n{3,}/g, "\n\n");
}

/** @returns {{ start: number, end: number, indent: string, varName: string }[]} */
function findLaunchBlocks(text) {
  const blocks = [];
  const re = /(^|\n)([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const indent = m[2];
    const varName = m[3];
    const start = m.index + m[1].length;
    let depth = 1;
    let i = re.lastIndex;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    while (i < text.length && /[;\s]/.test(text[i])) i++;
    blocks.push({ start, end: i, indent, varName });
    re.lastIndex = i;
  }
  return blocks;
}

function findClosePos(text, varName, from) {
  const re = new RegExp(`await\\s+${varName}\\.close\\s*\\([^)]*\\)\\s*;?`, "g");
  re.lastIndex = from;
  let last = -1;
  let m;
  while ((m = re.exec(text)) !== null) last = m.index + m[0].length;
  return last;
}

function migrateTryCatchFinallyLaunch(text) {
  // launch; try { body } catch (e) { cb } finally { await browser.close(); tail }
  return text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, varName, mid, tryBody, catchVar, catchBody, finallyRest) => {
      const pre = varName === "browser" ? mid : mid.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      let tb = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      const cb = varName === "browser" ? catchBody : catchBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      tb = tb.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
      const rest = finallyRest.trimEnd();
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${catchVar}) {${cb}}${indent}});\n${indent}${rest}`;
    }
  );
}

function migrateTryFinallyLaunch(text) {
  const re =
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g;
  return text.replace(re, (_, indent, varName, mid, tryBody, finallyRest) => {
    const pre = varName === "browser" ? mid : mid.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    let body = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    body = body.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    const rest = finallyRest.trimEnd();
    return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}${body}${indent}});\n${indent}${rest}`;
  });
}

function migrateTryCatchCloseLaunch(text) {
  // launch; try { body } catch (e) { cb } await browser.close();
  return text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*await\s+\2\.close\(\)[^;]*;/g,
    (_, indent, varName, mid, tryBody, catchVar, catchBody) => {
      const pre = varName === "browser" ? mid : mid.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      const tb = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      const cb = varName === "browser" ? catchBody : catchBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${catchVar}) {${cb}}${indent}});`;
    }
  );
}

function migrateText(text) {
  text = migrateTryCatchFinallyLaunch(text);
  text = migrateTryCatchCloseLaunch(text);
  text = migrateTryFinallyLaunch(text);
  if (/withPlaywrightBrowser\s*\(/.test(text) && !/chromium\.launch/.test(text)) {
    return text.replace(/\n[ \t]*await\s+browser\.close[^\n]*/g, "");
  }

  let blocks = findLaunchBlocks(text);
  if (!blocks.length) return text;

  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { start, end, indent, varName } = blocks[bi];
    const closeEnd = findClosePos(text, varName, end);
    if (closeEnd < 0) continue;

    const closeStart = text.lastIndexOf("await", closeEnd - 1);
    const body = text.slice(end, closeStart);
    let inner = body;
    if (varName !== "browser") {
      inner = inner.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    }
    inner = inner.replace(new RegExp(`\\n[ \\t]*await\\s+browser\\.close\\s*\\([^)]*\\)\\s*;?`, "g"), "");

    const replacement =
      `${indent}await withPlaywrightBrowser(async (browser) => {` +
      inner +
      `${indent}});`;

    text = text.slice(0, start) + replacement + text.slice(closeEnd);
    blocks = findLaunchBlocks(text);
  }

  return text;
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

function migrateFile(file) {
  const r = rel(file);
  if (SKIP.has(r)) return { file: r, status: "skipped" };

  let text = fs.readFileSync(file, "utf8");
  if (!shouldProcess(file, text)) return { file: r, status: "no-op" };

  const before = text;
  text = fixImports(text, file);
  text = migrateText(text);
  text = addCloseAllBeforeExit(text);

  const remaining = (text.match(/chromium\.launch\s*\(/g) || []).length;
  if (remaining) {
    return { file: r, status: "manual", remaining };
  }

  if (text !== before) fs.writeFileSync(file, text);
  return { file: r, status: text !== before ? "migrated" : "unchanged", remaining: 0 };
}

const files = walk(path.join(ROOT, "scripts"));
const results = files.map(migrateFile);
const summary = {
  migrated: results.filter((r) => r.status === "migrated").length,
  unchanged: results.filter((r) => r.status === "unchanged").length,
  manual: results.filter((r) => r.status === "manual"),
  noOp: results.filter((r) => r.status === "no-op").length,
};
console.log(JSON.stringify({ ...summary, manualCount: summary.manual.length }, null, 2));
if (summary.manual.length) {
  console.log("manual sample:", summary.manual.slice(0, 15).map((m) => `${m.file}(${m.remaining})`).join(", "));
}

fs.writeFileSync(
  path.join(ROOT, "reports/playwright-browser-leak-codemod-result.json"),
  JSON.stringify({ summary, results }, null, 2)
);
