/**
 * TasuFull — 求人詳細ページ（detail-job.html）
 */
(function () {
  "use strict";

  const RANK_CLASS_RE =
    /\brank-(legend|gold|platinum|diamond|silver|bronze|new|master|premium)\b/g;
  const LEGACY_SELECTORS = [
    ".seller-rank-chip",
    "[data-seller-rank-chip]",
    ".seller-rank-preview",
    ".product-hero-seller-card__rank",
    "[data-listing-featured]",
    "[data-featured-checkout]",
    ".listing-featured-panel",
    ".listing-featured-banner",
    ".skill-seller-premium__chip",
    ".seller-follow-btn",
    ".skill-seller-stat--rating",
    ".seller-stat--rating",
    ".tasu-trust-score--new",
  ];

  function isJobPage() {
    if (
      document.body?.dataset?.page === "public-board-detail" &&
      document.body?.dataset?.boardDetailType === "project"
    ) {
      return false;
    }
    return document.body?.dataset?.detailType === "job";
  }

  function resolveJobListUrl() {
    const page = document.body?.dataset?.page || "";
    if (page === "public-board-detail") return "public-board.html";
    if (page === "public-job-detail") return "public-jobs.html";
    const ref = String(document.referrer || "");
    if (ref.includes("public-jobs.html")) return "public-jobs.html";
    if (ref.includes("job-top.html")) return ref;
    return "job-top.html";
  }

  function initBackLinks() {
    document.querySelectorAll("[data-job-back-link]").forEach((a) => {
      if (!(a instanceof HTMLAnchorElement)) return;
      a.href = resolveJobListUrl();
    });
  }

  function initGallery() {
    const mainImage = document.getElementById("mainImage");
    const thumbs = document.querySelectorAll(".thumb-btn");
    if (!mainImage || thumbs.length === 0) return;

    thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const src = thumb.dataset.src;
        const alt = thumb.dataset.alt;
        if (!src) return;

        thumbs.forEach((t) => {
          const active = t === thumb;
          t.setAttribute("aria-selected", String(active));
          t.classList.toggle("border-gold", active);
          t.classList.toggle("ring-2", active);
          t.classList.toggle("ring-gold/30", active);
          t.classList.toggle("border-transparent", !active);
          t.classList.toggle("opacity-70", !active);
        });

        mainImage.src = src;
        if (alt) mainImage.alt = alt;
      });
    });
  }

  const JOB_SECTION_NAV_MOBILE_MQ = window.matchMedia("(max-width: 768px)");
  const JOB_MOBILE_FIXED_CTA_MQ = window.matchMedia("(max-width: 768px)");

  let jobFixedCtaObserver = null;
  let jobFixedCtaTarget = null;

  function syncJobMobileBottomInsets() {
    window.TasuMobileDetailTemplate?.syncMobileBottomChromeInsets?.();
  }

  function setJobFixedCtaVisible(visible) {
    if (!isJobPage()) return;
    document.body.classList.toggle("job-fixed-cta-visible", visible);
    const dock = document.querySelector("[data-job-bottom-dock]");
    if (dock) {
      dock.classList.toggle("is-visible", visible);
      dock.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    syncJobMobileBottomInsets();
  }

  function ensureJobFvCtaActionsTarget() {
    const mobileTarget = document.querySelector("[data-job-fv-cta-actions]");
    if (mobileTarget) return mobileTarget;

    if (document.body.classList.contains("tasu-mdetail-ready")) return null;

    const ctaHost = document.querySelector("[data-job-hero-cta]");
    const apply = ctaHost?.querySelector("[data-listing-primary-cta], .hero-apply-btn");
    if (!apply) return null;

    let wrap = ctaHost.querySelector("[data-job-fv-cta-actions]");
    if (wrap) return wrap;

    const consult = ctaHost.querySelector(".job-top-cta__consult, .cta-consult");
    wrap = document.createElement("div");
    wrap.className = "job-hero-fv-cta-actions";
    wrap.setAttribute("data-job-fv-cta-actions", "");
    apply.parentNode.insertBefore(wrap, apply);
    wrap.appendChild(apply);
    if (consult) wrap.appendChild(consult);
    return wrap;
  }

  function teardownJobMobileFixedCtaObserver() {
    jobFixedCtaObserver?.disconnect();
    jobFixedCtaObserver = null;
    jobFixedCtaTarget = null;
    document.body.classList.remove("job-fixed-cta-ready");
  }

  function refreshJobMobileFixedCtaReveal() {
    if (!isJobPage()) return;

    if (!JOB_MOBILE_FIXED_CTA_MQ.matches) {
      teardownJobMobileFixedCtaObserver();
      document.body.classList.remove("job-fixed-cta-visible");
      const dock = document.querySelector("[data-job-bottom-dock]");
      if (dock) {
        dock.classList.add("is-visible");
        dock.removeAttribute("aria-hidden");
      }
      syncJobMobileBottomInsets();
      return;
    }

    const target = ensureJobFvCtaActionsTarget();
    if (!target) {
      teardownJobMobileFixedCtaObserver();
      setJobFixedCtaVisible(false);
      return;
    }

    if (target === jobFixedCtaTarget && jobFixedCtaObserver) return;

    teardownJobMobileFixedCtaObserver();
    jobFixedCtaTarget = target;
    setJobFixedCtaVisible(false);
    document.body.classList.add("job-fixed-cta-ready");

    if (!("IntersectionObserver" in window)) {
      setJobFixedCtaVisible(window.scrollY > target.offsetTop + target.offsetHeight);
      return;
    }

    jobFixedCtaObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((item) => item.target === jobFixedCtaTarget) || entries[0];
        if (!entry) return;
        setJobFixedCtaVisible(!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    jobFixedCtaObserver.observe(target);
  }

  function initJobMobileFixedCtaReveal() {
    refreshJobMobileFixedCtaReveal();

    JOB_MOBILE_FIXED_CTA_MQ.addEventListener("change", refreshJobMobileFixedCtaReveal);

    ["tasu:listing-loaded", "tasu:listing-applied", "tasu:listing-seller-ready"].forEach(
      (name) => {
        window.addEventListener(name, () => {
          requestAnimationFrame(refreshJobMobileFixedCtaReveal);
        });
      }
    );

    window.addEventListener("resize", () => {
      requestAnimationFrame(refreshJobMobileFixedCtaReveal);
    });
  }

  function getJobBottomDockNav() {
    return document.querySelector("[data-job-bottom-dock] .section-nav");
  }

  function resolveJobSectionTarget(id) {
    if (!id) return null;
    const pcTarget = document.getElementById(id);
    if (pcTarget && !pcTarget.closest("[data-tasu-mdetail-pc-hidden]")) {
      return pcTarget;
    }
    const mobileChunk = document.querySelector(
      `[data-tasu-mdetail-sections] [data-tasu-mdetail-from="${id}"]`
    );
    if (mobileChunk) {
      return mobileChunk.closest(".tasu-mdetail-section") || mobileChunk;
    }
    return pcTarget;
  }

  function isJobMobileSectionVisible(target) {
    if (!target?.classList?.contains("tasu-mdetail-section")) return false;
    const body = target.querySelector(".tasu-mdetail-section__body");
    if (!body) return false;
    return Boolean(
      body.querySelector("img[src], table tbody tr, li, details, .job-workplace-gallery__item") ||
        String(body.textContent || "").trim().length >= 4
    );
  }

  function isJobSectionNavTargetVisible(target) {
    if (!target || target.hidden) return false;
    if (isJobMobileSectionVisible(target)) return true;
    if (target.closest("[data-tasu-mdetail-pc-hidden]")) return false;
    const accordionStack = target.closest("[data-listing-job-accordions-wrap]");
    if (accordionStack && accordionStack.hidden) return false;
    const hiddenAncestor = target.closest("[hidden]");
    if (hiddenAncestor && hiddenAncestor !== target) return false;
    return true;
  }

  function syncJobBottomDockCtas() {
    const heroApply = document.querySelector("[data-listing-primary-cta]");
    const heroConsult = document.querySelector("[data-job-hero-cta] .cta-consult");
    const heroFavorite = document.querySelector("[data-job-hero-cta] [data-favorite-button]");
    const dockApply = document.querySelector("[data-job-dock-apply]");
    const dockConsult = document.querySelector("[data-job-dock-consult]");
    const dockFavorite = document.querySelector("[data-job-dock-favorite]");

    if (heroApply && dockApply) {
      dockApply.href = heroApply.getAttribute("href") || "#";
      dockApply.hidden = heroApply.hidden;
    }
    if (heroConsult && dockConsult) {
      dockConsult.href = heroConsult.getAttribute("href") || "#";
      dockConsult.hidden = heroConsult.hidden;
    }
    if (heroFavorite && dockFavorite) {
      ["data-target-id", "data-target-type", "data-tasu-favorite", "aria-pressed"].forEach(
        (attr) => {
          const value = heroFavorite.getAttribute(attr);
          if (value == null || value === "") dockFavorite.removeAttribute(attr);
          else dockFavorite.setAttribute(attr, value);
        }
      );
      dockFavorite.disabled = heroFavorite.disabled;
      dockFavorite.classList.toggle("is-active", heroFavorite.classList.contains("is-active"));
      dockFavorite.classList.toggle("is-favorite", heroFavorite.classList.contains("is-favorite"));
    }

    if (window.TasuDetailFavorites?.syncAllButtonsOnPage) {
      void window.TasuDetailFavorites.syncAllButtonsOnPage();
    }
  }

  function syncJobSectionNavVisibility() {
    const nav = getJobBottomDockNav();
    if (!nav) return [];

    const links = Array.from(nav.querySelectorAll("[data-job-section-nav]"));
    links.forEach((link) => {
      const id = link.getAttribute("href")?.replace(/^#/, "");
      const target = resolveJobSectionTarget(id);
      const visible = isJobSectionNavTargetVisible(target);
      link.hidden = !visible;
      if (!visible) link.classList.remove("is-active");
    });
    return links.filter((link) => !link.hidden);
  }

  function getJobSectionNavEntries(links) {
    return links
      .map((link) => {
        const id = link.getAttribute("href")?.replace(/^#/, "");
        const section = resolveJobSectionTarget(id);
        return section && isJobSectionNavTargetVisible(section)
          ? { id, link, section }
          : null;
      })
      .filter(Boolean);
  }

  function getJobSectionNavOffset() {
    return Math.min(window.innerHeight * 0.25, 160);
  }

  function scrollActiveNavLinkIntoView(inner, link) {
    if (!inner || !link) return;
    const linkLeft = link.offsetLeft;
    const linkRight = linkLeft + link.offsetWidth;
    const viewLeft = inner.scrollLeft;
    const viewRight = viewLeft + inner.clientWidth;
    if (linkLeft < viewLeft + 8) {
      inner.scrollTo({ left: Math.max(linkLeft - 12, 0), behavior: "smooth" });
    } else if (linkRight > viewRight - 8) {
      inner.scrollTo({
        left: linkRight - inner.clientWidth + 12,
        behavior: "smooth",
      });
    }
  }

  function scrollJobSectionTarget(target) {
    if (!target || !isJobSectionNavTargetVisible(target)) return;
    if (target instanceof HTMLDetailsElement && !target.open) {
      target.open = true;
    }
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function initSectionNav() {
    const dock = document.querySelector("[data-job-bottom-dock]");
    const nav = getJobBottomDockNav();
    if (!dock || !nav || nav.dataset.jobSectionNavReady === "true") return;
    nav.dataset.jobSectionNavReady = "true";

    const inner = nav.querySelector(".section-nav__inner");
    let entries = [];
    let ticking = false;

    function setActive(id) {
      entries.forEach(({ id: entryId, link }) => {
        const active = entryId === id;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
          scrollActiveNavLinkIntoView(inner, link);
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function refreshEntries() {
      const visibleLinks = syncJobSectionNavVisibility();
      entries = getJobSectionNavEntries(visibleLinks);
      if (!entries.length) return;
      const active = entries.find(({ link }) => link.classList.contains("is-active"));
      if (!active || active.link.hidden) {
        setActive(entries[0].id);
      }
    }

    function updateActiveOnScroll() {
      if (!entries.length) {
        ticking = false;
        return;
      }
      const offset = getJobSectionNavOffset();
      let currentId = entries[0].id;
      for (const { id, section } of entries) {
        if (section.getBoundingClientRect().top <= offset) {
          currentId = id;
        }
      }
      setActive(currentId);
      ticking = false;
    }

    nav.addEventListener("click", (event) => {
      const link = event.target.closest(".section-nav__link");
      if (!link || link.hidden || !nav.contains(link)) return;
      event.preventDefault();
      const id = link.getAttribute("href")?.replace(/^#/, "");
      const target = resolveJobSectionTarget(id);
      if (!target || !isJobSectionNavTargetVisible(target)) return;
      scrollJobSectionTarget(target);
      setActive(id);
    });

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateActiveOnScroll);
      },
      { passive: true }
    );

    JOB_SECTION_NAV_MOBILE_MQ.addEventListener("change", () => {
      refreshEntries();
      updateActiveOnScroll();
    });

    ["tasu:listing-loaded", "tasu:listing-applied", "tasu:listing-seller-ready"].forEach(
      (name) => {
        window.addEventListener(name, () => {
          refreshEntries();
          updateActiveOnScroll();
        });
      }
    );

    refreshEntries();
    updateActiveOnScroll();
    syncJobBottomDockCtas();
  }

  function initJobBottomDockCtas() {
    syncJobBottomDockCtas();

    ["tasu:listing-loaded", "tasu:listing-applied", "tasu:listing-seller-ready"].forEach(
      (name) => {
        window.addEventListener(name, syncJobBottomDockCtas);
      }
    );

    const favoriteEvent = window.TasuFavoritesDb?.EVENT_NAME || "favorite-changed";
    document.addEventListener(favoriteEvent, () => {
      requestAnimationFrame(syncJobBottomDockCtas);
    });
  }

  function initStripScroll() {
    document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-scroll-target");
        const dir = Number(btn.getAttribute("data-scroll-dir") || "1");
        const strip = id ? document.getElementById(id) : null;
        if (!strip) return;
        strip.scrollBy({
          left: dir * Math.max(strip.clientWidth * 0.85, 200),
          behavior: "smooth",
        });
      });
    });
  }

  function syncJobSidebarCta() {
    /* サイドバー廃止 — ヒーローCTAのみ */
  }

  function markJobTopCard() {
    const hero = document.querySelector(".job-hero-section, .job-top-card");
    if (hero && !hero.classList.contains("job-top-card")) {
      hero.classList.add("job-top-card");
    }
    const gallery = document.querySelector("[data-listing-gallery]");
    if (gallery && !gallery.classList.contains("job-top-card__thumbs")) {
      gallery.classList.add("job-top-card__thumbs");
    }
  }

  function stripRankClasses(el) {
    if (!el || !(el instanceof Element)) return;
    if (el.closest(".job-top-company")) return;
    el.className = el.className
      .replace(RANK_CLASS_RE, "")
      .replace(/\bseller-name\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function removeLegacySellerStats(root) {
    root.querySelectorAll("[data-seller-followers]").forEach((el) => {
      const stat = el.closest(
        ".skill-seller-stat, .seller-stat, .job-company-card__stat, .job-company-renewal__stat"
      );
      if (stat && !stat.hasAttribute("data-job-company-listing-count")) {
        stat.remove();
      }
    });

    root.querySelectorAll("[data-seller-trust-anchor], [data-seller-rating-value]").forEach((el) => {
      const stat = el.closest(".skill-seller-stat, .seller-stat");
      if (stat) stat.remove();
    });
  }

  function stripJobLegacyUi(root = document) {
    if (!isJobPage()) return;

    LEGACY_SELECTORS.forEach((selector) => {
      root.querySelectorAll(selector).forEach((el) => el.remove());
    });

    removeLegacySellerStats(root);

    root.querySelectorAll(".tasu-trust-score").forEach((el) => {
      if (el.closest("#section-reviews")) return;
      if (/新規ユーザー|レビューなし/i.test(el.textContent || "")) {
        el.remove();
      }
    });

    root.querySelectorAll(".profile-avatar, [data-seller-avatar]").forEach(stripRankClasses);

    root.querySelectorAll(".job-top-company__logo-wrap, .job-company-avatar").forEach((el) => {
      el.classList.remove("profile-avatar", "seller-name");
    });

    root
      .querySelectorAll("[data-listing-seller], .tasu-mdetail-seller-host, .job-company-section")
      .forEach((section) => {
        delete section.dataset.sellerRank;
        section.removeAttribute("data-seller-rank");
      });

    root.querySelectorAll(".seller-more-jobs-btn span, .job-company-card__more span").forEach((el) => {
      if (/他の求人|他の商品|関連ワーカー|他のサービス/i.test(el.textContent || "")) {
        el.textContent = "掲載中の求人を見る";
      }
    });

    const relatedTitle = root.querySelector("#detailRelatedTitle");
    if (relatedTitle && /関連求人|他の商品|関連ワーカー/i.test(relatedTitle.textContent || "")) {
      relatedTitle.textContent = "この企業の他の求人";
    }

    root.querySelectorAll("#otherServices .detail-bottom-card__more").forEach((el) => {
      el.hidden = true;
      el.setAttribute("hidden", "");
    });
  }

  let legacyCleanupQueued = false;

  function scheduleJobLegacyCleanup() {
    if (!isJobPage()) return;
    if (document.body?.dataset?.listingLoaded !== "true") return;
    if (legacyCleanupQueued) return;
    legacyCleanupQueued = true;
    requestAnimationFrame(() => {
      legacyCleanupQueued = false;
      markJobTopCard();
      stripJobLegacyUi(document);
      syncJobSidebarCta();
      syncJobSectionNavVisibility();
      syncJobBottomDockCtas();
    });
  }

  function bindJobLegacyCleanupEvents() {
    const events = [
      "tasu:listing-applied",
      "tasu:listing-seller-ready",
      "tasu:listing-loaded",
    ];
    events.forEach((name) => {
      window.addEventListener(name, scheduleJobLegacyCleanup);
    });
  }

  function init() {
    if (!isJobPage()) return;
    markJobTopCard();
    initBackLinks();
    initGallery();
    initSectionNav();
    initJobBottomDockCtas();
    initJobMobileFixedCtaReveal();
    initStripScroll();
    bindJobLegacyCleanupEvents();
  }

  window.TasuDetailJob = {
    refresh: scheduleJobLegacyCleanup,
    refreshFixedCtaReveal: refreshJobMobileFixedCtaReveal,
    stripJobLegacyUi: stripJobLegacyUi,
    syncJobSidebarCta,
    syncJobSectionNavVisibility,
    syncJobBottomDockCtas,
    markJobTopCard,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
