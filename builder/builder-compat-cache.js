/**
 * TASFUL Builder — localStorage は COMPAT_CACHE のみ。新規 SSOT にしない。
 * MVP の tasful:builder:mvp:v1 をミラー先として再利用する。
 */
(function (global) {
  "use strict";

  const MVP_KEY = "tasful:builder:mvp:v1";
  const PROVIDER_KEY = "tasful:builder:provider-store:v1";

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return "";
    }
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function safeParse(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function emptyMvp() {
    return {
      owner_id: "owner-demo",
      projects: [],
      partners: [],
      specs: {},
      applications: [],
      threads: {},
    };
  }

  function readMvp() {
    try {
      return Object.assign(emptyMvp(), safeParse(localStorage.getItem(MVP_KEY), {}));
    } catch {
      return emptyMvp();
    }
  }

  function writeMvp(state) {
    try {
      localStorage.setItem(MVP_KEY, JSON.stringify(state || emptyMvp()));
      document.dispatchEvent(new CustomEvent("builder:mvp-changed", { detail: { state, source: "compat-cache" } }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  function readProviders() {
    try {
      const parsed = safeParse(localStorage.getItem(PROVIDER_KEY), { items: [] });
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  function writeProviders(items) {
    try {
      localStorage.setItem(PROVIDER_KEY, JSON.stringify({ items: items || [], updated_at: nowIso() }));
      document.dispatchEvent(new CustomEvent("builder:provider-store-changed"));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  function upsertProviderCache(record) {
    const rows = readProviders();
    const id = String(record.id || record.partner_id || "");
    const next = rows.filter((r) => String(r.id || r.partner_id) !== id);
    next.unshift(record);
    return writeProviders(next);
  }

  function getProviderCache(id) {
    const key = String(id || "");
    if (!key) return null;
    return (
      readProviders().find((r) => String(r.id || r.partner_id) === key) ||
      (readMvp().partners || []).find((p) => String(p.partner_id) === key) ||
      null
    );
  }

  function upsertJobCache(project, spec) {
    const state = readMvp();
    const id = String(project.project_id || "");
    state.projects = [project, ...(state.projects || []).filter((p) => String(p.project_id) !== id)];
    state.specs = Object.assign({}, state.specs || {});
    if (spec) state.specs[id] = spec;
    return writeMvp(state);
  }

  function getJobCache(id) {
    const key = String(id || "");
    if (!key) return null;
    const state = readMvp();
    const project = (state.projects || []).find((p) => String(p.project_id) === key);
    if (!project) return null;
    return { project, spec: (state.specs || {})[key] || null, state };
  }

  global.TasuBuilderCompatCache = {
    MVP_KEY,
    PROVIDER_KEY,
    nowIso,
    uid,
    readMvp,
    writeMvp,
    readProviders,
    writeProviders,
    upsertProviderCache,
    getProviderCache,
    upsertJobCache,
    getJobCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
