/**
 * Business Directory QA catalog allowlist (exact slugs).
 * Generator must emit only these 40 entries — no fuzzy matching.
 */
export const PLATFORM_QA_BD_ALLOWLIST = Object.freeze([
  "business-directory",
  "business-directory-q2",
  "business-directory-q3",
  "business-directory-q4",
  "business-directory-q5",
  "business-directory-q6",
  "business-directory-q7",
  "business-directory-q8",
  "business-directory-q9",
  "business-directory-q10",
  "business-directory-q11",
  "business-directory-q12",
  "business-directory-q13",
  "business-directory-q14",
  "business-directory-q15",
  "business-directory-q16",
  "business-directory-q17",
  "business-directory-q18",
  "business-directory-q19",
  "business-directory-q20",
  "business-directory-q21",
  "business-directory-q22",
  "business-directory-q23",
  "business-directory-q24",
  "business-directory-q25",
  "business-directory-q26",
  "business-directory-q27",
  "business-directory-q28",
  "business-directory-q29",
  "business-directory-q30",
  "business-directory-q31",
  "business-directory-q32",
  "business-directory-q33",
  "business-directory-q34",
  "business-directory-q35",
  "business-directory-beginner",
  "business-directory-creator",
  "business-directory-streamer",
  "business-directory-viewer",
  "business-directory-worker",
]);

export const PLATFORM_QA_BD_ALLOWLIST_SET = new Set(PLATFORM_QA_BD_ALLOWLIST);

/** Topic key that may expand into allowlisted slugs (exact). */
export const PLATFORM_QA_BD_TOPIC_KEY = "business-directory";

export function isPlatformQaBdSlug(slug) {
  return typeof slug === "string" && PLATFORM_QA_BD_ALLOWLIST_SET.has(slug);
}
