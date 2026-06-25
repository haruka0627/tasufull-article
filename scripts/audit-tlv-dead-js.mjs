#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = path.join(ROOT, "live");
const js = fs.readdirSync(LIVE).filter((f) => f.endsWith(".js"));
const html = fs.readdirSync(LIVE).filter((f) => f.endsWith(".html"));
const refs = new Set();
for (const h of html) {
  const t = fs.readFileSync(path.join(LIVE, h), "utf8");
  for (const m of t.matchAll(/src=["']([^"']+\.js)["']/g)) {
    refs.add(path.basename(m[1]));
  }
}
const unreferenced = js.filter((f) => !refs.has(f));
console.log(JSON.stringify({ totalJs: js.length, referenced: refs.size, unreferenced, allJs: js.sort() }, null, 2));
