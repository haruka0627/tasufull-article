/**
 * Builder — 条件検索 UI → SearchFilter adapter（P1 · 最小 DOM 連携）
 */
(function (global) {
  "use strict";

  const FW_TRADE_LABELS = Object.freeze({
    electric: "電気",
    equipment: "設備",
    wallpaper: "クロス",
    carpenter: "大工",
    painting: "塗装",
    roof: "屋根",
    cleaning: "クリーニング",
    repair: "補修",
  });

  const PARTNER_TRADE_CODES = Object.freeze({
    carpenter: "carpenter",
    scaffold: "scaffold",
    interior: "interior",
    electric: "electric",
    plumbing: "plumbing",
  });

  const PARTNER_AREA_LABELS = Object.freeze({
    tokyo: "東京",
    kanagawa: "神奈川",
    chiba: "千葉",
    saitama: "埼玉",
  });

  const PARTNER_AVAIL_LABELS = Object.freeze({
    available: "空きあり",
    limited: "一部可",
    busy: "満枠",
  });

  const CS = () => global.TasuBuilderConditionalSearch;

  function normalizeFilter(raw) {
    const cs = CS();
    return cs?.normalizeSearchFilter ? cs.normalizeSearchFilter(raw) : raw;
  }

  /**
   * find-workers.html 検索フォーム
   * @param {HTMLFormElement} form
   */
  function filterFromFindWorkersForm(form) {
    if (!form) return normalizeFilter({ target: "worker", sort: "newest" });

    const tradeKey = form.querySelector("[data-builder-fw-trade]")?.value || "";
    const areaText = form.querySelector("[data-builder-fw-area]")?.value?.trim() || "";
    const license = form.querySelector("[data-builder-fw-license]")?.value?.trim() || "";
    const support = form.querySelector("[data-builder-fw-support]")?.checked;
    const travel = form.querySelector("[data-builder-fw-travel]")?.checked;
    const night = form.querySelector("[data-builder-fw-night]")?.checked;

    /** @type {Record<string, unknown>} */
    const raw = { target: "worker", sort: "newest" };

    if (tradeKey && FW_TRADE_LABELS[tradeKey]) {
      raw.trades = [FW_TRADE_LABELS[tradeKey]];
      raw.categories = [FW_TRADE_LABELS[tradeKey]];
    }
    if (areaText) raw.area = areaText;
    if (license) raw.qualifications = [license];

    const availParts = [];
    if (support) availParts.push("応援");
    if (travel) availParts.push("出張");
    if (night) availParts.push("夜間");
    if (availParts.length) raw.availability = availParts.join(" ");

    return normalizeFilter(raw);
  }

  /**
   * partners.html 検索フォーム
   * @param {{ q?: string, trade?: string, area?: string, availability?: string }} query
   */
  function filterFromPartnerQuery(query) {
    const q = String(query?.q || "").trim();
    const trade = String(query?.trade || "").trim();
    const area = String(query?.area || "").trim();
    const availability = String(query?.availability || "").trim();

    /** @type {Record<string, unknown>} */
    const raw = { target: "partner", sort: "newest" };
    if (q) raw.keyword = q;
    if (trade && PARTNER_TRADE_CODES[trade]) raw.trades = [trade];
    if (area && PARTNER_AREA_LABELS[area]) {
      raw.area = { prefecture: PARTNER_AREA_LABELS[area] };
    }
    if (availability && PARTNER_AVAIL_LABELS[availability]) {
      raw.availability = PARTNER_AVAIL_LABELS[availability];
    }
    return normalizeFilter(raw);
  }

  /**
   * board-projects.html タイプタブ
   * @param {string} tabKey all | project | worker | job
   */
  function filterFromBoardTab(tabKey) {
    const key = String(tabKey || "all").trim();
    /** @type {Record<string, unknown>} */
    const raw = { target: "job", sort: "newest" };
    if (key && key !== "all") raw.categories = [key];
    return normalizeFilter(raw);
  }

  /**
   * 掲示板 project row → job search row
   * @param {object} project
   * @param {object} [spec]
   */
  function mapBoardProjectRow(project, spec) {
    const boardType =
      global.TasuBuilderBoardFeed?.resolveBoardItemType?.(project) ||
      project?.board_type ||
      project?.post_type ||
      "project";
    const budgetRaw = spec?.budget?.amount ?? spec?.budget?.max ?? spec?.budget;
    return {
      id: project?.project_id || project?.id,
      project_id: project?.project_id || project?.id,
      title: project?.title || "",
      keyword: project?.title || "",
      categories: [boardType],
      trades: spec?.trade_tags || [],
      area_prefecture: spec?.area?.label || spec?.area || "",
      area_city: "",
      budget_yen: Number(budgetRaw) || 0,
      rate_yen: Number(budgetRaw) || 0,
      rating: Number(project?.rating) || 0,
      availability: project?.status || "",
      availability_rank: project?.status === "open" ? 0 : 1,
      qualifications: [],
      ng_flag: false,
      created_at: project?.created_at || "",
      start_date: spec?.period?.start || project?.created_at || "",
      board_type: boardType,
      _source: project,
    };
  }

  /**
   * SearchAssist requirements → SearchFilter
   * @param {"worker"|"partner"} kind
   * @param {Record<string, string>} requirements
   */
  function filterFromRequirements(kind, requirements) {
    const cs = CS();
    if (cs?.searchAssistParsedToFilter) {
      return cs.searchAssistParsedToFilter(kind, requirements || {});
    }
    return normalizeFilter({ target: kind === "partner" ? "partner" : "worker", sort: "newest" });
  }

  global.TasuBuilderSearchUiAdapter = {
    FW_TRADE_LABELS,
    PARTNER_AREA_LABELS,
    filterFromFindWorkersForm,
    filterFromPartnerQuery,
    filterFromBoardTab,
    mapBoardProjectRow,
    filterFromRequirements,
  };
})(typeof window !== "undefined" ? window : globalThis);
