/**
 * ヒーロー収益化バナー（将来: 複数バナーのスライド表示）
 * 画像は images/banners/*.jpg を HTML で差し替え。
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-hero-banner]");
  if (!root) return;

  var track = root.querySelector("[data-hero-banner-track]");
  if (!track) return;

  var slides = track.querySelectorAll("[data-hero-banner-slide]:not([hidden])");
  if (slides.length > 1) {
    track.setAttribute("data-hero-banner-multiple", "");
    slides[0].classList.add("is-active");
    // TODO: 自動スライド・矢印ナビ
  }
})();
