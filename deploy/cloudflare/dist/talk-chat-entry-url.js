/**
 * TASFUL TALK — チャット入口 URL（P0: chat-list 統合）
 */
(function (global) {
  "use strict";

  const TALK_CHAT_TAB = "chat";

  /**
   * @param {{ threadId?: string, thread?: string, from?: string, baseUrl?: string }} [options]
   * @returns {string}
   */
  function buildTalkChatHubUrl(options) {
    const opts = options || {};
    const threadId = String(opts.threadId || opts.thread || "").trim();
    try {
      const base = opts.baseUrl || global.location?.href || "http://localhost/";
      const u = new URL("talk-home.html", base);
      u.searchParams.set("tab", TALK_CHAT_TAB);
      if (threadId) u.searchParams.set("thread", threadId);
      const from = String(opts.from || "").trim();
      if (from) u.searchParams.set("from", from);
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      let href = `talk-home.html?tab=${TALK_CHAT_TAB}`;
      if (threadId) href += `&thread=${encodeURIComponent(threadId)}`;
      const from = String(opts.from || "").trim();
      if (from) href += `&from=${encodeURIComponent(from)}`;
      return href;
    }
  }

  /** chat-list / chat-list.html（Pages の .html 除去後も一致） */
  function isChatListPathname(pathname) {
    return /\/chat-list(?:\.html)?\/?$/i.test(String(pathname || ""));
  }

  /** chat-list 互換リダイレクト（クエリ・hash 写経） */
  function redirectChatListToTalkHub() {
    if (!isChatListPathname(global.location?.pathname)) return;
    const params = new URLSearchParams(global.location.search);
    const threadId =
      params.get("thread") || params.get("roomId") || params.get("room") || "";
    const hash = String(global.location?.hash || "");
    let dest;
    try {
      dest = new URL(buildTalkChatHubUrl({ threadId }), global.location.href);
      params.forEach((value, key) => {
        if (key === "thread" || key === "roomId" || key === "room") return;
        if (!dest.searchParams.has(key)) dest.searchParams.set(key, value);
      });
    } catch {
      dest = new URL(buildTalkChatHubUrl({ threadId }), global.location.href);
    }
    global.location.replace(`${dest.pathname}${dest.search}${hash}`);
  }

  global.TasuTalkChatEntryUrl = {
    TALK_CHAT_TAB,
    buildTalkChatHubUrl,
    isChatListPathname,
    redirectChatListToTalkHub,
  };
})(typeof window !== "undefined" ? window : globalThis);
