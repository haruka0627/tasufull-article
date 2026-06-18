/**
 * TASFUL TALK Phase13 — カテゴリ正規化（通知・フォロー・設定・配信）
 */
(function (global) {
  "use strict";

  /** 通知・受信設定 */
  const NOTIFICATION_TYPE_KEYS = Object.freeze([
    "skill",
    "worker",
    "job",
    "product",
    "shop",
    "business",
    "builder",
    "anpi",
    "system",
  ]);

  /** フォロー対象 */
  const FOLLOW_TYPE_KEYS = Object.freeze([
    "skill",
    "worker",
    "job",
    "product",
    "shop",
    "business",
    "builder",
  ]);

  const TYPE_LABELS = Object.freeze({
    skill: "スキル",
    worker: "ワーカー",
    job: "求人",
    product: "商品",
    shop: "店舗・販売",
    business: "業務サービス",
    builder: "Builder",
    anpi: "安否",
    system: "運営",
  });

  const NOTIFICATION_TYPE_SET = new Set(NOTIFICATION_TYPE_KEYS);
  const FOLLOW_TYPE_SET = new Set(FOLLOW_TYPE_KEYS);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeRawTypeKey(type) {
    return String(type || "")
      .toLowerCase()
      .replace(/-/g, "_");
  }

  function listingTypeKey(data) {
    return normalizeRawTypeKey(
      pickStr(
        data?.listingType,
        data?.listing_type,
        data?.type,
        data?.listingTypeKey,
        data?.scope,
        data?.businessType,
        data?.business_type
      )
    );
  }

  function targetUrlLower(data) {
    return pickStr(data?.targetUrl, data?.href, data?.url, data?.target_url, data?.detailUrl).toLowerCase();
  }

  function isProductContext(data) {
    if (!data || typeof data !== "object") return false;
    const url = targetUrlLower(data);
    if (url.includes("detail-product")) return true;
    const lt = listingTypeKey(data);
    if (lt === "product") return true;
    return false;
  }

  function isShopContext(data) {
    if (!data || typeof data !== "object") return false;
    const url = targetUrlLower(data);
    if (url.includes("detail-shop") && !url.includes("detail-shop-product")) return true;
    const lt = listingTypeKey(data);
    if (lt === "shop_store" || lt === "store" || lt === "shop") return true;
    const text = `${pickStr(data?.title)} ${pickStr(data?.body)}`;
    if (/店舗・販売|店舗販売|店舗/.test(text)) return true;
    return false;
  }

  function resolveShopOrProduct(type, data) {
    const t = normalizeRawTypeKey(type);
    if (t === "product") return "product";
    const lt = listingTypeKey(data);
    if (lt === "product") return "product";
    const url = targetUrlLower(data);
    if (url.includes("detail-product")) return "product";
    if (lt === "shop_store" || lt === "store" || lt === "shop") return "shop";
    if (url.includes("detail-shop")) return "shop";
    if (isShopContext(data)) return "shop";
    if (isProductContext(data)) return "product";
    if (t === "shop" || t === "shop_store" || t === "store") return "shop";
    return "shop";
  }

  /**
   * 通知タイプ正規化（読み込み時・保存時に共通利用）
   * @param {string} type
   * @param {object} [data]
   */
  function normalizeTalkNotificationType(type, data) {
    let t = normalizeRawTypeKey(type);

    if (t === "business_service" || t === "field_service") t = "business";
    if (t === "ops" || t === "operation" || t === "運営" || t === "qa") t = "system";
    if (t === "ad" || t === "notice" || t === "notification" || t === "広告") t = "system";
    if (t === "general" || t === "project") t = "skill";
    if (t === "store" || t === "shop_store") t = "shop";

    if (t === "shop") return resolveShopOrProduct(t, data);
    if (NOTIFICATION_TYPE_SET.has(t)) return t;

    if (t === "product") return "product";
    return "system";
  }

  /**
   * フォロー対象タイプ正規化
   * @param {string} type
   * @param {object} [data]
   */
  function normalizeFollowType(type, data) {
    const raw = normalizeRawTypeKey(type);
    if (raw === "project") {
      const url = targetUrlLower(data);
      if (url.includes("builder/") || url.includes("mvp-project")) return "builder";
      return "skill";
    }

    const notifyType = normalizeTalkNotificationType(type, data);
    if (FOLLOW_TYPE_SET.has(notifyType)) return notifyType;
    return "skill";
  }

  /**
   * 掲載レコード → フォロー/通知カテゴリ
   * @param {object} record
   */
  function resolveListingCategoryType(record) {
    if (!record || typeof record !== "object") return "skill";

    const lt = listingTypeKey(record);
    const directMap = {
      skill: "skill",
      worker: "worker",
      job: "job",
      product: "product",
      shop_store: "shop",
      store: "shop",
      shop: "shop",
      business_service: "business",
      field_service: "business",
      business: "business",
      general: "skill",
    };
    if (directMap[lt]) return directMap[lt];

    const store = global.TasuListingLocalStore;
    if (store?.resolveListingTypeKey) {
      const key = store.resolveListingTypeKey(record._localRecord || record);
      const map = {
        skill: "skill",
        worker: "worker",
        job: "job",
        product: "product",
        shop_store: "shop",
        business_service: "business",
        general: "skill",
      };
      if (map[key]) return map[key];
    }

    return resolveShopOrProduct(lt, record) === "product" ? "product" : "skill";
  }

  /** 配信下書き kind → 通知 type */
  function broadcastKindToNotifyType(kind, data) {
    const k = normalizeRawTypeKey(kind);
    if (k === "ad" || k === "notice" || k === "anpi") {
      if (k === "anpi") return "anpi";
      return "system";
    }
    if (k === "project") return "skill";
    return normalizeTalkNotificationType(k, data);
  }

  /** 配信下書き kind 保存値の正規化（レガシー吸収） */
  function normalizeBroadcastKind(kind) {
    const k = normalizeRawTypeKey(kind);
    if (k === "notification" || k === "notify") return "notice";
    if (k === "advertisement" || k === "広告") return "ad";
    if (k === "project") return "skill";
    if (
      k === "ad" ||
      k === "notice" ||
      k === "skill" ||
      k === "job" ||
      k === "shop" ||
      k === "business" ||
      k === "builder" ||
      k === "anpi" ||
      k === "system"
    ) {
      return k;
    }
    return "system";
  }

  /**
   * 受信設定 types の移行（project→skill、shop→product/shop）
   * @param {Record<string, boolean>} [rawTypes]
   */
  function migrateSettingsTypes(rawTypes) {
    const out = {};
    for (let i = 0; i < NOTIFICATION_TYPE_KEYS.length; i += 1) {
      out[NOTIFICATION_TYPE_KEYS[i]] = true;
    }
    if (!rawTypes || typeof rawTypes !== "object") return out;

    for (const key of Object.keys(rawTypes)) {
      const val = rawTypes[key] === true;
      const k = normalizeRawTypeKey(key);

      if (k === "project") {
        out.skill = val;
        continue;
      }

      if (k === "shop") {
        out.shop = val;
        out.product = val;
        continue;
      }

      const normalized = normalizeTalkNotificationType(k, { listingType: k });
      if (NOTIFICATION_TYPE_SET.has(normalized)) {
        out[normalized] = val;
      }
    }

    return out;
  }

  function typeLabel(type) {
    const t = normalizeTalkNotificationType(type);
    return TYPE_LABELS[t] || type || "—";
  }

  global.TasuTalkCategory = {
    NOTIFICATION_TYPE_KEYS,
    FOLLOW_TYPE_KEYS,
    TYPE_LABELS,
    normalizeTalkNotificationType,
    normalizeFollowType,
    resolveListingCategoryType,
    broadcastKindToNotifyType,
    normalizeBroadcastKind,
    migrateSettingsTypes,
    typeLabel,
    isProductContext,
    isShopContext,
    resolveShopOrProduct,
  };
})(typeof window !== "undefined" ? window : globalThis);
