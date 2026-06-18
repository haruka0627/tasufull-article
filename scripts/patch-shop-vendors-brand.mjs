#!/usr/bin/env node
/**
 * shop-vendors.html — ブランド統一パッチ（CSS・フッター・ロゴ・body class）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorsPath = path.join(root, "shop-vendors.html");

const MARKET_FOOTER = `
  <footer class="tasful-market-footer tasful-shop-mall-footer" aria-label="TASFUL市場フッター">
    <div class="tasful-market-footer__inner">
      <div class="tasful-market-footer__brand-block">
        <p class="tasful-market-footer__brand">TASFUL市場</p>
        <p class="tasful-market-footer__lead">安心して売買できる</p>
        <p class="tasful-market-footer__sub">TASFULのショッピングマーケット</p>
      </div>

      <nav class="tasful-market-footer__block" aria-labelledby="tasful-shop-mall-footer-guide">
        <h2 class="tasful-market-footer__heading" id="tasful-shop-mall-footer-guide">ご利用ガイド</h2>
        <ul class="tasful-market-footer__links">
          <li><a href="index-top.html">配送について</a></li>
          <li><a href="index-top.html">返品・キャンセル</a></li>
          <li><a href="ai-workspace.html">よくある質問</a></li>
          <li><a href="index-top.html">お問い合わせ</a></li>
        </ul>
      </nav>

      <nav class="tasful-market-footer__block" aria-labelledby="tasful-shop-mall-footer-seller">
        <h2 class="tasful-market-footer__heading" id="tasful-shop-mall-footer-seller">出品する</h2>
        <ul class="tasful-market-footer__links">
          <li><a href="post.html?scope=business">出店ガイド</a></li>
          <li><a href="builder/mvp-partner-register.html">Connect認証について</a></li>
        </ul>
      </nav>

      <p class="tasful-market-footer__copy">© TASFUL</p>
    </div>
  </footer>
`;

let html = fs.readFileSync(vendorsPath, "utf8");

if (!html.includes("shop-vendors-brand.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="shop-store-cards.css">',
    '<link rel="stylesheet" href="shop-store-cards.css">\n  <link rel="stylesheet" href="shop-vendors-brand.css">'
  );
}

html = html.replace(
  '<body class="shop-store-list-page" data-page="shop_store_list">',
  '<body class="shop-store-list-page tasful-shop-mall-brand" data-page="shop_store_list">'
);

html = html.replace(
  /src="images\/tasful-(?:market-header-logo|ai-globe)\.png[^"]*"/,
  'src="images/tasful-globe-logo.png"'
);

if (!html.includes('src="images/tasful-globe-logo.png"')) {
  console.error("globe logo not applied");
  process.exit(1);
}

html = html.replace(
  'aria-label="TASFUL プラットフォームTOP"',
  'aria-label="TASFUL 店舗・販売 TOP"'
);

html = html.replace(
  'class="tasful-ai-logo-icon"\n        >',
  'class="tasful-ai-logo-icon"\n          width="58"\n          height="58"\n          decoding="async"\n        >'
);

html = html.replace('alt=""', 'alt="TASFUL"');

html = html.replace(
  '<span class="sub">プラットフォーム</span>',
  '<span class="sub">店舗・販売</span>'
);

if (!html.includes("tasful-market-footer")) {
  html = html.replace(/\n  <script src="https:\/\/cdn\.jsdelivr\.net/, `${MARKET_FOOTER}\n\n  <script src="https://cdn.jsdelivr.net`);
}

fs.writeFileSync(vendorsPath, html, "utf8");
console.log("Patched shop-vendors.html");
