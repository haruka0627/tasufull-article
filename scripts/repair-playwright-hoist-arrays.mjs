#!/usr/bin/env node
/** Hoist `const arr = []` out of withPlaywrightBrowser when used after closing }); */
import fs from "node:fs";
import path from "node:path";
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

let n = 0;
for (const f of walk(path.join(ROOT, "scripts"))) {
  let t = fs.readFileSync(f, "utf8");
  const re =
    /await withPlaywrightBrowser\(async \(browser\) => \{const (\w+) = \[\];\s*\n/g;
  if (!re.test(t)) continue;
  t = t.replace(
    /await withPlaywrightBrowser\(async \(browser\) => \{const (\w+) = \[\];\s*\n/g,
    "let $1 = [];\nawait withPlaywrightBrowser(async (browser) => {\n"
  );
  fs.writeFileSync(f, t);
  n++;
}
console.log("hoisted arrays in", n, "files");
