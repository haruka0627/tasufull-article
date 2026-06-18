/**
 * TASFUL OPS WATCH Phase1 — localStorage ストア
 */
(function (global) {
  "use strict";

  const STATE_KEY = "tasful_ops_watch_state_v1";
  const CARDS_KEY = "tasful_ops_watch_cards_v1";
  const KNOWN_SERVICES_KEY = "tasful_ops_watch_known_services_v1";
  const MAX_CARDS = 200;
  const DEFAULT_DEDUPE_HOURS = 24;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
    try {
      global.dispatchEvent(new CustomEvent("tasu:ops-watch-changed", { detail: { key } }));
    } catch {
      /* ignore */
    }
  }

  function defaultState() {
    return {
      lastRunAt: null,
      lastRunByCategory: {},
      notifiedFingerprints: {},
      runCount: 0,
    };
  }

  function readState() {
    const s = readJson(STATE_KEY, defaultState());
    return {
      ...defaultState(),
      ...(s && typeof s === "object" ? s : {}),
      lastRunByCategory:
        s?.lastRunByCategory && typeof s.lastRunByCategory === "object"
          ? s.lastRunByCategory
          : {},
      notifiedFingerprints:
        s?.notifiedFingerprints && typeof s.notifiedFingerprints === "object"
          ? s.notifiedFingerprints
          : {},
    };
  }

  function writeState(state) {
    writeJson(STATE_KEY, state);
    return state;
  }

  function seedKnownServices() {
    const Cats = global.TasuOpsWatchCategories;
    const base = Cats?.allCategoryLabels?.() || [];
    const aliases = Cats?.allKnownAliases?.() || new Set();
    const list = [...base];
    aliases.forEach((a) => list.push(a));
    return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  }

  function readKnownServices() {
    const stored = readJson(KNOWN_SERVICES_KEY, null);
    if (Array.isArray(stored) && stored.length) return stored.map((s) => String(s).trim()).filter(Boolean);
    const seeded = seedKnownServices();
    writeJson(KNOWN_SERVICES_KEY, seeded);
    return seeded;
  }

  function addKnownService(name) {
    const label = pickStr(name);
    if (!label) return readKnownServices();
    const list = readKnownServices();
    const key = label.toLowerCase();
    if (list.some((s) => s.toLowerCase() === key)) return list;
    const next = [label, ...list].slice(0, 500);
    writeJson(KNOWN_SERVICES_KEY, next);
    return next;
  }

  function isKnownService(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return true;
    return readKnownServices().some((s) => s.toLowerCase() === key);
  }

  function normalizeCard(raw) {
    const id = pickStr(raw?.id) || `ops-watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const importance = ["high", "medium", "low"].includes(String(raw?.importance).toLowerCase())
      ? String(raw.importance).toLowerCase()
      : "medium";
    return {
      id,
      categoryId: pickStr(raw?.categoryId, raw?.category_id),
      categoryLabel: pickStr(raw?.categoryLabel, raw?.category_label) || "監視",
      headline: pickStr(raw?.headline) || "OPS WATCH 更新",
      summary: pickStr(raw?.summary) || "",
      importance,
      tasfulImpact: pickStr(raw?.tasfulImpact, raw?.tasful_impact) || "",
      recommendedAction: pickStr(raw?.recommendedAction, raw?.recommended_action) || "",
      introductionProposal: pickStr(raw?.introductionProposal, raw?.introduction_proposal) || "",
      isNewService: Boolean(raw?.isNewService || raw?.is_new_service),
      newServiceName: pickStr(raw?.newServiceName, raw?.new_service_name) || "",
      searchQuery: pickStr(raw?.searchQuery, raw?.search_query) || "",
      searchUsed: Boolean(raw?.searchUsed ?? raw?.search_used),
      searchResultCount: Number(raw?.searchResultCount ?? raw?.search_result_count) || 0,
      sources: Array.isArray(raw?.sources)
        ? raw.sources
            .map((s) => ({
              title: pickStr(s?.title).slice(0, 300),
              url: pickStr(s?.url).slice(0, 2000),
              snippet: pickStr(s?.snippet).slice(0, 400),
            }))
            .filter((s) => s.title || s.url)
        : [],
      fingerprint: pickStr(raw?.fingerprint) || "",
      notificationId: pickStr(raw?.notificationId, raw?.notification_id) || "",
      notifiedAt: pickStr(raw?.notifiedAt, raw?.notified_at) || null,
      createdAt: pickStr(raw?.createdAt, raw?.created_at) || new Date().toISOString(),
      analyzerProvider: pickStr(raw?.analyzerProvider, raw?.analyzer_provider) || "template",
      analysisSource: pickStr(raw?.analysisSource, raw?.analysis_source, raw?.analyzerProvider) || "template",
      searchUsed: raw?.searchUsed === true || raw?.search_used === true,
      searchFailed: Boolean(raw?.searchFailed || raw?.search_failed),
    };
  }

  function readCards() {
    const list = readJson(CARDS_KEY, []);
    return (Array.isArray(list) ? list : []).map(normalizeCard);
  }

  function writeCards(list) {
    const safe = (Array.isArray(list) ? list : []).map(normalizeCard).slice(0, MAX_CARDS);
    writeJson(CARDS_KEY, safe);
    return safe;
  }

  function getCard(id) {
    return readCards().find((c) => String(c.id) === String(id)) || null;
  }

  function upsertCard(card) {
    const row = normalizeCard(card);
    const list = readCards();
    const idx = list.findIndex((c) => String(c.id) === String(row.id));
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.unshift(row);
    writeCards(list);
    return row;
  }

  function fingerprintForCard(card) {
    if (card.fingerprint) return card.fingerprint;
    const base = [
      card.categoryId,
      card.headline,
      card.importance,
      card.isNewService ? card.newServiceName : "",
    ]
      .join("|")
      .toLowerCase();
    let hash = 0;
    for (let i = 0; i < base.length; i += 1) {
      hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
    }
    return `fp-${card.categoryId}-${hash.toString(36)}`;
  }

  function wasNotifiedRecently(fingerprint, hours) {
    const state = readState();
    const at = state.notifiedFingerprints?.[fingerprint];
    if (!at) return false;
    const ms = (Number(hours) > 0 ? Number(hours) : DEFAULT_DEDUPE_HOURS) * 3600 * 1000;
    return Date.now() - new Date(at).getTime() < ms;
  }

  function markNotified(fingerprint) {
    const state = readState();
    state.notifiedFingerprints = state.notifiedFingerprints || {};
    state.notifiedFingerprints[fingerprint] = new Date().toISOString();
    writeState(state);
  }

  function recordCategoryRun(categoryId, meta) {
    const state = readState();
    state.lastRunAt = new Date().toISOString();
    state.runCount = (Number(state.runCount) || 0) + 1;
    state.lastRunByCategory = state.lastRunByCategory || {};
    state.lastRunByCategory[categoryId] = {
      at: state.lastRunAt,
      ...(meta && typeof meta === "object" ? meta : {}),
    };
    writeState(state);
    return state;
  }

  function clearForTests() {
    global.localStorage.removeItem(STATE_KEY);
    global.localStorage.removeItem(CARDS_KEY);
    global.localStorage.removeItem(KNOWN_SERVICES_KEY);
  }

  global.TasuOpsWatchStore = {
    STATE_KEY,
    CARDS_KEY,
    KNOWN_SERVICES_KEY,
    MAX_CARDS,
    DEFAULT_DEDUPE_HOURS,
    readState,
    writeState,
    readKnownServices,
    addKnownService,
    isKnownService,
    readCards,
    writeCards,
    getCard,
    upsertCard,
    normalizeCard,
    fingerprintForCard,
    wasNotifiedRecently,
    markNotified,
    recordCategoryRun,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
