/**
 * Builder 2窓ベンチ — iframe 内通知クリックを親の詳細 iframe へ委譲
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isBuilderBenchEmbed() {
    try {
      if (pickStr(global.document?.body?.dataset?.builderBenchEmbed) === "1") return true;
      if (global.document?.body?.classList?.contains("builder-bench-embed")) return true;
      return new URLSearchParams(global.location.search).get("benchEmbed") === "1";
    } catch {
      return false;
    }
  }

  function markBuilderBenchEmbedDom() {
    if (!isBuilderBenchEmbed()) return;
    try {
      global.document.documentElement.classList.add("builder-bench-embed-root");
      global.document.body.classList.add("builder-bench-embed");
      global.document.body.dataset.builderBenchEmbed = "1";
    } catch {
      /* ignore */
    }
  }

  markBuilderBenchEmbedDom();
  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", markBuilderBenchEmbedDom, { once: true });
  }

  function isBuilderBenchParent() {
    if (!isBuilderBenchEmbed()) return false;
    try {
      if (global.self === global.top) return false;
      const p = String(global.parent?.location?.pathname || "");
      return p.includes("chat-dual-window-demo");
    } catch {
      return true;
    }
  }

  function postToParent(payload) {
    try {
      global.parent?.postMessage?.(payload, "*");
      return true;
    } catch {
      return false;
    }
  }

  function resolveBenchSlot(href) {
    const target = pickStr(href);
    if (
      target.includes("partner-assignment.html") ||
      target.includes("mvp-calendar.html") ||
      target.includes("admin-calendar.html") ||
      target.includes("mvp-project-detail.html") ||
      target.includes("public-board-detail.html") ||
      target.includes("board-projects.html")
    ) {
      return "project";
    }
    if (target.includes("mvp-threads.html") || target.includes("board-threads.html")) {
      return "threads";
    }
    return "thread";
  }

  function benchSideParam() {
    return pickStr(new URLSearchParams(global.location.search).get("benchSide"));
  }

  function postGeneralFlowApply(listingId) {
    if (!isBuilderBenchParent()) return false;
    postToParent({
      type: "tasu-builder-bench-general-apply",
      listingId: pickStr(listingId),
      side: benchSideParam(),
    });
    return true;
  }

  function postGeneralFlowPosterAction(action, opts) {
    if (!isBuilderBenchParent()) return false;
    const options = opts && typeof opts === "object" ? opts : {};
    postToParent({
      type: "tasu-builder-bench-general-poster-action",
      action: pickStr(action),
      projectId: pickStr(options.projectId),
      notificationId: pickStr(options.notificationId),
      side: benchSideParam(),
    });
    return true;
  }

  function followNotification(href, notificationId, opts) {
    if (!isBuilderBenchParent()) return false;
    const target = pickStr(href);
    if (!target || target === "#") return false;
    const options = opts && typeof opts === "object" ? opts : {};
    postToParent({
      type: "tasu-builder-bench-notification-navigate",
      href: target,
      notificationId: pickStr(notificationId),
      notificationType: pickStr(options.type, options.notificationType),
      projectId: pickStr(options.projectId),
      calendarEventId: pickStr(options.calendarEventId, options.assignmentId),
      side: benchSideParam(),
      slot: resolveBenchSlot(target),
    });
    return true;
  }

  function followCalendarAssignment(projectId, calendarEventId, opts) {
    if (!isBuilderBenchParent()) return false;
    const pid = pickStr(projectId);
    if (!pid) return false;
    const options = opts && typeof opts === "object" ? opts : {};
    const partnerId = pickStr(
      options.partnerId,
      new URLSearchParams(global.location.search).get("partnerId")
    );
    const sp = new URLSearchParams();
    sp.set("role", "partner");
    sp.set("projectId", pid);
    if (partnerId) sp.set("partnerId", partnerId);
    const aid = pickStr(calendarEventId, options.calendarEventId, options.assignmentId);
    if (aid) sp.set("calendarEventId", aid);
    const href = `partner-assignment.html?${sp.toString()}`;
    return followNotification(href, "", {
      notificationType: "calendar_assignment",
      type: "calendar_assignment",
      projectId: pid,
      calendarEventId: aid,
      partnerId,
    });
  }

  function followPartnerAccepted(href, payload) {
    if (!isBuilderBenchParent()) return false;
    const data = payload && typeof payload === "object" ? payload : {};
    postToParent({
      type: "tasu-builder-bench-partner-accepted",
      href: pickStr(href),
      projectId: pickStr(data.projectId),
      threadId: pickStr(data.threadId, data.thread_id),
      side: benchSideParam(),
    });
    return true;
  }

  function followPartnerDeclined(href, payload) {
    if (!isBuilderBenchParent()) return false;
    const data = payload && typeof payload === "object" ? payload : {};
    postToParent({
      type: "tasu-builder-bench-partner-declined",
      href: pickStr(href),
      projectId: pickStr(data.projectId),
      side: benchSideParam(),
    });
    return true;
  }

  global.TasuBuilderBenchEmbed = {
    isBuilderBenchEmbed,
    isBuilderBenchParent,
    followNotification,
    postGeneralFlowApply,
    postGeneralFlowPosterAction,
    followCalendarAssignment,
    followPartnerAccepted,
    followPartnerDeclined,
  };
})(typeof window !== "undefined" ? window : globalThis);
