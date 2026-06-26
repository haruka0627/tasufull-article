/**
 * TASFUL AI — 共通免責・規約リンク（Gateway / AI Core 非変更）
 * Builder AI · TASFUL AI Workspace · Platform · TLV · Talk 入口で共有
 */
(function (global) {
  "use strict";

  const VERSION = "2026-06-26";

  const LINKS = Object.freeze({
    terms: "ai-terms.html",
    disclaimer: "ai-disclaimer.html",
    builderGuidelines: "builder/builder-ai-guidelines.html",
  });

  const SHORT_DISCLAIMER =
    "AIの回答は参考情報です。正確性・完全性・最新性を保証するものではありません。最終判断は利用者ご自身で行ってください。";

  const SHORT_DISCLAIMER_WITH_LINKS =
    SHORT_DISCLAIMER +
    " " +
    '<a href="ai-disclaimer.html">免責事項</a> · <a href="ai-terms.html">AI利用規約</a>';

  const ANSWER_FOOTER_NOTE =
    "※ AI回答は参考情報です。契約・採用・支払い・請求・承認の確定は行われません。";

  const PROHIBITED_USES = Object.freeze([
    "違法行為への利用",
    "脱税・架空経費等の不正行為",
    "危険行為の助長・無理な施工の推奨",
    "資格が必要な作業の無資格実施の助長",
    "他者への誹謗中傷",
    "個人情報の不正取得・不正利用",
  ]);

  const SCOPES = Object.freeze([
    "TASFUL AI（AI Workspace）",
    "Builder AI",
    "Platform 経由の AI 検索・比較・おすすめ",
    "TLV 経由の TASFUL AI（source=tlv）",
    "TASFUL Talk 経由の TASFUL AI",
  ]);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function link(path, label) {
    return `<a href="${esc(path)}" class="common-ai-disclaimer__link">${esc(label)}</a>`;
  }

  /**
   * @param {{ surface?: string, builder?: boolean, extra?: string }} [opts]
   */
  function renderBannerHtml(opts) {
    const o = opts || {};
    const parts = [esc(SHORT_DISCLAIMER)];
    if (o.builder && global.TasuBuilderAiDisclaimer?.BUILDER_EXTRA_LINE) {
      parts.push(esc(global.TasuBuilderAiDisclaimer.BUILDER_EXTRA_LINE));
    }
    if (o.extra) parts.push(esc(o.extra));
    const links = [
      link(LINKS.disclaimer, "免責事項"),
      link(LINKS.terms, "AI利用規約"),
    ];
    if (o.builder) links.push(link(LINKS.builderGuidelines, "Builder AI ガイドライン"));
    return (
      `<div class="common-ai-disclaimer__inner" role="note">` +
      `<p class="common-ai-disclaimer__text">${parts.join(" ")}</p>` +
      `<p class="common-ai-disclaimer__links">${links.join(" · ")}</p>` +
      `</div>`
    );
  }

  function renderAnswerFooterHtml(opts) {
    const o = opts || {};
    const Builder = global.TasuBuilderAiDisclaimer;
    const note = o.builder && Builder?.ANSWER_FOOTER ? Builder.ANSWER_FOOTER : ANSWER_FOOTER_NOTE;
    return (
      `<p class="common-ai-disclaimer__answer-footer" role="note">` +
      `${esc(note)} ` +
      link(LINKS.disclaimer, "詳細") +
      `</p>`
    );
  }

  function mountBanners(root) {
    const scope = root || global.document;
    scope.querySelectorAll("[data-common-ai-disclaimer-banner]").forEach((el) => {
      if (el.dataset.mounted) return;
      el.dataset.mounted = "1";
      const builder = el.dataset.surface === "builder" || el.classList.contains("common-ai-disclaimer--builder");
      const extra = el.dataset.extra || "";
      el.innerHTML = renderBannerHtml({ builder, extra });
    });
  }

  function init() {
    mountBanners(global.document);
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuCommonAiDisclaimer = {
    VERSION,
    LINKS,
    SHORT_DISCLAIMER,
    SHORT_DISCLAIMER_WITH_LINKS,
    ANSWER_FOOTER_NOTE,
    PROHIBITED_USES,
    SCOPES,
    renderBannerHtml,
    renderAnswerFooterHtml,
    mountBanners,
  };
})(typeof window !== "undefined" ? window : globalThis);
