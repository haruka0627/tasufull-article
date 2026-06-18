/**
 * TALK 通知 — 重要 / 通常 ティア分類
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function haystack(n) {
    return [
      n?.title,
      n?.body,
      n?.notifySupplementLine,
      n?.id,
      n?.category,
      n?.type,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function isConnectNotification(n) {
    const cat = pickStr(n?.category);
    const id = pickStr(n?.id);
    if (cat === "Connect") return true;
    return /connect-identity|connect-payout|connect-pay|connect-refund/i.test(id);
  }

  function isAnpiNotification(n) {
    return pickStr(n?.type).toLowerCase() === "anpi" || pickStr(n?.category) === "安否";
  }

  function isUnpaidNotification(n) {
    const text = haystack(n);
    return /未払い|手数料.*未払|unpaid/i.test(text) || /fee-unpaid|unpaid-fee/i.test(pickStr(n?.id));
  }

  function isCompletionApprovalPending(n) {
    const text = haystack(n);
    if (/complete-request|completion-request/i.test(text)) return true;
    return /完了の申請がありました|やりとり完了の申請|完了承認待ち|完了報告が届きました/.test(text);
  }

  function isImportantNotification(n) {
    if (String(n?.source || "") === "shop_market_order_v1") return true;
    return (
      isConnectNotification(n) ||
      isAnpiNotification(n) ||
      isUnpaidNotification(n) ||
      isCompletionApprovalPending(n)
    );
  }

  function isNormalTapNotification(n) {
    if (isImportantNotification(n)) return false;
    const text = haystack(n);
    if (/やりとりを開始|チャット|相談が届き|メッセージが届き/.test(text)) return true;
    if (/応募がありました|この求人に応募/.test(text)) return true;
    if (/採用されました/.test(text)) return true;
    if (/問い合わせ|問合せ/.test(text)) return true;
    if (/評価をお願い|レビュー/.test(text)) return true;
    if (/-apply-|-hired-|-review-|-consult-|-start-/.test(pickStr(n?.id))) return true;
    return false;
  }

  function getNotifyTier(n) {
    if (isImportantNotification(n)) return "important";
    if (isNormalTapNotification(n)) return "normal";
    return "default";
  }

  function partitionNotifyRows(rows) {
    const important = [];
    const normal = [];
    const other = [];
    for (const n of rows || []) {
      const tier = getNotifyTier(n);
      if (tier === "important") important.push(n);
      else if (tier === "normal") normal.push(n);
      else other.push(n);
    }
    return { important, normal, other };
  }

  function formatConnectNotifyTitle(rawTitle) {
    const title = pickStr(rawTitle);
    if (!title) return "【重要】売上の受け取りには本人確認が必要です";
    if (title.startsWith("【重要】")) return title;
    if (/本人確認/.test(title)) return "【重要】売上の受け取りには本人確認が必要です";
    return title;
  }

  function connectNotifyDeadlineLabel(n) {
    const explicit = pickStr(n?.notifyDeadlineLabel, n?.deadlineLabel);
    if (explicit) return explicit;
    if (!isConnectNotification(n)) return "";
    return "期限: 7日以内";
  }

  global.TasuTalkNotifyTier = {
    isConnectNotification,
    isAnpiNotification,
    isUnpaidNotification,
    isCompletionApprovalPending,
    isImportantNotification,
    isNormalTapNotification,
    getNotifyTier,
    partitionNotifyRows,
    formatConnectNotifyTitle,
    connectNotifyDeadlineLabel,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
