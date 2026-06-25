/**
 * TLV — localhost 限定 system 通知送信フォーム（dev）
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mountSystemNotifyDevForm(root) {
    if (!root) return;
    const dev = global.TasuTlvDevAuth;
    if (!dev?.isLocalTlvDevHost?.()) {
      root.innerHTML = '<p class="live-error">このページは localhost / 127.0.0.1 でのみ利用できます。</p>';
      return;
    }

    root.innerHTML = `
      <div class="tlv-system-notify-dev">
        <header class="tlv-system-notify-dev__head">
          <h1 class="tlv-system-notify-dev__title">System 通知送信（dev）</h1>
          <p class="tlv-system-notify-dev__sub">localhost 限定 · tlvDevNotifications へ保存</p>
        </header>
        <form class="live-upload-form tlv-system-notify-dev__form" data-tlv-system-notify-form novalidate>
          <label class="live-form-field">
            <span class="live-form-label">targetUserId</span>
            <input class="live-input" name="targetUserId" value="u_me" required />
          </label>
          <label class="live-form-field">
            <span class="live-form-label">title</span>
            <input class="live-input" name="title" value="メンテナンスのお知らせ" required />
          </label>
          <label class="live-form-field">
            <span class="live-form-label">body</span>
            <textarea class="live-input live-textarea" name="body" rows="4">6/25 02:00–04:00 にメンテナンスを実施します。</textarea>
          </label>
          <label class="live-form-field">
            <span class="live-form-label">priority</span>
            <select class="live-select" name="priority">
              <option value="normal">normal</option>
              <option value="high">high</option>
            </select>
          </label>
          <label class="live-form-field">
            <span class="live-form-label">targetUrl</span>
            <input class="live-input" name="targetUrl" value="settings.html" />
          </label>
          <button type="submit" class="live-btn live-btn--primary">送信</button>
          <p class="live-form-status" data-tlv-system-notify-status role="status" aria-live="polite"></p>
        </form>
        <p class="tlv-system-notify-dev__links"><a href="notifications.html?talkDev=1">通知一覧へ</a></p>
      </div>`;

    const form = root.querySelector("[data-tlv-system-notify-form]");
    const statusEl = root.querySelector("[data-tlv-system-notify-status]");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (statusEl) statusEl.textContent = "送信中…";
      const fd = new FormData(form);
      try {
        const result = await global.TasuTlvNotificationService.createSystemNotification({
          targetUserId: String(fd.get("targetUserId") || "").trim(),
          title: String(fd.get("title") || "").trim(),
          body: String(fd.get("body") || "").trim(),
          priority: String(fd.get("priority") || "normal").trim(),
          targetUrl: String(fd.get("targetUrl") || "#").trim(),
        });
        if (statusEl) {
          statusEl.textContent = result?.ok
            ? `送信完了 id=${esc(result.id || result.timestamp || "ok")}`
            : `送信スキップ: ${esc(result?.reason || "unknown")}`;
          statusEl.className = result?.ok
            ? "live-form-status live-form-status--ok"
            : "live-form-status live-form-status--error";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = `送信失敗: ${err.message || err}`;
          statusEl.className = "live-form-status live-form-status--error";
        }
      }
    });
  }

  global.TasuTlvSystemNotifyDev = { mountSystemNotifyDevForm };
})(typeof window !== "undefined" ? window : globalThis);
