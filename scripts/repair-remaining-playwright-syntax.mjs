#!/usr/bin/env node
/**
 * Targeted repair for remaining Playwright script syntax errors.
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
  if (!new RegExp(`from\\s*[\"']${lp.replace(/\./g, "\\.")}[\"']`).test(text)) {
    const ins = `import { withPlaywrightBrowser, closeAllBrowsers } from "${lp}";\n`;
    const shebang = text.match(/^#![^\n]*\n/)?.[0] || "";
    const rest = shebang ? text.slice(shebang.length) : text;
    const m = rest.match(/^((?:import[^\n]+\n)+)/);
    text = shebang + (m ? m[1] + ins + rest.slice(m[1].length) : ins + rest);
  }
  return text;
}

function migrateLaunchBlocks(text) {
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, cv, catchB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});\n${indent}${fin.trim()}`;
    }
  );
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*finally\s*\{\s*await\s+\2\.close\(\)[^;]*;\s*([\s\S]*?)\}/g,
    (_, indent, vn, mid, tryB, fin) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}${tb}${indent}});\n${indent}${fin.trim()}`;
    }
  );
  text = text.replace(
    /([ \t]*)(?:const|let)\s+(\w+)\s*=\s*await\s+chromium\.launch\([\s\S]*?\);\s*([\s\S]*?)try\s*\{([\s\S]*?)\}\s*catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*await\s+\2\.close\(\)[^;]*;/g,
    (_, indent, vn, mid, tryB, cv, catchB) => {
      const pre = vn === "browser" ? mid : mid.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const tb = vn === "browser" ? tryB : tryB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      const cb = vn === "browser" ? catchB : catchB.replace(new RegExp(`\\b${vn}\\b`, "g"), "browser");
      return `${indent}await withPlaywrightBrowser(async (browser) => {${pre}try {${tb}} catch (${cv}) {${cb}}${indent}});`;
    }
  );
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
  if (/process\.exit\s*\(/.test(text) && !/closeAllBrowsers/.test(text)) {
    text = text.replace(/(\n\s*process\.exit\s*\([^)]+\);?\s*)$/, "\nawait closeAllBrowsers();$1");
  }
  return text;
}

function repairText(text, rel) {
  if (/^import[^\n]+\n#!\/usr\/bin\/env node\n/.test(text)) {
    const lines = text.split("\n");
    text = `#!/usr/bin/env node\n${lines[0]}\n${lines.slice(2).join("\n")}`;
  }
  text = text.replace(
    /import\s*\{\s*chromium\s*\}\s*from\s*[\"']\.\/lib\/playwright-browser\.mjs[\"'];?\n?/g,
    ""
  );
  text = text.replace(
    /function fail\(([^)]*)\)\s*\{\s*console\.error\(([^)]*(?:\([^)]*\)[^)]*)*)\);\s*await closeAllBrowsers\(\);\s*process\.exit\(1\);\s*\}/g,
    "function fail($1) {\n  console.error($2);\n  closeAllBrowsers().finally(() => process.exit(1));\n}"
  );
  if (/await withPlaywrightBrowser/.test(text) && /\} catch \(/.test(text)) {
    const wrapper = text.match(/await withPlaywrightBrowser\(async \(browser\) => \{[\s\S]*?\}\);/);
    if (wrapper && !/\btry\s*\{/.test(wrapper[0])) {
      text = text.replace(
        /(await withPlaywrightBrowser\(async \(browser\) => \{\s*(?:const page = await browser\.newPage\(\);\s*)?)/,
        "$1try {\n  "
      );
    }
  }
  text = text.replace(/\}\);\n\}\s*(\nawait closeAllBrowsers|\n*$)/m, "});\n$1");
  text = text.replace(/\}\);\n\}\s*$/m, "});\n");
  text = text.replace(/\} catch \(([^)]*)\) \{[\s\S]*?\n\s*\}\);\s*\n\s*\}\);/g, (m) => m.replace(/\n\s*\}\);\s*$/, "\n});"));
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{\n(\s*)await page\./g,
    "await withPlaywrightBrowser(async (browser) => {\n$1const page = await browser.newPage();\n$1await page."
  );
  return text;
}

function fixWaitAndCapture(text) {
  if (!text.includes("wait-and-capture-real-device-localStorage")) return text;
  if (!/^\s*return;\s*$/m.test(text)) return text;
  return text
    .replace(
      /console\.log\("Waiting for:"[\s\S]*?process\.exit\(1\);\s*$/,
      `async function main() {
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
`
    );
}

const files = fs.readFileSync(LIST, "utf8").trim().split(/\r?\n/).filter(Boolean);
const fixed = [];
const stillBroken = [];

for (const rel of files) {
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, "utf8");

  if (rel.includes("inspect-bench-notify-cta-chain") || (text.length < 500 && /chromium\.launch/.test(gitShow(rel) || ""))) {
    const original = gitShow(rel);
    if (original) {
      text = ensureImports(original, rel);
      text = migrateLaunchBlocks(text);
    }
  } else if (/chromium\.launch/.test(gitShow(rel) || "")) {
    const original = gitShow(rel);
    if (original) {
      text = ensureImports(original, rel);
      text = migrateLaunchBlocks(text);
    }
  }

  text = repairText(text, rel);
  if (rel.endsWith("wait-and-capture-real-device-localStorage.mjs")) {
    text = fixWaitAndCapture(text);
  }

  fs.writeFileSync(file, text);
  if (!hasSyntaxError(file)) fixed.push(rel);
  else stillBroken.push(rel);
}

console.log(JSON.stringify({ total: files.length, fixed: fixed.length, stillBroken }, null, 2));
