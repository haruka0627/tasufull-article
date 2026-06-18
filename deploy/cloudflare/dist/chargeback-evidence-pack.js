/**
 * チャージバック証拠パック（Stripe 提出は行わない・管理者確認用）
 */
(function (global) {
  "use strict";

  const PACKS_KEY = "tasu_chargeback_evidence_packs_v1";

  function readPacks() {
    try {
      const raw = localStorage.getItem(PACKS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function savePack(pack) {
    const list = readPacks();
    list.unshift(pack);
    localStorage.setItem(PACKS_KEY, JSON.stringify(list.slice(0, 200)));
    try {
      global.dispatchEvent(new CustomEvent("tasu:chargeback-evidence-pack-created", { detail: pack }));
    } catch {
      /* ignore */
    }
    return pack;
  }

  function formatChat(messages) {
    if (!Array.isArray(messages) || !messages.length) return "（チャット履歴なし）";
    return messages
      .map((m) => {
        const t = m.createdAt || m.created_at || "";
        const who = m.senderName || m.sender_name || m.senderId || "—";
        const text = m.text || m.body || "";
        return `[${t}] ${who}: ${text}`;
      })
      .join("\n");
  }

  function buildStripeSubmissionSummary(pack) {
    return (
      `【TASFUL チャージバック証拠サマリー（手動提出用・下書き）】\n` +
      `取引ID: ${pack.transaction_id || "—"}\n` +
      `注文ID: ${pack.order_id || "—"} / 案件ID: ${pack.project_id || "—"}\n` +
      `決済日時: ${pack.payment_at || "—"} / 金額: ${pack.amount || "—"}\n` +
      `購入者: ${pack.buyer?.name || "—"} (${pack.buyer?.id || "—"})\n` +
      `出品者: ${pack.seller?.name || "—"} (${pack.seller?.id || "—"})\n` +
      `サービス提供: ${pack.delivery_summary || "—"}\n` +
      `規約同意: ${pack.terms_consent || "—"}\n` +
      `キャンセル規約: ${pack.cancel_policy || "—"}\n` +
      `返金ポリシー: ${pack.refund_policy || "—"}\n` +
      `運営メモ: ${pack.admin_note || "—"}\n` +
      `AI要約: ${pack.ai_summary || "—"}\n` +
      `---\n` +
      `※ 本テキストは運営確認用です。Stripe への自動提出は行っていません。管理者が内容を確認のうえ手動で提出してください。`
    );
  }

  function buildEvidencePack(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const now = new Date().toISOString();
    const id = `cbpack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const chatMessages = ctx.chat_messages || ctx.chatMessages || [];
    const pack = {
      id,
      created_at: now,
      dispute_id: ctx.dispute_id || ctx.stripe_dispute_id || null,
      transaction_id: ctx.transaction_id || ctx.payment_intent_id || ctx.charge_id || null,
      order_id: ctx.order_id || ctx.related_order_id || null,
      project_id: ctx.project_id || ctx.related_project_id || null,
      payment_at: ctx.payment_at || ctx.created_at || null,
      amount: ctx.amount || ctx.amount_display || null,
      currency: ctx.currency || "jpy",
      buyer: {
        id: ctx.buyer_id || ctx.user_id || null,
        name: ctx.buyer_name || null,
        email: ctx.buyer_email || null,
      },
      seller: {
        id: ctx.seller_id || ctx.provider_id || null,
        name: ctx.seller_name || ctx.provider_name || null,
        stripe_account_id: ctx.stripe_account_id || ctx.related_stripe_account_id || null,
      },
      chat_transcript: formatChat(chatMessages),
      delivery_summary: ctx.delivery_summary || ctx.completion_note || "（納品・完了記録は運営が確認してください）",
      attachments: Array.isArray(ctx.attachments) ? ctx.attachments : [],
      terms_consent: ctx.terms_consent || "TASFUL 利用規約への同意（詳細は運営がログを確認）",
      cancel_policy: ctx.cancel_policy || "キャンセル規約（掲載・注文時の表示に準拠）",
      refund_policy: ctx.refund_policy || "返金は運営判断・Stripe ルールに従い手動対応",
      admin_note: ctx.admin_note || "",
      ai_summary:
        ctx.ai_summary ||
        "チャージバック案件 — チャット・納品記録・規約同意を照合し、管理者が Stripe 提出用エビデンスを確定してください。",
      stripe_submission_draft: "",
      admin_required: true,
      submitted_to_stripe: false,
      ticket_id: ctx.ticket_id || null,
      case_id: ctx.case_id || null,
    };

    pack.stripe_submission_draft = buildStripeSubmissionSummary(pack);
    return savePack(pack);
  }

  function getPack(id) {
    return readPacks().find((p) => p.id === id) || null;
  }

  function listPacks(filter) {
    let list = readPacks();
    if (filter?.ticket_id) list = list.filter((p) => p.ticket_id === filter.ticket_id);
    if (filter?.dispute_id) list = list.filter((p) => p.dispute_id === filter.dispute_id);
    return list;
  }

  global.TasuChargebackEvidencePack = {
    PACKS_KEY,
    buildEvidencePack,
    buildStripeSubmissionSummary,
    getPack,
    listPacks,
    readPacks,
  };
})(typeof window !== "undefined" ? window : globalThis);
