/**
 * TASFUL TALK — 利用者サポートルーム（チャット内導線）
 */
(function (global) {
  "use strict";

  const SUPPORT_ROOM_ID = "talk-hub-support";
  const INTAKE_PATH = "support-intake.html";

  function isSupportRoomId(id) {
    return String(id || "") === SUPPORT_ROOM_ID;
  }

  function resolveIntakeUrl() {
    const base = INTAKE_PATH;
    return global.TasuChatUserIdentity?.appendUserIdToUrl?.(base) || base;
  }

  function getRoomMessages() {
    return [
      {
        id: "support_welcome_v1",
        senderId: "__tasful_support__",
        senderName: "TASFULサポート",
        text:
          "TASFULサポートです。\n\nお問い合わせやトラブル相談はこちらからご連絡ください。\n\nご質問内容に応じてAIまたは運営が対応します。",
        createdAt: new Date().toISOString(),
        kind: "user",
      },
    ];
  }

  function renderExtrasHtml(escapeHtml) {
    const esc = escapeHtml || ((s) => String(s ?? ""));
    return (
      `<div class="talk-support-room-extras">` +
      `<div class="talk-support-room-extras__actions">` +
      `<button type="button" class="talk-support-room-extras__cta" data-talk-support-new-inquiry>新しい問い合わせ</button>` +
      `</div>` +
      `<section class="talk-support-room-extras__block" aria-label="お問い合わせ履歴">` +
      `<h3 class="talk-support-room-extras__title">お問い合わせ履歴</h3>` +
      `<p class="talk-support-room-extras__placeholder">${esc("現在お問い合わせはありません")}</p>` +
      `</section>` +
      `<section class="talk-support-room-extras__block" aria-label="運営からの返信">` +
      `<h3 class="talk-support-room-extras__title">運営からの返信</h3>` +
      `<p class="talk-support-room-extras__placeholder">${esc("返信はありません")}</p>` +
      `</section>` +
      `<section class="talk-support-room-extras__block" aria-label="対応状況">` +
      `<h3 class="talk-support-room-extras__title">対応状況</h3>` +
      `<p class="talk-support-room-extras__placeholder">${esc("進行中の案件はありません")}</p>` +
      `</section>` +
      `</div>`
    );
  }

  global.TasuTalkSupportRoom = {
    SUPPORT_ROOM_ID,
    INTAKE_PATH,
    isSupportRoomId,
    resolveIntakeUrl,
    getRoomMessages,
    renderExtrasHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
