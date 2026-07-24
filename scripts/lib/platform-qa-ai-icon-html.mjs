/**
 * TASFUL AI 公式アイコン — HTML 生成（build / help テンプレート用）
 * ブラウザ正本: platform-qa-ai-icon.js（SRC は同期すること）
 */
export const TASFUL_AI_ICON_SRC = "/images/help/tasful-ai-icon.png";

const SIZES = Object.freeze({
  xs: 16,
  sm: 20,
  md: 24,
  brand: 30,
  cta: 32,
  lg: 36,
});

/**
 * @param {"xs"|"sm"|"md"|"brand"|"cta"|"lg"} [sizeKey]
 * @param {string} [extraClass]
 */
export function renderTasfulAiIconHtml(sizeKey = "md", extraClass = "") {
  const key = SIZES[sizeKey] ? sizeKey : "md";
  const px = SIZES[key];
  const cls = `platform-qa-ai-icon platform-qa-ai-icon--${key}${extraClass ? ` ${extraClass}` : ""}`;
  return (
    `<img class="${cls}"` +
    ` src="${TASFUL_AI_ICON_SRC}"` +
    ` srcset="${TASFUL_AI_ICON_SRC} 1x, ${TASFUL_AI_ICON_SRC} 2x"` +
    ` alt="" width="${px}" height="${px}" decoding="async" aria-hidden="true">`
  );
}
