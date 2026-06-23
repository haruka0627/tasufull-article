#!/usr/bin/env node
/**
 * Replace TASFUL shared header/footer on IWASHO pages with IWASHO-specific chrome.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const NAV = [
  { href: "/iwasho/", label: "ホーム", id: "home" },
  { href: "/iwasho/services.html", label: "サービス一覧", id: "services" },
  { href: "/iwasho/partners.html", label: "協力パートナー", id: "partners" },
  { href: "/iwasho/team.html", label: "チーム紹介", id: "team" },
  { href: "/iwasho/company.html", label: "会社概要", id: "company" },
  { href: "/company/faq.html", label: "Q&A", id: "faq" },
  { href: "/iwasho/contact.html", label: "お問い合わせ", id: "contact" },
];

const FOOTER_NAV = [
  { href: "/iwasho/company.html", label: "会社概要", id: "company" },
  { href: "/iwasho/services.html", label: "サービス一覧", id: "services" },
  { href: "/iwasho/partners.html", label: "協力パートナー", id: "partners" },
  { href: "/iwasho/contact.html", label: "お問い合わせ", id: "contact" },
  { href: "/iwasho/privacy.html", label: "プライバシーポリシー", id: "privacy" },
];

const PAGE_ACTIVE = {
  "index.html": "home",
  "services.html": "services",
  "partners.html": "partners",
  "team.html": "team",
  "company.html": "company",
  "contact.html": "contact",
  "about.html": null,
  "privacy.html": "privacy",
};

function navLink(item, activeId) {
  const current = item.id === activeId ? ' aria-current="page"' : "";
  return `<a href="${item.href}"${current}>${item.label}</a>`;
}

function buildHeader(activeId) {
  const desktopNav = NAV.map((item) => navLink(item, activeId)).join("\n        ");
  const mobileNav = NAV.map((item) => navLink(item, activeId)).join("\n          ");

  return `<header class="iw-header">
  <div class="iw-header__inner">
    <a class="iw-header__brand" href="/iwasho/" aria-label="IWASHO × TASFUL ホーム">
      <span class="iw-header__brand-main">IWASHO</span>
      <span class="iw-header__brand-sub">× TASFUL</span>
    </a>
    <nav class="iw-header__nav" aria-label="メインナビ">
        ${desktopNav}
    </nav>
    <a class="iw-header__tasful-link" href="/service">TASFULへ</a>
    <button type="button" class="iw-header__menu-btn" aria-label="メニューを開く" aria-expanded="false" aria-controls="iw-mobile-nav"><span class="iw-header__menu-btn-icon" aria-hidden="true">☰</span></button>
  </div>
  <div class="iw-header__mobile-panel" id="iw-mobile-nav" aria-hidden="true">
    <button type="button" class="iw-header__mobile-backdrop" data-iw-menu-close aria-label="メニューを閉じる"></button>
    <div class="iw-header__mobile-drawer">
      <nav class="iw-header__mobile-nav" aria-label="メインナビ">
          ${mobileNav}
      </nav>
      <a class="iw-header__mobile-tasful" href="/service">TASFULへ</a>
    </div>
  </div>
</header>`;
}

function buildFooter(activeId) {
  const links = FOOTER_NAV.map((item) => navLink(item, activeId)).join("\n        ");

  return `<footer class="iw-footer">
  <div class="iw-footer__inner">
    <div class="iw-footer__top">
      <div class="iw-footer__brand">
        <p class="iw-footer__logo">IWASHO <span>×</span> TASFUL</p>
        <p class="iw-footer__company">IWASHO合同会社</p>
        <p class="iw-footer__desc">美装・防蟻・建設関連工事・現場管理</p>
      </div>
      <nav class="iw-footer__nav" aria-label="フッターナビ">
        ${links}
      </nav>
    </div>
    <div class="iw-footer__bottom">
      <a class="iw-footer__tasful-link" href="/service">TASFULプラットフォームへ</a>
      <p class="iw-footer__copy">&copy; 2026 IWASHO合同会社 All Rights Reserved.</p>
    </div>
  </div>
</footer>
<script src="/iwasho-site-chrome.js" defer></script>
`;
}

const HEADER_RE = /<header class="(?:custom-header|iw-header)">[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="(?:modern-footer|iw-footer)">[\s\S]*?(?:<script src="\/(?:tas-hp-header-menu|iwasho-site-chrome)\.js" defer><\/script>\s*)?<\/footer>\s*(?:<script src="\/(?:tas-hp-header-menu|iwasho-site-chrome)\.js" defer><\/script>\s*)?/;

function patchFile(filePath) {
  const base = path.basename(filePath);
  const activeId = PAGE_ACTIVE[base] ?? null;
  let html = fs.readFileSync(filePath, "utf8");

  if (!HEADER_RE.test(html)) {
    throw new Error(`Header block not found: ${filePath}`);
  }
  if (!FOOTER_RE.test(html)) {
    throw new Error(`Footer block not found: ${filePath}`);
  }

  html = html.replace(HEADER_RE, buildHeader(activeId));
  html = html.replace(FOOTER_RE, buildFooter(activeId));

  html = html.replace(/\s*corp-body--tasful-hp/g, "");
  html = html.replace(/(<body class=")([^"]*)(")/, (_, open, classes, close) => {
    const list = classes.split(/\s+/).filter(Boolean);
    if (!list.includes("iwasho-site")) list.push("iwasho-site");
    return `${open}${[...new Set(list)].join(" ")}${close}`;
  });

  if (!html.includes("iwasho-site-chrome.css")) {
    html = html.replace(
      /(<link rel="stylesheet" href="\/corp-layout\.css" \/>)/,
      '$1\n  <link rel="stylesheet" href="/iwasho-site-chrome.css" />'
    );
  }

  html = html.replace(/\s*<script src="\/tas-hp-header-menu\.js" defer><\/script>\s*/g, "\n");

  fs.writeFileSync(filePath, html, "utf8");
  return base;
}

const targets = [
  ...fs.readdirSync(path.join(ROOT, "iwasho")).filter((f) => f.endsWith(".html")).map((f) => path.join(ROOT, "iwasho", f)),
  ...fs
    .readdirSync(path.join(ROOT, "deploy/cloudflare/dist/iwasho"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(ROOT, "deploy/cloudflare/dist/iwasho", f)),
];

const updated = [];
for (const file of targets) {
  updated.push(patchFile(file));
}

const assets = ["iwasho-site-chrome.css", "iwasho-site-chrome.js"];
for (const asset of assets) {
  fs.copyFileSync(path.join(ROOT, asset), path.join(ROOT, "deploy/cloudflare/dist", asset));
}

console.log(`Updated ${updated.length} pages: ${[...new Set(updated)].join(", ")}`);
console.log(`Synced assets: ${assets.join(", ")}`);
