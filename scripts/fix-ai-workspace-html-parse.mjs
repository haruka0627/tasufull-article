#!/usr/bin/env node
/**
 * ai-workspace.html — Vite parse 修復（UTF-8）
 * - E/span> 等の閉じタグ修復
 * - aria-label 未閉じ修復
 * - 限定的な文言復元（DOCTYPE 等は触らない）
 *
 * 修復後も Vite NG の場合: git checkout -- ai-workspace.html
 */
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "ai-workspace.html");

function fixBrokenHtmlTokens(text) {
  let out = text;
  out = out.replace(/E\/(\w+)>/g, "</$1>");
  out = out.replace(/aria-label="([^"]*?)E>/g, (_, inner) => {
    const cleaned = inner
      .replace(/\uFFFD/g, "")
      .replace(/チE/g, "ット")
      .replace(/ペEジ/g, "ページ")
      .replace(/め$/g, "り");
    return `aria-label="${cleaned}">`;
  });
  out = out.replace(/placeholder="([^"]*?)E>/g, 'placeholder="$1">');
  out = out.replace(/すめE\/a>/g, "する</a>");
  out = out.replace(/戻めE\/a>/g, "戻る</a>");
  out = out.replace(/探ぁE\/a>/g, "探す</a>");
  out = out.replace(/お気に入めE\/span>/g, "お気に入り</span>");
  out = out.replace(/お気に入めE>/g, 'お気に入り">');
  return out;
}

const TEXT_FIXES = [
  ["<!DOCTYP・ html>", "<!DOCTYPE html>"],
  ["サイトEチEー", "サイトヘッダー"],
  ["プラチEフォーム", "プラットフォーム"],
  ["店E・啁E", "店舗・商品"],
  ["カチEリ", "カテゴリ"],
  ["特雁E覧", "特集一覧"],
  ["AI相諁E", "AI相談"],
  ["相諁E", "相談"],
  ["チャチE", "チャット"],
  ["リセチE", "リセット"],
  ["作E", "作成"],
  ["サポEチE", "サポート"],
  ["斁E", "文"],
  ["賁E", "資"],
  ["冁E", "内容"],
  ["整琁E", "整理"],
  ["マイペEジ", "マイページ"],
  ["お問ぁEわせ", "お問い合わせ"],
  ["ↁE", "← "],
  ["Web Speech APIE", "Web Speech API（"],
  ["標準！E", "標準）"],
  ["安否通知E", "安否通知（"],
  ["開発用EE", "開発用）"],
  ["ログEEocalStorageEE", "ログ（localStorage）"],
  ["相場・見積E", "相場・見積の"],
  ["機E", "機能"],
  ["めEE", "や資料"],
  ["、E", "。"],
];

function applyTextFixes(text) {
  let out = text;
  for (const [from, to] of TEXT_FIXES) {
    out = out.split(from).join(to);
  }
  return out.replace(/\uFFFD+/g, "");
}

let html = fs.readFileSync(FILE, "utf8");
const before = html;
html = fixBrokenHtmlTokens(html);
html = applyTextFixes(html);

if (html !== before) {
  fs.writeFileSync(FILE, html, "utf8");
  console.log("Applied mechanical fixes to ai-workspace.html");
} else {
  console.log("No mechanical fixes needed");
}

const server = await createServer();
try {
  await server.transformIndexHtml("/ai-workspace.html", html);
  console.log("Vite transformIndexHtml: OK");
} catch (e) {
  console.error("Vite transformIndexHtml: FAIL");
  console.error(e.message);
  process.exit(1);
} finally {
  await server.close();
}
