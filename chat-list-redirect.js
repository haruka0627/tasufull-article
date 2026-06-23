/**
 * chat-list / chat-list.html → TASFUL TALK リダイレクト（P0）
 */
(function () {
  "use strict";
  const isChatList =
    window.TasuTalkChatEntryUrl?.isChatListPathname?.(window.location.pathname) ||
    /\/chat-list(?:\.html)?\/?$/i.test(String(window.location.pathname || ""));
  if (!isChatList) return;

  if (window.TasuTalkChatEntryUrl?.redirectChatListToTalkHub) {
    window.TasuTalkChatEntryUrl.redirectChatListToTalkHub();
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const thread =
    params.get("thread") || params.get("roomId") || params.get("room") || "";
  const hash = String(window.location.hash || "");
  let dest = "talk-home.html?tab=chat";
  if (thread) dest += `&thread=${encodeURIComponent(thread)}`;
  window.location.replace(dest + hash);
})();
