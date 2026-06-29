/**
 * TASFUL LIVE — ライブコメント（Phase 5 最小）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function isStubBroadcast(broadcast) {
    return global.TasuLiveBroadcasts?.isStubBroadcastId?.(broadcast?.id);
  }

  async function fetchMessages(broadcastId) {
    const cfg = C();
    if (global.TasuLiveBroadcasts?.isStubBroadcastId?.(broadcastId)) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcastMessages)
      .select("*")
      .eq("broadcast_id", broadcastId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return data || [];
  }

  async function insertMessage(broadcastId, message) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcastMessages)
      .insert({
        broadcast_id: broadcastId,
        sender_id: userId,
        message: String(message || "").trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteOwnMessage(messageId) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) throw new Error("ログインが必要です");
    await cfg.ensureSupabaseSession();
    const { error } = await cfg
      .getClient()
      .from(cfg.TABLES.broadcastMessages)
      .delete()
      .eq("id", messageId)
      .eq("sender_id", userId);
    if (error) throw error;
  }

  function renderMessage(msg, viewerId) {
    const cfg = C();
    const name = cfg.resolveDisplayName(msg.sender_id);
    const time = msg.created_at
      ? new Date(msg.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
      : "";
    const isOwn = viewerId && viewerId === msg.sender_id;
    return `
      <li class="live-comment" data-comment-id="${cfg.escapeHtml(msg.id)}">
        <div class="live-comment__head">
          <strong>${cfg.escapeHtml(name)}</strong>
          <time>${cfg.escapeHtml(time)}</time>
          ${isOwn ? `<button type="button" class="live-comment__delete" data-live-comment-delete aria-label="削除">×</button>` : ""}
        </div>
        <p class="live-comment__text">${cfg.escapeHtml(msg.message)}</p>
      </li>
    `;
  }

  function renderCommentsPanel(broadcast, messages, viewerId) {
    const cfg = C();
    const isLive = broadcast.status === "live";
    const isStub = isStubBroadcast(broadcast);
    const canPost = Boolean(viewerId) && isLive && !isStub;

    const list =
      messages.length > 0
        ? `<ul class="live-comments__list" data-live-comments-list>${messages.map((m) => renderMessage(m, viewerId)).join("")}</ul>`
        : '<p class="live-muted live-comments__empty">コメントはまだありません</p>';

    const form = canPost
      ? `
        <form class="live-comments__form" data-live-comments-form>
          <input class="live-input" type="text" name="message" maxlength="200" placeholder="コメント（200文字以内）" required data-live-comment-input />
          <button type="submit" class="live-btn live-btn--primary">送信</button>
        </form>
      `
      : `<p class="live-hint">${isStub ? "プレビュー配信ではコメント投稿は無効です" : isLive ? "ログインするとコメントできます" : "配信中のみコメント投稿できます"}</p>`;

    return `
      <section class="live-comments" data-live-comments>
        <h2 class="live-comments__title">コメント</h2>
        <div class="live-comments__body" data-live-comments-body>${list}</div>
        ${form}
      </section>
    `;
  }

  async function bindCommentForm(root, broadcast) {
    const cfg = C();
    const form = root.querySelector("[data-live-comments-form]");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("[data-live-comment-input]");
      const text = String(input?.value || "").trim();
      if (!text) return;

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await insertMessage(broadcast.id, text);
        if (input) input.value = "";
        await refreshComments(root, broadcast);
      } catch (err) {
        console.error("[TasuLiveComments]", err);
        global.alert(`コメント送信に失敗しました: ${err.message || err}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    root.querySelectorAll("[data-live-comment-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const li = btn.closest("[data-comment-id]");
        const id = li?.getAttribute("data-comment-id");
        if (!id) return;
        btn.disabled = true;
        try {
          await deleteOwnMessage(id);
          await refreshComments(root, broadcast);
        } catch (err) {
          global.alert(`削除に失敗しました: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    });
  }

  async function refreshComments(root, broadcast) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    const messages = await fetchMessages(broadcast.id);
    const body = root.querySelector("[data-live-comments-body]");
    if (body) {
      body.innerHTML =
        messages.length > 0
          ? `<ul class="live-comments__list" data-live-comments-list>${messages.map((m) => renderMessage(m, viewerId)).join("")}</ul>`
          : '<p class="live-muted live-comments__empty">コメントはまだありません</p>';
    }
    await bindCommentForm(root, broadcast);
  }

  async function mountComments(root, broadcast) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    let messages = [];
    try {
      if (!isStubBroadcast(broadcast)) {
        await cfg.ensureSupabaseSession();
        messages = await fetchMessages(broadcast.id);
      }
    } catch (err) {
      console.warn("[TasuLiveComments] fetch failed:", err.message || err);
    }

    root.innerHTML = renderCommentsPanel(broadcast, messages, viewerId);
    await bindCommentForm(root, broadcast);
  }

  global.TasuLiveComments = {
    fetchMessages,
    insertMessage,
    deleteOwnMessage,
    mountComments,
  };
})(typeof window !== "undefined" ? window : globalThis);
