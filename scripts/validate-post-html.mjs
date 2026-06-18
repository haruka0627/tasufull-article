import { readFileSync } from "node:fs";
import * as parse5 from "parse5";

const s = readFileSync("post.html", "utf8");
parse5.parse(s);

const lines = s.split("\n");
for (const n of [671, 1511]) {
  console.log(`line ${n}:`, lines[n - 1]?.slice(0, 100));
}

const patterns = [
  "E/option>",
  "E/label>",
  "E/p>",
  "E/span>",
  "\uFFFD",
  "E/option",
  "対忁",
  "相諁",
];
for (const p of patterns) {
  const c = s.split(p).length - 1;
  if (c) console.log(`${p}: ${c}`);
}

const opens = (s.match(/<select\b/gi) || []).length;
const closes = (s.match(/<\/select>/gi) || []).length;
console.log(`select open=${opens} close=${closes} match=${opens === closes}`);
console.log("parse5: OK");
