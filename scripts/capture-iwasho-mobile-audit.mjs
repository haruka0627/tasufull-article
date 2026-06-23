#!/usr/bin/env node
/**
 * IWASHO スマホ最適化 — 390 / 430 / 768 スクショ + 監査レポート
 *   node scripts/capture-iwasho-mobile-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/iwasho-mobile-audit");
const REPORT = path.join(ROOT, "reports/iwasho-mobile-audit-report.md");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "430", width: 430, height: 932 },
  { id: "768", width: 768, height: 1024 },
];

const PAGES = [
  { slug: "home", path: "/iwasho/", label: "ホーム" },
  { slug: "about", path: "/iwasho/about.html", label: "事業内容" },
  { slug: "services", path: "/iwasho/services.html", label: "対応業務" },
  { slug: "partners", path: "/iwasho/partners.html", label: "パートナー募集" },
  { slug: "team", path: "/iwasho/team.html", label: "チーム紹介" },
  { slug: "company", path: "/iwasho/company.html", label: "会社概要" },
  { slug: "contact", path: "/iwasho/contact.html", label: "お問い合わせ" },
];

async function auditPage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth > doc.clientWidth + 1;
    const imgs = [...document.querySelectorAll("img")].map((img) => ({
      src: img.getAttribute("src") || "",
      alt: img.getAttribute("alt") || "",
      ok: img.complete && img.naturalWidth > 0,
      w: img.getBoundingClientRect().width,
      h: img.getBoundingClientRect().height,
    }));
    const broken = imgs.filter((i) => !i.ok);
    const zeroSize = imgs.filter((i) => i.ok && (i.w < 1 || i.h < 1));
    const buttons = [...document.querySelectorAll("a, button")].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 40 &&
        r.height > 40 &&
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        (el.className.includes("btn") ||
          el.className.includes("Btn") ||
          el.type === "submit")
      );
    });
    const tinyButtons = buttons.filter((el) => el.getBoundingClientRect().height < 48);
    const heroSplit = !!document.querySelector(
      ".iw-contact-hero__graphic, .iwasho-about__graphic, .iwasho-hero__graphic"
    );
    const heroInner = document.querySelector(
      ".iw-contact-hero__inner, .iwasho-about__inner, .iwasho-hero__inner"
    );
    const heroFlex =
      heroInner && getComputedStyle(heroInner).flexDirection.startsWith("row");
    return {
      overflowX,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      brokenImages: broken,
      zeroSizeImages: zeroSize,
      tinyButtons: tinyButtons.length,
      heroSideBySide: heroSplit && heroFlex,
      hasMobileCss: [...document.styleSheets].some((s) => s.href?.includes("corp-biz-mobile.css")),
    };
  });
}

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "iwasho/" });
const results = [];

await withPlaywrightBrowser(async (browser) => {
  for (const pageDef of PAGES) {
    const pageResults = { ...pageDef, viewports: {} };
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(`${base}${pageDef.path}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 200));
      });
      const audit = await auditPage(page);
      const shot = path.join(OUT, `${pageDef.slug}-${vp.id}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      pageResults.viewports[vp.id] = { ...audit, screenshot: path.relative(ROOT, shot).replace(/\\/g, "/") };
      await page.close();
    }
    results.push(pageResults);
  }
});

const lines = [
  "# IWASHO スマホ最適化 監査レポート",
  "",
  `生成日時: ${new Date().toISOString()}`,
  "",
  "## 実施内容（共通）",
  "",
  "- `corp-biz-mobile.css` を全7ページに追加（768px以下のみ適用）",
  "- `body { overflow-x: hidden }`（IWASHOページ）",
  "- 横パディング 20px、セクション上下 64px を基準に統一",
  "- ボタン高さ 52px+、幅100%（max 320px 中央）",
  "- 会社概要・パートナー・お問い合わせヒーローをテキスト上・画像下に統一",
  "- フォーム入力100%、横スクロール禁止",
  "",
  "## ページ別結果",
  "",
];

for (const r of results) {
  lines.push(`### ${r.label} (\`${r.path}\`)`, "");
  lines.push("#### 修正内容");
  lines.push("- 共通モバイルCSS適用");
  if (["company", "partners", "contact"].includes(r.slug)) {
    lines.push("- ヒーローを縦積み（テキスト上・画像下）に統一");
  }
  if (r.slug === "contact") {
    lines.push("- フォームラベル縦並び・入力欄100%");
  }
  lines.push("");

  lines.push("#### 監査結果");
  lines.push("");
  lines.push("| 幅 | 横スクロール | 画像欠損 | ヒーロー左右分割 | mobile.css |");
  lines.push("|----|-------------|---------|-----------------|------------|");

  const issues = [];
  for (const vp of VIEWPORTS) {
    const a = r.viewports[vp.id];
    lines.push(
      `| ${vp.id}px | ${a.overflowX ? "⚠ あり" : "OK"} | ${a.brokenImages.length ? `⚠ ${a.brokenImages.length}件` : "OK"} | ${a.heroSideBySide ? "⚠ あり" : "OK"} | ${a.hasMobileCss ? "OK" : "⚠ 未読込"} |`
    );
    if (a.overflowX) issues.push(`${vp.id}px: 横スクロール (${a.scrollWidth}/${a.clientWidth}px)`);
    if (a.brokenImages.length) {
      issues.push(`${vp.id}px: 画像欠損 ${a.brokenImages.map((i) => i.src).join(", ")}`);
    }
    if (a.heroSideBySide) issues.push(`${vp.id}px: ヒーローが左右分割のまま`);
    if (a.tinyButtons) issues.push(`${vp.id}px: 小さいボタン ${a.tinyButtons}件`);
  }
  lines.push("");

  lines.push("#### スクショ");
  for (const vp of VIEWPORTS) {
    lines.push(`- ${vp.id}px: \`${r.viewports[vp.id].screenshot}\``);
  }
  lines.push("");

  lines.push("#### 残課題 / 要確認");
  if (issues.length === 0) {
    lines.push("- 特になし（自動監査範囲内）");
  } else {
    for (const i of [...new Set(issues)]) lines.push(`- ${i}`);
  }
  lines.push("");
}

lines.push("## 手動確認推奨");
lines.push("");
lines.push("- ハンバーガーメニューの開閉・リンク遷移");
lines.push("- 各ページCTAボタンのタップ領域");
lines.push("- PC 1280px 表示が大きく変わっていないこと");
lines.push("");

fs.writeFileSync(REPORT, lines.join("\n"));
console.log("screenshots:", OUT);
console.log("report:", REPORT);
