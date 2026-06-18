/**
 * 掲載タグの収集・表示用（DB / form_data のみ。固定デモタグは含めない）
 */
(function () {
  "use strict";

  function parseFormData(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function parseTagString(raw) {
    if (Array.isArray(raw)) return normalizeTagEntries(raw);
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  /** product タグ用（カンマ・読点のみ。空白では分割しない） */
  function parseProductTagString(raw) {
    if (Array.isArray(raw)) return normalizeProductTagEntries(raw);
    return String(raw || "")
      .split(/[,、]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function normalizeProductTagEntries(raw) {
    if (raw == null || raw === "") return [];

    if (Array.isArray(raw)) {
      return raw.flatMap((item) => {
        if (typeof item === "string") {
          return parseProductTagString(item);
        }
        if (item && typeof item === "object") {
          const label = item.label || item.name || item.title || item.text || "";
          const s = String(label).trim();
          return s ? [s] : [];
        }
        return [];
      });
    }

    if (typeof raw === "object") {
      if (typeof raw.invoiceLabel === "string" && raw.invoiceLabel.trim()) {
        return [raw.invoiceLabel.trim()];
      }
      return [];
    }

    return parseProductTagString(raw);
  }

  const PRODUCT_TAG_BLOCK_FIELD_KEYS = [
    "product_description",
    "description",
    "condition",
    "delivery_method",
    "delivery_note",
    "shipping_method",
    "shipping",
    "stock_count",
    "stock",
    "inventory",
    "price",
    "product_name",
    "spec",
    "specs",
    "specification",
    "product_spec",
    "payment",
    "image_url",
    "thumbnail_url",
    "main_image_url",
  ];

  const MAX_PRODUCT_TAG_LENGTH = 48;

  function addProductTagBlockValues(set, value) {
    if (value == null || value === "") return;
    if (typeof value === "object" && !Array.isArray(value)) {
      if (value.category) addProductTagBlockValues(set, value.category);
      if (value.subcategory || value.subCategory) {
        addProductTagBlockValues(set, value.subcategory || value.subCategory);
      }
      if (value.productCategory) addProductTagBlockValues(set, value.productCategory);
      return;
    }
    const text = String(value).trim();
    if (!text) return;
    set.add(text.toLowerCase());
    if (text.length > MAX_PRODUCT_TAG_LENGTH) {
      parseProductTagString(text).forEach((part) => {
        if (part) set.add(part.toLowerCase());
      });
    }
  }

  function buildProductTagBlocklist(row) {
    const block = new Set();
    if (!row) return block;

    const formData = parseFormData(row.form_data);
    addProductTagBlockValues(block, row.description);
    addProductTagBlockValues(block, row.product_description);
    PRODUCT_TAG_BLOCK_FIELD_KEYS.forEach((key) => {
      addProductTagBlockValues(block, row[key]);
    });
    if (row.price_amount != null && !Number.isNaN(Number(row.price_amount))) {
      addProductTagBlockValues(block, `¥${Number(row.price_amount).toLocaleString("ja-JP")}`);
      addProductTagBlockValues(block, String(row.price_amount));
    }

    PRODUCT_TAG_BLOCK_FIELD_KEYS.forEach((key) => {
      addProductTagBlockValues(block, formData[key]);
    });

    if (Array.isArray(formData.images)) {
      formData.images.forEach((url) => addProductTagBlockValues(block, url));
    }
    if (Array.isArray(formData.gallery_urls)) {
      formData.gallery_urls.forEach((url) => addProductTagBlockValues(block, url));
    }
    if (Array.isArray(formData.galleryUrls)) {
      formData.galleryUrls.forEach((url) => addProductTagBlockValues(block, url));
    }

    (Array.isArray(formData.options) ? formData.options : []).forEach((item) => {
      if (!item || typeof item !== "object") return;
      addProductTagBlockValues(block, item.name || item.title || item.label);
      addProductTagBlockValues(block, item.desc || item.description);
    });

    return block;
  }

  /** 文字列・配列・{label,name} オブジェクトを表示用ラベル配列に */
  function normalizeTagEntries(raw) {
    if (raw == null || raw === "") return [];

    if (Array.isArray(raw)) {
      return raw.flatMap((item) => {
        if (typeof item === "string") {
          const t = item.trim();
          return t ? [t] : [];
        }
        if (item && typeof item === "object") {
          const label = item.label || item.name || item.title || item.text || "";
          const s = String(label).trim();
          return s ? [s] : [];
        }
        return [];
      });
    }

    if (typeof raw === "object") {
      if (typeof raw.invoiceLabel === "string" && raw.invoiceLabel.trim()) {
        return [raw.invoiceLabel.trim()];
      }
      return [];
    }

    return parseTagString(raw);
  }

  /**
   * 一覧・詳細で表示するタグ（tags カラム + form_data の保存値のみ）
   */
  function collectDisplayTags(row) {
    if (!row) return [];

    const formData = parseFormData(row.form_data);
    const chunks = [
      normalizeTagEntries(row.tags),
      normalizeTagEntries(formData.tags),
      normalizeTagEntries(formData.available_tags),
      normalizeTagEntries(formData.option_tags),
    ];
    const badgeTags = normalizeTagEntries(formData.badges);
    if (Array.isArray(formData.badges)) {
      chunks.push(badgeTags);
    }

    const seen = new Set();
    const merged = [];
    chunks.flat().forEach((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(tag);
    });

    return merged.slice(0, 12);
  }

  /** 商品詳細・一覧のタグチップ用（listing.tags / form_data.tags / form_data.available_tags のみ） */
  function collectProductDisplayTags(row) {
    if (!row) return [];

    const formData = parseFormData(row.form_data);
    const blocklist = buildProductTagBlocklist(row);
    const exclude = new Set();

    normalizeProductTagEntries(formData.option_tags).forEach((tag) => {
      exclude.add(tag.toLowerCase());
    });

    (Array.isArray(formData.options) ? formData.options : []).forEach((item) => {
      if (!item || typeof item !== "object") return;
      const name = String(item.name || item.title || item.label || "").trim();
      if (name) exclude.add(name.toLowerCase());
    });

    const seen = new Set();
    const merged = [];

    [
      normalizeProductTagEntries(row.available_tags),
      normalizeProductTagEntries(row.tags),
      normalizeProductTagEntries(formData.tags),
      normalizeProductTagEntries(formData.available_tags),
    ]
      .flat()
      .forEach((tag) => {
        const key = tag.toLowerCase();
        if (
          !tag ||
          tag.length > MAX_PRODUCT_TAG_LENGTH ||
          seen.has(key) ||
          exclude.has(key) ||
          blocklist.has(key)
        ) {
          return;
        }
        seen.add(key);
        merged.push(tag);
      });

    return merged.slice(0, 12);
  }

  window.TasuListingTags = {
    collectDisplayTags,
    collectProductDisplayTags,
    normalizeTagEntries,
    normalizeProductTagEntries,
    parseTagString,
    parseProductTagString,
  };
})();
