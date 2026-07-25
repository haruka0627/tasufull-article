/**
 * TASFUL LIVE — ギフト UI（Payment Engine 接続 · gift tip）
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
        <span class="live-gift-card__price">${gift.coins.toLocaleString("ja-JP")} coin</span>
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
    const watchHref = broadcastId
      ? `watch.html?broadcast_id=${encodeURIComponent(broadcastId)}${cfg.isTalkDevStubMode() ? "&talkDev=1" : ""}`
      : "index.html";

    root.innerHTML = `
      <div class="live-gifts" data-live-gifts>
        <section class="live-panel live-panel--notice">
          <p class="live-hint"><strong>coin 消費（本番課金あり）</strong> — 保有 coin から消費されます</p>
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
            <button type="submit" class="live-btn live-btn--primary" data-live-gifts-submit>送信する</button>
            <a class="live-btn live-btn--ghost" href="${cfg.escapeHtml(watchHref)}">視聴に戻る</a>
            <a class="live-btn live-btn--ghost" href="${cfg.tipsUrl()}${cfg.isTalkDevStubMode() ? "?talkDev=1" : ""}">応援履歴</a>
          </div>
          <p class="live-form-status" data-live-gifts-status role="status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const form = root.querySelector("[data-live-gifts-form]");
    const statusEl = root.querySelector("[data-live-gifts-status]");
    const submitBtn = root.querySelector("[data-live-gifts-submit]");

    root.querySelectorAll(".live-gift-card input").forEach((input) => {
      input.addEventListener("change", () => {
        root.querySelectorAll(".live-gift-card").forEach((card) => card.classList.remove("is-selected"));
        input.closest(".live-gift-card")?.classList.add("is-selected");
      });
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (submitBtn) submitBtn.disabled = true;
      statusEl.textContent = "送信中…";
      statusEl.className = "live-form-status live-form-status--pending";

      const fd = new FormData(form);
      const giftId = String(fd.get("gift_id") || "").trim();
      const gift = cfg.LIVE_P0_GIFTS.find((g) => g.id === giftId);
      const message = String(fd.get("message") || "").trim();

      if (!gift) {
        statusEl.textContent = "ギフトを選択してください";
        statusEl.className = "live-form-status live-form-status--error";
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      try {
        await global.TasuLiveTips.insertTip({
          creatorId: creatorUserId,
          broadcastId,
          gift,
          message,
        });
        statusEl.textContent = `${gift.name} を送信しました（${gift.coins.toLocaleString("ja-JP")} coin）`;
        statusEl.className = "live-form-status live-form-status--ok";
      } catch (err) {
        console.error("[TasuLiveGifts]", err);
        const msg = resolveErrorMessage(err);
        statusEl.textContent = `送信に失敗しました: ${msg}`;
        statusEl.className = "live-form-status live-form-status--error";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function resolveErrorMessage(err) {
    if (!err) return "通信エラー";
    const msg = String(err?.message || err || "").toLowerCase();
    const code = String(err?.code || "").toUpperCase();

    if (code === "402" || msg.includes("insufficient") || msg.includes("残高不足") || msg.includes("coin_balance") || msg.includes("not enough")) {
      return "coin 残高が不足しています";
    }
    if (msg.includes("認証") || msg.includes("ログイン") || msg.includes("token") || msg.includes("jwt")) {
      return "認証が必要です";
    }
    if (msg.includes("400") || msg.includes("invalid_request") || msg.includes("required")) {
      return "リクエストが不正です";
    }
    if (msg.includes("429") || msg.includes("rate") || msg.includes("cap")) {
      return "送信制限に達しました";
    }
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("接続") || msg.includes("通信")) {
      return "通信に失敗しました";
    }
    return err?.message || "不明なエラー";
  }

  global.TasuLiveGifts = {
    mountGiftsPage,
    readPageParams,
  };
})(typeof window !== "undefined" ? window : globalThis);