/**
 * ボタン押下〜画面反映の計測（bench / chat-detail / notify iframe 共通）
 */
(function (global) {
  "use strict";

  const NOTIFY_CLICK_WALL_KEY = "tasu_review_notify_click_wall";
  const LAST_CLICK_WALL_KEY = "tasu_last_interaction_click_wall";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readNotifyClickWall() {
    try {
      return (
        Number(global.sessionStorage?.getItem(NOTIFY_CLICK_WALL_KEY)) ||
        Number(global.sessionStorage?.getItem(LAST_CLICK_WALL_KEY)) ||
        0
      );
    } catch {
      return 0;
    }
  }

  function ensureTrace() {
    if (!global.__benchInteractionTrace) {
      global.__benchInteractionTrace = {
        clicks: [],
        events: [],
        counters: {
          iframeRefresh: 0,
          postMessage: 0,
          softSync: 0,
          notifyRefresh: 0,
          chatDetailInit: 0,
        },
      };
    }
    return global.__benchInteractionTrace;
  }

  function stampClick(label, detail) {
    const wall = Date.now();
    const trace = ensureTrace();
    const entry = {
      label: pickStr(label, "click"),
      wall,
      detail: detail && typeof detail === "object" ? detail : {},
    };
    trace.clicks.push(entry);
    if (trace.clicks.length > 80) trace.clicks.shift();
    try {
      global.sessionStorage?.setItem(LAST_CLICK_WALL_KEY, String(wall));
    } catch {
      /* ignore */
    }
    console.info("[TasuInteraction] click", entry);
    return wall;
  }

  function logEvent(label, detail) {
    const wall = Date.now();
    const origin = readNotifyClickWall();
    const entry = {
      label: pickStr(label, "event"),
      wall,
      sinceNotifyClickMs: origin > 0 ? wall - origin : null,
      detail: detail && typeof detail === "object" ? detail : {},
    };
    const trace = ensureTrace();
    trace.events.push(entry);
    if (trace.events.length > 120) trace.events.shift();
    const counterKey = pickStr(detail?.counter);
    if (counterKey && trace.counters[counterKey] != null) {
      trace.counters[counterKey] += 1;
    }
    console.info("[TasuInteraction]", entry.label, entry);
    return entry;
  }

  function bumpCounter(name, delta) {
    const trace = ensureTrace();
    const key = pickStr(name);
    if (!key || trace.counters[key] == null) return;
    trace.counters[key] += Number(delta) || 1;
  }

  global.TasuPlatformChatInteractionTrace = {
    NOTIFY_CLICK_WALL_KEY,
    LAST_CLICK_WALL_KEY,
    readNotifyClickWall,
    stampClick,
    logEvent,
    bumpCounter,
    ensureTrace,
  };
})(typeof window !== "undefined" ? window : globalThis);
