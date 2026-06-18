/**
 * shop_store_products — 保存・取得（listing_id 版 / Supabase + localStorage）
 */
(function () {
  "use strict";

  const LOCAL_PRODUCTS_KEY = "shop_store_products";

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function isYes(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "yes" || raw === "true" || raw === "1";
  }

  function conditionFlags(condition) {
    const c = String(condition || "").trim();
    return {
      is_new: c === "新品",
      is_used: Boolean(c) && c !== "新品",
    };
  }

  function firstUrlFromArray(val) {
    if (!Array.isArray(val) || !val.length) return "";
    const first = val[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") {
      return String(first.url || first.src || first.image || first.image_url || "").trim();
    }
    return "";
  }

  /** フォーム行 → DB insert 行（listing_id は insert 時に付与） */
  function mapMetaToDbRecord(meta, imageUrl, displayOrder) {
    const cond = String(meta.condition_state || "").trim();
    const flags = conditionFlags(cond);
    const urls = imageUrl ? [imageUrl] : [];

    return {
      product_name: meta.title,
      product_category: meta.product_category || null,
      product_description: meta.description || null,
      product_image_url: imageUrl || null,
      product_image_urls: urls,
      price: meta.price || null,
      tax_included: meta.tax_type !== "exclusive",
      product_condition: cond || null,
      stock_quantity: meta.stock_quantity || null,
      stock_status: meta.stock_status || null,
      is_new: flags.is_new,
      is_used: flags.is_used,
      same_day_shipping: isYes(meta.fast_shipping),
      ai_consult_enabled: meta.show_ai_consult !== "no",
      contact_enabled: meta.show_inquiry !== "no",
      delivery_method: meta.delivery_method || null,
      shipping_estimate: meta.shipping_estimate || null,
      shipping_fee: meta.shipping_fee || null,
      handoff_method: meta.handoff_method || null,
      return_policy: meta.return_policy || null,
      display_order: displayOrder,
      is_active: true,
    };
  }

  /** DB行 → 詳細ページ用（既存 pickStoreProducts / カードHTML互換） */
  function mapDbRowToDetailProduct(dbRow) {
    if (!dbRow) return null;
    const taxIncluded =
      dbRow.tax_included === true ||
      dbRow.tax_included === "true" ||
      dbRow.tax_included === 1 ||
      dbRow.tax_included === "1";
    const tax_type = taxIncluded ? "inclusive" : "exclusive";

    const condition = String(dbRow.product_condition || "").trim();
    let tag = "";
    if (dbRow.is_new === true || dbRow.is_new === "true") tag = "新品";
    else if (dbRow.is_used === true || dbRow.is_used === "true") tag = "中古";
    else if (/新品/.test(condition)) tag = "新品";
    else if (condition) tag = "中古";

    const stockLabel =
      [dbRow.stock_status, dbRow.stock_quantity].filter(Boolean).join(" · ") ||
      "在庫あり";

    const imageUrl = String(dbRow.product_image_url || firstUrlFromArray(dbRow.product_image_urls) || "").trim();
    const showAi =
      dbRow.ai_consult_enabled === true ||
      dbRow.ai_consult_enabled === "true" ||
      dbRow.ai_consult_enabled === 1;
    const showContact =
      dbRow.contact_enabled === true ||
      dbRow.contact_enabled === "true" ||
      dbRow.contact_enabled === 1;

    return {
      id: String(dbRow.id || dbRow.product_id || "").trim(),
      title: dbRow.product_name || "",
      category: dbRow.product_category || "",
      price: dbRow.price || "",
      tax_type,
      condition: condition ? `状態：${condition}` : "",
      condition_state: condition,
      stock: stockLabel,
      stock_status: dbRow.stock_status || "",
      stock_quantity: dbRow.stock_quantity || "",
      fast_ship:
        dbRow.same_day_shipping === true ||
        dbRow.same_day_shipping === "true" ||
        isYes(dbRow.same_day_shipping)
          ? "yes"
          : "no",
      image_url: imageUrl,
      product_image_url: imageUrl,
      description: dbRow.product_description || "",
      show_ai_consult: showAi ? "yes" : "no",
      show_inquiry: showContact ? "yes" : "no",
      delivery_method: dbRow.delivery_method || "",
      shipping_estimate: dbRow.shipping_estimate || "",
      shipping_fee: dbRow.shipping_fee || "",
      handoff_method: dbRow.handoff_method || "",
      return_policy: dbRow.return_policy || "",
      tag,
      display_order: dbRow.display_order,
      is_active: dbRow.is_active !== false,
    };
  }

  function mapRow(row) {
    return mapDbRowToDetailProduct(row);
  }

  function sortByDisplayOrder(rows) {
    return [...rows].sort(
      (a, b) => Number(a?.display_order ?? 0) - Number(b?.display_order ?? 0)
    );
  }

  async function fetchShopStoreProducts(listingId) {
    const key = String(listingId || "").trim();
    if (!key) return [];

    const sb = getClient();
    if (sb) {
      const base = () => sb.from("shop_store_products").select("*").eq("listing_id", key);

      let { data, error } = await base()
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.warn("[ShopStoreProducts] fetch (active+order) failed:", error);
        ({ data, error } = await base().order("display_order", { ascending: true }));
      }
      if (error) {
        console.warn("[ShopStoreProducts] fetch (order only) failed:", error);
        ({ data, error } = await base());
      }
      if (error) {
        console.warn("[ShopStoreProducts] fetch failed:", error);
        return [];
      }

      return sortByDisplayOrder(data || [])
        .map(mapRow)
        .filter((p) => p?.title);
    }

    try {
      const raw = localStorage.getItem(LOCAL_PRODUCTS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const rows = all[key] || [];
      return rows
        .map((r) => mapDbRowToDetailProduct(r))
        .filter((p) => p?.title);
    } catch {
      return [];
    }
  }

  function saveLocalProducts(listingId, records) {
    try {
      const raw = localStorage.getItem(LOCAL_PRODUCTS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[String(listingId)] = records;
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(all));
    } catch (err) {
      console.warn("[ShopStoreProducts] local save failed:", err);
    }
  }

  async function insertShopStoreProducts(listingId, records) {
    const key = String(listingId || "").trim();
    if (!key || !Array.isArray(records) || !records.length) {
      return { ok: true, count: 0 };
    }

    const sb = getClient();
    if (sb) {
      const rows = records.map((r, i) => ({
        listing_id: key,
        product_name: r.product_name,
        product_category: r.product_category ?? null,
        product_description: r.product_description ?? null,
        product_image_url: r.product_image_url ?? null,
        product_image_urls: Array.isArray(r.product_image_urls)
          ? r.product_image_urls
          : r.product_image_url
            ? [r.product_image_url]
            : [],
        price: r.price ?? null,
        tax_included: r.tax_included !== false,
        product_condition: r.product_condition ?? null,
        stock_quantity: r.stock_quantity ?? null,
        stock_status: r.stock_status ?? null,
        is_new: Boolean(r.is_new),
        is_used: Boolean(r.is_used),
        same_day_shipping: Boolean(r.same_day_shipping),
        ai_consult_enabled: r.ai_consult_enabled !== false,
        contact_enabled: r.contact_enabled !== false,
        display_order: r.display_order ?? i,
        is_active: r.is_active !== false,
      }));

      const { error } = await sb.from("shop_store_products").insert(rows);
      if (error) {
        console.warn("[ShopStoreProducts] insert failed:", error);
        return { ok: false, error: error.message || String(error) };
      }
      return { ok: true, count: rows.length };
    }

    const localRows = records.map((r, i) => ({
      ...r,
      listing_id: key,
      display_order: r.display_order ?? i,
    }));
    saveLocalProducts(key, localRows);
    return { ok: true, count: localRows.length, via: "local" };
  }

  async function attachProductsToListing(listing) {
    if (!listing?.id) return listing;
    const bt =
      window.TasuBusinessCategories?.getBusinessType?.(listing) ||
      listing.business_type;
    if (bt !== "shop_store") return listing;

    const fromDb = await fetchShopStoreProducts(listing.id);
    if (fromDb.length) {
      listing.products = fromDb;
      return listing;
    }

    const fd =
      listing.form_data && typeof listing.form_data === "object"
        ? listing.form_data
        : {};
    if (Array.isArray(listing.products) && listing.products.length) return listing;
    if (Array.isArray(fd.products) && fd.products.length) {
      listing.products = fd.products;
    }
    return listing;
  }

  window.TasuShopStoreProductsDb = {
    fetchShopStoreProducts,
    insertShopStoreProducts,
    attachProductsToListing,
    mapMetaToDbRecord,
    mapDbRowToDetailProduct,
  };
})();
