/**

 * product 掲載フィールド解決（listings 直下優先 + form_data 互換 fallback）

 */

(function () {

  "use strict";



  const PRODUCT_CONDITION_LABELS = {

    new: "新品",

    "like-new": "未使用に近い",

    good: "美品",

    used: "中古",

  };



  function parseFormData(raw) {

    if (!raw) return {};

    if (typeof raw === "object") return raw;

    try {

      let parsed = JSON.parse(raw);

      while (typeof parsed === "string" && parsed.trim()) {

        try {

          parsed = JSON.parse(parsed);

        } catch {

          break;

        }

      }

      return typeof parsed === "object" && parsed !== null ? parsed : {};

    } catch {

      return {};

    }

  }



  function safeStr(value, fallback) {

    if (value == null) return fallback ?? "";

    const text = String(value).trim();

    if (!text || text === "undefined" || text === "null") return fallback ?? "";

    return text;

  }



  function pickFormValue(formData, keys) {

    if (!formData || typeof formData !== "object") return "";

    for (let i = 0; i < keys.length; i += 1) {

      const value = formData[keys[i]];

      if (value == null || value === "") continue;

      if (typeof value === "number" && !Number.isNaN(value)) {

        return String(value);

      }

      if (typeof value === "string" && value.trim()) {

        return value.trim();

      }

    }

    return "";

  }



  /** listings カラム優先 → form_data fallback */

  function pickListingValue(listing, formData, listingKeys, formKeys) {

    const fd = formData || {};

    const keys = listingKeys || [];

    for (let i = 0; i < keys.length; i += 1) {

      const value = listing?.[keys[i]];

      if (value == null || value === "") continue;

      if (typeof value === "number" && !Number.isNaN(value)) {

        return String(value);

      }

      if (typeof value === "string" && value.trim()) {

        return value.trim();

      }

    }

    return pickFormValue(fd, formKeys || listingKeys);

  }



  function coerceTagArray(raw) {

    if (Array.isArray(raw)) {

      return raw.map((t) => safeStr(t, "")).filter(Boolean);

    }

    if (typeof raw === "string" && raw.trim()) {

      return raw

        .split(/[,、]+/)

        .map((t) => t.trim())

        .filter(Boolean);

    }

    return [];

  }



  function normalizeUrl(url) {

    if (!url) return "";

    if (window.TasuListingImages?.normalizeImageUrl) {

      return window.TasuListingImages.normalizeImageUrl(url) || "";

    }

    if (window.TasuListingImages?.resolveUrlCandidate) {

      return window.TasuListingImages.resolveUrlCandidate(url) || "";

    }

    return safeStr(url, "");

  }



  function getFormData(listing, formData) {

    if (formData && typeof formData === "object") return formData;

    return parseFormData(listing?.form_data);

  }



  function isProductListing(listing) {

    return String(listing?.listing_type || listing?.type || "").trim() === "product";

  }



  function coerceGalleryUrls(listing, formData) {

    const Images = window.TasuListingImages;

    const fd = formData || {};

    const merged = [];

    const seen = new Set();



    const add = (url) => {

      const resolved = normalizeUrl(url);

      if (!resolved || seen.has(resolved)) return;

      seen.add(resolved);

      merged.push(resolved);

    };



    const listingGallery = listing?.gallery_urls ?? listing?.galleryUrls;

    const listingImages = listing?.images;



    if (Images?.coerceImageUrlList) {

      Images.coerceImageUrlList(listingGallery).forEach(add);

      Images.coerceImageUrlList(listingImages).forEach(add);

      Images.coerceImageUrlList(fd.gallery_urls ?? fd.galleryUrls).forEach(add);

      Images.coerceImageUrlList(fd.images).forEach(add);

      return merged;

    }



    [listingGallery, listingImages, fd.gallery_urls, fd.galleryUrls, fd.images].forEach(

      (raw) => {

        if (Array.isArray(raw)) {

          raw.forEach(add);

        } else if (typeof raw === "string" && raw.trim()) {

          raw

            .split(/[,、\s]+/)

            .map((s) => s.trim())

            .filter(Boolean)

            .forEach(add);

        }

      }

    );



    return merged;

  }



  function resolveProductTitle(listing, formData) {

    const fd = getFormData(listing, formData);

    return safeStr(listing?.title, "") || safeStr(fd.product_name, "");

  }



  function resolveProductDescription(listing, formData) {

    const fd = getFormData(listing, formData);

    return (

      safeStr(listing?.product_description, "") ||
      safeStr(listing?.description, "") ||
      safeStr(fd.product_description, "") ||
      safeStr(fd.description, "")

    );

  }



  function resolveProductPrimaryImageUrl(listing, formData) {

    const fd = getFormData(listing, formData);

    const gallery = coerceGalleryUrls(listing, fd);

    const candidates = [

      listing?.image_url,

      listing?.imageUrl,

      fd.image_url,

      fd.main_image_url,

      gallery[0],

    ];

    for (let i = 0; i < candidates.length; i += 1) {

      const resolved = normalizeUrl(candidates[i]);

      if (resolved) return resolved;

    }

    return "";

  }



  function resolveProductThumbnail(listing, formData, primaryImage) {

    const fd = getFormData(listing, formData);

    const candidates = [

      listing?.thumbnail_url,

      listing?.thumbnailUrl,

      listing?.image_url,

      fd.thumbnail_url,

      fd.image_url,

      primaryImage,

    ];

    for (let i = 0; i < candidates.length; i += 1) {

      const resolved = normalizeUrl(candidates[i]);

      if (resolved) return resolved;

    }

    return primaryImage || "";

  }



  function resolveProductGallery(listing, formData, primaryImage) {

    const gallery = coerceGalleryUrls(listing, getFormData(listing, formData));

    if (!primaryImage) return gallery;

    return gallery.filter((url) => url !== primaryImage);

  }



  function resolveProductCategory(listing, formData) {

    const fd = getFormData(listing, formData);

    let category = safeStr(listing?.category, "");

    if (category) return category;

    if (typeof fd.category === "string") {

      return safeStr(fd.category, "");

    }

    if (fd.category && typeof fd.category === "object" && !Array.isArray(fd.category)) {

      return safeStr(fd.category.category || fd.category.productCategory, "");

    }

    return "";

  }



  function resolveProductSubcategory(listing, formData) {

    const fd = getFormData(listing, formData);

    let subcategory = safeStr(listing?.subcategory, "");

    if (subcategory) return subcategory;

    subcategory = safeStr(fd.subcategory || fd.subCategory, "");

    if (subcategory) return subcategory;

    if (fd.category && typeof fd.category === "object" && !Array.isArray(fd.category)) {

      return safeStr(fd.category.subCategory || fd.category.subcategory, "");

    }

    return "";

  }



  function resolveProductCategoryText(listing, formData) {

    const category = resolveProductCategory(listing, formData);

    const subcategory = resolveProductSubcategory(listing, formData);

    if (category && subcategory) return `${category} · ${subcategory}`;

    if (category) return category;

    if (subcategory) return subcategory;

    return "";

  }



  function resolveProductTags(listing, formData) {

    const fd = getFormData(listing, formData);

    if (window.TasuListingTags?.collectProductDisplayTags) {

      return window.TasuListingTags.collectProductDisplayTags({

        tags: listing?.tags,

        form_data: fd,

        listing_type: "product",

        available_tags: listing?.available_tags ?? fd.available_tags,

      });

    }

    return [];

  }



  function resolveProductPrice(listing, formData) {

    const fd = getFormData(listing, formData);

    const amountRaw = listing?.price_amount;

    if (amountRaw != null && !Number.isNaN(Number(amountRaw))) {

      const amount = Number(amountRaw);

      return {

        amount,

        text: `¥${amount.toLocaleString("ja-JP")}`,

      };

    }

    const fromForm = pickFormValue(fd, ["price"]);

    if (fromForm) {

      const digits = fromForm.replace(/[^\d]/g, "");

      const amount = Number(digits);

      if (Number.isFinite(amount) && amount >= 0) {

        return {

          amount,

          text: `¥${amount.toLocaleString("ja-JP")}`,

        };

      }

      return {

        amount: null,

        text: fromForm.includes("¥") ? fromForm : `¥${fromForm}`,

      };

    }

    const legacy = safeStr(listing?.priceText, "");

    return { amount: null, text: legacy };

  }



  function resolveProductCondition(listing, formData) {

    const fd = getFormData(listing, formData);

    const raw = pickListingValue(listing, fd, ["condition"], ["condition"]);

    if (!raw) return "";

    return PRODUCT_CONDITION_LABELS[raw] || raw;

  }



  function resolveProductDeliveryMethod(listing, formData) {

    const fd = getFormData(listing, formData);

    return pickListingValue(

      listing,

      fd,

      ["delivery_method"],

      ["delivery_method", "shipping_method", "delivery_note", "shipping"]

    );

  }



  function resolveProductStockCount(listing, formData) {

    const fd = getFormData(listing, formData);

    return pickListingValue(listing, fd, ["stock_count"], [

      "stock_count",

      "stock",

      "inventory",

      "stock_quantity",

      "quantity",

    ]);

  }



  function resolveProductDeliveryDays(listing, formData) {
    const fd = getFormData(listing, formData);
    return pickListingValue(listing, fd, ["delivery_days"], ["delivery_days"]);
  }

  function resolveProductSpec(listing, formData) {

    const fd = getFormData(listing, formData);

    return pickListingValue(listing, fd, ["spec"], [

      "spec",

      "specification",

      "product_spec",

      "specs",

      "specifications",

      "product_specs",

    ]);

  }



  function resolveProductAvailableTags(listing, formData) {

    const fd = getFormData(listing, formData);

    const fromListing = coerceTagArray(listing?.available_tags);

    if (fromListing.length) return fromListing;

    return coerceTagArray(fd.available_tags);

  }



  function resolveProductIsNewStructure(listing, formData) {

    const fd = formData || getFormData(listing);

    return Boolean(

      safeStr(listing?.category, "") &&

        (safeStr(listing?.description, "") ||

          safeStr(listing?.product_description, "") ||

          safeStr(fd.description, "") ||

          safeStr(fd.product_description, ""))

    );

  }



  function resolveProductOptions(listing, formData) {
    if (Array.isArray(listing?.options)) return listing.options;
    const fd = formData || getFormData(listing);
    return Array.isArray(fd.options) ? fd.options : [];
  }



  /**

   * product 掲載を表示用に正規化（listings 直下優先 + form_data fallback）

   * @param {object} listing

   * @returns {object|null}

   */

  function normalizeProductListing(listing) {

    if (!listing) return null;

    const fd = getFormData(listing);

    const galleryDirect =
      Array.isArray(listing?.gallery_urls) && listing.gallery_urls.length
        ? listing.gallery_urls
        : Array.isArray(fd?.gallery_urls)
          ? fd.gallery_urls
          : [];
    const imagesDirect =
      Array.isArray(listing?.images) && listing.images.length
        ? listing.images
        : Array.isArray(fd?.images)
          ? fd.images
          : [];
    const optionsDirect =
      Array.isArray(listing?.options) && listing.options.length
        ? listing.options
        : Array.isArray(fd?.options)
          ? fd.options
          : [];

    // gallery は listings 直下を最優先（無い場合だけ互換 fallback）
    const galleryCoerced = coerceGalleryUrls(listing, fd);
    const gallery = galleryDirect.length ? galleryDirect : galleryCoerced;

    const image =
      safeStr(listing?.image_url, "") ||
      safeStr(fd?.image_url, "") ||
      safeStr(gallery?.[0], "") ||
      safeStr(galleryCoerced?.[0], "") ||
      "";
    const thumbnail =
      safeStr(listing?.thumbnail_url, "") ||
      safeStr(listing?.image_url, "") ||
      safeStr(fd?.thumbnail_url, "") ||
      safeStr(fd?.image_url, "") ||
      image ||
      "";

    const price = resolveProductPrice(listing, fd);

    return {
      id: listing.id,
      title: safeStr(listing?.title, "") || safeStr(fd?.product_name, "") || "",
      description:
        safeStr(listing?.product_description, "") ||
        safeStr(listing?.description, "") ||
        safeStr(fd?.product_description, "") ||
        safeStr(fd?.description, "") ||
        "",
      category: safeStr(listing?.category, "") || safeStr(fd?.category, "") || "",
      subcategory:
        safeStr(listing?.subcategory, "") ||
        safeStr(fd?.subcategory || fd?.subCategory, "") ||
        "",
      condition: safeStr(listing?.condition, "") || safeStr(fd?.condition, "") || "",
      deliveryMethod:
        safeStr(listing?.delivery_method, "") ||
        safeStr(fd?.delivery_method, "") ||
        "",
      stockCount: listing?.stock_count ?? fd?.stock_count ?? "",
      deliveryDays:
        safeStr(listing?.delivery_days, "") || safeStr(fd?.delivery_days, "") || "",
      spec: safeStr(listing?.spec, "") || safeStr(fd?.spec, "") || "",
      image,
      thumbnail,
      gallery: Array.isArray(gallery) ? gallery : [],
      images: Array.isArray(imagesDirect) ? imagesDirect : [],
      options: Array.isArray(optionsDirect) ? optionsDirect : [],
      tags: window.TasuListingTags?.collectProductDisplayTags
        ? window.TasuListingTags.collectProductDisplayTags(listing)
        : resolveProductTags(listing, fd),
      price,
      raw: listing,
    };

  }



  window.TasuProductListingFields = {

    parseFormData,

    isProductListing,

    normalizeProductListing,

    pickListingValue,

    resolveProductTitle,

    resolveProductDescription,

    resolveProductPrimaryImageUrl,

    resolveProductCategory,

    resolveProductSubcategory,

    resolveProductCategoryText,

    resolveProductCondition,

    resolveProductDeliveryMethod,

    resolveProductStockCount,

    resolveProductSpec,

  };

})();


