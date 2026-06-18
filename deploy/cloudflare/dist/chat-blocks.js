/**
 * ブロック機能 — 定数・将来の一覧除外
 */
(function () {
  "use strict";

  const BLOCKED_SEND_MESSAGE = "ブロック中のため送信できません。";
  const BLOCKED_COMPOSER_MESSAGE = "このユーザーをブロック中です";
  const BLOCK_CONFIRM_BODY =
    "このユーザーをブロックしますか？ブロックすると、この相手からのメッセージは表示されにくくなり、あなたからの送信も制限されます。";

  // --- 将来: chat-list.js loadThreads 後に blocked room_id を除外 ---
  // async function filterThreadsExcludingBlocked(threads, userId) { ... }

  window.TasuChatBlocks = {
    BLOCKED_SEND_MESSAGE,
    BLOCKED_COMPOSER_MESSAGE,
    BLOCK_CONFIRM_BODY,
  };
})();
