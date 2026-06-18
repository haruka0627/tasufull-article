/**
 * 掲載データから AI 横断検索用の連絡先情報を抽出
 * 電話表示: サブスクオプション加入 + 電話公開フラグ の両方が必要
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function parsePublicFlag(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const s = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!s) return null;
    if (s === "yes" || s === "true" || s === "1" || s === "public" || s === "on" || s === "表示") {
      return true;
    }
    if (s === "no" || s === "false" || s === "0" || s === "private" || s === "off" || s === "非表示") {
      return false;
    }
    return null;
  }

  function resolvePhonePublic(flags) {
    for (const f of flags) {
      const parsed = parsePublicFlag(f);
      if (parsed !== null) return parsed;
    }
    return false;
  }

  function hasPhoneSubscriptionOption(listing, fd, bs) {
    const ad = listing?.ad_options || fd?.ad_options || bs?.ad_options || {};
    const phoneOpt = bs?.phone_option || fd?.phone_option || listing?.phone_option || {};
    const flags = [
      listing?.phone_option_active,
      listing?.phone_option_enabled,
      listing?.phone_subscription_active,
      listing?.phone_option_subscribed,
      fd?.phone_option_active,
      fd?.phone_option_enabled,
      fd?.phone_subscription_active,
      phoneOpt?.active,
      phoneOpt?.enabled,
      phoneOpt?.subscribed,
      ad?.phone_option,
      ad?.phone_display,
      ad?.phone_option_active,
      bs?.cta?.phone_option,
    ];
    for (const f of flags) {
      const parsed = parsePublicFlag(f);
      if (parsed === true) return true;
    }
    return false;
  }

  function normalizePhoneDisplay(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const digits = s.replace(/[^\d+]/g, "");
    if (digits.length < 9) return "";
    return s;
  }

  function telHrefFromPhone(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits.length >= 9 ? `tel:${digits}` : "";
  }

  function readFormData(listing) {
    return listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
  }

  function readBusinessService(listing, fd) {
    return (
      listing?.business_service ||
      fd?.business_service ||
      fd?.category_extra?.field_service?.business_service ||
      {}
    );
  }

  function pickPhoneFromSources(listing, fd, bs, extra) {
    const hero = bs?.hero || {};
    const shop = extra?.shop_store || extra?.store || extra || {};
    return pickStr(
      listing?.phone,
      listing?.contact_phone,
      listing?.business_phone,
      listing?.shop_phone,
      listing?.owner_phone,
      fd?.phone,
      fd?.contact_phone,
      fd?.business_phone,
      fd?.shop_phone,
      hero?.phone,
      bs?.company_info?.phone,
      shop?.phone,
      extra?.phone,
      listing?.company_phone
    );
  }

  function pickPublicFlags(listing, fd, bs) {
    const cta = bs?.cta || fd?.cta || {};
    return [
      listing?.contact_phone_public,
      listing?.phone_public,
      fd?.contact_phone_public,
      fd?.phone_public,
      listing?.show_phone,
      fd?.show_phone,
      cta?.show_phone,
      cta?.phone_enabled,
      listing?.phone_enabled,
    ];
  }

  /**
   * @param {object} listing
   * @param {{ detailUrl?: string, kind?: string }} options
   */
  function extractContactInfo(listing, options = {}) {
    const fd = readFormData(listing);
    const bs = readBusinessService(listing, fd);
    const extra =
      fd?.category_extra?.field_service ||
      fd?.category_extra?.shop_store ||
      listing?.category_extra?.shop_store ||
      listing?.category_extra ||
      {};
    const phoneRaw = pickPhoneFromSources(listing, fd, bs, extra);
    const phonePublic = resolvePhonePublic(pickPublicFlags(listing, fd, bs));
    const phoneSubscription = hasPhoneSubscriptionOption(listing, fd, bs);
    const phoneNormalized = normalizePhoneDisplay(phoneRaw);
    const phoneCallEligible = Boolean(
      phoneSubscription && phonePublic && phoneNormalized
    );

    const phone = phoneCallEligible ? phoneNormalized : "";
    const phoneDisplay = phoneCallEligible;

    const businessHours = pickStr(
      listing?.business_hours,
      listing?.service_hours,
      bs?.area_info?.service_hours,
      bs?.hero?.service_hours,
      extra?.business_hours,
      extra?.hours,
      fd?.business_hours
    );

    const serviceArea = pickStr(
      listing?.service_area,
      bs?.area_info?.service_area,
      extra?.visit_area,
      extra?.address,
      fd?.service_area
    );

    const cta = bs?.cta || {};
    const methods = [];
    if (parsePublicFlag(cta.show_inquiry) !== false && cta.inquiry_enabled !== false) {
      methods.push("チャット・問い合わせ");
    }
    if (parsePublicFlag(cta.show_estimate) !== false && cta.estimate_enabled !== false) {
      methods.push("見積相談");
    }
    if (phoneCallEligible) methods.push("電話（同意後に発信）");
    if (!methods.length) methods.push("詳細ページ");

    const detailUrl = String(options.detailUrl || "").trim();

    return {
      phone,
      tel: phoneCallEligible ? telHrefFromPhone(phone) : "",
      phoneDisplay,
      phoneCallEligible,
      phonePublic,
      phoneSubscription,
      phonePublicLabel: phoneCallEligible
        ? "電話公開（オプション加入済み）"
        : phonePublic && !phoneSubscription
          ? "電話オプション未加入"
          : "非公開",
      businessHours: businessHours || "—",
      serviceArea: serviceArea || "—",
      contactMethods: methods.join("、"),
      contactUrl: detailUrl,
      detailUrl,
      chatUrl: detailUrl,
      contactNote:
        "電話番号は詳細ページで確認するか、チャット・問い合わせからご連絡ください。",
    };
  }

  function attachContactToCard(card, listing, options = {}) {
    const contact = extractContactInfo(listing, {
      detailUrl: card.detailUrl,
      kind: card.kind,
      ...options,
    });
    return { ...card, ...contact };
  }

  global.TasuAiContactInfo = {
    extractContactInfo,
    attachContactToCard,
    hasPhoneSubscriptionOption,
    telHrefFromPhone,
    normalizePhoneDisplay,
  };
})(typeof window !== "undefined" ? window : globalThis);
