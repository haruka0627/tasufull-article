#!/usr/bin/env node
/** Remove invalid `await closeAllBrowsers()` inside non-async .catch() callbacks */
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
  const next = t.replace(/(\.catch\s*\(\([^)]*\)\s*=>\s*\{[^}]*?)\n\s*await closeAllBrowsers\(\);\s*\n/g, "$1\n");
  if (next !== t) {
    fs.writeFileSync(f, next);
    n++;
  }
}
console.log("stripped invalid catch closeAll from", n, "files");
