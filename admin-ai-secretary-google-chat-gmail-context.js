/**
 * AI秘書 Phase 3b/3c — Chat Gmail list context (delegates to unified Context v2)
 */
(function (global) {
  "use strict";

  const Unified = () => global.TasuSecretaryGoogleChatContext;

  const STORAGE_KEY = "tasu_secretary_chat_gmail_ctx_v1";
  const TTL_MS = 15 * 60 * 1000;

  function saveList(messages, meta) {
    const U = Unified();
    if (U?.saveGmailList) {
      return U.saveGmailList(messages, meta);
    }
    return null;
  }

  function getContext() {
    const U = Unified();
    if (U?.getGmailListMeta) {
      return U.getGmailListMeta();
    }
    return null;
  }

  function getByIndex(n) {
    const U = Unified();
    if (U?.getGmailListItem) {
      return U.getGmailListItem(n);
    }
    return null;
  }

  function getLast() {
    const U = Unified();
    if (U?.getGmailListFirst) {
      return U.getGmailListFirst();
    }
    return null;
  }

  function hasContext() {
    const U = Unified();
    if (U?.hasGmailList) {
      return U.hasGmailList();
    }
    return false;
  }

  function clear() {
    const U = Unified();
    if (U?.clear) {
      U.clear();
    }
  }

  global.TasuSecretaryGoogleChatGmailContext = {
    STORAGE_KEY,
    TTL_MS,
    saveList,
    getContext,
    getByIndex,
    getLast,
    hasContext,
    clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
