/**
 * Platform — 検索ハブ（人気 · サジェスト · 位置 · AI入口）
 */
(function (global) {
  "use strict";

  let searchContext = { area: "", budgetMax: NaN, nearby: false };
  let listingPool = [];

  function getSearchContext() {
    return { ...searchContext };
  }

  function setSearchContext(partial) {
    searchContext = { ...searchContext, ...(partial || {}) };
    return searchContext;
  }

  function setListingPool(listings) {
    listingPool = Array.isArray(listings) ? listings : [];
  }

  function findListingById(id) {
    const key = String(id || "").trim();
    return listingPool.find((l) => String(l.id || l.listing_id) === key) || null;
  }

  function getPopularWords() {
    return global.TasuSearch?.POPULAR_SEARCH_WORDS || [];
  }

  function getSuggestions(query, limit) {
    return global.TasuSearch?.getSearchSuggestions?.(query, listingPool, limit || 8) || [];
  }

  function runSearchAssist(text) {
    const filtered = filterListings(text);
    return global.TasuPlatformSearchAssist?.run?.(text, { listings: filtered, context: searchContext });
  }

  function filterListings(text) {
    const conditions = global.TasuPlatformSearchAssist?.extractConditions?.(text) || {};
    const ctx = {
      area: conditions.area || searchContext.area,
      budgetMax: parseBudget(conditions.budget) || searchContext.budgetMax,
    };
    let rows = listingPool.slice();
    if (ctx.area) {
      rows = rows.filter((l) => String(l.area || l.service_area || "").includes(ctx.area));
    }
    if (global.TasuPlatformLocationSearch && (searchContext.lat || searchContext.pref)) {
      rows = global.TasuPlatformLocationSearch.filterAndSortByDistance(rows, {
        lat: searchContext.lat,
        lng: searchContext.lng,
        pref: searchContext.pref || ctx.area,
        city: searchContext.city,
        radiusKm: searchContext.radiusKm || 50,
      }).map((r) => ({ ...r.listing, _distanceKm: r.distanceKm, nearby: r.nearby }));
    }
    return global.TasuPlatformAiRecommend?.rankListings?.(rows, ctx).map((r) => r.listing) || rows;
  }

  function parseBudget(raw) {
    const m = String(raw || "").match(/(\d+)\s*万/);
    if (m) return Number(m[1]) * 10000;
    const n = Number(String(raw || "").replace(/[,，]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function mount(root) {
    const el = root || global.document.querySelector("[data-platform-search-hub]");
    if (!el || el.dataset.mounted) return;
    el.dataset.mounted = "1";

    const input = el.querySelector("[data-platform-search-input]");
    const suggestBox = el.querySelector("[data-platform-search-suggest]");
    const popularBox = el.querySelector("[data-platform-search-popular]");
    const resultBox = el.querySelector("[data-platform-search-result]");
    const prefSelect = el.querySelector("[data-platform-search-pref]");
    const radiusInput = el.querySelector("[data-platform-search-radius]");
    const geoBtn = el.querySelector("[data-platform-search-geo]");
    const aiSearchBtn = el.querySelector("[data-platform-search-ai]");
    const compareBtn = el.querySelector("[data-platform-search-compare]");

    if (popularBox) {
      popularBox.innerHTML = getPopularWords()
        .map(
          (w) =>
            `<button type="button" class="platform-search-hub__chip" data-platform-popular="${w.replace(/"/g, "&quot;")}">${w}</button>`
        )
        .join("");
    }

    function renderSuggest(q) {
      if (!suggestBox) return;
      const items = getSuggestions(q, 8);
      if (!items.length) {
        suggestBox.hidden = true;
        return;
      }
      suggestBox.hidden = false;
      suggestBox.innerHTML = items
        .map(
          (s) =>
            `<button type="button" class="platform-search-hub__suggest-item" data-platform-suggest="${String(s).replace(/"/g, "&quot;")}">${s}</button>`
        )
        .join("");
    }

    function applyQuery(q) {
      if (input) input.value = q;
      const r = runSearchAssist(q);
      if (resultBox && r?.body) {
        resultBox.hidden = false;
        resultBox.textContent = r.body;
      }
      renderSuggest(q);
    }

    input?.addEventListener("input", () => renderSuggest(input.value));
    input?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        applyQuery(input.value);
      }
    });

    el.addEventListener("click", (ev) => {
      const pop = ev.target?.closest?.("[data-platform-popular]");
      if (pop) {
        applyQuery(pop.getAttribute("data-platform-popular") || "");
        return;
      }
      const sug = ev.target?.closest?.("[data-platform-suggest]");
      if (sug) {
        applyQuery(sug.getAttribute("data-platform-suggest") || "");
        return;
      }
    });

    prefSelect?.addEventListener("change", () => {
      setSearchContext({ pref: prefSelect.value, area: prefSelect.value });
    });
    radiusInput?.addEventListener("change", () => {
      setSearchContext({ radiusKm: Number(radiusInput.value) || 50 });
    });

    geoBtn?.addEventListener("click", async () => {
      const pos = await global.TasuPlatformLocationSearch?.getCurrentPosition?.();
      if (pos?.ok) {
        setSearchContext({ lat: pos.lat, lng: pos.lng, nearby: true });
        geoBtn.textContent = "現在地取得済";
      } else {
        geoBtn.textContent = "位置情報を許可してください";
      }
    });

    aiSearchBtn?.addEventListener("click", () => {
      const q = input?.value || "";
      const url =
        global.TasuAiWorkspaceLinks?.buildSearchAssistUrl?.(q, { source: "platform" }) ||
        "ai-workspace.html";
      global.location.href = url;
    });

    compareBtn?.addEventListener("click", () => {
      const top = filterListings(input?.value || "").slice(0, 3);
      if (top.length < 2) {
        if (resultBox) {
          resultBox.hidden = false;
          resultBox.textContent = "比較には2件以上の候補が必要です。条件を広げてください。";
        }
        return;
      }
      top.forEach((l) => global.TasuPlatformCompareAssist?.addToBasket?.(l));
      const ids = top.map((l) => String(l.id || l.listing_id || "").trim()).filter(Boolean);
      const url =
        global.TasuAiWorkspaceLinks?.buildCompareAssistUrl?.(ids, input?.value || "", {
          source: "platform",
        }) || "ai-workspace.html?mode=cross-matching";
      global.location.href = url;
    });
  }

  global.TasuPlatformSearchHub = {
    mount,
    getSearchContext,
    setSearchContext,
    setListingPool,
    findListingById,
    getPopularWords,
    getSuggestions,
    runSearchAssist,
    filterListings,
  };
})(typeof window !== "undefined" ? window : globalThis);
