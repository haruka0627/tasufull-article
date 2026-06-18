/**
 * TASFUL AI — 掲載下書き作成（post.html）
 * ローカル生成 → フォーム反映（submit は行わない）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_agent_listing_draft";
  const LISTINGS_KEY = "tasful_listings";

  const CATEGORY_MAP = {
    "建築・修理": {
      scope: "business",
      listingType: "business-service",
      businessMode: "field_service",
      bizCategory: "construction",
      skillCategory: "",
    },
    清掃: {
      scope: "business",
      listingType: "business-service",
      businessMode: "field_service",
      bizCategory: "cleaning",
      skillCategory: "",
    },
    IT: {
      scope: "business",
      listingType: "business-service",
      businessMode: "field_service",
      bizCategory: "it_web",
      skillCategory: "",
    },
    スキル: {
      scope: "general",
      listingType: "skill",
      businessMode: "",
      bizCategory: "",
      skillCategory: "その他",
    },
    "店舗・販売": {
      scope: "business",
      listingType: "shop-store",
      businessMode: "shop_store",
      bizCategory: "",
      shopCategory: "restaurant",
      skillCategory: "",
    },
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function parseImages(raw) {
    if (Array.isArray(raw)) {
      return raw.map((u) => String(u).trim()).filter(Boolean).slice(0, 6);
    }
    return String(raw || "")
      .split(/\r?\n|,/)
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  function getEditIdFromUrl() {
    const params = new URLSearchParams(global.location.search);
    return String(params.get("edit") || params.get("id") || "").trim();
  }

  function readListings() {
    try {
      const raw = global.localStorage.getItem(LISTINGS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeListings(list) {
    try {
      global.localStorage.setItem(LISTINGS_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[TasuPostDraftAgent] listings save failed:", err);
    }
  }

  function findListingById(id) {
    const key = String(id || "").trim();
    if (!key) return null;
    return readListings().find((item) => String(item.id) === key) || null;
  }

  function listingToDraft(listing) {
    if (!listing || typeof listing !== "object") return null;
    if (listing.draft && typeof listing.draft === "object") {
      return {
        ...listing.draft,
        listingId: listing.id,
        title: listing.draft.title ?? listing.title,
        category: listing.draft.category ?? listing.category ?? "",
        price: listing.draft.price ?? listing.price ?? 0,
        description: listing.draft.description ?? listing.description ?? "",
        images: parseImages(listing.draft.images ?? listing.images ?? listing.imageUrl),
        tags: parseTags(listing.draft.tags ?? listing.tags ?? ""),
      };
    }
    return {
      listingId: listing.id,
      title: listing.title || "",
      category: listing.agentCategory || listing.category || "",
      price: Number(listing.price) || 0,
      description: listing.description || "",
      images: parseImages(listing.images ?? listing.imageUrl),
      tags: parseTags(listing.tags ?? ""),
    };
  }

  function resolveEditDraft(editId) {
    const id = String(editId || "").trim();
    if (!id) return { listing: null, draft: null };

    let agentDraft = null;
    try {
      agentDraft = loadDraftFromStorage();
    } catch {
      agentDraft = null;
    }

    const draftListingId = String(
      agentDraft?.listingId || agentDraft?.editId || agentDraft?.id || ""
    ).trim();

    if (agentDraft && (!draftListingId || draftListingId === id)) {
      return {
        listing: findListingById(id),
        draft: {
          ...agentDraft,
          listingId: id,
          images: parseImages(agentDraft.images),
          tags: parseTags(agentDraft.tags),
        },
        source: "agent-draft",
      };
    }

    const listing = findListingById(id);
    if (!listing) return { listing: null, draft: null, source: null };
    return { listing, draft: listingToDraft(listing), source: "listing" };
  }

  function collectDraftFromForm(form) {
    if (!form) return null;
    return {
      title: form.querySelector("#title")?.value?.trim() ?? "",
      category: form.querySelector("#category")?.value?.trim() ?? "",
      price: Number(form.querySelector("#price")?.value) || 0,
      description: form.querySelector("#description")?.value ?? "",
      images: parseImages(form.querySelector("#images")?.value ?? ""),
      tags: parseTags(form.querySelector("#tags")?.value ?? ""),
    };
  }

  function upsertListingFromForm(form, options = {}) {
    if (global.TasuListingLocalStore?.upsertFromForm) {
      return global.TasuListingLocalStore.upsertFromForm(form, options);
    }
    if (!form) return { ok: false, error: "form が未設定です" };

    const editId = String(
      options.editId || form.dataset.editListingId || getEditIdFromUrl() || ""
    ).trim();
    const draft = collectDraftFromForm(form);
    const images = draft.images || [];
    const imageUrl = images[0] || "";
    const list = readListings();
    const now = new Date().toISOString();

    let record;
    let mode;

    if (editId) {
      const idx = list.findIndex((item) => String(item.id) === editId);
      const prev = idx >= 0 ? list[idx] : null;
      record = {
        ...(prev || {}),
        id: editId,
        title: draft.title || prev?.title || "（タイトル未設定）",
        listingType: prev?.listingType || prev?.listing_type || "skill",
        scope: prev?.scope || "general",
        category: draft.category || prev?.category || "—",
        price: draft.price,
        status: prev?.status || "active",
        imageUrl: imageUrl || prev?.imageUrl || prev?.image_url || "",
        postedAt: prev?.postedAt || prev?.posted_at || now,
        views: prev?.views ?? 0,
        favorites: prev?.favorites ?? 0,
        inquiries: prev?.inquiries ?? 0,
        description: draft.description,
        tags: draft.tags,
        draft,
        updatedAt: now,
      };
      if (idx >= 0) list[idx] = record;
      else list.unshift(record);
      mode = idx >= 0 ? "update" : "create-with-id";
    } else {
      const newId = `lm-${Date.now()}`;
      record = {
        id: newId,
        title: draft.title || "（タイトル未設定）",
        listingType: "skill",
        scope: "general",
        category: draft.category || "—",
        price: draft.price,
        status: "active",
        imageUrl,
        postedAt: now,
        views: 0,
        favorites: 0,
        inquiries: 0,
        description: draft.description,
        tags: draft.tags,
        draft,
        updatedAt: now,
      };
      list.unshift(record);
      form.dataset.editListingId = newId;
      mode = "create";
    }

    writeListings(list);
    saveDraftToStorage({ ...draft, listingId: record.id }, form);

    const result = { ok: true, mode, id: record.id, record };
    console.log("[TasuPostDraftAgent] listing save result", result);
    return result;
  }

  function setEditModeUi(editId) {
    document.body.dataset.postEditMode = "true";
    const pageTitle = document.querySelector(".post-header__title");
    if (pageTitle) pageTitle.textContent = "掲載を編集";

    const back = document.querySelector(".post-header__back");
    if (back) {
      back.textContent = "← 掲載管理へ戻る";
      back.href = "listing-management.html";
    }

    const banner = document.querySelector("[data-post-edit-banner]");
    if (banner) {
      banner.hidden = false;
      banner.textContent = `編集モード（ID: ${editId}）— 保存後は掲載管理に戻ります。`;
    }

    const openConfirmBtn = document.querySelector("[data-open-confirm]");
    if (openConfirmBtn && !openConfirmBtn.dataset.editLabelApplied) {
      openConfirmBtn.dataset.editLabelApplied = "1";
      openConfirmBtn.textContent = "変更内容を確認";
    }
  }

  function initEditMode(form) {
    const editId = getEditIdFromUrl();
    if (!editId || !form) return null;

    form.dataset.editListingId = editId;
    setEditModeUi(editId);

    const resolved = resolveEditDraft(editId);
    if (!resolved.draft) {
      console.warn("[TasuPostDraftAgent] edit listing not found:", editId);
      showStatus(
        document.querySelector("[data-agent-panel]"),
        "掲載データが見つかりませんでした。掲載管理から再度お試しください。",
        "error"
      );
      return { editId, loaded: false };
    }

    applyDraftToForm(form, resolved.draft, { skipStorage: true });
    showStatus(
      document.querySelector("[data-agent-panel]"),
      resolved.source === "agent-draft"
        ? "AI 下書きデータを優先してフォームに復元しました。"
        : "掲載データをフォームに復元しました。",
      "success"
    );

    console.log("[TasuPostDraftAgent] edit mode loaded", {
      editId,
      source: resolved.source,
      draft: resolved.draft,
    });

    return { editId, loaded: true, ...resolved };
  }

  function readBrief(panel) {
    const get = (name) => panel.querySelector(`[data-agent-brief="${name}"]`)?.value ?? "";
    return {
      title: get("title").trim(),
      category: get("category").trim(),
      price: get("price").trim(),
      description: get("description").trim(),
      images: get("images").trim(),
      options: get("options").trim(),
      tags: get("tags").trim(),
    };
  }

  /**
   * ローカル下書き生成（将来: 外部 AI API に差し替え）
   */
  function generateDraftFromBrief(brief) {
    const category = brief.category || "建築・修理";
    const title =
      brief.title ||
      (category === "清掃"
        ? "定期清掃・ハウスクリーニング"
        : category === "IT"
          ? "Webサイト制作・保守パック"
          : category === "店舗・販売"
            ? "地域密着カフェ＆雑貨ショップ"
          : category === "スキル"
            ? "スキル出品サービス"
            : "外壁塗装パッケージ");

    const price = Number(String(brief.price || "").replace(/[^\d]/g, "")) || 120000;

    const description =
      brief.description ||
      [
        `${title}のご案内です。`,
        category === "清掃"
          ? "キッチン・浴室・床ワックスまで対応可能。定期契約もご相談ください。"
          : category === "IT"
            ? "要件定義からデザイン・実装・公開後保守までワンストップで支援します。"
            : category === "店舗・販売"
              ? "ランチとスイーツが人気のカフェ。テイクアウト・イートイン対応。地域の方に親しまれている店舗です。"
            : "現地調査・見積・施工・アフターサポートまで一括対応。",
        brief.options ? `オプション: ${brief.options}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

    const defaultImages = [
      "https://placehold.co/800x600/e8eef5/1e3a5f?text=Main",
      "https://placehold.co/800x600/dbeafe/1e3a5f?text=Sub+1",
    ];

    const images = parseImages(brief.images);
    const tags = parseTags(brief.tags);
    const defaultTags =
      category === "清掃"
        ? ["清掃", "ハウスクリーニング", "定期"]
        : category === "IT"
          ? ["Web", "制作", "保守"]
          : category === "店舗・販売"
            ? ["カフェ", "ランチ", "テイクアウト"]
          : category === "スキル"
            ? ["スキル", "出品"]
            : ["外壁", "塗装", "防水"];

    return {
      title,
      category,
      price,
      description,
      images: images.length ? images : defaultImages,
      tags: tags.length ? tags : defaultTags,
      options: brief.options || "",
      generatedAt: new Date().toISOString(),
    };
  }

  function saveDraftToStorage(draft, form) {
    try {
      const editId =
        form?.dataset?.editListingId ||
        draft?.listingId ||
        getEditIdFromUrl();
      const payload = editId ? { ...draft, listingId: editId } : draft;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("[TasuPostDraftAgent] save failed:", err);
    }
  }

  function loadDraftFromStorage() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function renderImageUrlPreview(form, urls) {
    const preview = form.querySelector("[data-agent-images-preview]");
    if (!preview) return;
    preview.innerHTML = "";
    const list = parseImages(urls);
    if (!list.length) {
      preview.hidden = true;
      return;
    }
    preview.hidden = false;
    list.forEach((url, i) => {
      const li = document.createElement("li");
      li.className = "post-agent-images-preview__item";
      const img = document.createElement("img");
      img.src = url;
      img.alt = i === 0 ? "メイン画像プレビュー" : `サブ画像 ${i}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        img.src = "https://placehold.co/120x90/f1f5f9/64748b?text=NG";
      };
      li.appendChild(img);
      preview.appendChild(li);
    });

    if (global.TasuPostMainUpload?.setImageUrl && list[0]) {
      global.TasuPostMainUpload.setImageUrl(list[0]);
    }
    if (global.TasuPostGalleryUpload?.setImageUrls && list.length > 1) {
      global.TasuPostGalleryUpload.setImageUrls(list.slice(1));
    }
  }

  function applyCategoryToForm(form, categoryLabel, extra = {}) {
    const map = CATEGORY_MAP[categoryLabel] || CATEGORY_MAP["建築・修理"];

    if (map.scope === "business") {
      const bizBlock = form.querySelector('[data-post-scope-block="business"]');
      bizBlock?.querySelector("button, input")?.focus?.();

      const scopeInput = form.querySelector("[data-post-scope]");
      if (scopeInput) scopeInput.value = "business";

      const typeBtn = form.querySelector(
        map.listingType === "business-service"
          ? '[data-post-type="business-service"]'
          : '[data-post-type="shop-store"]'
      );
      typeBtn?.click();

      window.setTimeout(() => {
        if (map.businessMode) {
          const modeRadio = form.querySelector(
            `[data-business-mode-pick][value="${map.businessMode}"]`
          );
          if (modeRadio && !modeRadio.checked) {
            modeRadio.checked = true;
            modeRadio.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

        if (map.listingType === "shop-store") {
          const shopCat = pickStr(extra.shopCategory, map.shopCategory) || "restaurant";
          const shopRadio = form.querySelector(
            `[data-shop-store-category-pick][value="${shopCat}"]`
          );
          if (shopRadio && !shopRadio.checked) {
            shopRadio.checked = true;
            shopRadio.dispatchEvent(new Event("change", { bubbles: true }));
          }
          return;
        }

        const catRadio = form.querySelector(
          `[data-business-category-pick][value="${map.bizCategory}"]`
        );
        if (catRadio && !catRadio.checked) {
          catRadio.checked = true;
          catRadio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, 80);
    } else {
      const scopeInput = form.querySelector("[data-post-scope]");
      if (scopeInput) scopeInput.value = "general";
      const generalRadio = form.querySelector('[data-general-category][value="skill"]');
      if (generalRadio && !generalRadio.checked) {
        generalRadio.checked = true;
        generalRadio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (map.skillCategory) {
        setInputValue("skillCategory", map.skillCategory);
        const skillSel = document.getElementById("skillCategory");
        if (skillSel) {
          skillSel.value = map.skillCategory;
          skillSel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  }

  function applyDraftToForm(form, draft, options = {}) {
    if (!form || !draft) return null;

    setInputValue("title", draft.title);
    setInputValue("category", draft.category);
    setInputValue("price", draft.price);
    setInputValue("description", draft.description);
    setInputValue(
      "tags",
      Array.isArray(draft.tags) ? draft.tags.join(", ") : draft.tags || ""
    );
    setInputValue(
      "images",
      Array.isArray(draft.images) ? draft.images.join("\n") : draft.images || ""
    );

    if (draft.category) {
      applyCategoryToForm(form, draft.category, {
        shopCategory: draft.shopCategory,
      });
    }

    if (draft.price) {
      setInputValue("skillBasePrice", draft.price);
      setInputValue("productPrice", draft.price);
    }

    if (draft.title) {
      setInputValue("serviceName", draft.title);
    }

    renderImageUrlPreview(form, draft.images);

    if (!options.skipStorage) {
      saveDraftToStorage(draft, form);
    }
    return draft;
  }

  function showStatus(panel, message, tone) {
    const el = panel.querySelector("[data-agent-status]");
    if (!el) return;
    el.hidden = false;
    el.dataset.tone = tone || "info";
    el.textContent = message;
  }

  function init(form) {
    const panel = document.querySelector("[data-agent-panel]");
    if (!panel || !form) return;

    const generateBtn = panel.querySelector("[data-agent-generate]");
    const restoreBtn = panel.querySelector("[data-agent-restore]");

    generateBtn?.addEventListener("click", () => {
      const brief = readBrief(panel);
      const draft = generateDraftFromBrief(brief);
      form.dataset.aiAgentSource = "1";
      applyDraftToForm(form, draft);
      showStatus(
        panel,
        "下書きをフォームに反映しました。内容を確認してから投稿してください。",
        "success"
      );
    });

    restoreBtn?.addEventListener("click", () => {
      const editId = form.dataset.editListingId || getEditIdFromUrl();
      const resolved = editId ? resolveEditDraft(editId) : null;
      const saved = resolved?.draft || loadDraftFromStorage();
      if (!saved) {
        showStatus(panel, "保存済みの下書きがありません。", "error");
        return;
      }
      applyDraftToForm(form, saved);
      showStatus(panel, "保存済み下書きを復元しました。", "success");
    });

    const editId = getEditIdFromUrl();
    if (editId) return;

    const saved = loadDraftFromStorage();
    if (saved?.title) {
      showStatus(panel, "前回の AI 下書きを localStorage から復元できます。", "info");
    }
  }

  global.TasuPostDraftAgent = {
    STORAGE_KEY,
    LISTINGS_KEY,
    CATEGORY_MAP,
    getEditIdFromUrl,
    readListings,
    writeListings,
    findListingById,
    listingToDraft,
    resolveEditDraft,
    collectDraftFromForm,
    upsertListingFromForm,
    initEditMode,
    generateDraftFromBrief,
    applyDraftToForm,
    loadDraftFromStorage,
    saveDraftToStorage,
    init,
  };
})(typeof window !== "undefined" ? window : globalThis);
