/**
 * 業務サービス詳細 — タブ＋CTA 追従バー（detail-business-service.html）
 */
(function () {
  "use strict";

  const SELECTORS = {
    nav: "[data-business-sticky-action-nav]",
    tabs: "[data-business-sticky-action-tabs]",
    actions: "[data-business-sticky-action-actions]",
    spacer: "[data-business-sticky-action-spacer]",
  };

  const TAB_DEFS = [
    { key: "overview", label: "概要", sectionId: "section-overview" },
    { key: "menu", label: "サービスメニュー", sectionId: "section-service-menu" },
    { key: "achievements", label: "実績", sectionId: "section-achievements" },
    { key: "staff", label: "スタッフ", sectionId: "section-license" },
    { key: "reviews", label: "口コミ", sectionId: "section-reviews" },
    { key: "access", label: "アクセス", sectionId: "section-service-area", fallbackId: "section-company-info" },
    { key: "faq", label: "FAQ", sectionId: "section-faq" },
  ];

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function isSectionVisible(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return false;
    if (el.hidden || el.hasAttribute("hidden")) return false;
    if (el.classList.contains("bsd-sr-only")) return false;
    return true;
  }

  function resolveSectionId(def) {
    if (isSectionVisible(def.sectionId)) return def.sectionId;
    if (def.fallbackId && isSectionVisible(def.fallbackId)) return def.fallbackId;
    return null;
  }

  function isGeneralDetailContext(listing) {
    if (document.body?.dataset?.detailType === "general") return true;
    if (String(listing?._detail_page_type || "").trim() === "general") return true;
    const type = String(listing?.listingType || listing?.listing_type || "")
      .trim()
      .toLowerCase();
    return type === "general" || type === "other" || type === "その他";
  }

  function hasReviewData(listing) {
    const store = globalThis.TasuListingLocalStore;
    if (store?.hasGeneralReviewData) return store.hasGeneralReviewData(listing);
    const reviews = listing?.reviews;
    return Array.isArray(reviews) && reviews.length > 0;
  }

  function hasAccessData(listing) {
    const store = globalThis.TasuListingLocalStore;
    if (store?.hasGeneralAccessData) return store.hasGeneralAccessData(listing);
    const area = String(listing?.serviceArea ?? listing?.service_area ?? "").trim();
    return Boolean(area);
  }

  function hasEventInfo(listing) {
    const store = globalThis.TasuListingLocalStore;
    if (store?.hasGeneralEventInfo) return store.hasGeneralEventInfo(listing);
    const info = listing?.eventInfo || listing?.event_info;
    if (!info || typeof info !== "object") return false;
    return Boolean(
      String(info.date || "").trim() ||
        String(info.time || "").trim() ||
        String(info.location || "").trim() ||
        String(info.capacity || "").trim()
    );
  }

  function hasOrganizerInfo(listing) {
    const store = globalThis.TasuListingLocalStore;
    if (store?.hasGeneralOrganizerInfo) return store.hasGeneralOrganizerInfo(listing);
    return Boolean(String(listing?.organizer || listing?.company_name || "").trim());
  }

  function getGeneralTabDefs(listing) {
    const defs = [{ key: "overview", label: "概要", sectionId: "section-overview" }];
    if (hasEventInfo(listing)) {
      defs.push({
        key: "event",
        label: "開催情報",
        sectionId: "section-general-event-info",
      });
    }
    if (hasOrganizerInfo(listing)) {
      defs.push({
        key: "organizer",
        label: "主催者情報",
        sectionId: "section-general-organizer",
      });
    }
    if (hasReviewData(listing)) {
      defs.push({ key: "reviews", label: "口コミ", sectionId: "section-reviews" });
    }
    if (hasAccessData(listing)) {
      defs.push({
        key: "access",
        label: "アクセス",
        sectionId: "section-service-area",
        fallbackId: "section-company-info",
      });
    }
    return defs;
  }

  function buildVisibleTabs(listing) {
    if (isGeneralDetailContext(listing)) {
      const overview = document.getElementById("section-overview");
      if (overview) {
        overview.hidden = false;
        overview.removeAttribute("hidden");
      }
    }
    const defs = isGeneralDetailContext(listing) ? getGeneralTabDefs(listing) : TAB_DEFS;
    return defs
      .map((def) => {
        let sectionId = resolveSectionId(def);
        if (!sectionId && isGeneralDetailContext(listing) && def.key === "overview") {
          sectionId = document.getElementById(def.sectionId) ? def.sectionId : null;
        }
        if (
          !sectionId &&
          isGeneralDetailContext(listing) &&
          (def.key === "event" || def.key === "organizer")
        ) {
          sectionId = document.getElementById(def.sectionId) ? def.sectionId : null;
        }
        if (!sectionId) return null;
        return { ...def, sectionId, href: `#${sectionId}` };
      })
      .filter(Boolean);
  }

  function usesMobileDetailChrome() {
    try {
      return (
        window.matchMedia("(max-width: 960px)").matches &&
        document.body.classList.contains("biz-detail-page--business-service")
      );
    } catch {
      return false;
    }
  }

  function suspendStickyNavForMobile() {
    const nav = qs(SELECTORS.nav);
    const spacer = qs(SELECTORS.spacer);
    if (nav) {
      nav.hidden = true;
      nav.setAttribute("hidden", "");
      nav.classList.remove("is-stuck");
      nav.dataset.businessStickyNavMobileSuspended = "1";
    }
    if (spacer) {
      spacer.hidden = true;
      spacer.setAttribute("hidden", "");
      spacer.style.height = "0";
    }
    document.body.classList.remove("biz-detail-page--action-nav-stuck");
  }

  function resumeStickyNavForDesktop() {
    const nav = qs(SELECTORS.nav);
    if (!nav || nav.dataset.businessStickyNavMobileSuspended !== "1") return;
    delete nav.dataset.businessStickyNavMobileSuspended;
    if (nav.querySelector("[data-business-action-tab]")) {
      nav.hidden = false;
      nav.removeAttribute("hidden");
      if (nav.dataset.businessStickyNavBound !== "1") {
        setupStickyBehavior();
      }
    }
  }

  function bindStickyNavViewportHandoff() {
    if (window.__tasuBizStickyNavViewportBound) return;
    window.__tasuBizStickyNavViewportBound = true;
    window.addEventListener(
      "resize",
      () => {
        if (!document.body.classList.contains("biz-detail-page--business-service")) return;
        if (usesMobileDetailChrome()) suspendStickyNavForMobile();
        else resumeStickyNavForDesktop();
      },
      { passive: true }
    );
  }

  function getStickyNavTop() {
    return window.matchMedia("(max-width: 768px)").matches ? 60 : 72;
  }

  function getScrollOffset() {
    const nav = qs(SELECTORS.nav);
    const header = document.querySelector(".tasu-banner");
    const headerH = header?.getBoundingClientRect?.().height || 0;
    const navH = nav?.getBoundingClientRect?.().height || 64;
    return Math.round(getStickyNavTop() + headerH * 0 + navH + 12);
  }

  function collectFaqItems(listing) {
    const raw =
      listing?.faq_items ||
      listing?.form_data?.faq_items ||
      listing?.category_extra?.field_service?.faq_items ||
      [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (typeof item === "string") {
          const parts = String(item).split(/\n|：|:/);
          return { q: parts[0] || "", a: parts.slice(1).join("：") || "" };
        }
        return {
          q: String(item?.q || item?.question || item?.title || "").trim(),
          a: String(item?.a || item?.answer || item?.body || "").trim(),
        };
      })
      .filter((item) => item.q && item.a);
  }

  function ensureFaqSection(listing) {
    if (isGeneralDetailContext(listing)) return;
    const section = document.getElementById("section-faq");
    const host = section?.querySelector("[data-bsd-faq-list]");
    if (!section || !host) return;

    let items = collectFaqItems(listing);
    const demoId = String(listing?.id || listing?.demo_id || "").trim();
    if (!items.length && /^demo-/.test(demoId)) {
      items = [
        { q: "見積もりは無料ですか？", a: "はい、初回のヒアリング・お見積りは無料です。" },
        { q: "オンラインのみの対応は可能ですか？", a: "可能です。全国どこからでもご相談いただけます。" },
        { q: "契約前に内容を相談できますか？", a: "チャットまたはお問い合わせフォームからお気軽にご連絡ください。" },
      ];
    }
    if (!items.length) return;

    host.innerHTML = items
      .map(
        (item) =>
          `<details class="biz-detail-faq__item"><summary>${esc(item.q)}</summary><div class="biz-detail-faq__answer"><p>${esc(item.a)}</p></div></details>`
      )
      .join("");
    section.hidden = false;
    section.removeAttribute("hidden");
  }

  function getInquiryHref() {
    return "#";
  }

  function renderStickyNav(listing) {
    const nav = qs(SELECTORS.nav);
    const tabsHost = qs(SELECTORS.tabs);
    const actionsHost = qs(SELECTORS.actions);
    if (!nav || !tabsHost || !actionsHost) return;

    ensureFaqSection(listing);

    const tabs = buildVisibleTabs(listing);
    if (!tabs.length) {
      nav.hidden = true;
      nav.setAttribute("hidden", "");
      return;
    }

    const generalCfg =
      isGeneralDetailContext(listing) && globalThis.TasuDetailTypeConfig?.getConfig
        ? globalThis.TasuDetailTypeConfig.getConfig("general")
        : null;
    const ctaPrimary =
      String(listing?.ctaPrimary || generalCfg?.ctaPrimary || "見積もりを依頼する").trim();
    const ctaSecondary =
      String(listing?.ctaSecondary || generalCfg?.ctaSecondary || "相談する").trim();
    const favLabel =
      String(listing?.ctaSecondary || generalCfg?.favoriteLabel || "お気に入り").trim();

    tabsHost.innerHTML = tabs
      .map(
        (t, i) =>
          `<a class="shop-sticky-action-nav__tab${i === 0 ? " is-active" : ""}" href="${escAttr(t.href)}" data-business-action-tab="${escAttr(
            t.key
          )}" data-shop-action-tab="${escAttr(t.key)}" data-target="${escAttr(t.sectionId)}">${esc(t.label)}</a>`
      )
      .join("");

    if (isGeneralDetailContext(listing)) {
      actionsHost.innerHTML = `
      <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--gold" data-business-service-estimate>${esc(ctaPrimary)}</button>
      <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline shop-sticky-action-nav__btn--fav" data-business-service-chat data-biz-detail-favorite aria-label="お気に入りに追加" aria-pressed="false"><span class="shop-sticky-action-nav__fav-icon" aria-hidden="true">♡</span><span data-bsd-favorite-label> ${esc(favLabel)}</span></button>
    `;
    } else {
      actionsHost.innerHTML = `
      <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--gold" data-business-service-estimate>${esc(ctaPrimary)}</button>
      <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline" data-business-service-chat>${esc(ctaSecondary)}</button>
      <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline shop-sticky-action-nav__btn--fav" data-biz-detail-favorite aria-label="お気に入りに追加" aria-pressed="false"><span class="shop-sticky-action-nav__fav-icon" aria-hidden="true">♡</span><span data-bsd-favorite-label> ${esc(favLabel)}</span></button>
    `;
    }

    nav.hidden = false;
    nav.removeAttribute("hidden");
    document.body.classList.add("biz-detail-page--action-nav");
    window.TasuDetailBusinessService?.initBusinessServiceFavorites?.(listing);
    window.TasuContactActions?.mountForListing?.(listing);
    window.TasuBusinessServiceFlow?.bindConsultButtons?.(listing);
  }

  function setupStickyBehavior() {
    if (usesMobileDetailChrome()) return;
    const nav = qs(SELECTORS.nav);
    const spacer = qs(SELECTORS.spacer);
    if (!nav || nav.hidden || nav.dataset.businessStickyNavBound === "1") return;
    nav.dataset.businessStickyNavBound = "1";

    let stickY = 0;

    const applyTopVar = () => {
      const top = getStickyNavTop();
      nav.style.setProperty("--shop-sticky-nav-top", `${top}px`);
      document.documentElement.style.setProperty("--shop-sticky-nav-top", `${top}px`);
      return top;
    };

    const measure = () => {
      nav.classList.remove("is-stuck");
      document.body.classList.remove("biz-detail-page--action-nav-stuck");
      if (spacer) {
        spacer.hidden = true;
        spacer.style.height = "0";
      }
      applyTopVar();
      const top = getStickyNavTop();
      const rect = nav.getBoundingClientRect();
      stickY = rect.top + window.scrollY - top;
    };

    const update = () => {
      const shouldStick = window.scrollY >= stickY - 0.5;
      if (shouldStick) {
        if (!nav.classList.contains("is-stuck")) {
          const rect = nav.getBoundingClientRect();
          nav.style.setProperty("--shop-sticky-nav-left", `${rect.left}px`);
          nav.style.setProperty("--shop-sticky-nav-width", `${rect.width}px`);
          if (spacer) {
            spacer.style.height = `${nav.offsetHeight}px`;
            spacer.hidden = false;
            spacer.removeAttribute("hidden");
          }
        }
        nav.classList.add("is-stuck");
        document.body.classList.add("biz-detail-page--action-nav-stuck");
      } else {
        nav.classList.remove("is-stuck");
        document.body.classList.remove("biz-detail-page--action-nav-stuck");
        if (spacer) {
          spacer.hidden = true;
          spacer.setAttribute("hidden", "");
          spacer.style.height = "0";
        }
      }
    };

    const onLayout = () => {
      measure();
      update();
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onLayout, { passive: true });
    if (document.fonts?.ready) {
      document.fonts.ready.then(onLayout).catch(() => {});
    }
    requestAnimationFrame(() => requestAnimationFrame(onLayout));
  }

  function setupTabScroll() {
    const tabsHost = qs(SELECTORS.tabs);
    if (!tabsHost || tabsHost.dataset.businessStickyScrollBound === "1") return;
    tabsHost.dataset.businessStickyScrollBound = "1";

    const tabLinks = Array.from(tabsHost.querySelectorAll("[data-business-action-tab]"));

    function setActive(sectionId) {
      tabLinks.forEach((a) => {
        a.classList.toggle("is-active", a.getAttribute("data-target") === sectionId);
      });
    }

    tabLinks.forEach((a) => {
      a.addEventListener("click", (ev) => {
        const sectionId = a.getAttribute("data-target") || "";
        const el = document.getElementById(sectionId);
        if (!el) return;
        ev.preventDefault();
        setActive(sectionId);
        const top = el.getBoundingClientRect().top + window.scrollY - getScrollOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    });

    const sections = tabLinks
      .map((a) => document.getElementById(a.getAttribute("data-target") || ""))
      .filter(Boolean);

    if (sections.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target?.id) setActive(visible.target.id);
        },
        { rootMargin: `-${getScrollOffset()}px 0px -55% 0px`, threshold: [0.08, 0.2, 0.4] }
      );
      sections.forEach((el) => observer.observe(el));
    }
  }

  function hideLegacyTabBars() {
    document.querySelectorAll("[data-relax-tabs-sticky-wrap], .shop-restaurant-tabs").forEach((el) => {
      el.hidden = true;
      el.setAttribute("hidden", "");
    });
  }

  function initBusinessServiceStickyNav(listing) {
    if (!document.body.classList.contains("biz-detail-page--business-service")) return;
    hideLegacyTabBars();
    bindStickyNavViewportHandoff();
    renderStickyNav(listing);
    setupTabScroll();
    if (usesMobileDetailChrome()) {
      suspendStickyNavForMobile();
      return;
    }
    setupStickyBehavior();
  }

  function refreshStickyNav(listing) {
    const tabsHost = qs(SELECTORS.tabs);
    if (tabsHost) delete tabsHost.dataset.businessStickyScrollBound;
    const nav = qs(SELECTORS.nav);
    if (nav) delete nav.dataset.businessStickyNavBound;
    renderStickyNav(listing);
    setupTabScroll();
    if (usesMobileDetailChrome()) {
      suspendStickyNavForMobile();
      return;
    }
    setupStickyBehavior();
  }

  window.TasuDetailBusinessServiceStickyNav = {
    init: initBusinessServiceStickyNav,
    refresh: refreshStickyNav,
    suspendForMobile: suspendStickyNavForMobile,
    resumeForDesktop: resumeStickyNavForDesktop,
    buildVisibleTabs,
    ensureFaqSection,
    isGeneralDetailContext,
  };
})();
