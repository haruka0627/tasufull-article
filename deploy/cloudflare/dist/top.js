/**
 * TasuFull TOP — ランキングカルーセル（各セクション独立）
 */
(function () {
  "use strict";

  document.querySelectorAll(".top-ranking__carousel").forEach(function (carousel) {
    var track = carousel.querySelector("[data-ranking-track]");
    var prevBtn = carousel.querySelector("[data-ranking-prev]");
    var nextBtn = carousel.querySelector("[data-ranking-next]");

    if (!track || !prevBtn || !nextBtn) return;

    function scrollStep(direction) {
      var card = track.querySelector(".top-rank-card, .ranking-card, .top-mini-rank");
      if (!card) return;
      var gap = parseFloat(getComputedStyle(track).gap) || 16;
      var step = card.offsetWidth + gap;
      track.scrollBy({ left: direction * step, behavior: "smooth" });
    }

    prevBtn.addEventListener("click", function () {
      scrollStep(-1);
    });

    nextBtn.addEventListener("click", function () {
      scrollStep(1);
    });
  });
})();
