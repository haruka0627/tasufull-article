/**
 * TASFUL TALK — サブページ遷移（プロフィール / カレンダー / メモ）
 */
(function (global) {
  "use strict";

  const CONTEXT_KEY = "tasu_talk_sub_thread_v1";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function saveThreadContext(thread) {
    if (!thread?.id) return;
    const payload = {
      id: String(thread.id),
      partnerUserId: pickStr(thread.partnerUserId, thread.partner?.id),
      partnerProfile: thread.partnerProfile || null,
      partner: thread.partner || null,
      groupName: pickStr(thread.groupName),
      chatDomain: pickStr(thread.chatDomain),
      threadKind: pickStr(thread.threadKind, thread.thread_kind),
      _officialRoom: Boolean(thread._officialRoom),
      _staticCard: Boolean(thread._staticCard),
    };
    try {
      global.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function readThreadContext() {
    const params = new URLSearchParams(global.location?.search || "");
    const threadId = pickStr(params.get("thread"));
    try {
      const raw = global.sessionStorage.getItem(CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!threadId || String(parsed?.id) === threadId) return parsed;
      }
    } catch {
      /* ignore */
    }
    return threadId ? { id: threadId } : null;
  }

  function buildSubPageHref(page, options) {
    const threadId = pickStr(options?.threadId, options?.thread?.id);
    if (!threadId) return page;
    const url = new URL(page, global.location?.origin || undefined);
    url.searchParams.set("thread", threadId);
    url.searchParams.set("from", "talk");
    if (options?.view) url.searchParams.set("view", pickStr(options.view));
    if (options?.userId) url.searchParams.set("userId", pickStr(options.userId));
    return `${url.pathname}${url.search}`;
  }

  function buildBackToChatHref(threadId) {
    const id = pickStr(threadId, readThreadContext()?.id);
    if (!id) return "talk-home.html?tab=chat";
    return `talk-home.html?tab=chat&thread=${encodeURIComponent(id)}`;
  }

  function navigateToSubPage(page, options) {
    const thread = options?.thread || global.TasuTalkLineRoom?._activeThread || null;
    if (thread) saveThreadContext(thread);
    global.location.href = buildSubPageHref(page, {
      threadId: pickStr(options?.threadId, thread?.id),
      view: options?.view,
      userId: options?.userId,
    });
  }

  global.TasuTalkSubNav = {
    CONTEXT_KEY,
    saveThreadContext,
    readThreadContext,
    buildSubPageHref,
    buildBackToChatHref,
    navigateToSubPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
