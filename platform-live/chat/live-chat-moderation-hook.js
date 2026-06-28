/**
 * Live Platform Chat — Moderation Hook（MVP · interface のみ）
 * Phase D · allow | block | flag
 */
(function (global) {
  "use strict";

  /** @readonly */
  const MODERATION_ACTIONS = Object.freeze({
    ALLOW: "allow",
    BLOCK: "block",
    FLAG: "flag",
  });

  /**
   * デフォルト moderation hook — 常に allow
   * @param {{ surface: string, broadcastId: string, userId: string, text: string, messageId?: string }} _ctx
   * @returns {{ action: 'allow'|'block'|'flag', reason?: string }}
   */
  function defaultModerationHook(_ctx) {
    return { action: MODERATION_ACTIONS.ALLOW };
  }

  /**
   * @param {Function} hook
   * @returns {Function}
   */
  function createModerationHook(hook) {
    if (typeof hook !== "function") return defaultModerationHook;
    return (ctx) => {
      try {
        const result = hook(ctx);
        const action = String(result?.action || MODERATION_ACTIONS.ALLOW).trim().toLowerCase();
        if (action === MODERATION_ACTIONS.BLOCK || action === MODERATION_ACTIONS.FLAG || action === MODERATION_ACTIONS.ALLOW) {
          return { action, reason: result?.reason ? String(result.reason) : undefined };
        }
        return { action: MODERATION_ACTIONS.ALLOW };
      } catch {
        return { action: MODERATION_ACTIONS.ALLOW };
      }
    };
  }

  global.TasuLivePlatformChatModerationHook = Object.freeze({
    ACTIONS: MODERATION_ACTIONS,
    defaultModerationHook,
    createModerationHook,
  });
})(typeof window !== "undefined" ? window : globalThis);
