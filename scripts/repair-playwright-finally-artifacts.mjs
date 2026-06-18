#!/usr/bin/env node
/** Repair broken try/finally codemod artifacts in withPlaywrightBrowser blocks */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function repair(text) {
  // try { ... } finally { }); cleanup → body + });
  text = text.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{(?:const errors = \[\];\s*)?try \{/g,
    "await withPlaywrightBrowser(async (browser) => {"
  );
  text = text.replace(/\} finally \{\s*\}\);\s*/g, "});\n");
  text = text.replace(/\}\);\n([ \t]*server\.close\(\);)\n[ \t]*\}\n\}/g, "});\n$1\n}");
  // } catch { ... }); → } catch { ... } });
  text = text.replace(/\}\);\n\}\n(\nawait closeAllBrowsers)/g, "});\n$1");
  // trailing await closeAllBrowsers after main().catch — move before catch or remove duplicate
  text = text.replace(
    /(main\(\)\.catch\([^)]+\)\s*;\s*)\nawait closeAllBrowsers\(\);\s*$/m,
    "$1"
  );
  text = text.replace(
    /(\.catch\s*\(\([^)]*\)\s*=>\s*\{[^}]*?)\n\s*await closeAllBrowsers\(\);\s*\n/g,
    "$1\n"
  );
  return text;
}

let fixed = 0;
for (const f of walk(path.join(ROOT, "scripts"))) {
  if (!hasSyntaxError(f)) continue;
  let t = fs.readFileSync(f, "utf8");
  const next = repair(t);
  if (next !== t) {
    fs.writeFileSync(f, next);
    if (!hasSyntaxError(f)) fixed++;
  }
}
console.log({ fixed, remaining: walk(path.join(ROOT, "scripts")).filter(hasSyntaxError).length });
