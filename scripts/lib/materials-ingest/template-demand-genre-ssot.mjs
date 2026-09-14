/**
 * Template Demand SSOT V2 — existing Template-AutoGenerator catalog + public print keywords.
 * Does not invent a parallel genre tree. Invoice/estimate/etc. stay catalog IDs.
 */
export const TEMPLATE_DEMAND_GENRE_SSOT_VERSION = "materials-template-demand-coverage-diversity-v2";

export const TEMPLATE_LAYOUTS = Object.freeze({
  classic: { id: "classic", slug: "lyclassic", label_ja: "クラシック" },
  stacked: { id: "stacked", slug: "lystack", label_ja: "スタック" },
  split: { id: "split", slug: "lysplit", label_ja: "スプリット" },
  compact: { id: "compact", slug: "lycompact", label_ja: "コンパクト" },
});

export const TEMPLATE_STYLES = Object.freeze({
  corporate: { id: "corporate", slug: "stcorp", label_ja: "コーポレート" },
  minimal: { id: "minimal", slug: "stmin", label_ja: "ミニマル" },
  bold: { id: "bold", slug: "stbold", label_ja: "ボールド" },
  airy: { id: "airy", slug: "stairy", label_ja: "余白多" },
});

export const TEMPLATE_ORIENTATIONS = Object.freeze({
  portrait: { id: "portrait", slug: "orport", label_ja: "縦" },
  landscape: { id: "landscape", slug: "orland", label_ja: "横" },
});

export const TEMPLATE_USE_CASES = Object.freeze({
  business: { id: "business", label_ja: "ビジネス資料" },
  retail: { id: "retail", label_ja: "店舗販促" },
  recruitment: { id: "recruitment", label_ja: "採用" },
  event: { id: "event", label_ja: "イベント" },
  youtube: { id: "youtube", label_ja: "YouTube" },
});

/** Existing categories.json ids + public print families already in demand/popular keywords. */
export const TEMPLATE_FAMILIES = Object.freeze([
  { id: "invoice", label_ja: "請求書", generator: "invoice_xlsx", format: "xlsx", drive: "テンプレート/請求書", match: ["請求書"], use_cases: ["business"] },
  { id: "estimate", label_ja: "見積書", generator: "estimate_xlsx", format: "xlsx", drive: "テンプレート/見積書", match: ["見積書", "見積"], use_cases: ["business"] },
  { id: "receipt", label_ja: "領収書", generator: "receipt_xlsx", format: "xlsx", drive: "テンプレート/領収書", match: ["領収書"], use_cases: ["business"] },
  { id: "delivery", label_ja: "納品書", generator: "delivery_xlsx", format: "xlsx", drive: "テンプレート/納品書", match: ["納品書"], use_cases: ["business"] },
  { id: "purchase_order", label_ja: "発注書", generator: "purchase_order_xlsx", format: "xlsx", drive: "テンプレート/発注書", match: ["発注書"], use_cases: ["business"] },
  { id: "schedule", label_ja: "スケジュール", generator: "schedule_xlsx", format: "xlsx", drive: "テンプレート/スケジュール", match: ["スケジュール"], use_cases: ["business"] },
  { id: "tasklist", label_ja: "タスクリスト", generator: "tasklist_xlsx", format: "xlsx", drive: "テンプレート/タスク", match: ["タスク"], use_cases: ["business"] },
  { id: "minutes", label_ja: "議事録", generator: "minutes_docx", format: "docx", drive: "テンプレート/議事録", match: ["議事録"], use_cases: ["business"] },
  { id: "report", label_ja: "報告書", generator: "report_docx", format: "docx", drive: "テンプレート/報告書", match: ["報告書"], use_cases: ["business"] },
  { id: "checklist", label_ja: "チェックリスト", generator: "checklist_docx", format: "docx", drive: "テンプレート/チェックリスト", match: ["チェックリスト"], use_cases: ["business"] },
  { id: "business_card", label_ja: "名刺", generator: "business_card_html", format: "html", drive: "テンプレート/名刺", match: ["名刺"], use_cases: ["business", "retail"] },
  { id: "flyer", label_ja: "チラシ", generator: "flyer_html", format: "html", drive: "テンプレート/チラシ", match: ["チラシ"], use_cases: ["retail", "recruitment", "event"] },
  { id: "pop", label_ja: "POP", generator: "pop_html", format: "html", drive: "テンプレート/POP", match: ["POP", "ポップ"], use_cases: ["retail", "event"] },
  { id: "banner", label_ja: "バナー", generator: "banner_html", format: "html", drive: "テンプレート/バナー", match: ["バナー"], use_cases: ["retail", "event"] },
  { id: "youtube_thumb", label_ja: "YouTubeサムネ", generator: "thumb_html", format: "html", drive: "テンプレート/YouTubeサムネ", match: ["YouTubeサムネ", "サムネイル"], use_cases: ["youtube"] },
]);

const FAMILY_BY_ID = new Map(TEMPLATE_FAMILIES.map((f) => [f.id, f]));

export function getTemplateFamily(id) {
  return FAMILY_BY_ID.get(String(id || "")) || null;
}

export function templateSpecFingerprint(spec) {
  return [
    spec?.genre || spec?.family,
    spec?.layout_type || spec?.layout,
    spec?.style,
    spec?.orientation,
    spec?.use_case,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function buildTemplateJapaneseTitle(spec) {
  const fam = getTemplateFamily(spec.genre || spec.family);
  const label = fam?.label_ja || spec.genre || "テンプレート";
  const styleJa = TEMPLATE_STYLES[spec.style]?.label_ja;
  const layoutJa = TEMPLATE_LAYOUTS[spec.layout_type]?.label_ja;
  const bits = [styleJa, layoutJa].filter(Boolean);
  const title = bits.length ? `${label}（${bits.join("・")}）` : label;
  return title.slice(0, 32);
}

export function buildTemplatePromptText(spec) {
  const fam = getTemplateFamily(spec.genre || spec.family);
  const tokens = [
    "TASFUL_TPL_SPEC",
    `genre=${spec.genre || spec.family}`,
    `layout=${spec.layout_type}`,
    `style=${spec.style}`,
    `orient=${spec.orientation}`,
    `use=${spec.use_case}`,
    `fmt=${fam?.format || spec.format || "xlsx"}`,
  ].join(" ");
  const title = spec.title || buildTemplateJapaneseTitle(spec);
  return [
    tokens,
    "::",
    title,
    `${fam?.label_ja || "テンプレート"} editable source.`,
    `${spec.layout_type} layout, ${spec.style} style, ${spec.orientation} orientation.`,
    "placeholders only, no real company facts, vary hierarchy not title-only clones.",
  ].join(" ");
}

export function drivePathForTemplateSpec(spec) {
  const fam = getTemplateFamily(spec.genre || spec.family);
  return fam?.drive || `テンプレート/${spec.genre || "generic"}`;
}

export function slugForTemplateSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  const fam = getTemplateFamily(spec.genre || spec.family);
  return [
    spec.genre || spec.family,
    spec.layout_type,
    spec.style,
    spec.orientation,
    spec.use_case,
    fam?.format || "bin",
    q,
    `${dayPart}${scopeSuffix}`,
  ].join("-");
}

export function parseTemplateSpecFromPrompt(text) {
  const raw = String(text || "");
  if (!raw.includes("TASFUL_TPL_SPEC")) return null;
  const grab = (key) => {
    const m = raw.match(new RegExp(`${key}=([a-z0-9_]+)`));
    return m ? m[1] : "";
  };
  const genre = grab("genre");
  if (!FAMILY_BY_ID.has(genre)) return null;
  const layout_type = grab("layout") || "classic";
  const style = grab("style") || "corporate";
  const orientation = grab("orient") || "portrait";
  const use_case = grab("use") || "business";
  if (!TEMPLATE_LAYOUTS[layout_type] || !TEMPLATE_STYLES[style] || !TEMPLATE_ORIENTATIONS[orientation]) return null;
  const fam = FAMILY_BY_ID.get(genre);
  return {
    genre,
    family: genre,
    layout_type,
    style,
    orientation,
    use_case,
    format: fam.format,
    generator: fam.generator,
    title: buildTemplateJapaneseTitle({ genre, layout_type, style }),
  };
}

export function classifyLegacyTemplateItem(item) {
  const hay = [item.title, item.subcategory, ...(item.tags || [])].map((x) => String(x || "")).join("|");
  const hits = [];
  for (const fam of TEMPLATE_FAMILIES) {
    if (fam.match.some((m) => hay.includes(m))) hits.push(fam.id);
  }
  if (hits.length === 1) return { genre: hits[0], confidence: "derived" };
  if (hits.length > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: hits };
  return { genre: "unclassified", confidence: "none" };
}

export function templateSpecToMetadata(spec) {
  return {
    genre: spec.genre || spec.family || "",
    subcategory: spec.genre || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    layout: spec.layout_type || "",
    layout_type: spec.layout_type || "",
    orientation: spec.orientation || "",
    format: spec.format || "",
    category: spec.genre || "",
    language: "ja",
  };
}

export function validateTemplateGenreSsot() {
  const ids = new Set();
  const issues = [];
  for (const fam of TEMPLATE_FAMILIES) {
    if (ids.has(fam.id)) issues.push(`dup:${fam.id}`);
    ids.add(fam.id);
    if (fam.id === "default") issues.push("default_family_forbidden");
  }
  return { ok: issues.length === 0, issues, families: TEMPLATE_FAMILIES.length };
}
