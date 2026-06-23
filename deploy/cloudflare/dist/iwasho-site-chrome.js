(function () {
  function initIwHeaderMenu() {
    var header = document.querySelector(".iw-header");
    if (!header || header.dataset.iwMenuBound === "1") return;

    var btn = header.querySelector(".iw-header__menu-btn");
    var panel = header.querySelector(".iw-header__mobile-panel");
    if (!btn || !panel) return;

    header.dataset.iwMenuBound = "1";

    function setOpen(open) {
      header.classList.toggle("is-menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      document.documentElement.classList.toggle("iw-menu-open", open);
    }

    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!header.classList.contains("is-menu-open"));
    });

    panel.querySelectorAll("[data-iw-menu-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        setOpen(false);
      });
    });

    panel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIwHeaderMenu);
  } else {
    initIwHeaderMenu();
  }
})();
