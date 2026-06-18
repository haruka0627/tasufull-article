(function () {
  "use strict";

  /* 画像・オプション表示は listing-detail-loader.js が Supabase データで描画 */

  function isBenchManagementView() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("benchManagement") === "1") return true;
      if (
        params.get("benchEmbed") === "1" &&
        (params.get("view") === "contacts" || window.location.hash === "#contacts")
      ) {
        return true;
      }
      return document.body?.classList.contains("listing-bench-seller-management");
    } catch {
      return false;
    }
  }

  function initBenchManagementSectionNav(nav, links) {
    const contactsNav = nav.querySelector("[data-listing-contacts-nav]");
    links.forEach((link) => {
      const isContacts =
        link === contactsNav ||
        link.getAttribute("href") === "#contacts" ||
        link.hasAttribute("data-listing-contacts-nav");
      if (isContacts) {
        link.hidden = false;
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      } else {
        link.hidden = true;
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      }
    });
    const contactsSection = document.querySelector("[data-listing-contacts-section]");
    if (contactsSection) contactsSection.hidden = false;
    window.scrollTo(0, 0);
  }

  function initSectionNav() {
    const nav = document.querySelector(".section-nav");
    if (!nav) {
      return;
    }

    const links = Array.from(nav.querySelectorAll(".section-nav__link"));

    if (isBenchManagementView()) {
      initBenchManagementSectionNav(nav, links);
      return;
    }
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

  function isSkillMobileViewport() {
    try {
      return (
        window.matchMedia("(max-width: 960px)").matches &&
        document.body?.dataset.detailType === "skill"
      );
    } catch {
      return false;
    }
  }

  let skillBottomChromeResizeBound = false;

  function syncSkillMobileBottomChrome() {
    if (!isSkillMobileViewport()) {
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
        root.style.setProperty("--skill-sp-tabbar-measured", `${tabH}px`);
      }
    }

    let ctaH = 0;
    if (cta) {
      ctaH = Math.max(cta.offsetHeight, Math.ceil(cta.getBoundingClientRect().height));
      if (ctaH > 0) {
        root.style.setProperty("--skill-sp-cta-measured", `${ctaH}px`);
      }
    }

    const footerGap = 12;
    const stack = (tabH || 53) + (ctaH || 118);
    root.style.setProperty("--skill-sp-bottom-pad", `${stack + footerGap}px`);
  }

  function bindSkillMobileBottomChromeSync() {
    if (skillBottomChromeResizeBound) {
      syncSkillMobileBottomChrome();
      return;
    }
    skillBottomChromeResizeBound = true;

    const run = () => {
      requestAnimationFrame(syncSkillMobileBottomChrome);
    };

    window.addEventListener("resize", run, { passive: true });
    window.addEventListener("load", run);

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true });

    run();
    requestAnimationFrame(run);
    setTimeout(run, 0);
    setTimeout(run, 150);
  }

  function initPaidOptionsFallback() {
    const section = document.getElementById("section-options");
    if (!section) {
      return;
    }
    if (document.body.dataset.listingLoaded === "true") {
      return;
    }
    window.TasuListingOptions?.ensurePaidOptionsShell?.(section);
    window.TasuListingOptions?.initDetail?.({
      basePrice: 80000,
      totalApprox: true,
      hintText: "オプションを選択してください",
      forceShow: true,
    });
  }

  function init() {
    initSectionNav();
    initStripScroll();
    initPaidOptionsFallback();
    bindSkillMobileBottomChromeSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
