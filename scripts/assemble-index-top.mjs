import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const htmlPath = path.join(root, "index-top.html");
const fragmentPath = path.join(root, "tas-top-main.fragment.html");
const html = fs.readFileSync(htmlPath, "utf8");
const fragment = fs.readFileSync(fragmentPath, "utf8");
const mainStart = html.indexOf('<main class="top-main">');
const mainEnd = html.indexOf("</main>") + "</main>".length;
const footer = html.slice(mainEnd);
let head = html.slice(0, mainStart);
head = head
  .replace('<link rel="stylesheet" href="tas-hero.css">\n', "")
  .replace('<link rel="stylesheet" href="top-ranking.css">\n', "")
  .replace("</head>", '  <link rel="stylesheet" href="tas-top-page.css">\n</head>')
  .replace('class="top-page"', 'class="top-page top-page--ref"');
const out =
  head +
  fragment +
  footer.replace('<script src="top.js" defer></script>\n', "");
fs.writeFileSync(htmlPath, out, "utf8");
console.log("index-top.html updated, lines:", out.split("\n").length);
