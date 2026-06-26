/**
 * TASFUL TALK — プロフィール専用ページ
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

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function resolveDisplayName(ctx) {
    return pickStr(ctx?.groupName, ctx?.partnerProfile?.display_name, ctx?.partner?.displayName, "ユーザー");
  }

  function isSocialThread(ctx) {
    if (!ctx || ctx._officialRoom || ctx._staticCard) return false;
    return ctx.chatDomain === "friend";
  }

  function renderProfile(ctx) {
    const root = $("[data-talk-profile-root]");
    const sub = $("[data-talk-profile-subtitle]");
    if (!root || !ctx?.id) {
      if (root) root.innerHTML = `<p class="talk-sub-page__empty">トーク情報が見つかりません。</p>`;
      return;
    }

    const profile = ctx.partnerProfile || {};
    const displayName = resolveDisplayName(ctx);
    if (sub) sub.textContent = displayName;

    const Safety = global.TasuTalkRoomSafetyStore;
    const Memo = global.TasuTalkFriendMemoStore;
    const targetKey = Safety?.resolveTargetKey?.(ctx) || ctx.id;
    const social = isSocialThread(ctx);
    const memoText = social ? Memo?.getMemo?.(profile.user_id ? profile : ctx) || "" : "";

    const avatarHtml =
      global.TasuTalkChatProfile?.renderAvatarHtml?.({
        profile,
        size: 72,
        className: "talk-profile-modal__avatar",
        escapeHtml,
      }) || "";

    const userId = pickStr(profile.user_id, ctx.partnerUserId);
    const publicHref = userId
      ? global.TasuTalkChatThreadModel?.profilePageHref?.(userId) ||
        `profile-public.html?userId=${encodeURIComponent(userId)}`
      : "";

    const safetyBlock =
      social && Safety
        ? `
      <div class="talk-profile-modal__safety">
        <p class="talk-profile-modal__safety-title">安全・管理</p>
        <div class="talk-profile-modal__safety-actions">
          <button type="button" class="talk-ai-action talk-ai-action--muted" data-talk-profile-safety="pin">${Safety.isPinned(targetKey) ? "ピン留め解除" : "ピン留め"}</button>
          <button type="button" class="talk-ai-action talk-ai-action--muted" data-talk-profile-safety="mute">${Safety.isMuted(targetKey) ? "ミュート解除" : "ミュート"}</button>
          <button type="button" class="talk-ai-action talk-ai-action--muted" data-talk-profile-safety="block">${Safety.isBlocked(targetKey) ? "ブロック解除" : "ブロック"}</button>
          <a class="talk-ai-action talk-ai-action--muted" href="${escapeHtml(global.TasuTalkSubNav?.buildSubPageHref?.("talk-memo.html", { threadId: ctx.id }) || "#")}">メモ</a>
        </div>
        ${memoText ? `<p class="talk-profile-modal__memo-preview"><span>メモ:</span> ${escapeHtml(memoText.slice(0, 120))}${memoText.length > 120 ? "…" : ""}</p>` : ""}
      </div>`
        : "";

    root.innerHTML = `
      <div class="talk-profile-modal__hero">${avatarHtml}</div>
      <p class="talk-profile-modal__name">${escapeHtml(displayName)}</p>
      ${profile.status_message ? `<p class="talk-profile-modal__status">${escapeHtml(profile.status_message)}</p>` : ""}
      <dl class="talk-profile-modal__meta">
        ${profile.category ? `<dt>カテゴリ</dt><dd>${escapeHtml(profile.category)}</dd>` : ""}
        ${profile.location ? `<dt>地域</dt><dd>${escapeHtml(profile.location)}</dd>` : ""}
        ${
          profile.review_count > 0
            ? `<dt>評価</dt><dd>★${escapeHtml(profile.rating)}（${escapeHtml(profile.review_count)}件）</dd>`
            : ""
        }
      </dl>
      ${publicHref ? `<div class="talk-sub-page__link-row"><a class="talk-ai-action talk-ai-action--primary" href="${escapeHtml(publicHref)}">公開プロフィール</a></div>` : ""}
      ${safetyBlock}`;

    root.querySelectorAll("[data-talk-profile-safety]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-talk-profile-safety");
        if (action === "pin") Safety?.togglePinned?.(targetKey);
        if (action === "mute") Safety?.toggleMuted?.(targetKey);
        if (action === "block") Safety?.toggleBlocked?.(targetKey);
        renderProfile(ctx);
      });
    });
  }

  function init() {
    const ctx = global.TasuTalkSubNav?.readThreadContext?.();
    const back = document.querySelector("[data-talk-sub-back]");
    const backHref = global.TasuTalkSubNav?.buildBackToChatHref?.(ctx?.id);
    if (back && backHref) back.setAttribute("href", backHref);
    renderProfile(ctx);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
