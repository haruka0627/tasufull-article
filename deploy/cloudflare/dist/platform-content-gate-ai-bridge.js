/**
 * Platform NB-1M — Content Gate → タスフルAI / AI秘書 通知ブリッジ
 * UI 変更なし · CustomEvent 購読のみ
 */
(function (global) {
  "use strict";

  const CRITICAL_TYPES = new Set([
    "moderation.blocked",
    "contact_leak_attempt",
  ]);

  const REVIEW_TYPES = new Set([
    "moderation.needs_review",
    "listing.pending_review",
    "listing.flagged",
    "shop.pending_review",
    "shop.flagged",
    "review.flagged",
    "attachment.unscanned",
    "attachment.flagged",
  ]);

  const AUTO_CLEARED_TYPES = new Set(["moderation.auto_cleared", "listing.approved_auto"]);

  function inboxStore() {
    return global.TasuAdminAiDailyInbox || global.TasuAdminAiOpsWatch || null;
  }

  function pushSecretarySignal(payload) {
    const type = String(payload?.type || "").trim();
    const severity = CRITICAL_TYPES.has(type)
      ? "critical"
      : AUTO_CLEARED_TYPES.has(type)
        ? "info"
        : REVIEW_TYPES.has(type)
          ? "warning"
          : "info";

    const signal = {
      id: `cg-bridge-${Date.now().toString(36)}`,
      event_id: `cg-${type}-${Date.now().toString(36)}`,
      source: "platform_content_gate",
      type,
      severity,
      title: bridgeTitle(type, payload),
      body: bridgeBody(payload),
      at: payload?.at || new Date().toISOString(),
      flags: payload?.flags || [],
      surface: payload?.surface || null,
      target_id: payload?.target_id || payload?.listing_id || null,
      target_type: payload?.target_type || payload?.surface || null,
      moderation_status:
        payload?.moderation_status ||
        (CRITICAL_TYPES.has(type) ? "blocked" : REVIEW_TYPES.has(type) ? "pending_review" : "approved"),
      meta: payload,
    };

    const enriched = global.TasuPlatformOpsActionUrl?.enrichSignal?.(signal) || signal;
    Object.assign(signal, {
      target_type: enriched.target_type,
      target_id: enriched.target_id,
      moderation_status: enriched.moderation_status,
      action_url: enriched.action_url,
    });

    try {
      global.dispatchEvent?.(
        new CustomEvent("tasu:moderation-signal", { detail: signal })
      );
    } catch {
      /* ignore */
    }

    const Log = global.TasuPlatformModerationLog;
    if (Log?.recordModeration) {
      Log.recordModeration({
        target_type: payload?.surface || "content_gate",
        target_id: payload?.target_id || payload?.listing_id || null,
        verdict:
          type === "moderation.blocked" || type === "contact_leak_attempt"
            ? "block"
            : REVIEW_TYPES.has(type)
              ? "needs_review"
              : "allow",
        flags: payload?.flags || [],
        reasons: payload?.reasons || [],
        severity,
        surface: payload?.surface,
        meta: { event_type: type, bridge: true },
      });
    }

    const bridge = global.TasuPlatformOpsInboxBridge;
    if (bridge?.pushExternalSignal) {
      bridge.pushExternalSignal(signal);
      return;
    }

    const inbox = inboxStore();
    if (inbox?.pushExternalSignal) {
      inbox.pushExternalSignal(signal);
    } else if (inbox?.recordExternalEvent) {
      inbox.recordExternalEvent(signal);
    }
  }

  function bridgeTitle(type, payload) {
    if (type === "moderation.blocked") return "投稿ブロック — 危険な内容を検知";
    if (type === "contact_leak_attempt") return "連絡先流出の試行を検知";
    if (type === "attachment.unscanned") return "添付未審査 — 人手確認が必要";
    if (type === "moderation.auto_cleared") return "AI審査クリア — 自動公開可";
    if (type === "listing.flagged" || type === "listing.pending_review") {
      return "掲載審査 — 保留";
    }
    if (type === "shop.flagged" || type === "shop.pending_review") {
      return "Shop出品 — 保留";
    }
    if (type === "review.flagged") return "レビュー — 要確認";
    if (type === "moderation.needs_review") return "投稿 — 要確認";
    return `Content Gate: ${type}`;
  }

  function bridgeBody(payload) {
    const reasons = Array.isArray(payload?.reasons) ? payload.reasons.slice(0, 3).join("、") : "";
    const flags = Array.isArray(payload?.flags) ? payload.flags.slice(0, 5).join(", ") : "";
    return [reasons, flags ? `flags: ${flags}` : ""].filter(Boolean).join(" · ");
  }

  function onContentGate(event) {
    const detail = event?.detail;
    if (!detail?.type) return;
    pushSecretarySignal(detail);
  }

  function init() {
    global.addEventListener("tasu:content-gate", onContentGate);
  }

  global.TasuPlatformContentGateAiBridge = {
    init,
    pushSecretarySignal,
    onContentGate,
  };

  init();
})(typeof window !== "undefined" ? window : globalThis);
