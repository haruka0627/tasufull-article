#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * Repair Playwright codemod syntax artifacts (keeps withPlaywrightBrowser / no chromium.launch).
 *   node scripts/repair-playwright-syntax-artifacts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = path.join(ROOT, "reports/syntax-error-files.txt");

function hasSyntaxError(file) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.mjs$/.test(ent.name)) out.push(p);
  }
  return out;
}

/** Insert missing `}` before `});` that closes withPlaywrightBrowser when `try {` is unclosed */
function repairTryBeforeWrapperClose(text) {
  const marker = "await withPlaywrightBrowser(async (browser) => {";
  let idx = 0;
  while ((idx = text.indexOf(marker, idx)) !== -1) {
    const bodyStart = idx + marker.length;
    let closeIdx = findWrapperClose(text, bodyStart);
    if (closeIdx < 0) {
      idx = bodyStart;
      continue;
    }
    const body = text.slice(bodyStart, closeIdx);
    if (!/\btry\s*\{/.test(body)) {
      idx = bodyStart;
      continue;
    }
    const tryIdx = body.search(/\btry\s*\{/);
    const afterTry = body.slice(tryIdx);
    if (braceDepth(afterTry) > 0) {
      text = text.slice(0, closeIdx) + "\n}" + text.slice(closeIdx);
      idx = bodyStart;
      continue;
    }
    idx = closeIdx + 1;
  }
  return text;
}

function braceDepth(s) {
  let d = 0;
  for (const ch of s) {
    if (ch === "{") d++;
    else if (ch === "}") d--;
  }
  return d;
}

function findWrapperClose(text, from) {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    if (text.startsWith("await withPlaywrightBrowser", i)) {
      /* skip nested - rare */
    }
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        if (text.slice(i, i + 3) === "});" || text.slice(i + 1, i + 3) === ");") {
          const j = text.indexOf(");", i);
          return j >= 0 ? j + 2 : i + 1;
        }
        return i;
      }
    }
  }
  return -1;
}

function repairCatchBeforeWrapperClose(text) {
  return text.replace(/(\} catch \([^)]*\) \{[\s\S]*?)(\n\}\);)/g, (match, head, tail) => {
    const afterCatch = head.slice(head.indexOf("{"));
    let depth = 0;
    for (const ch of afterCatch) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth > 0) return `${head}\n}${tail}`;
    return match;
  });
}

function repairFinallyArtifacts(text) {
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{(?:const errors = \[\];\s*)?try \{/g,
    "await withPlaywrightBrowser(async (browser) => {"
  );
  text = text.replace(/\} finally \{\s*\}\);\s*/g, "});\n");
  text = text.replace(/\}\);\n([ \t]*server\.close\(\);)\n[ \t]*\}\n\}/g, "});\n$1\n}");
  text = text.replace(/\}\);\n([ \t]*staticServer[^\n]*)\n\}/g, "});\n$1\n}");
  return text;
}

function repairMissingPageInBrowserWrapper(text) {
  return text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{\n(\s*)await page\./g,
    "await withPlaywrightBrowser(async (browser) => {\n$1const page = await browser.newPage();\n$1await page."
  );
}

function repairParseArgsCloseAll(text) {
  return text.replace(
    /function parseArgs\(\) \{[\s\S]*?await closeAllBrowsers\(\);\s*\n(\s*process\.exit)/g,
    (block, exitLine) => block.replace(/\s*await closeAllBrowsers\(\);\s*\n/, `\n${exitLine.includes("process") ? "    " : ""}`)
  ).replace(
    /(function parseArgs\(\) \{[\s\S]*?)(process\.exit\([^)]+\);)/g,
    "$1    $2"
  );
}

function repairDoubleCloseBrace(text) {
  text = text.replace(/(\} catch \([^)]*\) \{[\s\S]*?\n\})\);\n\}/g, "$1);\n");
  text = text.replace(/\n\}\);\n\}\n(\nawait closeAllBrowsers|\nfunction |\nasync function |main\(\))/g, "\n});\n$1");
  return text;
}

function repairShebangOrder(text) {
  if (!/^import[^\n]+\n#!\/usr\/bin\/env node\n/.test(text)) return text;
  const lines = text.split("\n");
  const importLine = lines[0];
  const rest = lines.slice(2).join("\n");
  return `#!/usr/bin/env node\n${importLine}\n${rest}`;
}

function repairBogusChromiumLibImport(text) {
  return text.replace(
    /import\s*\{\s*chromium\s*\}\s*from\s*[\"']\.\/lib\/playwright-browser\.mjs[\"'];?\n?/g,
    ""
  );
}

function repairExtraBraceAfterMain(text) {
  return text.replace(/(\n\}\);\n\}\n)(\nmain\(\))/g, "$1$2").replace(/(\n\}\);\n\}\n\}\n)(main\(\))/g, "$1$2");
}

function repairTryMissingCatchBeforeWrapperClose(text) {
  return text.replace(
    /(await withPlaywrightBrowser\(async \(browser\) => \{[\s\S]*?\btry\s*\{[\s\S]*?)(\n\s*\}\);)/g,
    (match, head, tail) => {
      const tryIdx = head.lastIndexOf("try {");
      if (tryIdx < 0) return match;
      const afterTry = head.slice(tryIdx);
      if (braceDepth(afterTry) > 0) {
        return `${head}\n  } catch (err) {\n    throw err;\n  }${tail}`;
      }
      return match;
    }
  );
}

function repairAll(text) {
  text = repairShebangOrder(text);
  text = repairBogusChromiumLibImport(text);
  text = repairFinallyArtifacts(text);
  text = repairMissingPageInBrowserWrapper(text);
  text = repairParseArgsCloseAll(text);
  text = repairCatchBeforeWrapperClose(text);
  text = repairTryBeforeWrapperClose(text);
  text = repairDoubleCloseBrace(text);
  text = repairTryMissingCatchBeforeWrapperClose(text);
  text = repairExtraBraceAfterMain(text);
  text = text.replace(
    /(\.catch\s*\([^)]*\)\s*=>\s*\{[^}]*?)\n\s*await closeAllBrowsers\(\);\s*\n/g,
    "$1\n"
  );
  text = text.replace(
    /(main\(\)\.catch\([^)]+\)\s*;\s*)\nawait closeAllBrowsers\(\);\s*$/m,
    "$1"
  );
  return text;
}

function gitShow(rel) {
  try {
    return execSync(`git show "HEAD:${rel}"`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function migrateFromGit(rel) {
  const original = gitShow(rel);
  if (!original || !/chromium\.launch/.test(original)) return null;

  const libPath = rel.startsWith("scripts/lib/") ? "./playwright-browser.mjs" : "./lib/playwright-browser.mjs";
  let text = original;

  text = text.replace(/import\s*\{([^}]*)\}\s*from\s*[\"']playwright[\"'];?/g, (_, inner) => {
    const kept = inner.split(",").map((s) => s.trim()).filter(Boolean).filter((n) => !/^chromium\b/.test(n));
    return kept.length ? `import { ${kept.join(", ")} } from "playwright";` : "";
  });

  if (!text.includes("withPlaywrightBrowser")) {
    const insert = `import { withPlaywrightBrowser, closeAllBrowsers } from "${libPath}";\n`;
    const m = text.match(/^((?:import[^\n]+\n)+)/);
    text = m ? m[1] + insert + text.slice(m[1].length) : insert + text;
  }

  // try/finally launch pattern
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, varName, tryBody, finallyRest) => {
      let body = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${body}${indent}});\n${indent}${finallyRest.trimEnd()}`;
    }
  );

  // try/catch/finally with browser.close in finally
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, varName, between, tryBody, catchVar, catchBody, finallyRest) => {
      let pre = between.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      let tBody = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      let cBody = varName === "browser" ? catchBody : catchBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tBody}} catch (${catchVar}) {${cBody}}${indent}});\n${indent}${finallyRest.trimEnd()}`;
    }
  );

  // simple: launch ... try { body } catch { } finally { browser.close(); rest }
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, varName, between, tryBody, catchVar, catchBody, finallyRest) => {
      let pre = between.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      let tBody = varName === "browser" ? tryBody : tryBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      let cBody = varName === "browser" ? catchBody : catchBody.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tBody}} catch (${catchVar}) {${cBody}}${indent}});\n${indent}${finallyRest.trimEnd()}`;
    }
  );

  // top-level launch + body + close (no try)
  const launchRe = /(^|\n)([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\s*\(/g;
  let m;
  const blocks = [];
  while ((m = launchRe.exec(text)) !== null) {
    const start = m.index + m[1].length;
    let depth = 1;
    let i = launchRe.lastIndex;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
      i++;
    }
    while (i < text.length && /[;\s]/.test(text[i])) i++;
    blocks.push({ start, end: i, indent: m[2], varName: m[3] });
    launchRe.lastIndex = i;
  }

  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { start, end, indent, varName } = blocks[bi];
    const closeRe = new RegExp(`await\\s+${varName}\\.close\\s*\\([^)]*\\)\\s*;?`, "g");
    closeRe.lastIndex = end;
    let closeEnd = -1;
    let cm;
    while ((cm = closeRe.exec(text)) !== null) closeEnd = cm.index + cm[0].length;
    if (closeEnd < 0) continue;
    const closeStart = text.lastIndexOf("await", closeEnd - 1);
    let inner = text.slice(end, closeStart);
    if (varName !== "browser") inner = inner.replace(new RegExp(`\\b${varName}\\b`, "g"), "browser");
    inner = inner.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    text = text.slice(0, start) + `${indent}await withPlaywrightBrowser(async (browser) => {${inner}${indent}});` + text.slice(closeEnd);
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

  return repairAll(text);
}

const beforeList = fs.existsSync(LIST)
  ? fs.readFileSync(LIST, "utf8").trim().split(/\r?\n/).filter(Boolean)
  : walk(path.join(ROOT, "scripts"))
      .filter((f) => hasSyntaxError(f))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));

const beforeCount = beforeList.length;
const fixed = [];
const stillBroken = [];

for (const rel of beforeList) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;

  let text = fs.readFileSync(file, "utf8");
  let next = repairAll(text);

  fs.writeFileSync(file, next);
  if (!hasSyntaxError(file)) {
    fixed.push(rel);
    continue;
  }

  const remigrated = migrateFromGit(rel);
  if (remigrated) {
    fs.writeFileSync(file, remigrated);
    if (!hasSyntaxError(file)) {
      fixed.push(rel);
      continue;
    }
  }

  stillBroken.push(rel);
}

const allBroken = walk(path.join(ROOT, "scripts")).filter(hasSyntaxError);
const cvaBroken = allBroken.filter((f) => {
  const r = path.relative(ROOT, f).replace(/\\/g, "/");
  return r.startsWith("scripts/capture-") || r.startsWith("scripts/verify-") || r.startsWith("scripts/audit-");
});

console.log(
  JSON.stringify(
    {
      beforeCount,
      fixed: fixed.length,
      remaining: allBroken.length,
      captureVerifyAuditRemaining: cvaBroken.length,
      stillBrokenSample: stillBroken.slice(0, 15),
    },
    null,
    2
  )
);

fs.writeFileSync(LIST, allBroken.map((f) => path.relative(ROOT, f).replace(/\\/g, "/")).join("\n") + (allBroken.length ? "\n" : ""));
fs.writeFileSync(
  path.join(ROOT, "reports/playwright-syntax-repair-log.json"),
  JSON.stringify({ beforeCount, fixed, stillBroken, remaining: allBroken.map((f) => path.relative(ROOT, f).replace(/\\/g, "/")) }, null, 2)
);
