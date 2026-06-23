/**
 * TASFUL LIVE — ギフト UI（Phase 6 stub）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function readPageParams() {
    const params = new URLSearchParams(global.location?.search || "");
    return {
      broadcastId: String(params.get("broadcast_id") || params.get("id") || "").trim(),
      creatorUserId: String(params.get("creator_user_id") || params.get("creator_id") || "").trim(),
    };
  }

  function renderGiftCard(gift, selected) {
    const cfg = C();
    return `
      <label class="live-gift-card ${selected ? "is-selected" : ""}">
        <input type="radio" name="gift_id" value="${cfg.escapeHtml(gift.id)}" ${selected ? "checked" : ""} />
        <span class="live-gift-card__emoji" aria-hidden="true">${gift.emoji}</span>
        <span class="live-gift-card__name">${cfg.escapeHtml(gift.name)}</span>
        <span class="live-gift-card__price">¥${gift.priceYen.toLocaleString("ja-JP")}</span>
      </label>
    `;
  }

  async function mountGiftsPage(root) {
    const cfg = C();
    const viewerId = cfg.getTalkUserId();
    const { broadcastId, creatorUserId } = readPageParams();

    if (!broadcastId || !creatorUserId) {
      root.innerHTML = '<p class="live-error">broadcast_id と creator_user_id が必要です。</p>';
      return;
    }
    if (!viewerId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }
    if (viewerId === creatorUserId) {
      root.innerHTML = '<p class="live-error">自分自身への投げ銭はできません。</p>';
      return;
    }

    const gifts = cfg.LIVE_P0_GIFTS;
    const creatorName = cfg.resolveDisplayName(creatorUserId);
    const watchBack = cfg.watchUrl(broadcastId) + (cfg.isTalkDevStubMode() ? (cfg.watchUrl(broadcastId).includes("?") ? "&" : "?") + "talkDev=1" : "");
    const watchHref = broadcastId
      ? `watch.html?broadcast_id=${encodeURIComponent(broadcastId)}${cfg.isTalkDevStubMode() ? "&talkDev=1" : ""}`
      : "index.html";

    root.innerHTML = `
      <div class="live-gifts" data-live-gifts>
        <section class="live-panel live-panel--notice">
          <p class="live-hint"><strong>stub決済 / テスト用</strong> — 実決済・Stripe 連携なし（2026年9月以降予定）</p>
          <p class="live-hint">配信: ${cfg.escapeHtml(broadcastId)} · クリエイター: ${cfg.escapeHtml(creatorName)}</p>
        </section>
        <form class="live-gifts-form" data-live-gifts-form>
          <section class="live-panel">
            <h2 class="live-panel__title">ギフトを選ぶ</h2>
            <div class="live-gifts-grid">
              ${gifts.map((g, i) => renderGiftCard(g, i === 0)).join("")}
            </div>
          </section>
          <section class="live-panel">
            <label class="live-field">
              <span class="live-field__label">メッセージ（任意 · 100文字以内）</span>
              <input class="live-input" type="text" name="message" maxlength="100" placeholder="応援メッセージ" />
            </label>
          </section>
          <div class="live-settings-form__actions">
            <button type="submit" class="live-btn live-btn--primary">stub で送る</button>
            <a class="live-btn live-btn--ghost" href="${cfg.escapeHtml(watchHref)}">視聴に戻る</a>
            <a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">応援履歴</a>
          </div>
          <p class="live-form-status" data-live-gifts-status role="status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const form = root.querySelector("[data-live-gifts-form]");
    const statusEl = root.querySelector("[data-live-gifts-status]");

    root.querySelectorAll(".live-gift-card input").forEach((input) => {
      input.addEventListener("change", () => {
        root.querySelectorAll(".live-gift-card").forEach((card) => card.classList.remove("is-selected"));
        input.closest(".live-gift-card")?.classList.add("is-selected");
      });
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "送信中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const giftId = String(fd.get("gift_id") || "").trim();
      const gift = cfg.LIVE_P0_GIFTS.find((g) => g.id === giftId);
      const message = String(fd.get("message") || "").trim();

      if (!gift) {
        statusEl.textContent = "ギフトを選択してください";
        statusEl.className = "live-form-status live-form-status--error";
        return;
      }

      try {
        await global.TasuLiveTips.insertTip({
          creatorId: creatorUserId,
          broadcastId,
          gift,
          message,
        });
        statusEl.textContent = `${gift.name} を送信しました（stub）`;
        statusEl.className = "live-form-status live-form-status--ok";
      } catch (err) {
        console.error("[TasuLiveGifts]", err);
        statusEl.textContent = `送信に失敗しました: ${err.message || err}`;
        statusEl.className = "live-form-status live-form-status--error";
      }
    });
  }

  global.TasuLiveGifts = {
    mountGiftsPage,
    readPageParams,
  };
})(typeof window !== "undefined" ? window : globalThis);
