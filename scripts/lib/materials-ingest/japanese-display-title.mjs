/**
 * Materials user-facing display title SSOT.
 * Internal slug / id / filename stay English. Public title is natural Japanese.
 */
import { uniqueTags } from "./common.mjs";

export const JAPANESE_DISPLAY_TITLE_VERSION = "materials-japanese-display-title-v1";

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;
const ASCII_RE = /^[\x20-\x7e]+$/;

export const TYPE_LABELS = Object.freeze({
  sfx: "効果音",
  bgm: "BGM",
  image: "画像",
  illustration: "イラスト",
  background: "背景",
  icon: "アイコン",
  template: "テンプレート",
  presentation: "プレゼンテーション",
  "web-material": "Web素材",
  web: "Web素材",
  "code-material": "コード",
  code: "コード",
});

/** Keep as-is in Japanese titles (common loan / tech terms). */
export const PRESERVE_TERMS = Object.freeze({
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  python: "Python",
  py: "Python",
  sql: "SQL",
  postgresql: "PostgreSQL",
  react: "React",
  web: "Web",
  ui: "UI",
  api: "API",
  bgm: "BGM",
  sfx: "SFX",
  faq: "FAQ",
  hero: "Hero",
  saas: "SaaS",
  kpi: "KPI",
  csv: "CSV",
  json: "JSON",
  sns: "SNS",
  youtube: "YouTube",
  vlog: "Vlog",
  ai: "AI",
  fetch: "fetch",
});

const SKIP_SLUG_TOKENS = new Set([
  "free",
  "v1",
  "v2",
  "v3",
  "q01",
  "q02",
  "q03",
  "q04",
  "q05",
  "q06",
  "q07",
  "q08",
  "q09",
  "q10",
  "smoke",
  "live",
  "e2e",
  "test",
  "naming",
  "size",
  "tpl",
  "pres",
  "illust",
  "output",
  "generic",
  "basic",
  "clean",
  "minimal",
  "wide",
  "mobile",
  "for",
  "with",
  "of",
  "the",
  "and",
  "on",
  "in",
  "to",
  "from",
  "stream",
  "media",
  "symbol",
  "plan",
  "social",
]);

const SKIP_PATH_TOPS = new Set([
  "画像素材",
  "効果音・sfx",
  "効果音",
  "sfx",
  "bgm",
  "bgm素材",
  "web素材",
  "コード",
  "テンプレート",
  "プレゼン",
  "アイコン",
  "イラスト",
  "素材",
]);

const GENERIC_JA = new Set(["シンプル", "標準", "一般", "業務", "素材", "dark", "accordion", "3カラム"]);

/** Single-token English → short Japanese. */
export const SLUG_TOKEN_JA = Object.freeze({
  office: "オフィス",
  hero: "Hero",
  present: "プレゼン",
  stage: "ステージ",
  grad: "グラデーション",
  stream: "配信",
  halloween: "ハロウィン",
  night: "夜",
  summer: "夏",
  sea: "海",
  beach: "ビーチ",
  sky: "空",
  forest: "森",
  nature: "自然",
  river: "川",
  space: "宇宙",
  soft: "やさしい",
  event: "イベント",
  cyber: "サイバー",
  cafe: "カフェ",
  cup: "カップ",
  leaf: "葉",
  cloud: "クラウド",
  cat: "猫",
  dog: "犬",
  bird: "鳥",
  cow: "牛",
  horse: "馬",
  lion: "ライオン",
  tiger: "トラ",
  panda: "パンダ",
  rabbit: "うさぎ",
  monkey: "サル",
  elephant: "ゾウ",
  giraffe: "キリン",
  sheep: "羊",
  whale: "クジラ",
  dolphin: "イルカ",
  fish: "魚",
  insect: "虫",
  dinosaur: "恐竜",
  bear: "クマ",
  apple: "りんご",
  bread: "パン",
  bento: "弁当",
  ramen: "ラーメン",
  sushi: "寿司",
  yakiniku: "焼肉",
  desserts: "スイーツ",
  drinks: "ドリンク",
  fruits: "フルーツ",
  vegetables: "野菜",
  meat: "肉",
  seafood: "海鮮",
  pumpkin: "かぼちゃ",
  lantern: "提灯",
  laptop: "ノートPC",
  train: "電車",
  rocket: "ロケット",
  house: "家",
  apartment: "マンション",
  building: "ビル",
  blueprint: "設計図",
  carpenter: "大工",
  demolition: "解体",
  plumbing: "配管",
  scaffolding: "足場",
  surveying: "測量",
  painting: "塗装",
  contract: "契約",
  hiring: "採用",
  interview: "面接",
  recruitment: "求人",
  management: "マネジメント",
  marketing: "マーケティング",
  meeting: "会議",
  presentation: "プレゼン",
  sales: "営業",
  startup: "スタートアップ",
  teamwork: "チームワーク",
  automation: "自動化",
  chat: "チャット",
  comment: "コメント",
  cyborg: "サイボーグ",
  drone: "ドローン",
  follow: "フォロー",
  hologram: "ホログラム",
  like: "いいね",
  mecha: "メカ",
  notification: "通知",
  notify: "通知",
  pop: "ポップ",
  whoosh: "ウーシュ",
  impact: "インパクト",
  heavy: "重め",
  short: "短い",
  telop: "テロップ",
  text: "テキスト",
  door: "ドア",
  closing: "閉まる",
  sound: "音",
  invoice: "請求書",
  quote: "見積書",
  estimate: "見積書",
  banner: "バナー",
  thumb: "サムネイル",
  minutes: "議事録",
  report: "報告書",
  company: "会社",
  profile: "案内",
  pitch: "ピッチ",
  proposal: "提案書",
  dashboard: "ダッシュボード",
  dash: "ダッシュボード",
  pricing: "料金プラン",
  faq: "FAQ",
  reader: "読み込み",
  validator: "検証",
  retry: "リトライ",
  filter: "絞り込み",
  sort: "並べ替え",
  pagination: "ページネーション",
  email: "メール",
  file: "ファイル",
  calendar: "カレンダー",
  interface: "UI",
  airplane: "飛行機",
  ambulance: "救急車",
  guitar: "ギター",
  acoustic: "アコースティック",
  alien: "エイリアン",
  football: "アメフト",
  american: "アメリカン",
  books: "本",
  autumn: "秋",
  maple: "もみじ",
  baby: "ベビー",
  bottle: "ボトル",
  backpack: "リュック",
  bamboo: "竹",
  bank: "銀行",
  bar: "棒",
  chart: "グラフ",
  birthday: "バースデー",
  cake: "ケーキ",
  bluetooth: "Bluetooth",
  bouquet: "花束",
  roses: "バラ",
  briefcase: "バッグ",
  business: "ビジネス",
  camera: "カメラ",
  candy: "キャンディ",
  cane: "ケイン",
  computer: "パソコン",
  keyboard: "キーボード",
  gaming: "ゲーム",
  crown: "王冠",
  disaster: "防災",
  shelter: "避難所",
  accounting: "会計",
  abstract: "抽象",
  technology: "テクノロジー",
  logo: "ロゴ",
  black: "黒",
  plan: "図面",
  social: "SNS",
  media: "メディア",
  gemstones: "宝石",
  man: "人物",
  flight: "飛行",
  face: "顔",
  stalk: "茎",
  corporate: "企業",
  future: "未来",
  tech: "テック",
  stylish: "おしゃれ",
  product: "商品",
  upbeat: "明るい",
  simple: "シンプル",
  three: "3",
  column: "カラム",
  dark: "ダーク",
  blue: "ブルー",
  modern: "モダン",
  sns: "SNS",
  biz: "ビジネス",
  food: "食べ物",
  season: "季節",
  ui: "UI",
  icon: "アイコン",
  js: "JavaScript",
  py: "Python",
  sql: "SQL",
  ts: "TypeScript",
  code: "コード",
  web: "Web",
  csv: "CSV",
  json: "JSON",
  fetch: "fetch",
  python: "Python",
  postgresql: "PostgreSQL",
});

const PHRASE_JA = Object.freeze([
  [["door", "closing"], "ドアが閉まる"],
  [["soft", "notification"], "やさしい通知"],
  [["office", "hero"], "オフィスのHero"],
  [["summer", "beach"], "夏のビーチ"],
  [["summer", "sea"], "夏の海"],
  [["cafe", "cup"], "カフェカップ"],
  [["csv", "reader"], "CSV読み込み"],
  [["email", "validator"], "メール検証"],
  [["fetch", "retry"], "fetchリトライ"],
  [["filter", "sort"], "絞り込みと並べ替え"],
  [["json", "file"], "JSONファイル"],
  [["company", "profile"], "会社案内"],
  [["startup", "pitch"], "スタートアップピッチ"],
  [["bar", "chart"], "棒グラフ"],
  [["maple", "leaf"], "もみじ"],
  [["birthday", "cake"], "バースデーケーキ"],
  [["black", "cat"], "黒猫"],
  [["calendar", "interface"], "カレンダーUI"],
  [["acoustic", "guitar"], "アコースティックギター"],
  [["american", "football"], "アメフト"],
  [["baby", "bottle"], "哺乳瓶"],
  [["business", "briefcase"], "ビジネスバッグ"],
  [["autumn", "maple"], "秋のもみじ"],
  [["bird", "flight"], "飛ぶ鳥"],
  [["bouquet", "roses"], "バラの花束"],
  [["notify", "pop"], "ポップな通知"],
  [["text", "pop"], "テロップのポップ"],
  [["whoosh", "short"], "短いウーシュ"],
  [["impact", "heavy"], "重めのインパクト"],
  [["heavy", "impact"], "重めのインパクト"],
  [["telop", "in"], "テロップ登場"],
  [["pricing", "three", "column"], "3カラム料金"],
  [["dashboard", "kpi"], "KPIダッシュボード"],
]);

export function looksJapanese(text) {
  return CJK_RE.test(String(text || ""));
}

export function isEnglishDisplayTitle(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (looksJapanese(s)) return false;
  return ASCII_RE.test(s);
}

export function typeLabel(assetType) {
  const key = String(assetType || "").toLowerCase();
  return TYPE_LABELS[key] || "素材";
}

function normalizeAssetType(assetType, categoryId) {
  const a = String(assetType || categoryId || "").toLowerCase();
  if (a === "web") return "web-material";
  if (a === "code") return "code-material";
  return a;
}

export function slugTokens(slug) {
  return String(slug || "")
    .toLowerCase()
    .replace(/-20\d{6}(?:-\d{3})?$/, "")
    .replace(/-q\d{2}(?:-20\d{6})?/, "")
    .replace(/-\d{3}$/, "")
    .split(/[-_]+/)
    .map((t) => t.trim())
    .filter((t) => t && !SKIP_SLUG_TOKENS.has(t) && !/^\d{3,8}$/.test(t));
}

export function englishSearchKeywords(input = {}) {
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    const v = String(raw || "").trim();
    if (!v || v.length < 2) return;
    if (CJK_RE.test(v) && !/[A-Za-z]/.test(v)) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    if (SKIP_SLUG_TOKENS.has(key)) return;
    if (/^\d+$/.test(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (const t of slugTokens(input.slug)) add(t);
  const title = String(input.title || "");
  if (isEnglishDisplayTitle(title)) {
    for (const w of title.split(/[\s/_-]+/)) add(w);
  }
  const prompt = String(input.prompt || input.description || "");
  if (prompt && !looksJapanese(prompt)) {
    for (const w of prompt.split(/[^A-Za-z0-9]+/)) {
      if (w.length >= 3 && w.length <= 16) add(w.toLowerCase());
    }
  }
  return out.slice(0, 12);
}

function shortenJapanese(text, max = 32) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/（[^）]*live e2e[^）]*）/gi, "").replace(/\([^)]*live e2e[^)]*\)/gi, "");
  s = s.replace(/（テスト[^）]*）/g, "").trim();
  s = s.split(/[。．\n]/)[0].trim();
  s = s.split(/,\s*(?:no people|isolated|wide |clean |empty |simple flat)/i)[0].trim();
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const idx = Math.max(cut.lastIndexOf("の"), cut.lastIndexOf("な"), cut.lastIndexOf("向け"));
  if (idx >= 8) return cut.slice(0, idx);
  return cut.replace(/[、,\s]+$/g, "");
}

function isTypeSlashFallback(text) {
  return /^(image|illustration|icon|background|sfx|bgm|template|presentation|web-material|code-material|web|code)\s*\/\s*.+/i.test(
    String(text || "").trim(),
  );
}

function japaneseFromPath(categoryPath, category, subcategory, tags) {
  const segs = [];
  const push = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return;
    if (SKIP_PATH_TOPS.has(s.toLowerCase())) return;
    if (GENERIC_JA.has(s)) return;
    if (!looksJapanese(s) && !PRESERVE_TERMS[s.toLowerCase()]) {
      const mapped = SLUG_TOKEN_JA[s.toLowerCase()];
      if (mapped) {
        if (!segs.includes(mapped)) segs.push(mapped);
      }
      return;
    }
    if (!segs.includes(s)) segs.push(s);
  };
  if (Array.isArray(categoryPath)) {
    for (const p of categoryPath) push(p);
  }
  push(category);
  push(subcategory);
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (looksJapanese(t) && !GENERIC_JA.has(t)) push(t);
    }
  }
  return segs;
}

function mapSlugPhrases(tokens, assetType) {
  const used = new Set();
  const parts = [];
  const typeSkip = new Set(
    {
      sfx: ["sfx", "sound"],
      bgm: ["bgm"],
      icon: ["icon"],
      illustration: ["illust", "illustration"],
      image: ["image"],
      background: ["background", "bg"],
      template: ["template", "tpl"],
      presentation: ["presentation", "pres"],
      "web-material": ["web"],
      "code-material": ["code"],
    }[assetType] || [],
  );
  for (const [keys, ja] of PHRASE_JA) {
    if (keys.every((k) => tokens.includes(k))) {
      parts.push(ja);
      keys.forEach((k) => used.add(k));
    }
  }
  for (const t of tokens) {
    if (used.has(t) || typeSkip.has(t)) continue;
    if (PRESERVE_TERMS[t] && !typeSkip.has(t)) {
      parts.push(PRESERVE_TERMS[t]);
      continue;
    }
    if (SLUG_TOKEN_JA[t]) parts.push(SLUG_TOKEN_JA[t]);
  }
  return parts;
}

function composeTitle(parts, assetType) {
  const type = typeLabel(assetType);
  const unique = [];
  for (const p of parts) {
    if (p && !unique.includes(p)) unique.push(p);
  }
  let subject;
  if (unique.length <= 2) {
    subject = unique.join("の");
  } else {
    subject = `${unique[0]}の${unique.slice(1).join("")}`;
  }
  subject = subject.replace(/のの/g, "の").replace(/^の|の$/g, "");

  if (!subject) return type;

  if (subject.includes(type) || (type === "効果音" && /音$/.test(subject))) {
    return subject;
  }

  if (assetType === "sfx" || assetType === "bgm") {
    if (/音$/.test(subject)) return subject;
    if (assetType === "bgm") return subject.endsWith("BGM") ? subject : `${subject}BGM`;
    if (/(通知|テロップ|ポップ|ウーシュ)/.test(subject)) return `${subject}音`;
    return `${subject}効果音`;
  }
  if (assetType === "background") return `${subject}背景`.replace(/背景背景$/, "背景");
  if (assetType === "web-material" || assetType === "web") {
    if (/(セクション|アコーディオン|ダッシュボード|料金)/.test(subject)) return subject;
    return `${subject}セクション`;
  }
  if (assetType === "code-material" || assetType === "code") {
    if (/(スニペット|コード|読み込み|検証|リトライ)/.test(subject)) return subject;
    return `${subject}スニペット`;
  }
  if (assetType === "template") {
    return subject.includes("テンプレート") ? subject : `${subject}テンプレート`;
  }
  if (assetType === "presentation") {
    if (/(スライド|プレゼン|資料|ピッチ|提案)/.test(subject)) {
      return subject.includes("スライド") || subject.includes("資料") ? subject : `${subject}スライド`;
    }
    return `${subject}スライド`;
  }
  if (assetType === "icon") return subject.includes("アイコン") ? subject : `${subject}のアイコン`;
  if (assetType === "illustration") return subject.includes("イラスト") ? subject : `${subject}のイラスト`;
  if (assetType === "image") return subject.includes("画像") ? subject : `${subject}の画像`;
  return `${subject}${type}`;
}

function pickJapaneseSource(text) {
  const s = String(text || "").trim();
  if (!s || !looksJapanese(s) || isTypeSlashFallback(s)) return "";
  return shortenJapanese(s);
}

/**
 * Resolve a natural Japanese display title.
 * Never returns title-cased English slug.
 */
export function resolveJapaneseDisplayTitle(input = {}) {
  const assetType = normalizeAssetType(input.assetType || input.asset_type, input.categoryId || input.category_id);
  const existing = String(input.title || "").trim();
  if (
    !input.ignoreTitle &&
    existing &&
    looksJapanese(existing) &&
    !isEnglishDisplayTitle(existing)
  ) {
    return shortenJapanese(existing, 36);
  }

  const fromPrompt = pickJapaneseSource(input.prompt);
  if (fromPrompt) return fromPrompt;

  const fromDesc = pickJapaneseSource(input.description);
  if (fromDesc) return fromDesc;

  const pathParts = japaneseFromPath(
    input.categoryPath || input.category_path,
    input.category,
    input.subcategory,
    input.tags,
  );
  const tokens = slugTokens(input.slug || input.packageSlug);
  const slugParts = mapSlugPhrases(tokens, assetType);
  const lang = String(input.languageLabel || input.language || "").trim();
  const parts = [];
  if (lang && PRESERVE_TERMS[lang.toLowerCase()]) parts.push(PRESERVE_TERMS[lang.toLowerCase()]);
  else if (lang && looksJapanese(lang)) parts.push(lang);
  else if (lang && /^(JavaScript|TypeScript|Python|SQL|HTML|CSS|React)$/i.test(lang)) parts.push(lang);

  if (slugParts.length) parts.push(...slugParts);
  else parts.push(...pathParts);

  if (!parts.length && pathParts.length) parts.push(...pathParts);

  const title = composeTitle(parts, assetType);
  return title || typeLabel(assetType);
}

export function applyJapaneseDisplayTitleToItem(item = {}, options = {}) {
  const title = resolveJapaneseDisplayTitle({
    title: item.title,
    prompt: item.prompt || item.description,
    description: item.description,
    categoryPath: item.categoryPath || item.category_path,
    category: item.category,
    subcategory: item.subcategory,
    tags: item.tags,
    assetType: item.asset_type || item.category_id,
    categoryId: item.category_id,
    slug: item.slug,
    languageLabel: item.languageLabel || item.language_label,
    ignoreTitle: options.ignoreTitle === true,
  });
  const searchKeywords = englishSearchKeywords({
    slug: item.slug,
    title: item.title,
    prompt: item.prompt,
    description: item.description,
  });
  const tags = uniqueTags([...(item.tags || []), ...searchKeywords]);
  return {
    ...item,
    title,
    tags,
    search_keywords: searchKeywords,
  };
}

export const MATERIALS_GENERATION_DISPLAY_TITLE_JA_VERSION = "materials-generation-display-title-ja-v1";

const SERIAL_FILLER_RE =
  /^(素材|BGM|SFX|効果音|アイコン|イラスト|画像)\s*[0-9０-９]{1,4}$/i;
const SERIAL_EN_RE = /^(BGM|SFX|Icon|Material)\s*0*\d+$/i;
const SERIAL_TAIL_RE = /\s(0?\d{1,3})$/;

export function isSerialFillerTitle(title) {
  const t = String(title || "").trim();
  if (!t) return true;
  if (SERIAL_FILLER_RE.test(t) || SERIAL_EN_RE.test(t)) return true;
  if (/^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,5}\s+\d{1,3}$/.test(t)) return true;
  return false;
}

export function isMojiBake(title) {
  return /[\uFFFD\uFFFE\uFFFF]|Ã.|Â.|ï¿½/.test(String(title || ""));
}

/**
 * User-facing generation titles must be natural Japanese.
 * Prompts / slug / asset_id stay as-is.
 */
export function validateMaterialsDisplayTitleJa(title, options = {}) {
  const t = String(title || "").trim();
  const reasons = [];
  if (!t) reasons.push("empty_title");
  if (isMojiBake(t)) reasons.push("mojibake");
  if (isSerialFillerTitle(t)) reasons.push("serial_filler");
  if (isEnglishDisplayTitle(t) && !looksJapanese(t)) reasons.push("english_display_title");
  const genreLabels = options.genreLabels || [];
  if (genreLabels.some((g) => g && t === String(g).trim())) reasons.push("genre_name_as_title");
  const mechanical = /向けインストBGM$/.test(t);
  if (mechanical) reasons.push("mechanical_genre_template");
  const used = options.used;
  if (used instanceof Set && used.has(t)) reasons.push("duplicate_title");
  return { ok: reasons.length === 0, reasons, title: t };
}

export function appendDisplayTitleJaGateReasons(candidate, extra = {}) {
  const title = String(candidate.title || candidate.title_ja || candidate.display_title || "").trim();
  if (!title) return [];
  const v = validateMaterialsDisplayTitleJa(title, extra);
  return v.ok ? [] : v.reasons.map((r) => `display_title:${r}`);
}

/** Curated unique Japanese display titles for existing private inventory (no regen). */
export const PRIVATE_INVENTORY_DISPLAY_TITLES = Object.freeze({
  "priv-sfx-cinematic-deep_boom-01": "重厚なシネマティック・インパクト",
  "priv-sfx-crowd-applause-01": "室内のやさしい拍手",
  "priv-sfx-crowd-cheer-02": "スタジオ観客の短い歓声",
  "priv-sfx-crowd-gasp-03": "驚きに息をのむ音",
  "priv-sfx-crowd-laugh-04": "コミカルな短い笑い声",
  "priv-sfx-crowd-crowd_reaction-05": "会場がざわめく反応",
  "priv-sfx-crowd-small_audience-06": "少人数のリアクション",
  "priv-sfx-digital-glitch-01": "デジタルなグリッチノイズ",
  "priv-sfx-environment-rain-01": "窓を打つやさしい雨音",
  "priv-sfx-environment-wind-02": "木の葉を揺らすそよ風",
  "priv-sfx-game-level_up-01": "明るいレベルアップのチャイム",
  "priv-sfx-game-coin-02": "コイン取得の軽いピン音",
  "priv-sfx-game-item_get-03": "きらめくアイテム取得音",
  "priv-sfx-game-achievement-04": "実績解除の短いファンファーレ",
  "priv-sfx-game-menu-05": "やさしいメニュー選択クリック",
  "priv-sfx-physical-water-01": "シンクに跳ねる水しぶき",
  "priv-sfx-physical-fire-02": "小さく弾ける火の音",
  "priv-sfx-physical-thunder-03": "遠くで鳴る雷鳴",
  "priv-sfx-physical-glass-04": "薄いガラスのカチンという音",
  "priv-sfx-physical-metal-05": "金属が触れ合う短い打撃音",
  "priv-bgm-ambient-01": "静かな夜のアンビエンス",
  "priv-bgm-cinematic-01": "物語を運ぶシネマティックBGM",
  "priv-bgm-cooking-01": "料理が進むあたたかいBGM",
  "priv-bgm-cool-01": "都会的なクール・ビート",
  "priv-bgm-cute-01": "おもちゃピアノのかわいいメロディ",
  "priv-bgm-emotional-01": "心に残る感動のメロディ",
  "priv-bgm-game-01": "軽快なゲーム・アドベンチャー",
  "priv-bgm-lofi-01": "ほこりっぽいLo-fiの昼下がり",
  "priv-bgm-stylish-01": "おしゃれなラウンジ・カフェBGM",
  "priv-bgm-tense-01": "低音が脈打つ緊張のBGM",
  "priv-bgm-travel-01": "旅の景色が広がるアコースティック",
  "priv-icon-a11y-a11y_wheelchair": "車椅子マークの案内アイコン",
  "priv-icon-a11y-a11y_hearing": "聴覚サポートのアイコン",
  "priv-icon-a11y-a11y_vision": "視覚サポートのアイコン",
  "priv-icon-a11y-a11y_access": "アクセシビリティ案内アイコン",
  "priv-icon-a11y-a11y_sign": "手話コミュニケーションのアイコン",
  "priv-icon-a11y-a11y_device": "支援機器を示すアイコン",
  "priv-icon-action-act_add": "項目を追加するアイコン",
  "priv-icon-action-act_remove": "項目を取り除くアイコン",
  "priv-icon-action-act_edit": "内容を編集するアイコン",
  "priv-icon-action-act_delete": "データを削除するアイコン",
  "priv-icon-action-act_save": "変更を保存するアイコン",
  "priv-icon-action-act_copy": "内容をコピーするアイコン",
  "priv-icon-calendar-cal_calendar": "日付を選ぶカレンダーアイコン",
  "priv-icon-calendar-cal_clock": "時刻を示す時計アイコン",
  "priv-icon-calendar-cal_timer": "経過を測るタイマーアイコン",
  "priv-icon-calendar-cal_alarm": "時刻を知らせるアラームアイコン",
  "priv-icon-calendar-cal_schedule": "予定を並べるスケジュールアイコン",
  "priv-icon-calendar-cal_deadline": "期限を示す締め切りアイコン",
});

const SFX_SUBCATEGORY_TITLES = Object.freeze({
  deep_boom: "重厚なシネマティック・インパクト",
  applause: "室内のやさしい拍手",
  cheer: "スタジオ観客の短い歓声",
  gasp: "驚きに息をのむ音",
  laugh: "コミカルな短い笑い声",
  crowd_reaction: "会場がざわめく反応",
  small_audience: "少人数のリアクション",
  glitch: "デジタルなグリッチノイズ",
  rain: "窓を打つやさしい雨音",
  wind: "木の葉を揺らすそよ風",
  level_up: "明るいレベルアップのチャイム",
  coin: "コイン取得の軽いピン音",
  item_get: "きらめくアイテム取得音",
  achievement: "実績解除の短いファンファーレ",
  menu: "やさしいメニュー選択クリック",
  water: "シンクに跳ねる水しぶき",
  fire: "小さく弾ける火の音",
  thunder: "遠くで鳴る雷鳴",
  glass: "薄いガラスのカチンという音",
  metal: "金属が触れ合う短い打撃音",
});

const BGM_GENRE_TITLES = Object.freeze({
  brightpop: "朝のポジティブ・ポップ",
  cafe: "おしゃれなカフェの午後",
  fresh: "爽やかに進む前向きBGM",
  relax: "落ち着くLo-fiの余白",
  emotional: "胸に残るエモーショナル",
  comic: "軽快で楽しいコミカルBGM",
  cute: "やさしく弾むかわいいメロディ",
  cool: "都会的なクール・ビート",
  cinematic: "壮大なシネマティックのうねり",
  tense: "息をのむサスペンス",
  horror: "肌がざわつくホラーの気配",
  japanese: "和の香りがする調べ",
  game: "軽快なゲーム・アドベンチャー",
  corporate: "朝のポジティブ・コーポレート",
  youtube: "配信が続くYouTube向けBGM",
  shortsns: "短尺で映えるSNS向けBGM",
  ambient: "静かな夜のアンビエンス",
  cooking: "料理が進むあたたかいBGM",
  lofi: "ほこりっぽいLo-fiの昼下がり",
  stylish: "おしゃれなラウンジ・カフェBGM",
  travel: "旅の景色が広がるアコースティック",
});

const ICON_FUNCTION_TITLES = Object.freeze({
  a11y_wheelchair: "車椅子マークの案内アイコン",
  a11y_hearing: "聴覚サポートのアイコン",
  a11y_vision: "視覚サポートのアイコン",
  a11y_access: "アクセシビリティ案内アイコン",
  a11y_sign: "手話コミュニケーションのアイコン",
  a11y_device: "支援機器を示すアイコン",
  act_add: "項目を追加するアイコン",
  act_remove: "項目を取り除くアイコン",
  act_edit: "内容を編集するアイコン",
  act_delete: "データを削除するアイコン",
  act_save: "変更を保存するアイコン",
  act_copy: "内容をコピーするアイコン",
  cal_calendar: "日付を選ぶカレンダーアイコン",
  cal_clock: "時刻を示す時計アイコン",
  cal_timer: "経過を測るタイマーアイコン",
  cal_alarm: "時刻を知らせるアラームアイコン",
  cal_schedule: "予定を並べるスケジュールアイコン",
  cal_deadline: "期限を示す締め切りアイコン",
});

function uniquifyTitle(title, used) {
  let out = String(title || "").trim();
  if (!(used instanceof Set) || !used.has(out)) return out;
  const extras = ["別テイク", "もう一つの", "控えめな", "はっきりした"];
  for (const extra of extras) {
    const cand = extra + out;
    if (!used.has(cand)) return cand;
  }
  return `${out}・別アレンジ`;
}

/**
 * Build a public Japanese display title for newly generated assets.
 * Does not rewrite prompts, slugs, or asset_id.
 */
export function composeGenerationDisplayTitleJa(input = {}) {
  const category = String(input.category || input.assetType || "").toLowerCase();
  const assetId = String(input.asset_id || "");
  if (assetId && PRIVATE_INVENTORY_DISPLAY_TITLES[assetId]) {
    return uniquifyTitle(PRIVATE_INVENTORY_DISPLAY_TITLES[assetId], input.used);
  }
  let title = "";
  if (category === "sfx") {
    title = SFX_SUBCATEGORY_TITLES[input.subcategory] || "";
    if (!title && input.subcategory_label_ja) {
      const mood = input.intensity === "soft" ? "やさしい" : input.intensity === "strong" ? "はっきりした" : "";
      title = mood ? `${mood}${input.subcategory_label_ja}` : `${input.subcategory_label_ja}の効果音`;
    }
    if (!title) title = "使いやすい効果音";
  } else if (category === "bgm") {
    title = input.concept_title_ja || BGM_GENRE_TITLES[input.genre] || "";
    if (!title && input.genre_label_ja) title = `${input.genre_label_ja}の雰囲気が伝わるBGM`;
    if (!title) title = "映像に乗せやすいBGM";
  } else if (category === "icon") {
    title = ICON_FUNCTION_TITLES[input.function_id || input.subcategory] || "";
    if (!title && input.function_label_ja) title = `${input.function_label_ja}を示すアイコン`;
    if (!title) title = "分かりやすいUIアイコン";
  } else {
    title = resolveJapaneseDisplayTitle(input);
  }
  return uniquifyTitle(title, input.used);
}

const DISPLAY_TITLE_KEYS = Object.freeze(["title", "title_ja", "display_title"]);

/**
 * Title-only patch for existing private-inventory sidecars.
 * Does not touch prompt, seed, model, hashes, or files.
 */
export function applyPrivateInventoryDisplayTitleJa(meta = {}) {
  const id = String(meta.asset_id || "").trim();
  const ja = PRIVATE_INVENTORY_DISPLAY_TITLES[id];
  if (!id) return { ok: false, reason: "missing_asset_id" };
  if (!ja) return { ok: false, reason: "unknown_asset_id", asset_id: id };
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(meta)) {
    if (k === "title" || k === "display_title") continue;
    if (k === "title_ja") {
      out.title = ja;
      out.title_ja = ja;
      out.display_title = ja;
      placed = true;
      continue;
    }
    out[k] = v;
  }
  if (!placed) {
    out.title = ja;
    out.title_ja = ja;
    out.display_title = ja;
  }
  return {
    ok: true,
    asset_id: id,
    previous_title_ja: String(meta.title_ja || meta.title || ""),
    display_title: ja,
    metadata: out,
  };
}

export function stripDisplayTitleFields(meta = {}) {
  const out = { ...meta };
  for (const k of DISPLAY_TITLE_KEYS) delete out[k];
  return out;
}
