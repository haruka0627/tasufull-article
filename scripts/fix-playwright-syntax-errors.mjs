#!/usr/bin/env node
/**
 * Fix try/finally migration breakage + restore syntax-error files from git.
 *   node scripts/fix-playwright-syntax-errors.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function hasSyntaxError(file) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

function gitShow(r) {
  try {
    return execSync(`git show HEAD:${r}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function libImportPath(file) {
  return rel(file).startsWith("scripts/lib/") ? "./playwright-browser.mjs" : "./lib/playwright-browser.mjs";
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
  } else if (/chromium\.launch/.test(text)) {
    const insert = `import { withPlaywrightBrowser, closeAllBrowsers } from "${libPath}";\n`;
    const shebangMatch = text.match(/^#![^\n]*\n/);
    const shebang = shebangMatch ? shebangMatch[0] : "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const m = rest.match(/^((?:import[^\n]+\n)+)/);
    text = m ? shebang + m[1] + insert + rest.slice(m[1].length) : shebang + insert + rest;
  }
  return text;
}

function migrateTryFinallyLaunch(text) {
  const re =
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g;
  return text.replace(re, (_, indent, varName, tryBody, finallyRest) => {
    let body = tryBody;
    if (varName !== "browser") body = body.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    body = body.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    const rest = finallyRest.trimEnd();
    return `${indent}await withPlaywrightBrowser(async (browser) => {${body}${indent}});\n${indent}${rest}`;
  });
}

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
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
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

function migrateSimpleLaunch(text) {
  let blocks = findLaunchBlocks(text);
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { start, end, indent, varName } = blocks[bi];
    const closeEnd = findClosePos(text, varName, end);
    if (closeEnd < 0) continue;
    const closeStart = text.lastIndexOf("await", closeEnd - 1);
    let inner = text.slice(end, closeStart);
    if (varName !== "browser") inner = inner.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    inner = inner.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    const replacement = `${indent}await withPlaywrightBrowser(async (browser) => {${inner}${indent}});`;
    text = text.slice(0, start) + replacement + text.slice(closeEnd);
    blocks = findLaunchBlocks(text);
  }
  return text;
}

function stripInvalidCloseAllInCatch(text) {
  return text.replace(
    /(\.catch\s*\([^)]*\)\s*=>\s*\{[^}]*?)await closeAllBrowsers\(\);\s*\n/g,
    "$1"
  );
}

function addCloseAllBeforeExit(text) {
  text = stripInvalidCloseAllInCatch(text);
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTopExit = /^\s{0,2}process\.exit\s*\(/.test(line);
    const prev = out[out.length - 1] || "";
    if (isTopExit && !/closeAllBrowsers/.test(prev)) {
      out.push(`${line.match(/^(\s*)/)[1]}await closeAllBrowsers();`);
    }
    out.push(line);
  }
  if (/withPlaywrightBrowser/.test(text) && !/closeAllBrowsers\s*\(/.test(text)) {
    return `${out.join("\n").trimEnd()}\n\nawait closeAllBrowsers();\n`;
  }
  return out.join("\n");
}

function migrateFile(file) {
  const r = rel(file);
  const restored = gitShow(r);
  let text = restored ?? fs.readFileSync(file, "utf8");
  if (!restored) {
    // strip broken withPlaywrightBrowser wrapper if present
    text = text.replace(/await withPlaywrightBrowser\(async \(browser\) => \{[\s\S]*?\n[ \t]*\}\);/g, "");
  }
  text = fixImports(text, file);
  text = migrateTryFinallyLaunch(text);
  text = migrateSimpleLaunch(text);
  text = addCloseAllBeforeExit(text);
  fs.writeFileSync(file, text);
  return { file: r, ok: !hasSyntaxError(file), remaining: (text.match(/chromium\.launch\s*\(/g) || []).length, restored: Boolean(restored) };
}

const broken = walk(path.join(ROOT, "scripts")).filter(hasSyntaxError);
console.log(`fixing ${broken.length} syntax-error files...`);
const results = broken.map(migrateFile);
const stillBad = results.filter((r) => !r.ok);
console.log(JSON.stringify({ fixed: results.length - stillBad.length, stillBad: stillBad.length, launches: stillBad.filter((r) => r.remaining) }, null, 2));
if (stillBad.length) console.log(stillBad.slice(0, 20).map((r) => r.file).join("\n"));
