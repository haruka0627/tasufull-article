/**
 * TASFUL Materials — Video-first primary category list configuration (V1).
 * SSOT for taxonomy remains materials-data.js (chips / primary ids). This file only drives shell + behavior diffs.
 */
(function (global) {
  "use strict";

  const data = () => global.TasuMaterialsData || {};

  function chipLabel(id) {
    const chips = data().LIST_CATEGORY_CHIPS || [];
    const hit = chips.find((c) => c.id === id);
    if (hit && hit.label) return hit.label;
    const ui = data().LIST_UI_LABELS || {};
    if (ui[id]) return ui[id];
    const cat = data().categoryById ? data().categoryById(id) : null;
    return (cat && cat.name) || id;
  }

  /** @typedef {'image'|'svg_icon'|'audio'|'motion'} CardVariant */
  /** @typedef {'image'|'illustration'|'background'|'icon'|'audio_bgm'|'audio_sfx'|'motion'} FilterProfile */

  const CATEGORY_CONFIG = Object.freeze({
    bgm: Object.freeze({
      id: "bgm",
      categoryId: "bgm",
      displayLabel: () => chipLabel("bgm"),
      title: "BGM素材一覧",
      lead: "動画・配信向けのBGMを用途やムードから探せます",
      searchPlaceholder: "キーワードで検索（例：ピアノ、企業、カフェ、Vlog）",
      cardVariant: "audio",
      filterProfile: "audio_bgm",
      listGlobal: "TasuMaterialsBgmList",
      emptyFilter: "該当するBGMがありません。",
      promo: Object.freeze({
        title: "BGMを無料でダウンロード",
        body: "商用利用OKのBGM素材。会員登録でお気に入り保存が便利に。",
      }),
    }),
    sfx: Object.freeze({
      id: "sfx",
      categoryId: "sfx",
      displayLabel: () => chipLabel("sfx"),
      title: "効果音・SE素材一覧",
      lead: "動画編集に使える効果音をジャンル・用途から探せます",
      searchPlaceholder: "キーワードで検索（例：通知、拍手、インパクト）",
      cardVariant: "audio",
      filterProfile: "audio_sfx",
      listGlobal: "TasuMaterialsSfxList",
      emptyFilter: "該当する効果音がありません。",
      promo: Object.freeze({
        title: "効果音を無料でダウンロード",
        body: "商用利用OKのSE素材。プレビュー再生で確認できます。",
      }),
    }),
    image: Object.freeze({
      id: "image",
      categoryId: "image",
      displayLabel: () => chipLabel("image"),
      title: "画像素材一覧",
      lead: "商用利用OKの高品質な画像素材を探せます",
      searchPlaceholder: "キーワードで検索（例：ビジネス、自然、人物、食べ物）",
      cardVariant: "image",
      filterProfile: "image",
      listGlobal: "TasuMaterialsImageList",
      emptyFilter: "該当する画像素材がありません。",
      promo: Object.freeze({
        title: "高品質な画像素材を無料でダウンロード",
        body: "商用利用OK・クレジット表記不要の画像素材を無料でダウンロードできます。",
      }),
    }),
    illustration: Object.freeze({
      id: "illustration",
      categoryId: "illustration",
      displayLabel: () => chipLabel("illustration"),
      title: "イラスト素材一覧",
      lead: "商用利用OKのイラスト・カット素材を探せます",
      searchPlaceholder: "キーワードで検索（例：ビジネス、人物、フラット）",
      cardVariant: "image",
      filterProfile: "illustration",
      listGlobal: "TasuMaterialsIllustrationList",
      emptyFilter: "該当するイラスト素材がありません。",
      promo: Object.freeze({
        title: "イラスト素材を無料でダウンロード",
        body: "透過PNGなど、編集に使いやすいイラストを無料配布しています。",
      }),
    }),
    background: Object.freeze({
      id: "background",
      categoryId: "background",
      displayLabel: () => chipLabel("background"),
      title: "背景素材一覧",
      lead: "動画・スライド向けの背景画像を探せます",
      searchPlaceholder: "キーワードで検索（例：グラデーション、オフィス、抽象）",
      cardVariant: "image",
      filterProfile: "background",
      listGlobal: "TasuMaterialsBackgroundList",
      emptyFilter: "該当する背景素材がありません。",
      promo: Object.freeze({
        title: "背景素材を無料でダウンロード",
        body: "プレゼン・動画の背景に使える高品質素材を無料で。",
      }),
    }),
    icon: Object.freeze({
      id: "icon",
      categoryId: "icon",
      displayLabel: () => chipLabel("icon"),
      title: "アイコン素材一覧",
      lead: "UI・SNS向けのアイコン素材を探せます",
      searchPlaceholder: "キーワードで検索（例：矢印、SNS、ビジネス）",
      cardVariant: "svg_icon",
      filterProfile: "icon",
      listGlobal: "TasuMaterialsIconList",
      emptyFilter: "該当するアイコン素材がありません。",
      promo: Object.freeze({
        title: "アイコン素材を無料でダウンロード",
        body: "SVG/PNGアイコンを用途別に探せます。",
      }),
    }),
    overlay: Object.freeze({
      id: "overlay",
      categoryId: "overlay",
      displayLabel: () => chipLabel("overlay"),
      title: "オーバーレイ素材一覧",
      lead: "動画に重ねるオーバーレイ・エフェクト素材（準備中の公開枠）",
      searchPlaceholder: "キーワードで検索",
      cardVariant: "motion",
      filterProfile: "motion",
      listGlobal: null,
      emptyFilter: "該当するオーバーレイ素材がありません。",
      promo: Object.freeze({
        title: "オーバーレイ素材",
        body: "公開準備が整い次第、こちらからダウンロードできます。",
      }),
    }),
    frame: Object.freeze({
      id: "frame",
      categoryId: "frame",
      displayLabel: () => chipLabel("frame"),
      title: "フレーム・装飾素材一覧",
      lead: "動画・画像の枠・装飾素材（準備中の公開枠）",
      searchPlaceholder: "キーワードで検索",
      cardVariant: "motion",
      filterProfile: "motion",
      listGlobal: null,
      emptyFilter: "該当するフレーム・装飾素材がありません。",
      promo: Object.freeze({
        title: "フレーム・装飾素材",
        body: "公開準備が整い次第、こちらからダウンロードできます。",
      }),
    }),
    telop: Object.freeze({
      id: "telop",
      categoryId: "telop",
      displayLabel: () => chipLabel("telop"),
      title: "テロップ素材一覧",
      lead: "動画字幕・テロップ用素材（準備中の公開枠）",
      searchPlaceholder: "キーワードで検索",
      cardVariant: "motion",
      filterProfile: "motion",
      listGlobal: null,
      emptyFilter: "該当するテロップ素材がありません。",
      promo: Object.freeze({
        title: "テロップ素材",
        body: "公開準備が整い次第、こちらからダウンロードできます。",
      }),
    }),
    transition: Object.freeze({
      id: "transition",
      categoryId: "transition",
      displayLabel: () => chipLabel("transition"),
      title: "トランジション素材一覧",
      lead: "動画切り替え用トランジション素材（準備中の公開枠）",
      searchPlaceholder: "キーワードで検索",
      cardVariant: "motion",
      filterProfile: "motion",
      listGlobal: null,
      emptyFilter: "該当するトランジション素材がありません。",
      promo: Object.freeze({
        title: "トランジション素材",
        body: "公開準備が整い次第、こちらからダウンロードできます。",
      }),
    }),
  });

  function getVfCategoryConfig(queryId) {
    const id = String(queryId || "").trim();
    return CATEGORY_CONFIG[id] || null;
  }

  function listDelegateModule(config) {
    if (!config || !config.listGlobal) return null;
    return global[config.listGlobal] || null;
  }

  function primaryCategoryIds() {
    const ids = data().LIST_PRIMARY_CATEGORY_IDS;
    return Array.isArray(ids) ? ids : Object.keys(CATEGORY_CONFIG);
  }

  global.TasuMaterialsVfCategoryConfig = {
    CATEGORY_CONFIG,
    getVfCategoryConfig,
    listDelegateModule,
    primaryCategoryIds,
  };
})(typeof window !== "undefined" ? window : globalThis);
