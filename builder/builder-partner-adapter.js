/**
 * Builder B3 — partner/application adapter (P2-08)
 */
(function (global) {
  "use strict";

  const VERSION = "p3-partner-adapter";

  /** @type {object|null} */
  let runtime = null;

  function bindRuntime(hooks) {
    runtime = hooks && typeof hooks === "object" ? hooks : null;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveState(opts) {
    if (opts?.state && typeof opts.state === "object") return opts.state;
    if (typeof runtime?.reload === "function") return runtime.reload();
    return global.TasuBuilderBoardAdapter?.reloadState?.() || { applications: [], partners: [] };
  }

  function isWithdrawn(state, projectId, partnerId) {
    const dual = global.TasuBuilderGeneralJobsDualWrite;
    if (dual?.isWithdrawnInState) return dual.isWithdrawnInState(state, projectId, partnerId);
    return (state?.withdrawn_board_applications || []).some(
      (w) => pickStr(w.project_id) === pickStr(projectId) && pickStr(w.partner_id) === pickStr(partnerId)
    );
  }

  function getApplication(projectId, partnerId, opts) {
    const state = resolveState(opts);
    const pid = pickStr(projectId);
    const kid = pickStr(partnerId);
    if (isWithdrawn(state, pid, kid)) return null;
    return (state.applications || []).find((a) => pickStr(a.project_id) === pid && pickStr(a.partner_id) === kid) || null;
  }

  function getDisplayName(partnerId, opts) {
    const state = resolveState(opts);
    const kid = pickStr(partnerId);
    const partner = (state.partners || []).find((p) => pickStr(p.partner_id) === kid);
    return pickStr(partner?.display_name, partner?.name, kid) || kid;
  }

  function upsertApplication(app, opts) {
    const state = resolveState(opts);
    const next = { ...state };
    const list = [...(next.applications || [])];
    const idx = list.findIndex(
      (a) => a.project_id === app.project_id && a.partner_id === app.partner_id
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...app };
    else list.push(app);
    next.applications = list;
    return next;
  }

  function recordPartnerEvent(state, type, payload) {
    if (typeof runtime?.recordPartnerEvent === "function") {
      runtime.recordPartnerEvent(state, type, payload);
    }
  }

  function resolvePartnerForApplication(app, stateOrOpts) {
    const state =
      stateOrOpts && typeof stateOrOpts === "object" && Array.isArray(stateOrOpts.projects)
        ? stateOrOpts
        : resolveState(stateOrOpts);
    const a = app && typeof app === "object" ? app : {};
    const partnerId = pickStr(a.partner_id, a.partner_key);
    const fromState = (state.partners || []).find((p) => pickStr(p.partner_id) === partnerId);
    if (fromState) return fromState;
    const demo = global.TasuBuilderBoardFeed?.DEMO_PARTNERS;
    if (Array.isArray(demo)) {
      const hit = demo.find((p) => pickStr(p.partner_id) === partnerId);
      if (hit) return hit;
    }
    return null;
  }

  global.TasuBuilderPartnerAdapter = {
    VERSION,
    bindRuntime,
    getApplication,
    getDisplayName,
    upsertApplication,
    recordPartnerEvent,
    resolvePartnerForApplication,
    isWithdrawn,
  };
})(typeof window !== "undefined" ? window : globalThis);
