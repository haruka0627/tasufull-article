/**
 * TasuFull — ワーカー詳細（detail-worker.html）
 * 掲載データの取得は listing-detail-loader.js（?id= 必須）
 */
(function () {
  "use strict";

  function getWorkerIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(
      params.get("id") ||
        params.get("listingId") ||
        params.get("listing_id") ||
        ""
    ).trim();
  }

  /** URL の id を body / お気に入りボタンへ反映（loader 実行前） */
  function ensureBenchEmbedStyles() {
    if (document.getElementById("platform-chat-bench-embed-css")) return;
    const link = document.createElement("link");
    link.id = "platform-chat-bench-embed-css";
    link.rel = "stylesheet";
    link.href = "platform-chat-bench-embed.css";
    document.head.appendChild(link);
  }

  function syncBenchEmbedFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("benchEmbed") === "1") {
        document.body.dataset.benchEmbed = "1";
        ensureBenchEmbedStyles();
      } else {
        delete document.body.dataset.benchEmbed;
      }
    } catch {
      /* ignore */
    }
  }

  function isBenchSellerManagementView() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("benchManagement") === "1") return true;
      if (
        params.get("benchEmbed") === "1" &&
        (params.get("view") === "requests" || window.location.hash === "#requests")
      ) {
        return true;
      }
      return document.body?.classList.contains("listing-bench-seller-management");
    } catch {
      return false;
    }
  }

  function syncWorkerIdFromUrl() {
    const workerId = getWorkerIdFromUrl();
    if (!workerId) {
      return "";
    }

    document.body.dataset.targetId = workerId;
    document.body.dataset.listingId = workerId;

    document
      .querySelectorAll("[data-favorite-button][data-target-type='worker']")
      .forEach((btn) => {
        btn.dataset.targetId = workerId;
      });

    return workerId;
  }

  function initSectionNav() {
    const nav = document.querySelector(".section-nav");
    if (!nav) {
      return;
    }

    if (isBenchSellerManagementView()) {
      window.TasuWorkerDetailRequests?.bootstrapWorkerBenchManagementChrome?.();
      initBenchManagementSectionNav(nav);
      return;
    }

    const links = Array.from(nav.querySelectorAll(".section-nav__link"));
    const sections = links
      .map((link) => {
        const id = link.getAttribute("href")?.replace(/^#/, "");
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);

    if (sections.length === 0) {
      return;
    }

    function setActive(id) {
      links.forEach((link) => {
        const active = link.getAttribute("href") === `#${id}`;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const id = link.getAttribute("href")?.replace(/^#/, "");
        const target = id ? document.getElementById(id) : null;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setActive(id);
        }
      });
    });

    const banner = document.querySelector(".tasu-banner");
    const bannerHeight = banner ? banner.offsetHeight : 0;
    const navOffset = bannerHeight + nav.offsetHeight + 8;
    let ticking = false;

    function updateActiveOnScroll() {
      let currentId = sections[0].id;
      for (const section of sections) {
        const top = section.getBoundingClientRect().top;
        if (top <= navOffset) {
          currentId = section.id;
        }
      }
      setActive(currentId);
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) {
          return;
        }
        ticking = true;
        requestAnimationFrame(updateActiveOnScroll);
      },
      { passive: true }
    );

    updateActiveOnScroll();
  }

  function initBenchManagementSectionNav(nav) {
    const links = Array.from(nav.querySelectorAll(".section-nav__link"));
    const requestsNav = nav.querySelector("[data-worker-requests-nav]");
    links.forEach((link) => {
      const isRequests =
        link === requestsNav ||
        link.getAttribute("href") === "#requests" ||
        link.hasAttribute("data-worker-requests-nav");
      if (isRequests) {
        link.hidden = false;
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      } else {
        link.hidden = true;
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      }
    });
    const requestsSection = document.getElementById("requests");
    if (requestsSection) requestsSection.hidden = false;
    window.scrollTo(0, 0);
  }

  function initStripScroll() {
    document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.scrollTarget);
        if (!target) {
          return;
        }
        const dir = Number.parseInt(btn.dataset.scrollDir ?? "1", 10);
        target.scrollBy({ left: dir * 280, behavior: "smooth" });
      });
    });
  }

  function isWorkerMobileViewport() {
    try {
      return (
        window.matchMedia("(max-width: 960px)").matches &&
        document.body?.dataset.detailType === "worker"
      );
    } catch {
      return false;
    }
  }

  let workerBottomChromeResizeBound = false;

  function syncWorkerMobileBottomChrome() {
    if (!isWorkerMobileViewport()) {
      return;
    }

    const root = document.documentElement;
    const tab = document.querySelector(
      ".tasu-app-tabbar, .talk-mobile-tabbar, [data-tasu-app-tabbar]"
    );
    const cta = document.querySelector(".skill-hero-premium__cta");

    let tabH = 0;
    if (tab) {
      tabH = Math.max(tab.offsetHeight, Math.ceil(tab.getBoundingClientRect().height));
      if (tabH > 0) {
        root.style.setProperty("--worker-sp-tabbar-measured", `${tabH}px`);
      }
    }

    let ctaH = 0;
    if (cta) {
      ctaH = Math.max(cta.offsetHeight, Math.ceil(cta.getBoundingClientRect().height));
      if (ctaH > 0) {
        root.style.setProperty("--worker-sp-cta-measured", `${ctaH}px`);
      }
    }

    const footerGap = 124;
    const stack = (tabH || 53) + (ctaH || 150);
    root.style.setProperty("--worker-sp-bottom-pad", `${stack + footerGap}px`);
  }

  function bindWorkerMobileBottomChromeSync() {
    if (workerBottomChromeResizeBound) {
      syncWorkerMobileBottomChrome();
      return;
    }
    workerBottomChromeResizeBound = true;

    const run = () => {
      requestAnimationFrame(() => {
        applyWorkerMobileLayout();
        syncWorkerMobileBottomChrome();
      });
    };

    window.addEventListener("resize", run, { passive: true });
    window.addEventListener("load", run);

    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-listing-loaded", "hidden"],
    });

    run();
    requestAnimationFrame(run);
    setTimeout(run, 0);
    setTimeout(run, 150);
    setTimeout(run, 800);
  }

  /** スマホ: 対応・稼働情報をヒーロープロフィールカードへ移動 / PC: 復元 */
  function applyWorkerMobileLayout() {
    const sectionMain = document.querySelector(
      "#section-seller .skill-seller-premium__main"
    );
    const profileMain = document.querySelector(
      ".product-hero-seller-card .product-hero-seller-card__main"
    );
    const activity =
      document.querySelector(
        "#section-seller .skill-seller-premium__block--activity"
      ) ||
      document.querySelector(
        ".product-hero-seller-card .skill-seller-premium__block--activity"
      );

    if (!sectionMain || !profileMain || !activity) {
      return;
    }

    if (!isWorkerMobileViewport()) {
      if (activity.dataset.workerMobileMoved === "1") {
        sectionMain.appendChild(activity);
        delete activity.dataset.workerMobileMoved;
      }
      return;
    }

    if (activity.dataset.workerMobileMoved === "1") {
      return;
    }

    activity.dataset.workerMobileMoved = "1";
    profileMain.appendChild(activity);
  }

  function init() {
    syncBenchEmbedFromUrl();
    syncWorkerIdFromUrl();
    initSectionNav();
    initStripScroll();
    bindWorkerMobileBottomChromeSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TasuDetailWorker = {
    getWorkerIdFromUrl,
    syncWorkerIdFromUrl,
  };
})();
