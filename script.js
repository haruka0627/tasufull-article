/**
 * @deprecated index.html は search.js + listings.js を読み込んでください。
 */
(function () {
  "use strict";
  if (!window.TasuListings && document.querySelector("#searchInput")) {
    console.warn(
      "[TasuFull] script.js は非推奨です。search.js と listings.js を読み込んでください。"
    );
  }
})();
