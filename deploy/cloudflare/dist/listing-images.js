/**
 * 掲載画像（スキル掲載向け）— Supabase Storage / data URL フォールバック
 */
(function () {
  "use strict";

  const BUCKET = "listing-images";
  const MAX_GALLERY = 6;
  const MAX_DATA_URL_CHARS = 1_200_000;
  const MAX_IMAGE_DIMENSION = 1600;
  const JPEG_QUALITY = 0.82;

  function getConfig() {
    return window.TASU_CHAT_SUPABASE_CONFIG || {};
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function parseFormData(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function storagePublicUrl(relativePath) {
    const cfg = getConfig();
    const base = String(cfg.url || "").replace(/\/+$/, "");
    if (!base || !relativePath) return "";

    const path = String(relativePath).replace(/^\/+/, "");
    if (path.startsWith("storage/v1/object/public/")) {
      return `${base}/${path}`;
    }
    const objectPath = path.startsWith(`${BUCKET}/`)
      ? path
      : `${BUCKET}/${path}`;
    return `${base}/storage/v1/object/public/${objectPath}`;
  }

  function normalizeImageUrl(url) {
    const value = String(url || "").trim();
    if (!value || value === "null" || value === "undefined") return "";

    if (value.startsWith("//")) {
      return `https:${value}`;
    }

    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:image/") ||
      value.startsWith("blob:")
    ) {
      return value;
    }

    if (/supabase\.co/i.test(value)) {
      const withScheme = value.startsWith("//")
        ? `https:${value}`
        : `https://${value.replace(/^\/+/, "")}`;
      return withScheme;
    }

    const cfg = getConfig();
    const base = String(cfg.url || "").replace(/\/+$/, "");

    if (value.startsWith("/storage/v1/object/public/")) {
      return base ? `${base}${value}` : "";
    }
    if (value.startsWith("storage/v1/object/public/")) {
      return base ? `${base}/${value}` : "";
    }
    if (value.startsWith(`${BUCKET}/`) || value.startsWith(`public/${BUCKET}/`)) {
      const path = value.replace(/^public\//, "");
      return base ? `${base}/storage/v1/object/public/${path}` : "";
    }

    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value) || value.includes("/")) {
      const fromStorage = storagePublicUrl(value);
      if (fromStorage) return fromStorage;
      if (base) {
        return `${base}/storage/v1/object/public/${value.replace(/^\/+/, "")}`;
      }
    }

    return "";
  }

  /** 単一値 → 表示可能な画像URL（正規化失敗時も https / data: はそのまま採用） */
  function resolveUrlCandidate(value) {
    if (value == null || value === "") return null;

    const viaEntry = normalizeImageEntry(value);
    if (viaEntry) return viaEntry;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
      if (
        /^https?:\/\//i.test(trimmed) ||
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("blob:")
      ) {
        return trimmed;
      }
      const normalized = normalizeImageUrl(trimmed);
      if (normalized) return normalized;
    }

    return null;
  }

  function coerceImageUrlList(raw) {
    const urls = [];
    coerceToArray(raw).forEach((item) => {
      const resolved = resolveUrlCandidate(item);
      if (resolved && !urls.includes(resolved)) {
        urls.push(resolved);
      }
    });
    return urls;
  }

  function isUsableImageUrl(url) {
    return Boolean(normalizeImageUrl(url));
  }

  function normalizeImageEntry(item) {
    if (item == null || item === "") return null;

    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return normalizeImageEntry(parsed[0]);
          }
          if (parsed && typeof parsed === "object") {
            return normalizeImageEntry(parsed);
          }
        } catch {
          /* plain URL string */
        }
      }
      const normalized = normalizeImageUrl(trimmed);
      return normalized || null;
    }

    if (typeof item === "object") {
      const candidate = pickImageField(item, [
        "url",
        "src",
        "href",
        "image_url",
        "imageUrl",
        "thumbnail_url",
        "thumbnailUrl",
      ]);
      const normalized = normalizeImageUrl(candidate);
      return normalized || null;
    }

    return null;
  }

  function pickImageField(obj, keys) {
    if (!obj || typeof obj !== "object") return "";
    for (let i = 0; i < keys.length; i += 1) {
      const value = obj[keys[i]];
      if (value != null && value !== "") return String(value);
    }
    return "";
  }

  /** 配列 / JSON文字列 / カンマ・改行区切りを配列に正規化 */
  function coerceToArray(raw) {
    if (raw == null || raw === "") return [];
    if (Array.isArray(raw)) return raw;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
          if (parsed && typeof parsed === "object") return [parsed];
        } catch {
          /* fall through */
        }
      }
      return trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    }

    if (typeof raw === "object") return [raw];
    return [];
  }

  function mergeImageUrlList(target, source) {
    coerceToArray(source).forEach((item) => {
      const normalized = normalizeImageEntry(item);
      if (normalized && !target.includes(normalized)) {
        target.push(normalized);
      }
    });
  }

  const DIRECT_IMAGE_KEYS = [
    "image_url",
    "imageUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "main_image_url",
    "mainImageUrl",
    "main_image",
    "mainImage",
    "cover_url",
    "coverUrl",
    "hero_image",
    "heroImage",
    "photo_url",
    "photoUrl",
  ];

  const NESTED_IMAGE_KEYS = [
    "images",
    "gallery_urls",
    "galleryUrls",
    "gallery",
    "photos",
    "photo_urls",
    "photoUrls",
    "media",
    "attachments",
    "files",
  ];

  function pushUniqueUrl(target, url) {
    const normalized = normalizeImageUrl(url);
    if (normalized && !target.includes(normalized)) {
      target.push(normalized);
    }
  }

  function scanValueForImages(value, depth, target, seen) {
    if (value == null || depth > 6) return;

    if (typeof value === "string") {
      pushUniqueUrl(target, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => scanValueForImages(item, depth + 1, target, seen));
      return;
    }

    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    DIRECT_IMAGE_KEYS.forEach((key) => {
      if (value[key] != null) scanValueForImages(value[key], depth + 1, target, seen);
    });
    NESTED_IMAGE_KEYS.forEach((key) => {
      if (value[key] != null) scanValueForImages(value[key], depth + 1, target, seen);
    });
  }

  function collectAllImageUrls(formData, row) {
    const urls = [];
    const seen = new WeakSet();
    const fd = formData && typeof formData === "object" ? formData : {};

    DIRECT_IMAGE_KEYS.forEach((key) => {
      scanValueForImages(fd[key], 0, urls, seen);
      if (row && typeof row === "object") {
        scanValueForImages(row[key], 0, urls, seen);
      }
    });

    NESTED_IMAGE_KEYS.forEach((key) => {
      scanValueForImages(fd[key], 0, urls, seen);
      if (row && typeof row === "object") {
        scanValueForImages(row[key], 0, urls, seen);
      }
    });

    mergeImageUrlList(urls, fd.images);
    mergeImageUrlList(urls, fd.gallery_urls);
    mergeImageUrlList(urls, fd.galleryUrls);

    if (row && typeof row === "object") {
      mergeImageUrlList(urls, row.images);
      mergeImageUrlList(urls, row.gallery_urls);
      mergeImageUrlList(urls, row.galleryUrls);
      if (Array.isArray(row.galleryUrls)) {
        mergeImageUrlList(urls, row.galleryUrls);
      }
    }

    return urls.slice(0, MAX_GALLERY);
  }

  function extractImagesArray(formData, row) {
    return collectAllImageUrls(formData, row);
  }

  /**
   * メイン画像の優先順位:
   * form_data.image_url → main_image_url → thumbnail_url
   * → listing.image_url → listing.thumbnail_url
   * → gallery_urls[0] → images[0]
   */
  function resolvePrimaryFromListing(formData, row, galleryList, imageList) {
    const listingType = String(row?.listing_type || row?.type || "").trim();
    const isProduct = listingType === "product";
    const isJob = listingType === "job";
    if (isProduct && window.TasuProductListingFields?.normalizeProductListing) {
      const primary = window.TasuProductListingFields.normalizeProductListing(row)?.image;
      if (primary) return primary;
    }
    if (isJob && window.TasuJobListingFields?.resolveJobPrimaryImageUrl) {
      const primary = window.TasuJobListingFields.resolveJobPrimaryImageUrl(
        row,
        formData
      );
      if (primary) return primary;
    }
    const rowFirst = [
      row?.image_url,
      row?.thumbnail_url,
      row?.imageUrl,
      row?.thumbnailUrl,
      formData?.image_url,
      formData?.imageUrl,
      formData?.main_image_url,
      formData?.mainImageUrl,
      formData?.thumbnail_url,
      formData?.thumbnailUrl,
      galleryList[0],
      imageList[0],
    ];
    const formFirst = [
      formData?.image_url,
      formData?.imageUrl,
      formData?.main_image_url,
      formData?.mainImageUrl,
      formData?.thumbnail_url,
      formData?.thumbnailUrl,
      row?.image_url,
      row?.imageUrl,
      row?.thumbnail_url,
      row?.thumbnailUrl,
      row?.imageUrl,
      galleryList[0],
      imageList[0],
    ];
    const ordered = isProduct || isJob ? rowFirst : formFirst;

    for (let i = 0; i < ordered.length; i += 1) {
      const resolved = resolveUrlCandidate(ordered[i]);
      if (resolved) return resolved;
    }

    return null;
  }

  function mergeUniqueUrls(target, list) {
    (list || []).forEach((url) => {
      const resolved = resolveUrlCandidate(url);
      if (resolved && !target.includes(resolved)) {
        target.push(resolved);
      }
    });
  }

  /** 掲載1件分の画像セット（メイン + ギャラリー） */
  function resolveListingImageSet(row) {
    if (!row) {
      return { primary: null, gallery: [], allUrls: [] };
    }

    const formData = parseFormData(row.form_data);

    const galleryList = [];
    mergeUniqueUrls(galleryList, coerceImageUrlList(formData.gallery_urls));
    mergeUniqueUrls(galleryList, coerceImageUrlList(formData.galleryUrls));
    mergeUniqueUrls(galleryList, coerceImageUrlList(row?.gallery_urls));
    mergeUniqueUrls(galleryList, coerceImageUrlList(row?.galleryUrls));

    const imageList = [];
    mergeUniqueUrls(imageList, coerceImageUrlList(formData.images));
    mergeUniqueUrls(imageList, coerceImageUrlList(row?.images));

    let primary = resolvePrimaryFromListing(formData, row, galleryList, imageList);

    const gallery = [];
    if (primary) gallery.push(primary);
    mergeUniqueUrls(gallery, galleryList);
    mergeUniqueUrls(gallery, imageList);

    const deepUrls = collectAllImageUrls(formData, row);
    deepUrls.forEach((url) => {
      if (url && !gallery.includes(url)) gallery.push(url);
    });

    if (!primary && gallery.length) {
      primary = gallery[0];
    }

    return {
      primary,
      gallery: gallery.slice(0, MAX_GALLERY),
      allUrls: gallery.slice(),
    };
  }

  function toImageSourceRow(row) {
    const formData = parseFormData(row?.form_data);
    return {
      form_data: formData,
      image_url:
        pickImageField(row, ["image_url", "imageUrl"]) ||
        pickImageField(formData, ["image_url", "imageUrl"]) ||
        null,
      thumbnail_url:
        pickImageField(row, ["thumbnail_url", "thumbnailUrl"]) ||
        pickImageField(formData, ["thumbnail_url", "thumbnailUrl"]) ||
        null,
    };
  }

  /**
   * メイン画像の優先順位:
   * form_data.image_url → thumbnail_url → images[0] → listing.image_url → thumbnail_url
   */
  function collectImageFieldDebug(row) {
    const formData = parseFormData(row?.form_data);
    const images = extractImagesArray(formData, row);
    return {
      "form_data.image_url": pickImageField(formData, ["image_url", "imageUrl", "main_image_url", "mainImageUrl"]),
      "form_data.thumbnail_url": pickImageField(formData, ["thumbnail_url", "thumbnailUrl"]),
      "form_data.main_image_url": pickImageField(formData, ["main_image_url", "mainImageUrl"]),
      "form_data.images": formData.images,
      "form_data.gallery_urls": formData.gallery_urls ?? formData.galleryUrls,
      "form_data.images[0]": images[0] || null,
      "listing.image_url": pickImageField(row, ["image_url", "imageUrl", "main_image_url", "mainImageUrl"]),
      "listing.thumbnail_url": pickImageField(row, ["thumbnail_url", "thumbnailUrl"]),
      "listing.imageUrl": row?.imageUrl ?? null,
    };
  }

  function resolvePrimaryImageUrl(row) {
    return resolveListingImageSet(row).primary;
  }

  /** 詳細ギャラリー: メイン画像 + images / gallery_urls（重複除去） */
  function resolveGalleryUrls(row) {
    return resolveListingImageSet(row).gallery;
  }

  function placeholderUrl(label, size) {
    const text = encodeURIComponent(String(label || "T").charAt(0) || "T");
    if (size === "card") {
      return `https://placehold.co/480x320/f3ead4/967622?text=${text}`;
    }
    if (size === "noimage") {
      return "https://placehold.co/640x800/efe9dc/8b7a4a?text=No+Image";
    }
    return `https://placehold.co/640x800/f3ead4/967622?text=${text}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        resolve(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
                type: "image/jpeg",
              })
            );
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("画像の読み込みに失敗しました"));
      };

      img.src = objectUrl;
    });
  }

  async function fileToStorableUrl(file, userId, listingType) {
    const prepared = await compressImageFile(file);
    const sb = getClient();

    if (sb) {
      const safeName = String(file.name || "image.jpg")
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 80);
      const path = `${String(userId || "anon").replace(/[^\w\-]+/g, "_")}/${listingType}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`;

      const { error } = await sb.storage.from(BUCKET).upload(path, prepared, {
        cacheControl: "31536000",
        upsert: false,
        contentType: prepared.type || "image/jpeg",
      });

      if (!error) {
        const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      }
      console.warn("[TasuListingImages] storage upload failed, fallback to data URL:", error);
    }

    const dataUrl = await readFileAsDataUrl(prepared);
    if (String(dataUrl).length > MAX_DATA_URL_CHARS) {
      throw new Error("画像サイズが大きすぎます。別の画像をお試しください。");
    }
    return dataUrl;
  }

  function formUsesWorkCaseGallery(form) {
    const section = form?.querySelector("[data-work-cases-section]");
    return Boolean(section && !section.hidden);
  }

  async function collectListingImagesFromForm(form, userId, listingType) {
    const type = String(listingType || "skill").trim() || "skill";
    const isWorkCaseGallery = type === "business" && formUsesWorkCaseGallery(form);
    const mainInput =
      form.querySelector("[data-listing-main-image]") ||
      form.querySelector('input[name="mainImage"]') ||
      form.querySelector('input[name="thumbnail"]');
    const galleryInput =
      form.querySelector("[data-listing-gallery-images]") ||
      form.querySelector('input[name="images"]');

    let mainUrl = null;
    let mainFile = null;

    if (window.TasuPostMainUpload?.getStagedFile) {
      mainFile = window.TasuPostMainUpload.getStagedFile();
    } else {
      mainFile = mainInput?.files?.[0] || null;
    }

    if (mainFile) {
      mainUrl = await fileToStorableUrl(mainFile, userId, type);
    }

    const galleryUrls = [];
    let galleryFiles = [];

    if (window.TasuPostGalleryUpload?.getStagedFiles) {
      galleryFiles = window.TasuPostGalleryUpload.getStagedFiles();
    } else if (galleryInput?.files?.length) {
      galleryFiles = Array.from(galleryInput.files);
    }

    const filesToUpload = galleryFiles.slice(0, MAX_GALLERY);
    for (let i = 0; i < filesToUpload.length; i += 1) {
      const url = await fileToStorableUrl(filesToUpload[i], userId, type);
      if (!url) continue;
      if (url === mainUrl) continue;
      if (!galleryUrls.includes(url)) galleryUrls.push(url);
    }

    const workCaseImageUrls = galleryUrls.filter(Boolean);

    if (isWorkCaseGallery) {
      return {
        image_url: mainUrl,
        main_image_url: mainUrl,
        thumbnail_url: mainUrl,
        gallery_urls: workCaseImageUrls,
        images: workCaseImageUrls,
      };
    }

    if (!mainUrl && !workCaseImageUrls.length) {
      return {
        image_url: null,
        thumbnail_url: null,
        main_image_url: null,
        images: [],
        gallery_urls: [],
      };
    }

    const resolvedMain = mainUrl || workCaseImageUrls[0] || null;
    const subsOnly = workCaseImageUrls.filter((u) => u && u !== resolvedMain);

    return {
      image_url: resolvedMain,
      main_image_url: resolvedMain,
      thumbnail_url: resolvedMain,
      images: subsOnly.slice(),
      gallery_urls: subsOnly.slice(),
    };
  }

  async function attachWorkCasesToPayload(form, payload) {
    if (!form || !payload) return payload;
    const listingType = String(payload.listing_type || "business").trim() || "business";
    const upload = window.TasuPostWorkCaseUpload;
    if (!upload?.getCaseMeta) return payload;

    const rows = form.querySelectorAll("[data-work-case-row]");
    if (!rows.length) return payload;

    const resolved = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const meta = upload.getCaseMeta(row);
      if (!meta.included) continue;

      let image_url = meta.existingUrl || "";
      if (meta.file) {
        image_url = await fileToStorableUrl(meta.file, payload.user_id, listingType);
      }
      if (!image_url) continue;

      resolved.push({
        title: meta.title,
        image_url,
        image: image_url,
        category: meta.content,
        content: meta.content,
        area: meta.region,
        region: meta.region,
        period: meta.period,
        price: meta.cost,
        cost: meta.cost,
        description: meta.note,
        note: meta.note,
      });
    }

    if (!resolved.length) {
      return {
        ...payload,
        work_cases: [],
        form_data: {
          ...(payload.form_data || {}),
          work_cases: [],
        },
      };
    }

    const fd = { ...(payload.form_data || {}), work_cases: resolved };

    return {
      ...payload,
      work_cases: resolved,
      form_data: fd,
    };
  }

  async function attachShopStoreProductsToPayload(form, payload) {
    if (!form || !payload) return payload;
    const category = payload.business_category || "";
    const bt =
      payload.business_type ||
      window.TasuBusinessCategories?.getBusinessType?.({ business_category: category }) ||
      "";
    if (bt !== "shop_store" && category !== "shop_store") return payload;

    const collect = window.TasuPostShopProducts?.collectProductRows;
    const mapRow = window.TasuPostShopProducts?.mapRowToDbRecord;
    const upload = window.TasuPostShopProductUpload;
    if (!collect || !mapRow || !upload) return payload;

    const metas = collect(form);
    if (!metas.length) {
      return {
        ...payload,
        products: [],
        shop_store_products: [],
        form_data: { ...(payload.form_data || {}), products: [] },
      };
    }

    const listingType = String(payload.listing_type || "business").trim() || "business";
    const records = [];

    for (let i = 0; i < metas.length; i += 1) {
      const meta = metas[i];
      let imageUrl = meta.product_image_url || "";
      if (meta.file) {
        imageUrl = await fileToStorableUrl(meta.file, payload.user_id, listingType);
      }
      if (!imageUrl) continue;
      records.push(mapRow(meta, imageUrl, i));
    }

    const detailProducts = records
      .map((r) =>
        window.TasuShopStoreProductsDb?.mapDbRowToDetailProduct
          ? window.TasuShopStoreProductsDb.mapDbRowToDetailProduct(r)
          : window.TasuPostShopProducts?.mapToDetailProduct
            ? window.TasuPostShopProducts.mapToDetailProduct(r)
            : null
      )
      .filter(Boolean);

    return {
      ...payload,
      products: detailProducts,
      shop_store_products: records,
      form_data: {
        ...(payload.form_data || {}),
        products: detailProducts,
      },
    };
  }

  async function attachListingImagesToPayload(form, payload) {
    const listingType = String(payload?.listing_type || "").trim();
    if (!form || !listingType) {
      return payload;
    }

    const imageFields = await collectListingImagesFromForm(
      form,
      payload.user_id,
      listingType
    );
    const galleryUrls = (imageFields.gallery_urls || []).filter(Boolean);
    const galleryImages = (imageFields.images || galleryUrls).filter(Boolean);

    if (!imageFields.image_url && !galleryUrls.length && !galleryImages.length) {
      return payload;
    }

    const isProduct = listingType === "product";
    const isJob = listingType === "job";
    const isBusiness = listingType === "business";
    const mainUrl = imageFields.image_url || imageFields.main_image_url || null;
    const thumbUrl = imageFields.thumbnail_url || mainUrl;
    const syncedGallery = galleryUrls.length ? galleryUrls : galleryImages;

    const mergedFormData = {
      ...(payload.form_data || {}),
      image_url: mainUrl,
      thumbnail_url: thumbUrl,
      main_image_url: mainUrl,
      gallery_urls: syncedGallery,
      images: syncedGallery,
    };

    if (isProduct || isJob || isBusiness) {
      return {
        ...payload,
        listing_type: listingType,
        image_url: mainUrl,
        thumbnail_url: thumbUrl,
        main_image_url: mainUrl,
        gallery_urls: syncedGallery,
        images: syncedGallery,
        form_data: mergedFormData,
      };
    }

    return {
      ...payload,
      form_data: mergedFormData,
    };
  }

  async function attachSkillImagesToPayload(form, payload) {
    return attachListingImagesToPayload(form, payload);
  }

  window.TasuListingImages = {
    BUCKET,
    resolveListingImageSet,
    resolvePrimaryImageUrl,
    resolveGalleryUrls,
    collectAllImageUrls,
    extractImagesArray,
    collectImageFieldDebug,
    normalizeImageUrl,
    storagePublicUrl,
    normalizeImageEntry,
    placeholderUrl,
    coerceToArray,
    coerceImageUrlList,
    resolveUrlCandidate,
    collectListingImagesFromForm,
    collectSkillImagesFromForm: collectListingImagesFromForm,
    attachListingImagesToPayload,
    attachShopStoreProductsToPayload,
    attachWorkCasesToPayload,
    attachSkillImagesToPayload,
    fileToStorableUrl,
    isUsableImageUrl,
  };
})();
