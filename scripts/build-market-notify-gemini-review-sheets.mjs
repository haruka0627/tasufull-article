#!/usr/bin/env node
/**
 * TASFUL市場通知 — Gemini UI/UX レビュー用合成シート（10枚）
 *
 * 入力: screenshots/market-notify-390/ , screenshots/market-notify-pc/
 * 出力: screenshots/market-notify-gemini-review/
 *
 *   npm run screenshots:market-notify-gemini
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import {
  buildGridReviewSheet,
  buildSinglePanelReviewSheet,
  buildThreePanelReviewSheet,
  buildTwoPanelReviewSheet,
} from "./lib/gemini-review-sheet.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_390 = path.join(ROOT, "screenshots", "market-notify-390");
const SRC_PC = path.join(ROOT, "screenshots", "market-notify-pc");
const OUT_DIR = path.join(ROOT, "screenshots", "market-notify-gemini-review");

const NOTIFY_SHEETS = [
  { id: "01-purchase", file: "01-purchase-review-sheet.png", title: "購入通知レビューシート", subtitle: "出品者（u_bakery）— 390×667" },
  { id: "02-order-accepted", file: "02-order-accepted-review-sheet.png", title: "注文受付レビューシート", subtitle: "購入者（u_me）— 390×667" },
  { id: "03-preparing", file: "03-preparing-review-sheet.png", title: "発送準備中レビューシート", subtitle: "購入者（u_me）— 390×667" },
  { id: "04-shipped", file: "04-shipped-review-sheet.png", title: "発送済みレビューシート", subtitle: "購入者（u_me）— 390×667" },
  { id: "05-delivered", file: "05-delivered-review-sheet.png", title: "配達完了レビューシート", subtitle: "購入者（u_me）— 390×667" },
  { id: "06-review", file: "06-review-review-sheet.png", title: "レビュー依頼レビューシート", subtitle: "購入者（u_me）— 390×667" },
];

function src390(id, kind) {
  return path.join(SRC_390, `market-notify-${id}-${kind}.png`);
}

function srcPc(id, kind) {
  return path.join(SRC_PC, `market-notify-${id}-${kind}.png`);
}

function assertSources() {
  const missing = [];
  for (const spec of NOTIFY_SHEETS) {
    for (const kind of ["talk-list", "card", "dest"]) {
      const p = src390(spec.id, kind);
      if (!fs.existsSync(p)) missing.push(p);
    }
  }
  for (const kind of ["buyer-list-full", "seller-list-full"]) {
    const p = path.join(SRC_390, `market-notify-${kind}.png`);
    if (!fs.existsSync(p)) missing.push(p);
  }
  for (const spec of NOTIFY_SHEETS) {
    if (!fs.existsSync(srcPc(spec.id, "dest"))) missing.push(srcPc(spec.id, "dest"));
  }
  if (missing.length) {
    throw new Error(
      `ソース画像が不足しています。先に npm run screenshots:market-notify-ui を実行してください。\n${missing.slice(0, 5).join("\n")}${missing.length > 5 ? `\n…他 ${missing.length - 5} 件` : ""}`
    );
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
assertSources();

/** @type {Array<{ index: number, file: string, title: string, description: string, path: string }>} */
const manifest = [];

for (let i = 0; i < NOTIFY_SHEETS.length; i += 1) {
  const spec = NOTIFY_SHEETS[i];
  const outPath = path.join(OUT_DIR, spec.file);
  await buildThreePanelReviewSheet({
    title: spec.title,
    subtitle: spec.subtitle,
    leftPath: src390(spec.id, "talk-list"),
    centerPath: src390(spec.id, "card"),
    rightPath: src390(spec.id, "dest"),
    leftLabel: "通知一覧",
    centerLabel: "通知カード",
    rightLabel: "遷移先",
    outPath,
  });
  manifest.push({
    index: i + 1,
    file: spec.file,
    title: spec.title,
    description: "左: 通知一覧 / 中央: 通知カード / 右: 遷移先",
    path: outPath.replace(/\\/g, "/"),
  });
}

const buyerOut = path.join(OUT_DIR, "07-buyer-notify-list-summary.png");
await buildSinglePanelReviewSheet({
  title: "購入者通知一覧まとめ",
  subtitle: "u_me — 市場通知5種（390×667）",
  imagePath: path.join(SRC_390, "market-notify-buyer-list-full.png"),
  outPath: buyerOut,
});
manifest.push({
  index: 7,
  file: "07-buyer-notify-list-summary.png",
  title: "購入者通知一覧まとめ",
  description: "購入者（u_me）のTALK通知一覧 — 5種の市場通知",
  path: buyerOut.replace(/\\/g, "/"),
});

const sellerOut = path.join(OUT_DIR, "08-seller-notify-list-summary.png");
await buildSinglePanelReviewSheet({
  title: "出品者通知一覧まとめ",
  subtitle: "u_bakery — 購入通知（390×667）",
  imagePath: path.join(SRC_390, "market-notify-seller-list-full.png"),
  outPath: sellerOut,
});
manifest.push({
  index: 8,
  file: "08-seller-notify-list-summary.png",
  title: "出品者通知一覧まとめ",
  description: "出品者（u_bakery）のTALK通知一覧 — 購入通知",
  path: sellerOut.replace(/\\/g, "/"),
});

const layout390Out = path.join(OUT_DIR, "09-layout-390-summary.png");
await buildGridReviewSheet({
  title: "390px 全体レイアウトまとめ",
  subtitle: "iPhone SE相当（390×667）— 6種の遷移先画面",
  columns: 3,
  items: NOTIFY_SHEETS.map((spec) => ({
    label: spec.title.replace("レビューシート", ""),
    path: src390(spec.id, "dest"),
  })),
  outPath: layout390Out,
});
manifest.push({
  index: 9,
  file: "09-layout-390-summary.png",
  title: "390px 全体レイアウトまとめ",
  description: "6種すべての遷移先画面（390px）を1枚で俯瞰",
  path: layout390Out.replace(/\\/g, "/"),
});

const layoutPcOut = path.join(OUT_DIR, "10-layout-pc-summary.png");
await buildGridReviewSheet({
  title: "PC 全体レイアウトまとめ",
  subtitle: "1280×900 — 6種の遷移先画面",
  columns: 3,
  items: NOTIFY_SHEETS.map((spec) => ({
    label: spec.title.replace("レビューシート", ""),
    path: srcPc(spec.id, "dest"),
  })),
  outPath: layoutPcOut,
});
manifest.push({
  index: 10,
  file: "10-layout-pc-summary.png",
  title: "PC 全体レイアウトまとめ",
  description: "6種すべての遷移先画面（PC）を1枚で俯瞰",
  path: layoutPcOut.replace(/\\/g, "/"),
});

const indexPath = path.join(OUT_DIR, "gemini-review-index.json");
fs.writeFileSync(
  indexPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      purpose: "Gemini UI/UX レビュー添付用（10枚以内）",
      sheetWidth: 1920,
      outputDir: OUT_DIR.replace(/\\/g, "/"),
      source390: SRC_390.replace(/\\/g, "/"),
      sourcePc: SRC_PC.replace(/\\/g, "/"),
      sheets: manifest,
    },
    null,
    2
  ),
  "utf8"
);

console.log(JSON.stringify({ ok: true, count: manifest.length, outDir: OUT_DIR.replace(/\\/g, "/"), indexPath }, null, 2));
console.log("\n--- Gemini レビュー用 10枚 ---\n");
for (const s of manifest) {
  console.log(`${s.index}. ${s.file}\n   ${s.title}\n   ${s.description}\n`);
}
