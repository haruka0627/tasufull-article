/**
 * Stripe Connect / 決済 webhook イベント分類（本番 API 未呼び出し）
 */
(function (global) {
  "use strict";

  const EVENTS = Object.freeze({
    ACCOUNT_UPDATED: "account.updated",
    ACCOUNT_DEAUTHORIZED: "account.application.deauthorized",
    CAPABILITY_UPDATED: "capability.updated",
    PAYOUT_FAILED: "payout.failed",
    PAYOUT_PAID: "payout.paid",
    DISPUTE_CREATED: "charge.dispute.created",
    DISPUTE_UPDATED: "charge.dispute.updated",
    DISPUTE_CLOSED: "charge.dispute.closed",
    PAYMENT_FAILED: "payment_intent.payment_failed",
    CHECKOUT_COMPLETED: "checkout.session.completed",
    CHECKOUT_ASYNC_FAILED: "checkout.session.async_payment_failed",
    CHECKOUT_ASYNC_SUCCEEDED: "checkout.session.async_payment_succeeded",
    PAYMENT_INTENT_SUCCEEDED: "payment_intent.succeeded",
    CHARGE_SUCCEEDED: "charge.succeeded",
    CHARGE_REFUNDED: "charge.refunded",
    REFUND_CREATED: "refund.created",
    REFUND_UPDATED: "refund.updated",
    TRANSFER_FAILED: "transfer.failed",
    TRANSFER_PAID: "transfer.paid",
  });

  const SUPPORT = Object.freeze({
    CONNECT: "connect_issue",
    ADMIN: "admin_review",
    LEGAL: "legal_or_risk",
    ABUSE: "abuse_or_policy",
    GENERAL: "general_auto_reply",
  });

  const AI_OPS = Object.freeze({
    CHARGEBACK: "chargeback",
    CONNECT: "connect_issue",
    PAYMENT: "payment",
    REFUND: "refund",
    INQUIRY: "inquiry",
    GENERAL: "general",
  });

  /** @type {Record<string, object>} */
  const MAP = {
    [EVENTS.ACCOUNT_UPDATED]: {
      category: "connect_issue",
      severity: "medium",
      issue_type: "account_updated",
      admin_required: true,
      user_visible_summary: "Connectアカウント情報が更新されました。追加確認が必要な場合があります。",
      admin_summary: "account.updated — 本人確認・capabilities の変化を確認",
      recommended_action: "ダッシュボードで requirements / capabilities を確認し、本人確認テンプレを検討",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
      identity_template_hints: ["capability_pending", "name_mismatch", "address_mismatch"],
    },
    [EVENTS.ACCOUNT_DEAUTHORIZED]: {
      category: "connect_issue",
      severity: "high",
      issue_type: "account_deauthorized",
      admin_required: true,
      user_visible_summary: "Stripe Connect の連携が解除されました。出金・決済に影響する可能性があります。",
      admin_summary: "account.application.deauthorized — 連携解除。出金停止リスク",
      recommended_action: "当事者へ再連携案内（管理者確認後）。自動制限は行わない",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
    },
    [EVENTS.CAPABILITY_UPDATED]: {
      category: "connect_issue",
      severity: "high",
      issue_type: "capability_updated",
      admin_required: true,
      user_visible_summary: "決済・出金の利用可否が変更されました。",
      admin_summary: "capability.updated — active/inactive/pending を確認",
      recommended_action: "inactive なら本人確認テンプレと追加書類案内を検討",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
      identity_template_hints: ["capability_inactive", "capability_pending"],
    },
    [EVENTS.PAYOUT_FAILED]: {
      category: "connect_issue",
      severity: "high",
      issue_type: "payout_failed",
      admin_required: true,
      user_visible_summary: "出金（ペイアウト）に失敗しました。口座情報等をご確認ください。",
      admin_summary: "payout.failed — 出金失敗。Stripe ダッシュボードで failure_code を確認",
      recommended_action: "口座・本人確認状態を確認。管理者が Stripe 側で再試行方針を決定",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
      identity_template_hints: ["bank_account_error"],
    },
    [EVENTS.PAYOUT_PAID]: {
      category: "connect_issue",
      severity: "low",
      issue_type: "payout_paid",
      admin_required: false,
      user_visible_summary: "出金が完了しました（記録用）。",
      admin_summary: "payout.paid — 記録のみ",
      recommended_action: "異常がなければクローズ可",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
    },
    [EVENTS.DISPUTE_CREATED]: {
      category: "connect_issue",
      severity: "critical",
      issue_type: "dispute_created",
      admin_required: true,
      user_visible_summary: "チャージバック（異議申立）が発生しました。運営が確認します。",
      admin_summary: "charge.dispute.created — 証拠パック作成・期限確認",
      recommended_action: "チャージバック証拠パックを作成し、管理者が Stripe に手動提出",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CHARGEBACK,
      suggest_evidence_pack: true,
    },
    [EVENTS.DISPUTE_UPDATED]: {
      category: "connect_issue",
      severity: "high",
      issue_type: "dispute_updated",
      admin_required: true,
      user_visible_summary: "チャージバックの状態が更新されました。",
      admin_summary: "charge.dispute.updated — ステータス・期限を確認",
      recommended_action: "証拠パックを更新し、管理者確認",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CHARGEBACK,
      suggest_evidence_pack: true,
    },
    [EVENTS.DISPUTE_CLOSED]: {
      category: "connect_issue",
      severity: "medium",
      issue_type: "dispute_closed",
      admin_required: true,
      user_visible_summary: "チャージバックがクローズされました。",
      admin_summary: "charge.dispute.closed — 結果（won/lost）を記録",
      recommended_action: "結果をチケットに記録。返金・制限は自動実行しない",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CHARGEBACK,
    },
    [EVENTS.PAYMENT_FAILED]: {
      category: "admin_review",
      severity: "high",
      issue_type: "payment_failed",
      admin_required: true,
      user_visible_summary: "お支払いに失敗しました。カード情報等をご確認ください。",
      admin_summary: "payment_intent.payment_failed — 決済失敗",
      recommended_action: "注文・案件と紐付けてユーザーへ案内（管理者確認後）",
      support_ticket_type: SUPPORT.ADMIN,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.CHECKOUT_COMPLETED]: {
      category: "general_auto_reply",
      severity: "low",
      issue_type: "checkout_completed",
      admin_required: false,
      user_visible_summary: "チェックアウトが完了しました（記録用）。",
      admin_summary: "checkout.session.completed — 記録",
      recommended_action: "異常トラブルがなければ対応不要",
      support_ticket_type: SUPPORT.GENERAL,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.CHECKOUT_ASYNC_FAILED]: {
      category: "admin_review",
      severity: "high",
      issue_type: "async_payment_failed",
      admin_required: true,
      user_visible_summary: "お支払い（非同期）に失敗しました。",
      admin_summary: "checkout.session.async_payment_failed",
      recommended_action: "再決済案内を管理者確認後に送付",
      support_ticket_type: SUPPORT.ADMIN,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.CHECKOUT_ASYNC_SUCCEEDED]: {
      category: "general_auto_reply",
      severity: "low",
      issue_type: "async_payment_succeeded",
      admin_required: false,
      user_visible_summary: "お支払い（非同期）が完了しました。",
      admin_summary: "checkout.session.async_payment_succeeded",
      recommended_action: "記録のみ",
      support_ticket_type: SUPPORT.GENERAL,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.PAYMENT_INTENT_SUCCEEDED]: {
      category: "general_auto_reply",
      severity: "low",
      issue_type: "payment_intent_succeeded",
      admin_required: false,
      user_visible_summary: "お支払いが完了しました（記録用）。",
      admin_summary: "payment_intent.succeeded — 決済完了",
      recommended_action: "記録のみ",
      support_ticket_type: SUPPORT.GENERAL,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.CHARGE_SUCCEEDED]: {
      category: "general_auto_reply",
      severity: "low",
      issue_type: "charge_succeeded",
      admin_required: false,
      user_visible_summary: "決済が完了しました（記録用）。",
      admin_summary: "charge.succeeded — 決済完了",
      recommended_action: "記録のみ",
      support_ticket_type: SUPPORT.GENERAL,
      ai_ops_case_type: AI_OPS.PAYMENT,
    },
    [EVENTS.CHARGE_REFUNDED]: {
      category: "admin_review",
      severity: "medium",
      issue_type: "charge_refunded",
      admin_required: true,
      user_visible_summary: "返金が処理されました。",
      admin_summary: "charge.refunded — 返金完了",
      recommended_action: "注文・案件と紐付けて記録確認",
      support_ticket_type: SUPPORT.ADMIN,
      ai_ops_case_type: AI_OPS.REFUND,
    },
    [EVENTS.REFUND_CREATED]: {
      category: "admin_review",
      severity: "medium",
      issue_type: "refund_created",
      admin_required: true,
      user_visible_summary: "返金申請を受け付けました。",
      admin_summary: "refund.created — 返金申請",
      recommended_action: "返金理由・金額を確認",
      support_ticket_type: SUPPORT.ADMIN,
      ai_ops_case_type: AI_OPS.REFUND,
    },
    [EVENTS.REFUND_UPDATED]: {
      category: "admin_review",
      severity: "low",
      issue_type: "refund_updated",
      admin_required: false,
      user_visible_summary: "返金の状態が更新されました。",
      admin_summary: "refund.updated — 返金状態更新",
      recommended_action: "記録確認",
      support_ticket_type: SUPPORT.ADMIN,
      ai_ops_case_type: AI_OPS.REFUND,
    },
    [EVENTS.TRANSFER_FAILED]: {
      category: "connect_issue",
      severity: "high",
      issue_type: "transfer_failed",
      admin_required: true,
      user_visible_summary: "送金（transfer）に失敗しました。運営が確認します。",
      admin_summary: "transfer.failed — Connect 送金失敗",
      recommended_action: "Connect アカウント・残高を確認（管理者のみ）",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
    },
    [EVENTS.TRANSFER_PAID]: {
      category: "connect_issue",
      severity: "low",
      issue_type: "transfer_paid",
      admin_required: false,
      user_visible_summary: "送金が完了しました（記録用）。",
      admin_summary: "transfer.paid",
      recommended_action: "記録のみ",
      support_ticket_type: SUPPORT.CONNECT,
      ai_ops_case_type: AI_OPS.CONNECT,
    },
  };

  const UNKNOWN = Object.freeze({
    category: "admin_review",
    severity: "medium",
    issue_type: "unknown_stripe_event",
    admin_required: true,
    user_visible_summary: "Stripe イベントを受信しました（要確認）。",
    admin_summary: "未分類 Stripe イベント",
    recommended_action: "イベント種別を確認し手動分類",
    support_ticket_type: SUPPORT.ADMIN,
    ai_ops_case_type: AI_OPS.INQUIRY,
  });

  function normalizeEventType(payload) {
    const t =
      payload?.type ||
      payload?.stripeEventType ||
      payload?.event_type ||
      payload?.event?.type ||
      "";
    return String(t).trim();
  }

  function classifyStripeEvent(eventType, payload) {
    const key = normalizeEventType({ type: eventType });
    const base = MAP[key] ? { ...MAP[key] } : { ...UNKNOWN, issue_type: `unknown_${key || "event"}` };
    base.stripe_event_type = key || eventType || "unknown";
    base.payload_id = payload?.id || payload?.event_id || payload?.raw_event_ref || null;
    return base;
  }

  function listSupportedEventTypes() {
    return Object.values(EVENTS);
  }

  global.TasuStripeConnectEventMap = {
    EVENTS,
    SUPPORT,
    AI_OPS,
    MAP,
    classifyStripeEvent,
    listSupportedEventTypes,
    normalizeEventType,
  };
})(typeof window !== "undefined" ? window : globalThis);
