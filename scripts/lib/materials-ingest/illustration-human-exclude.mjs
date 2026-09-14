/**
 * Illustration human-subject exclusion.
 * Does not invent new taxonomy. Existing 人物 / 子供 folders stay on Drive
 * but are excluded from generation and auto-publish.
 */
const HUMAN_PATH_TOKENS = Object.freeze([
  "人物",
  "人間",
  "男性",
  "女性",
  "子供",
  "子ども",
  "こども",
  "家族",
  "ビジネスマン",
  "ビジネスウーマン",
  "ポートレート",
  "全身",
  "複数人物",
]);

const HUMAN_SEGMENT_RE =
  /^(portrait|person|people|human|man|woman|child|children|family|couple|businessman|businesswoman|baby|senior)$/i;

export function haystackFromEvidence(input = {}) {
  const parts = [
    input.relative_path,
    input.package_dir,
    input.file_path,
    input.category_path,
    input.slug,
    input.prompt,
    input.subcategory,
    ...(Array.isArray(input.categoryPath) ? input.categoryPath : []),
  ]
    .filter(Boolean)
    .map((s) => String(s).replace(/\\/g, "/"));
  return parts.join("/").toLowerCase();
}

export function isHumanIllustrationPath(input = {}) {
  const publicId = String(input.public_id || input.asset_type || input.category_id || "");
  const rel = String(input.relative_path || input.package_dir || input.file_path || "")
    .replace(/\\/g, "/");
  const isIllustration =
    publicId === "illustration" ||
    /\/イラスト(\/|$)/.test(rel) ||
    /(?:^|\/)illustration(?:\/|$)/i.test(rel);
  if (!isIllustration) return false;

  const hay = haystackFromEvidence(input);
  for (const tok of HUMAN_PATH_TOKENS) {
    if (hay.includes(String(tok).toLowerCase())) return true;
  }
  const segments = hay.split(/[/_|]+/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (HUMAN_SEGMENT_RE.test(seg)) return true;
  }
  return false;
}

export function assertNoHumanIllustrationPrompt(line) {
  const blocked = isHumanIllustrationPath({
    public_id: "illustration",
    relative_path: String(line || ""),
    prompt: String(line || ""),
  });
  return { ok: !blocked, blocked };
}
