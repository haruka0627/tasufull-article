/**
 * Builder AI — 業務アクション定義（draft / suggestion のみ）
 */
(function (global) {
  "use strict";

  /** @type {Readonly<Record<string, { id: string, label: string, template: string, instruction: string, requiresProject: boolean, allowedActors: string[] }>>} */
  const ACTIONS = Object.freeze({
    estimate_draft: {
      id: "estimate_draft",
      label: "見積たたき台",
      template: "この案件の見積書たたき台を作成してください。",
      instruction:
        "見積項目・数量・単価・小計・税・合計の表形式たたき台を日本語で作成してください。金額は参考目安として明示し、確定見積ではないことを冒頭に書いてください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    schedule_draft: {
      id: "schedule_draft",
      label: "工程たたき台",
      template: "工程表のたたき台を作成してください。",
      instruction:
        "準備・本体・仕上げ・検査などの工程を時系列で整理したたたき台を作成してください。日数は目安とし、確定スケジュールではないことを明記してください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    proposal_draft: {
      id: "proposal_draft",
      label: "提案文",
      template: "発注者向けの提案文の下書きを作成してください。",
      instruction:
        "工事概要・強み・進め方・概算・注意事項を含む提案文の下書きを作成してください。採用・契約の確定は行わない旨を末尾に含めてください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    contract_note: {
      id: "contract_note",
      label: "契約前確認メモ",
      template: "契約前に確認すべきポイントを整理してください。",
      instruction:
        "契約前に当事者が確認すべき論点（工期・支払条件・変更協議・保証・安全・下請け等）をチェックリスト形式で整理してください。契約成立・法的判断は行わないでください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    faq_answer: {
      id: "faq_answer",
      label: "Builder FAQ",
      template: "Builderの使い方について教えてください。",
      instruction:
        "TASFUL Builder の操作・案件フロー・協力会社応募・完了報告などに関する一般的なFAQとして回答してください。個別案件の内部情報は含めないでください。",
      requiresProject: false,
      allowedActors: ["guest", "owner", "partner", "admin"],
    },
    field_checklist: {
      id: "field_checklist",
      label: "現場チェックリスト",
      template: "現場作業前のチェックリスト案を作成してください。",
      instruction:
        "入場前・施工中・退場前の安全・品質・記録項目をチェックリスト形式で提案してください。安全上の断定や法令適合の保証はしないでください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    delay_response: {
      id: "delay_response",
      label: "工程遅延文案",
      template: "工程遅延時の関係者向け連絡文の下書きを作成してください。",
      instruction:
        "遅延の事実整理・影響・暫定対応・今後の確認事項を含む連絡文の下書きを作成してください。確定日程や支払指示は含めないでください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    daily_report: {
      id: "daily_report",
      label: "作業日報",
      template: "本日の作業日報のたたき台を作成してください。",
      instruction:
        "作業内容・人数・進捗・課題・明日予定を含む日報たたき台を作成してください。公式な完了報告・請求確定ではないことを明記してください。",
      requiresProject: true,
      allowedActors: ["owner", "partner", "admin"],
    },
    worker_search_assist: {
      id: "worker_search_assist",
      label: "Worker検索補助",
      template:
        "キッチン改修に対応できるWorkerを探したいです。エリア: 東京都、カテゴリ: 内装、資格: 第二種電工、希望単価: 日当2万円程度",
      instruction:
        "入力条件を整理し、検索条件・優先/除外条件・候補比較表テンプレート・注意点を出力してください。採用確定は行わず、最終選定は運営確認が必要と明記してください。",
      mode: "search",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    partner_search_assist: {
      id: "partner_search_assist",
      label: "業者検索補助",
      template:
        "リフォーム案件に対応できる協力会社を探したいです。エリア: 神奈川、カテゴリ: 総合リフォーム、インボイス登録あり",
      instruction:
        "入力条件を整理し、検索条件・優先/除外条件・候補比較表テンプレート・注意点を出力してください。契約成立・採用確定は行わず、最終選定は運営確認が必要と明記してください。",
      mode: "search",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    invoice_tax_calc: {
      id: "invoice_tax_calc",
      label: "インボイス・税計算",
      template: "税抜 100000 円、消費税10%、四捨五入で税込を計算してください。",
      instruction:
        "提供された計算結果の数値を変更せず、説明・端数処理・インボイス上の注意点のみ補足してください。請求確定は行わないでください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    estimate_profit_calc: {
      id: "estimate_profit_calc",
      label: "見積・利益計算",
      template: "原価: 800000、見積金額: 1200000、値引き率: 5%",
      instruction:
        "提供された計算結果の数値を変更せず、粗利率・値引き後利益の説明とリスク注意のみ補足してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    labor_cost_calc: {
      id: "labor_cost_calc",
      label: "人件費計算",
      template: "人数: 3、日当: 18000、日数: 5、残業: 12000、経費: 8000",
      instruction: "提供された人件費計算結果を説明し、支払確定ではない旨を明記してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    schedule_calc: {
      id: "schedule_calc",
      label: "工期計算",
      template: "開始日: 2026-07-01、終了日: 2026-07-31、土日除外",
      instruction: "提供された稼働日数計算を説明し、祝日除外は将来対応・確定工期ではない旨を記載してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    area_unit_calc: {
      id: "area_unit_calc",
      label: "面積・単位変換",
      template: "50 ㎡ を坪と畳に換算してください。",
      instruction: "提供された換算結果を説明し、現場実測確認が必要な旨を記載してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    paint_cross_calc: {
      id: "paint_cross_calc",
      label: "塗装・クロス数量",
      template: "壁面積: 80、天井: 20、開口控除: 5、ロス率: 10%",
      instruction: "提供された必要数量（目安）を説明し、製品規格確認が必要な旨を記載してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    sole_prop_tax_assist: {
      id: "sole_prop_tax_assist",
      label: "確定申告整理",
      template:
        "個人事業主として確定申告の準備をしたいです。白色申告と青色申告の違い、売上・経費の整理、インボイス登録の確認項目を教えてください。",
      instruction:
        "申告準備チェックリスト、白色/青色整理表、経費候補、税理士確認メモを出力してください。税額・節税額の断定、脱法助言は禁止。最終判断は税理士・税務署確認と明記してください。",
      mode: "tax_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    document_text_draft: {
      id: "document_text_draft",
      label: "書類送付文",
      template:
        "見積書送付文を作成してください。宛先: 株式会社サンプル、金額: 350000円、支払期限: 2026-08-31",
      instruction:
        "見積・請求・領収・発注・支払案内・入金確認・催促などの送付文下書きを作成してください。金額・期限は入力値反映のみ。請求確定・支払確定は行わないでください。",
      mode: "practice_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    contract_order_draft: {
      id: "contract_order_draft",
      label: "契約・発注下書き",
      template: "発注書と作業依頼書の下書き、契約前確認メモ、追加費用確認を整理してください。",
      instruction:
        "契約前確認・発注書・作業依頼書・仕様確認・キャンセル/追加費用メモの下書きを作成してください。契約成立・法的有効性の断定は禁止。",
      mode: "practice_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    safety_ky_checklist: {
      id: "safety_ky_checklist",
      label: "現場KYチェック",
      template: "外壁塗装・足場・高所作業のKYチェックリストを作成してください。",
      instruction:
        "作業種別に応じたKYチェックリストを作成してください。安全保証はせず、有資格者・現場責任者確認を促してください。",
      mode: "practice_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    material_quantity_calc: {
      id: "material_quantity_calc",
      label: "材料数量概算",
      template: "材料数量: 120、ロス率: 8%、予備: 5、単価: 850、必要人工: 2",
      instruction: "提供された概算計算結果を説明し、現場確認・発注前の人間確認が必要と明記してください。",
      mode: "calc",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    gantt_schedule_draft: {
      id: "gantt_schedule_draft",
      label: "工程表（ガント風）",
      template:
        "準備: 2026-08-01〜2026-08-05、本体: 2026-08-06〜2026-08-20、仕上げ: 2026-08-21〜2026-08-25、予備日: 2",
      instruction:
        "テキスト表形式の工程表、担当別・日付別整理、遅延/天候リスク、遅延対応案の下書きを作成してください。確定工期ではありません。",
      mode: "practice_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    before_after_checklist: {
      id: "before_after_checklist",
      label: "作業前後チェック",
      template: "キッチン改修の作業前・作業後チェックリスト（養生、写真、清掃、引き渡し）を作成してください。",
      instruction:
        "作業前/後の確認チェックリストを作成してください。完了承認は行わず、最終確認は現場責任者または当事者と明記してください。",
      mode: "practice_assist",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
    candidate_recommendation: {
      id: "candidate_recommendation",
      label: "おすすめ候補",
      template:
        "Worker候補をおすすめ順に整理してください。案件: キッチン改修、エリア: 東京都、カテゴリ: 内装、資格: 第二種電工、希望単価: 日当2万円程度",
      instruction:
        "案件条件に合わせてWorkerまたは業者/Partner候補をおすすめ順に整理し、推薦理由・注意点・比較表・不足情報・運営確認項目を出力してください。採用確定・契約確定・業者自動決定は禁止。NGフラグは明確に注意表示。",
      mode: "recommend",
      requiresProject: false,
      allowedActors: ["owner", "partner", "admin"],
    },
  });

  const ACTION_IDS = Object.freeze(Object.keys(ACTIONS));

  function normalizeActionId(raw) {
    const id = String(raw || "").trim();
    return ACTIONS[id] ? id : "";
  }

  function getAction(actionId) {
    const id = normalizeActionId(actionId);
    return id ? { ...ACTIONS[id] } : null;
  }

  function listActions(actorType) {
    const actor = String(actorType || "guest").trim().toLowerCase();
    return ACTION_IDS.filter((id) => ACTIONS[id].allowedActors.includes(actor)).map((id) => ({
      id,
      label: ACTIONS[id].label,
      template: ACTIONS[id].template,
      requiresProject: ACTIONS[id].requiresProject,
    }));
  }

  function isActionAllowed(actionId, actorType) {
    const action = getAction(actionId);
    if (!action) return false;
    const actor = String(actorType || "guest").trim().toLowerCase();
    return action.allowedActors.includes(actor);
  }

  function buildActionUserMessage(actionId, userText, contextBlock) {
    const action = getAction(actionId);
    if (!action) return String(userText || "").trim();
    const parts = [String(userText || action.template).trim()];
    if (contextBlock) parts.push("", "--- 案件コンテキスト（参考・要約） ---", contextBlock);
    parts.push("", `【出力指示】${action.instruction}`);
    return parts.filter(Boolean).join("\n");
  }

  global.TasuBuilderAIActions = {
    ACTIONS,
    ACTION_IDS,
    normalizeActionId,
    getAction,
    listActions,
    isActionAllowed,
    buildActionUserMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
