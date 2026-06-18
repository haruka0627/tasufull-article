#!/usr/bin/env node
/**
 * Phase 2-E: fix job-top.html encoding (DOM / scripts / data-* preserved).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET = "job-top.html";

const CLOSE_TAGS = [
  "span",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "div",
  "option",
  "label",
  "legend",
  "dt",
  "dd",
  "p",
  "section",
  "aside",
  "button",
  "li",
  "ul",
  "nav",
  "main",
  "footer",
  "header",
];

function fixBrokenHtmlTokens(text) {
  let out = text;
  out = out.replace(/Ebr>/g, "<br>");
  out = out.replace(/E\/(\w+)>/g, "</$1>");
  out = out.replace(/aria-label="([^"]*?)E>/g, 'aria-label="$1">');
  out = out.replace(/placeholder="([^"]*?)E>/g, 'placeholder="$1">');
  return out;
}

function fixFffdPatterns(text) {
  let out = text;
  out = out.replace(/老E\uFFFD*/g, "者");
  out = out.replace(/チE\uFFFD*/g, "ック");
  out = out.replace(/メチE\uFFFD*/g, "ッセ");
  out = out.replace(/キーワ\uFFFD*ーチE/g, "キーワード");
  out = out.replace(/カチE\uFFFD*/g, "カテゴ");
  out = out.replace(/ペE\uFFFD*/g, "ページ");
  out = out.replace(/頁E\uFFFD*/g, "順");
  out = out.replace(/形慁E/g, "形態");
  out = out.replace(/予箁E/g, "予算");
  out = out.replace(/忁E\uFFFD*/g, "必要");
  out = out.replace(/賁E\uFFFD*/g, "資格");
  out = out.replace(/急勁E/g, "急募");
  out = out.replace(/開姁E/g, "開始");
  out = out.replace(/操佁E/g, "操作");
  out = out.replace(/名\uFFFD+/g, "名・");
  out = out.replace(/容\uFFFD+/g, "内容");
  out = out.replace(/E\uFFFD+/g, "");
  out = out.replace(/([ぁ-ん一-龥ァ-ヶ])E(?![a-zA-Z-])/g, "$1");
  out = out.replace(/\uFFFD+/g, "");
  return out;
}

const JOB_TOP_TEXT_FIXES = [
  ["求人を探ぁE", "求人を探す"],
  ["求人サイトEチEー", "求人サイトヘッダー"],
  ["求人サイトEックー", "求人サイトヘッダー"],
  ["求人名・E会社名・E業務E容", "求人名・会社名・業務内容"],
  ['placeholder="例！Eヶ月E長朁', 'placeholder="例：3ヶ月・長期"'],
  ["名・E", "名・"],
  ["クイチEアクション", "クイックアクション"],
  ["掲載すめE", "掲載する"],
  ["一覧トッチE", "一覧トップ"],
  ["メチEージ", "メッセージ"],
  ["お気に入めE", "お気に入り"],
  ["求人名E会社名E業務E容", "求人名・会社名・業務内容"],
  ["雁E形慁E", "雇用形態"],
  ["予箁E単価", "予算・単価"],
  ["月額E時給", "月額・時給"],
  ["表示してぁEす、E", "表示しています。"],
  ["表示してぁEす", "表示しています"],
  ["こE条件", "この条件"],
  ['placeholder="キーワーチE>', 'placeholder="キーワード">'],
  ['placeholder="例！Eヶ月E長朁E>', 'placeholder="例：3ヶ月・長期">'],
  ["募集状況E", "募集状況"],
  ["急募Eみ", "急募のみ"],
  ["賁E忁EE", "資格必須"],
  ["賁E忁E", "資格必須"],
  ["並び頁E", "並び順"],
  ["新着頁E", "新着順"],
  ["注目掲載優允E", "注目掲載優先"],
  ["PR優允E", "PR優先"],
  ["求人カチEリ", "求人カテゴリ"],
  ["会社吁E/ 案件吁E", "会社名 / 案件名"],
  ["忁E期閁E", "必要期間"],
  ["求人一覧EモバイルEE", "求人一覧（モバイル）"],
  ["ペEジ送り", "ページ送り"],
  ["E度お試し", "再度お試し"],
  ["ください、E", "ください。"],
  ["できます、E", "できます。"],
  ["、E/p>", "。</p>"],
  ["探ぁE", "探す"],
  ["すめE", "する"],
  ["トッチE", "トップ"],
  ["ぁE", "い"],
  ["頁E", "順"],
  ["頁E", "順"],
  ["優允E", "優先"],
  ["形慁E", "形態"],
  ["箁E", "算"],
  ["吁E", "名"],
  ["閁E", "間"],
  ["佁E", "作"],
  ["勁E", "募"],
  ["姁E", "始"],
  ["況E", "況"],
  ["チE", "ック"],
  ["メチE", "ッセ"],
];

const SHARED_TEXT_FIXES = [
  ["お気に入め", "お気に入り"],
  ["読み込んでいす", "読み込んでいます"],
  ["相諁", "相談"],
  ["口コチ", "口コミ"],
  ["戻め", "戻る"],
  ["お問ぁ", "お問い"],
  ["問い合わぁ", "問い合わせ"],
  ["につぁ", "について"],
  ["掲載老", "掲載者"],
];

function fixGarbledAttributes(text) {
  let out = text;
  out = out.replace(/aria-label="([^"]+) hidden>/g, 'aria-label="$1" hidden>');
  out = out.replace(/placeholder="([^"]+)>/g, (m, inner) => {
    if (inner.includes('"')) return m;
    if (/[^\u0000-\u007F]/.test(inner) && !inner.endsWith('"')) {
      return `placeholder="${inner}">`;
    }
    return m;
  });
  return out;
}

function fixOrphanCloseTags(text) {
  let out = text;
  for (const tag of CLOSE_TAGS) {
    out = out.replace(new RegExp(`([^<])\\/${tag}>`, "g"), `$1</${tag}>`);
  }
  return out;
}

function applyTextFixes(text, pairs) {
  let out = text;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

function fixJobTopHtml(text) {
  let out = text;
  out = fixBrokenHtmlTokens(out);
  out = fixFffdPatterns(out);
  out = applyTextFixes(out, JOB_TOP_TEXT_FIXES);
  out = applyTextFixes(out, SHARED_TEXT_FIXES);
  out = fixOrphanCloseTags(out);
  out = fixGarbledAttributes(out);
  out = out.replace(/\uFFFD/g, "");
  out = out.replace(/\?\?/g, "");
  return out;
}

const abs = path.join(ROOT, TARGET);
const before = fs.readFileSync(abs, "utf8");
const after = fixJobTopHtml(before);
fs.writeFileSync(abs, after, "utf8");

const ufffd = (after.match(/\uFFFD/g) || []).length;
const brokenClose =
  (after.match(/[^<]\/(?:span|a|h[1-6]|div|p|section|button|legend|label|option)>/g) || [])
    .length;
const eTag = (after.match(/E\/[a-z]+>/gi) || []).length;
const strayE = (after.match(/[ぁ-ん一-龥ァ-ヶ]E[^/\s<"']/g) || []).length;
const question = (after.match(/\?\?/g) || []).length;

console.log(
  JSON.stringify(
    {
      file: TARGET,
      changed: before !== after,
      ufffd,
      eTag,
      strayE,
      question,
      brokenClose,
      ok: ufffd === 0 && eTag === 0 && question === 0 && brokenClose === 0 && strayE === 0,
    },
    null,
    2
  )
);

process.exit(
  ufffd === 0 && eTag === 0 && question === 0 && brokenClose === 0 && strayE === 0 ? 0 : 1
);
