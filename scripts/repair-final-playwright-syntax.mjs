#!/usr/bin/env node
/**
 * Final pass: git restore + migrate + brace cleanup for remaining syntax errors.
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
  text = text.replace(/import\s*\{\s*chromium\s*\}\s*from\s*[\"']\.\/lib\/playwright-browser\.mjs[\"'];?\n?/g, "");
  if (!new RegExp(`from\\s*[\"']${lp.replace(/\./g, "\\.")}[\"']`).test(text)) {
    const ins = `import { withPlaywrightBrowser, closeAllBrowsers } from "${lp}";\n`;
    const shebang = text.match(/^#![^\n]*\n/)?.[0] || "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const m = rest.match(/^((?:import[^\n]+\n)+)/);
    text = shebang + (m ? m[1] + ins + rest.slice(m[1].length) : ins + rest);
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

function migrateSimpleLaunch(text) {
  const re = /(^|\n)([ \t]*)(?:const|let)\s+browser\s*=\s*await\s+chromium\.launch\s*\(/g;
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
    blocks.push({ start, end: i, indent: m[2] });
    re.lastIndex = i;
  }
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { start, end, indent } = blocks[bi];
    const closeRe = /await\s+browser\.close\s*\([^)]*\)\s*;?/g;
    closeRe.lastIndex = end;
    let closeEnd = -1;
    let cm;
    while ((cm = closeRe.exec(text)) !== null) closeEnd = cm.index + cm[0].length;
    if (closeEnd < 0) continue;
    const closeStart = text.lastIndexOf("await", closeEnd - 1);
    let inner = text.slice(end, closeStart);
    inner = inner.replace(/\n[ \t]*await\s+browser\.close\(\)[^;]*;\s*/g, "\n");
    text =
      text.slice(0, start) +
      `${indent}await withPlaywrightBrowser(async (browser) => {${inner}${indent}});` +
      text.slice(closeEnd);
  }
  return text;
}

function migrateLaunchBlocks(text) {
  text = migrateTryCatchFinallyLaunch(text);
  text = migrateTryFinallyLaunch(text);
  text = migrateTryCatchCloseLaunch(text);
  text = migrateSimpleLaunch(text);
  return text;
}

function migrateTryCatchFinallyLaunch(text) {
  return text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, cv, catchB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});\n${indent}${fin.trim()}`;
    }
  );
}

function migrateTryFinallyLaunch(text) {
  return text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}${tb}${indent}});\n${indent}${fin.trim()}`;
    }
  );
}

function migrateTryCatchCloseLaunch(text) {
  return text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*await\s+\2\.close\(\)[^;]*;/g,
    (_, indent, vn, mid, tryB, cv, catchB) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});`;
    }
  );
}

function addCloseAllBeforeExit(text) {
  if (!/withPlaywrightBrowser/.test(text)) return text;
  if (!/process\.exit\s*\(/.test(text)) {
    if (!/closeAllBrowsers/.test(text)) return `${text.trimEnd()}\n\nawait closeAllBrowsers();\n`;
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

function cleanupBraces(text) {
  text = text.replace(
    /function fail\(([^)]*)\)\s*\{\s*console\.error\(([^)]*(?:\([^)]*\)[^)]*)*)\);\s*await closeAllBrowsers\(\);\s*process\.exit\(1\);\s*\}/g,
    "function fail($1) {\n  console.error($2);\n  closeAllBrowsers().finally(() => process.exit(1));\n}"
  );
  text = text.replace(
    /main\(\)\.catch\(\(([^)]*)\)\s*=>\s*\{\s*console\.error\([^)]*\);\s*await closeAllBrowsers\(\);\s*process\.exit\(1\);\s*\}\);/g,
    "main().catch(($1) => {\n  console.error($1);\n  closeAllBrowsers().finally(() => process.exit(1));\n});"
  );
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{\n(\s*)await page\./g,
    "await withPlaywrightBrowser(async (browser) => {\n$1const page = await browser.newPage();\n$1await page."
  );
  return text;
}

function fixWaitAndCapture(text) {
  if (!text.includes("Fixture detected")) return text;
  return `#!/usr/bin/env node
/**
 * fixtures/real-device-localStorage.json の出現を待ってからスクショ取得
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "..", "fixtures", "real-device-localStorage.json");
const WAIT_MS = Number(process.env.WAIT_MS || 300000);
const INTERVAL_MS = 2000;

async function main() {
  console.log("Waiting for:", FIXTURE);
  console.log("実機でエクスポートして上記パスに保存してください（最大", WAIT_MS / 1000, "秒）");
  const start = Date.now();
  while (Date.now() - start < WAIT_MS) {
    if (fs.existsSync(FIXTURE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
        if (parsed["tasful:builder:mvp:v1"]) {
          console.log("Fixture detected. Running capture...");
          await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [path.join(__dirname, "capture-with-real-device-localStorage.mjs")], {
              stdio: "inherit",
              cwd: path.join(__dirname, ".."),
            });
            child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(String(code)))));
          });
          return;
        }
      } catch {
        /* retry */
      }
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.error("Timeout: fixture not found.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

const files = fs.existsSync(LIST)
  ? fs.readFileSync(LIST, "utf8").trim().split(/\r?\n/).filter(Boolean)
  : [];

const fixed = [];
const skipped = [];
const stillBroken = [];

for (const rel of files) {
  const file = path.join(ROOT, rel);

  if (rel.endsWith("wait-and-capture-real-device-localStorage.mjs")) {
    fs.writeFileSync(file, fixWaitAndCapture(""));
    if (!hasSyntaxError(file)) fixed.push(rel);
    else stillBroken.push(rel);
    continue;
  }

  if (rel.endsWith("_debug-talk-save2.mjs")) {
    skipped.push(rel);
    continue;
  }

  const original = gitShow(rel);
  if (!original) {
    skipped.push(rel);
    continue;
  }

  let text = ensureImports(original, rel);
  text = migrateLaunchBlocks(text);
  text = addCloseAllBeforeExit(text);
  text = cleanupBraces(text);
  fs.writeFileSync(file, text);

  if (!hasSyntaxError(file)) fixed.push(rel);
  else stillBroken.push(rel);
}

console.log(JSON.stringify({ total: files.length, fixed: fixed.length, skipped, stillBroken }, null, 2));
