/**
 * TASFUL Page Gen — shared prompt builder (Phase 1 common engine)
 *
 * Produces a provider-neutral request payload. It performs no network call
 * and contains no model or endpoint knowledge, so each surface keeps its own
 * AI route (Gateway / builder_ai / BD Edge) unchanged — AD-002 · AD-003 · AD-005.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  function Slots() {
    return global.TasuPageGenSlots;
  }

  const SCOPE = Object.freeze({
    PAGE: "page",
    BLOCK: "block",
    FIELD: "field",
  });

  /** Fields the model is allowed to fill. Everything else is deterministic. */
  const DRAFT_SCHEMA = Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["hero_title", "hero_lead", "about_body"],
    properties: {
      hero_title: { type: "string", maxLength: 80 },
      hero_lead: { type: "string", maxLength: 400 },
      about_heading: { type: "string", maxLength: 80 },
      about_body: { type: "string", maxLength: 8000 },
      services: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string", maxLength: 80 },
            description: { type: "string", maxLength: 400 },
          },
        },
      },
      faq: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["q", "a"],
          properties: {
            q: { type: "string", maxLength: 120 },
            a: { type: "string", maxLength: 600 },
          },
        },
      },
      cta_label: { type: "string", maxLength: 40 },
      conversion_intent: {
        type: "string",
        enum: ["purchase", "booking", "request", "consult", "apply", "join"],
      },
      image_plan: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role", "purpose", "alt"],
          properties: {
            role: { type: "string", maxLength: 40 },
            purpose: { type: "string", maxLength: 240 },
            alt: { type: "string", maxLength: 120 },
            asset_ref: { type: "string", maxLength: 160 },
          },
        },
      },
      internal_links: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "label", "target_ref"],
          properties: {
            kind: { type: "string", maxLength: 40 },
            label: { type: "string", maxLength: 80 },
            target_ref: { type: "string", maxLength: 160 },
          },
        },
      },
      seo_title: { type: "string", maxLength: 60 },
      meta_description: { type: "string", maxLength: 160 },
    },
  });

  const CONSTRAINTS = Object.freeze([
    "出力は JSON のみ。HTML・Markdown・コードブロックを含めない。",
    "電話番号・メールアドレス・URL を書かない。",
    "「絶対」「必ず」「100%」「日本一」「最安値」などの断定・最上級表現を使わない。",
    "料金は入力された内容のみを使い、目安として書く。金額を創作しない。",
    "資格・許認可・実績の数値を創作しない。入力にないものは書かない。",
    "日本語（です・ます調）で、専門用語を避けて分かりやすく書く。",
    "入力にない事実を推測で断定しない。",
    "CTAは購入・予約・依頼・相談・応募・参加の成果から最適なものを選ぶ。",
    "外部決済・外部フォーム・Stripe直リンク・PayPal・銀行振込・LINE・メール申込へ誘導しない。",
    "内部リンクはURLではなく、与えられたTASFUL target_refだけを使用する。",
    "各画像について役割・構図の目的・具体的なALT案を作る。画像URLは生成しない。",
  ]);

  function slotFacts(doc) {
    const facts = {};
    Slots()
      .listSlots(doc?.page_kind)
      .forEach((slot) => {
        const value = Slots().readSlotValue(doc, slot);
        const filled = Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "";
        if (filled) facts[slot.id] = value;
      });
    return facts;
  }

  function contextFor(doc, options) {
    const kind = R().getPageKind(doc?.page_kind);
    return {
      page_kind: doc?.page_kind || "",
      page_kind_label: kind?.label || "",
      vertical: doc?.vertical || "",
      service_type: doc?.service_type || "",
      category: doc?.category?.name || "",
      locale: doc?.locale || "ja-JP",
      facts: slotFacts(doc),
      allowed_internal_targets: Array.isArray(options?.internalLinkCandidates)
        ? options.internalLinkCandidates.slice(0, 30)
        : [],
    };
  }

  function systemText(doc) {
    const kind = R().getPageKind(doc?.page_kind);
    return [
      `あなたは ${kind?.label || "掲載ページ"} の紹介文を作成するアシスタントです。`,
      "与えられた事実だけを使い、指定された JSON スキーマに厳密に従って出力します。",
      "生成物は下書きであり、公開前に人が確認します。",
      "",
      "制約:",
      ...CONSTRAINTS.map((c) => `- ${c}`),
    ].join("\n");
  }

  function userText(doc, options) {
    const ctx = contextFor(doc, options);
    const lines = ["以下の情報からページの文章を作成してください。", "", "# 事実"];
    Object.keys(ctx.facts).forEach((key) => {
      const slot = Slots().getSlot(key);
      const value = ctx.facts[key];
      lines.push(`- ${slot?.label || key}: ${Array.isArray(value) ? value.join("、") : value}`);
    });
    if (ctx.category) lines.push(`- カテゴリ: ${ctx.category}`);
    if (ctx.service_type) lines.push(`- 種別: ${ctx.service_type}`);
    if (ctx.allowed_internal_targets.length) {
      lines.push("", "# 使用可能なTASFUL内部リンク");
      ctx.allowed_internal_targets.forEach((target) => {
        lines.push(`- ${target.target_ref}: ${target.label || target.target_ref}`);
      });
    }
    if (options?.scope === SCOPE.BLOCK && options.blockType) {
      lines.push("", `# 対象: ${options.blockType} セクションのみ再生成してください。`);
    }
    if (options?.scope === SCOPE.FIELD && options.path) {
      lines.push("", `# 対象: ${options.path} のみ再生成してください。`);
    }
    if (options?.instruction) {
      lines.push("", "# 追加指示", String(options.instruction).slice(0, 500));
    }
    return lines.join("\n");
  }

  /**
   * @param {object} doc PageDoc
   * @param {{ scope?: string, blockType?: string, path?: string, instruction?: string }} [options]
   * @returns {object} provider-neutral payload
   */
  function buildDraftRequest(doc, options) {
    const surface = doc?.surface || "";
    return {
      purpose: "page_gen_draft",
      scope: options?.scope || SCOPE.PAGE,
      surface,
      ai_route: R().resolveAiRoute(surface),
      locale: doc?.locale || "ja-JP",
      system: systemText(doc),
      user: userText(doc, options),
      schema: DRAFT_SCHEMA,
      constraints: CONSTRAINTS.slice(),
      response_format: "json_object",
      context: contextFor(doc, options),
    };
  }

  function buildReviewRequest(doc, quality, options) {
    const issues = (quality?.issues || []).map((issue) => ({
      code: issue.code,
      dimension: issue.dimension,
      message: issue.message,
    }));
    return {
      ...buildDraftRequest(doc, {
        ...(options || {}),
        instruction:
          "以下の品質課題だけを改善してください。事実や価格を追加で創作せず、CTAはTASFUL内部フローを前提にしてください。",
      }),
      purpose: "page_gen_self_review",
      review_pass: 1,
      max_review_passes: 1,
      current_quality: {
        overall: quality?.overall || 0,
        scores: quality?.scores || {},
        issues,
      },
    };
  }

  /** Maps a model draft onto PageDoc paths (flat patch for provenance merge). */
  function draftToPatch(draft, doc) {
    const schema = S();
    const patch = {};
    if (!schema.isPlainObject(draft)) return patch;

    const blockIndex = (type) => (doc?.blocks || []).findIndex((b) => b.type === type);
    const setBlock = (type, prop, value) => {
      const i = blockIndex(type);
      if (i < 0) return;
      patch[`blocks.${i}.props.${prop}`] = value;
    };

    if (draft.hero_title != null) setBlock("hero", "title", schema.trimText(draft.hero_title, 80));
    if (draft.hero_lead != null) setBlock("hero", "lead", schema.trimText(draft.hero_lead, 400));
    if (draft.about_heading != null) setBlock("about", "heading", schema.trimText(draft.about_heading, 80));
    if (draft.about_body != null) setBlock("about", "body", schema.trimText(draft.about_body, 8000));
    if (Array.isArray(draft.services)) setBlock("services", "items", draft.services);
    if (Array.isArray(draft.faq)) setBlock("faq", "items", draft.faq);
    if (draft.cta_label != null) setBlock("cta", "label", schema.trimText(draft.cta_label, 40));
    if (draft.conversion_intent != null) {
      patch["conversion.outcome"] = schema.trimText(draft.conversion_intent, 40);
    }
    if (Array.isArray(draft.image_plan)) {
      patch.media_plan = draft.image_plan;
      (doc?.profile?.images || []).forEach((image, index) => {
        if (draft.image_plan[index]?.alt) {
          patch[`profile.images.${index}.alt`] = schema.trimText(draft.image_plan[index].alt, 120);
        }
      });
    }
    if (Array.isArray(draft.internal_links)) {
      patch.internal_links = draft.internal_links;
      setBlock("related_links", "items", draft.internal_links);
    }
    if (draft.seo_title != null) patch["seo.title"] = schema.trimText(draft.seo_title, 60);
    if (draft.meta_description != null) {
      patch["seo.description"] = schema.trimText(draft.meta_description, 160);
    }
    return patch;
  }

  /** Deterministic fallback used when the AI route is unavailable. */
  function buildFallbackDraft(doc) {
    const schema = S();
    const name = schema.trimText(doc?.profile?.name, 120) || "掲載ページ";
    const summary = schema.trimText(doc?.profile?.summary, 400);
    const areas = (doc?.profile?.areas || []).join("・");
    const price = schema.trimText(doc?.profile?.price_text, 200);
    const areaSentence = areas ? `${areas}を中心に対応しています。` : "";
    const body = [
      `${name}は${summary || "サービス"}をご提供しています。`,
      areaSentence,
      "ご相談・お見積りはお気軽にお問い合わせください。",
    ]
      .filter(Boolean)
      .join("");

    return {
      hero_title: name,
      hero_lead: summary || `${name}のご案内`,
      about_heading: "紹介",
      about_body: body,
      faq: [
        { q: "対応エリアはどこですか？", a: areas ? `${areas}を中心に対応しています。` : "お問い合わせ時にご確認ください。" },
        {
          q: "料金の目安を教えてください",
          a: price ? `目安は${price}です。詳細はご相談ください。` : "内容により異なります。まずはご相談ください。",
        },
      ],
      cta_label: "相談する",
      conversion_intent: "consult",
      image_plan: [
        {
          role: "hero",
          purpose: "サービス内容が一目で伝わるメイン画像",
          alt: `${name}のサービスイメージ`,
          asset_ref: "hero",
        },
      ],
      internal_links: [],
      seo_title: "",
      meta_description: "",
      fallback: true,
    };
  }

  global.TasuPageGenPrompt = {
    SCOPE,
    DRAFT_SCHEMA,
    CONSTRAINTS,
    contextFor,
    buildDraftRequest,
    buildReviewRequest,
    draftToPatch,
    buildFallbackDraft,
  };
})(typeof window !== "undefined" ? window : globalThis);
