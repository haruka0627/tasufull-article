import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = join(root, "index-top.html");
const text = readFileSync(p, "utf8");
const start = text.indexOf('        <div class="tas-hero__cards" role="list">');
const end = text.indexOf('      <section class="top-search"');
const frag = readFileSync(join(root, "tas-hero-fragment.html"), "utf8");
let newText = text.slice(0, start) + frag + "\n\n" + text.slice(end);
const old =
  '      </section>\n    </section>\n\n    <section class="top-section';
const replacement =
  '      </section>\n\n    <section class="top-section';
if (newText.includes(old)) {
  newText = newText.replace(old, replacement);
}
writeFileSync(p, newText, "utf8");
console.log("spliced", frag.length);
