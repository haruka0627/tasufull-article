/**
 * TASFUL Materials — public catalog is build-time index; dummy ITEMS are qa_fixture only.
 *
 * 【設計メモ — 生成AI素材の無料配布について】
 * 無料ダウンロード素材として公開する前に、使用した生成AIサービスの利用規約を必ず確認すること。
 * 商用利用可能でも、素材配布・再配布・無料ダウンロード提供が禁止されている場合がある。
 */
(function (global) {
  "use strict";

  /** @typedef {object} MaterialsCategory */
  /** @typedef {object} MaterialsItem */

  /** 無料ダウンロード正式カテゴリ（data 順。TOP カードはこれ。チップ順とは独立） */
  const CATEGORIES = Object.freeze([
    { id: "sfx", code: "sfx", name: "効果音 / SFX", icon: "sfx", color: "#dc2626" },
    { id: "bgm", code: "bgm", name: "BGM", icon: "bgm", color: "#9333ea" },
    { id: "image", code: "image", name: "画像素材", icon: "image", color: "#059669" },
    { id: "illustration", code: "illustration", name: "イラスト素材", icon: "illustration", color: "#db2777" },
    { id: "background", code: "background", name: "背景素材", icon: "background", color: "#0284c7" },
    { id: "web", code: "web", name: "Web素材", icon: "web", color: "#4f46e5" },
    { id: "code", code: "code", name: "コードスニペット", icon: "code", color: "#0d9488" },
    { id: "template", code: "template", name: "テンプレート", icon: "template", color: "#7c3aed" },
    { id: "icon", code: "icon", name: "アイコン", icon: "icon", color: "#2563eb" },
    { id: "presentation", code: "presentation", name: "プレゼン資料", icon: "presentation", color: "#ea580c" },
    { id: "document", code: "document", name: "文書テンプレート", icon: "document", color: "#0891b2" },
    { id: "tool", code: "tool", name: "ツール", icon: "tool", color: "#16a34a" },
    { id: "overlay", code: "overlay", name: "オーバーレイ", icon: "overlay", color: "#7c3aed" },
    { id: "frame", code: "frame", name: "フレーム・装飾", icon: "frame", color: "#c026d3" },
    { id: "telop", code: "telop", name: "テロップ素材", icon: "telop", color: "#ea580c" },
    { id: "transition", code: "transition", name: "トランジション", icon: "transition", color: "#0d9488" },
  ]);

  /**
   * Video-first primary chips (list.html). Hide legacy from primary; keep URL-valid.
   * image → 表示「写真」はラベルマップのみ。category_id は image のまま（混在在庫を再分類しない）。
   */
  const LIST_PRIMARY_CATEGORY_IDS = Object.freeze([
    "bgm",
    "sfx",
    "image",
    "illustration",
    "background",
    "icon",
    "overlay",
    "frame",
    "telop",
    "transition",
  ]);

  const LIST_LEGACY_CATEGORY_IDS = Object.freeze([
    "template",
    "web",
    "code",
    "document",
    "tool",
    "presentation",
  ]);

  const VIDEO_FIRST_EMPTY_CATEGORY_IDS = Object.freeze([
    "overlay",
    "frame",
    "telop",
    "transition",
  ]);

  const LIST_PRIMARY_QUERY_IDS = LIST_PRIMARY_CATEGORY_IDS;
  const LIST_LEGACY_QUERY_IDS = Object.freeze(
    LIST_LEGACY_CATEGORY_IDS.map((id) => (id === "document" ? "text" : id))
  );
  const LIST_VALID_QUERY_IDS = Object.freeze([...LIST_PRIMARY_QUERY_IDS, ...LIST_LEGACY_QUERY_IDS]);

  /**
   * Chip / sidebar / footer 公開表示名。CATEGORIES.name は変更しない。
   * image は混在在庫のため「写真」ラベルのみ（一括再分類しない）。
   */
  const LIST_UI_LABELS = Object.freeze({
    image: "写真",
  });

  /**
   * Materials 一覧 上部カテゴリチップ（表示順正本）。
   * CATEGORIES の data 順・TOP カード順とは独立。query id は list.html contract（document → text）。
   * Active は見た目のみ。選択中カテゴリを先頭へ移動しない。
   */
  const LIST_PAGE_SIZE = 12;

  const LIST_CATEGORY_CHIPS = Object.freeze([
    { id: "", label: "すべて" },
    { id: "bgm", label: "BGM" },
    { id: "sfx", label: "効果音/SFX" },
    { id: "image", label: LIST_UI_LABELS.image },
    { id: "illustration", label: "イラスト" },
    { id: "background", label: "背景" },
    { id: "icon", label: "アイコン" },
    { id: "overlay", label: "オーバーレイ" },
    { id: "frame", label: "フレーム・装飾" },
    { id: "telop", label: "テロップ素材" },
    { id: "transition", label: "トランジション" },
  ]);

  /**
   * Materials 一覧 左Sidebar カテゴリ Navigation（表示順・ラベル正本）。
   * Video-first primary のみ。legacy はチップ非表示・URL は有効のまま。
   * LIST_CATEGORY_CHIPS と同じ primary 順。各ページへ複製しない。
   */
  const LIST_SIDEBAR_LABELS = Object.freeze({
    sfx: "効果音/SFX",
    bgm: "BGM",
    image: LIST_UI_LABELS.image,
    illustration: "イラスト",
    background: "背景",
    icon: "アイコン",
    overlay: "オーバーレイ",
    frame: "フレーム・装飾",
    telop: "テロップ素材",
    transition: "トランジション",
    web: "Web素材",
    code: "コード",
    template: "テンプレート",
    presentation: "プレゼン",
    document: "文例・文章テンプレート",
    tool: "ツール",
  });

  const LIST_SIDEBAR_CATEGORIES = Object.freeze(
    LIST_PRIMARY_CATEGORY_IDS.map((id) => {
      const cat = CATEGORIES.find((c) => c.id === id) || { id, icon: id, name: id };
      return Object.freeze({
        id: cat.id,
        queryId: cat.id === "document" ? "text" : cat.id,
        label: LIST_SIDEBAR_LABELS[cat.id] || LIST_UI_LABELS[cat.id] || cat.name,
        icon: cat.icon,
      });
    })
  );

  const POPULAR_KEYWORDS = Object.freeze([
    "名刺",
    "効果音",
    "BGM",
    "チラシ",
    "プレゼン",
    "アイコン",
    "ハンバーガーメニュー",
  ]);

  /** QA fixture only (`?qa_fixture=1`). Never the public catalog. */
  const ITEMS = [
    {
      id: "mat-001",
      slug: "business-card-simple",
      title: "名刺テンプレート（シンプル）",
      category_id: "template",
      description: "ビジネスで使えるシンプルな名刺テンプレートです。",
      tags: ["名刺", "ビジネス", "シンプル"],
      file_formats: ["PDF", "AI"],
      download_count: 0,
      rating: 4.8,
      rating_count: 312,
      updated_at: "2026-05-28T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "template-card",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-002",
      slug: "sns-icon-set",
      title: "SNSアイコンセット",
      category_id: "icon",
      description: "SNS用の丸型アイコン素材セットです。",
      tags: ["SNS", "アイコン", "丸型"],
      file_formats: ["PNG", "SVG", "ZIP"],
      download_count: 0,
      rating: 4.6,
      rating_count: 198,
      updated_at: "2026-05-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "icon-grid",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-003",
      slug: "flyer-a4",
      title: "チラシテンプレート A4",
      category_id: "template",
      description: "店舗・イベント向けのA4チラシテンプレートです。",
      tags: ["チラシ", "A4", "店舗"],
      file_formats: ["PDF", "AI"],
      download_count: 0,
      rating: 4.7,
      rating_count: 156,
      updated_at: "2026-05-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "flyer",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-004",
      slug: "presentation-business",
      title: "プレゼン資料テンプレート",
      category_id: "presentation",
      description: "ビジネス向けのプレゼン資料テンプレートです。",
      tags: ["プレゼン", "ビジネス", "PPT"],
      file_formats: ["PPTX", "PDF"],
      download_count: 0,
      rating: 4.5,
      rating_count: 142,
      updated_at: "2026-05-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "presentation",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-005",
      slug: "logo-maker-tool",
      title: "ロゴ作成ツール",
      category_id: "tool",
      description: "ブラウザ上で簡単にロゴを作成できるツールです。",
      tags: ["ロゴ", "ツール", "ブラウザ"],
      file_formats: ["Web"],
      download_count: 0,
      rating: 4.4,
      rating_count: 98,
      updated_at: "2026-05-18T00:00:00.000Z",
      is_free: true,
      is_ad_supported: false,
      thumbnail_style: "tool-logo",
      button_label: "無料で使う",
      popularity_rank: 9999,
    },
    {
      id: "mat-006",
      slug: "resume-modern",
      title: "履歴書テンプレート（モダン）",
      category_id: "document",
      description: "転職・就活向けのモダンな履歴書テンプレートです。",
      tags: ["履歴書", "就活", "転職"],
      file_formats: ["DOCX", "PDF"],
      download_count: 0,
      rating: 4.9,
      rating_count: 87,
      updated_at: "2026-06-01T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "document-resume",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-007",
      slug: "wallpaper-minimal",
      title: "ミニマル壁紙セット",
      category_id: "image",
      description: "デスクトップ・スマホ向けのミニマル壁紙素材です。",
      tags: ["壁紙", "ミニマル", "背景"],
      file_formats: ["JPG", "PNG"],
      download_count: 0,
      rating: 4.3,
      rating_count: 64,
      updated_at: "2026-06-02T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "photo-wall",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-008",
      slug: "invoice-template",
      title: "請求書テンプレート",
      category_id: "document",
      description: "フリーランス・小規模事業者向けの請求書テンプレートです。",
      tags: ["請求書", "ビジネス", "Excel"],
      file_formats: ["XLSX", "PDF"],
      download_count: 0,
      rating: 4.6,
      rating_count: 55,
      updated_at: "2026-06-03T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "document-invoice",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-009",
      slug: "banner-web",
      title: "Webバナーテンプレート",
      category_id: "template",
      description: "LP・広告向けのWebバナーテンプレートです。",
      tags: ["バナー", "Web", "広告"],
      file_formats: ["PSD", "PNG"],
      download_count: 0,
      rating: 4.2,
      rating_count: 41,
      updated_at: "2026-06-04T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "template-banner",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-010",
      slug: "color-palette-tool",
      title: "配色パレット生成ツール",
      category_id: "tool",
      description: "デザインに使える配色パレットを生成するツールです。",
      tags: ["配色", "デザイン", "ツール"],
      file_formats: ["Web"],
      download_count: 0,
      rating: 4.5,
      rating_count: 38,
      updated_at: "2026-06-05T00:00:00.000Z",
      is_free: true,
      is_ad_supported: false,
      thumbnail_style: "tool-palette",
      button_label: "無料で使う",
      popularity_rank: 9999,
    },
    {
      id: "mat-011",
      slug: "sfx-telop-pop",
      title: "テロップがピコッと出る音",
      category_id: "sfx",
      description: "テロップ表示に使える短いポップ音です。",
      tags: ["効果音", "テロップ", "SFX"],
      file_formats: ["WAV", "MP3"],
      download_count: 0,
      rating: 4.7,
      rating_count: 210,
      updated_at: "2026-06-28T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-sfx",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-012",
      slug: "sfx-flip-whoosh",
      title: "フリップや解説図がシュッと出る音",
      category_id: "sfx",
      description: "フリップ演出や解説図の出現に使えるスワイプ音です。",
      tags: ["効果音", "フリップ", "解説"],
      file_formats: ["WAV", "MP3"],
      download_count: 0,
      rating: 4.6,
      rating_count: 165,
      updated_at: "2026-06-27T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-sfx",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-013",
      slug: "sfx-transition-wind",
      title: "トランジション風切り音",
      category_id: "sfx",
      description: "シーン切り替えやトランジション向けの風切り効果音です。",
      tags: ["効果音", "トランジション", "風切り"],
      file_formats: ["WAV", "MP3"],
      download_count: 0,
      rating: 4.5,
      rating_count: 120,
      updated_at: "2026-06-26T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-sfx",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-014",
      slug: "sfx-quiz-correct",
      title: "クイズ正解音",
      category_id: "sfx",
      description: "クイズやゲームの正解演出に使える効果音です。",
      tags: ["効果音", "クイズ", "正解"],
      file_formats: ["WAV", "MP3"],
      download_count: 0,
      rating: 4.8,
      rating_count: 98,
      updated_at: "2026-06-29T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-sfx",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-015",
      slug: "sfx-slip-fail",
      title: "ズッコケ効果音",
      category_id: "sfx",
      description: "コメディ演出や失敗シーン向けのズッコケ効果音です。",
      tags: ["効果音", "コメディ", "失敗"],
      file_formats: ["WAV", "MP3"],
      download_count: 0,
      rating: 4.4,
      rating_count: 76,
      updated_at: "2026-06-30T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-sfx",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-016",
      slug: "bgm-vlog-lofi",
      title: "Vlog用ローファイBGM",
      category_id: "bgm",
      description: "Vlogや日常動画向けの落ち着いたローファイBGMです。",
      tags: ["BGM", "Vlog", "ローファイ"],
      file_formats: ["MP3", "WAV"],
      download_count: 0,
      rating: 4.7,
      rating_count: 188,
      updated_at: "2026-06-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-bgm",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-017",
      slug: "bgm-tech",
      title: "テック系BGM",
      category_id: "bgm",
      description: "IT解説やプロダクト紹介向けのテック系BGMです。",
      tags: ["BGM", "テック", "解説"],
      file_formats: ["MP3", "WAV"],
      download_count: 0,
      rating: 4.6,
      rating_count: 142,
      updated_at: "2026-06-24T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-bgm",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-018",
      slug: "bgm-daily-warm",
      title: "ほのぼの日常系BGM",
      category_id: "bgm",
      description: "日常系コンテンツや紹介動画に使えるほのぼのBGMです。",
      tags: ["BGM", "日常", "ほのぼの"],
      file_formats: ["MP3", "WAV"],
      download_count: 0,
      rating: 4.5,
      rating_count: 115,
      updated_at: "2026-06-23T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "audio-bgm",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-019",
      slug: "image-cute-cat-3d",
      title: "3D風の可愛い猫",
      category_id: "image",
      description: "3D風レンダリングの可愛い猫画像素材です。",
      tags: ["画像", "猫", "3D風"],
      file_formats: ["PNG", "JPG"],
      download_count: 0,
      rating: 4.8,
      rating_count: 92,
      updated_at: "2026-06-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "image-cat",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-020",
      slug: "illustration-office-worker",
      title: "パソコンを使う会社員イラスト",
      category_id: "illustration",
      description: "ビジネス記事や資料向けの会社員イラスト素材です。",
      tags: ["イラスト", "ビジネス", "会社員"],
      file_formats: ["PNG", "JPG"],
      download_count: 0,
      rating: 4.6,
      rating_count: 84,
      updated_at: "2026-06-21T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "illustration-office",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-021",
      slug: "background-cyberpunk-room",
      title: "サイバーパンク部屋背景",
      category_id: "background",
      description: "ゲームやSF系コンテンツ向けのサイバーパンク部屋背景です。",
      tags: ["背景", "サイバーパンク", "部屋"],
      file_formats: ["JPG", "PNG"],
      download_count: 0,
      rating: 4.7,
      rating_count: 71,
      updated_at: "2026-06-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "background-cyber",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-022",
      slug: "background-cafe",
      title: "お洒落なカフェ背景",
      category_id: "background",
      description: "Webや動画の背景に使えるお洒落なカフェ写真素材です。",
      tags: ["背景", "カフェ", "写真"],
      file_formats: ["JPG", "PNG"],
      download_count: 0,
      rating: 4.5,
      rating_count: 63,
      updated_at: "2026-06-29T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "background-cafe",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-023",
      slug: "web-hamburger-menu",
      title: "ハンバーガーメニュー",
      category_id: "web",
      description: "レスポンシブ対応のハンバーガーメニューWeb素材です。",
      tags: ["Web", "メニュー", "レスポンシブ"],
      file_formats: ["HTML", "CSS", "JS"],
      download_count: 0,
      rating: 4.7,
      rating_count: 195,
      updated_at: "2026-06-28T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "web-hamburger",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-024",
      slug: "web-wp-sns-share",
      title: "WordPress用SNSシェアボタン",
      category_id: "web",
      description: "WordPress記事に設置できるSNSシェアボタン素材です。",
      tags: ["Web", "WordPress", "SNS"],
      file_formats: ["PHP", "HTML"],
      download_count: 0,
      rating: 4.6,
      rating_count: 128,
      updated_at: "2026-06-30T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "web-wp-share",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-025",
      slug: "code-typing-effect",
      title: "タイピング文字エフェクト",
      category_id: "code",
      description: "見出しやヒーローに使えるタイピング文字エフェクトのコードです。",
      tags: ["コード", "タイピング", "アニメーション"],
      file_formats: ["HTML", "CSS", "JS"],
      download_count: 0,
      rating: 4.8,
      rating_count: 151,
      updated_at: "2026-06-29T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "code-typing",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-026",
      slug: "illustration-simple-character",
      title: "シンプルキャラクターイラスト",
      category_id: "illustration",
      description: "SNSやLP向けのシンプルなキャラクターイラスト素材です。",
      tags: ["イラスト", "キャラクター", "SNS"],
      file_formats: ["PNG", "SVG", "AI"],
      download_count: 0,
      rating: 4.7,
      rating_count: 76,
      updated_at: "2026-06-28T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "illustration-office",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-027",
      slug: "background-gradient-soft",
      title: "ソフトグラデーション背景",
      category_id: "background",
      description: "Webやサムネイル向けのソフトなグラデーション背景素材です。",
      tags: ["背景", "グラデーション", "パステル"],
      file_formats: ["JPG", "PNG"],
      download_count: 0,
      rating: 4.6,
      rating_count: 68,
      updated_at: "2026-06-27T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "background-cyber",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-028",
      slug: "code-contact-form",
      title: "お問い合わせフォーム",
      category_id: "code",
      description: "名前・メール・本文入力に対応したお問い合わせフォームのコードスニペットです。",
      tags: ["コード", "フォーム", "HTML"],
      file_formats: ["HTML", "CSS", "JS"],
      download_count: 0,
      rating: 4.8,
      rating_count: 132,
      updated_at: "2026-06-26T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "code-typing",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-029",
      slug: "text-business-email",
      title: "ビジネスメール文例テンプレート",
      category_id: "document",
      description: "依頼・お礼・日程調整などに使えるビジネスメール文例テンプレートです。",
      tags: ["文書", "メール", "ビジネス"],
      file_formats: ["DOCX", "TXT"],
      download_count: 0,
      rating: 4.7,
      rating_count: 95,
      updated_at: "2026-06-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      thumbnail_style: "document-invoice",
      button_label: "無料ダウンロード",
      popularity_rank: 9999,
    },
    {
      id: "mat-030",
      slug: "tool-qr-generator",
      title: "QRコード生成ツール",
      category_id: "tool",
      description: "URLやテキストからQRコードをブラウザ上で生成できる無料ツールです。",
      tags: ["ツール", "QRコード", "Web"],
      file_formats: ["Web"],
      download_count: 0,
      rating: 4.5,
      rating_count: 118,
      updated_at: "2026-06-24T00:00:00.000Z",
      is_free: true,
      is_ad_supported: false,
      thumbnail_style: "tool-palette",
      button_label: "無料で使う",
      popularity_rank: 9999,
    },
  ];

  /** Existing TASFUL Account id fields — do not invent a Materials-only creator key. */
  const CREATOR_ID_FIELDS = Object.freeze([
    "creator_user_id",
    "seller_user_id",
    "sellerUserId",
    "owner_id",
    "user_id",
  ]);

  const NON_PUBLIC_VISIBILITY = Object.freeze([
    "private",
    "draft",
    "hidden",
    "deleted",
    "owner-only",
    "owner_only",
    "unpublished",
    "unlisted",
    "archived",
  ]);

  /**
   * QA fixture only: attach existing Marketplace demo seller ids to dummy ITEMS.
   * Does not mutate PUBLIC_INDEX and does not stamp owners onto platform auto-supply.
   */
  const QA_CREATOR_PUBLIC_IDS = Object.freeze({
    u_hiro: Object.freeze([
      "mat-001",
      "mat-002",
      "mat-003",
      "mat-004",
      "mat-006",
      "mat-007",
      "mat-009",
      "mat-011",
      "mat-016",
      "mat-019",
      "mat-020",
      "mat-021",
      "mat-023",
      "mat-025",
      "mat-026",
      "mat-030",
    ]),
  });

  function canonicalCreatorId(item) {
    if (!item || typeof item !== "object") return "";
    for (let i = 0; i < CREATOR_ID_FIELDS.length; i += 1) {
      const value = String(item[CREATOR_ID_FIELDS[i]] || "").trim();
      if (value) return value;
    }
    return "";
  }

  function isPublicMaterial(item) {
    if (!item || typeof item !== "object") return false;
    if (item.deleted === true || item.hidden === true || item.private === true) return false;
    if (item.publishable === false || item.published === false) return false;
    const vis = String(item.visibility || item.publish_status || item.status || "")
      .trim()
      .toLowerCase();
    if (vis && NON_PUBLIC_VISIBILITY.indexOf(vis) !== -1) return false;
    return true;
  }

  function creatorPageHref(creatorId) {
    const id = String(creatorId || "").trim();
    if (!id) return "";
    let href = `/materials/creator.html?id=${encodeURIComponent(id)}`;
    try {
      if (typeof global.location !== "undefined" &&
          new URLSearchParams(String(global.location.search || "")).get("qa_fixture") === "1") {
        href += "&qa_fixture=1";
      }
    } catch (_err) {
      /* ignore */
    }
    return href;
  }

  function qaNonPublicExtras(sample) {
    const base = sample && typeof sample === "object" ? sample : {};
    return [
      {
        ...base,
        id: "mat-qa-draft-hiro",
        slug: "qa-draft-hiro",
        title: "下書き名刺（非公開）",
        category_id: "template",
        description: "QA fixture draft — must not appear on the public Creator Page.",
        tags: ["QA", "draft"],
        creator_user_id: "u_hiro",
        visibility: "draft",
        publishable: false,
        published: false,
      },
      {
        ...base,
        id: "mat-qa-private-hiro",
        slug: "qa-private-hiro",
        title: "非公開チラシ",
        category_id: "template",
        description: "QA fixture private — must not appear on the public Creator Page.",
        tags: ["QA", "private"],
        creator_user_id: "u_hiro",
        visibility: "private",
        publishable: false,
        private: true,
      },
      {
        ...base,
        id: "mat-qa-draft-store",
        slug: "qa-draft-store",
        title: "店舗下書き",
        category_id: "template",
        description: "QA fixture — u_store has no public materials.",
        tags: ["QA", "draft"],
        creator_user_id: "u_store",
        visibility: "draft",
        publishable: false,
      },
    ];
  }

  function applyQaCreatorOverlay(items) {
    const sourceItems = items && items.length ? items : ITEMS;
    const ownerById = Object.create(null);
    const dummyIds = QA_CREATOR_PUBLIC_IDS.u_hiro || [];
    const looksDummy = sourceItems.some((item) => dummyIds.indexOf(item.id) !== -1);
    if (looksDummy) {
      Object.keys(QA_CREATOR_PUBLIC_IDS).forEach((uid) => {
        (QA_CREATOR_PUBLIC_IDS[uid] || []).forEach((id) => {
          ownerById[id] = uid;
        });
      });
    }
    const next = sourceItems.map((item) => {
      const uid = ownerById[item.id];
      if (!uid) return item;
      return {
        ...item,
        creator_user_id: uid,
        publishable: item.publishable !== false,
        visibility: item.visibility || "public",
      };
    });
    return next.concat(qaNonPublicExtras(sourceItems[0] || {}));
  }

  const RECOMMENDED_SERVICES = Object.freeze([
    {
      id: "tasful-ai",
      title: "TASFUL AI",
      description: "AIで簡単にWebサイトやコンテンツを作成",
      button_label: "今すぐ使ってみる",
      href: "/ai-workspace-home",
      variant: "dark",
      image_src: "images/service-tasful-ai-transparent.png",
      image_webp: "images/service-tasful-ai-transparent.webp",
      image_align: "center",
    },
    {
      id: "tasful-platform",
      title: "TASFUL Platform",
      description: "お店やサービスの魅力をもっと多くの人に届ける",
      button_label: "詳しくはこちら",
      href: "../index-top.html",
      variant: "light",
      image_src: "images/service-tasful-platform-transparent.png",
      image_webp: "images/service-tasful-platform-transparent.webp",
      image_align: "bottom-right",
    },
  ]);

  const FALLBACK_CATEGORY = Object.freeze({
    id: "unknown",
    code: "unknown",
    name: "その他",
    icon: "other",
    color: "#64748b",
  });

  function categoryById(id) {
    return CATEGORIES.find((c) => c.id === id) || FALLBACK_CATEGORY;
  }

  function normalizeItem(raw) {
    const cat = categoryById(raw.category_id);
    return {
      ...raw,
      category_name: cat.name,
      category_color: cat.color,
    };
  }

  function sortByPopularity(list) {
    return [...list].sort((a, b) => {
      const dc = (Number(b.download_count) || 0) - (Number(a.download_count) || 0);
      if (dc !== 0) return dc;
      const ta = new Date(a.updated_at || 0).getTime();
      const tb = new Date(b.updated_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

  function sortByNewest(list) {
    return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  const PREVIEW_TYPE_MAP = Object.freeze({
    sfx: "audio",
    bgm: "audio",
    image: "image",
    illustration: "image",
    background: "image",
    template: "image",
    icon: "icon-grid",
    presentation: "presentation",
    document: "document",
    web: "code",
    code: "code",
    tool: "tool",
  });

  const CATEGORY_META_DEFAULTS = Object.freeze({
    template: {
      meta_size: "91 × 55 mm",
      meta_pages: "1枚",
      file_size: "約 0.5 MB",
      environment: "PowerPoint 2016 以降 / Illustrator",
    },
    presentation: {
      meta_size: "16:9",
      meta_pages: "10枚",
      file_size: "約 2.1 MB",
      environment: "PowerPoint 2016 以降",
    },
    document: {
      meta_size: "A4",
      meta_pages: "1枚",
      meta_char_count: "約800文字",
      file_size: "約 0.3 MB",
      environment: "Word / Excel / PDFビューア",
      commercial_use: "個人・商用利用OK",
    },
    icon: {
      meta_size: "512 × 512 px",
      meta_pages: "48点",
      file_size: "約 1.2 MB",
      environment: "SVG / PNG 対応ソフト",
      commercial_use: "個人・商用利用OK",
    },
    bgm: {
      meta_duration: "2:30",
      meta_bpm: "90 BPM",
      meta_loop: "ループ可",
      meta_size: "—",
      meta_pages: "—",
      file_size: "約 4.2 MB",
      environment: "一般的なメディアプレイヤー / 動画編集ソフト",
    },
    sfx: {
      meta_duration: "0:02",
      meta_bpm: "—",
      meta_loop: "—",
      meta_size: "—",
      meta_pages: "—",
      file_size: "約 0.3 MB",
      environment: "動画編集ソフト / DAW",
    },
    image: {
      meta_resolution: "4000 × 3000 px",
      meta_size: "4:3",
      meta_pages: "—",
      file_size: "約 2.8 MB",
      environment: "画像編集ソフト",
    },
    illustration: {
      meta_resolution: "3000 × 2000 px",
      meta_size: "3:2",
      meta_points: "1点",
      meta_pages: "1点",
      meta_transparent: "あり（PNG）",
      meta_editable: "編集可（Illustrator / SVG）",
      meta_ai_generated: "一部AI支援",
      meta_author: "TASFUL Materials",
      file_size: "約 1.5 MB",
      environment: "Illustrator / PNG・SVG対応ソフト",
      commercial_use: "個人・商用利用OK",
    },
    background: {
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      meta_ratio: "16:9",
      meta_transparent: "なし",
      meta_ai_generated: "一部AI支援",
      meta_color: "—",
      file_size: "約 5.0 MB",
      environment: "画像編集ソフト / Web",
      commercial_use: "個人・商用利用OK",
    },
    web: {
      meta_size: "—",
      meta_pages: "3ファイル",
      meta_compatibility: "モダンブラウザ / Responsive",
      file_size: "約 0.1 MB",
      environment: "モダンブラウザ / WordPress",
    },
    code: {
      meta_size: "—",
      meta_pages: "3ファイル",
      meta_language: "HTML / CSS / JS",
      meta_compatibility: "モダンブラウザ",
      file_size: "約 0.05 MB",
      environment: "モダンブラウザ",
      commercial_use: "個人・商用利用OK",
    },
    tool: {
      meta_size: "—",
      meta_pages: "—",
      meta_tool_type: "Webアプリ",
      meta_usage_form: "ブラウザで無料利用",
      meta_compatibility: "モダンブラウザ",
      file_size: "—",
      environment: "モダンブラウザ",
      commercial_use: "個人・商用利用OK",
    },
  });

  const DEFAULT_RECOMMENDED = Object.freeze([
    "ビジネスシーンですぐ使いたい方",
    "シンプルで読みやすいデザインを探している方",
    "無料で高品質な素材を使いたい方",
  ]);

  const DEFAULT_ILLUSTRATION_USAGE_SCENARIOS = Object.freeze([
    "SNS",
    "ブログ",
    "YouTube",
    "プレゼン",
    "チラシ",
    "Web制作",
  ]);

  function buildIllustrationAiSuggestions(item) {
    const title = item.title || "イラスト";
    return [
      {
        label: "似たイラスト",
        prompt: `「${title}」に似たイラスト素材の案を3つ提案してください`,
      },
      {
        label: "背景素材",
        prompt: `「${title}」に合う背景素材の組み合わせを提案してください`,
      },
      {
        label: "色違い",
        prompt: `「${title}」の色違いバリエーション案を出してください`,
      },
      {
        label: "この画像を使ったデザイン作成",
        prompt: `「${title}」を使ったSNS投稿やチラシのデザイン案を作成してください`,
      },
    ];
  }

  function scoreRelatedItem(source, candidate) {
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sharedTags * 10000 + sameCategory * 1000 + popularity;
  }

  function fetchRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_BACKGROUND_USAGE_SCENARIOS = Object.freeze([
    "YouTube",
    "配信背景",
    "Zoom",
    "LP",
    "Webサイト",
    "ゲーム",
    "サムネイル",
  ]);

  function buildBackgroundAiSuggestions(item) {
    const title = item.title || "背景素材";
    return [
      { label: "似た背景", prompt: `「${title}」に似た背景素材を5つ提案してください` },
      { label: "色違い", prompt: `「${title}」の色違いバリエーション案を出してください` },
      { label: "昼夜バージョン", prompt: `「${title}」の昼版・夜版バリエーション案を提案してください` },
      {
        label: "この背景に合うイラスト",
        prompt: `「${title}」に合うイラスト素材の組み合わせを提案してください`,
      },
      {
        label: "同系統背景検索",
        prompt: `「${title}」と同系統の背景素材の探し方と候補を教えてください`,
      },
    ];
  }

  function scoreBackgroundRelatedItem(source, candidate) {
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const sourceColor = source.primary_color_key || DETAIL_OVERRIDES[source.slug]?.primary_color_key || "";
    const candidateColor =
      candidate.primary_color_key || DETAIL_OVERRIDES[candidate.slug]?.primary_color_key || "";
    const sameColor = sourceColor && candidateColor && sourceColor === candidateColor ? 1 : 0;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sharedTags * 10000 + sameCategory * 1000 + sameColor * 100 + popularity;
  }

  function fetchBackgroundRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreBackgroundRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_ICON_SIZES = Object.freeze([16, 20, 24, 32, 48, 64, 128, 256, 512]);

  const DEFAULT_ICON_STYLES = Object.freeze([
    "Outline",
    "Filled",
    "Rounded",
    "Flat",
    "Mono",
    "Color",
  ]);

  const DEFAULT_ICON_SOFTWARE = Object.freeze([
    "Illustrator",
    "Figma",
    "Photoshop",
    "Adobe XD",
    "Canva",
  ]);

  const DEFAULT_ICON_EXPORT_FORMATS = Object.freeze(["SVG", "PNG", "ZIP"]);

  const DEFAULT_ICON_FUTURE_FEATURES = Object.freeze([
    { id: "svg_copy", label: "SVGコードコピー", enabled: false },
    { id: "figma_copy", label: "Figmaコピー", enabled: false },
  ]);

  const DEFAULT_ICON_USAGE_SCENARIOS = Object.freeze([
    "Webサイト",
    "管理画面",
    "LP",
    "アプリ",
    "SNS",
    "プレゼン",
  ]);

  /** 将来: brand / sns / ec / ui など icon_family で拡張 */
  const ICON_SET_CATALOG = Object.freeze({
    "ui-rounded-v1": Object.freeze({
      series_id: "ui-rounded-v1",
      icon_family: "ui",
      icon_subfamily: "sns-ui-mix",
      count: 48,
      preview_icon_ids: Object.freeze([
        "home",
        "search",
        "mail",
        "phone",
        "user",
        "settings",
        "calendar",
        "camera",
      ]),
      icons: Object.freeze([
        { id: "home", label: "Home", glyph: "home", group: "navigation" },
        { id: "search", label: "Search", glyph: "search", group: "navigation" },
        { id: "mail", label: "Mail", glyph: "mail", group: "communication" },
        { id: "phone", label: "Phone", glyph: "phone", group: "communication" },
        { id: "user", label: "User", glyph: "user", group: "account" },
        { id: "settings", label: "Settings", glyph: "settings", group: "system" },
        { id: "calendar", label: "Calendar", glyph: "calendar", group: "productivity" },
        { id: "camera", label: "Camera", glyph: "camera", group: "media" },
        { id: "heart", label: "Heart", glyph: "heart", group: "action" },
        { id: "star", label: "Star", glyph: "star", group: "action" },
        { id: "bell", label: "Bell", glyph: "bell", group: "notification" },
        { id: "bookmark", label: "Bookmark", glyph: "bookmark", group: "action" },
        { id: "share", label: "Share", glyph: "share", group: "action" },
        { id: "download", label: "Download", glyph: "download", group: "file" },
        { id: "upload", label: "Upload", glyph: "upload", group: "file" },
        { id: "edit", label: "Edit", glyph: "edit", group: "action" },
        { id: "trash", label: "Trash", glyph: "trash", group: "action" },
        { id: "plus", label: "Plus", glyph: "plus", group: "action" },
        { id: "minus", label: "Minus", glyph: "minus", group: "action" },
        { id: "check", label: "Check", glyph: "check", group: "action" },
        { id: "close", label: "Close", glyph: "close", group: "action" },
        { id: "menu", label: "Menu", glyph: "menu", group: "navigation" },
        { id: "grid", label: "Grid", glyph: "grid", group: "layout" },
        { id: "list", label: "List", glyph: "list", group: "layout" },
        { id: "filter", label: "Filter", glyph: "filter", group: "action" },
        { id: "map", label: "Map", glyph: "map", group: "navigation" },
        { id: "image", label: "Image", glyph: "image", group: "media" },
        { id: "video", label: "Video", glyph: "video", group: "media" },
        { id: "mic", label: "Mic", glyph: "mic", group: "media" },
        { id: "lock", label: "Lock", glyph: "lock", group: "security" },
        { id: "unlock", label: "Unlock", glyph: "unlock", group: "security" },
        { id: "eye", label: "Eye", glyph: "eye", group: "action" },
        { id: "link", label: "Link", glyph: "link", group: "action" },
        { id: "cloud", label: "Cloud", glyph: "cloud", group: "file" },
        { id: "wifi", label: "Wi-Fi", glyph: "wifi", group: "system" },
        { id: "x", label: "X", glyph: "brand-x", group: "sns" },
        { id: "facebook", label: "Facebook", glyph: "brand-fb", group: "sns" },
        { id: "instagram", label: "Instagram", glyph: "brand-ig", group: "sns" },
        { id: "youtube", label: "YouTube", glyph: "brand-yt", group: "sns" },
        { id: "line", label: "LINE", glyph: "brand-line", group: "sns" },
        { id: "github", label: "GitHub", glyph: "brand-gh", group: "sns" },
        { id: "slack", label: "Slack", glyph: "brand-slack", group: "sns" },
        { id: "pinterest", label: "Pinterest", glyph: "brand-pin", group: "sns" },
        { id: "tiktok", label: "TikTok", glyph: "brand-tt", group: "sns" },
        { id: "threads", label: "Threads", glyph: "brand-threads", group: "sns" },
        { id: "linkedin", label: "LinkedIn", glyph: "brand-li", group: "sns" },
        { id: "whatsapp", label: "WhatsApp", glyph: "brand-wa", group: "sns" },
        { id: "telegram", label: "Telegram", glyph: "brand-tg", group: "sns" },
      ]),
      export_formats: DEFAULT_ICON_EXPORT_FORMATS,
      future_features: DEFAULT_ICON_FUTURE_FEATURES,
      icon_sizes: DEFAULT_ICON_SIZES,
      icon_styles: DEFAULT_ICON_STYLES,
      compatible_software: DEFAULT_ICON_SOFTWARE,
    }),
  });

  function resolveIconSet(item, override) {
    if (override.icon_set) return override.icon_set;
    const seriesId = override.icon_series_id || item.icon_series_id || "ui-rounded-v1";
    const catalog = ICON_SET_CATALOG[seriesId];
    if (!catalog) return null;
    return {
      ...catalog,
      icons: catalog.icons.slice(),
      preview_icon_ids: catalog.preview_icon_ids.slice(),
    };
  }

  function buildIconAiSuggestions(item) {
    const title = item.title || "アイコンセット";
    return [
      { label: "似たアイコン", prompt: `「${title}」に似たアイコンセットを提案してください` },
      { label: "同シリーズ", prompt: `「${title}」と同シリーズのアイコン素材を探してください` },
      { label: "色違い", prompt: `「${title}」の色違いバリエーション案を出してください` },
      { label: "サイズ変更", prompt: `「${title}」を16px〜512pxで使う際の最適化方法を教えてください` },
      { label: "ブランドアイコン検索", prompt: `「${title}」に近いブランドアイコン素材の探し方を教えてください` },
    ];
  }

  function scoreIconRelatedItem(source, candidate) {
    const sourceSeries =
      source.icon_series_id ||
      source.icon_set?.series_id ||
      DETAIL_OVERRIDES[source.slug]?.icon_series_id ||
      "";
    const candidateSeries =
      candidate.icon_series_id ||
      DETAIL_OVERRIDES[candidate.slug]?.icon_series_id ||
      ICON_SET_CATALOG[DETAIL_OVERRIDES[candidate.slug]?.icon_series_id || ""]?.series_id ||
      "";
    const sameSeries = sourceSeries && candidateSeries && sourceSeries === candidateSeries ? 1 : 0;
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sameSeries * 10000 + sameCategory * 1000 + popularity;
  }

  function fetchIconRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreIconRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_CODE_DEPENDENCIES = Object.freeze([
    "Vanilla JS",
    "ライブラリ不要",
    "モダンブラウザ対応",
  ]);

  const CODE_UI_RELATED_TAG_HINTS = Object.freeze([
    "Web",
    "UI",
    "メニュー",
    "フォーム",
    "ボタン",
    "レスポンシブ",
    "HTML",
  ]);

  function inferCodeLanguage(filename) {
    if (/\.html?$/i.test(filename)) return "html";
    if (/\.css$/i.test(filename)) return "css";
    if (/\.js$/i.test(filename)) return "javascript";
    return "text";
  }

  function resolveCodeFiles(item, override) {
    if (override.code_files?.length) {
      return override.code_files.map((file) => ({ ...file }));
    }
    const tree = override.file_tree || [];
    const preview = override.code_preview || "";
    if (!tree.length) {
      return preview
        ? [{ filename: "snippet.txt", language: "text", content: preview }]
        : [];
    }
    const jsIdx = tree.findIndex((f) => /\.js$/i.test(f));
    const targetIdx = jsIdx >= 0 ? jsIdx : tree.length - 1;
    return tree.map((filename, index) => ({
      filename,
      language: inferCodeLanguage(filename),
      content:
        index === targetIdx && preview
          ? preview
          : `/* ${filename} — ダウンロード後に内容を確認できます */`,
    }));
  }

  function buildDefaultCodeSetupSteps(codeFiles) {
    const steps = [];
    codeFiles.forEach((file) => {
      if (/\.html?$/i.test(file.filename)) {
        steps.push(`${file.filename} を配置する`);
      } else if (/\.css$/i.test(file.filename)) {
        steps.push(`${file.filename} を読み込む`);
      } else if (/\.js$/i.test(file.filename)) {
        steps.push(`${file.filename} を読み込む`);
      } else {
        steps.push(`${file.filename} を追加する`);
      }
    });
    if (steps.length) steps.push("テキストや色を変更して使用する");
    return steps;
  }

  function buildCodeAiSuggestions(item) {
    const title = item.title || "コードスニペット";
    return [
      { label: "このコードをカスタマイズ", prompt: `「${title}」のコードを用途に合わせてカスタマイズする方法を教えてください` },
      { label: "React版に変換", prompt: `「${title}」をReactコンポーネントに変換するコード例を出してください` },
      { label: "Tailwind版に変換", prompt: `「${title}」をTailwind CSS版に書き換えてください` },
      { label: "バグをチェック", prompt: `「${title}」のコードに潜在的なバグや改善点がないかレビューしてください` },
      { label: "似たUIパーツを探す", prompt: `「${title}」に似たUIパーツ素材の探し方と候補を提案してください` },
    ];
  }

  function isCodeUiRelatedCandidate(candidate) {
    if (candidate.category_id === "web") return true;
    return (candidate.tags || []).some((tag) =>
      CODE_UI_RELATED_TAG_HINTS.some(
        (hint) => tag.toLowerCase().includes(hint.toLowerCase()) || hint.toLowerCase().includes(tag.toLowerCase())
      )
    );
  }

  function scoreCodeRelatedItem(source, candidate) {
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const uiPart = isCodeUiRelatedCandidate(candidate) ? 1 : 0;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sharedTags * 10000 + sameCategory * 1000 + uiPart * 100 + popularity;
  }

  function fetchCodeRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreCodeRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_DOCUMENT_TOOLS = Object.freeze([
    "Word",
    "Google Docs",
    "Notion",
    "PDFビューア",
  ]);

  const DEFAULT_DOCUMENT_SETUP_STEPS = Object.freeze([
    "テンプレートをダウンロードする",
    "Word / Google Docs で開く",
    "氏名・日付・本文を編集する",
    "PDFとして保存する",
  ]);

  function inferDocumentLayout(item, override) {
    const doc = override.document_preview || {};
    if (doc.layout) return doc.layout;
    if (override.document_layout) return override.document_layout;
    if (item.thumbnail_style === "document-resume") return "resume";
    if (item.thumbnail_style === "document-invoice") return "invoice";
    if (String(item.slug || "").includes("email")) return "email";
    if ((item.tags || []).some((t) => /メール|mail/i.test(t))) return "email";
    return "generic";
  }

  function resolveDocumentFormats(item, override) {
    if (override.document_export_formats?.length) return override.document_export_formats.slice();
    const formats = item.file_formats || [];
    const normalized = formats.map((f) => String(f).toUpperCase());
    if (normalized.includes("DOCX") && !normalized.includes("TXT")) normalized.push("TXT");
    if (normalized.includes("DOCX") && !normalized.includes("PDF") && formats.some((f) => /pdf/i.test(f))) {
      /* keep */
    }
    if (inferDocumentLayout(item, override) === "email" && !normalized.includes("MARKDOWN")) {
      normalized.push("Markdown");
    }
    return normalized.length ? normalized : ["DOCX", "PDF", "TXT"];
  }

  function inferDocumentUsage(item, override) {
    if (override.document_usage) return override.document_usage;
    const layout = inferDocumentLayout(item, override);
    if (layout === "resume") return "履歴書・就活";
    if (layout === "invoice") return "請求書・見積書";
    if (layout === "email") return "ビジネスメール";
    return (item.tags || []).slice(0, 2).join(" · ") || "文例・文章テンプレート";
  }

  function buildDocumentAiSuggestions(item) {
    const title = item.title || "文例・文章テンプレート";
    const layout = item.document_layout || inferDocumentLayout(item, {});
    const extras =
      layout === "resume"
        ? [{ label: "履歴書を添削する", prompt: `「${title}」の履歴書内容を添削し、改善点を提案してください` }]
        : layout === "email"
          ? [{ label: "メール文面を作る", prompt: `「${title}」を参考に、用途別のメール文面案を3つ作成してください` }]
          : [];
    return [
      { label: "この文章を自分用に書き換え", prompt: `「${title}」の文章を自分用に書き換える例を出してください` },
      { label: "もっと丁寧にする", prompt: `「${title}」の文面をより丁寧なビジネス敬語に整えてください` },
      { label: "短くする", prompt: `「${title}」の文章を要点を保ったまま短くしてください` },
      { label: "ビジネス向けに整える", prompt: `「${title}」をビジネスシーン向けに整えた文面例を出してください` },
      ...extras,
      { label: "似たテンプレートを探す", prompt: `「${title}」に似た文章テンプレートの探し方と候補を提案してください` },
    ].slice(0, 6);
  }

  function scoreDocumentRelatedItem(source, candidate) {
    const sourceUsage = source.document_usage || DETAIL_OVERRIDES[source.slug]?.document_usage || "";
    const candidateUsage =
      candidate.document_usage || DETAIL_OVERRIDES[candidate.slug]?.document_usage || "";
    const sameUsage =
      sourceUsage && candidateUsage && sourceUsage === candidateUsage ? 1 : 0;
    const sourceScenarios = new Set(source.usage_scenarios || []);
    const sharedUsageScenarios = (candidate.usage_scenarios || []).filter((s) =>
      sourceScenarios.has(s)
    ).length;
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const sourceFormats = new Set(source.file_formats || []);
    const sharedFormats = (candidate.file_formats || []).filter((f) => sourceFormats.has(f)).length;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return (
      sameUsage * 100000 +
      sharedUsageScenarios * 10000 +
      sharedTags * 5000 +
      sameCategory * 1000 +
      sharedFormats * 100 +
      popularity
    );
  }

  function fetchDocumentRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreDocumentRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_TOOL_OUTPUT_FORMATS = Object.freeze(["PNG", "SVG", "JPG", "透過PNG"]);

  const DEFAULT_TOOL_SETUP_STEPS = Object.freeze([
    "ロゴ名を入力する",
    "カラーとスタイルを選択する",
    "「無料で使う」を押す",
    "PNG / SVGで保存する",
  ]);

  const TOOL_DESIGN_ASSIST_TAG_HINTS = Object.freeze(["デザイン", "配色", "ロゴ", "パレット", "ツール"]);

  function inferToolUsage(item, override) {
    if (override.tool_usage) return override.tool_usage;
    if (item.slug === "logo-maker-tool") return "ロゴ作成";
    if (item.slug === "tool-qr-generator") return "QRコード生成";
    if (item.slug === "color-palette-tool") return "配色・デザイン";
    return (item.tags || []).slice(0, 2).join(" · ") || "Webツール";
  }

  function isDesignAssistToolCandidate(candidate) {
    if (candidate.category_id !== "tool") return false;
    return (candidate.tags || []).some((tag) =>
      TOOL_DESIGN_ASSIST_TAG_HINTS.some(
        (hint) => tag.includes(hint) || hint.includes(tag)
      )
    );
  }

  function buildToolAiSuggestions(item) {
    const title = item.title || "ツール";
    if (item.slug === "logo-maker-tool" || item.tool_demo_type === "logo-maker") {
      return [
        { label: "ロゴ案を作る", prompt: `「${title}」で使えるロゴ案を3つ提案してください` },
        { label: "色違いを作る", prompt: `「${title}」で作ったロゴの色違いバリエーション案を出してください` },
        { label: "高級感を出す", prompt: `「${title}」のロゴをより高級感のあるデザインにする方法を教えてください` },
        { label: "シンプルにする", prompt: `「${title}」のロゴをよりシンプルに整える案を出してください` },
        { label: "店舗向けロゴにする", prompt: `「${title}」を店舗向けロゴに調整するポイントを教えてください` },
        { label: "SNSアイコン用にする", prompt: `「${title}」のロゴをSNSアイコン用に最適化する方法を教えてください` },
      ];
    }
    return [];
  }

  function scoreToolRelatedItem(source, candidate) {
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const sourceUsage = source.tool_usage || DETAIL_OVERRIDES[source.slug]?.tool_usage || "";
    const candidateUsage =
      candidate.tool_usage || DETAIL_OVERRIDES[candidate.slug]?.tool_usage || "";
    const sameUsage = sourceUsage && candidateUsage && sourceUsage === candidateUsage ? 1 : 0;
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const designAssist = isDesignAssistToolCandidate(candidate) ? 1 : 0;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sameCategory * 10000 + sameUsage * 1000 + sharedTags * 500 + designAssist * 100 + popularity;
  }

  function fetchToolRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scoreToolRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const DEFAULT_PRESENTATION_EXPORT_FORMATS = Object.freeze([
    "PPTX",
    "PDF",
    "Google Slides",
    "Canva",
  ]);

  const DEFAULT_PRESENTATION_SOFTWARE = Object.freeze([
    "PowerPoint",
    "Google Slides",
    "Keynote",
    "Canva",
  ]);

  const DEFAULT_PRESENTATION_USAGE_SCENARIOS = Object.freeze([
    "営業資料",
    "会社説明会",
    "提案資料",
    "セミナー",
    "社内共有",
    "学校発表",
  ]);

  const DEFAULT_PRESENTATION_SETUP_STEPS = Object.freeze([
    "PPTXをダウンロードする",
    "PowerPointで開く",
    "テキストと画像を差し替える",
    "PDF出力して使用する",
  ]);

  const DEFAULT_BUSINESS_PRESENTATION_SLIDES = Object.freeze([
    {
      id: 1,
      label: "表紙",
      layout: "title",
      heading: "ビジネスプレゼン",
      subheading: "2026年度 提案資料",
      note: "株式会社サンプル",
    },
    {
      id: 2,
      label: "アジェンダ",
      layout: "bullets",
      heading: "本日の内容",
      bullets: ["背景と課題", "解決策のご提案", "導入効果と事例", "ご支援内容", "今後の流れ"],
    },
    {
      id: 3,
      label: "背景",
      layout: "bullets",
      heading: "背景・課題",
      bullets: ["情報整理に時間がかかっている", "資料の品質にばらつきがある", "更新・共有が非効率"],
    },
    {
      id: 4,
      label: "提案",
      layout: "bullets",
      heading: "解決策のご提案",
      bullets: ["統一テンプレートで作成効率UP", "16:9で投影・共有に最適", "すぐ編集できる構成"],
    },
    {
      id: 5,
      label: "特徴",
      layout: "two-column",
      heading: "テンプレートの特徴",
      left: ["見やすいレイアウト", "ビジネス向け配色", "編集しやすい構成"],
      right: ["グラフ・図解枠付き", "章立て済み", "印刷にも対応"],
    },
    {
      id: 6,
      label: "実績",
      layout: "chart",
      heading: "導入効果（イメージ）",
      chart_labels: ["Q1", "Q2", "Q3", "Q4"],
    },
    {
      id: 7,
      label: "事例",
      layout: "bullets",
      heading: "導入事例",
      bullets: ["営業資料の作成時間を半減", "社内共有の統一感を改善", "提案資料の成約率向上"],
    },
    {
      id: 8,
      label: "プラン",
      layout: "two-column",
      heading: "ご支援内容",
      left: ["テンプレート提供", "カスタマイズ支援", "運用ガイド"],
      right: ["社内展開支援", "更新テンプレート", "PDF出力サポート"],
    },
    {
      id: 9,
      label: "流れ",
      layout: "bullets",
      heading: "今後の流れ",
      bullets: ["ヒアリング", "テンプレート調整", "社内展開", "運用開始"],
    },
    {
      id: 10,
      label: "終了",
      layout: "closing",
      heading: "ご清聴ありがとうございました",
      subheading: "ご質問・お問い合わせはお気軽に",
      note: "contact@example.com",
    },
  ]);

  function resolvePresentationSlides(item, override) {
    if (override.presentation_slides?.length) {
      return override.presentation_slides.map((slide) => ({ ...slide }));
    }
    if (item.category_id === "presentation") {
      return DEFAULT_BUSINESS_PRESENTATION_SLIDES.map((slide) => ({ ...slide }));
    }
    return [];
  }

  function inferPresentationUsage(item, override) {
    if (override.presentation_usage) return override.presentation_usage;
    if ((item.tags || []).includes("ビジネス")) return "ビジネスプレゼン";
    return (item.tags || []).slice(0, 2).join(" · ") || "プレゼン資料";
  }

  function buildPresentationAiSuggestions(item) {
    const title = item.title || "プレゼン資料";
    return [
      { label: "プレゼン内容を作る", prompt: `「${title}」のプレゼン資料の内容案をスライド構成付きで作成してください` },
      { label: "デザインを改善する", prompt: `「${title}」のデザインをより見やすく改善する提案をしてください` },
      { label: "スライドを増やす", prompt: `「${title}」に追加すべきスライド案を5枚提案してください` },
      { label: "発表原稿を作る", prompt: `「${title}」を使った10分間の発表原稿を作成してください` },
      { label: "AIで資料を自動生成", prompt: `「${title}」をベースにAIで資料を自動生成する手順とプロンプト例を教えてください` },
    ];
  }

  function scorePresentationRelatedItem(source, candidate) {
    const sameCategory = candidate.category_id === source.category_id ? 1 : 0;
    const sourceUsage =
      source.presentation_usage || DETAIL_OVERRIDES[source.slug]?.presentation_usage || "";
    const candidateUsage =
      candidate.presentation_usage || DETAIL_OVERRIDES[candidate.slug]?.presentation_usage || "";
    const sameUsage = sourceUsage && candidateUsage && sourceUsage === candidateUsage ? 1 : 0;
    const sourceDesign =
      source.presentation_design_key ||
      DETAIL_OVERRIDES[source.slug]?.presentation_design_key ||
      source.thumbnail_style ||
      "";
    const candidateDesign =
      candidate.presentation_design_key ||
      DETAIL_OVERRIDES[candidate.slug]?.presentation_design_key ||
      candidate.thumbnail_style ||
      "";
    const sameDesign = sourceDesign && candidateDesign && sourceDesign === candidateDesign ? 1 : 0;
    const sourceTags = new Set(source.tags || []);
    const sharedTags = (candidate.tags || []).filter((t) => sourceTags.has(t)).length;
    const popularity = 1000 - (candidate.popularity_rank || 999);
    return sameCategory * 10000 + sameUsage * 1000 + sameDesign * 100 + sharedTags * 50 + popularity;
  }

  function fetchPresentationRelatedItemsRanked(source, limit) {
    return getActiveItems().filter((i) => i.slug !== source.slug)
      .map((i) => ({ item: i, score: scorePresentationRelatedItem(source, i) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => normalizeItem(item));
  }

  const IMAGE_MATERIAL_CATEGORIES = new Set(["image", "illustration", "background"]);

  const PREVIEW_BASE = "/materials/images/previews";

  /** @type {Record<string, object>} */
  const PREVIEW_IMAGE_SAMPLES = Object.freeze({
    "image-cute-cat-3d": {
      preview_images: [
        { id: "main", label: "正面", src: `${PREVIEW_BASE}/image-cute-cat-3d.svg`, alt: "3D風の可愛い猫（正面）" },
        { id: "side", label: "横顔", src: `${PREVIEW_BASE}/image-cute-cat-3d-side.svg`, alt: "3D風の可愛い猫（横顔）" },
      ],
      image_transparent: "なし",
      image_usage: "SNS・ブログ・アイキャッチ",
    },
    "wallpaper-minimal": {
      preview_images: [
        { id: "main", label: "プレビュー", src: `${PREVIEW_BASE}/wallpaper-minimal.svg`, alt: "ミニマル壁紙セット" },
      ],
      image_transparent: "なし",
      image_usage: "デスクトップ・スマホ壁紙",
    },
    "illustration-office-worker": {
      preview_images: [
        {
          id: "main",
          label: "プレビュー",
          src: `${PREVIEW_BASE}/illustration-office-worker.svg`,
          alt: "パソコンを使う会社員イラスト",
        },
      ],
      image_transparent: "あり（PNG）",
      image_usage: "ビジネス記事・資料・プレゼン",
    },
    "background-cyberpunk-room": {
      preview_images: [
        {
          id: "main",
          label: "プレビュー",
          src: `${PREVIEW_BASE}/background-cyberpunk-room.svg`,
          alt: "サイバーパンク部屋背景",
        },
      ],
      image_transparent: "なし",
      image_usage: "ゲーム・SF系コンテンツ・動画背景",
    },
    "background-cafe": {
      preview_images: [
        { id: "main", label: "店内", src: `${PREVIEW_BASE}/background-cafe.svg`, alt: "お洒落なカフェ背景（店内）" },
        { id: "counter", label: "カウンター", src: `${PREVIEW_BASE}/background-cafe-alt.svg`, alt: "お洒落なカフェ背景（カウンター）" },
      ],
      image_transparent: "なし",
      image_usage: "Web・動画・サムネイル背景",
      preview_bg_labels: ["16:9", "写真風", "5760px"],
    },
    "illustration-simple-character": {
      preview_images: [
        {
          id: "main",
          label: "プレビュー",
          src: `${PREVIEW_BASE}/illustration-simple-character.svg`,
          alt: "シンプルキャラクターイラスト",
        },
      ],
      image_transparent: "あり（PNG / SVG）",
      image_usage: "SNS・LP・プレゼン",
    },
    "background-gradient-soft": {
      preview_images: [
        {
          id: "main",
          label: "プレビュー",
          src: `${PREVIEW_BASE}/background-gradient-soft.svg`,
          alt: "ソフトグラデーション背景",
        },
      ],
      image_transparent: "なし",
      image_usage: "Web・サムネイル・バナー",
      preview_bg_labels: ["16:9", "グラデーション", "パステル"],
    },
  });

  function buildImageDetailLines(item, sample) {
    const usage =
      sample.image_usage ||
      (item.usage_tags || item.tags || []).slice(0, 2).join("・") ||
      "Web・SNS";
    const size = item.meta_resolution || item.meta_size || "—";
    const transparent =
      sample.image_transparent ||
      (item.category_id === "illustration" ? "あり（PNG）" : "なし");
    return [
      `用途：${usage}`,
      `サイズ：${size} / 背景透過：${transparent} / 商用利用：可（クレジット不要）`,
    ];
  }

  function resolvePreviewImages(item) {
    const sample = PREVIEW_IMAGE_SAMPLES[item.slug];
    if (sample?.preview_images?.length) return sample.preview_images;
    // Index / unknown slugs: do not invent missing /previews/{slug}.svg (404).
    // Detail UI falls back to thumbnail_style CSS when preview_images is empty.
    return [];
  }

  /** @type {Record<string, object>} */
  const DETAIL_OVERRIDES = Object.freeze({
    "business-card-simple": {
      meta_format: "PowerPoint (PPTX)",
      meta_size: "91 × 55 mm",
      meta_pages: "1枚",
      file_size: "約 0.5 MB",
      environment: "PowerPoint 2016 以降",
      long_description:
        "ビジネスシーンで使いやすい、シンプルな名刺テンプレートです。文字情報を入れ替えるだけですぐに利用できます。配色バリエーションも同梱しており、用途に合わせて選べます。",
      recommended_for: [
        "初めて名刺を作成する方",
        "シンプルで清潔感のあるデザインを探している方",
        "PowerPointで手軽に編集したい方",
      ],
      preview_variants: [
        { id: "blue", label: "ブルー", thumb_style: "template-card" },
        { id: "green", label: "グリーン", thumb_style: "tool-palette" },
        { id: "orange", label: "オレンジ", thumb_style: "presentation" },
        { id: "dark", label: "ダーク", thumb_style: "background-cyber" },
      ],
    },
    "presentation-business": {
      preview_type: "presentation",
      meta_pages: "10枚",
      meta_ratio: "16:9",
      meta_format: "PPTX / PDF",
      meta_size: "16:9",
      presentation_usage: "ビジネスプレゼン",
      presentation_design_key: "business-orange",
      presentation_export_formats: ["PPTX", "PDF", "Google Slides", "Canva"],
      presentation_editable: "編集可",
      presentation_print: "印刷対応",
      presentation_recommended_software: ["PowerPoint", "Google Slides", "Keynote", "Canva"],
      presentation_usage_scenarios: [
        "営業資料",
        "会社説明会",
        "提案資料",
        "セミナー",
        "社内共有",
        "学校発表",
      ],
      presentation_setup_steps: [
        "PPTXをダウンロードする",
        "PowerPointで開く",
        "テキストと画像を差し替える",
        "PDF出力して使用する",
      ],
      long_description:
        "ビジネスシーンですぐ使える16:9のプレゼン資料テンプレートです。表紙・アジェンダ・提案・事例・まとめまで10枚構成で、PowerPoint / Google Slides / Canvaで編集できます。",
      recommended_for: [
        "営業・提案資料を素早く作りたい方",
        "統一感のある社内プレゼンが必要な方",
        "すぐに編集を始めたい方",
      ],
    },
    "sns-icon-set": {
      preview_type: "icon-grid",
      icon_series_id: "ui-rounded-v1",
      meta_pages: "48点",
      meta_format: "SVG / PNG / ZIP",
      export_formats: ["SVG", "PNG", "ZIP"],
      icon_styles: ["Outline", "Filled", "Rounded", "Flat", "Mono", "Color"],
      compatible_software: ["Illustrator", "Figma", "Photoshop", "Adobe XD", "Canva"],
      usage_scenarios: ["Webサイト", "管理画面", "LP", "アプリ", "SNS", "プレゼン"],
      long_description:
        "Webサイト・管理画面・LP・アプリ・SNS・プレゼンなど幅広い用途に使える丸型アイコンセットです。Home / Search / Mail などの代表アイコンに加え、主要SNSアイコンも収録しています。SVG / PNG / ZIP形式で提供し、16px〜512pxまでスケール可能です。",
      recommended_for: [
        "UIデザインですぐ使えるアイコンセットが欲しい方",
        "SNSリンク用アイコンをまとめて揃えたい方",
        "FigmaやIllustratorで編集できるSVG素材を探している方",
      ],
    },
    "bgm-vlog-lofi": {
      preview_type: "audio",
      meta_duration: "3:12",
      meta_bpm: "82 BPM",
      audio_src: "",
    },
    "sfx-telop-pop": {
      preview_type: "audio",
      meta_duration: "0:01",
      usage_tags: ["テロップ", "ポップ", "YouTube"],
    },
    "web-hamburger-menu": {
      preview_type: "code",
      code_demo_type: "hamburger",
      code_preview:
        "<nav class=\"menu\">\n  <button aria-label=\"メニュー\">☰</button>\n  <ul class=\"menu__list\">...</ul>\n</nav>",
      demo_url: "#",
      file_tree: ["index.html", "style.css", "menu.js"],
    },
    "web-wp-sns-share": {
      preview_type: "code",
      code_demo_type: "share-buttons",
      code_preview:
        "<div class=\"share\">\n  <a href=\"#\" class=\"share__x\">X</a>\n  <a href=\"#\" class=\"share__fb\">Facebook</a>\n</div>",
      file_tree: ["share-buttons.html", "share.css"],
    },
    "code-typing-effect": {
      preview_type: "code",
      code_demo_type: "typing",
      meta_pages: "3ファイル",
      meta_language: "HTML / CSS / JS",
      meta_difficulty: "初級",
      meta_browser_support: "Chrome / Firefox / Safari / Edge（最新版）",
      code_dependencies: ["Vanilla JS", "ライブラリ不要", "モダンブラウザ対応"],
      code_setup_steps: [
        "index.html を配置する",
        "style.css を読み込む",
        "typing.js を読み込む",
        "表示テキストを変更して使用する",
      ],
      file_tree: ["index.html", "style.css", "typing.js"],
      code_files: [
        {
          filename: "index.html",
          language: "html",
          content:
            '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Typing Effect</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1 id="typing" class="typing" aria-live="polite"></h1>\n  <script src="typing.js"></script>\n</body>\n</html>',
        },
        {
          filename: "style.css",
          language: "css",
          content:
            '.typing {\n  font-size: clamp(1.5rem, 4vw, 2.5rem);\n  font-weight: 700;\n  color: #0f172a;\n  min-height: 1.2em;\n}\n\n.typing::after {\n  content: "|";\n  margin-left: 2px;\n  animation: blink 1s step-end infinite;\n}\n\n@keyframes blink {\n  50% { opacity: 0; }\n}',
        },
        {
          filename: "typing.js",
          language: "javascript",
          content:
            "const text = 'Welcome to TASFUL';\nconst el = document.getElementById('typing');\nlet i = 0;\n\nconst timer = setInterval(() => {\n  el.textContent = text.slice(0, ++i);\n  if (i >= text.length) clearInterval(timer);\n}, 120);",
        },
      ],
      long_description:
        "見出しやヒーローセクションに使えるタイピング文字エフェクトです。HTML / CSS / JS の3ファイル構成で、テキストを差し替えるだけですぐに利用できます。",
      recommended_for: [
        "LPやポートフォリオのヒーロー演出を強化したい方",
        "軽量なアニメーションを追加したい方",
        "コピペですぐ試したい方",
      ],
    },
    "illustration-simple-character": {
      meta_points: "1点",
      meta_resolution: "2000 × 2000 px",
      meta_size: "2000 × 2000 px",
      meta_transparent: "あり（PNG / SVG）",
      meta_editable: "編集可（Illustrator / SVG）",
      meta_ai_generated: "一部AI支援",
      meta_author: "TASFUL Materials",
      published_at: "2026-06-20T00:00:00.000Z",
      usage_scenarios: ["SNS", "ブログ", "YouTube", "プレゼン", "チラシ", "Web制作"],
      long_description:
        "SNS投稿やLP、プレゼン資料に使いやすいシンプルなキャラクターイラストです。PNG / SVG / AI形式で提供し、背景透過版も同梱しています。",
      recommended_for: [
        "親しみやすいイラスト素材を探している方",
        "SNSやブログのアイキャッチに使いたい方",
        "商用利用可能なイラストが必要な方",
      ],
    },
    "illustration-office-worker": {
      meta_points: "1点",
      meta_resolution: "2400 × 1800 px",
      meta_transparent: "あり（PNG）",
      meta_editable: "編集可（Illustrator）",
      meta_ai_generated: "なし",
      meta_author: "TASFUL Materials",
      published_at: "2026-06-15T00:00:00.000Z",
      usage_scenarios: ["プレゼン", "ブログ", "Web制作", "チラシ"],
      long_description:
        "ビジネス記事や社内資料、プレゼン資料向けの会社員イラスト素材です。フラットなデザインで読みやすく、背景透過PNGも同梱しています。",
      recommended_for: [
        "ビジネス系コンテンツの見た目を整えたい方",
        "記事や資料にイラストを添えたい方",
        "統一感のある素材を探している方",
      ],
    },
    "background-gradient-soft": {
      meta_ratio: "16:9",
      meta_resolution: "3840 × 2160 px",
      meta_ai_generated: "一部AI支援",
      meta_color: "Pastel · Pink · Blue",
      primary_color_key: "pastel",
      preview_bg_labels: ["16:9", "グラデーション", "3840px"],
      usage_scenarios: ["YouTube", "配信背景", "サムネイル", "LP", "Webサイト"],
      style_tag_groups: [
        { label: "テーマ", tags: ["Gradient", "Soft"] },
        { label: "雰囲気", tags: ["Light", "Calm"] },
        { label: "色", tags: ["Pastel", "Pink", "Blue"] },
        { label: "スタイル", tags: ["Minimal"] },
      ],
      color_palette: [
        { hex: "#fce7f3", label: "Pink" },
        { hex: "#dbeafe", label: "Blue" },
        { hex: "#e0e7ff", label: "Lavender" },
        { hex: "#f0fdf4", label: "Mint" },
        { hex: "#fff7ed", label: "Peach" },
      ],
      long_description:
        "Webサイトやサムネイル、バナー背景に使えるソフトなグラデーション素材です。パステルカラーで目に優しく、文字を載せやすい設計です。",
      recommended_for: [
        "やわらかい印象の背景を探している方",
        "YouTubeサムネやバナー制作に使いたい方",
        "単色よりリッチな背景が欲しい方",
      ],
    },
    "background-cyberpunk-room": {
      meta_resolution: "5760 × 3240 px",
      meta_ai_generated: "一部AI支援",
      meta_color: "Blue · Neon · Purple",
      primary_color_key: "blue-neon",
      preview_bg_labels: ["16:9", "サイバーパンク", "5760px"],
      usage_scenarios: ["YouTube", "配信背景", "Zoom", "ゲーム", "サムネイル"],
      style_tag_groups: [
        { label: "テーマ", tags: ["Cyberpunk", "Sci-Fi"] },
        { label: "雰囲気", tags: ["Dark", "Night"] },
        { label: "色", tags: ["Blue", "Neon"] },
        { label: "スタイル", tags: ["Neon"] },
      ],
      color_palette: [
        { hex: "#0b1220", label: "Deep Navy" },
        { hex: "#1e3a8a", label: "Blue" },
        { hex: "#2563eb", label: "Neon Blue" },
        { hex: "#a855f7", label: "Purple" },
        { hex: "#ec4899", label: "Neon Pink" },
      ],
      long_description:
        "ゲームやSF系動画、ストリーミング背景向けのサイバーパンク部屋背景です。ネオンカラーが特徴的で、没入感のあるシーン作りに適しています。",
      recommended_for: [
        "配信や動画の背景を印象的にしたい方",
        "SF・ゲーム系コンテンツを制作している方",
        "ネオンカラーの世界観を探している方",
      ],
    },
    "background-cafe": {
      meta_resolution: "5760 × 3240 px",
      meta_ai_generated: "なし",
      meta_color: "Warm · Brown · Beige",
      primary_color_key: "warm",
      preview_bg_labels: ["16:9", "写真風", "5760px"],
      usage_scenarios: ["Zoom", "LP", "Webサイト", "サムネイル", "YouTube"],
      style_tag_groups: [
        { label: "テーマ", tags: ["Cafe", "Interior"] },
        { label: "雰囲気", tags: ["Warm", "Cozy"] },
        { label: "色", tags: ["Brown", "Beige"] },
        { label: "スタイル", tags: ["Photo"] },
      ],
      color_palette: [
        { hex: "#78350f", label: "Brown" },
        { hex: "#d97706", label: "Amber" },
        { hex: "#fde68a", label: "Cream" },
        { hex: "#fef3c7", label: "Light" },
        { hex: "#451a03", label: "Dark Wood" },
      ],
      long_description:
        "Webや動画、オンライン会議の背景に使えるお洒落なカフェ写真素材です。温かみのあるトーンで、親しみやすい印象を与えます。",
      recommended_for: [
        "Zoom背景やLPに写真風素材を使いたい方",
        "カフェ・飲食系のコンテンツ制作者",
        "暖色系の背景を探している方",
      ],
    },
    "code-contact-form": {
      preview_type: "code",
      code_demo_type: "form",
      meta_pages: "3ファイル",
      meta_language: "HTML / CSS / JS",
      meta_difficulty: "初級",
      meta_browser_support: "Chrome / Firefox / Safari / Edge（最新版）",
      code_dependencies: ["Vanilla JS", "ライブラリ不要", "モダンブラウザ対応"],
      file_tree: ["index.html", "contact.css", "contact.js"],
      code_files: [
        {
          filename: "index.html",
          language: "html",
          content:
            '<form class="contact">\n  <label>お名前<input name="name" placeholder="山田 太郎"></label>\n  <label>メール<input type="email" name="email" placeholder="mail@example.com"></label>\n  <label>お問い合わせ<textarea name="message"></textarea></label>\n  <button type="submit">送信</button>\n</form>',
        },
        {
          filename: "contact.css",
          language: "css",
          content:
            ".contact { display: grid; gap: 12px; max-width: 420px; }\n.contact input,\n.contact textarea { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }",
        },
        {
          filename: "contact.js",
          language: "javascript",
          content:
            "document.querySelector('.contact')?.addEventListener('submit', (e) => {\n  e.preventDefault();\n  alert('送信デモ（実装はダウンロードファイルを参照）');\n});",
        },
      ],
      long_description:
        "お名前・メールアドレス・お問い合わせ内容の3項目に対応したフォームコードです。バリデーション付きで、LPやコーポレートサイトにそのまま組み込めます。",
      recommended_for: [
        "お問い合わせフォームを素早く実装したい方",
        "シンプルで見やすいフォームUIを探している方",
        "HTML / CSS / JS を学びながら使いたい方",
      ],
    },
    "text-business-email": {
      preview_type: "document",
      document_layout: "email",
      document_usage: "ビジネスメール",
      document_export_formats: ["DOCX", "PDF", "TXT", "Markdown"],
      document_editable: "Word / Google Docs で編集可",
      document_print: "A4印刷対応",
      document_recommended_tools: ["Word", "Google Docs", "Notion", "PDFビューア"],
      meta_char_count: "約600文字",
      meta_format: "DOCX / PDF / TXT / Markdown",
      document_setup_steps: [
        "テンプレートをダウンロードする",
        "Word / Google Docs / Notion で開く",
        "宛名・件名・本文を編集する",
        "送信またはPDFとして保存する",
      ],
      document_preview: {
        layout: "email",
        title: "件名：【ご依頼】資料送付のお願い",
        date_label: "2026年6月30日",
        greeting: "お世話になっております。株式会社〇〇の田中です。",
        body: "先日お話しした件について、参考資料をお送りいたします。ご確認のうえ、ご都合の良い日程をご教示ください。",
        bullets: ["依頼内容を簡潔に記載", "添付資料の案内", "返信期限の明示"],
        signoff: "何卒よろしくお願いいたします。",
        signature: { name: "田中 太郎", company: "株式会社〇〇", department: "営業部" },
      },
      long_description:
        "依頼・お礼・日程調整などビジネスシーンで使えるメール文例テンプレートです。件名から署名までコピーしてそのまま使える構成になっています。",
      recommended_for: [
        "ビジネスメールの型を素早く作りたい方",
        "丁寧な文面の参考例が欲しい方",
        "新人研修や社内テンプレートとして使いたい方",
      ],
    },
    "resume-modern": {
      preview_type: "document",
      document_layout: "resume",
      document_usage: "履歴書・就活",
      document_export_formats: ["DOCX", "PDF", "TXT"],
      document_editable: "Word / Google Docs で編集可",
      document_print: "A4印刷対応",
      document_recommended_tools: ["Word", "Google Docs", "Notion", "PDFビューア"],
      meta_char_count: "約1200文字",
      meta_format: "DOCX / PDF / TXT",
      document_setup_steps: [
        "テンプレートをダウンロードする",
        "Word / Google Docs で開く",
        "氏名・学歴・職歴・自己PRを編集する",
        "PDFとして保存して提出する",
      ],
      document_preview: {
        layout: "resume",
        title: "履歴書",
        date_label: "2026年6月30日 現在",
        sections: [
          {
            heading: "基本情報",
            fields: [
              { label: "氏名", value: "山田 太郎" },
              { label: "生年月日", value: "1995年4月1日（満30歳）" },
              { label: "住所", value: "東京都渋谷区〇〇 1-2-3" },
            ],
          },
          {
            heading: "学歴",
            bullets: ["2014年4月 ○○大学 経済学部 入学", "2018年3月 同大学 卒業"],
          },
          {
            heading: "職歴",
            bullets: ["2018年4月 株式会社△△ 入社", "2022年6月 同社 マネージャー昇格", "現在に至る"],
          },
          {
            heading: "スキル・資格",
            bullets: ["普通自動車第一種運転免許", "TOEIC 750点", "Excel / PowerPoint 実務経験"],
          },
          {
            heading: "自己PR",
            body: "チーム開発と顧客折衝の経験を活かし、課題整理から実行まで一貫して貢献できます。",
          },
        ],
        signoff: "以上",
      },
      long_description:
        "転職・就活向けのモダンな履歴書テンプレートです。見出しと箇条書きで情報を整理しやすく、Word / PDF形式で編集できます。",
      recommended_for: [
        "就活・転職で履歴書を作り直したい方",
        "読みやすいレイアウトを探している方",
        "すぐに編集を始めたい方",
      ],
    },
    "invoice-template": {
      preview_type: "document",
      document_layout: "invoice",
      document_usage: "請求書・見積書",
      document_export_formats: ["XLSX", "PDF", "TXT"],
      document_editable: "Excel / Google スプレッドシートで編集可",
      document_print: "A4印刷対応",
      document_recommended_tools: ["Excel", "Google スプレッドシート", "PDFビューア"],
      meta_char_count: "約900文字",
      meta_format: "XLSX / PDF / TXT",
      document_setup_steps: [
        "テンプレートをダウンロードする",
        "Excel / Google スプレッドシートで開く",
        "取引先・品目・金額を編集する",
        "PDFとして保存して送付する",
      ],
      document_preview: {
        layout: "invoice",
        title: "請求書",
        date_label: "2026年6月30日",
        invoice_no: "INV-2026-0630",
        sections: [
          {
            heading: "請求先",
            fields: [
              { label: "会社名", value: "株式会社サンプル 御中" },
              { label: "担当者", value: "経理部 ご担当者様" },
            ],
          },
          {
            heading: "請求内容",
            bullets: ["Webサイト制作費", "保守サポート（6月分）"],
          },
        ],
        line_items: [
          { name: "Webサイト制作", qty: "1", unit: "式", amount: "¥150,000" },
          { name: "保守サポート", qty: "1", unit: "月", amount: "¥20,000" },
        ],
        total: "¥170,000",
        signoff: "お振込期限：2026年7月31日",
      },
      long_description:
        "フリーランス・小規模事業者向けの請求書テンプレートです。品目・数量・金額を編集するだけですぐに使えます。",
      recommended_for: [
        "請求書を素早く作成したい方",
        "Excelで管理したいフリーランス",
        "シンプルな請求書フォーマットを探している方",
      ],
    },
    "tool-qr-generator": {
      preview_type: "tool",
      tool_demo_type: "qr-generator",
      meta_tool_type: "QRコード生成",
      meta_usage_form: "ブラウザで無料利用（会員登録不要）",
      long_description:
        "URLやテキストを入力するだけでQRコードを生成できるWebツールです。PNGダウンロードに対応し、名刺・チラシ・イベント案内などに利用できます。",
      recommended_for: [
        "手軽にQRコードを作成したい方",
        "イベントや店舗の案内に使いたい方",
        "インストール不要のツールを探している方",
      ],
    },
    "logo-maker-tool": {
      preview_type: "tool",
      tool_demo_type: "logo-maker",
      meta_tool_type: "ロゴ作成",
      meta_usage_form: "ブラウザで無料利用（会員登録不要）",
      meta_compatibility: "Chrome / Firefox / Safari / Edge（最新版）",
      button_label: "無料で使う",
      tool_usage: "ロゴ作成",
      tool_output_formats: ["PNG", "SVG", "JPG", "透過PNG"],
      tool_signup_required: "不要",
      tool_setup_steps: [
        "ロゴ名を入力する",
        "カラーとスタイルを選択する",
        "「無料で使う」を押す",
        "PNG / SVGで保存する",
      ],
      long_description:
        "ブラウザ上でロゴ名・サブタイトル・カラー・フォント・スタイルを選び、シンプルなロゴを作成できるツールです。PNG / SVG / JPG / 透過PNG形式で書き出し可能です。",
      recommended_for: [
        "小規模ビジネスのロゴを試作したい方",
        "手軽にロゴ案を作りたい方",
        "ブラウザだけで完結するツールを探している方",
      ],
    },
  });

  function formatDateDisplay(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return "—";
    }
  }

  function enrichDetail(raw) {
    if (!raw) return null;
    const item = normalizeItem(raw);
    const override = DETAIL_OVERRIDES[item.slug] || {};
    const catDefaults = CATEGORY_META_DEFAULTS[item.category_id] || {};
    const imageSample = PREVIEW_IMAGE_SAMPLES[item.slug] || {};
    const preview_type = override.preview_type || PREVIEW_TYPE_MAP[item.category_id] || "image";
    const merged = { ...item, ...catDefaults, ...imageSample, ...override };

    return {
      ...merged,
      preview_type,
      meta_format: override.meta_format || (item.file_formats || []).join(" / ") || "—",
      meta_duration: merged.meta_duration || merged.duration || "—",
      meta_updated: formatDateDisplay(item.updated_at),
      meta_language: merged.meta_language || (item.file_formats || []).join(" / ") || "—",
      meta_points: merged.meta_points || merged.meta_pages || "—",
      meta_char_count: merged.meta_char_count || "—",
      meta_tool_type: merged.meta_tool_type || "—",
      meta_usage_form: merged.meta_usage_form || "—",
      meta_ratio: merged.meta_ratio || merged.meta_size || "—",
      commercial_use: merged.commercial_use || "個人・商用利用OK",
      long_description: override.long_description || item.description,
      recommended_for: override.recommended_for || DEFAULT_RECOMMENDED,
      preview_variants:
        override.preview_variants || [{ id: "default", label: "プレビュー", thumb_style: item.thumbnail_style }],
      usage_tags: override.usage_tags || item.tags || [],
      file_tree: override.file_tree || (item.file_formats || []).map((f) => `sample.${f.toLowerCase()}`),
      code_preview: override.code_preview || "",
      code_demo_type: override.code_demo_type || "",
      demo_url: override.demo_url || "",
      audio_src: override.audio_src || "",
      meta_compatibility:
        override.meta_compatibility ||
        catDefaults.meta_compatibility ||
        catDefaults.environment ||
        "",
      preview_images: override.preview_images || resolvePreviewImages(merged),
      preview_bg_labels: override.preview_bg_labels || imageSample.preview_bg_labels || [],
      document_preview: override.document_preview || {},
      tool_demo_type: override.tool_demo_type || "",
      image_detail_lines:
        override.image_detail_lines ||
        (IMAGE_MATERIAL_CATEGORIES.has(item.category_id)
          ? buildImageDetailLines(merged, imageSample)
          : []),
      meta_transparent:
        merged.meta_transparent ||
        imageSample.image_transparent ||
        (item.category_id === "illustration"
          ? "あり（PNG）"
          : item.category_id === "background"
            ? "なし"
            : "—"),
      meta_editable: merged.meta_editable || (item.category_id === "illustration" ? "編集可" : "—"),
      meta_ai_generated:
        merged.meta_ai_generated ||
        (item.category_id === "background" ? "一部AI支援" : "—"),
      meta_color: merged.meta_color || "—",
      meta_author: merged.meta_author || "—",
      meta_published: formatDateDisplay(
        override.published_at || item.published_at || item.updated_at
      ),
      ai_suggestions:
        override.ai_suggestions ||
        (item.category_id === "illustration"
          ? buildIllustrationAiSuggestions(merged)
          : item.category_id === "background"
            ? buildBackgroundAiSuggestions(merged)
            : item.category_id === "icon"
              ? buildIconAiSuggestions(merged)
              : item.category_id === "code"
                ? buildCodeAiSuggestions(merged)
                : item.category_id === "document"
                  ? buildDocumentAiSuggestions(merged)
                  : item.category_id === "tool"
                    ? buildToolAiSuggestions(merged)
                    : item.category_id === "presentation"
                      ? buildPresentationAiSuggestions(merged)
                      : []),
      meta_recommended_usage:
        (override.usage_scenarios ||
          (item.category_id === "background"
            ? DEFAULT_BACKGROUND_USAGE_SCENARIOS
            : item.category_id === "icon"
              ? DEFAULT_ICON_USAGE_SCENARIOS
              : []))
          .slice(0, 3)
          .join(" · ") || "—",
      icon_set: item.category_id === "icon" ? resolveIconSet(item, override) : null,
      icon_series_id:
        override.icon_series_id ||
        merged.icon_set?.series_id ||
        (item.category_id === "icon" ? "ui-rounded-v1" : ""),
      icon_sizes: override.icon_sizes || merged.icon_set?.icon_sizes || DEFAULT_ICON_SIZES,
      icon_styles:
        override.icon_styles || merged.icon_set?.icon_styles || DEFAULT_ICON_STYLES,
      compatible_software:
        override.compatible_software ||
        merged.icon_set?.compatible_software ||
        DEFAULT_ICON_SOFTWARE,
      export_formats:
        override.export_formats ||
        merged.icon_set?.export_formats ||
        (item.category_id === "icon" ? DEFAULT_ICON_EXPORT_FORMATS : []),
      future_export_features:
        override.future_export_features ||
        merged.icon_set?.future_features ||
        (item.category_id === "icon" ? DEFAULT_ICON_FUTURE_FEATURES : []),
      icon_count_display:
        merged.icon_set?.count != null
          ? `${merged.icon_set.count}点`
          : item.meta_pages || merged.meta_pages || "—",
      meta_format_exports: (
        override.export_formats ||
        merged.icon_set?.export_formats ||
        item.file_formats ||
        []
      )
        .slice(0, 5)
        .join(" / ") || merged.meta_format || "—",
      meta_size_range:
        override.meta_size_range ||
        (item.category_id === "icon" ? "16px〜512px" : merged.meta_size || "—"),
      meta_icon_styles: (
        override.icon_styles ||
        merged.icon_set?.icon_styles ||
        DEFAULT_ICON_STYLES
      ).join(" · "),
      meta_compatible_software: (
        override.compatible_software ||
        merged.icon_set?.compatible_software ||
        DEFAULT_ICON_SOFTWARE
      ).join(" · "),
      usage_scenarios:
        override.usage_scenarios ||
        (item.category_id === "illustration"
          ? DEFAULT_ILLUSTRATION_USAGE_SCENARIOS.slice()
          : item.category_id === "background"
            ? DEFAULT_BACKGROUND_USAGE_SCENARIOS.slice()
            : item.category_id === "icon"
              ? DEFAULT_ICON_USAGE_SCENARIOS.slice()
              : []),
      style_tag_groups: override.style_tag_groups || [],
      color_palette: override.color_palette || [],
      primary_color_key: override.primary_color_key || merged.primary_color_key || "",
      code_files:
        item.category_id === "code" ? resolveCodeFiles(item, override) : [],
      code_dependencies:
        override.code_dependencies ||
        (item.category_id === "code" ? DEFAULT_CODE_DEPENDENCIES.slice() : []),
      code_setup_steps:
        override.code_setup_steps ||
        (item.category_id === "code"
          ? buildDefaultCodeSetupSteps(resolveCodeFiles(item, override))
          : []),
      meta_file_structure:
        override.meta_file_structure ||
        (item.category_id === "code"
          ? (resolveCodeFiles(item, override).map((f) => f.filename).join(" · ") ||
            (override.file_tree || merged.file_tree || []).join(" · ") ||
            "—")
          : "—"),
      meta_dependencies:
        override.meta_dependencies ||
        (item.category_id === "code"
          ? (override.code_dependencies || DEFAULT_CODE_DEPENDENCIES).join(" · ")
          : "—"),
      meta_browser_support:
        override.meta_browser_support ||
        merged.meta_compatibility ||
        (item.category_id === "code" ? "モダンブラウザ対応" : "—"),
      meta_difficulty:
        override.meta_difficulty || (item.category_id === "code" ? "初級" : "—"),
      document_layout:
        item.category_id === "document" ? inferDocumentLayout(item, override) : "",
      document_usage:
        item.category_id === "document" ? inferDocumentUsage(item, override) : "",
      document_export_formats:
        item.category_id === "document" ? resolveDocumentFormats(item, override) : [],
      document_editable:
        override.document_editable ||
        (item.category_id === "document" ? "Word / Google Docs で編集可" : "—"),
      document_print:
        override.document_print || (item.category_id === "document" ? "A4印刷対応" : "—"),
      document_recommended_tools:
        override.document_recommended_tools ||
        (item.category_id === "document" ? DEFAULT_DOCUMENT_TOOLS.slice() : []),
      document_setup_steps:
        override.document_setup_steps ||
        (item.category_id === "document" ? DEFAULT_DOCUMENT_SETUP_STEPS.slice() : []),
      meta_document_usage:
        item.category_id === "document" ? inferDocumentUsage(item, override) : "—",
      meta_document_formats:
        item.category_id === "document"
          ? resolveDocumentFormats(item, override).join(" / ")
          : merged.meta_format || "—",
      meta_document_editable:
        override.document_editable ||
        (item.category_id === "document" ? "Word / Google Docs で編集可" : "—"),
      meta_document_print:
        override.document_print || (item.category_id === "document" ? "A4印刷対応" : "—"),
      meta_recommended_tools:
        (override.document_recommended_tools || DEFAULT_DOCUMENT_TOOLS).join(" · ") || "—",
      button_label:
        item.category_id === "tool"
          ? override.button_label || merged.button_label || "無料で使う"
          : merged.button_label || "無料ダウンロード",
      tool_usage: item.category_id === "tool" ? inferToolUsage(item, override) : "",
      tool_output_formats:
        override.tool_output_formats ||
        (item.category_id === "tool" ? DEFAULT_TOOL_OUTPUT_FORMATS.slice() : []),
      tool_setup_steps:
        override.tool_setup_steps ||
        (item.category_id === "tool" ? DEFAULT_TOOL_SETUP_STEPS.slice() : []),
      tool_signup_required:
        override.tool_signup_required || (item.category_id === "tool" ? "不要" : "—"),
      meta_tool_output_formats:
        item.category_id === "tool"
          ? (override.tool_output_formats || DEFAULT_TOOL_OUTPUT_FORMATS).join(" / ")
          : "—",
      meta_tool_signup_required:
        override.tool_signup_required || (item.category_id === "tool" ? "不要" : "—"),
      presentation_slides:
        item.category_id === "presentation" ? resolvePresentationSlides(item, override) : [],
      presentation_usage:
        item.category_id === "presentation" ? inferPresentationUsage(item, override) : "",
      presentation_design_key:
        override.presentation_design_key || (item.category_id === "presentation" ? item.thumbnail_style || "" : ""),
      presentation_export_formats:
        override.presentation_export_formats ||
        (item.category_id === "presentation" ? DEFAULT_PRESENTATION_EXPORT_FORMATS.slice() : []),
      presentation_editable:
        override.presentation_editable || (item.category_id === "presentation" ? "編集可" : "—"),
      presentation_print:
        override.presentation_print || (item.category_id === "presentation" ? "印刷対応" : "—"),
      presentation_recommended_software:
        override.presentation_recommended_software ||
        (item.category_id === "presentation" ? DEFAULT_PRESENTATION_SOFTWARE.slice() : []),
      presentation_usage_scenarios:
        override.presentation_usage_scenarios ||
        (item.category_id === "presentation" ? DEFAULT_PRESENTATION_USAGE_SCENARIOS.slice() : []),
      presentation_setup_steps:
        override.presentation_setup_steps ||
        (item.category_id === "presentation" ? DEFAULT_PRESENTATION_SETUP_STEPS.slice() : []),
      meta_presentation_formats:
        item.category_id === "presentation"
          ? (override.presentation_export_formats || DEFAULT_PRESENTATION_EXPORT_FORMATS).join(" / ")
          : merged.meta_format || "—",
      meta_presentation_editable:
        override.presentation_editable || (item.category_id === "presentation" ? "編集可" : "—"),
      meta_presentation_print:
        override.presentation_print || (item.category_id === "presentation" ? "印刷対応" : "—"),
      meta_presentation_software: (
        override.presentation_recommended_software || DEFAULT_PRESENTATION_SOFTWARE
      ).join(" · "),
    };
  }

  /**
   * Public catalog SSOT is the build-time index only.
   * Dummy ITEMS are QA fixture (`?qa_fixture=1`) when the index is unavailable.
   * Empty index without qa_fixture → fail-closed empty catalog (never fake public stock).
   */
  function isQaFixtureMode() {
    try {
      if (typeof global.location === "undefined" || !global.location) return false;
      return new URLSearchParams(String(global.location.search || "")).get("qa_fixture") === "1";
    } catch (_err) {
      return false;
    }
  }

  let catalogSource = "empty";
  let activeItems = [];

  function resolveActiveCatalog() {
    const idx = global.TASFUL_MATERIALS_INDEX;
    if (idx && Array.isArray(idx.items) && idx.items.length > 0) {
      catalogSource = "index";
      activeItems = idx.items;
    } else if (isQaFixtureMode()) {
      catalogSource = "qa_fixture";
      activeItems = ITEMS;
    } else {
      catalogSource = "empty";
      activeItems = [];
      if (typeof console !== "undefined" && console.info) {
        console.info(
          "[TASFUL Materials] public catalog empty (generated index unavailable; dummy ITEMS fail-closed)",
        );
      }
    }
    if (isQaFixtureMode()) {
      activeItems = applyQaCreatorOverlay(activeItems);
      if (typeof console !== "undefined" && console.info) {
        console.info(
          "[TASFUL Materials] qa_fixture overlay (dummy ITEMS or index copies; not a new Creator DB)",
        );
      }
    }
    if (catalogSource === "empty" && !isQaFixtureMode()) {
      return;
    }
  }

  resolveActiveCatalog();

  function countPublishedInventoryByCategory() {
    const counts = {};
    CATEGORIES.forEach((cat) => {
      counts[cat.id] = 0;
    });
    const idx = global.TASFUL_MATERIALS_INDEX;
    const items = idx && Array.isArray(idx.items) ? idx.items : [];
    items.forEach((item) => {
      const id = item && item.category_id;
      if (id && Object.prototype.hasOwnProperty.call(counts, id)) {
        counts[id] += 1;
      }
    });
    return counts;
  }

  function getActiveItems() {
    return activeItems;
  }

  function getPublicItems() {
    return getActiveItems().filter(isPublicMaterial);
  }

  function normalizeSearchQuery(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ja-JP")
      .slice(0, 200);
  }

  function searchableMetadata(item) {
    const fields = [
      "category",
      "use_case",
      "industry",
      "style",
      "layout",
      "orientation",
      "color_family",
      "season",
      "target",
      "format",
      "size",
      "language",
      "feature",
      "genre",
      "mood",
      "energy",
      "bpm",
      "duration",
      "duration_sec",
      "loopable",
      "instrumental",
      "intensity",
      "license",
      "license_status",
      "provider",
      "generator",
    ];
    return fields.flatMap(function (field) {
      const value = item[field];
      return Array.isArray(value) ? value : [value];
    });
  }

  /** Merge runtime download_count map into the active catalog. Does not restore dummy stock. */
  function mergeRuntimeMetrics(metrics) {
    const map = metrics || {};
    activeItems = getActiveItems().map((item) => {
      const id = item.id;
      const nextCount =
        map[id] != null ? Number(map[id]) || 0 : Number(item.download_count) || 0;
      return { ...item, download_count: nextCount };
    });
    // Recompute popularity_rank from download_count
    const ranked = sortByPopularity(activeItems);
    const rankMap = Object.create(null);
    ranked.forEach((it, idx) => {
      rankMap[it.id] = idx + 1;
    });
    activeItems = activeItems.map((it) => ({
      ...it,
      popularity_rank: rankMap[it.id] || it.popularity_rank || 9999,
    }));
  }

  /** 将来 Supabase 接続時はここを差し替え */
  const repository = {
    async fetchCategories() {
      // TOP / footer: keep existing catalog cards. Video-first empty ids are list chips + URL only.
      return CATEGORIES.filter((c) => !VIDEO_FIRST_EMPTY_CATEGORY_IDS.includes(c.id)).slice();
    },

    async fetchPopularItems(limit = 5) {
      return sortByPopularity(getPublicItems()).slice(0, limit).map(normalizeItem);
    },

    async fetchNewItems(limit = 5) {
      return sortByNewest(getPublicItems()).slice(0, limit).map(normalizeItem);
    },

    async fetchRanking(limit = 5) {
      return sortByPopularity(getPublicItems()).slice(0, limit).map(normalizeItem);
    },

    async searchItems(query) {
      const q = normalizeSearchQuery(query);
      const pool = getPublicItems();
      if (!q) return pool.map(normalizeItem);
      return pool
        .filter((item) => {
          const hay = [
            item.title,
            item.description,
            item.slug,
            ...(item.tags || []),
            ...(item.search_keywords || []),
            ...searchableMetadata(item),
            categoryById(item.category_id).name,
          ]
            .join(" ")
            .normalize("NFKC")
            .toLocaleLowerCase("ja-JP");
          return hay.includes(q);
        })
        .map(normalizeItem);
    },

    async fetchAllItems(sort = "popular") {
      const pool = getPublicItems();
      const list = sort === "newest" ? sortByNewest(pool) : sortByPopularity(pool);
      return list.map(normalizeItem);
    },

    async fetchItemsByCategory(categoryId) {
      return getPublicItems()
        .filter((item) => item.category_id === categoryId)
        .map(normalizeItem);
    },

    async fetchPublicItemsByCreatorId(creatorId, sort = "newest") {
      const id = String(creatorId || "").trim();
      if (!id) return [];
      const pool = getPublicItems().filter((item) => canonicalCreatorId(item) === id);
      const list = sort === "popular" ? sortByPopularity(pool) : sortByNewest(pool);
      return list.map(normalizeItem);
    },

    /** Public inventory counts from materials-index only (never qa_fixture / dummy ITEMS). */
    countPublishedInventoryByCategory() {
      return countPublishedInventoryByCategory();
    },

    async fetchItemBySlug(slug) {
      const raw = getPublicItems().find((item) => item.slug === slug);
      return enrichDetail(raw);
    },

    async fetchRelatedItems(item, limit = 5) {
      if (!item) return [];
      const pool = getPublicItems();
      if (item.category_id === "illustration") {
        return fetchRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "background") {
        return fetchBackgroundRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "icon") {
        return fetchIconRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "code") {
        return fetchCodeRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "document") {
        return fetchDocumentRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "tool") {
        return fetchToolRelatedItemsRanked(item, limit);
      }
      if (item.category_id === "presentation") {
        return fetchPresentationRelatedItemsRanked(item, limit);
      }
      const sameCat = pool.filter((i) => i.category_id === item.category_id && i.slug !== item.slug);
      const others = pool.filter((i) => i.category_id !== item.category_id && i.slug !== item.slug);
      const merged = [...sameCat, ...others];
      return merged.slice(0, limit).map(normalizeItem);
    },

    /** @returns {"index"|"qa_fixture"|"empty"} */
    getCatalogSource() {
      return catalogSource;
    },
  };

  global.TasuMaterialsData = {
    CATEGORIES,
    LIST_PAGE_SIZE,
    LIST_CATEGORY_CHIPS,
    LIST_PRIMARY_CATEGORY_IDS,
    LIST_LEGACY_CATEGORY_IDS,
    LIST_PRIMARY_QUERY_IDS,
    LIST_LEGACY_QUERY_IDS,
    LIST_VALID_QUERY_IDS,
    VIDEO_FIRST_EMPTY_CATEGORY_IDS,
    LIST_UI_LABELS,
    LIST_SIDEBAR_LABELS,
    LIST_SIDEBAR_CATEGORIES,
    countPublishedInventoryByCategory,
    POPULAR_KEYWORDS,
    ITEMS,
    RECOMMENDED_SERVICES,
    QA_CREATOR_PUBLIC_IDS,
    canonicalCreatorId,
    isPublicMaterial,
    creatorPageHref,
    categoryById,
    enrichDetail,
    normalizeSearchQuery,
    formatDateDisplay,
    repository,
    mergeRuntimeMetrics,
    getCatalogSource() {
      return catalogSource;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
