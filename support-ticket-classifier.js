/**
 * TASFUL 問い合わせ分類（AI判断補助・最終実行は管理者のみ）
 */
(function (global) {
  "use strict";

  const CATEGORIES = Object.freeze({
    GENERAL_AUTO_REPLY: "general_auto_reply",
    ADMIN_REVIEW: "admin_review",
    CONNECT_ISSUE: "connect_issue",
    LEGAL_OR_RISK: "legal_or_risk",
    ABUSE_OR_POLICY: "abuse_or_policy",
  });

  const SEVERITIES = Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  });

  const RULES = [
    {
      category: CATEGORIES.LEGAL_OR_RISK,
      severity: SEVERITIES.CRITICAL,
      re: /損害|事故|怪我|けが|死亡|賠償|法的|弁護士|消費者庁|訴訟|裁判|重大クレーム|人身/i,
      label: "法務・事故・重大クレーム",
    },
    {
      category: CATEGORIES.ABUSE_OR_POLICY,
      severity: SEVERITIES.HIGH,
      re: /直営業|外部決済|銀行振込で(支払|お支払)|現金手渡し|直接振込|stripe以外|決済を迂回|迷惑行為|ハラスメント|BAN|アカウント停止して/i,
      label: "ポリシー違反・外部決済誘導",
    },
    {
      category: CATEGORIES.CONNECT_ISSUE,
      severity: SEVERITIES.HIGH,
      re: /stripe\s*connect|connect\s*アカウント|本人確認.*(エラー|失敗|できない)|銀行口座.*(エラー|登録|変更)|出金.*(停止|できない|遅延)|入金.*遅延|payout|chargeback|チャージバック|webhook/i,
      label: "Stripe Connect・決済基盤",
    },
    {
      category: CATEGORIES.ADMIN_REVIEW,
      severity: SEVERITIES.HIGH,
      re: /返金|チャージバック|chargeback|出金停止|入金遅延|アカウント制限|アカウント停止|BAN|永久停止|案件キャンセル.*確定|キャンセル確定/i,
      label: "管理者確認必須（金銭・制限）",
    },
    {
      category: CATEGORIES.ADMIN_REVIEW,
      severity: SEVERITIES.MEDIUM,
      re: /キャンセル|紛争|トラブル|異議|クレーム/i,
      label: "管理者確認（紛争系）",
    },
    {
      category: CATEGORIES.GENERAL_AUTO_REPLY,
      severity: SEVERITIES.LOW,
      re: /使い方|登録方法|掲載方法|料金|FAQ|よくある質問|本人確認.*(案内|方法)|支払い手順|キャンセル規約|審査状況|操作方法|マニュアル/i,
      label: "一般案内（AI自動返信可）",
    },
  ];

  function normalizeText(title, body) {
    return `${String(title || "")}\n${String(body || "")}`.trim();
  }

  function classifySupportInquiry(input) {
    const title = input?.title || "";
    const body = input?.body || "";
    const source = input?.source || "web_form";
    const text = normalizeText(title, body);
    const matched = [];

    for (const rule of RULES) {
      if (rule.re.test(text)) {
        matched.push({ category: rule.category, severity: rule.severity, label: rule.label });
      }
    }

    let category = CATEGORIES.GENERAL_AUTO_REPLY;
    let severity = SEVERITIES.LOW;
    let requiresAdmin = false;
    let autoReplyAllowed = true;

    const rank = {
      [CATEGORIES.LEGAL_OR_RISK]: 5,
      [CATEGORIES.ABUSE_OR_POLICY]: 4,
      [CATEGORIES.CONNECT_ISSUE]: 4,
      [CATEGORIES.ADMIN_REVIEW]: 3,
      [CATEGORIES.GENERAL_AUTO_REPLY]: 1,
    };
    const sevRank = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const m of matched) {
      if ((rank[m.category] || 0) >= (rank[category] || 0)) {
        category = m.category;
      }
      if ((sevRank[m.severity] || 0) > (sevRank[severity] || 0)) {
        severity = m.severity;
      }
    }

    if (input?.forceCategory && CATEGORIES[input.forceCategory.toUpperCase?.()]) {
      category = input.forceCategory;
    }
    if (input?.forceSeverity && SEVERITIES[String(input.forceSeverity).toUpperCase()]) {
      severity = input.forceSeverity;
    }

    if (source === "stripe_webhook" || input?.stripeEventType) {
      category = CATEGORIES.CONNECT_ISSUE;
      severity = SEVERITIES.CRITICAL;
      matched.push({ category, severity, label: "Stripe webhook 異常" });
    }

    const adminCategories = new Set([
      CATEGORIES.ADMIN_REVIEW,
      CATEGORIES.CONNECT_ISSUE,
      CATEGORIES.LEGAL_OR_RISK,
      CATEGORIES.ABUSE_OR_POLICY,
    ]);

    if (adminCategories.has(category)) {
      requiresAdmin = true;
      autoReplyAllowed = false;
    }
    if (severity === SEVERITIES.HIGH || severity === SEVERITIES.CRITICAL) {
      requiresAdmin = true;
      autoReplyAllowed = false;
    }

    if (category === CATEGORIES.GENERAL_AUTO_REPLY && matched.length === 0 && text.length < 8) {
      severity = SEVERITIES.MEDIUM;
      requiresAdmin = true;
      autoReplyAllowed = false;
    }

    return {
      category,
      severity,
      requiresAdmin,
      autoReplyAllowed,
      matchedRules: matched,
      aiRecommendedAction: buildRecommendedAction(category, severity),
    };
  }

  function buildRecommendedAction(category, severity) {
    const map = {
      [CATEGORIES.GENERAL_AUTO_REPLY]: "AI自動返信を送信し、追加質問があれば管理者へエスカレーション",
      [CATEGORIES.ADMIN_REVIEW]: "管理者が内容確認後、返金・キャンセル等の操作予定を記録（API実行は後フェーズ）",
      [CATEGORIES.CONNECT_ISSUE]: "Stripe Connect・口座・本人確認を管理者が確認し、Connect問題一覧で追跡",
      [CATEGORIES.LEGAL_OR_RISK]: "法務・リスク担当へ即時エスカレーション。自動返信・断定禁止",
      [CATEGORIES.ABUSE_OR_POLICY]: "ポリシー違反調査。BAN/制限は管理者ボタンのみ",
    };
    const base = map[category] || "管理者確認";
    if (severity === SEVERITIES.CRITICAL) return `[CRITICAL] ${base}`;
    if (severity === SEVERITIES.HIGH) return `[HIGH] ${base}`;
    return base;
  }

  function shouldNotifyAdmin(ticket) {
    const cat = ticket?.category || "";
    const sev = ticket?.severity || "";
    const notifyCats = new Set([
      CATEGORIES.CONNECT_ISSUE,
      CATEGORIES.LEGAL_OR_RISK,
      CATEGORIES.ABUSE_OR_POLICY,
      CATEGORIES.ADMIN_REVIEW,
    ]);
    if (notifyCats.has(cat)) return true;
    if (sev === SEVERITIES.HIGH || sev === SEVERITIES.CRITICAL) return true;
    return false;
  }

  global.TasuSupportClassifier = {
    CATEGORIES,
    SEVERITIES,
    classifySupportInquiry,
    shouldNotifyAdmin,
  };
})(typeof window !== "undefined" ? window : globalThis);
