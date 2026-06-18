/**
 * Phase 6 — Data Source 開発表示（Supabase / Cache）
 */
(function (global) {
  "use strict";

  const BADGE_CLASS = "tasu-ops-data-source-badge";

  function labelForSource() {
    const Primary = global.TasuSupabaseOpsPrimaryConfig;
    const Cache = global.TasuSupabaseOpsPrimaryCache;
    if (!Primary?.isPrimarySource?.()) return null;
    const src = Cache?.getDataSource?.() || "local";
    if (src === "supabase") return { text: "Data Source: Supabase", mod: "supabase" };
    if (src === "cache") return { text: "Data Source: Cache (fallback)", mod: "cache" };
    return { text: "Data Source: local", mod: "local" };
  }

  function renderBadge(host) {
    const info = labelForSource();
    if (!info || !host) return;
    let el = host.querySelector(`.${BADGE_CLASS}`);
    if (!el) {
      el = document.createElement("span");
      el.className = `${BADGE_CLASS} ${BADGE_CLASS}--${info.mod}`;
      el.setAttribute("data-tasu-ops-data-source", info.mod);
      host.prepend(el);
    }
    el.textContent = info.text;
    el.className = `${BADGE_CLASS} ${BADGE_CLASS}--${info.mod}`;
    el.setAttribute("data-tasu-ops-data-source", info.mod);
  }

  function mount(hostSelectors) {
    const Primary = global.TasuSupabaseOpsPrimaryConfig;
    if (!Primary?.isPrimarySource?.()) return;
    (hostSelectors || []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((host) => renderBadge(host));
    });
  }

  function autoMount() {
    mount([
      "[data-ops-dash-load-status]",
      "[data-talk-ops-root]",
      "[data-support-trouble-root]",
      "[data-ai-ops-root]",
      "[data-builder-partner-eval-root]",
    ]);
  }

  function bindRefresh() {
    [
      global.TasuSupabaseOpsRead?.HYDRATE_EVENT,
      global.TasuSupabaseOpsPrimaryCache?.SYNC_EVENT,
    ].forEach((ev) => {
      if (ev) global.addEventListener(ev, autoMount);
    });
    global.addEventListener("tasu:support-tickets-updated", autoMount);
    global.addEventListener("tasu:ai-ops-cases-changed", autoMount);
  }

  if (global.document) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        autoMount();
        bindRefresh();
      });
    } else {
      autoMount();
      bindRefresh();
    }
  }

  global.TasuSupabaseOpsDataSourceUi = {
    labelForSource,
    renderBadge,
    mount,
    autoMount,
  };
})(typeof window !== "undefined" ? window : globalThis);
