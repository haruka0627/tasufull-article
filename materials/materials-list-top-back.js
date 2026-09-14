/**
 * TASFUL Materials — 一覧ページ共通「TOPへ戻る」導線
 * Materials TOP SSOT: /materials/
 */
(function (global) {
  "use strict";

  const TOP_HREF = "/materials/";

  function renderHtml() {
    return (
      `<nav class="mat-list-top-back" aria-label="サイトナビゲーション">` +
      `<a class="mat-list-top-back__link" href="${TOP_HREF}">` +
      `<span class="mat-list-top-back__arrow" aria-hidden="true">←</span> TOPへ戻る` +
      `</a>` +
      `</nav>`
    );
  }

  global.TasuMaterialsListTopBack = Object.freeze({
    TOP_HREF: TOP_HREF,
    renderHtml: renderHtml,
  });
})(typeof window !== "undefined" ? window : globalThis);
