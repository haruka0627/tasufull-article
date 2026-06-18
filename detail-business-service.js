/**
 * 業務サービス詳細 — JSON(business_service) → セクション renderer
 */
(function () {
  "use strict";

  const D = () => window.TasuBusinessServiceData;

  function getBs(listing) {
    return D()?.getBusinessService?.(listing) || null;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function pickImageUrl(raw) {
    if (!raw) return "";
    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "object") {
      return pickStr(raw.image_url, raw.url, raw.image, raw.src);
    }
    return "";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function resolveFavoriteListingId(listing) {
    try {
      const params = new URLSearchParams(window.location.search);
      return pickStr(listing?.id, listing?.listing_id, params.get("id"), params.get("listingId"));
    } catch {
      return pickStr(listing?.id, listing?.listing_id);
    }
  }

  /**
   * localStorage (tasful_favorites) — TasuFavoriteActions へ委譲
   */
  function initBusinessServiceFavorites(listing) {
    const listingId = resolveFavoriteListingId(listing);
    if (!listingId) {
      console.warn("[TasuDetailBusinessService] favorite: listing id not found in URL or listing");
    }
    window.TasuFavoriteActions?.mountForListing?.(listing);
    return listingId;
  }

  function ctaEnabled(cta, key, legacy) {
    const v = cta?.[key];
    if (v === false || v === "no" || v === "0") return false;
    if (v === true || v === "yes" || v === "1") return true;
    if (legacy == null || legacy === "") return true;
    const raw = String(legacy).trim().toLowerCase();
    if (raw === "no" || raw === "false" || raw === "0" || raw === "非表示") return false;
    return raw === "yes" || raw === "true" || raw === "1" || raw === "表示";
  }

  function removeSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    hideElement(el);
    el.setAttribute("data-empty", "true");
  }

  function setSectionVisible(section, visible) {
    if (!section) return;
    if (!visible) {
      hideElement(section);
      section.setAttribute("data-empty", "true");
      section.setAttribute("aria-hidden", "true");
      return;
    }
    showElement(section);
    section.removeAttribute("data-empty");
  }

  function isDemoBusinessServiceListing(listing) {
    const id = String(listing?.id || listing?.demo_id || "").trim();
    if (!id) return false;
    if (window.TasuListingDemoCatalog?.isBusinessServiceDemoId?.(id)) return true;
    return /^demo-(business-service|bs|business)-/i.test(id);
  }

  const DEMO_COMPLEMENT_SECTION_IDS = new Set([
    "section-service-menu",
    "section-achievements",
    "section-license",
    "section-flow",
    "section-company-info",
    "section-service-area",
    "section-overview",
    "section-faq",
    "section-reviews",
  ]);

  function sectionDomHasContent(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return false;
    if (!section.hidden && section.getAttribute("aria-hidden") !== "true") {
      /* visible sections with template placeholders still count if children exist */
    }
    switch (sectionId) {
      case "section-service-menu": {
        const tbody = section.querySelector("[data-bsd-pricing-tbody]");
        return Boolean(tbody?.querySelector("tr"));
      }
      case "section-achievements": {
        const grid =
          section.querySelector("[data-bsd-work-cases-grid]") ||
          section.querySelector("[data-biz-detail-cases]");
        return Boolean(
          grid?.querySelector(".bsd-work-case-card, article, .biz-detail-case-card")
        );
      }
      case "section-license": {
        const list = section.querySelector("[data-bsd-license-list]");
        return Boolean(list?.querySelector("[data-bsd-cert-item], li, article"));
      }
      case "section-flow": {
        const steps = section.querySelector("[data-bsd-flow-steps]");
        return Boolean(steps?.querySelector("li, .bsd-flow__step"));
      }
      case "section-company-info": {
        const tbody = section.querySelector("[data-bsd-company-table]");
        return Boolean(tbody?.querySelector("tr"));
      }
      case "section-service-area": {
        return Boolean(
          section.querySelector("[data-bsd-area-online-value], [data-bsd-area-visit-value]")?.textContent?.trim() ||
            section.querySelector(".bsd-area-v2__mode-value")?.textContent?.trim() ||
            section.querySelector(".area-panel__pill")
        );
      }
      case "section-overview": {
        return Boolean(
          section.querySelector("[data-bsd-overview-description], .business-summary__description")?.textContent?.trim() ||
            section.querySelector("[data-bsd-overview-cards]")?.children?.length
        );
      }
      case "section-faq": {
        const host = section.querySelector("[data-bsd-faq-list], .biz-detail-faq");
        return Boolean(host?.querySelector("details, .biz-detail-faq__item"));
      }
      case "section-reviews": {
        const strip = section.querySelector("[data-biz-detail-reviews-strip]");
        return Boolean(
          strip?.querySelector(".reviews-panel__card, .taxi-review-section__card") ||
            Number(section.querySelector("[data-biz-detail-review-count]")?.textContent || 0) > 0
        );
      }
      default:
        return Boolean(section.textContent?.replace(/\s+/g, "").length > 40);
    }
  }

  function shouldHideEmptySection(listing, sectionId, dataEmpty) {
    if (!dataEmpty) return false;
    if (sectionDomHasContent(sectionId)) return false;
    if (isDemoBusinessServiceListing(listing) && DEMO_COMPLEMENT_SECTION_IDS.has(sectionId)) {
      return false;
    }
    return true;
  }

  function showElement(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.setAttribute("aria-hidden", "false");
    el.classList.remove("is-hidden");
    el.style.removeProperty("display");
  }

  function hideElement(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.setAttribute("aria-hidden", "true");
  }

  function showTrustSectionHeader(section) {
    if (!section) return;
    section.querySelectorAll(".bsd-trust-section__head, .bsd-section__head").forEach((head) => {
      showElement(head);
    });
  }

  function goldFeatureIconSvg() {
    return `<svg class="bsd-feature-pill__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 4.5 4.9.7-3.5 3.4.8 4.9L12 14.1l-4.4 2.4.8-4.9-3.5-3.4 4.9-.7L12 2z" fill="currentColor"/></svg>`;
  }

  function buildFeaturePillHtml(label) {
    return `<span class="bsd-feature-pill"><span class="bsd-feature-pill__icon-wrap" aria-hidden="true">${goldFeatureIconSvg()}</span><span class="bsd-feature-pill__label">${escapeHtml(label)}</span></span>`;
  }

  function buildCertItemHtml(item) {
    const label = pickStr(item?.label);
    const value = pickStr(item?.value);
    if (!label && !value) return "";
    return `<article class="bsd-cert-item" role="listitem">
      <span class="bsd-cert-item__check" aria-hidden="true">✓</span>
      <div class="bsd-cert-item__body">
        <p class="bsd-cert-item__name">${escapeHtml(label || "資格・許可")}</p>
        ${value ? `<p class="bsd-cert-item__desc">${escapeHtml(value)}</p>` : ""}
      </div>
    </article>`;
  }

  const TRUST_SECTION_TITLE = "資格・認証・対応実績";
  const TRUST_SECTION_LEAD =
    "保有資格・認証・対応実績の一例です。詳細は掲載者へお問い合わせください。";

  /** 詳細ページに公開する資格テキスト（画像はDB保存のみ・画面非表示） */
  function getPublicCertifications(bs) {
    return (Array.isArray(bs?.certifications) ? bs.certifications : []).filter(
      (item) => pickStr(item?.label) || pickStr(item?.value)
    );
  }

  function hasPublicCertifications(bs) {
    return getPublicCertifications(bs).length > 0;
  }

  function renderTrustVerificationBadges(section, bs) {
    const host = section?.querySelector("[data-bsd-trust-verification-badges]");
    if (!host) return;
    const flags = bs?.trust_verification || {};
    const showAi = flags.ai_verified === true || flags.ai === true;
    const showOps = flags.ops_verified === true || flags.ops === true;
    if (!showAi && !showOps) {
      hideElement(host);
      return;
    }
    host.querySelector('[data-bsd-trust-badge="ai"]')?.toggleAttribute("hidden", !showAi);
    host.querySelector('[data-bsd-trust-badge="ops"]')?.toggleAttribute("hidden", !showOps);
    showElement(host);
  }

  function shouldUseDemo(listing, kind) {
    const bs = getBs(listing);
    const data = D();
    if (!bs || !data) return true;
    switch (kind) {
      case "menu":
        return !data.hasMenuItems(bs);
      case "cases":
        return !data.hasWorkCases(bs);
      case "license":
        return !hasPublicCertifications(bs);
      case "flow":
        return !data.hasFlowSteps(bs);
      case "reviews":
        return !(listing?.reviewCount > 0);
      default:
        return true;
    }
  }

  const MAX_HERO_TOP_TAGS = 4;
  const MAX_HERO_BOTTOM_TAGS = 5;

  const HERO_TOP_TAG_HINTS = [
    "BtoB対応",
    "法人対応",
    "全国対応",
    "オンライン対応",
    "出張対応",
    "見積無料",
  ];

  function collectHeroTopTags(listing, bs) {
    const out = [];
    const seen = new Set();
    const add = (raw) => {
      const label = normalizeTagLabel(String(raw || "").trim());
      if (!label || seen.has(label) || out.length >= MAX_HERO_TOP_TAGS) return;
      seen.add(label);
      out.push(label);
    };
    add(listing.categoryLabel || listing.category_label || bs?.hero?.category_label);
    HERO_TOP_TAG_HINTS.forEach((hint) => {
      const blob = [
        ...(Array.isArray(bs?.badges) ? bs.badges : []),
        ...(Array.isArray(listing.tags) ? listing.tags : []),
        ...(Array.isArray(listing.service_tags) ? listing.service_tags : []),
        pickStr(bs?.hero?.service_area_summary, listing.service_area),
      ].join(" ");
      if (blob.includes(hint)) add(hint);
    });
    (listing.service_tags || []).forEach(add);
    (listing.tags || []).forEach(add);
    (Array.isArray(bs?.badges) ? bs.badges : []).forEach(add);
    return out.slice(0, MAX_HERO_TOP_TAGS);
  }

  function renderHeroTopTags(listing, bs) {
    const tags = collectHeroTopTags(listing, bs);
    const wrap = document.querySelector("[data-bsd-hero-top-tags]");
    const categoryEl = document.querySelector("[data-bsd-hero-category]");
    const genreEl = document.querySelector("[data-biz-detail-hero-genre-tags]");
    if (!wrap) return tags;
    if (categoryEl) {
      categoryEl.hidden = true;
      categoryEl.textContent = "";
    }
    if (genreEl) {
      genreEl.hidden = tags.length === 0;
      genreEl.innerHTML = tags
        .map((t) => `<span class="bsd-hero__pill biz-detail-hero__genre-tag">${escapeHtml(t)}</span>`)
        .join("");
    }
    wrap.hidden = tags.length === 0;
    return tags;
  }

  function renderHeroBottomTags(listing, bs, topTagSet) {
    const host = document.querySelector("[data-bsd-hero-bottom-tags]");
    if (!host) return;
    const raw = [
      ...(Array.isArray(listing.service_tags) ? listing.service_tags : []),
      ...(Array.isArray(listing.tags) ? listing.tags : []),
      ...badgesFromBs(bs),
      ...(Array.isArray(bs?.overview?.features) ? bs.overview.features : []),
    ];
    const tags = pickOverviewTags(raw, topTagSet).slice(0, MAX_HERO_BOTTOM_TAGS);
    host.innerHTML = tags.map((t) => `<span class="bsd-hero__tag">${escapeHtml(t)}</span>`).join("");
    host.hidden = tags.length === 0;
    if (tags.length) host.removeAttribute("hidden");
  }

  function stripPhoneCtasFromDom() {
    document.querySelectorAll("[data-bsd-cta-phone], [data-bsd-sticky-phone]").forEach((el) => el.remove());
    const actions = document.querySelector("[data-biz-detail-sidebar-actions]");
    if (actions) {
      actions.querySelectorAll('a[href^="tel:"]').forEach((el) => el.remove());
    }
  }

  function renderHeroMetaRows(listing, bs) {
    const quick = document.querySelector("[data-biz-detail-hero-quick]");
    if (!quick) return;
    const rows = [
      {
        icon: "📍",
        label: "対応エリア",
        value: pickStr(bs?.hero?.service_area_summary, listing.service_area),
      },
    ].filter((r) => r.value);
    quick.hidden = rows.length === 0;
    quick.className = "bsd-hero__meta bsd-hero__meta--area hero-meta-grid hero-meta-row biz-detail-quick";
    quick.innerHTML = rows
      .map(
        (r) =>
          `<li class="bsd-hero__quick-item"><span class="bsd-hero__quick-icon" aria-hidden="true">${r.icon}</span><span><span class="bsd-hero__quick-label">${escapeHtml(r.label)}：</span>${escapeHtml(r.value)}</span></li>`
      )
      .join("");
  }

  function bindHeroLeadExpand() {
    const block = document.querySelector("[data-bsd-hero-lead-block]");
    const lead = document.querySelector("[data-biz-detail-hero-lead]");
    const btn = document.querySelector("[data-bsd-hero-lead-more]");
    if (!block || !lead || !btn) return;
    const sync = () => {
      const expanded = block.classList.contains("is-expanded");
      const overflow = lead.scrollHeight > lead.clientHeight + 2;
      const needsToggle = expanded || overflow;
      btn.hidden = !needsToggle;
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.querySelector(".bsd-hero__lead-more-label").textContent = expanded ? "閉じる" : "もっと見る";
    };
    if (!btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        block.classList.toggle("is-expanded");
        sync();
      });
    }
    requestAnimationFrame(sync);
  }

  function renderHeroLead(listing, bs) {
    const block = document.querySelector("[data-bsd-hero-lead-block]");
    const leadEl = document.querySelector("[data-biz-detail-hero-lead]");
    if (!leadEl) return;
    const text = pickStr(
      bs?.hero?.short_description,
      bs?.hero?.catch_copy,
      listing.catch_copy,
      bs?.hero?.service_description,
      listing.description
    );
    if (!text) {
      if (block) block.hidden = true;
      leadEl.hidden = true;
      return;
    }
    leadEl.textContent = text;
    leadEl.hidden = false;
    if (block) {
      block.hidden = false;
      block.classList.remove("is-expanded");
      block.removeAttribute("hidden");
    }
    bindHeroLeadExpand();
  }

  function renderHeroTrustBadges(listing) {
    const verified = document.querySelector("[data-bsd-verified-badge]");
    if (verified) {
      const show = listing.isVerified === true || listing.is_verified === true;
      verified.hidden = !show;
    }
    const achievement = document.querySelector("[data-bsd-hero-achievement]");
    if (achievement) {
      const cases = getBs(listing)?.work_cases;
      const hasCases = Array.isArray(cases) && cases.length > 0;
      const achievementsText = String(listing.achievements || "").trim();
      const show =
        hasCases || (achievementsText && !/^(yes|no|true|false)$/i.test(achievementsText));
      achievement.hidden = !show;
    }
    const prBadge = document.querySelector("[data-bsd-pr-badge]");
    if (prBadge) {
      const showPr = listing.isPr === true || listing.is_pr === true;
      prBadge.hidden = !showPr;
    }
    const titleBadges = document.querySelector("[data-biz-detail-title-badges]");
    if (titleBadges) {
      titleBadges.querySelectorAll(".biz-detail-hero__pr").forEach((el) => el.remove());
      const corpOnly = titleBadges.querySelector(".biz-detail-hero__corp-badge");
      titleBadges.hidden = !corpOnly;
      titleBadges.setAttribute("aria-hidden", corpOnly ? "false" : "true");
    }
  }

  /** ヒーローTOP：3カラム向けに情報量を整理 */
  function renderHeroSection(listing) {
    const bs = getBs(listing);
    if (!bs) return;

    const topTags = renderHeroTopTags(listing, bs);
    const topSet = new Set(topTags);

    renderHeroMetaRows(listing, bs);
    renderHeroBottomTags(listing, bs, topSet);
    renderHeroLead(listing, bs);
    renderHeroTrustBadges(listing);

    const featureRow = document.querySelector("[data-bsd-hero-feature-row]");
    if (featureRow) {
      featureRow.innerHTML = "";
      featureRow.hidden = true;
      featureRow.setAttribute("hidden", "");
      featureRow.setAttribute("aria-hidden", "true");
    }

    const tagsHost = document.querySelector("[data-biz-detail-hero-condition-tags]");
    if (tagsHost) {
      tagsHost.innerHTML = "";
      tagsHost.hidden = true;
    }
    stripPhoneCtasFromDom();
  }

  function badgesFromBs(bs) {
    return Array.isArray(bs.badges) ? bs.badges : [];
  }

  const HERO_TAG_ALLOWLIST = [
    "見積無料",
    "全国対応",
    "法人対応",
    "オンライン対応",
    "24時間緊急対応",
    "夜間作業対応",
  ];

  const OVERVIEW_TAG_ALLOWLIST = [
    "定期清掃",
    "設備点検",
    "緊急出動",
    "月額契約",
    "有資格者対応",
  ];

  const OVERVIEW_TAG_PRIORITY = OVERVIEW_TAG_ALLOWLIST;
  const MAX_OVERVIEW_TAGS = 5;

  const BADGE_LABEL_ALIAS = {
    "24時間受付": "24時間緊急対応",
    "夜間対応": "夜間作業対応",
    "写真報告対応": "写真報告",
    "定期契約対応": "月額契約",
    "有資格者在籍": "有資格者対応",
  };

  function normalizeTagLabel(label) {
    const t = String(label || "").trim();
    return BADGE_LABEL_ALIAS[t] || t;
  }

  function pickAllowedTags(tags, allowlist, excludeSet) {
    const allow = new Set(allowlist);
    const out = [];
    const seen = new Set();
    (tags || []).forEach((raw) => {
      const t = normalizeTagLabel(raw);
      if (!t || !allow.has(t)) return;
      if (excludeSet?.has(t)) return;
      if (seen.has(t)) return;
      seen.add(t);
      out.push(t);
    });
    return out;
  }

  function pickOverviewTags(tags, excludeSet) {
    const picked = pickAllowedTags(tags, OVERVIEW_TAG_ALLOWLIST, excludeSet);
    const priority = [];
    OVERVIEW_TAG_PRIORITY.forEach((label) => {
      if (picked.includes(label)) priority.push(label);
    });
    const rest = picked.filter((label) => !priority.includes(label));
    return [...priority, ...rest].slice(0, MAX_OVERVIEW_TAGS);
  }

  function renderOverviewSection(listing) {
    const bs = getBs(listing);
    const section = document.getElementById("section-overview");
    const cardsHost = document.querySelector("[data-bsd-overview-cards]");
    const kpiWrap = document.querySelector("[data-bsd-overview-kpis-wrap]");
    const kpiHost = document.querySelector("[data-bsd-overview-kpis]");
    const descEl =
      document.querySelector("[data-bsd-overview-description]") ||
      document.querySelector(".business-summary__description");
    const text = pickStr(bs?.overview?.text, bs?.hero?.service_description, listing.description);
    if (descEl) {
      descEl.textContent = text;
      descEl.hidden = !text;
    }
    const rawBadges = badgesFromBs(bs);
    // 特徴は「TOP特徴タグ（旧）」を業務概要セクションでチェックリスト表示に集約
    const overviewTags = pickAllowedTags(rawBadges, HERO_TAG_ALLOWLIST);
    const features = overviewTags.map((f) => String(f || "").trim()).filter(Boolean);
    if (cardsHost) {
      cardsHost.className = "business-summary__checklist bsd-overview-checklist";
      cardsHost.innerHTML = features
        .map(
          (label) =>
            `<div class="business-summary__check"><span class="business-summary__check-icon" aria-hidden="true">✓</span><span class="business-summary__check-text">${escapeHtml(label)}</span></div>`
        )
        .join("");
      cardsHost.hidden = features.length === 0;
    }

    const kpisRaw = Array.isArray(bs?.overview?.kpis) ? bs.overview.kpis : [];
    const kpis = kpisRaw
      .map((k) => ({
        label: pickStr(k?.label, k?.name),
        value: pickStr(k?.value),
      }))
      .filter((k) => k.label && k.value)
      .slice(0, 4);
    if (kpiWrap && kpiHost) {
      if (kpis.length) {
        kpiHost.innerHTML = kpis
          .map(
            (k) =>
              `<div class="bsd-kpi-card"><p class="bsd-kpi-card__label">${escapeHtml(k.label)}</p><p class="bsd-kpi-card__value">${escapeHtml(k.value)}</p></div>`
          )
          .join("");
        kpiWrap.hidden = false;
        kpiWrap.removeAttribute("hidden");
      } else {
        kpiHost.innerHTML = "";
        kpiWrap.hidden = true;
        kpiWrap.setAttribute("hidden", "");
      }
    }
    setSectionVisible(section, Boolean(text || features.length || kpis.length));
  }

  function renderMenuSection(listing) {
    const bs = getBs(listing);
    const section = document.getElementById("section-service-menu");
    const tbody = document.querySelector("[data-bsd-pricing-tbody]");
    if (!section || !tbody) return;
    let items = (bs?.menu_items || []).map((item) => ({
      title: item.title,
      description: item.description,
      scope: item.scope,
      price: item.price,
      notes: item.notes,
    }));
    if (!items.length) {
      const raw =
        listing?.service_menu_items ||
        listing?.form_data?.service_menu_items ||
        [];
      items = (Array.isArray(raw) ? raw : []).map((item) => ({
        title: item.title || item.label || item.name,
        description: item.description || item.desc,
        scope: item.scope || item.location,
        price: item.price || item.amount,
        notes: item.notes || item.note,
      }));
    }
    if (!items.length) {
      setSectionVisible(section, false);
      return;
    }
    tbody.innerHTML = items
      .map((item) => {
        const detail = [item.description, item.scope].filter(Boolean).join(" / ");
        return `<tr><td class="service-name">${escapeHtml(item.title || "サービス")}</td><td class="service-menu-detail">${escapeHtml(detail || "—")}</td><td class="service-menu-price">${escapeHtml(item.price || "要見積")}</td></tr>`;
      })
      .join("");
    const footnotes = section.querySelector("[data-bsd-pricing-footnotes]");
    const menuNotes = items.map((i) => i.notes).filter(Boolean);
    if (footnotes) {
      footnotes.innerHTML = menuNotes.length
        ? [...menuNotes.map((n) => `<p>${escapeHtml(n)}</p>`), `<p>※料金は税別表示です。</p>`].join("")
        : `<p>※上記は目安です。ご要望によりお見積りいたします。</p><p>※料金は税別表示です。</p>`;
    }
    setSectionVisible(section, true);
  }

  function buildWorkCaseCardHtml(item) {
    const title = pickStr(item.title);
    const description = pickStr(item.description, item.content);
    const outcome = pickStr(item.outcome, item.result);
    const imageUrl = pickImageUrl(item.image_url, item.image);
    return `<article class="bsd-work-case-card">
      <div class="bsd-work-case-card__media${imageUrl ? "" : " bsd-work-case-card__media--empty"}">
        ${imageUrl ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(title || "事例画像")}" loading="lazy" decoding="async">` : ""}
      </div>
      <div class="bsd-work-case-card__body">
        <h3 class="bsd-work-case-card__title">${escapeHtml(title || "事例")}</h3>
        ${description ? `<p class="bsd-work-case-card__desc">${escapeHtml(description)}</p>` : `<p class="bsd-work-case-card__desc bsd-work-case-card__desc--empty" aria-hidden="true"></p>`}
        <div class="bsd-work-case-card__footer">
          ${outcome ? `<span class="bsd-work-case-card__outcome-tag">${escapeHtml(outcome)}</span>` : ""}
        </div>
      </div>
    </article>`;
  }

  function renderWorkCasesSection(listing) {
    const bs = getBs(listing);
    const section = document.getElementById("section-achievements");
    const grid =
      document.querySelector("[data-bsd-work-cases-grid]") ||
      document.querySelector("[data-biz-detail-cases]");
    const lead = document.querySelector("[data-biz-detail-cases-lead]");
    if (!grid) return;

    const cases = (bs?.work_cases || [])
      .map((item) => ({
        title: pickStr(item.title),
        description: pickStr(item.description, item.content),
        outcome: pickStr(item.outcome, item.result),
        region: pickStr(item.region, item.area),
        period: pickStr(item.period, item.duration),
        price: pickStr(item.price, item.cost),
        image_url: pickImageUrl(item.image_url, item.image),
      }))
      .filter(
        (item) =>
          item.title ||
          item.description ||
          item.outcome ||
          item.region ||
          item.period ||
          item.price ||
          item.image_url
      );

    if (!cases.length) {
      setSectionVisible(section, false);
      return;
    }

    if (lead) lead.textContent = "実際の支援・施工・対応事例です。";
    grid.className = "bsd-work-cases-grid biz-detail-cases";
    grid.innerHTML = cases.map(buildWorkCaseCardHtml).join("");
    setSectionVisible(section, true);
  }

  function renderCertificationsSection(listing) {
    const bs = getBs(listing);
    const section = document.getElementById("section-license");
    if (!section) return;

    const listWrap = section.querySelector("[data-bsd-cert-list-wrap]");
    const listHost = section.querySelector("[data-bsd-license-list]");
    const titleEl =
      section.querySelector(".bsd-trust-section__title") || document.getElementById("bsdTrustTitle");
    const leadEl = section.querySelector("[data-biz-detail-license-lead]");

    const certs = getPublicCertifications(bs);
    if (!certs.length) {
      setSectionVisible(section, false);
      return;
    }

    setSectionVisible(section, true);
    showTrustSectionHeader(section);

    if (titleEl) titleEl.textContent = TRUST_SECTION_TITLE;
    if (leadEl) leadEl.textContent = TRUST_SECTION_LEAD;

    renderTrustVerificationBadges(section, bs);

    if (listHost) {
      listHost.innerHTML = certs.map((item) => buildCertItemHtml(item)).join("");
      showElement(listHost);
    }
    if (listWrap) showElement(listWrap);
  }

  const renderLicenseSection = renderCertificationsSection;

  function renderFlowSection(listing) {
    const bs = getBs(listing);
    const host = document.querySelector("[data-bsd-flow-steps]");
    const section = document.getElementById("section-flow");
    if (!host) return;
    const steps = (bs?.flow_steps || []).map((s) => ({
      title: s.title || "",
      desc: s.desc || s.description || "",
    }));
    host.innerHTML = steps
      .map(
        (step, i) =>
          `<li class="bsd-flow__step request-flow__step"><span class="bsd-flow__num">${i + 1}</span><h3 class="bsd-flow__title">${escapeHtml(step.title)}</h3><p class="bsd-flow__desc">${escapeHtml(step.desc)}</p></li>`
      )
      .join("");
    setSectionVisible(section, steps.length > 0);
  }

  function renderCompanySection(listing) {
    const bs = getBs(listing);
    const tbody = document.querySelector("[data-bsd-company-table]");
    const section = document.getElementById("section-company-info");
    if (!tbody) return;
    const c = bs?.company_info || {};
    const rows = [
      { label: "会社名", value: pickStr(listing.company_name, c.company_name) },
      { label: "代表者名", value: c.representative },
      { label: "郵便番号", value: c.postal_code },
      { label: "住所", value: pickStr(c.address, listing.address) },
      { label: "設立年", value: c.established_year },
      { label: "事業内容", value: c.business_content },
      {
        label: "公式サイト",
        value: c.website_url || listing.hp_url,
        html: (c.website_url || listing.hp_url)
          ? `<a href="${escapeAttr(c.website_url || listing.hp_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.website_url || listing.hp_url)}</a>`
          : "",
      },
      { label: "インボイス登録番号", value: c.invoice_number || listing.invoice_number },
      {
        label: "SNS",
        value: c.sns_url,
        html: c.sns_url
          ? `<a href="${escapeAttr(c.sns_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.sns_url)}</a>`
          : "",
      },
      { label: "電話", value: pickStr(c.phone, listing.phone) },
    ].filter((r) => r.value);
    tbody.innerHTML = rows
      .map((r) => `<tr><th scope="row">${escapeHtml(r.label)}</th><td>${r.html || escapeHtml(r.value)}</td></tr>`)
      .join("");
    setSectionVisible(section, rows.length > 0);
  }

  function renderAreaSection(listing, deps) {
    const bs = getBs(listing);
    const section = document.getElementById("section-service-area");
    const a = bs?.area_info || {};
    const onlineEnabled = a.online_support === "yes";
    const visitEnabled = a.visit_support === "yes";

    const onlineValue = onlineEnabled ? "全国対応" : "要相談";
    const visitValue = pickStr(a.primary, listing.service_area) || (visitEnabled ? "要相談" : "—");

    const onlineEl = section?.querySelector("[data-bsd-area-online-value]");
    if (onlineEl) onlineEl.textContent = onlineValue;
    const visitEl = section?.querySelector("[data-bsd-area-visit-value]");
    if (visitEl) visitEl.textContent = visitValue;

    const onlineCard = section?.querySelector("[data-bsd-area-online-card]");
    if (onlineCard) onlineCard.dataset.enabled = onlineEnabled ? "1" : "0";
    const visitCard = section?.querySelector("[data-bsd-area-visit-card]");
    if (visitCard) visitCard.dataset.enabled = visitEnabled ? "1" : "0";

    const infoOnline = section?.querySelector("[data-bsd-area-info-online]");
    if (infoOnline) infoOnline.dataset.enabled = onlineEnabled ? "1" : "0";
    const infoVisit = section?.querySelector("[data-bsd-area-info-visit]");
    if (infoVisit) infoVisit.dataset.enabled = visitEnabled ? "1" : "0";

    setSectionVisible(section, Boolean(onlineEnabled || visitEnabled || visitValue));
  }

  function getHeroCtaActionsHost() {
    return (
      document.querySelector("[data-biz-detail-sidebar-actions]") ||
      document.querySelector("[data-bsd-cta-actions]")
    );
  }

  /** 上部右カラム CTA（見積・チャット）— 常にチャット遷移用 data 属性付き */
  function buildDefaultHeroCtaButtonsHtml(listing, bs) {
    const cta = bs?.cta || {};
    const goldBtn =
      "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold bsd-btn bsd-btn--primary";
    const outlineBtn = "biz-detail-btn biz-detail-btn--outline bsd-btn bsd-btn--outline";
    const inquiryText = pickStr(cta.inquiry_text, "問い合わせる");
    const Category = window.TasuPlatformChatCategoryFlow;
    const cat = window.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "business_service";
    const connectEnabled = Category?.isCategoryConnectEnabled?.(listing, cat) === true;
    const parts = [];
    if (connectEnabled) {
      const estimateText = pickStr(cta.estimate_text, "見積もりを依頼する");
      parts.push(
        `<button type="button" class="${goldBtn}" data-business-service-estimate data-biz-detail-estimate>${escapeHtml(estimateText)}</button>`
      );
    }
    parts.push(
      `<button type="button" class="${outlineBtn}" data-business-service-chat data-biz-detail-inquiry>${escapeHtml(inquiryText)}</button>`
    );
    return parts.join("");
  }

  function ensureHeroCtaColumnVisible() {
    const aside = document.querySelector(
      ".bsd-hero__col--cta, .biz-detail-fv__aside.field-service-cta-wrap, .biz-detail-fv__aside"
    );
    const card = document.querySelector(".bsd-cta-card.hero-cta-card, .bsd-cta-card.biz-detail-fv-card");
    const fav = document.querySelector("[data-biz-detail-favorite]");
    const actions = getHeroCtaActionsHost();
    [aside, card, fav, actions].forEach((el) => {
      if (!el) return;
      el.hidden = false;
      el.removeAttribute("hidden");
      el.removeAttribute("aria-hidden");
      el.style.removeProperty("display");
      el.style.removeProperty("visibility");
    });
  }

  function bindHeroCtaConsultButtons(listing) {
    const flow = window.TasuBusinessServiceFlow;
    flow?.bindConsultButtons?.(listing);
    if (!flow?.startConsultation) return;
    document.querySelectorAll("[data-business-service-chat]").forEach((el) => {
      if (el.dataset.bsfBound) return;
      el.dataset.bsfBound = "1";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const btn = ev.currentTarget;
        if (btn?.disabled) return;
        btn.disabled = true;
        flow
          .startConsultation(listing, { intent: "consult" })
          .catch((err) => {
            alert(err.message || "チャットを開始できませんでした");
            if (btn) btn.disabled = false;
          });
      });
    });
  }

  function renderCtaSection(listing, ctx) {
    const bs = getBs(listing);
    stripPhoneCtasFromDom();
    const doc = (bs?.documents || [])[0];
    const materials = document.querySelector("[data-bsd-materials-link]");
    const docUrl = pickStr(doc?.url);
    if (materials && docUrl) {
      materials.href = docUrl;
      materials.hidden = false;
      const label = document.querySelector(".bsd-cta-materials-card__label");
      if (label) label.textContent = doc?.name || "資料をダウンロードする";
    } else if (materials) {
      materials.hidden = true;
    }

    const actionsHost = getHeroCtaActionsHost();
    if (actionsHost) {
      let html = "";
      if (ctx?.deps) {
        html = buildSidebarCtasHtml(listing, bs, ctx.ctas, ctx.deps);
      }
      if (!html.trim()) {
        html = buildDefaultHeroCtaButtonsHtml(listing, bs);
      }
      actionsHost.innerHTML = html;
      ensureHeroCtaColumnVisible();
      bindHeroCtaConsultButtons(listing);
    }
    stripPhoneCtasFromDom();
    window.TasuPlatformChatCategoryFlow?.applyConnectRequiredListingUiPolicy?.(listing);
  }

  function buildSidebarCtasHtml(listing, bs, ctas, deps) {
    const cta = bs?.cta || {};
    const goldBtn = "biz-detail-btn biz-detail-btn--primary biz-detail-btn--taxi-gold";
    const outlineBtn = "biz-detail-btn biz-detail-btn--outline";
    const parts = [];
    const Category = window.TasuPlatformChatCategoryFlow;
    const cat = window.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "business_service";
    const connectEnabled = Category?.isCategoryConnectEnabled?.(listing, cat) === true;
    const estimateText = pickStr(cta.estimate_text, "見積もりを依頼する");
    const inquiryText = pickStr(cta.inquiry_text, ctas?.primaryLabel, "問い合わせる");
    if (connectEnabled && ctaEnabled(cta, "estimate_enabled", cta.show_estimate)) {
      parts.push(
        `<button type="button" class="${goldBtn}" data-business-service-estimate data-biz-detail-estimate>${escapeHtml(estimateText)}</button>`
      );
    }
    if (ctaEnabled(cta, "inquiry_enabled", cta.show_inquiry)) {
      parts.push(
        `<button type="button" class="${outlineBtn}" data-business-service-chat data-biz-detail-inquiry>${escapeHtml(inquiryText)}</button>`
      );
    }
    return parts.join("");
  }

  function renderStickySection() {
    stripPhoneCtasFromDom();
  }

  function pruneEmptyBusinessServiceSections(listing) {
    if (!document.body.classList.contains("biz-detail-page--business-service")) return;
    const bs = getBs(listing);
    const data = D();
    if (!bs || !data) return;

    if (shouldHideEmptySection(listing, "section-service-menu", !data.hasMenuItems(bs))) {
      removeSection("section-service-menu");
    }
    if (shouldHideEmptySection(listing, "section-achievements", !data.hasWorkCases(bs))) {
      removeSection("section-achievements");
    }
    if (shouldHideEmptySection(listing, "section-license", !hasPublicCertifications(bs))) {
      removeSection("section-license");
    }
    if (shouldHideEmptySection(listing, "section-flow", !data.hasFlowSteps(bs))) {
      removeSection("section-flow");
    }
    if (!data.hasDocuments(bs)) {
      const materials = document.querySelector("[data-biz-detail-materials-section]");
      if (materials && !sectionDomHasContent(materials.id || "")) {
        hideElement(materials);
        materials.setAttribute("data-empty", "true");
      }
    }
    if (shouldHideEmptySection(listing, "section-service-area", !data.hasAreaInfo(bs, listing))) {
      removeSection("section-service-area");
    }
    const overviewText = pickStr(bs.overview?.text, bs.hero?.service_description);
    const features = bs.overview?.features || [];
    if (
      shouldHideEmptySection(
        listing,
        "section-overview",
        !overviewText && !features.length
      )
    ) {
      removeSection("section-overview");
    }
    if (shouldHideEmptySection(listing, "section-company-info", !data.hasCompanyInfo(bs))) {
      removeSection("section-company-info");
    }

    ["section-faq", "section-reviews"].forEach((sectionId) => {
      if (sectionDomHasContent(sectionId)) {
        const section = document.getElementById(sectionId);
        if (section) showElement(section);
      }
    });
  }

  /**
   * JSON → 各セクション描画（hero main / 事例カルーセル等は deps 経由）
   */
  async function renderPage(listing, ctx) {
    const deps = ctx?.deps || {};
    const profile = ctx?.profile;

    renderHeroSection(listing);
    renderOverviewSection(listing);
    if (deps.renderBusinessServiceCoverageGrid) {
      deps.renderBusinessServiceCoverageGrid(listing, profile);
    }
    renderMenuSection(listing);
    renderWorkCasesSection(listing);
    renderCertificationsSection(listing);
    renderFlowSection(listing);
    if (deps.renderFieldServiceReviewsSection) {
      await deps.renderFieldServiceReviewsSection(listing);
    }
    renderCompanySection(listing);
    renderAreaSection(listing, deps);
    renderCtaSection(listing, ctx);
    renderStickySection();
    ensureHeroCtaColumnVisible();
    initBusinessServiceFavorites(listing);
    bindHeroCtaConsultButtons(listing);
  }

  window.TasuDetailBusinessService = {
    getBs,
    shouldUseDemo,
    setSectionVisible,
    pruneEmptyBusinessServiceSections,
    removeSection,
    renderPage,
    renderHeroSection,
    renderOverviewSection,
    renderMenuSection,
    renderWorkCasesSection,
    renderCertificationsSection,
    renderLicenseSection,
    renderFlowSection,
    renderCompanySection,
    renderAreaSection,
    renderCtaSection,
    renderStickySection,
    getHeroCtaActionsHost,
    buildDefaultHeroCtaButtonsHtml,
    ensureHeroCtaColumnVisible,
    bindHeroCtaConsultButtons,
    stripPhoneCtasFromDom,
    buildFeaturePillHtml,
    buildCertItemHtml,
    hasPublicCertifications,
    getPublicCertifications,
    ctaEnabled,
    escapeHtml,
    escapeAttr,
    resolveFavoriteListingId,
    initBusinessServiceFavorites,
    favorites: {
      get STORAGE_KEY() {
        return window.TasuFavoriteStore?.STORAGE_KEY || "tasful_favorites";
      },
      readAll: () => window.TasuFavoriteStore?.readAll?.() || [],
      isListingFavorited: (id) => window.TasuFavoriteStore?.isFavorited?.(id) || false,
      addFromListing: (listing) => window.TasuFavoriteStore?.addFromListing?.(listing),
      removeByListingId: (id) => window.TasuFavoriteStore?.removeByListingId?.(id),
      toggleListing: (listing) => window.TasuFavoriteStore?.toggleListing?.(listing),
    },
  };
})();
