import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const path = join(dirname(fileURLToPath(import.meta.url)), "..", "index-top.html");
let html = readFileSync(path, "utf8");

html = html.replaceAll('class="top-mini-rank"', 'class="top-mini-rank ranking-card"');
html = html.replaceAll('class="top-mini-rank__badge"', 'class="ranking-rank top-mini-rank__badge"');
html = html.replaceAll('class="top-mini-rank__thumb"', 'class="ranking-thumb top-mini-rank__thumb"');
html = html.replaceAll('class="top-mini-rank__meta"', 'class="ranking-meta top-mini-rank__meta"');
html = html.replaceAll('class="top-mini-rank__price"', 'class="ranking-price top-mini-rank__price"');

html = html.replace(
  /(<span class="ranking-thumb top-mini-rank__thumb">[\s\S]*?<\/span>)\s*<span class="top-mini-rank__title">/g,
  '$1<span class="ranking-body"><span class="ranking-title top-mini-rank__title">'
);

html = html.replace(
  /(<span class="ranking-price top-mini-rank__price">[^<]*<\/span>)\s*<\/a>/g,
  "$1</span></a>"
);

html = html.replaceAll(
  '<span class="top-mini-rank__title">',
  '<span class="ranking-title top-mini-rank__title">'
);

writeFileSync(path, html);
console.log("done");
