/**
 * IWASHO TOP — モバイルメニュー
 */
(function () {
  var header = document.querySelector(".iw-site-header");
  var toggle = document.querySelector("[data-iw-menu-toggle]");
  if (!header || !toggle) return;

  toggle.addEventListener("click", function () {
    var open = header.classList.toggle("is-menu-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
  });

  header.querySelectorAll(".iw-site-header__nav a, .iw-site-header__btn").forEach(function (link) {
    link.addEventListener("click", function () {
      header.classList.remove("is-menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "メニューを開く");
    });
  });
})();
