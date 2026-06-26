/**
 * TASFUL TALK — 友達メモ専用ページ
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

  function $(sel) {
    return document.querySelector(sel);
  }

  function resolveDisplayName(ctx) {
    return pickStr(ctx?.groupName, ctx?.partnerProfile?.display_name, ctx?.partner?.displayName, "友達");
  }

  function init() {
    const ctx = global.TasuTalkSubNav?.readThreadContext?.();
    const Memo = global.TasuTalkFriendMemoStore;
    const backHref = global.TasuTalkSubNav?.buildBackToChatHref?.(ctx?.id);

    const back = $("[data-talk-sub-back]");
    const backLink = $("[data-talk-sub-back-link]");
    if (back && backHref) back.setAttribute("href", backHref);
    if (backLink && backHref) backLink.setAttribute("href", backHref);

    const peer = $("[data-talk-memo-peer]");
    if (peer) peer.textContent = ctx?.id ? `対象: ${resolveDisplayName(ctx)}` : "";

    const input = $("[data-talk-memo-input]");
    if (input && Memo && ctx) {
      input.value = Memo.getMemo(ctx.partnerProfile || ctx) || "";
    }

    $("[data-talk-memo-save]")?.addEventListener("click", () => {
      if (!Memo || !ctx) return;
      Memo.saveMemo(ctx.partnerProfile || ctx, input?.value || "");
      if (backHref) global.location.href = backHref;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
