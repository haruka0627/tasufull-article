/**
 * one-tlv-scene-comments-adapter.js
 * Scene Comments Source ↔ formal TLV LIVE comments (TasuLiveComments).
 *
 * SSOT:
 *   store:  window.TasuLiveComments → public.live_broadcast_messages
 *   bind:   broadcast_id from Go Live session / data-broadcast-id
 *   refresh: poll 4s (Realtime publication not enabled — TLV-P0-06)
 *
 * Does NOT create a second comment store. Scene JSON never persists messages.
 */
(function (global) {
  "use strict";

  var POLL_MS = 4000;
  var OWNER = "TasuOneTlvSceneCommentsAdapter";

  /** @type {{ id:string, senderId:string, name:string, initials:string, message:string, createdAt:string }[]} */
  var runtimeComments = [];
  var boundBroadcastId = "";
  var pollTimer = 0;
  var fetching = false;
  var lastError = "";
  var listeners = [];

  function cfg() {
    return global.TasuLiveConfig || null;
  }

  function commentsApi() {
    return global.TasuLiveComments || null;
  }

  function isStubId(id) {
    if (!id) return true;
    return Boolean(global.TasuLiveBroadcasts?.isStubBroadcastId?.(id));
  }

  function resolveBroadcastId() {
    var fromSession = global.TasuOneTlvGoLiveService?.getSession?.()?.broadcastId;
    if (fromSession) return String(fromSession);
    var fromBody =
      typeof document !== "undefined" ? document.body?.getAttribute?.("data-broadcast-id") : "";
    if (fromBody) return String(fromBody);
    return boundBroadcastId || "";
  }

  function initialsFromName(name) {
    var s = String(name || "").trim();
    if (!s) return "?";
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return s.slice(0, 2).toUpperCase();
  }

  function mapRow(row) {
    if (!row || typeof row !== "object") return null;
    var senderId = String(row.sender_id || row.senderId || "");
    var name =
      (cfg()?.resolveDisplayName && senderId ? cfg().resolveDisplayName(senderId) : "") ||
      String(row.name || row.display_name || senderId || "Viewer");
    var message = String(row.message || "").slice(0, 200);
    if (!message) return null;
    return {
      id: String(row.id || ""),
      senderId: senderId,
      name: name,
      initials: initialsFromName(name),
      message: message,
      createdAt: String(row.created_at || row.createdAt || ""),
    };
  }

  /**
   * Formal fields only. No moderation columns exist on live_broadcast_messages today.
   * Deleted rows are absent from fetch (own-delete removes the row) — nothing to hide locally.
   */
  function mapRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(mapRow).filter(Boolean);
  }

  function notify() {
    listeners.slice().forEach(function (fn) {
      try {
        fn(getSnapshot());
      } catch (_) {}
    });
  }

  function getSnapshot() {
    return {
      broadcastId: boundBroadcastId,
      bound: Boolean(boundBroadcastId) && !isStubId(boundBroadcastId),
      comments: runtimeComments.slice(),
      count: runtimeComments.length,
      lastError: lastError,
      polling: Boolean(pollTimer),
      owner: OWNER,
    };
  }

  async function refreshNow() {
    var api = commentsApi();
    var id = boundBroadcastId;
    if (!api?.fetchMessages || !id || isStubId(id)) {
      runtimeComments = [];
      lastError = id && isStubId(id) ? "stub_broadcast" : "unbound";
      notify();
      return getSnapshot();
    }
    if (fetching) return getSnapshot();
    fetching = true;
    try {
      var rows = await Promise.race([
        api.fetchMessages(id),
        new Promise(function (_, reject) {
          setTimeout(function () {
            reject(new Error("comments_fetch_timeout"));
          }, 8000);
        }),
      ]);
      // Only apply if still bound to same id and QA inject hasn't taken over mid-flight.
      if (boundBroadcastId === id) {
        runtimeComments = mapRows(rows);
        lastError = "";
      }
    } catch (err) {
      lastError = err?.message || String(err);
    } finally {
      fetching = false;
    }
    notify();
    return getSnapshot();
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function startPoll() {
    stopPoll();
    if (!boundBroadcastId || isStubId(boundBroadcastId)) return;
    pollTimer = setInterval(function () {
      refreshNow();
    }, POLL_MS);
  }

  function bindBroadcast(broadcastId) {
    var next = String(broadcastId || "").trim();
    if (next === boundBroadcastId && pollTimer) {
      return getSnapshot();
    }
    boundBroadcastId = next;
    runtimeComments = [];
    lastError = "";
    stopPoll();
    if (boundBroadcastId && !isStubId(boundBroadcastId)) {
      refreshNow();
      startPoll();
    } else {
      notify();
    }
    return getSnapshot();
  }

  function unbind() {
    stopPoll();
    boundBroadcastId = "";
    runtimeComments = [];
    lastError = "";
    notify();
    return getSnapshot();
  }

  /** Re-read Go Live session / DOM and (re)bind. */
  function syncFromGoLive() {
    return bindBroadcast(resolveBroadcastId());
  }

  /**
   * Comments for Canvas compositor / Publish — formal runtime only.
   * Never returns editor-only sample fixtures.
   */
  function getCommentsForCanvas(maxItems) {
    var n = Math.max(1, Math.min(20, Number(maxItems) || 5));
    if (!runtimeComments.length) return [];
    return runtimeComments.slice(-n);
  }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
  }

  /**
   * QA-only: replace runtime buffer as if fetchMessages returned these rows.
   * Capture / verify scripts only. Production Go Live never calls this.
   * Shape matches formal mapped DTO (or raw live_broadcast_messages rows).
   */
  function injectQaRuntimeComments(rows) {
    runtimeComments = mapRows(rows);
    lastError = "";
    notify();
    return getSnapshot();
  }

  /** Built-in QA fixture set (not used unless injectQaRuntimeComments / capture calls it). */
  function getQaFixtureRows() {
    return [
      {
        id: "qa-c1",
        sender_id: "qa-user-a",
        name: "Alex",
        message: "Hello!",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c2",
        sender_id: "qa-user-b",
        name: "Very Long Display Name Here",
        message: "Short",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c3",
        sender_id: "",
        name: "Anon",
        message:
          "This is a very long comment that must wrap inside the Comments Source width without escaping the clipped layer bounds on the canvas compositor.",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c4",
        sender_id: "qa-user-d",
        name: "Sam",
        message: "<script>alert(1)</script>",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c5",
        sender_id: "qa-user-e",
        name: "URL",
        message: "See https://example.com/path?x=1",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c6",
        sender_id: "qa-user-f",
        name: "Extra1",
        message: "overflow item 1",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c7",
        sender_id: "qa-user-g",
        name: "Extra2",
        message: "overflow item 2",
        created_at: new Date().toISOString(),
      },
      {
        id: "qa-c8",
        sender_id: "qa-user-h",
        name: "Extra3",
        message: "overflow item 3",
        created_at: new Date().toISOString(),
      },
    ];
  }

  global.TasuOneTlvSceneCommentsAdapter = {
    OWNER: OWNER,
    POLL_MS: POLL_MS,
    FORMAL_STORE: "TasuLiveComments",
    FORMAL_TABLE: "live_broadcast_messages",
    bindBroadcast: bindBroadcast,
    unbind: unbind,
    syncFromGoLive: syncFromGoLive,
    refreshNow: refreshNow,
    getSnapshot: getSnapshot,
    getCommentsForCanvas: getCommentsForCanvas,
    onChange: onChange,
    resolveBroadcastId: resolveBroadcastId,
    injectQaRuntimeComments: injectQaRuntimeComments,
    getQaFixtureRows: getQaFixtureRows,
    mapRows: mapRows,
  };
})(typeof window !== "undefined" ? window : globalThis);
