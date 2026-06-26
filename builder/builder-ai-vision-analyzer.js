/**
 * Builder AI — Vision Analyzer（Phase 5 · Gemini Vision · JSON 正本）
 * Builder 専用 · TASFUL AI / AI 秘書 / Platform 非混在
 */
(function (global) {
  "use strict";

  const SCHEMA_VERSION = "1";

  const SAFETY_NOTICE =
    "本診断はAIの参考診断であり、断定・保証するものではありません。最終判断は現地確認・専門業者の判断を優先してください。";

  /** @type {ReadonlyArray<{ id: string, label: string, keywords: RegExp }>} */
  const DIAGNOSIS_CATEGORIES = Object.freeze([
    { id: "exterior_wall", label: "外壁", keywords: /外壁|サイディング|モルタル|塗装|ひび|クラック/i },
    { id: "roof", label: "屋根", keywords: /屋根|瓦|スレート|雨樋|棟|防水/i },
    { id: "interior", label: "室内", keywords: /室内|内装|天井|壁紙|クロス(?!汚)|間仕切/i },
    { id: "floor", label: "床", keywords: /床|フローリング|畳|タイル床|床材/i },
    { id: "wet_area", label: "水回り", keywords: /水回り|キッチン|浴室|トイレ|洗面|給排水|漏水|シンク/i },
    { id: "glass", label: "ガラス", keywords: /ガラス|サッシ|窓ガラス|飛散|結露/i },
    { id: "fixtures", label: "建具", keywords: /建具|ドア|扉|引き戸|襖|障子|ハンドル/i },
    { id: "wallpaper", label: "クロス", keywords: /クロス|壁紙|剥がれ|浮き|継ぎ目/i },
    { id: "stain", label: "汚れ", keywords: /汚れ|シミ|カビ|黒ずみ|変色|油汚れ/i },
    { id: "scratch", label: "キズ", keywords: /キズ|傷|擦れ|へこみ|凹み|欠け/i },
    { id: "other", label: "その他", keywords: /.*/ },
  ]);

  const CATEGORY_PROMPTS = Object.freeze({
    exterior_wall:
      "外壁材の劣化・ひび・塗膜剥離・シーリング状態を中心に、補修/部分塗装/全面改修の目安を整理してください。",
    roof: "屋根材・防水層・金属部の錆・瓦割れ・雨樋の状態を中心に整理してください。",
    interior: "室内の仕上げ・天井/壁の状態・生活痕跡を中心に整理してください。",
    floor: "床材の摩耗・浮き・欠け・水害痕を中心に整理してください。",
    wet_area: "水回り設備・シーリング・配管まわりの劣化・漏水兆候を中心に整理してください。",
    glass: "ガラスの傷・割れ・サッシまわりの隙間・結露痕を中心に整理してください。",
    fixtures: "建具の開閉・歪み・金物・枠の状態を中心に整理してください。",
    wallpaper: "クロス/壁紙の剥がれ・浮き・継ぎ目・水染みを中心に整理してください。",
    stain: "汚れ/シミ/カビの種類・範囲・清掃/補修の目安を中心に整理してください。",
    scratch: "キズ/擦れの深さ・下地露出の有無・部分補修可否を中心に整理してください。",
    other: "画像から読み取れる建設・リフォーム現場の参考情報を整理してください。",
  });

  function getVision() {
    return global.TasuBuilderAIVision;
  }

  function getCore() {
    return global.TasuBuilderAICore;
  }

  function detectCategory(userText) {
    const text = String(userText || "");
    for (const cat of DIAGNOSIS_CATEGORIES) {
      if (cat.id === "other") continue;
      if (cat.keywords.test(text)) return cat;
    }
    return DIAGNOSIS_CATEGORIES.find((c) => c.id === "other");
  }

  function buildStructuredVisionPrompt(category, actor) {
    const cat = category || DIAGNOSIS_CATEGORIES.find((c) => c.id === "other");
    const role = actor?.label || actor?.actorType || "guest";
    const focus = CATEGORY_PROMPTS[cat.id] || CATEGORY_PROMPTS.other;
    return (
      "あなたは TASFUL Builder AI の現場写真診断アシスタントです。建設・住宅リフォーム現場の「AIの参考診断」のみを提供します。\n\n" +
      `診断カテゴリ: ${cat.label}（${cat.id}）\n` +
      `カテゴリ焦点: ${focus}\n\n` +
      "【出力形式 — 必ず JSON のみを返す。Markdown や説明文は付けない】\n" +
      "{\n" +
      '  "version": "1",\n' +
      '  "category": "<category id>",\n' +
      '  "categoryLabel": "<日本語カテゴリ名>",\n' +
      '  "condition": "<状態の説明>",\n' +
      '  "checkItems": ["<確認事項>"],\n' +
      '  "possibleCauses": ["<考えられる原因>"],\n' +
      '  "additionalChecks": ["<追加確認推奨>"],\n' +
      '  "aiComment": "<AIコメント>"\n' +
      "}\n\n" +
      "【禁止】採用確定・契約・請求・施工可否の断定・構造/安全/法適合の断定。\n" +
      `【必須】回答は参考診断のみ。断定・保証しない。\n` +
      `利用者ロール: ${role}`
    );
  }

  function baseDiagnosis(category, overrides) {
    const cat = category || detectCategory("");
    return {
      version: SCHEMA_VERSION,
      category: cat.id,
      categoryLabel: cat.label,
      status: "reference_only",
      condition: "",
      checkItems: [],
      possibleCauses: [],
      additionalChecks: [],
      aiComment: "",
      safetyNotice: SAFETY_NOTICE,
      ...overrides,
    };
  }

  function asStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v || "").trim()).filter(Boolean).slice(0, 12);
  }

  /**
   * @param {object} raw
   * @param {{ id: string, label: string }} [fallbackCategory]
   */
  function normalizeDiagnosisJson(raw, fallbackCategory) {
    const fb = fallbackCategory || detectCategory("");
    const catId = String(raw?.category || fb.id);
    const known = DIAGNOSIS_CATEGORIES.find((c) => c.id === catId);
    return baseDiagnosis(known || fb, {
      category: known?.id || fb.id,
      categoryLabel: String(raw?.categoryLabel || known?.label || fb.label),
      condition: String(raw?.condition || "").trim(),
      checkItems: asStringList(raw?.checkItems),
      possibleCauses: asStringList(raw?.possibleCauses),
      additionalChecks: asStringList(raw?.additionalChecks),
      aiComment: String(raw?.aiComment || "").trim(),
    });
  }

  function extractJsonBlock(text) {
    const s = String(text || "").trim();
    if (!s) return null;
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* continue */
      }
    }
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function mockDiagnosis(categoryId, userText, hasImage) {
    const cat =
      DIAGNOSIS_CATEGORIES.find((c) => c.id === categoryId) ||
      detectCategory(userText);
    const imageNote = hasImage
      ? "添付画像から確認できる範囲で整理しました（モック）。"
      : "写真がないため一般的な参考情報です（モック）。";

    const templates = {
      exterior_wall: {
        condition: "外壁に経年劣化または塗膜の不均一が見られる可能性があります（要現地確認）。",
        checkItems: ["ひびの幅・深さ", "塗膜の剥離範囲", "シーリングの硬化・欠損"],
        possibleCauses: ["紫外線劣化", "基材の乾燥収縮", "施工時の下地処理不足"],
        additionalChecks: ["含水率・チョーキング", "近隣部材への影響", "足場設置可否"],
        aiComment: `${imageNote} 部分補修か部分塗装で済むケースと、下地改修が必要なケースがあります。`,
      },
      roof: {
        condition: "屋根材に劣化・汚れ・部材のずれが疑われる箇所があります（要現地確認）。",
        checkItems: ["瓦/スレートの割れ", "防水層の浮き", "雨樋・金物の錆"],
        possibleCauses: ["経年劣化", "強風・雪害の影響", "施工ジョイントの劣化"],
        additionalChecks: ["屋根裏の含水・シミ", "棟・谷の状態", "近隣との高さ差"],
        aiComment: `${imageNote} 部分補修と全面葺き替えの判断には屋根裏確認が有効です。`,
      },
      stain: {
        condition: "汚れ・シミが局所または広範囲に認められる可能性があります。",
        checkItems: ["汚れの種類（油・水・カビ）", "下地への浸透", "周辺部材への広がり"],
        possibleCauses: ["生活汚れ", "漏水痕", "カビ発生"],
        additionalChecks: ["清掃テストの可否", "臭気・触感", "再発履歴"],
        aiComment: `${imageNote} 清掃で済む場合と、下地処理が必要な場合があります。`,
      },
      scratch: {
        condition: "表面のキズ・擦れが確認できる範囲で報告されます（要現地確認）。",
        checkItems: ["キズの深さ", "下地露出の有無", "部材全体への影響"],
        possibleCauses: ["搬入時の接触", "経年摩耗", "施工時の工具痕"],
        additionalChecks: ["同色補修の可否", "周辺の浮き・剥がれ", "交換部材の在庫"],
        aiComment: `${imageNote} 部分補修・部材交換の判断には触診が必要です。`,
      },
    };

    const body = templates[cat.id] || {
      condition: "画像・相談内容から読み取れる範囲で状態を整理しました（要現地確認）。",
      checkItems: ["劣化範囲", "機能への影響", "安全上の懸念の有無"],
      possibleCauses: ["経年劣化", "施工上の要因", "外力・環境要因"],
      additionalChecks: ["触診・計測", "裏面・近隣の確認", "専門業者の現調"],
      aiComment: `${imageNote} 概算見積のたたき台としてご利用ください。`,
    };

    return normalizeDiagnosisJson(
      {
        category: cat.id,
        categoryLabel: cat.label,
        ...body,
      },
      cat
    );
  }

  function formatDiagnosisDisplay(diagnosis) {
    const d = diagnosis || baseDiagnosis();
    const lines = [
      `【診断カテゴリ】${d.categoryLabel || d.category}`,
      `【状態】${d.condition || "（要現地確認）"}`,
      "",
      "【確認事項】",
      ...(d.checkItems.length ? d.checkItems.map((x) => `・${x}`) : ["・現地での目視・触診"]),
      "",
      "【考えられる原因】",
      ...(d.possibleCauses.length ? d.possibleCauses.map((x) => `・${x}`) : ["・経年劣化等（要確認）"]),
      "",
      "【追加確認推奨】",
      ...(d.additionalChecks.length ? d.additionalChecks.map((x) => `・${x}`) : ["・専門業者による現地確認"]),
      "",
      `【AIコメント】${d.aiComment || "参考情報としてご利用ください。"}`,
      "",
      d.safetyNotice || SAFETY_NOTICE,
    ];
    return lines.join("\n");
  }

  function formatDiagnosisHtml(diagnosis) {
    const d = diagnosis || baseDiagnosis();
    const list = (items) =>
      items.length
        ? `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
        : "<p class=\"builder-ai-ui-vision-result__muted\">要現地確認</p>";

    return (
      `<div class="builder-ai-ui-vision-result__card">` +
      `<p class="builder-ai-ui-vision-result__category"><span>診断カテゴリ</span> ${escapeHtml(d.categoryLabel || d.category)}</p>` +
      `<div class="builder-ai-ui-vision-result__section"><h3>状態</h3><p>${escapeHtml(d.condition || "（要現地確認）")}</p></div>` +
      `<div class="builder-ai-ui-vision-result__section"><h3>確認事項</h3>${list(d.checkItems)}</div>` +
      `<div class="builder-ai-ui-vision-result__section"><h3>考えられる原因</h3>${list(d.possibleCauses)}</div>` +
      `<div class="builder-ai-ui-vision-result__section"><h3>追加確認推奨</h3>${list(d.additionalChecks)}</div>` +
      `<div class="builder-ai-ui-vision-result__section"><h3>AIコメント</h3><p>${escapeHtml(d.aiComment || "")}</p></div>` +
      `<p class="builder-ai-ui-vision-result__safety" role="note">${escapeHtml(d.safetyNotice || SAFETY_NOTICE)}</p>` +
      `</div>`
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {{
   *   userText?: string,
   *   photoFile?: File|null,
   *   messages?: object[],
   *   actor?: object,
   *   preferRemote?: boolean,
   * }} params
   */
  async function analyze(params) {
    const userText = String(params?.userText || "").trim();
    if (!userText) {
      return {
        ok: false,
        error: "empty_text",
        visionState: "error",
        reply: "",
        diagnosis: null,
      };
    }

    const Vision = getVision();
    const Core = getCore();
    if (!Core?.runFieldVision) {
      return {
        ok: false,
        error: "core_missing",
        visionState: "error",
        reply: "Builder AI Vision モジュールが読み込まれていません。",
        diagnosis: null,
      };
    }

    const photoFile = params?.photoFile || null;
    let attachments = [];

    if (photoFile) {
      try {
        attachments = [await Vision.fileToImageAttachment(photoFile)];
      } catch (err) {
        const code = String(err?.message || err);
        if (code === "too_large") {
          return {
            ok: false,
            error: "image_too_large",
            visionState: "error",
            reply: `画像は ${Vision.MAX_IMAGE_MB || 4}MB 以下にしてください。`,
            diagnosis: null,
          };
        }
        if (code === "unsupported_type") {
          return {
            ok: false,
            error: "unsupported_type",
            visionState: "error",
            reply: "jpg / png / webp 形式の画像を選択してください。",
            diagnosis: null,
          };
        }
        return {
          ok: false,
          error: "read_failed",
          visionState: "error",
          reply: "画像の読み込みに失敗しました。別の画像でお試しください。",
          diagnosis: null,
        };
      }
    } else if (Vision?.needsSitePhoto?.(userText)) {
      return {
        ok: true,
        reply: Vision.PHOTO_GUIDE,
        usedVision: false,
        photoRequired: true,
        usedRemote: false,
        visionState: "no_image",
        diagnosis: null,
      };
    }

    const actor = params?.actor || global.TasuBuilderAIContext?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
    const category = detectCategory(userText);
    const history = Array.isArray(params?.messages)
      ? params.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant"))
          .map((m) => ({ role: m.role, content: String(m.content || "") }))
      : [];

    const hasImage = attachments.length > 0;
    const result = await Core.runFieldVision({
      userText,
      attachments,
      actor,
      messages: history,
      preferRemote: params?.preferRemote,
      systemPromptOverride: buildStructuredVisionPrompt(category, actor),
      rawOutput: true,
    });

    let diagnosis = extractJsonBlock(result?.draft || result?.rawReply || "");
    const usedFallback = Boolean(result?.fallback_used || !result?.usedRemote);
    if (diagnosis) {
      diagnosis = normalizeDiagnosisJson(diagnosis, category);
    } else {
      diagnosis = mockDiagnosis(category.id, userText, hasImage);
      if (!usedFallback && result?.usedRemote) {
        diagnosis.aiComment = `${diagnosis.aiComment}（JSON 解析に失敗したため参考テンプレートを表示）`;
      }
    }

    let reply = formatDiagnosisDisplay(diagnosis);
    if (!hasImage && !result?.usedRemote) {
      const stub = Vision?.TEXT_ONLY_STUB || "";
      reply = stub ? `${stub}\n\n${reply}` : reply;
    }

    return {
      ok: Boolean(reply),
      reply,
      diagnosis,
      displayHtml: formatDiagnosisHtml(diagnosis),
      usedVision: hasImage,
      usedRemote: Boolean(result?.usedRemote),
      fallback_used: usedFallback || !result?.usedRemote,
      apiError: result?.apiError || "",
      error: result?.error || "",
      visionState: "complete",
      category: diagnosis.category,
      categoryLabel: diagnosis.categoryLabel,
    };
  }

  global.TasuBuilderAIVisionAnalyzer = {
    SCHEMA_VERSION,
    SAFETY_NOTICE,
    DIAGNOSIS_CATEGORIES,
    CATEGORY_PROMPTS,
    detectCategory,
    buildStructuredVisionPrompt,
    normalizeDiagnosisJson,
    extractJsonBlock,
    mockDiagnosis,
    formatDiagnosisDisplay,
    formatDiagnosisHtml,
    analyze,
  };
})(typeof window !== "undefined" ? window : globalThis);
