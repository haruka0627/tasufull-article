import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "index-top.html");
const rankingPath = join(root, "scripts", "_ranking-sections.html");

const lines = readFileSync(indexPath, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('aria-labelledby="rankingPopularTitle"'));
const end = lines.findIndex((l) => l.includes('class="top-line-support"'));
if (start < 0 || end < 0) throw new Error("markers not found");

const ranking = readFileSync(rankingPath, "utf8").trimEnd().split(/\r?\n/);
const out = [...lines.slice(0, start - 1), ...ranking, "", ...lines.slice(end - 1)];
writeFileSync(indexPath, out.join("\n"));
console.log("updated", indexPath, "lines", out.length);
