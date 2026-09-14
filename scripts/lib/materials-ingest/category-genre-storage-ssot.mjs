/**
 * Category → Genre → Drive folder projection.
 * Does not invent a parallel genre taxonomy. Imports existing Demand / UI SSOTs.
 * Storage names follow existing drivePath / folder-name helpers.
 */
import { loadIngestConfig } from "./common.mjs";
import { IMAGE_DEMAND_GENRES } from "./image-demand-genre-ssot.mjs";
import { ILLUSTRATION_DEMAND_GENRES } from "./illustration-demand-genre-ssot.mjs";
import { BACKGROUND_DEMAND_GENRES } from "./background-demand-genre-ssot.mjs";
import { ICON_DEMAND_GENRES } from "./icon-demand-genre-ssot.mjs";
import { SFX_DEMAND_GENRES } from "./sfx-demand-genre-ssot.mjs";
import { BGM_DEMAND_GENRES } from "./bgm-demand-genre-ssot.mjs";
import { WEB_DEMAND_GENRES } from "./web-demand-genre-ssot.mjs";
import { CODE_DEMAND_GENRES, CODE_LANGUAGES } from "./code-demand-genre-ssot.mjs";
import { TEXT_DEMAND_GENRES } from "./text-demand-genre-ssot.mjs";
import { PRESENTATION_DEMAND_PURPOSES } from "./presentation-demand-genre-ssot.mjs";
import {
  codeDriveFolderName,
  textDriveFolderName,
  webDriveFolderName,
} from "./genre-restructure-web-code-text-v1.mjs";
import { SIDE_CAT_GENRE_CATALOGS } from "../materials-list-genre-filter-contract.mjs";

export const CATEGORY_GENRE_STORAGE_SSOT_VERSION = "materials-category-genre-storage-alignment-v1";

/** Synonym folders already on Drive. First existing candidate is REUSE. Do not CREATE a second name. */
export const STORAGE_SYNONYMS = Object.freeze({
  template: Object.freeze({
    メニュー・料金表: Object.freeze(["メニュー表", "メニュー・料金表"]),
    "報告書・レポート": Object.freeze(["報告書", "報告書・レポート"]),
    "請求書・経理": Object.freeze(["請求書", "請求書・経理"]),
  }),
  presentation: Object.freeze({
    salesproposal: Object.freeze(["営業資料", "営業・提案資料"]),
    pitchdeck: Object.freeze(["ピッチ", "ピッチデッキ", "ピッチデック"]),
    companyprofile: Object.freeze(["会社紹介"]),
  }),
  sfx: Object.freeze({
    impact: Object.freeze(["impact", "Impact"]),
    transition: Object.freeze(["transition", "Transition"]),
  }),
  icon: Object.freeze({
    ui: Object.freeze(["ui", "UI"]),
    social: Object.freeze(["social", "SNS"]),
    business: Object.freeze(["business", "ビジネス"]),
    medical: Object.freeze(["medical", "医療"]),
    education: Object.freeze(["education", "教育"]),
    sports: Object.freeze(["sports", "スポーツ"]),
    travel: Object.freeze(["travel", "旅行"]),
    transport: Object.freeze(["transport", "乗り物"]),
    food: Object.freeze(["food", "食べ物"]),
    seasonal: Object.freeze(["seasonal", "季節"]),
    audio: Object.freeze(["audio", "音楽"]),
    housing: Object.freeze(["housing", "建設"]),
    aidata: Object.freeze(["aidata", "AI"]),
    device: Object.freeze(["device", "テクノロジー"]),
  }),
  illustration: Object.freeze({
    business: Object.freeze(["business", "ビジネス"]),
    healthcare: Object.freeze(["healthcare", "医療"]),
    education: Object.freeze(["education", "教育"]),
    sports: Object.freeze(["sports", "スポーツ"]),
    travel: Object.freeze(["travel", "旅行"]),
    finance: Object.freeze(["finance", "金融"]),
    technology: Object.freeze(["technology", "テクノロジー"]),
    food: Object.freeze(["food", "食べ物"]),
    animal: Object.freeze(["animal", "動物"]),
    seasonal: Object.freeze(["seasonal", "季節"]),
    nature: Object.freeze(["nature", "自然"]),
    disaster: Object.freeze(["disaster", "防災"]),
    beauty: Object.freeze(["beauty", "ファッション"]),
    transport: Object.freeze(["transport", "乗り物"]),
    housing: Object.freeze(["housing", "建設"]),
  }),
  background: Object.freeze({
    gradient: Object.freeze(["gradient", "グラデーション"]),
    texture: Object.freeze(["texture", "テクスチャ"]),
    pattern: Object.freeze(["pattern", "パターン"]),
    business: Object.freeze(["business", "ビジネス"]),
    nature: Object.freeze(["nature", "自然"]),
    seasonal: Object.freeze(["seasonal", "季節"]),
    luxury: Object.freeze(["luxury", "高級（Luxury）"]),
    space: Object.freeze(["space", "宇宙"]),
    frame: Object.freeze(["frame", "フレーム"]),
    minimal: Object.freeze(["minimal", "シンプル"]),
  }),
  web: Object.freeze({
    hero: Object.freeze(["Hero", "hero"]),
    pricing: Object.freeze(["Pricing", "pricing"]),
    faq: Object.freeze(["FAQ", "faq"]),
    dashboard: Object.freeze(["Dashboard", "dashboard"]),
    login: Object.freeze(["ログイン・登録", "login"]),
  }),
});

export const TEMPLATE_UI_STORAGE = Object.freeze(
  (SIDE_CAT_GENRE_CATALOGS.template || []).map((row) =>
    Object.freeze({
      id: row.id,
      label_ja: row.label || row.id,
      preferred: row.id,
    }),
  ),
);

export function getDriveRoots() {
  const cfg = loadIngestConfig();
  return {
    image: cfg.driveRoots.image,
    illustration: cfg.driveRoots.image,
    background: cfg.driveRoots.image,
    icon: cfg.driveRoots.icon,
    sfx: cfg.driveRoots.sfx,
    bgm: cfg.driveRoots.bgm,
    template: cfg.driveRoots.template,
    presentation: cfg.driveRoots.presentation,
    web: cfg.driveRoots["web-material"],
    code: cfg.driveRoots["code-material"],
    document: cfg.driveRoots.document,
  };
}

function row(categoryId, categoryLabel, genreId, genreLabel, parentRel, preferredName, extra = {}) {
  return {
    category_id: categoryId,
    category_label: categoryLabel,
    genre_id: genreId,
    genre_label: genreLabel,
    parent_rel: parentRel,
    preferred_name: preferredName,
    candidates: extra.candidates || [preferredName],
    languages: extra.languages || null,
  };
}

export function expectedStorageSpecs() {
  const out = [];
  for (const g of IMAGE_DEMAND_GENRES) {
    out.push(row("image", "画像", g.id, g.label_ja, "", g.id, { candidates: [g.id] }));
  }
  for (const g of ILLUSTRATION_DEMAND_GENRES) {
    const syn = STORAGE_SYNONYMS.illustration[g.id] || [g.id];
    out.push(row("illustration", "イラスト", g.id, g.label_ja, "イラスト", g.id, { candidates: syn }));
  }
  for (const g of BACKGROUND_DEMAND_GENRES) {
    const syn = STORAGE_SYNONYMS.background[g.id] || [g.id];
    out.push(row("background", "背景", g.id, g.label_ja, "背景", g.id, { candidates: syn }));
  }
  for (const g of ICON_DEMAND_GENRES) {
    const syn = STORAGE_SYNONYMS.icon[g.id] || [g.id];
    out.push(row("icon", "アイコン", g.id, g.label_ja, "", g.id, { candidates: syn }));
  }
  for (const g of SFX_DEMAND_GENRES) {
    const syn = STORAGE_SYNONYMS.sfx[g.id] || [g.id];
    out.push(row("sfx", "効果音・SFX", g.id, g.label_ja, "", g.id, { candidates: syn }));
  }
  for (const g of BGM_DEMAND_GENRES) {
    const leaf = g.drive_folder.replace(/^_private-inventory\//, "");
    out.push(
      row("bgm", "BGM", g.id, g.label_ja, "_private-inventory", leaf, {
        candidates: [leaf],
      }),
    );
  }
  for (const g of WEB_DEMAND_GENRES) {
    const preferred = webDriveFolderName(g.id);
    const syn = STORAGE_SYNONYMS.web[g.id] || [preferred];
    out.push(row("web", "Web素材", g.id, g.label_ja, "", preferred, { candidates: syn }));
  }
  const langs = Object.values(CODE_LANGUAGES).map((l) => l.label);
  for (const g of CODE_DEMAND_GENRES) {
    const preferred = codeDriveFolderName(g.id);
    out.push(
      row("code", "コード", g.id, g.label_ja, "", preferred, {
        candidates: [preferred],
        languages: langs,
      }),
    );
  }
  for (const g of TEXT_DEMAND_GENRES) {
    const preferred = textDriveFolderName(g.id);
    out.push(row("document", "文例・文章テンプレート", g.id, g.label_ja, "", preferred, { candidates: [preferred] }));
  }
  for (const g of TEMPLATE_UI_STORAGE) {
    const syn = STORAGE_SYNONYMS.template[g.id] || [g.preferred];
    out.push(row("template", "テンプレート", g.id, g.label_ja, "", g.preferred, { candidates: syn }));
  }
  for (const g of PRESENTATION_DEMAND_PURPOSES) {
    const syn = STORAGE_SYNONYMS.presentation[g.id] || [g.label_ja];
    out.push(row("presentation", "プレゼン", g.id, g.label_ja, "", g.label_ja, { candidates: syn }));
  }
  return out;
}

export const EXPECTED_GENRE_COUNTS = Object.freeze({
  web: 45,
  code: 19,
  document: 23,
  template: 14,
  bgm: 16,
});

/** Exact locked labels for this ACTIVE_TASK. Order is SSOT order. */
export const EXPECTED_GENRE_LABELS = Object.freeze({
  web: Object.freeze([
    "ヒーロー",
    "ヘッダー・ナビ",
    "フッター",
    "CTAセクション",
    "特徴・機能紹介",
    "メリット・価値訴求",
    "会社・紹介",
    "サービス紹介",
    "商品・プロダクト紹介",
    "料金",
    "口コミ・実績",
    "事例・実績",
    "FAQ",
    "お問い合わせ",
    "リード獲得",
    "ブログ・記事",
    "ギャラリー・作品",
    "ログイン・登録",
    "動画・メディア",
    "資料・ダウンロード",
    "カート・購入",
    "セール・キャンペーン",
    "プラン・サブスク",
    "ダッシュボード",
    "テーブル・一覧",
    "フォーム",
    "カード・パネル",
    "モーダル・ダイアログ",
    "サイドバー",
    "タブ・アコーディオン",
    "検索・フィルター",
    "通知・アラート",
    "状態画面",
    "グラフ・チャート",
    "企業サイト",
    "SaaS・ソフトウェア",
    "EC・小売",
    "採用",
    "飲食",
    "美容・サロン",
    "医療・健康",
    "教育",
    "不動産・建築",
    "クリエイター",
    "イベント・LP",
  ]),
  code: Object.freeze([
    "Starter・Boilerplate",
    "UIコンポーネント",
    "フォーム・入力検証",
    "API・外部連携",
    "認証・ユーザー管理",
    "DB・CRUD",
    "ファイル・メディア",
    "データ処理・変換",
    "検索・フィルター",
    "自動化・ジョブ",
    "メール・通知",
    "日時・予約・スケジュール",
    "AI・LLM",
    "RAG・検索AI",
    "テスト・QA",
    "ログ・監視・エラー処理",
    "セキュリティ",
    "決済・EC",
    "帳票・レポート",
  ]),
  document: Object.freeze([
    "ビジネスメール",
    "営業・セールス",
    "カスタマーサポート",
    "社内文書・社内連絡",
    "お知らせ・告知",
    "広告・マーケティング",
    "SNS投稿",
    "Web・LP文章",
    "EC・商品説明",
    "求人・採用",
    "ブログ・記事",
    "プロフィール・自己紹介",
    "プレスリリース",
    "招待・案内",
    "お礼",
    "お詫び",
    "お願い・依頼",
    "季節の挨拶",
    "会議・議事録",
    "報告・レポート",
    "企画・提案",
    "FAQ・ヘルプ",
    "アンケート・レビュー",
  ]),
  template: Object.freeze([
    "名刺",
    "POP",
    "チラシ",
    "メニュー・料金表",
    "ショップカード",
    "提案書・企画書",
    "会社紹介・IR",
    "ピッチデッキ",
    "セミナー・講演",
    "事業計画・戦略",
    "マーケティング",
    "報告書・レポート",
    "教育・研修",
    "請求書・経理",
  ]),
  bgm: Object.freeze([
    "明るい・ポップ",
    "おしゃれ・カフェ",
    "爽やか・前向き",
    "落ち着く・リラックス",
    "感動・エモーショナル",
    "楽しい・コミカル",
    "かわいい",
    "かっこいい・スタイリッシュ",
    "シネマティック・壮大",
    "緊張・サスペンス",
    "ホラー・不気味",
    "和風",
    "ゲーム",
    "企業・ビジネス",
    "配信・YouTube",
    "ショート動画・SNS",
  ]),
});
