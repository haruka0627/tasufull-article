/**
 * 法人・業者・店舗 サービス掲載一覧レンダラー
 */
(function () {
  "use strict";

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

  /** 詳細URL用 — 必ず DB の listing.id（UUID 等）を使う。demo_id は使わない */
  function resolveListingId(listing) {
    return String(listing?.id || listing?.target_id || listing?.targetId || "").trim();
  }

  function wrapBoardDetailUrl(url, listing) {
    if (!url || url === "#") return url;
    if (window.TasuDetailNav?.appendBoardListParams) {
      return window.TasuDetailNav.appendBoardListParams(url, listing);
    }
    return url;
  }

  function getDetailUrl(listing) {
    const id = resolveListingId(listing);
    if (!id) {
      console.warn("[TasuBusinessBoardRenderer] detail link: missing listing.id", listing);
      return "#";
    }

    const enriched = {
      ...listing,
      id,
      target_id: id,
      type: listing?.type || listing?.listing_type || "business",
      target_type: listing?.targetType || listing?.target_type || "business",
      business_type:
        String(listing?.business_type || listing?.form_data?.business_type || "").trim() ||
        (window.TasuBusinessCategories?.getBusinessType?.(listing) || ""),
    };

    if (window.TasuListingRenderer?.getDetailUrl) {
      const url = window.TasuListingRenderer.getDetailUrl(enriched);
      if (url && url !== "#") return wrapBoardDetailUrl(url, enriched);
    }

    if (window.TasuSearch?.getDetailUrl) {
      const url = window.TasuSearch.getDetailUrl({
        id,
        target_id: id,
        type: "business",
        business_type: enriched.business_type,
        form_data: listing?.form_data,
      });
      if (url && url !== "#") return wrapBoardDetailUrl(url, enriched);
    }

    const R = window.TasuListingRouteResolver;
    if (enriched.business_type === "shop_store") {
      return wrapBoardDetailUrl(R?.buildDetailUrl ? R.buildDetailUrl("shop", id) : "#", enriched);
    }
    return wrapBoardDetailUrl(
      R?.buildDetailUrl ? R.buildDetailUrl("business_service", id) : "#",
      enriched
    );
  }

  const TABLE_COL_COUNT = 5;

  function prLabel(kind) {
    const labels = window.TasuBusinessWording?.PR_LABELS || {};
    if (kind === "pr") return labels.pr || "PR掲載";
    if (kind === "featured") return labels.featured || "おすすめ業者";
    return labels.spotlight || "注目掲載";
  }

  function truncateText(text, max) {
    const s = String(text || "").trim();
    if (!s || s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  function sanitizeServiceIntro(text) {
    let s = String(text || "").trim();
    if (!s) return "";
    return s
      .replace(/スタッフ募集/g, "")
      .replace(/急募/g, "即日対応")
      .replace(/募集中/g, "受付中")
      .replace(/(?:人)?募集/g, "対応")
      .replace(/採用/g, "")
      .replace(/応募/g, "問い合わせ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function buildPlaceholderLogoUrl(companyName) {
    const name = encodeURIComponent(String(companyName || "Biz").slice(0, 14));
    return `https://ui-avatars.com/api/?name=${name}&background=f8f4eb&color=967622&size=192&bold=true&format=svg`;
  }

  function pickBoardCoverageShort(listing) {
    if (window.TasuBusinessWording?.pickBoardCoverageShort) {
      return window.TasuBusinessWording.pickBoardCoverageShort(listing);
    }
    return sanitizeServiceIntro(
      truncateText(listing.boardCoverageShort || listing.title || "", 48)
    );
  }

  function pickBoardTrustShort(listing) {
    if (window.TasuBusinessWording?.pickBoardTrustShort) {
      return window.TasuBusinessWording.pickBoardTrustShort(listing);
    }
    const line = listing.boardTrustShort || listing.licenseLine || "";
    if (!line || line === "—") return "";
    return sanitizeServiceIntro(truncateText(line, 52));
  }

  function resolveBoardCtas(listing, overrides = {}) {
    const base = window.TasuBusinessWording?.getBoardCtas
      ? window.TasuBusinessWording.getBoardCtas(listing)
      : {
          primaryLabel: "問い合わせる",
          secondaryLabel: "詳細を見る",
          futurePrimaryLabel: "",
          futureSecondaryLabel: "",
          primaryClass: "biz-board-btn--primary biz-board-btn--inquiry",
          secondaryClass: "biz-board-btn--detail",
          actionsMod: "biz-board-actions--cat-default",
          categoryKey: "",
        };
    return { ...base, ...overrides };
  }

  /** 一覧：会社名列サマリー（長文は出さない） */
  function buildTaxiBookingTagsHtml(listing) {
    if (listing?.business_category !== "taxi") return "";
    const types = Array.isArray(listing.taxi_booking_types)
      ? listing.taxi_booking_types
      : [];
    if (!types.length) return "";
    const priority = ["即時配車", "空港送迎", "法人定期契約"];
    const ordered = [];
    priority.forEach((label) => {
      if (types.includes(label)) ordered.push(label);
    });
    types.forEach((label) => {
      if (!ordered.includes(label)) ordered.push(label);
    });
    const tags = ordered.slice(0, 3);
    if (!tags.length) return "";
    return `<div class="business-taxi-booking-tags">${tags
      .map(
        (label) =>
          `<span class="business-taxi-booking-tag">${escapeHtml(label)}</span>`
      )
      .join("")}</div>`;
  }

  function buildCompanyColumnSummaryHtml(listing) {
    const coverage = pickBoardCoverageShort(listing);
    const trust = pickBoardTrustShort(listing);
    const bookingTags = buildTaxiBookingTagsHtml(listing);
    const parts = [];
    if (coverage) {
      parts.push(
        `<p class="business-coverage-short">${escapeHtml(coverage)}</p>`
      );
    }
    if (bookingTags) parts.push(bookingTags);
    if (trust) {
      parts.push(
        `<p class="business-trust-short">${escapeHtml(trust)}</p>`
      );
    }
    if (!parts.length) return "";
    return `<div class="business-board-summary">${parts.join("")}</div>`;
  }

  function formatPaymentTypeLabel(listing) {
    const raw = listing.paymentTypeLabel || listing.paymentType || "";
    if (!raw || raw === "—") return "";
    const text = String(raw).trim();
    if (window.TasuBusinessWording?.formatDisplayValue) {
      return window.TasuBusinessWording.formatDisplayValue(text, "payment_type") || text;
    }
    return text;
  }

  function buildBudgetCellHtml(listing) {
    const budget = listing.budgetLabel || listing.budgetText || "要相談";
    const paymentType = formatPaymentTypeLabel(listing);
    const paymentHtml = paymentType
      ? `<span class="biz-board-row__payment-type">${escapeHtml(paymentType)}</span>`
      : "";
    return `<div class="price-column price-cell"><span class="price price-column__amount">${escapeHtml(budget)}</span>${paymentHtml}</div>`;
  }

  function parseServiceAreas(raw) {
    const text = String(raw || "").trim();
    if (!text || text === "—") {
      return { areas: [], labels: [] };
    }
    const labels = [];
    if (/全国/.test(text)) {
      labels.push({ text: "全国対応", mod: "nationwide" });
    }
    if (/エリア相談|地域相談|エリア要相談/.test(text)) {
      labels.push({ text: "エリア相談可", mod: "consult" });
    }
    const split = text
      .split(/[、,／/|・]+/)
      .map((part) => part.trim())
      .filter((part) => part && part !== "—");
    const areas = split.length ? split.slice(0, 6) : [text];
    return { areas, labels };
  }

  function buildAreaCellHtml(listing) {
    const raw = listing.service_area || "";
    const { areas, labels } = parseServiceAreas(raw);
    const listItems =
      areas.length > 0
        ? areas
        : raw && raw !== "—"
          ? [raw]
          : ["—"];
    const labelsHtml = labels
      .map(
        (item) =>
          `<span class="area-column__label area-column__label--${escapeAttr(item.mod)}">${escapeHtml(item.text)}</span>`
      )
      .join("");
    const listHtml = listItems
      .map((area) => `<li class="area-column__item">${escapeHtml(area)}</li>`)
      .join("");
    return `<div class="area-column">${labelsHtml}<ul class="area-column__list">${listHtml}</ul></div>`;
  }

  function buildListingContactHtml(listing) {
    const label =
      listing.contactMethodDisplayLabel || listing.contactMethodLabel || "";
    if (!label || label === "—") return "";
    return `<p class="biz-board-listing-contact">${escapeHtml(label)}</p>`;
  }

  function buildStatusBadges(listing, options = {}) {
    const { hidePrFeatured = false, maxExtra = 5 } = options;
    const badges = [];
    const recruit =
      listing.statusLabel ||
      listing.recruitLabel ||
      window.TasuBusinessWording?.RECRUIT_STATUS?.OPEN ||
      "受付中";
    const recruitMod = listing.recruitStatusMod || "is-open";
    badges.push(
      `<span class="badge biz-badge biz-badge--recruit ${recruitMod}">${escapeHtml(recruit)}</span>`
    );

    const extras = window.TasuBusinessWording?.pickDisplayBadges
      ? window.TasuBusinessWording.pickDisplayBadges(listing, maxExtra)
      : (listing.conditionBadges || []).slice(0, maxExtra);

    extras.forEach(({ label, mod }) => {
      badges.push(
        `<span class="badge biz-badge ${mod || "biz-badge--cond"}">${escapeHtml(label)}</span>`
      );
    });

    if (!hidePrFeatured) {
      if (listing.isPr) {
        badges.push(
          `<span class="badge biz-badge biz-badge--pr">${escapeHtml(prLabel("pr"))}</span>`
        );
      }
      if (listing.isFeatured || listing.isFeaturedSlot) {
        badges.push(
          `<span class="badge biz-badge biz-badge--featured">${escapeHtml(prLabel("featured"))}</span>`
        );
      }
    }
    return badges.join("");
  }

  function buildStatusBlockHtml(listing, options = {}) {
    const hideContact = options.hideContact === true;
    const badgeOpts = {
      hidePrFeatured: options.hidePrFeatured,
      maxExtra: options.maxExtra ?? 5,
    };
    return `<div class="biz-board-row__status-foot">
      <div class="biz-board-row__status biz-board-row__badge-grid">${buildStatusBadges(listing, badgeOpts)}</div>
      ${hideContact ? "" : buildListingContactHtml(listing)}
    </div>`;
  }

  function buildMobileUrgentBadgesHtml(listing) {
    const extras = window.TasuBusinessWording?.pickDisplayBadges
      ? window.TasuBusinessWording.pickDisplayBadges(listing, 2)
      : [];
    const urgent = extras.filter((b) => b.label === "即日対応");
    if (!urgent.length) return "";
    return urgent
      .map(
        ({ label, mod }) =>
          `<span class="biz-badge ${mod || "biz-badge--cond"}">${escapeHtml(label)}</span>`
      )
      .join("");
  }

  function buildMobilePriorityHtml(listing) {
    const budget = listing.budgetLabel || listing.budgetText || "要相談";
    const paymentType = formatPaymentTypeLabel(listing);
    const category = listing.categoryLabel || "—";
    const area = listing.service_area || "—";
    const urgentHtml = buildMobileUrgentBadgesHtml(listing);
    const paymentLine = paymentType
      ? `<p class="biz-board-mobile-card__payment-type">支払い: ${escapeHtml(paymentType)}</p>`
      : "";
    return `
      <div class="biz-board-mobile-card__priority">
        <p class="biz-board-mobile-card__budget price-column"><span class="price price-column__amount">${escapeHtml(budget)}</span></p>
        ${paymentLine}
        <div class="biz-board-mobile-card__chips">
          <span class="biz-board-mobile-card__chip biz-board-mobile-card__chip--category">${escapeHtml(category)}</span>
          <span class="biz-board-mobile-card__chip">${escapeHtml(area)}</span>
        </div>
        ${urgentHtml ? `<div class="biz-board-mobile-card__status biz-board-mobile-card__status--urgent">${urgentHtml}</div>` : ""}
      </div>`;
  }

  function buildPrRibbonBadges(listing) {
    const parts = [];
    if (listing.isPr) {
      parts.push(
        `<span class="biz-board-row__ribbon biz-board-row__ribbon--pr">${escapeHtml(prLabel("pr"))}</span>`
      );
    }
    if (listing.isFeatured || listing.isFeaturedSlot) {
      parts.push(
        `<span class="biz-board-row__ribbon biz-board-row__ribbon--featured">${escapeHtml(prLabel("featured"))}</span>`
      );
    }
    return parts.length ? `<div class="biz-board-row__ribbons">${parts.join("")}</div>` : "";
  }

  function buildSpotlightCornerBadges(listing) {
    const parts = [];
    if (listing.isPr) {
      parts.push(
        `<span class="biz-board-spotlight__corner-badge biz-board-spotlight__corner-badge--pr">${escapeHtml(prLabel("pr"))}</span>`
      );
    }
    if (listing.isFeatured || listing.isFeaturedSlot) {
      parts.push(
        `<span class="biz-board-spotlight__corner-badge biz-board-spotlight__corner-badge--featured">${escapeHtml(prLabel("featured"))}</span>`
      );
    }
    return parts.length
      ? `<div class="biz-board-spotlight__corner-badges">${parts.join("")}</div>`
      : "";
  }

  function buildMainCellHtml(listing, detailUrl) {
    const isHighlight = listing.isPr || listing.isFeatured || listing.isFeaturedSlot;
    const categoryChip = listing.categoryLabel
      ? `<div class="biz-board-row__category-foot"><span class="biz-board-row__category">${escapeHtml(listing.categoryLabel)}</span></div>`
      : "";
    return `
      <div class="biz-board-row__main-inner${isHighlight ? " biz-board-row__main-inner--highlight" : ""}">
        ${isHighlight ? buildPrRibbonBadges(listing) : ""}
        <div class="biz-board-row__main-body">
          ${buildLogoHtml(listing)}
          <div class="biz-board-row__copy">
            <div class="biz-board-row__company-row">
              <h2 class="company-name biz-board-row__company">${escapeHtml(listing.company_name || "—")}</h2>
              <span class="biz-board-row__verified" title="掲載確認済み" aria-hidden="true">✓</span>
            </div>
            ${buildCompanyColumnSummaryHtml(listing)}
            ${categoryChip}
          </div>
        </div>
      </div>`;
  }

  function buildLogoHtml(listing) {
    const imageUrl = listing.imageUrl || "";
    if (imageUrl) {
      return `<span class="biz-board-logo company-logo"><img src="${escapeAttr(imageUrl)}" alt="" class="business-logo-img" loading="lazy" decoding="async"></span>`;
    }
    const placeholder = buildPlaceholderLogoUrl(listing.company_name || listing.title);
    return `<span class="biz-board-logo company-logo biz-board-logo--placeholder"><img src="${escapeAttr(placeholder)}" alt="" class="business-logo-img" loading="lazy" decoding="async"></span>`;
  }

  function buildFavoriteButton(listing) {
    const id = escapeAttr(listing.id);
    return `<button type="button" class="biz-board-favorite card-list__favorite tasu-favorite-btn" data-favorite-button data-target-type="business" data-target-id="${id}" data-user-id="u_me" aria-label="お気に入り" aria-pressed="false"><span class="tasu-favorite-btn__icon" aria-hidden="true">♡</span></button>`;
  }

  function buildRowActions(listing, detailUrl, options = {}) {
    const { stack = true } = options;
    const ctas = resolveBoardCtas(listing, options);
    const stackClass = stack ? " biz-board-actions--stack" : "";
    const compareClass = stack ? " biz-board-actions--compare" : "";
    const cat = escapeAttr(ctas.categoryKey || listing.business_category || "");
    const futurePrimary = ctas.futurePrimaryLabel
      ? ` data-future-cta-primary="${escapeAttr(ctas.futurePrimaryLabel)}"`
      : "";
    const futureSecondary = ctas.futureSecondaryLabel
      ? ` data-future-cta-secondary="${escapeAttr(ctas.futureSecondaryLabel)}"`
      : "";
    return `<div class="biz-board-actions${stackClass}${compareClass} ${escapeHtml(ctas.actionsMod)}" data-business-category="${cat}" data-cta-scope="board">
      <a href="${escapeAttr(detailUrl)}" class="biz-board-btn ${escapeHtml(ctas.primaryClass)}" data-breadcrumb-label="${escapeAttr(listing.company_name || listing.title || "詳細")}"${futurePrimary}>${escapeHtml(ctas.primaryLabel)}</a>
      <a href="${escapeAttr(detailUrl)}" class="biz-board-btn ${escapeHtml(ctas.secondaryClass)}" data-breadcrumb-label="${escapeAttr(listing.company_name || listing.title || "詳細")}"${futureSecondary}>${escapeHtml(ctas.secondaryLabel)}</a>
      ${buildFavoriteButton(listing)}
    </div>`;
  }

  function buildSpotlightInnerHtml(listing, detailUrl) {
    return `
      ${buildSpotlightCornerBadges(listing)}
      <div class="biz-board-spotlight__logo">${buildLogoHtml(listing)}</div>
      <div class="biz-board-spotlight__body">
        <div class="biz-board-spotlight__head">
          <div class="biz-board-spotlight__badges">${buildStatusBadges(listing, { hidePrFeatured: true, includePartner: true })}</div>
          ${buildListingContactHtml(listing)}
          <p class="biz-board-spotlight__company">${escapeHtml(listing.company_name || "—")}</p>
          <h3 class="biz-board-spotlight__title"><a href="${escapeAttr(detailUrl)}" data-breadcrumb-label="${escapeAttr(listing.company_name || listing.title || "詳細")}">${escapeHtml(listing.title)}</a></h3>
        </div>
        <dl class="biz-board-spotlight__meta">
          <div><dt>料金目安</dt><dd>${escapeHtml(listing.budgetLabel || listing.budgetText || "見積要相談")}</dd></div>
          ${formatPaymentTypeLabel(listing) ? `<div><dt>支払い条件</dt><dd>${escapeHtml(formatPaymentTypeLabel(listing))}</dd></div>` : ""}
          <div><dt>期間</dt><dd>${escapeHtml(listing.contractLabel || listing.periodText || "—")}</dd></div>
          <div><dt>必要資格</dt><dd>${escapeHtml(listing.qualificationText || "—")}</dd></div>
          <div><dt>${escapeHtml(window.TasuBusinessWording?.labels?.headcount || "対応可能人数")}</dt><dd>${escapeHtml(listing.headcountText || "—")}</dd></div>
          <div><dt>エリア</dt><dd>${escapeHtml(listing.service_area || "—")}</dd></div>
          <div><dt>業種</dt><dd>${escapeHtml(listing.categoryLabel || "—")}</dd></div>
        </dl>
      </div>
      <div class="biz-board-spotlight__actions">
        ${buildRowActions(listing, detailUrl)}
      </div>`;
  }

  function applyRowDataset(el, listing) {
    el.dataset.type = "business";
    el.dataset.category = "business";
    el.dataset.targetType = "business";
    el.dataset.targetId = listing.id;
    el.dataset.listingId = listing.id;
    el.dataset.businessCategory = listing.business_category || "";
    el.dataset.status = listing.status || "";
    el.dataset.filterable = "";
    if (listing.isPr) el.dataset.rank = "pr";
    else if (listing.isFeatured || listing.isFeaturedSlot) el.dataset.rank = "premium";
    else el.dataset.rank = "free";
    if (listing.priorityScore != null) {
      el.dataset.priorityScore = String(listing.priorityScore);
    }
  }

  /**
   * PR / 上位 — 横長強調行
   */
  function buildSpotlightElement(listing) {
    const detailUrl = getDetailUrl(listing);
    const row = document.createElement("article");
    row.className = "biz-board-spotlight";
    if (listing.isPr) row.classList.add("biz-board-spotlight--pr");
    if (listing.isFeatured || listing.isFeaturedSlot) {
      row.classList.add("biz-board-spotlight--featured");
    }
    applyRowDataset(row, listing);
    row.innerHTML = buildSpotlightInnerHtml(listing, detailUrl);
    return row;
  }

  /** テーブル最上部 — PR/上位の強調行（colspan） */
  function buildSpotlightTableRowElement(listing) {
    const detailUrl = getDetailUrl(listing);
    const tr = document.createElement("tr");
    tr.className = "biz-board-spotlight-row";
    if (listing.isPr) tr.classList.add("biz-board-spotlight-row--pr");
    if (listing.isFeatured || listing.isFeaturedSlot) {
      tr.classList.add("biz-board-spotlight-row--featured");
    }
    applyRowDataset(tr, listing);

    const td = document.createElement("td");
    td.colSpan = TABLE_COL_COUNT;
    td.innerHTML = `<div class="biz-board-spotlight biz-board-spotlight--in-table">${buildSpotlightInnerHtml(listing, detailUrl)}</div>`;
    tr.appendChild(td);
    return tr;
  }

  /**
   * テーブル行（PC）
   */
  function buildTableRowElement(listing) {
    const detailUrl = getDetailUrl(listing);
    const tr = document.createElement("tr");
    tr.className = "biz-board-row business-row business-card biz-compare-row";
    if (listing.isPr) tr.classList.add("biz-board-row--pr");
    if (listing.isFeatured || listing.isFeaturedSlot) {
      tr.classList.add("biz-board-row--featured");
    }
    applyRowDataset(tr, listing);

    tr.innerHTML = `
      <td class="biz-board-row__main" data-label="事業者・サービス">
        ${buildMainCellHtml(listing, detailUrl)}
      </td>
      <td class="biz-board-row__cell biz-board-row__cell--area area-column-cell" data-label="対応地域">${buildAreaCellHtml(listing)}</td>
      <td class="biz-board-row__cell biz-board-row__cell--price price-column-cell" data-label="料金目安">${buildBudgetCellHtml(listing)}</td>
      <td class="biz-board-row__cell biz-board-row__cell--badges" data-label="受付・条件">${buildStatusBlockHtml(listing, { hidePrFeatured: true, hideContact: true, maxExtra: 5 })}</td>
      <td class="biz-board-row__actions action-cell business-actions service-actions" data-label="操作">
        ${buildRowActions(listing, detailUrl, { stack: true })}
      </td>`;

    return tr;
  }

  /**
   * スマホ用ミニ行（tbody に併設しない・JSでモバイルリストへ）
   */
  function buildMobileCardElement(listing, options = {}) {
    const { spotlight = false } = options;
    const detailUrl = getDetailUrl(listing);
    const card = document.createElement("article");
    card.className = "biz-board-mobile-card";
    if (spotlight) card.classList.add("biz-board-mobile-card--spotlight");
    if (listing.isPr) card.classList.add("biz-board-mobile-card--pr");
    applyRowDataset(card, listing);

    const contactHtml = buildListingContactHtml(listing);
    const contactBlock = contactHtml
      ? contactHtml.replace("biz-board-listing-contact", "biz-board-mobile-card__contact")
      : "";

    card.innerHTML = `
      ${spotlight ? buildSpotlightCornerBadges(listing) : ""}
      <div class="biz-board-mobile-card__top">
        <div class="biz-board-mobile-card__logo">${buildLogoHtml(listing)}</div>
        <div class="biz-board-mobile-card__head">
          <p class="biz-board-mobile-card__company company-name">${escapeHtml(listing.company_name || "—")}</p>
          ${window.TasuListingRenderer?.renderPlatformBadgesHtml?.(listing) || ""}
          ${buildCompanyColumnSummaryHtml(listing)}
          <a class="biz-board-mobile-card__detail-link" href="${escapeAttr(detailUrl)}" data-breadcrumb-label="${escapeAttr(listing.company_name || listing.title || "詳細")}">詳細を見る</a>
        </div>
      </div>
      ${buildMobilePriorityHtml(listing)}
      <div class="biz-board-mobile-card__status">${buildStatusBadges(listing, { hidePrFeatured: spotlight, maxExtra: 4 })}</div>
      ${contactBlock}
      <div class="biz-board-mobile-card__actions">
        ${buildRowActions(listing, detailUrl, { stack: true })}
      </div>`;

    window.TasuPlatformBadges?.bindRecommendPopovers?.(card);
    return card;
  }

  function buildBoardRow(listing, mode) {
    if (mode === "spotlight") return buildSpotlightElement(listing);
    if (mode === "mobile") return buildMobileCardElement(listing);
    return buildTableRowElement(listing);
  }

  window.TasuBusinessBoardRenderer = {
    TABLE_COL_COUNT,
    buildSpotlightElement,
    buildSpotlightTableRowElement,
    buildTableRowElement,
    buildMobileCardElement,
    buildBoardRow,
    buildStatusBadges,
    buildStatusBlockHtml,
    buildListingContactHtml,
    getDetailUrl,
  };
})();
