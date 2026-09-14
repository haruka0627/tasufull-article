/**
 * TASFUL Materials — Web / Code / Text genre restructure V1.
 * Taxonomy fold only. Does not delete assets. Does not publish.
 * Mapping is explicit; unknown assets stay UNMAPPED.
 */
export const GENRE_RESTRUCTURE_VERSION = "materials-web-code-text-genre-restructure-v1";

export const WEB_CANONICAL_GENRE_IDS = Object.freeze([
  "hero",
  "header",
  "footer",
  "cta",
  "feature",
  "benefit",
  "about",
  "service",
  "product",
  "pricing",
  "testimonial",
  "casestudy",
  "faq",
  "contact",
  "newsletter",
  "blog",
  "gallery",
  "login",
  "video",
  "download",
  "cart",
  "sale",
  "subscription",
  "dashboard",
  "table",
  "form",
  "card",
  "modal",
  "sidebar",
  "tabs",
  "search",
  "alert",
  "emptystate",
  "chart",
  "corporate",
  "saas",
  "ecommerce",
  "recruitment",
  "restaurant",
  "beauty",
  "medical",
  "education",
  "realestate",
  "creator",
  "eventlp",
]);

export const CODE_CANONICAL_GENRE_IDS = Object.freeze([
  "starter",
  "uicomponent",
  "form",
  "apiclient",
  "auth",
  "database",
  "filemedia",
  "dataproc",
  "searchfilter",
  "automation",
  "email",
  "datetime",
  "llmapi",
  "rag",
  "testing",
  "logging",
  "security",
  "payment",
  "report",
]);

export const TEXT_CANONICAL_GENRE_IDS = Object.freeze([
  "businessemail",
  "sales",
  "customersupport",
  "internalbiz",
  "announcement",
  "adcopy",
  "snspost",
  "weblp",
  "ecproduct",
  "recruitment",
  "blog",
  "profile",
  "press",
  "invitation",
  "thanks",
  "apology",
  "request",
  "seasonal",
  "meeting",
  "report",
  "proposal",
  "faq",
  "survey",
]);

/** Existing Drive folders reused as-is (English Title Case). */
export const WEB_DRIVE_FOLDER_BY_GENRE = Object.freeze({
  hero: "Hero",
  pricing: "Pricing",
  faq: "FAQ",
  dashboard: "Dashboard",
  login: "ログイン・登録",
});

export const CODE_DRIVE_FOLDER_BY_GENRE = Object.freeze({
  starter: "Starter・Boilerplate",
});

export const TEXT_DRIVE_FOLDER_BY_GENRE = Object.freeze({
  businessemail: "ビジネスメール",
  sales: "営業・セールス",
  customersupport: "カスタマーサポート",
  internalbiz: "社内文書・社内連絡",
  announcement: "お知らせ・告知",
  adcopy: "広告・マーケティング",
  snspost: "SNS投稿",
  weblp: "Web・LP文章",
  ecproduct: "EC・商品説明",
  recruitment: "求人・採用",
  blog: "ブログ・記事",
  profile: "プロフィール・自己紹介",
  press: "プレスリリース",
  invitation: "招待・案内",
  thanks: "お礼",
  apology: "お詫び",
  request: "お願い・依頼",
  seasonal: "季節の挨拶",
  meeting: "会議・議事録",
  report: "報告・レポート",
  proposal: "企画・提案",
  faq: "FAQ・ヘルプ",
  survey: "アンケート・レビュー",
});

export const WEB_RELABEL = Object.freeze({});

export const CODE_RELABEL = Object.freeze({
  apiclient: { label_ja: "API・外部連携", label_en: "API / INTEGRATION" },
  auth: { label_ja: "認証・ユーザー管理", label_en: "AUTH / USER" },
  database: { label_ja: "DB・CRUD", label_en: "DB / CRUD" },
  dataproc: { label_ja: "データ処理・変換", label_en: "DATA TRANSFORM" },
  searchfilter: { label_ja: "検索・フィルター", label_en: "SEARCH / FILTER" },
  automation: { label_ja: "自動化・ジョブ", label_en: "AUTOMATION / JOB" },
  datetime: { label_ja: "日時・予約・スケジュール", label_en: "DATETIME / BOOKING" },
  llmapi: { label_ja: "AI・LLM", label_en: "AI / LLM" },
  rag: { label_ja: "RAG・検索AI", label_en: "RAG / SEARCH AI" },
  testing: { label_ja: "テスト・QA", label_en: "TEST / QA" },
  logging: { label_ja: "ログ・監視・エラー処理", label_en: "LOG / MONITOR / ERROR" },
  security: { label_ja: "セキュリティ", label_en: "SECURITY" },
  payment: { label_ja: "決済・EC", label_en: "PAYMENT / EC" },
});

export const TEXT_RELABEL = Object.freeze({
  sales: { label_ja: "営業・セールス", label_en: "SALES" },
  adcopy: { label_ja: "広告・マーケティング", label_en: "ADS / MARKETING" },
  proposal: { label_ja: "企画・提案", label_en: "PROPOSAL" },
});

export const WEB_MOVE_SUBS = Object.freeze({
  form: Object.freeze({
    frm_login: "login",
    frm_signup: "login",
  }),
});

export const CODE_MOVE_SUBS = Object.freeze({
  spreadsheet: Object.freeze({
    ss_export: "report",
  }),
});

export const TEXT_MOVE_SUBS = Object.freeze({});

export const WEB_ABOLISH_INTO = Object.freeze({
  button: Object.freeze({
    default: "card",
    by_sub: Object.freeze({ btn_cta: "cta", btn_social: "login" }),
  }),
  badge: Object.freeze({
    default: "card",
    by_sub: Object.freeze({ bdg_sale: "sale", bdg_status: "alert", bdg_count: "alert" }),
  }),
  banner: Object.freeze({
    default: "sale",
    by_sub: Object.freeze({
      bnr_announce: "alert",
      bnr_maintenance: "alert",
      bnr_cookie: "alert",
      bnr_info: "alert",
      bnr_app: "cta",
    }),
  }),
  pagination: Object.freeze({ default: "header", by_sub: Object.freeze({}) }),
  divider: Object.freeze({ default: "feature", by_sub: Object.freeze({}) }),
  frame: Object.freeze({ default: "card", by_sub: Object.freeze({}) }),
  speech: Object.freeze({ default: "alert", by_sub: Object.freeze({}) }),
  trust: Object.freeze({ default: "about", by_sub: Object.freeze({}) }),
  news: Object.freeze({ default: "blog", by_sub: Object.freeze({}) }),
  ecgrid: Object.freeze({ default: "product", by_sub: Object.freeze({}) }),
});

export const CODE_ABOLISH_INTO = Object.freeze({
  restapi: Object.freeze({ default: "apiclient", by_sub: Object.freeze({}) }),
  webhook: Object.freeze({ default: "apiclient", by_sub: Object.freeze({}) }),
  userprofile: Object.freeze({ default: "auth", by_sub: Object.freeze({}) }),
  fileserver: Object.freeze({ default: "filemedia", by_sub: Object.freeze({}) }),
  jobqueue: Object.freeze({ default: "automation", by_sub: Object.freeze({}) }),
  cli: Object.freeze({ default: "automation", by_sub: Object.freeze({}) }),
  scraping: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  spreadsheet: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  analytics: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  chart: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  textproc: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  ocrdoc: Object.freeze({ default: "dataproc", by_sub: Object.freeze({}) }),
  aivalid: Object.freeze({ default: "testing", by_sub: Object.freeze({}) }),
  errorhandling: Object.freeze({ default: "logging", by_sub: Object.freeze({}) }),
  ecommerce: Object.freeze({ default: "payment", by_sub: Object.freeze({}) }),
  notification: Object.freeze({ default: "email", by_sub: Object.freeze({}) }),
  booking: Object.freeze({ default: "datetime", by_sub: Object.freeze({}) }),
  state: Object.freeze({ default: "uicomponent", by_sub: Object.freeze({}) }),
  config: Object.freeze({ default: "starter", by_sub: Object.freeze({}) }),
  cache: Object.freeze({
    default: "dataproc",
    by_sub: Object.freeze({ ca_debounce: "uicomponent", ca_throttle: "uicomponent" }),
  }),
});

export const TEXT_ABOLISH_INTO = Object.freeze({
  store: Object.freeze({
    default: "snspost",
    by_sub: Object.freeze({
      st_intro: "weblp",
      st_menu: "ecproduct",
      st_hours: "announcement",
      st_reserve: "invitation",
      st_busy: "announcement",
      st_newmenu: "ecproduct",
      st_soldout: "announcement",
      st_temp: "announcement",
      st_takeout: "ecproduct",
      st_delivery: "ecproduct",
      st_review: "survey",
    }),
  }),
  beauty: Object.freeze({
    default: "adcopy",
    by_sub: Object.freeze({
      by_intro: "weblp",
      by_menu: "ecproduct",
      by_book: "invitation",
      by_before: "invitation",
      by_cancel: "announcement",
      by_new: "adcopy",
      by_campaign: "adcopy",
      by_after: "customersupport",
    }),
  }),
  realestate: Object.freeze({
    default: "sales",
    by_sub: Object.freeze({
      re_listing: "sales",
      re_view: "sales",
      re_reply: "customersupport",
      re_work: "announcement",
      re_term: "announcement",
      re_case: "weblp",
      re_reform: "weblp",
      re_area: "weblp",
      re_done: "report",
    }),
  }),
  education: Object.freeze({
    default: "announcement",
    by_sub: Object.freeze({
      ed_recruit: "recruitment",
      ed_course: "weblp",
      ed_class: "announcement",
      ed_parent: "announcement",
      ed_cancel: "announcement",
      ed_hw: "announcement",
      ed_meet: "announcement",
      ed_event: "invitation",
      ed_exam: "announcement",
      ed_pass: "announcement",
      ed_tips: "weblp",
    }),
  }),
  event: Object.freeze({
    default: "invitation",
    by_sub: Object.freeze({
      ev_announce: "announcement",
      ev_recruit: "invitation",
      ev_join: "invitation",
      ev_remind: "invitation",
      ev_day: "invitation",
      ev_caution: "invitation",
      ev_delay: "announcement",
      ev_cancel: "announcement",
      ev_thanks: "thanks",
      ev_survey: "survey",
      ev_next: "announcement",
    }),
  }),
  seminar: Object.freeze({
    default: "invitation",
    by_sub: Object.freeze({
      sm_lead: "adcopy",
      sm_overview: "weblp",
      sm_speaker: "profile",
      sm_merit: "weblp",
      sm_before: "invitation",
      sm_day: "invitation",
      sm_after: "invitation",
      sm_files: "invitation",
      sm_survey: "survey",
      sm_next: "invitation",
    }),
  }),
  youtube: Object.freeze({
    default: "snspost",
    by_sub: Object.freeze({
      yt_title: "snspost",
      yt_desc: "snspost",
      yt_open: "snspost",
      yt_intro: "snspost",
      yt_cta: "adcopy",
      yt_channel: "profile",
      yt_shorts: "snspost",
      yt_live: "announcement",
      yt_next: "snspost",
      yt_comment: "snspost",
      yt_sub: "adcopy",
    }),
  }),
});

function webPart(id, ja, promptEn, useCases = ["app", "saas"]) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(useCases),
    scenes: Object.freeze([
      Object.freeze({
        id: `${id}_part`,
        path_id: `${id.replace(/_/g, "-")}-part`,
        label_ja: ja,
        prompt_en: promptEn,
      }),
    ]),
  });
}

function codeFn(id, ja, promptEn, useCases = ["web", "utility"]) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(useCases),
    scenes: Object.freeze([
      Object.freeze({
        id: `${id}_fn`,
        path_id: `${id.replace(/_/g, "-")}-fn`,
        label_ja: ja,
        prompt_en: promptEn,
      }),
    ]),
  });
}

function cloneGenre(g) {
  const out = { ...g, subgenres: [...(g.subgenres || [])] };
  if (g.allowed_components) out.allowed_components = [...g.allowed_components];
  if (g.allowed_layouts) out.allowed_layouts = [...g.allowed_layouts];
  if (g.allowed_styles) out.allowed_styles = [...g.allowed_styles];
  if (g.languages) out.languages = [...g.languages];
  if (g.runtimes) out.runtimes = [...g.runtimes];
  if (g.asset_forms) out.asset_forms = [...g.asset_forms];
  if (g.frameworks) out.frameworks = [...g.frameworks];
  if (g.text_types) out.text_types = [...g.text_types];
  if (g.tones) out.tones = [...g.tones];
  if (g.lengths) out.lengths = [...g.lengths];
  return out;
}

function freezeGenre(g) {
  const frozen = { ...g };
  if (frozen.allowed_components) frozen.allowed_components = Object.freeze(frozen.allowed_components);
  if (frozen.allowed_layouts) frozen.allowed_layouts = Object.freeze(frozen.allowed_layouts);
  if (frozen.allowed_styles) frozen.allowed_styles = Object.freeze(frozen.allowed_styles);
  if (frozen.languages) frozen.languages = Object.freeze(frozen.languages);
  if (frozen.runtimes) frozen.runtimes = Object.freeze(frozen.runtimes);
  if (frozen.asset_forms) frozen.asset_forms = Object.freeze(frozen.asset_forms);
  if (frozen.frameworks) frozen.frameworks = Object.freeze(frozen.frameworks);
  if (frozen.text_types) frozen.text_types = Object.freeze(frozen.text_types);
  if (frozen.tones) frozen.tones = Object.freeze(frozen.tones);
  if (frozen.lengths) frozen.lengths = Object.freeze(frozen.lengths);
  frozen.subgenres = Object.freeze(frozen.subgenres || []);
  return Object.freeze(frozen);
}

function buildAliasMap(abolish, moveSubs) {
  const aliases = {};
  for (const [oldId, rule] of Object.entries(abolish || {})) {
    aliases[oldId] = rule.default;
  }
  for (const [fromId, moves] of Object.entries(moveSubs || {})) {
    if (!(fromId in aliases)) aliases[fromId] = fromId;
    void moves;
  }
  return aliases;
}

export const WEB_GENRE_ALIAS_TO_CANONICAL = Object.freeze({
  ...buildAliasMap(WEB_ABOLISH_INTO, WEB_MOVE_SUBS),
});

export const CODE_GENRE_ALIAS_TO_CANONICAL = Object.freeze({
  ...buildAliasMap(CODE_ABOLISH_INTO, CODE_MOVE_SUBS),
});

export const TEXT_GENRE_ALIAS_TO_CANONICAL = Object.freeze({
  ...buildAliasMap(TEXT_ABOLISH_INTO, TEXT_MOVE_SUBS),
});

export function resolveGenreAlias(categoryId, genreId) {
  const raw = String(genreId || "").trim();
  if (!raw) return "";
  if (categoryId === "web") return WEB_GENRE_ALIAS_TO_CANONICAL[raw] || raw;
  if (categoryId === "code") return CODE_GENRE_ALIAS_TO_CANONICAL[raw] || raw;
  if (categoryId === "document") return TEXT_GENRE_ALIAS_TO_CANONICAL[raw] || raw;
  return raw;
}

function makeWebLoginGenre(formGenre) {
  const base = formGenre ? cloneGenre(formGenre) : {};
  return {
    id: "login",
    tier: "core",
    demand_weight: 10,
    label_ja: "ログイン・登録",
    label_en: "LOGIN / SIGNUP",
    component_type: base.component_type || "component",
    allowed_components: base.allowed_components || ["component", "section"],
    allowed_layouts: base.allowed_layouts || ["single_column", "centered"],
    allowed_styles: base.allowed_styles || ["minimal", "modern", "tech", "clean", "soft"],
    p0_shortage: false,
    generator: base.generator || "contact",
    subgenres: [
      webPart("lgn_password", "パスワード再設定", "password reset form, preventDefault, no live auth"),
      webPart("lgn_verify", "メール確認", "email verification notice with resend placeholder"),
      webPart("lgn_mfa", "二要素認証", "two-factor code entry UI, no live SMS"),
      webPart("lgn_locked", "アカウントロック", "account locked / unlock request state"),
    ],
  };
}

function makeCodeStarterGenre(configGenre) {
  const base = configGenre ? cloneGenre(configGenre) : {};
  return {
    id: "starter",
    tier: "core",
    demand_weight: 10,
    label_ja: "Starter・Boilerplate",
    label_en: "STARTER / BOILERPLATE",
    p0_shortage: false,
    languages: base.languages || ["javascript", "typescript", "python"],
    runtimes: base.runtimes || ["node", "python"],
    asset_forms: base.asset_forms || ["module", "script", "snippet"],
    frameworks: base.frameworks || ["vanilla", "stdlib"],
    generator_family: "utility",
    subgenres: [
      codeFn("boot_html", "HTMLスターター", "minimal HTML/CSS/JS page skeleton, no CDN", ["web", "utility"]),
      codeFn("boot_node", "Nodeスターター", "Node script entry with env placeholder, no secrets", ["backend", "web"]),
      codeFn("boot_python", "Pythonスターター", "Python module entry with argparse stub", ["automation", "utility"]),
      codeFn("boot_sql", "SQLスターター", "parameterized SQL schema stub, no live DB", ["backend", "web"]),
      codeFn("boot_readme", "README雛形", "README sections as strings, no live URLs", ["utility", "web"]),
    ],
  };
}

export function foldDemandGenres(source, plan) {
  const byId = new Map();
  for (const g of source || []) byId.set(g.id, cloneGenre(g));

  for (const extra of plan.add_genres || []) {
    if (!byId.has(extra.id)) byId.set(extra.id, cloneGenre(extra));
  }

  for (const [fromId, moves] of Object.entries(plan.move_subs || {})) {
    const from = byId.get(fromId);
    if (!from) continue;
    for (const [subId, toId] of Object.entries(moves)) {
      const idx = from.subgenres.findIndex((s) => s.id === subId);
      if (idx < 0) continue;
      const [sg] = from.subgenres.splice(idx, 1);
      const dest = byId.get(toId);
      if (!dest) continue;
      dest.subgenres.push(sg);
    }
  }

  for (const [oldId, rule] of Object.entries(plan.abolish_into || {})) {
    const old = byId.get(oldId);
    if (!old) continue;
    for (const sg of old.subgenres) {
      const destId = (rule.by_sub && rule.by_sub[sg.id]) || rule.default;
      const dest = byId.get(destId);
      if (!dest) continue;
      dest.subgenres.push(sg);
    }
    byId.delete(oldId);
  }

  for (const [id, labels] of Object.entries(plan.relabel || {})) {
    const g = byId.get(id);
    if (!g) continue;
    if (labels.label_ja) g.label_ja = labels.label_ja;
    if (labels.label_en) g.label_en = labels.label_en;
  }

  const ordered = [];
  for (const id of plan.canonical_ids || []) {
    const g = byId.get(id);
    if (g) ordered.push(freezeGenre(g));
  }
  return ordered;
}

export function foldWebDemandGenres(source) {
  const form = (source || []).find((g) => g.id === "form");
  return foldDemandGenres(source, {
    canonical_ids: WEB_CANONICAL_GENRE_IDS,
    abolish_into: WEB_ABOLISH_INTO,
    move_subs: WEB_MOVE_SUBS,
    relabel: WEB_RELABEL,
    add_genres: [makeWebLoginGenre(form)],
  });
}

export function foldCodeDemandGenres(source) {
  const config = (source || []).find((g) => g.id === "config");
  return foldDemandGenres(source, {
    canonical_ids: CODE_CANONICAL_GENRE_IDS,
    abolish_into: CODE_ABOLISH_INTO,
    move_subs: CODE_MOVE_SUBS,
    relabel: CODE_RELABEL,
    add_genres: [makeCodeStarterGenre(config)],
  });
}

export function foldTextDemandGenres(source) {
  return foldDemandGenres(source, {
    canonical_ids: TEXT_CANONICAL_GENRE_IDS,
    abolish_into: TEXT_ABOLISH_INTO,
    move_subs: TEXT_MOVE_SUBS,
    relabel: TEXT_RELABEL,
    add_genres: [],
  });
}

function destForSub(rule, subId) {
  if (!rule) return "";
  if (subId && rule.by_sub && rule.by_sub[subId]) return rule.by_sub[subId];
  return rule.default || "";
}

export function mapLegacyGenre({ categoryId, genre, subcategory } = {}) {
  const oldGenre = String(genre || "").trim();
  const sub = String(subcategory || "").replace(/-/g, "_").trim();
  if (categoryId !== "web" && categoryId !== "code" && categoryId !== "document") {
    return { status: "UNCHANGED", old_genre: oldGenre, new_genre: oldGenre, reason: "out_of_scope" };
  }
  const canonicalIds =
    categoryId === "web" ? WEB_CANONICAL_GENRE_IDS : categoryId === "code" ? CODE_CANONICAL_GENRE_IDS : TEXT_CANONICAL_GENRE_IDS;
  const abolish =
    categoryId === "web" ? WEB_ABOLISH_INTO : categoryId === "code" ? CODE_ABOLISH_INTO : TEXT_ABOLISH_INTO;
  const moveSubs = categoryId === "web" ? WEB_MOVE_SUBS : categoryId === "code" ? CODE_MOVE_SUBS : TEXT_MOVE_SUBS;

  if (!oldGenre) {
    return { status: "UNMAPPED", old_genre: "", new_genre: "", reason: "empty_genre" };
  }

  for (const [fromId, moves] of Object.entries(moveSubs)) {
    if (fromId === oldGenre && sub && moves[sub]) {
      return { status: "MAPPED", old_genre: oldGenre, new_genre: moves[sub], reason: `move_sub:${sub}` };
    }
  }

  if (abolish[oldGenre]) {
    const dest = destForSub(abolish[oldGenre], sub);
    if (!dest) {
      return { status: "UNMAPPED", old_genre: oldGenre, new_genre: "", reason: "abolish_no_dest" };
    }
    return { status: "MAPPED", old_genre: oldGenre, new_genre: dest, reason: sub ? `abolish_sub:${sub}` : "abolish_default" };
  }

  if (canonicalIds.includes(oldGenre)) {
    return { status: "UNCHANGED", old_genre: oldGenre, new_genre: oldGenre, reason: "canonical" };
  }

  return { status: "UNMAPPED", old_genre: oldGenre, new_genre: "", reason: "unknown_genre" };
}

export function webDriveFolderName(genreId) {
  const id = String(genreId || "").trim();
  return WEB_DRIVE_FOLDER_BY_GENRE[id] || id;
}

export function codeDriveFolderName(genreId) {
  const id = String(genreId || "").trim();
  return CODE_DRIVE_FOLDER_BY_GENRE[id] || id;
}

export function textDriveFolderName(genreId) {
  const id = String(genreId || "").trim();
  return TEXT_DRIVE_FOLDER_BY_GENRE[id] || id;
}
