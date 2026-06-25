/**
 * TASFUL LIVE — 動画コメント投稿 + 作成者通知
 * 本番: live-notify Edge（comment_created）
 * dev: tlvDevNotifications fallback（live_video_comments テーブル未整備時）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function getViewerId() {
    const dev = global.TasuTlvDevAuth;
    if (dev?.getTlvViewerTalkUserId) {
      return String(dev.getTlvViewerTalkUserId() || "").trim();
    }
    return String(C()?.getTalkUserId?.() || "").trim();
  }

  function shouldUseDevCommentFallback() {
    return Boolean(global.TasuTlvDevAuth?.shouldUseTlvNotifyLocalFallback?.());
  }

  function newCommentId() {
    return `dev-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 動画コメント投稿成功後に通知を作成
   * @param {{ videoId: string, creatorId: string, body: string, commentId?: string }} opts
   */
  async function postComment(opts) {
    const videoId = String(opts?.videoId || "").trim();
    const creatorId = String(opts?.creatorId || "").trim();
    const body = String(opts?.body || "").trim();
    const actorId = getViewerId();

    if (!actorId) throw new Error("ログインが必要です");
    if (!videoId || !creatorId) throw new Error("video_id / creator_id が不正です");
    if (!body) throw new Error("コメントを入力してください");

    if (actorId === creatorId) {
      return { ok: true, skipped: true, reason: "self_comment" };
    }

    const commentId = String(opts?.commentId || newCommentId()).trim();
    const actorName = C().resolveDisplayName(actorId);
    const actorAvatar = C().resolveAvatarUrl?.(actorId) || "";

    const notify =
      global.TasuTlvNotificationService?.createCommentNotification ||
      global.TasuLiveNotify?.notifyCreatorOnComment;

    if (!notify) {
      return { ok: false, reason: "notify_unavailable" };
    }

    const result = global.TasuTlvNotificationService?.createCommentNotification
      ? await global.TasuTlvNotificationService.createCommentNotification({
          videoId,
          commentId,
          creatorId,
          actorId,
          actorName,
          actorAvatar,
        })
      : await global.TasuLiveNotify.notifyCreatorOnComment({
          videoId,
          commentId,
          creatorId,
          actorId,
          actorName,
        });

    return {
      ok: Boolean(result?.ok),
      commentId,
      body,
      notify: result,
    };
  }

  function canPostDevComment() {
    return shouldUseDevCommentFallback() && Boolean(getViewerId());
  }

  global.TasuLiveVideoComments = {
    getViewerId,
    shouldUseDevCommentFallback,
    canPostDevComment,
    postComment,
    newCommentId,
  };
})(typeof window !== "undefined" ? window : globalThis);
