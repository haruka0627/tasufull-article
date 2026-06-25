import fs from "node:fs";

const path = "live/channel-content.html";
let html = fs.readFileSync(path, "utf8");
const before = html;

const pattern =
  /<header class="tlv-studio-mobile-header">[\s\S]*?<\/header>\s*<main class="tlv-studio-mobile-content">/;

const replacement = `<header class="tlv-studio-mobile-header">
      <button type="button" class="tlv-studio-mobile-header__menu" data-tlv-studio-menu-toggle aria-label="メニュー">☰</button>
      <h1 class="tlv-studio-mobile-header__title">コンテンツ</h1>
      <a class="tlv-studio-mobile-header__upload" href="video-upload.html" aria-label="作成">+</a>
    </header>
    <main class="tlv-studio-mobile-content">`;

if (!pattern.test(html)) {
  console.error("pattern did not match");
  process.exit(1);
}

html = html.replace(pattern, replacement);
fs.writeFileSync(path, html, "utf8");
console.log("fixed");
console.log(html.split("\n").slice(63, 75).join("\n"));
