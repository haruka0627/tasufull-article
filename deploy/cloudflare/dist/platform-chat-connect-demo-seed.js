/**
 * プラット通知 v3 — Connectあり 取引完了デモ（完了報告カード + 通知）
 */
(function (global) {
  "use strict";

  const BOOT_MARKER = "tasful_platform_verify_connect_complete_v1";

  /** @type {Record<string, { dealId: string, notifyTitle: string }>} */
  const NOTIFY_SPECS = Object.freeze({
    "platform-verify-worker-connect-complete-001": {
      dealId: "worker_deal_demo_001",
      notifyTitle: "取引が完了しました",
    },
    "platform-verify-business-connect-complete-001": {
      dealId: "business_deal_demo_001",
      notifyTitle: "取引が完了しました",
    },
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resetCompletionState(dealId) {
    const key = pickStr(dealId);
    if (!key) return;
    try {
      const raw = global.localStorage.getItem("tasful_platform_completion_v1");
      const map = raw ? JSON.parse(raw) : {};
      if (map && typeof map === "object" && map[key]) {
        delete map[key];
        global.localStorage.setItem("tasful_platform_completion_v1", JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }

    const spec = global.TasuPlatformChatCompletion?.getConnectDealSpec?.(key);
    const threadId = pickStr(spec?.threadId);
    const store = global.TasuChatThreadStore;
    if (!threadId || !store?.MESSAGES_KEY) return;

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map?.[threadId]) ? map[threadId] : [];
      const next = list.map((m) => {
        if (m.kind !== "completion_report" || String(m.dealId) !== key) return m;
        const report = m.completionReport || {};
        return {
          ...m,
          completionReport: {
            ...report,
            status: "pending",
            rejectReason: "",
          },
        };
      });
      map[threadId] = next;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }

    try {
      const raw = global.localStorage.getItem("tasful_platform_chat_fees_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      const list = (Array.isArray(parsed) ? parsed : []).filter((row) => {
        const phase = pickStr(row.feePhase, row.fee_phase);
        return !(String(row.dealId || row.deal_id) === key && phase === "on_complete");
      });
      global.localStorage.setItem("tasful_platform_chat_fees_v1", JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function resetConnectCompleteDemo(notifyId) {
    const spec = NOTIFY_SPECS[notifyId];
    if (!spec) return { ok: false, reason: "unknown_notify" };
    resetCompletionState(spec.dealId);
    const ensured = global.TasuPlatformChatCompletion?.ensureDemoDealThread?.(spec.dealId);
    return { ok: Boolean(ensured?.ok), notifyId, dealId: spec.dealId, ensured };
  }

  function ensureConnectCompleteDemos() {
    try {
      if (global.localStorage.getItem(BOOT_MARKER) === "1") return [];
    } catch {
      /* ignore */
    }
    const results = [];
    Object.keys(NOTIFY_SPECS).forEach((notifyId) => {
      results.push(resetConnectCompleteDemo(notifyId));
    });
    try {
      global.localStorage.setItem(BOOT_MARKER, "1");
    } catch {
      /* ignore */
    }
    return results;
  }

  global.TasuPlatformChatConnectDemoSeed = {
    BOOT_MARKER,
    NOTIFY_SPECS,
    resetConnectCompleteDemo,
    ensureConnectCompleteDemos,
  };
})(typeof window !== "undefined" ? window : globalThis);
