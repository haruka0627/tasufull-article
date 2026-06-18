/**
 * TASFUL TALK AI下書き → 投稿フォーム反映
 * talk-ai-drafts-store.js の後に読み込む
 */
(function (global) {
  "use strict";

  const URL_PARAM = "talkDraftId";
  const BANNER_OK = "TASFUL TALKのAI下書きを読み込みました";
  const BANNER_FAIL = "AI下書きを読み込めませんでした。通常の入力から続けられます。";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeMode(mode) {
    return global.TasuTalkAiDrafts?.normalizeMode?.(mode) || String(mode || "").toLowerCase();
  }

  function canApplyToPostForm(mode) {
    const m = normalizeMode(mode);
    return m === "project" || m === "job" || m === "business" || m === "shop";
  }

  function buildApplyUrl(mode, draftId) {
    if (global.TasuTalkAiDrafts?.buildPostFormApplyUrl) {
      return global.TasuTalkAiDrafts.buildPostFormApplyUrl(mode, draftId);
    }
    const id = pickStr(draftId);
    if (!id || !canApplyToPostForm(mode)) return null;
    const m = normalizeMode(mode);
    if (m === "project") {
      return `builder/mvp-project-new.html?${URL_PARAM}=${encodeURIComponent(id)}`;
    }
    if (m === "job") {
      return `post.html?type=job&${URL_PARAM}=${encodeURIComponent(id)}`;
    }
    if (m === "shop") {
      return `post.html?scope=business&postType=shop-store&${URL_PARAM}=${encodeURIComponent(id)}`;
    }
    return `post.html?scope=business&${URL_PARAM}=${encodeURIComponent(id)}`;
  }

  function peekDraftIdFromUrl() {
    try {
      return pickStr(new URLSearchParams(global.location.search).get(URL_PARAM));
    } catch {
      return "";
    }
  }

  const SHOP_CATEGORY_LABEL_MAP = {
    "飲食・レストラン": "restaurant",
    飲食: "restaurant",
    レストラン: "restaurant",
    小売: "retail",
    "古着・ブランド": "vintage_brand",
    "雑貨・インテリア": "goods_interior",
    "食品・小売": "food_retail",
    "ホビー・アニメ": "hobby_anime",
    ペット: "pet",
    その他: "other_shop",
  };

  function resolveShopCategory(raw) {
    const label = pickStr(raw);
    if (!label) return "restaurant";
    if (SHOP_CATEGORY_LABEL_MAP[label]) return SHOP_CATEGORY_LABEL_MAP[label];
    const lower = label.toLowerCase();
    const hit = Object.entries(SHOP_CATEGORY_LABEL_MAP).find(
      ([key]) => key.toLowerCase() === lower || label.includes(key)
    );
    return hit ? hit[1] : "restaurant";
  }

  function parsePrice(raw) {
    const digits = String(raw || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  /**
   * @param {string} text
   * @returns {Record<string, string>}
   */
  function parseLabeledBlocks(text) {
    const map = {};
    const lines = String(text || "").split(/\r?\n/);
    let currentKey = null;
    let buf = [];

    const flush = () => {
      if (!currentKey) return;
      const val = buf.join("\n").trim();
      if (val) map[currentKey] = val;
      buf = [];
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/^【[^】]+】$/.test(trimmed)) return;

      const m = trimmed.match(/^([^：:]{1,30})[：:]\s*(.*)$/);
      if (m) {
        flush();
        currentKey = m[1].trim();
        const rest = m[2].trim();
        buf = rest ? [rest] : [];
        return;
      }
      if (currentKey) buf.push(trimmed);
    });
    flush();
    return map;
  }

  function firstKey(map, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const v = pickStr(map[keys[i]]);
      if (v) return v;
    }
    return "";
  }

  /**
   * @param {{ mode: string, input?: string, output?: string }} draft
   */
  function parseDraftContent(draft) {
    const mode = normalizeMode(draft?.mode);
    const input = String(draft?.input || "").trim();
    const output = String(draft?.output || "").trim();
    const labeled = parseLabeledBlocks(output);
    const notes = [];

    if (mode === "job") {
      const title = firstKey(labeled, ["募集タイトル", "タイトル", "求人タイトル", "案件名"]);
      const work = firstKey(labeled, ["仕事内容", "業務内容", "募集内容", "作業内容"]);
      const overview = firstKey(labeled, ["概要", "説明", "説明文", "募集概要"]);
      const location = firstKey(labeled, ["勤務地", "場所", "エリア", "勤務エリア"]);
      const employment = firstKey(labeled, ["雇用形態", "契約形態"]);
      const salary = firstKey(labeled, ["給与", "報酬", "給与・報酬", "時給", "月給", "年収", "金額"]);
      const hours = firstKey(labeled, ["勤務時間", "勤務形態"]);
      const deadline = firstKey(labeled, ["応募締切", "締切"]);

      ["予算", "予算目安", "備考", "その他"].forEach((k) => {
        if (labeled[k]) notes.push(`${k}: ${labeled[k]}`);
      });
      if (salary && !notes.some((n) => n.includes(salary))) {
        notes.push(`報酬・金額: ${salary}`);
      }

      return {
        mode,
        title: title || pickStr(input.split("\n")[0]) || "",
        description: overview || input || "",
        workContent: work || overview || input || "",
        location,
        employment,
        salary,
        workingHours: hours,
        applicationDeadline: deadline,
        notes: notes.join("\n"),
        rawOutput: output,
      };
    }

    if (mode === "project") {
      const title = firstKey(labeled, ["案件名", "案件タイトル", "タイトル", "プロジェクト名"]);
      const overview = firstKey(labeled, ["概要", "案件概要", "説明"]);
      const work = firstKey(labeled, ["作業内容", "工事内容", "業務内容", "依頼内容"]);
      const area = firstKey(labeled, ["エリア", "場所", "地域", "現場", "エリア（カンマ区切り）"]);
      const budget = firstKey(labeled, ["予算", "予算目安", "金額", "費用目安"]);
      const period = firstKey(labeled, ["工期", "期間", "日程", "スケジュール"]);
      const trades = firstKey(labeled, ["工種", "工種タグ"]);

      if (budget) notes.push(`予算目安: ${budget}`);
      if (period) notes.push(`工期・日程: ${period}`);

      const descParts = [];
      if (overview) descParts.push(`【概要】\n${overview}`);
      if (work) descParts.push(`【作業内容】\n${work}`);
      if (input && !overview && !work) descParts.push(input);
      if (notes.length) descParts.push(`【備考（AI下書き）】\n${notes.join("\n")}`);

      return {
        mode,
        title: title || pickStr(input.split("\n")[0]) || "",
        description: descParts.join("\n\n") || output || input,
        areas: area,
        trades,
        notes: notes.join("\n"),
        rawOutput: output,
      };
    }

    if (mode === "business" || mode === "shop") {
      const title = firstKey(labeled, [
        "タイトル",
        "サービス名",
        "店舗名",
        "掲載タイトル",
        "案件名",
      ]);
      const category = firstKey(labeled, ["カテゴリ", "業種", "サービスカテゴリ"]);
      const shopCategory = firstKey(labeled, ["店舗カテゴリ", "店舗種別", "店舗ジャンル"]);
      const price = firstKey(labeled, ["料金", "価格", "金額", "参考価格"]);
      const description = firstKey(labeled, ["詳細説明", "説明", "概要", "サービス内容", "店舗紹介"]);
      const tags = firstKey(labeled, ["タグ", "キーワード"]);

      return {
        mode,
        title: title || pickStr(input.split("\n")[0]) || "",
        category:
          mode === "shop"
            ? "店舗・販売"
            : category || "建築・修理",
        shopCategory: resolveShopCategory(shopCategory),
        price: parsePrice(price),
        description: description || input || output,
        tags: parseTags(tags),
        notes: "",
        rawOutput: output,
      };
    }

    return { mode, title: "", description: output || input, notes: "" };
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
    return String(raw || "")
      .split(/[,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function setFieldValue(el, value) {
    if (!el || value == null || value === "") return;
    const v = String(value);
    if (el.tagName === "SELECT") {
      const opt = Array.from(el.options || []).find(
        (o) => String(o.value) === v || String(o.textContent || "").trim() === v
      );
      if (opt) el.value = opt.value;
      else el.value = v;
    } else {
      el.value = v;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function showBanner(anchor, ok, message) {
    if (!anchor) return;
    const parent = anchor.parentElement || anchor;
    let el = parent.querySelector("[data-talk-draft-banner]");
    if (!el) {
      el = global.document.createElement("div");
      el.dataset.talkDraftBanner = "";
      el.setAttribute("role", "status");
      parent.insertBefore(el, anchor);
    }
    el.textContent = message || (ok ? BANNER_OK : BANNER_FAIL);
    el.className = ok ? "talk-draft-banner talk-draft-banner--ok" : "talk-draft-banner talk-draft-banner--warn";
    el.hidden = false;
  }

  function consumeDraftIdFromUrl() {
    try {
      const params = new URLSearchParams(global.location.search);
      const id = pickStr(params.get(URL_PARAM));
      if (!id) return "";
      params.delete(URL_PARAM);
      const q = params.toString();
      const path = global.location.pathname + (q ? `?${q}` : "");
      global.history.replaceState?.(null, "", path);
      return id;
    } catch {
      return pickStr(new URLSearchParams(global.location.search).get(URL_PARAM));
    }
  }

  /**
   * @param {object} draft
   * @param {HTMLFormElement|null} form
   */
  function applyJobDraft(draft, form) {
    const root = form || global.document.getElementById("listingForm") || global.document;
    const parsed = parseDraftContent(draft);
    const title = parsed.title;
    const desc = parsed.description;
    const work = parsed.workContent;

    setFieldValue(root.querySelector("#jobTitle"), title);
    setFieldValue(root.querySelector("#title"), title || desc.slice(0, 80));
    setFieldValue(root.querySelector("#description"), desc || work);
    setFieldValue(root.querySelector("#jobWorkContent"), work || desc);
    setFieldValue(root.querySelector("#job_location"), parsed.location);
    setFieldValue(root.querySelector("#employment_type"), parsed.employment);
    setFieldValue(root.querySelector("#salary_amount"), parsed.salary);
    setFieldValue(root.querySelector("#working_hours"), parsed.workingHours);
    setFieldValue(root.querySelector("#application_deadline"), parsed.applicationDeadline);

    const noteText = [
      parsed.notes ? `【AI下書き・備考】\n${parsed.notes}` : "",
      parsed.rawOutput ? `【AI生成全文】\n${parsed.rawOutput}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const notesEl = root.querySelector("#application_method");
    if (notesEl && noteText) {
      const prev = String(notesEl.value || "").trim();
      setFieldValue(notesEl, prev ? `${prev}\n\n${noteText}` : noteText);
    }

    return Boolean(title || desc || work);
  }

  /**
   * @param {object} draft
   * @param {HTMLFormElement|null} form
   */
  function applyProjectDraft(draft, form) {
    const root = form || global.document.querySelector("[data-builder-mvp-project-form]");
    if (!root) return false;
    const parsed = parseDraftContent(draft);

    setFieldValue(root.querySelector("[data-builder-mvp-project-title]"), parsed.title);
    setFieldValue(root.querySelector("[data-builder-mvp-project-desc]"), parsed.description);
    setFieldValue(root.querySelector("[data-builder-mvp-project-areas]"), parsed.areas);
    setFieldValue(root.querySelector("[data-builder-mvp-project-trades]"), parsed.trades);

    const counter = root.querySelector("[data-mvp-desc-count]");
    if (counter) {
      counter.textContent = String((parsed.description || "").length);
    }

    return Boolean(parsed.title || parsed.description);
  }

  /**
   * @param {object} draft
   * @param {HTMLFormElement|null} form
   */
  function applyPostListingDraft(draft, form) {
    const root = form || global.document.getElementById("listingForm") || global.document;
    const parsed = parseDraftContent(draft);
    const agentDraft = {
      title: parsed.title,
      category: parsed.category,
      price: parsed.price || 0,
      description: parsed.description,
      tags: parsed.tags || [],
      images: [],
      shopCategory: parsed.shopCategory,
    };

    if (global.TasuPostDraftAgent?.applyDraftToForm) {
      global.TasuPostDraftAgent.applyDraftToForm(root, agentDraft, { skipStorage: true });
      return Boolean(parsed.title || parsed.description);
    }

    setFieldValue(root.querySelector("#title"), parsed.title);
    setFieldValue(root.querySelector("#description"), parsed.description);
    setFieldValue(root.querySelector("#price"), parsed.price ? String(parsed.price) : "");
    setFieldValue(
      root.querySelector("#tags"),
      Array.isArray(parsed.tags) ? parsed.tags.join(", ") : parsed.tags || ""
    );
    return Boolean(parsed.title || parsed.description);
  }

  /**
   * @param {string} draftId
   * @param {{ form?: HTMLFormElement|null, anchor?: Element|null }} [options]
   */
  function tryApplyJobPage(options) {
    const draftId = pickStr(options?.draftId) || peekDraftIdFromUrl();
    const anchor =
      options?.anchor ||
      options?.form ||
      global.document.getElementById("listingForm") ||
      global.document.querySelector("main");

    if (!draftId) return { ok: false, skipped: true };

    let draft = null;
    try {
      draft = global.TasuTalkAiDrafts?.findById?.(draftId);
    } catch (err) {
      console.warn("[TasuTalkAiDraftApply] job load failed:", err);
    }

    if (!draft || normalizeMode(draft.mode) !== "job") {
      if (pickStr(options?.draftId)) {
        showBanner(anchor, false, BANNER_FAIL);
      }
      return { ok: false, reason: "draft_not_found", skipped: !pickStr(options?.draftId) };
    }

    try {
      const filled = applyJobDraft(draft, options?.form || null);
      if (filled) {
        consumeDraftIdFromUrl();
        global.TasuTalkAiDrafts?.markUsed?.(draftId);
        showBanner(anchor, true, BANNER_OK);
        return { ok: true, draftId, draft };
      }
      showBanner(anchor, false, BANNER_FAIL);
      return { ok: false, reason: "empty_parsed" };
    } catch (err) {
      console.warn("[TasuTalkAiDraftApply] job apply failed:", err);
      showBanner(anchor, false, BANNER_FAIL);
      return { ok: false, reason: String(err) };
    }
  }

  /**
   * @param {{ form?: HTMLFormElement|null, draftId?: string, anchor?: Element|null }} [options]
   */
  function tryApplyPostListingPage(options) {
    const draftId = pickStr(options?.draftId) || peekDraftIdFromUrl();
    const form = options?.form || global.document.getElementById("listingForm");
    const anchor =
      options?.anchor ||
      form ||
      global.document.querySelector("[data-agent-panel]") ||
      global.document.querySelector("main");

    if (!draftId) return { ok: false, skipped: true };

    let draft = null;
    try {
      draft = global.TasuTalkAiDrafts?.findById?.(draftId);
    } catch (err) {
      console.warn("[TasuTalkAiDraftApply] listing load failed:", err);
    }

    const mode = normalizeMode(draft?.mode);
    if (!draft || (mode !== "business" && mode !== "shop")) {
      if (pickStr(options?.draftId)) {
        showBanner(anchor, false, BANNER_FAIL);
      }
      return { ok: false, reason: "draft_not_found", skipped: !pickStr(options?.draftId) };
    }

    const applyOnce = () => {
      try {
        const filled = applyPostListingDraft(draft, form);
        if (filled) {
          consumeDraftIdFromUrl();
          global.TasuTalkAiDrafts?.markUsed?.(draftId);
          showBanner(anchor, true, BANNER_OK);
          return { ok: true, draftId, draft };
        }
        showBanner(anchor, false, BANNER_FAIL);
        return { ok: false, reason: "empty_parsed" };
      } catch (err) {
        console.warn("[TasuTalkAiDraftApply] listing apply failed:", err);
        showBanner(anchor, false, BANNER_FAIL);
        return { ok: false, reason: String(err) };
      }
    };

    return new Promise((resolve) => {
      global.setTimeout(() => resolve(applyOnce()), 120);
    });
  }

  /**
   * post.html — TALK下書きをモードに応じて反映
   * @param {{ form?: HTMLFormElement|null, draftId?: string }} [options]
   */
  async function tryApplyPostFormPage(options) {
    const draftId = pickStr(options?.draftId) || peekDraftIdFromUrl();
    if (!draftId) return { ok: false, skipped: true };

    const anchor =
      options?.anchor ||
      options?.form ||
      global.document.getElementById("listingForm") ||
      global.document.querySelector("[data-agent-panel]") ||
      global.document.querySelector("main");

    let draft = null;
    try {
      draft = global.TasuTalkAiDrafts?.findById?.(draftId);
    } catch {
      draft = null;
    }

    if (!draft) {
      showBanner(anchor, false, BANNER_FAIL);
      consumeDraftIdFromUrl();
      return { ok: false, reason: "draft_not_found" };
    }

    const mode = normalizeMode(draft?.mode);
    if (mode === "job") return tryApplyJobPage({ ...options, draftId });
    if (mode === "business" || mode === "shop") return tryApplyPostListingPage({ ...options, draftId });
    showBanner(anchor, false, BANNER_FAIL);
    consumeDraftIdFromUrl();
    return { ok: false, skipped: true, reason: "unsupported_mode" };
  }

  /**
   * @param {{ form?: HTMLFormElement|null, draftId?: string }} [options]
   */
  function tryApplyProjectPage(options) {
    const draftId = pickStr(options?.draftId) || consumeDraftIdFromUrl();
    const form =
      options?.form || global.document.querySelector("[data-builder-mvp-project-form]");
    const anchor = form || global.document.querySelector(".builder-main");

    if (!draftId) return { ok: false, skipped: true };

    let draft = null;
    try {
      draft = global.TasuTalkAiDrafts?.findById?.(draftId);
    } catch (err) {
      console.warn("[TasuTalkAiDraftApply] project load failed:", err);
    }

    if (!draft || normalizeMode(draft.mode) !== "project") {
      showBanner(anchor, false, BANNER_FAIL);
      return { ok: false, reason: "draft_not_found" };
    }

    try {
      const filled = applyProjectDraft(draft, form);
      if (filled) {
        global.TasuTalkAiDrafts?.markUsed?.(draftId);
        showBanner(anchor, true, BANNER_OK);
        return { ok: true, draftId, draft };
      }
      showBanner(anchor, false, BANNER_FAIL);
      return { ok: false, reason: "empty_parsed" };
    } catch (err) {
      console.warn("[TasuTalkAiDraftApply] project apply failed:", err);
      showBanner(anchor, false, BANNER_FAIL);
      return { ok: false, reason: String(err) };
    }
  }

  /**
   * @param {{ mode: string, draftId?: string, input?: string, output?: string }} payload
   */
  function navigateToPostForm(payload) {
    const mode = normalizeMode(payload?.mode);
    if (!canApplyToPostForm(mode)) return { ok: false, reason: "unsupported_mode" };

    let draftId = pickStr(payload?.draftId);
    if (!draftId && global.TasuTalkAiDrafts?.add) {
      const row = global.TasuTalkAiDrafts.add({
        mode,
        input: payload?.input || "",
        output: payload?.output || "",
        status: "draft",
      });
      draftId = row?.id || "";
    }
    const url = buildApplyUrl(mode, draftId);
    if (!url) return { ok: false, reason: "no_url" };
    global.location.href = url;
    return { ok: true, draftId, url };
  }

  global.TasuTalkAiDraftApply = {
    URL_PARAM,
    BANNER_OK,
    BANNER_FAIL,
    canApplyToPostForm,
    buildApplyUrl,
    parseDraftContent,
    parseLabeledBlocks,
    applyJobDraft,
    applyProjectDraft,
    applyPostListingDraft,
    tryApplyJobPage,
    tryApplyPostListingPage,
    tryApplyPostFormPage,
    tryApplyProjectPage,
    navigateToPostForm,
    consumeDraftIdFromUrl,
    peekDraftIdFromUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
