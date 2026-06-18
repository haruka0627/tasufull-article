/**
 * TASFUL TALK — 通知詳細（スマホ: ボトムシート / PC: 中央モーダル）
 */
(function (global) {
  "use strict";

  const MOBILE_MQ = "(max-width: 960px)";
  let activeId = "";
  let ctx = {
    escapeHtml: (s) => String(s ?? ""),
    formatNotifyTime: () => "",
    onAction: null,
  };

  function isMobileViewport() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch {
      return false;
    }
  }

  function findNotification(id) {
    const nid = String(id || "").trim();
    if (!nid) return null;
    const row =
      global.TasuTalkData?.findNotificationById?.(nid) ||
      global.TasuTalkNotifications?.findById?.(nid);
    if (!row) return null;
    row.unread = global.TasuTalkNotifications?.isUnread?.(row) ?? !row.readAt;
    return row;
  }

  function getModal() {
    return document.querySelector("[data-talk-notify-detail]");
  }

  function priorityMeta(n) {
    const priorities = global.TasuTalkData?.PRIORITY_META || {};
    return priorities[n?.priority] || priorities.normal || { label: "通常", className: "" };
  }

  function typeMeta(n) {
    const types = global.TasuTalkData?.NOTIFICATION_TYPES || {};
    const key = String(n?.type || "system").toLowerCase();
    return types[key] || { label: key, tone: "slate" };
  }

  function renderOpsWatchBody(n) {
    const ops = global.TasuTalkOpsWatchNotifyUi;
    if (!ops?.isOpsWatchNotification?.(n)) return "";
    if (ops.renderDetailHtml) {
      return ops.renderDetailHtml(n);
    }
    return `<p class="talk-notify-detail__text">${ctx.escapeHtml(n.body || "")}</p>`;
  }

  function renderRelatedLink(n) {
    const url = String(n?.targetUrl || "").trim();
    if (!url || url === "#") {
      return `<p class="talk-notify-detail__empty-link">関連リンクはありません</p>`;
    }
    const href = global.TasuChatUserIdentity?.appendUserIdToUrl?.(url) || url;
    const safeHref = ctx.escapeHtml(href);
    const safeText = ctx.escapeHtml(url);
    return `<a class="talk-notify-detail__link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  }

  function renderDetailActions(n) {
    const nav = global.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(n);
    if (!nav?.href) return "";
    const href = global.TasuChatUserIdentity?.appendUserIdToUrl?.(nav.href) || nav.href;
    return `<div class="talk-notify-detail__actions" data-talk-notify-detail-actions>
      <a class="talk-notify-detail__action talk-notify-detail__action--primary" href="${ctx.escapeHtml(href)}">${ctx.escapeHtml(nav.label || "詳細を見る")}</a>
    </div>`;
  }

  function renderBodyHtml(n) {
    const meta = typeMeta(n);
    const prio = priorityMeta(n);
    const opsBody = renderOpsWatchBody(n);
    const bodyContent = opsBody
      ? `<div class="talk-notify-detail__ops">${opsBody}</div>`
      : `<p class="talk-notify-detail__text">${ctx.escapeHtml(n.body || "")}</p>`;

    return `
      <dl class="talk-notify-detail__meta-grid">
        <div class="talk-notify-detail__meta-row">
          <dt>種別</dt>
          <dd><span class="talk-notify-card__type talk-notify-card__type--${ctx.escapeHtml(meta.tone || "slate")}">${ctx.escapeHtml(meta.label)}</span></dd>
        </div>
        <div class="talk-notify-detail__meta-row">
          <dt>重要度</dt>
          <dd><span class="talk-notify-priority ${ctx.escapeHtml(prio.className || "")}">${ctx.escapeHtml(prio.label)}</span></dd>
        </div>
        <div class="talk-notify-detail__meta-row">
          <dt>作成日時</dt>
          <dd><time datetime="${ctx.escapeHtml(n.createdAt || "")}">${ctx.escapeHtml(ctx.formatNotifyTime(n.createdAt))}</time></dd>
        </div>
        ${
          n.source
            ? `<div class="talk-notify-detail__meta-row"><dt>ソース</dt><dd>${ctx.escapeHtml(n.source)}</dd></div>`
            : ""
        }
      </dl>
      <section class="talk-notify-detail__section" aria-labelledby="talkNotifyDetailBodyLabel">
        <h4 id="talkNotifyDetailBodyLabel" class="talk-notify-detail__section-title">本文</h4>
        ${bodyContent}
      </section>
      <section class="talk-notify-detail__section" aria-labelledby="talkNotifyDetailLinkLabel">
        <h4 id="talkNotifyDetailLinkLabel" class="talk-notify-detail__section-title">関連リンク</h4>
        ${renderRelatedLink(n)}
      </section>
      ${renderDetailActions(n)}`;
  }

  function open(notificationOrId) {
    const id =
      typeof notificationOrId === "string"
        ? notificationOrId
        : String(notificationOrId?.id || "").trim();
    const n = typeof notificationOrId === "object" && notificationOrId ? notificationOrId : findNotification(id);
    if (!n?.id) return false;

    if (
      global.TasuTalkOpsWatchNotifyUi?.isOpsWatchNotification?.(n) &&
      !isMobileViewport() &&
      global.TasuTalkOpsWatchNotifyUi.openDetailModal?.(n)
    ) {
      activeId = n.id;
      global.TasuTalkData?.markNotificationRead?.(n.id);
      return true;
    }

    const modal = getModal();
    if (!modal) return false;

    activeId = n.id;
    const titleEl = modal.querySelector("[data-talk-notify-detail-title]");
    const bodyEl = modal.querySelector("[data-talk-notify-detail-body]");
    if (titleEl) titleEl.textContent = String(n.title || "通知詳細");
    if (bodyEl) bodyEl.innerHTML = renderBodyHtml(n);

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.toggle("talk-notify-detail--sheet", isMobileViewport());
    modal.classList.toggle("talk-notify-detail--modal", !isMobileViewport());
    document.body.classList.add("talk-notify-detail-open");
    return true;
  }

  function close() {
    const modal = getModal();
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("talk-notify-detail-open");
    activeId = "";
    const bodyEl = modal.querySelector("[data-talk-notify-detail-body]");
    if (bodyEl) bodyEl.innerHTML = "";
  }

  function getActiveId() {
    return activeId;
  }

  function init(options) {
    ctx = { ...ctx, ...(options || {}) };
    const modal = getModal();
    if (!modal || modal.dataset.notifyDetailWired) return;
    modal.dataset.notifyDetailWired = "1";

    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-talk-notify-detail-close]")) {
        e.preventDefault();
        close();
        return;
      }
      const btn = e.target instanceof Element ? e.target.closest("[data-talk-notify-detail-action]") : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const actionId = btn.getAttribute("data-talk-notify-detail-action");
      const notifyId = btn.getAttribute("data-talk-notify-id");
      const confirmMsg = btn.getAttribute("data-talk-notify-action-confirm");
      if (confirmMsg && !global.confirm(confirmMsg)) return;
      if (typeof ctx.onAction === "function") {
        ctx.onAction(actionId, notifyId, { fromDetail: true });
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!activeId || modal.hidden) return;
      close();
    });

    global.addEventListener?.("resize", () => {
      if (!activeId || modal.hidden) return;
      modal.classList.toggle("talk-notify-detail--sheet", isMobileViewport());
      modal.classList.toggle("talk-notify-detail--modal", !isMobileViewport());
    });
  }

  global.TasuTalkNotifyDetail = {
    init,
    open,
    close,
    getActiveId,
    isMobileViewport,
    findNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
