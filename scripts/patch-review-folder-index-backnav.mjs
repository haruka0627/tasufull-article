#!/usr/bin/env node
/** 既存のレビュー folder index.html に戻る導線を挿入 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderScreenshotBackNav, SCREENSHOT_BACK_NAV_CSS } from "./lib/screenshot-image-viewer.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = [
  "connect-final-review",
  "builder-final-review",
  "talk-notification-final-review",
  "anpi-final-review",
];

const backNav = renderScreenshotBackNav();
const styleSnippet = SCREENSHOT_BACK_NAV_CSS.trim();

for (const id of folders) {
  const file = path.join(root, "screenshots", id, "index.html");
  if (!fs.existsSync(file)) {
    console.warn("skip (missing):", file);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("screenshot-back-nav")) {
    if (html.includes("</style>")) {
      html = html.replace("</style>", `${styleSnippet}</style>`);
    } else if (html.includes("<body>")) {
      html = html.replace("<body>", `<body><style>${styleSnippet}</style>`);
    }
    html = html.replace(/<body>/, `<body>${backNav}`);
  }
  html = html.replace(/<p><a href="\.\.\/index\.html">screenshots\/index\.html<\/a><\/p>/g, "");
  fs.writeFileSync(file, html, "utf8");
  console.log("patched:", file);
}
