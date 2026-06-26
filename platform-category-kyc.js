/**
 * Platform — カテゴリ別 KYC 要件（ON/OFF）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_platform_category_kyc";

  const DEFAULT_RULES = Object.freeze({
    construction: { label: "建設", kycRequired: true, licenseRequired: true, highValueThreshold: 500000 },
    taxi: { label: "タクシー・運送", kycRequired: true, licenseRequired: true, highValueThreshold: 0 },
    licensed: { label: "資格業", kycRequired: true, licenseRequired: true, highValueThreshold: 0 },
    high_value: { label: "高額案件", kycRequired: true, licenseRequired: false, highValueThreshold: 300000 },
    general: { label: "一般", kycRequired: false, licenseRequired: false, highValueThreshold: 0 },
  });

  function readOverrides() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveOverrides(overrides) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(overrides || {}));
    } catch {
      /* ignore */
    }
  }

  function resolveCategoryKey(listing) {
    const t = `${listing?.category || ""} ${listing?.trade || ""} ${listing?.tags || ""} ${listing?.title || ""}`.toLowerCase();
    if (/建設|工事|リフォーム|塗装|外壁/.test(t)) return "construction";
    if (/タクシー|運送|配送/.test(t)) return "taxi";
    if (/資格|免許|電工|設備/.test(t)) return "licensed";
    const price = Number(listing?.price ?? listing?.price_amount);
    if (Number.isFinite(price) && price >= 300000) return "high_value";
    return "general";
  }

  function getRule(categoryKey) {
    const key = categoryKey || "general";
    const base = DEFAULT_RULES[key] || DEFAULT_RULES.general;
    const ov = readOverrides()[key] || {};
    return { ...base, ...ov, key };
  }

  function setRuleEnabled(categoryKey, field, enabled) {
    const key = String(categoryKey || "").trim();
    if (!key) return;
    const prev = readOverrides();
    prev[key] = { ...(prev[key] || {}), [field]: Boolean(enabled) };
    saveOverrides(prev);
  }

  /**
   * @param {object} listing
   * @returns {{ ok: boolean, warnings: string[], rule: object }}
   */
  function checkListing(listing) {
    const rule = getRule(resolveCategoryKey(listing));
    const warnings = [];
    if (rule.kycRequired && !(listing?.identity_verified || listing?.kyc_verified || listing?.verified)) {
      warnings.push("本人確認（KYC）の確認が必要です");
    }
    if (rule.licenseRequired && !(listing?.license_verified || listing?.has_license)) {
      warnings.push("資格・許可の確認が必要です");
    }
    const price = Number(listing?.price ?? listing?.price_amount);
    if (rule.highValueThreshold > 0 && Number.isFinite(price) && price >= rule.highValueThreshold) {
      warnings.push("高額案件 — 追加確認を推奨");
    }
    return { ok: warnings.length === 0, warnings, rule };
  }

  global.TasuPlatformCategoryKyc = {
    STORAGE_KEY,
    DEFAULT_RULES,
    getRule,
    setRuleEnabled,
    resolveCategoryKey,
    checkListing,
    readOverrides,
  };
})(typeof window !== "undefined" ? window : globalThis);
