/**
 * プラット通知 — 統一 CTA ラベル（通知 → 詳細カード → CTA → 次状態）
 */
(function (global) {
  "use strict";

  const SEMANTIC_NAVIGATE_LABELS = Object.freeze([
    "応募者を確認する",
    "応募を見る",
    "相談内容を見る",
    "購入を確認する",
    "完了報告を確認する",
    "やりとりを開く",
    "安否状況を見る",
    "お知らせを確認する",
    "サポート返信を見る",
    "チャットを開く",
    "やり取りチャットを開く",
    "取引内容を確認する",
    "レビューをする",
    "承認する",
    "評価する",
    "詳細を見る",
    "確認する",
  ]);

  const SEMANTIC_LABEL_SET = new Set(SEMANTIC_NAVIGATE_LABELS);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function pickHref(n) {
    return pickStr(n?.href, n?.targetUrl, n?.actionUrl);
  }

  function isJobChatStartTitle(title) {
    const t = String(title || "");
    if (
      t === "応募が承諾されました" ||
      t === "応募者とのやりとりを開始してください" ||
      t === "掲載者とのやりとりを開始してください"
    ) {
      return true;
    }
    const legacy = global.TasuPlatformChatJobCard?.LEGACY_HIRED_TITLES || ["採用されました"];
    return legacy.includes(t) || /やりとりを開始/.test(t);
  }

  function resolvePlatformNotifyActionLabel(notification) {
    const n = notification || {};
    const explicit = pickStr(n.actionLabel);
    if (explicit && explicit !== "確認する" && SEMANTIC_LABEL_SET.has(explicit)) return explicit;

    const title = String(n.title || "");
    const id = String(n.id || "");
    const href = pickHref(n);
    const supplement = String(n.notifySupplementLine || "");

    if (/応募がありました/.test(title) || /view=applications/.test(href) || /#applications/.test(href)) {
      return "応募者を確認する";
    }
    if (title === "応募が承諾されました") return "やりとりを開く";
    if (/予約\/注文が入りました/.test(title)) return "利用者を確認する";
    if (/相談\/依頼が届きました/.test(title)) return "相談内容を見る";
    if (/依頼が届きました/.test(title)) return "相談内容を見る";
    if (/相談が届きました/.test(title)) return "相談内容を見る";
    if (/商品が購入されました/.test(title)) return "購入を確認する";
    if (/店舗販売の新しい注文が入りました/.test(title)) return "注文を確認する";
    if (/新しい注文が入りました/.test(title)) return "注文を確認する";
    if (/注文を受け付けました/.test(title)) return "注文履歴を見る";
    if (/発送準備中です/.test(title)) return "注文詳細を見る";
    if (/商品を発送しました/.test(title)) return "注文詳細を見る";
    if (/配達が完了しました/.test(title)) return "注文履歴を見る";
    if (/スキルが購入|購入されました/.test(title)) return "購入を確認する";
    if (isJobChatStartTitle(title) || /やりとりが開始されました|チャットを開始/.test(title)) return "やりとりを開く";
    if (/新しいメッセージ|メッセージが届き/.test(title + supplement)) return "やりとりを開く";
    if (/完了報告|完了の申請|完了.*届き/.test(title) || /complete-request/.test(id)) return "完了報告を確認する";
    if (/評価が届き|レビューされました|評価されました/.test(title)) return "評価を見る";
    if (/評価をお願い/.test(title) || /-review-001$/.test(id)) return "評価する";
    if (/キャンセル/.test(title)) return "詳細を見る";
    if (/Connect.*(?:支払い|返金)|支払いが完了|返金が完了/.test(title + supplement)) {
      return "確認する";
    }
    if (title === "取引が完了しました") return "レビューをする";
    if (title === "やりとりが完了しました") return "評価する";
    if (/platform-chat-fee-pay/.test(href)) return "確認する";
    return "詳細を見る";
  }

  function isSemanticNavigateLabel(label) {
    return SEMANTIC_LABEL_SET.has(String(label || "").trim());
  }

  global.TasuPlatformNotifyActionLabels = {
    SEMANTIC_NAVIGATE_LABELS,
    resolvePlatformNotifyActionLabel,
    isSemanticNavigateLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
