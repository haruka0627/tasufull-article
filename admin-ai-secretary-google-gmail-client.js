/**
 * AI秘書 Phase 6-C — Gmail read-only client (Edge proxy only)
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    unread: "is:unread in:inbox",
    important: "is:important in:inbox",
    attachment: "has:attachment in:inbox",
    inbox: "in:inbox",
  });

  function postGmail(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "gmail", ...payload });
  }

  async function listMessages(options) {
    options = options || {};
    const q = String(options.q || options.presetQuery || PRESETS[options.preset] || "").trim();
    const result = await postGmail({
      method: "messages.list",
      q: q || undefined,
      maxResults: options.maxResults || 10,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function getMessage(messageId) {
    return postGmail({ method: "messages.get", messageId: String(messageId || "") });
  }

  async function getThread(threadId) {
    return postGmail({ method: "threads.get", threadId: String(threadId || "") });
  }

  async function listLabels() {
    return postGmail({ method: "labels.list" });
  }

  async function tryWriteBlocked(method) {
    return postGmail({ method: String(method || "messages.send") });
  }

  global.TasuSecretaryGoogleGmailClient = {
    PRESETS,
    listMessages,
    getMessage,
    getThread,
    listLabels,
    tryWriteBlocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
