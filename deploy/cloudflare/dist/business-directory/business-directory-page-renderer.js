/**
 * Business Directory — shared page renderer (Phase 3a)
 * Public detail · Owner preview · future AI page preview
 */
(function (global) {
  "use strict";

  const C = global.TasuBusinessDirectoryCommon;
  const Cats = global.TasuBusinessDirectoryCategories;
  const Plan = global.TasuBusinessDirectoryPlan;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function typeLabel(t) {
    return C?.typeLabel?.(t) || (t === "shop_retail" ? "店舗・販売" : "業務サービス");
  }

  function categoryName(id) {
    return Cats?.findById(id)?.name || "";
  }

  function publicDisplayPlan(listing) {
    const stored = String(listing?.plan_code || "free").toLowerCase();
    if (!Plan?.effectivePlanCode) return stored;
    const hasStripeSignals =
      listing?.subscription_status || listing?.stripe_subscription_id || listing?.current_period_end;
    if (hasStripeSignals) return Plan.effectivePlanCode(listing);
    return stored;
  }

  function isStandardPlus(listing, options) {
    if (options?.planGate === false) return true;
    const plan = publicDisplayPlan(listing);
    return plan === "standard" || plan === "pro" || plan === "premium";
  }

  function fullDescriptionSectionTitle(listingType) {
    return listingType === "business_service" ? "サービス詳細" : "詳細紹介";
  }

  function normalizeFaqItems(raw) {
    let items = raw;
    if (typeof raw === "string") {
      try {
        items = JSON.parse(raw);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        q: String(item?.q || "").trim(),
        a: String(item?.a || "").trim(),
      }))
      .filter((item) => item.q || item.a)
      .slice(0, 5);
  }

  function normalizeRecommendedUses(raw) {
    if (Array.isArray(raw)) {
      return raw.map((u) => String(u || "").trim()).filter(Boolean).slice(0, 5);
    }
    return [];
  }

  function planBadge(code) {
    const c = String(code || "free").toLowerCase();
    const cls =
      c === "pro" || c === "premium"
        ? "bd-public-plan--pro"
        : c === "standard"
          ? "bd-public-plan--standard"
          : "";
    return `<span class="bd-public-plan ${cls}">${escapeHtml(c)}</span>`;
  }

  function photoSrc(photos) {
    const first = (photos || [])[0];
    return first?.url || first?.public_url || "";
  }

  function formatBusinessHours(hours) {
    return (
      (hours || [])
        .map((h) => {
          if (h.note) return String(h.note);
          if (h.label) return `${h.label}: ${h.value || h.hours_text || ""}`;
          return h.hours_text || h.value || "";
        })
        .filter(Boolean)
        .join(" / ") || "—"
    );
  }

  function renderHero(listing, profile, photos) {
    const src = photoSrc(photos);
    if (src) {
      return `<div class="bd-public-hero" data-bd-page-hero="image"><img src="${escapeHtml(src)}" alt=""></div>`;
    }
    const name = escapeHtml(listing?.display_name || "");
    const cat = escapeHtml(categoryName(listing?.category_id));
    return (
      `<div class="bd-public-hero bd-public-hero--text" data-bd-page-hero="text">` +
      `<div class="bd-public-hero__inner">` +
      (cat ? `<span class="bd-public-hero__category">${cat}</span>` : "") +
      `<span class="bd-public-hero__name">${name}</span>` +
      `</div></div>`
    );
  }

  function planPreviewPlaceholderCard(sectionKey, title) {
    return (
      `<section class="bd-public-section bd-plan-preview-note" data-bd-plan-preview-note="${escapeHtml(sectionKey)}">` +
      `<div class="bd-plan-preview-note__card">` +
      `<span class="bd-plan-preview-note__icon" aria-hidden="true">🔒</span>` +
      `<p class="bd-plan-preview-note__badge">Standard以上で公開</p>` +
      `<h2 class="bd-plan-preview-note__title">${escapeHtml(title)}</h2>` +
      `<p class="bd-plan-preview-note__lead">このセクションは Standard 以上で公開されます。</p>` +
      `<p class="bd-plan-preview-note__text">AIは内容を生成していますが、現在のプランでは公開ページには表示されません。</p>` +
      `<p class="bd-plan-preview-note__hint">プランを変更すると公開できます。</p>` +
      `</div></section>`
    );
  }

  function renderAiPreviewPlanPlaceholders(listing, profile) {
    const blocks = [];
    const fullText = String(profile?.full_description || "").trim();
    if (fullText) {
      blocks.push(
        planPreviewPlaceholderCard("full_description", fullDescriptionSectionTitle(listing.listing_type)),
      );
    }
    const uses = normalizeRecommendedUses(profile?.recommended_uses);
    if (uses.length) {
      blocks.push(planPreviewPlaceholderCard("recommended_uses", "こんな方におすすめ"));
    }
    const faq = normalizeFaqItems(profile?.faq_items);
    if (faq.length) {
      blocks.push(planPreviewPlaceholderCard("faq", "よくある質問"));
    }
    return blocks.join("");
  }

  function renderRichContentSections(listing, profile, options) {
    const standardPlus = isStandardPlus(listing, options);
    if (!standardPlus) {
      if (options?.mode === "ai-preview" && options?.planGate !== false) {
        return renderAiPreviewPlanPlaceholders(listing, profile);
      }
      return "";
    }
    const blocks = [];
    const fullText = String(profile?.full_description || "").trim();
    if (fullText) {
      blocks.push(
        `<section class="bd-public-section" data-bd-public-full-description>` +
          `<h2>${escapeHtml(fullDescriptionSectionTitle(listing.listing_type))}</h2>` +
          `<p class="bd-public-prose">${escapeHtml(fullText)}</p>` +
          `</section>`,
      );
    }
    const uses = normalizeRecommendedUses(profile?.recommended_uses);
    if (uses.length) {
      blocks.push(
        `<section class="bd-public-section" data-bd-public-recommended-uses>` +
          `<h2>こんな方におすすめ</h2>` +
          `<ul class="bd-public-uses">${uses.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}</ul>` +
          `</section>`,
      );
    }
    const faq = normalizeFaqItems(profile?.faq_items);
    if (faq.length) {
      blocks.push(
        `<section class="bd-public-section" data-bd-public-faq>` +
          `<h2>よくある質問</h2>` +
          `<div class="bd-public-faq">${faq
            .map(
              (item, i) =>
                `<details class="bd-public-faq__item" data-bd-public-faq-item="${i}">` +
                `<summary>${escapeHtml(item.q)}</summary>` +
                `<p class="bd-public-faq__answer">${escapeHtml(item.a)}</p>` +
                `</details>`,
            )
            .join("")}</div>` +
          `</section>`,
      );
    }
    return blocks.join("");
  }

  function previewBannerHtml(options) {
    if (!options.preview) return "";
    if (options.mode === "ai-preview") {
      return `<p class="bd-preview__watermark">AI下書きプレビュー · 未保存</p>`;
    }
    if (options.mode !== "public") {
      return `<p class="bd-preview__watermark">未公開プレビュー</p>`;
    }
    return "";
  }

  function renderExternalRedirectPage(listing, profile, options) {
    const contactEmail = profile.contact_email
      ? `<a class="bd-public-btn bd-public-btn--primary" href="mailto:${escapeHtml(profile.contact_email)}">お問い合わせ（メール）</a>`
      : "";
    const websiteCta = listing.website_url
      ? `<a class="bd-public-btn bd-public-btn--primary" href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">公式サイトへ</a>`
      : "";

    const previewBanner = previewBannerHtml(options);

    return (
      previewBanner +
      `<div class="bd-public-section">` +
      `<h1 style="margin:0 0 8px;font-size:1.5rem">${escapeHtml(listing.display_name)}</h1>` +
      `<p class="bd-public-lead">${escapeHtml(profile.short_description || "")}</p>` +
      `<p><small>${escapeHtml(typeLabel(listing.listing_type))} · ${escapeHtml(categoryName(listing.category_id))}</small></p>` +
      `</div>` +
      `<div class="bd-public-cta-box">` +
      `<p>この掲載は公式サイトへの送客が主導線です。</p>` +
      `${websiteCta}${contactEmail}` +
      `</div>` +
      `<div class="bd-public-section">` +
      `<h2>最小情報</h2>` +
      `<dl class="bd-public-dl">` +
      `<dt>所在地</dt><dd>${escapeHtml([profile.prefecture, profile.city].filter(Boolean).join(" "))}</dd>` +
      `<dt>対応地域</dt><dd>${escapeHtml((listing.service_areas || []).join("、"))}</dd>` +
      `</dl></div>`
    );
  }

  function renderFullPage(listing, profile, photos, hours, options) {
    const planCode = publicDisplayPlan(listing);
    const serviceBlock =
      listing.listing_type === "shop_retail"
        ? `<dt>販売ジャンル</dt><dd>${escapeHtml(profile.shop_sales_genre || "—")}</dd>`
        : `<dt>サービス内容</dt><dd>${escapeHtml(profile.service_summary || "—")}</dd>` +
          `<dt>料金目安</dt><dd>${escapeHtml(profile.price_range_text || "—")}</dd>`;

    const contactEmail = profile.contact_email
      ? `<a class="bd-public-btn bd-public-btn--primary" href="mailto:${escapeHtml(profile.contact_email)}">お問い合わせ（メール）</a>`
      : "";
    const websiteCta = listing.website_url
      ? `<a class="bd-public-btn bd-public-btn--primary" href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">公式サイトへ</a>`
      : "";

    const previewBanner = previewBannerHtml(options);

    const richSections = renderRichContentSections(listing, profile, options);

    return (
      previewBanner +
      renderHero(listing, profile, photos) +
      `<div class="bd-public-section">` +
      `<h1 style="margin:0 0 8px;font-size:1.625rem;font-weight:900">${escapeHtml(listing.display_name)}</h1>` +
      `<p style="margin:0 0 12px;color:#64748b">${escapeHtml(typeLabel(listing.listing_type))} · ${escapeHtml(categoryName(listing.category_id))} · ${planBadge(planCode)}</p>` +
      `<p class="bd-public-lead">${escapeHtml(profile.short_description || "")}</p>` +
      `</div>` +
      richSections +
      `<div class="bd-public-section">` +
      `<h2>基本情報</h2>` +
      `<dl class="bd-public-dl">` +
      `<dt>会社名</dt><dd>${escapeHtml(profile.company_name || "—")}</dd>` +
      `<dt>所在地</dt><dd>${escapeHtml([profile.prefecture, profile.city, profile.address_line1].filter(Boolean).join(" "))}</dd>` +
      `<dt>対応地域</dt><dd>${escapeHtml((listing.service_areas || []).join("、"))}</dd>` +
      `<dt>公開形式</dt><dd>${escapeHtml(C?.hpModePublicLabel?.(listing.hp_mode) || "TASFULページを使う")}</dd>` +
      serviceBlock +
      `<dt>営業時間</dt><dd>${escapeHtml(formatBusinessHours(hours))}</dd>` +
      `<dt>公式サイト</dt><dd>${listing.website_url ? `<a href="${escapeHtml(listing.website_url)}" target="_blank" rel="noopener">${escapeHtml(listing.website_url)}</a>` : "—"}</dd>` +
      `</dl></div>` +
      `<div class="bd-public-section">` +
      `<h2>問い合わせ</h2>` +
      `<div class="bd-public-card__actions">${contactEmail}${websiteCta}</div>` +
      `</div>`
    );
  }

  /**
   * @param {object} detail - { listing, profile, photos?, business_hours? }
   * @param {object} [options]
   * @param {boolean} [options.preview=false]
   * @param {boolean} [options.planGate=true]
   * @param {"public"|"owner-preview"|"ai-preview"} [options.mode="public"]
   */
  function renderBusinessDirectoryPage(detail, options) {
    const opts = {
      preview: false,
      planGate: true,
      mode: "public",
      ...(options || {}),
    };
    const listing = detail?.listing || {};
    const profile = detail?.profile || {};
    const photos = detail?.photos || [];
    const hours = detail?.business_hours || [];
    const isRedirect = listing.hp_mode === "external_redirect";

    const html = isRedirect
      ? renderExternalRedirectPage(listing, profile, opts)
      : renderFullPage(listing, profile, photos, hours, opts);

    return {
      html,
      isRedirect,
      mode: opts.mode,
    };
  }

  global.TasuBusinessDirectoryPageRenderer = {
    renderBusinessDirectoryPage,
    renderRichContentSections,
    renderAiPreviewPlanPlaceholders,
    publicDisplayPlan,
    isStandardPlus,
    normalizeFaqItems,
    normalizeRecommendedUses,
    escapeHtml,
    typeLabel,
    categoryName,
    planBadge,
    photoSrc,
    formatBusinessHours,
  };
})(typeof window !== "undefined" ? window : globalThis);
