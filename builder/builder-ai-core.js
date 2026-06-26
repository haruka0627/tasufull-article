/**
 * Builder AI Core — Gateway 経由 draft / suggestion 生成（Builder 専用）
 */
(function (global) {
  "use strict";

  const VERSION = "1.4.0-recommend";
  const SURFACE = "builder_ai";
  const MODE_ID = "builder_ai";
  const DEFAULT_MODEL = "gemini-flash";

  const BASE_SYSTEM_PROMPT =
    "あなたは TASFUL Builder 専用 AI です。建設・リフォーム案件の業務支援に特化し、" +
    "見積・工程・提案・日報・チェックリストなどの「下書き」「案」「確認用メモ」のみを作成します。\n\n" +
    "【絶対禁止】以下を実行・断定してはいけません:\n" +
    "- 採用確定、契約成立、請求確定、支払い指示、完了承認\n" +
    "- 法的判断の断定、建築基準法適合の断定\n" +
    "- 資格が必要な工事の実施可否の断定\n" +
    "- 事故・安全・構造に関する断定\n" +
    "- 確定申告の税額断定、節税策の断定、脱税・脱法に関する助言\n\n" +
    "該当する質問には「専門家・有資格者・運営確認が必要」と案内してください。\n" +
    "すべての出力は下書きであり、最終判断は運営または当事者が行います。\n" +
    "TASFUL AI（一般 Workspace）や運営 AI秘書の代わりにはなりません。";

  const DRAFT_PREFIX = "【下書き・確認用】";
  const DRAFT_FOOTER =
    "\n\n---\n※本回答は AI 下書きです。最終判断は運営または当事者が行ってください。";

  const PROHIBITED_REPLY =
    "この操作は Builder AI では実行できません。採用・契約・請求・完了承認などの確定処理は、Builder 画面で担当者が行ってください。";

  const EXPERT_JUDGMENT_REPLY =
    "この内容はAIだけでは判断できません。運営または有資格者・専門家による確認が必要です。";

  /** @type {ReadonlyArray<{ id: string, kind: "operational"|"expert", pattern: RegExp }>} */
  const PROHIBITED_PATTERNS = Object.freeze([
    { id: "adopt_confirm", kind: "operational", pattern: /採用(?:を)?確定/i },
    { id: "contract_confirm", kind: "operational", pattern: /契約(?:を)?成立/i },
    { id: "invoice_confirm", kind: "operational", pattern: /請求(?:を)?確定/i },
    { id: "payment_order", kind: "operational", pattern: /支払(?:い)?指示/i },
    { id: "completion_approve", kind: "operational", pattern: /完了(?:を)?承認/i },
    { id: "refund_ban", kind: "operational", pattern: /返金実行|BAN実行/i },
    { id: "legal_judgment", kind: "expert", pattern: /法的.{0,16}(?:適法|違法)|違法(?:では)?ない|法律上(?:問題)?ない|(?:完全)?適法(?:ですか|と言|と断定)/i },
    { id: "building_code", kind: "expert", pattern: /建築基準法(?:上)?(?:問題)?(?:ない|適合|適合している|適合します)/i },
    { id: "structural_safety", kind: "expert", pattern: /構造(?:上)?(?:安全|問題ない|大丈夫)/i },
    { id: "seismic", kind: "expert", pattern: /耐震(?:性)?(?:は)?(?:問題ない|大丈夫|十分|適合)/i },
    {
      id: "licensed_trades",
      kind: "expert",
      pattern:
        /(?:電気|ガス|水道).*(?:施工|工事).*(?:可能|して(?:も)?(?:い|良)|できる|可否)|(?:施工|工事).*(?:電気|ガス|水道).*(?:可能|できる)|(?:有資格|資格).*(?:なし|不要|いらない).*(?:施工|工事)|(?:施工|工事).*(?:有資格|資格).*(?:不要|なし)/i,
    },
    {
      id: "major_risk",
      kind: "expert",
      pattern:
        /(?:事故|火災|漏電|ガス漏れ|雨漏り|倒壊).*(?:大丈夫|安全|問題ない|ない|起きない|断定|保証)/i,
    },
    {
      id: "absolute_claims",
      kind: "expert",
      pattern: /絶対(?:大丈夫|安全)|必ず安全|問題(?:は)?ない(?:と)?(?:断言|断定|保証)/i,
    },
    {
      id: "unqualified_work",
      kind: "expert",
      pattern: /(?:無資格|資格なし).*(?:施工|工事)|(?:施工|工事).*(?:無資格|資格なし)/i,
    },
    {
      id: "tax_amount_assertion",
      kind: "expert",
      pattern:
        /(?:所得税|住民税|確定申告).*(?:税額|納税額|いくら).*(?:断定|確定|計算して教|何円)|税額(?:は|が)\s*[\d,]+(?:円)?(?:\s*(?:です|と)?(?:確定|断定))?/i,
    },
    {
      id: "tax_evasion",
      kind: "expert",
      pattern: /脱税|逃税|税金を逃|架空経費|二帳簿|過少申報|収入を隠/i,
    },
    {
      id: "tax_saving_assertion",
      kind: "expert",
      pattern: /必ず節税|絶対.*節税|違法.*節税|脱法|バレない.*経費/i,
    },
  ]);

  function getActions() {
    return global.TasuBuilderAIActions;
  }

  function getContext() {
    return global.TasuBuilderAIContext;
  }

  function wrapDraft(text) {
    const body = String(text || "").trim();
    if (!body) return "";
    if (body.includes("AI 下書き") || body.startsWith(DRAFT_PREFIX)) return body;
    return `${DRAFT_PREFIX}\n\n${body}${DRAFT_FOOTER}`;
  }

  /**
   * @param {string} text
   * @returns {{ blocked: boolean, kind?: string, id?: string }}
   */
  function detectProhibitedIntent(text) {
    const t = String(text || "");
    for (const rule of PROHIBITED_PATTERNS) {
      if (rule.pattern.test(t)) {
        return { blocked: true, kind: rule.kind, id: rule.id };
      }
    }
    return { blocked: false };
  }

  function prohibitedReplyForKind(kind) {
    return kind === "operational" ? PROHIBITED_REPLY : EXPERT_JUDGMENT_REPLY;
  }

  function buildSystemPrompt(actionId, actor) {
    const Actions = getActions();
    const action = Actions?.getAction?.(actionId);
    const actorLine = `利用者ロール: ${actor?.label || actor?.actorType || "guest"}`;
    const scopeLine =
      actor?.actorType === "guest"
        ? "個別案件の内部情報は参照・開示しないでください。"
        : actor?.actorType === "partner"
          ? "依頼元・他社・運営内部の機密情報は開示しないでください。"
          : actor?.actorType === "owner"
            ? "協力会社内部・運営内部の機密情報は開示しないでください。"
            : "監視・整理・下書き提案に留め、確定操作は行わないでください。";
    const actionLine = action ? `現在のアクション: ${action.label}` : "";
    return [BASE_SYSTEM_PROMPT, actorLine, scopeLine, actionLine].filter(Boolean).join("\n\n");
  }

  function runDeterministicAssist(actionId, userText, contextText) {
    const Calc = global.TasuBuilderAICalculators;
    const Search = global.TasuBuilderAISearchAssist;
    const Tax = global.TasuBuilderAITaxAssist;
    const Practice = global.TasuBuilderAIPracticeAssist;
    const Recommend = global.TasuBuilderAICandidateRecommend;
    if (Calc?.isCalcAction?.(actionId)) {
      return Calc.run(actionId, userText);
    }
    if (Recommend?.isRecommendAction?.(actionId)) {
      return Recommend.run(userText, { contextText });
    }
    if (Practice?.isPracticeAction?.(actionId)) {
      return Practice.run(actionId, userText, { contextText });
    }
    if (Tax?.isTaxAssistAction?.(actionId)) {
      return Tax.run(userText, { contextText });
    }
    if (Search?.isSearchAction?.(actionId)) {
      return Search.run(actionId, userText, { contextText });
    }
    return null;
  }

  /**
   * @param {{
   *   action?: string,
   *   userText?: string,
   *   projectId?: string,
   *   actor?: object,
   *   messages?: object[],
   *   toolContext?: string,
   *   preferRemote?: boolean,
   * }} params
   */
  async function runAction(params) {
    const Actions = getActions();
    const Context = getContext();
    if (!Actions || !Context) {
      return { ok: false, error: "builder_ai_modules_missing", draft: "", action: "" };
    }

    const actionId = Actions.normalizeActionId(params?.action) || "faq_answer";
    const actor = params?.actor || Context.resolveActor({});
    const userText = String(params?.userText || "").trim();

    const intent = detectProhibitedIntent(userText);
    if (intent.blocked) {
      return {
        ok: true,
        draft: wrapDraft(prohibitedReplyForKind(intent.kind)),
        action: actionId,
        blocked: true,
        blockedKind: intent.kind,
        blockedId: intent.id,
        surface: SURFACE,
      };
    }

    if (!Actions.isActionAllowed(actionId, actor.actorType)) {
      return {
        ok: false,
        error: "action_not_allowed",
        draft: wrapDraft("この操作は現在のロールでは利用できません。"),
        action: actionId,
      };
    }

    const action = Actions.getAction(actionId);
    let contextText = String(params?.toolContext || "").trim();
    const projectId = String(params?.projectId || "").trim();

    if (action?.requiresProject) {
      if (!projectId) {
        return {
          ok: false,
          error: "project_required",
          draft: wrapDraft("案件を選択または project_id を指定してください。"),
          action: actionId,
        };
      }
      const ctx = Context.buildProjectContext(projectId, actor);
      if (!ctx.ok) {
        const msg =
          ctx.reason === "guest_no_project"
            ? "ゲストは案件情報にアクセスできません。FAQ のみご利用ください。"
            : "この案件へのアクセス権がありません。";
        return { ok: false, error: ctx.reason, draft: wrapDraft(msg), action: actionId };
      }
      contextText = [ctx.text, contextText].filter(Boolean).join("\n\n");
    } else if (projectId && actor.actorType !== "guest") {
      const ctx = Context.buildProjectContext(projectId, actor);
      if (ctx.ok) contextText = [ctx.text, contextText].filter(Boolean).join("\n\n");
    }

    const messageForAi = Actions.buildActionUserMessage(actionId, userText, contextText);
    const systemPrompt = buildSystemPrompt(actionId, actor);

    let assist = null;
    if (params?.precalc?.draftBody) {
      assist = { ok: true, draftBody: String(params.precalc.draftBody) };
    } else {
      assist = runDeterministicAssist(actionId, userText, contextText);
    }

    if (assist?.ok && assist.draftBody) {
      const preferRemote = params?.preferRemote !== false;
      const Gateway = global.TasuAiModelGateway;
      if (!preferRemote || !Gateway?.completeTurn) {
        return {
          ok: true,
          draft: wrapDraft(assist.draftBody),
          action: actionId,
          surface: SURFACE,
          deterministic: true,
          fallback_used: true,
          usedRemote: false,
        };
      }
      const turn = await Gateway.completeTurn({
        userText:
          `${messageForAi}\n\n--- 確定計算結果（数値変更禁止） ---\n${assist.draftBody}\n\n上記数値を維持し、説明・注意点のみ追記してください。`,
        modeId: MODE_ID,
        systemPrompt,
        messages: params?.messages,
        skipSearch: true,
        preferRemote: true,
        surface: SURFACE,
        modelId: DEFAULT_MODEL,
        mockFallback: () => assist.draftBody,
      });
      const draft = wrapDraft(`${assist.draftBody}\n\n---\n${turn?.reply || ""}`.trim());
      return {
        ok: Boolean(draft),
        draft,
        action: actionId,
        surface: SURFACE,
        deterministic: true,
        modelId: turn?.modelId,
        usedRemote: turn?.usedRemote,
        fallback_used: turn?.fallback_used,
        apiError: turn?.apiError || "",
      };
    }

    if (assist && !assist.ok && assist.error) {
      const hints = {
        amount_required: "税抜または税込金額・税率（8%/10%）・端数処理（四捨五入/切上/切捨）を入力してください。",
        cost_estimate_required: "原価と見積金額を入力してください（例: 原価: 800000、見積: 1200000）。",
        daily_required: "日当・人数・日数などを入力してください。",
        dates_required: "開始日・終了日を YYYY-MM-DD 形式で入力してください。",
        value_required: "変換する数値と単位（㎡/坪/畳/mm/cm/m/km）を入力してください。",
        quantity_required: "材料数量・ロス率などを入力してください（例: 材料数量: 120、ロス率: 8%）。",
      };
      return {
        ok: false,
        error: assist.error,
        draft: wrapDraft(hints[assist.error] || "計算に必要な入力が不足しています。"),
        action: actionId,
      };
    }

    const Gateway = global.TasuAiModelGateway;

    if (!Gateway?.completeTurn) {
      return {
        ok: false,
        error: "gateway_missing",
        draft: wrapDraft("AI 接続（Gateway）が読み込まれていません。chat-supabase-config.js を確認してください。"),
        action: actionId,
        surface: SURFACE,
      };
    }

    const turn = await Gateway.completeTurn({
      userText: messageForAi,
      modeId: MODE_ID,
      systemPrompt,
      messages: params?.messages,
      skipSearch: true,
      preferRemote: params?.preferRemote !== false,
      surface: SURFACE,
      modelId: DEFAULT_MODEL,
      mockFallback: () =>
        wrapDraft(
          `【モック下書き】\n\n${action?.label || actionId} についての案です。\n` +
            `入力: ${userText.slice(0, 200) || action?.template || ""}\n\n` +
            "本番では Edge 経由の LLM 応答に置き換わります。"
        ),
    });

    const draft = wrapDraft(turn?.reply || "");
    return {
      ok: Boolean(draft),
      draft,
      action: actionId,
      surface: SURFACE,
      modelId: turn?.modelId,
      modelLabel: turn?.modelLabel,
      usedRemote: turn?.usedRemote,
      fallback_used: turn?.fallback_used,
      apiError: turn?.apiError || "",
    };
  }

  /**
   * 現場写真 Vision 診断（Gateway attachments → gemini-chat）
   * @param {{
   *   userText?: string,
   *   attachments?: object[],
   *   actor?: object,
   *   messages?: object[],
   *   preferRemote?: boolean,
   * }} params
   */
  async function runFieldVision(params) {
    const userText = String(params?.userText || "").trim();
    const attachments = Array.isArray(params?.attachments) ? params.attachments : [];
    const actor = params?.actor || getContext()?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
    const Vision = global.TasuBuilderAIVision;

    const intent = detectProhibitedIntent(userText);
    if (intent.blocked) {
      return {
        ok: true,
        draft: wrapDraft(prohibitedReplyForKind(intent.kind)),
        action: "field_vision",
        blocked: true,
        blockedKind: intent.kind,
        surface: SURFACE,
      };
    }

    if (!userText) {
      return { ok: false, error: "empty_text", draft: "", action: "field_vision" };
    }

    const Gateway = global.TasuAiModelGateway;
    if (!Gateway?.completeTurn) {
      const mock = Vision?.mockVisionReply?.(userText, attachments.length > 0) || "";
      return {
        ok: Boolean(mock),
        draft: wrapDraft(mock),
        action: "field_vision",
        surface: SURFACE,
        usedRemote: false,
        fallback_used: true,
        apiError: "gateway_missing",
      };
    }

    const systemPrompt =
      params.systemPromptOverride || Vision?.buildSystemPrompt?.(actor) || BASE_SYSTEM_PROMPT;
    const hasImage = attachments.length > 0;
    const messageForAi = hasImage
      ? `${userText}\n\n（添付の現場写真を参照し、建設・住宅現場向けの参考診断として回答してください。）`
      : `${userText}\n\n（現場写真は添付されていません。テキスト情報のみに基づく一般的な参考回答としてください。）`;

    const turn = await Gateway.completeTurn({
      userText: messageForAi,
      modeId: MODE_ID,
      systemPrompt,
      messages: params?.messages,
      attachments: hasImage ? attachments : undefined,
      skipSearch: true,
      preferRemote: params?.preferRemote !== false,
      surface: SURFACE,
      modelId: DEFAULT_MODEL,
      mockFallback: () => Vision?.mockVisionReply?.(userText, hasImage) || "",
    });

    const rawReply = String(turn?.reply || "").trim();
    const draft = params.rawOutput
      ? rawReply
      : wrapDraft(Vision?.formatForDisplay?.(rawReply) || rawReply);
    return {
      ok: Boolean(draft),
      draft,
      rawReply,
      action: "field_vision",
      surface: SURFACE,
      modelId: turn?.modelId,
      modelLabel: turn?.modelLabel,
      usedRemote: turn?.usedRemote,
      fallback_used: turn?.fallback_used,
      apiError: turn?.apiError || "",
    };
  }

  /**
   * @param {string} text
   * @param {{ action?: string, projectId?: string, actor?: object, messages?: object[] }} [options]
   */
  async function query(text, options) {
    const opts = options && typeof options === "object" ? options : {};
    const Context = getContext();
    const actor = opts.actor || Context?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
    return runAction({
      action: opts.action || opts.intent || "faq_answer",
      userText: text,
      projectId: opts.projectId,
      actor,
      messages: opts.messages,
      toolContext: opts.toolContext,
      preferRemote: opts.preferRemote,
    });
  }

  global.TasuBuilderAICore = {
    VERSION,
    SURFACE,
    MODE_ID,
    BASE_SYSTEM_PROMPT,
    PROHIBITED_REPLY,
    EXPERT_JUDGMENT_REPLY,
    PROHIBITED_PATTERNS,
    wrapDraft,
    runAction,
    runFieldVision,
    query,
    runDeterministicAssist,
    detectProhibitedIntent,
    prohibitedReplyForKind,
  };
  global.TasuBuilderAI = global.TasuBuilderAICore;
})(typeof window !== "undefined" ? window : globalThis);
