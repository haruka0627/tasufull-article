/**
 * AI運営秘書 Phase4 — Safety & License Gate
 * 送信前にセキュリティ・資格・許認可リスクを判定する。
 */
(function (global) {
  "use strict";

  const SAFETY_LABELS = Object.freeze({
    external_contact: "外部連絡先",
    external_payment: "外部決済",
    threat: "脅迫・威圧",
    abuse: "通報・虐待",
    personal_info: "個人情報",
    fraud_suspicion: "不正疑い",
    refund_high_risk: "高リスク返金",
    account_restriction: "アカウント制限",
    banned_item: "禁止出品",
  });

  const LICENSE_STATUS_LABELS = Object.freeze({
    qualification_not_required: "資格不要",
    qualification_recommended: "資格推奨",
    qualification_required: "資格必須",
    permit_required: "許認可必須",
    admin_review_required: "管理者確認必須",
    prohibited_or_high_risk: "禁止・高リスク",
  });

  const SENDABILITY_LABELS = Object.freeze({
    low: "送信可",
    medium: "要承認送信",
    high: "確認のみ",
    prohibited: "送信不可",
  });

  const LEVEL_ORDER = Object.freeze({ low: 1, medium: 2, high: 3, prohibited: 4, critical: 3 });

  const SAFETY_RULES = [
    {
      id: "external_contact",
      level: "high",
      patterns: [
        /外部連絡|line\s*id|電話番号|メール.*誘導|直接連絡|snsで連絡|外部.*連絡先/i,
        /offplatform|プラットフォーム外.*連絡/i,
      ],
      eventTypes: ["external_contact_suspect"],
    },
    {
      id: "external_payment",
      level: "high",
      patterns: [
        /外部決済|銀行振込|現金払い|paypay|手数料回避|stripe以外|決済.*迂回/i,
      ],
    },
    {
      id: "threat",
      level: "high",
      patterns: [/脅迫|殺す|訴える|弁護士.*脅|危害|脅し/i],
    },
    {
      id: "abuse",
      level: "medium",
      patterns: [/通報|虐待|ハラスメント|迷惑行為|不適切な出品/i],
      eventTypes: ["report"],
    },
    {
      id: "personal_info",
      level: "medium",
      patterns: [/本人確認|マイナンバー|身分証|個人情報|住所.*開示|電話番号.*開示/i],
      eventTypes: ["identity_doc_incomplete"],
    },
    {
      id: "fraud_suspicion",
      level: "high",
      patterns: [/不正|詐欺|なりすまし|架空|虚偽|偽装/i],
    },
    {
      id: "refund_high_risk",
      level: "medium",
      patterns: [/全額返金|chargeback|チャージバック|返金.*拒否|高額返金/i],
      eventTypes: ["refund_consultation"],
    },
    {
      id: "account_restriction",
      level: "high",
      patterns: [/ban|アカウント停止|利用停止|凍結|制限解除/i],
    },
    {
      id: "banned_item",
      level: "high",
      patterns: [/禁止出品|違法|薬物|武器|非表示候補/i],
      eventTypes: ["listing_hide_candidate"],
    },
  ];

  const SERVICE_CATEGORIES = Object.freeze({
    electrical_work: {
      id: "electrical_work",
      label: "電気工事",
      keywords: [/電気工事|電気設備|第二種電工|第一種電工/i],
      licenseStatus: "qualification_required",
      requiredDocuments: ["電気工事士登録証", "賠償責任保険証"],
    },
    construction_work: {
      id: "construction_work",
      label: "建設作業",
      keywords: [/建設|建築|リフォーム|大工|内装工事|塗装工事/i],
      licenseStatus: "permit_required",
      requiredDocuments: ["建設業許可", "工事保険"],
    },
    demolition: {
      id: "demolition",
      label: "解体",
      keywords: [/解体|撤去|アスベスト/i],
      licenseStatus: "permit_required",
      requiredDocuments: ["建設業許可（解体）", "アスベスト関連届出"],
    },
    locksmith: {
      id: "locksmith",
      label: "鍵",
      keywords: [/鍵|ロック|解錠|シリンダー/i],
      licenseStatus: "qualification_recommended",
      requiredDocuments: ["本人確認", "依頼内容の記録"],
    },
    plumbing: {
      id: "plumbing",
      label: "水道",
      keywords: [/水道|給排水|水漏れ|配管/i],
      licenseStatus: "qualification_required",
      requiredDocuments: ["給水装置工事主任技術者証", "水道局届出"],
    },
    nursing_care: {
      id: "nursing_care",
      label: "介護",
      keywords: [/介護|訪問介護|看護|ヘルパー/i],
      licenseStatus: "qualification_required",
      requiredDocuments: ["介護職員証", "事業所許可"],
    },
    delivery: {
      id: "delivery",
      label: "配送",
      keywords: [/配送|配達|運搬|引越し/i],
      licenseStatus: "qualification_recommended",
      requiredDocuments: ["運送契約", "保険証"],
    },
    used_goods: {
      id: "used_goods",
      label: "中古品売買",
      keywords: [/中古|古物|買取|リサイクル/i],
      licenseStatus: "permit_required",
      requiredDocuments: ["古物商許可"],
    },
    travel_arrangement: {
      id: "travel_arrangement",
      label: "旅行手配",
      keywords: [/旅行|ツアー|宿泊手配|旅行業/i],
      licenseStatus: "permit_required",
      requiredDocuments: ["旅行業登録", "約款"],
    },
    staffing: {
      id: "staffing",
      label: "人材紹介",
      keywords: [/人材紹介|職業紹介|有料職業紹介|派遣/i],
      licenseStatus: "admin_review_required",
      requiredDocuments: ["有料職業紹介事業許可", "契約書"],
      constructionProhibited: true,
    },
    anpi: {
      id: "anpi",
      label: "安否",
      eventTypes: ["anpi_no_response"],
      licenseStatus: "admin_review_required",
      requiredDocuments: ["安否確認ログ", "緊急連絡先"],
    },
    builder: {
      id: "builder",
      label: "Builder",
      eventTypes: ["builder_review", "listing_hide_candidate"],
      licenseStatus: "admin_review_required",
      requiredDocuments: ["Builder評価記録", "掲載審査メモ"],
    },
    connect: {
      id: "connect",
      label: "Connect",
      eventTypes: ["connect_incomplete", "identity_doc_incomplete"],
      licenseStatus: "admin_review_required",
      requiredDocuments: ["Stripe Connect要件", "本人確認書類"],
    },
    market: {
      id: "market",
      label: "市場",
      keywords: [/市場|ショップ|出品|注文|マーケット|market|shop|商品ページ/i],
      licenseStatus: "qualification_recommended",
      requiredDocuments: ["出品情報", "取引条件", "特商法表記"],
    },
  });

  const LICENSE_STATUS_GATE = Object.freeze({
    qualification_not_required: "low",
    qualification_recommended: "medium",
    qualification_required: "high",
    permit_required: "high",
    admin_review_required: "high",
    prohibited_or_high_risk: "prohibited",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeLevel(level) {
    const l = String(level || "low").toLowerCase();
    if (l === "critical") return "high";
    if (l === "low" || l === "medium" || l === "high" || l === "prohibited") return l;
    return "low";
  }

  function maxLevel(...levels) {
    let max = "low";
    let maxScore = 0;
    levels.forEach((lv) => {
      const n = normalizeLevel(lv);
      const score = LEVEL_ORDER[n] || 0;
      if (score > maxScore) {
        maxScore = score;
        max = n;
      }
    });
    return max;
  }

  function collectPlanText(plan) {
    return [
      plan?.eventType,
      plan?.eventTypeLabel,
      plan?.aiSuggestion,
      plan?.aiReason,
      plan?.aiDraftMessage,
      plan?.targetUser,
      plan?.serviceCategoryLabel,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function evaluateSafety(plan) {
    const text = collectPlanText(plan);
    const flags = [];
    const reasons = [];
    let level = "low";

    SAFETY_RULES.forEach((rule) => {
      const eventHit = rule.eventTypes?.includes(plan?.eventType);
      const patternHit = (rule.patterns || []).some((re) => re.test(text));
      if (eventHit || patternHit) {
        flags.push(rule.id);
        reasons.push(SAFETY_LABELS[rule.id] || rule.id);
        level = maxLevel(level, rule.level);
      }
    });

    const offplatform = global.TasuOffplatformRiskDetector?.scanText?.(text);
    if (offplatform?.detected) {
      if (/payment|bank|paypay|cash|振込/i.test(offplatform.risk_type || "")) {
        if (!flags.includes("external_payment")) {
          flags.push("external_payment");
          reasons.push(SAFETY_LABELS.external_payment);
        }
      } else if (!flags.includes("external_contact")) {
        flags.push("external_contact");
        reasons.push(SAFETY_LABELS.external_contact);
      }
      level = maxLevel(level, offplatform.severity === "critical" ? "high" : offplatform.severity);
    }

    if (plan?.riskLevel === "high" && !flags.length) {
      level = maxLevel(level, "high");
      reasons.push("案件優先度が高");
    }

    return {
      level: normalizeLevel(level),
      flags: [...new Set(flags)],
      label: flags.length ? flags.map((f) => SAFETY_LABELS[f] || f).join("・") : "問題なし",
      reason: reasons.length ? reasons.join(" / ") : "重大な安全リスクは検出されていません",
    };
  }

  function detectServiceCategory(plan) {
    const text = collectPlanText(plan);

    if (/有料職業紹介|職業紹介|人材紹介/i.test(text) && /建設|解体|工事|大工|職人/i.test(text)) {
      return {
        id: "staffing",
        label: "人材紹介",
        licenseStatus: "prohibited_or_high_risk",
        requiredDocuments: ["有料職業紹介事業許可", "契約書", "管理者承認記録"],
        reason: "建設業務の有料職業紹介は自動承認不可",
      };
    }

    let matched = null;

    for (const cat of Object.values(SERVICE_CATEGORIES)) {
      if (cat.eventTypes?.includes(plan?.eventType)) {
        matched = cat;
        break;
      }
    }

    if (!matched) {
      for (const cat of Object.values(SERVICE_CATEGORIES)) {
        if ((cat.keywords || []).some((re) => re.test(text))) {
          matched = cat;
          break;
        }
      }
    }

    if (!matched) {
      if (plan?.eventType === "inquiry_received" || plan?.eventType === "chat_not_opening") {
        return {
          id: "general_inquiry",
          label: "一般問い合わせ",
          licenseStatus: "qualification_not_required",
          requiredDocuments: [],
        };
      }
      return {
        id: "general",
        label: "一般",
        licenseStatus: "qualification_not_required",
        requiredDocuments: [],
      };
    }

    let licenseStatus = matched.licenseStatus || "qualification_not_required";
    let reason = `${matched.label}カテゴリの標準ルールを適用`;

    if (
      matched.id === "staffing" &&
      matched.constructionProhibited &&
      /建設|解体|工事|職人/i.test(text)
    ) {
      licenseStatus = "prohibited_or_high_risk";
      reason = "建設業務の有料職業紹介は自動承認不可";
    }

    if (plan?.eventType === "refund_consultation" && /全額|chargeback|チャージバック/i.test(text)) {
      reason = "高額・チャージバック返金は追加確認が必要";
    }

    return {
      id: matched.id,
      label: matched.label,
      licenseStatus,
      requiredDocuments: [...(matched.requiredDocuments || [])],
      reason,
    };
  }

  function evaluateLicense(plan, category) {
    const status = category.licenseStatus || "qualification_not_required";
    return {
      status,
      statusLabel: LICENSE_STATUS_LABELS[status] || status,
      categoryId: category.id,
      categoryLabel: category.label,
      reason: category.reason || `${category.label}の許認可ルール`,
      requiredDocuments: category.requiredDocuments || [],
    };
  }

  function resolveGateAction(gateLevel) {
    if (gateLevel === "prohibited") {
      return {
        sendAllowed: false,
        confirmOnly: false,
        sendBlocked: true,
        sendabilityLabel: SENDABILITY_LABELS.prohibited,
        primaryActionLabel: "送信不可",
        autoSendCandidate: false,
        requiresApproval: true,
        destinationType: "admin_only",
      };
    }
    if (gateLevel === "high") {
      return {
        sendAllowed: false,
        confirmOnly: true,
        sendBlocked: false,
        sendabilityLabel: SENDABILITY_LABELS.high,
        primaryActionLabel: "確認",
        autoSendCandidate: false,
        requiresApproval: true,
        destinationType: "admin_only",
      };
    }
    if (gateLevel === "medium") {
      return {
        sendAllowed: true,
        confirmOnly: false,
        sendBlocked: false,
        sendabilityLabel: SENDABILITY_LABELS.medium,
        primaryActionLabel: "送信",
        autoSendCandidate: false,
        requiresApproval: true,
        destinationType: "talk",
      };
    }
    return {
      sendAllowed: true,
      confirmOnly: false,
      sendBlocked: false,
      sendabilityLabel: SENDABILITY_LABELS.low,
      primaryActionLabel: "送信",
      autoSendCandidate: true,
      requiresApproval: false,
      destinationType: "notification",
    };
  }

  function evaluateGate(plan) {
    const safetyResult = evaluateSafety(plan);
    const category = detectServiceCategory(plan);
    const licenseResult = evaluateLicense(plan, category);

    const licenseGateLevel = LICENSE_STATUS_GATE[licenseResult.status] || "low";
    const gateLevel = maxLevel(safetyResult.level, licenseGateLevel, plan?.riskLevel);
    const action = resolveGateAction(gateLevel);

    const gateReason = pickStr(
      licenseResult.status === "prohibited_or_high_risk" ? licenseResult.reason : "",
      safetyResult.level !== "low" ? safetyResult.reason : "",
      licenseGateLevel !== "low" ? licenseResult.reason : "",
      "Safety & License Gate 通過"
    );

    return {
      safetyResult,
      licenseResult,
      serviceCategoryId: category.id,
      serviceCategoryLabel: category.label,
      gateLevel,
      gateReason,
      requiredDocuments: licenseResult.requiredDocuments,
      ...action,
    };
  }

  function applyGateToPlan(plan) {
    const gate = evaluateGate(plan);
    return {
      ...plan,
      safetyResult: gate.safetyResult,
      licenseResult: gate.licenseResult,
      serviceCategoryId: gate.serviceCategoryId,
      serviceCategoryLabel: gate.serviceCategoryLabel,
      gateLevel: gate.gateLevel,
      gateReason: gate.gateReason,
      requiredDocuments: gate.requiredDocuments,
      sendabilityLabel: gate.sendabilityLabel,
      sendAllowed: gate.sendAllowed,
      confirmOnly: gate.confirmOnly,
      sendBlocked: gate.sendBlocked,
      riskLevel: gate.gateLevel === "prohibited" ? "high" : normalizeLevel(gate.gateLevel),
      autoSendCandidate: gate.autoSendCandidate,
      requiresApproval: gate.requiresApproval,
      primaryActionLabel: gate.primaryActionLabel,
      destinationType: gate.destinationType,
    };
  }

  global.TasuAdminAiResponseSafetyLicenseGate = {
    SAFETY_LABELS,
    LICENSE_STATUS_LABELS,
    SENDABILITY_LABELS,
    SERVICE_CATEGORIES,
    evaluateSafety,
    evaluateLicense,
    detectServiceCategory,
    evaluateGate,
    applyGateToPlan,
  };
})(typeof window !== "undefined" ? window : globalThis);
