#!/usr/bin/env node
/**
 * Repair capture / verify / audit Playwright scripts — git restore + safe migrate.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hasSyntaxError(file) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

function gitShow(rel) {
  try {
    return execSync(`git show "HEAD:${rel}"`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function libPath(rel) {
  return rel.startsWith("scripts/lib/") ? "./playwright-browser.mjs" : "./lib/playwright-browser.mjs";
}

function ensureImports(text, rel) {
  const lp = libPath(rel);
  text = text.replace(/import\s*\{([^}]*)\}\s*from\s*[\"']playwright[\"'];?/g, (_, inner) => {
    const kept = inner.split(",").map((s) => s.trim()).filter(Boolean).filter((n) => !/^chromium\b/.test(n));
    return kept.length ? `import { ${kept.join(", ")} } from "playwright";` : "";
  });
  if (!new RegExp(`from\\s*[\"']${lp.replace(/\./g, "\\.")}[\"']`).test(text)) {
    const ins = `import { withPlaywrightBrowser, closeAllBrowsers } from "${lp}";\n`;
    const m = text.match(/^((?:import[^\n]+\n)+)/);
    text = m ? m[1] + ins + text.slice(m[1].length) : ins + text;
  } else {
    text = text.replace(
      new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*[\"']${lp.replace(/\./g, "\\.")}[\"'];?`),
      (_, inner) => {
        const names = inner.split(",").map((s) => s.trim()).filter(Boolean).filter((n) => !/^chromium\b/.test(n));
        for (const n of ["withPlaywrightBrowser", "closeAllBrowsers"]) {
          if (!names.some((x) => x.split(/\s+as\s+/)[0] === n)) names.push(n);
        }
        return `import { ${[...new Set(names)].join(", ")} } from "${lp}";`;
      }
    );
  }
  return text;
}

function migrateLaunchBlocks(text) {
  // Pattern A: launch; try { body } catch (e) { cb } finally { await browser.close(); tail }
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, cv, catchB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});\n${indent}${fin.trim()}`;
    }
  );

  // Pattern B: launch; try { body } finally { await browser.close(); tail }
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}${tb}${indent}});\n${indent}${fin.trim()}`;
    }
  );

  // Pattern C: launch; try { body } catch (e) { cb }  await browser.close()  (no finally)
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*await\s+\2\.close\(\)[^;]*;/g,
    (_, indent, vn, mid, tryB, cv, catchB) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});`;
    }
  );

  // Pattern D: simple launch ... await browser.close()
  const re = /(^|\n)([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\s*\(/g;
  let m;
  const blocks = [];
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    let depth = 1;
    let i = re.lastIndex;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
      i++;
    }
    while (i < text.length && /[;\s]/.test(text[i])) i++;
    blocks.push({ start, end: i, indent: m[2], vn: m[3] });
    re.lastIndex = i;
  }
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { start, end, indent, vn } = blocks[bi];
    const closeRe = new RegExp(`await\\s+${vn}\\.close\\s*\\([^)]*\\)\\s*;?`, "g");
    closeRe.lastIndex = end;
    let closeEnd = -1;
    let cm;
    while ((cm = closeRe.exec(text)) !== null) closeEnd = cm.index + cm[0].length;
    if (closeEnd < 0) continue;
    const closeStart = text.lastIndexOf("await", closeEnd - 1);
    let inner = text.slice(end, closeStart);
    if (vn !== "browser") inner = inner.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
    inner = inner.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    text = text.slice(0, start) + `${indent}await withPlaywrightBrowser(async (browser) => {${inner}${indent}});` + text.slice(closeEnd);
  }
  return text;
}

function patchArtifacts(text) {
  // orphan try { ... }}); → body only
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{([\s\S]*?)try \{\n([\s\S]*?\n)\}\}\);/g,
    "await withPlaywrightBrowser(async (browser) => {$1$2\n});"
  );
  text = text.replace(/\n\}\}\);/g, "\n});");
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{\n(\s*)await page\./g,
    "await withPlaywrightBrowser(async (browser) => {\n$1const page = await browser.newPage();\n$1await page."
  );
  text = text.replace(/(\btry \{[\s\S]*?)(\n\}\);)/g, (match, head, tail) => {
    if (!head.includes("withPlaywrightBrowser")) return match;
    const afterTry = head.slice(head.lastIndexOf("try {"));
    let depth = 0;
    for (const ch of afterTry) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth > 0) {
      // try without catch/finally — drop try wrapper
      const body = afterTry.replace(/^try \{\n?/, "").replace(/\n?\}$/, "");
      return head.slice(0, head.lastIndexOf("try {")) + body + tail;
    }
    return match;
  });
  text = text.replace(/(\} catch \([^)]*\) \{[\s\S]*?)(\n\}\);)/g, (match, head, tail) => {
    const after = head.slice(head.indexOf("{"));
    let depth = 0;
    for (const ch of after) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    return depth > 0 ? `${head}\n}${tail}` : match;
  });
  text = text.replace(/\n\}\);\n\}\n(\n(?:await closeAllBrowsers|main\(\)|async function))/g, "\n});\n$1");
  text = text.replace(
    /function parseArgs\(\) \{([\s\S]*?)await closeAllBrowsers\(\);\s*\n(\s*process\.exit)/g,
    "function parseArgs() {$1$2"
  );
  return text;
}

function addCloseAll(text) {
  if (!/closeAllBrowsers\s*\(/.test(text) && /withPlaywrightBrowser/.test(text)) {
    text = `${text.trimEnd()}\n\nawait closeAllBrowsers();\n`;
  }
  if (/process\.exit\s*\(/.test(text)) {
    text = text
      .split("\n")
      .flatMap((line) => {
        if (/^\s{0,2}process\.exit\s*\(/.test(line) && !/closeAllBrowsers/.test(line)) {
          return [`${line.match(/^(\s*)/)[1]}await closeAllBrowsers();`, line];
        }
        return [line];
      })
      .join("\n");
  }
  return text;
}

const list = fs
  .readFileSync(path.join(ROOT, "reports/syntax-error-files.txt"), "utf8")
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((r) => r.startsWith("scripts/capture-") || r.startsWith("scripts/verify-") || r.startsWith("scripts/audit-"));

const fixed = [];
const failed = [];

for (const rel of list) {
  const file = path.join(ROOT, rel);
  let src = gitShow(rel) ?? fs.readFileSync(file, "utf8");
  if (!/chromium\.launch|withPlaywrightBrowser/.test(src)) {
    failed.push({ rel, reason: "no-playwright" });
    continue;
  }
  let text = ensureImports(src, rel);
  text = migrateLaunchBlocks(text);
  text = patchArtifacts(text);
  text = addCloseAll(text);
  if (/chromium\.launch\s*\(/.test(text)) {
    failed.push({ rel, reason: "launch-remaining" });
    continue;
  }
  fs.writeFileSync(file, text);
  if (hasSyntaxError(file)) failed.push({ rel, reason: "syntax" });
  else fixed.push(rel);
}

console.log(JSON.stringify({ target: list.length, fixed: fixed.length, failed }, null, 2));
