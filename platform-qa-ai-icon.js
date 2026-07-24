/**
 * TASFUL AI 公式アイコン — QA / Help 共通（正本）
 * @see scripts/lib/platform-qa-ai-icon-html.mjs
 */
(function (global) {
  "use strict";

  const TASFUL_AI_ICON_SRC = "/images/help/tasful-ai-icon.png";

  const SIZES = Object.freeze({
    xs: 16,
    sm: 20,
    md: 24,
    brand: 30,
    cta: 32,
    lg: 36,
  });

  /**
   * @param {"xs"|"sm"|"md"|"cta"|"lg"} [sizeKey]
   * @param {string} [extraClass]
   */
  function render(sizeKey, extraClass) {
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

  function mount(root) {
    const scope = root || global.document;
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll("[data-platform-qa-ai-icon]").forEach((el) => {
      const size = el.getAttribute("data-platform-qa-ai-icon") || "md";
      el.innerHTML = render(size);
    });
  }

  function init() {
    mount(global.document);
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.PlatformQaAiIcon = {
    TASFUL_AI_ICON_SRC,
    SIZES,
    render,
    mount,
  };
})(typeof window !== "undefined" ? window : globalThis);
