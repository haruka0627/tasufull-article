/**
 * TASFUL LIVE — 投げ銭 insert / 履歴（Phase 6 stub）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  function newIdempotencyKey() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `tip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function resolveTargetId(broadcastId) {
    const cfg = C();
    const id = String(broadcastId || "").trim();
    if (global.TasuLiveBroadcasts?.isStubBroadcastId?.(id)) {
      return cfg.STUB_BROADCAST_TIP_TARGET_ID;
    }
    return id;
  }

  function formatTipMessage(giftName, userMessage) {
    const name = String(giftName || "").trim();
    const extra = String(userMessage || "").trim();
    if (!name) return extra || null;
    if (!extra) return `【${name}】`;
    return `【${name}】${extra}`;
  }

  async function insertTip({ creatorId, broadcastId, gift, message }) {
    const cfg = C();
    const tipperId = cfg.getTalkUserId();
    if (!tipperId) throw new Error("ログインが必要です");

    const creator = String(creatorId || "").trim();
    if (!creator) throw new Error("creator_user_id が必要です");
    if (tipperId === creator) throw new Error("自分自身への投げ銭はできません");

    const giftName = String(gift?.name || "").trim();
    const amountYen = Number(gift?.priceYen || 0);
    if (!giftName || amountYen <= 0) throw new Error("ギフトが不正です");

    await cfg.ensureSupabaseSession();

    const row = {
      tipper_id: tipperId,
      creator_id: creator,
      target_type: "broadcast",
      target_id: resolveTargetId(broadcastId),
      amount_yen: amountYen,
      message: formatTipMessage(giftName, message),
      payment_status: cfg.LIVE_TIP_PAYMENT_STATUS_STUB,
      idempotency_key: newIdempotencyKey(),
    };

    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.tips)
      .insert(row)
      .select("*")
      .single();

    if (error) throw error;

    if (global.TasuLiveNotify?.notifyTipCreated) {
      try {
        await global.TasuLiveNotify.notifyTipCreated({
          tipId: data.id,
          creatorId: creator,
          tipperName: cfg.resolveDisplayName(tipperId),
        });
      } catch (notifyErr) {
        console.warn("[TasuLiveTips] tip notify skipped:", notifyErr);
      }
    }

    return data;
  }

  async function fetchSentTips(limit = 50) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.tips)
      .select("*")
      .eq("tipper_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function fetchReceivedTips(limit = 50) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) return [];
    await cfg.ensureSupabaseSession();
    const { data, error } = await cfg
      .getClient()
      .from(cfg.TABLES.tips)
      .select("*")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  function resolveGiftLabel(tip) {
    const cfg = C();
    const fromMsg = cfg.parseGiftNameFromMessage(tip?.message);
    if (fromMsg) return fromMsg;
    const byPrice = cfg.giftByPriceYen(tip?.amount_yen);
    return byPrice?.name || "ギフト";
  }

  function renderTipRow(tip, mode) {
    const cfg = C();
    const giftName = resolveGiftLabel(tip);
    const gift = cfg.giftByPriceYen(tip.amount_yen);
    const emoji = gift?.emoji || "🎁";
    const when = tip.created_at
      ? new Date(tip.created_at).toLocaleString("ja-JP")
      : "—";
    const counterparty =
      mode === "sent"
        ? cfg.resolveDisplayName(tip.creator_id)
        : cfg.resolveDisplayName(tip.tipper_id);
    const counterLabel = mode === "sent" ? "クリエイター" : "送信者";

    return `
      <li class="live-tip-row">
        <div class="live-tip-row__icon" aria-hidden="true">${emoji}</div>
        <div class="live-tip-row__body">
          <p class="live-tip-row__gift">${cfg.escapeHtml(giftName)} · ¥${Number(tip.amount_yen || 0).toLocaleString("ja-JP")}</p>
          <p class="live-tip-row__meta">
            <span>${counterLabel}: ${cfg.escapeHtml(counterparty)}</span>
            <span>status: ${cfg.escapeHtml(tip.payment_status || "stub")}</span>
          </p>
          ${tip.message ? `<p class="live-tip-row__message">${cfg.escapeHtml(tip.message)}</p>` : ""}
          <time class="live-tip-row__time">${cfg.escapeHtml(when)}</time>
        </div>
      </li>
    `;
  }

  async function mountTipsPage(root) {
    const cfg = C();
    const userId = cfg.getTalkUserId();
    if (!userId) {
      root.innerHTML = '<p class="live-error">ログインが必要です。</p>';
      return;
    }

    root.innerHTML = '<p class="live-loading">応援履歴を読み込み中…</p>';

    try {
      await cfg.ensureSupabaseSession();
      const [sent, received] = await Promise.all([fetchSentTips(), fetchReceivedTips()]);

      const sentHtml = sent.length
        ? `<ul class="live-tips-list">${sent.map((t) => renderTipRow(t, "sent")).join("")}</ul>`
        : '<p class="live-muted">送った応援はまだありません</p>';

      const receivedHtml = received.length
        ? `<ul class="live-tips-list">${received.map((t) => renderTipRow(t, "received")).join("")}</ul>`
        : '<p class="live-muted">受け取った応援はまだありません</p>';

      root.innerHTML = `
        <p class="live-hint live-panel--notice" style="padding:12px;border-radius:12px;margin-bottom:16px">
          P0 stub 決済 · 実送金なし · provider は payment_status=<strong>stub</strong> で記録
        </p>
        <section class="live-panel">
          <h2 class="live-panel__title">送った応援</h2>
          ${sentHtml}
        </section>
        <section class="live-panel">
          <h2 class="live-panel__title">受け取った応援</h2>
          ${receivedHtml}
        </section>
      `;
    } catch (err) {
      console.error("[TasuLiveTips]", err);
      root.innerHTML = `<p class="live-error">読み込みに失敗しました: ${cfg.escapeHtml(err.message || err)}</p>`;
    }
  }

  global.TasuLiveTips = {
    insertTip,
    fetchSentTips,
    fetchReceivedTips,
    resolveGiftLabel,
    mountTipsPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
