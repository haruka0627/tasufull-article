/**
 * Builder AI — 現場写真 Vision 診断（Gemini Vision · Gateway 経由）
 * Builder 専用 · TASFUL AI / 秘書 / DeepSeek 非混在
 */
(function (global) {
  "use strict";

  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
  const ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const ACCEPT_EXT = /\.(jpe?g|png|webp)$/i;

  const VISION_DISCLAIMER =
    "画像だけでは確定判断できません。最終判断は現地確認・専門業者判断を優先してください。";

  const PHOTO_GUIDE =
    "この相談は現場写真に基づく診断が有効です。上の「画像を選択」から jpg / png / webp の現場写真を追加してから、もう一度送信してください。";

  const TEXT_ONLY_STUB =
    "テキストのみのご相談です。写真を添付すると、劣化箇所の参考診断・材料候補・概算見積のたたき台をより具体的にお伝えできます。";

  const VISION_PHOTO_HINT = /外壁|屋根|水回り|補修|交換|劣化|状態|診断|現場写真|見積|材料|漏水|ひび|錆|塗装|タイル|防水/i;

  const FIELD_VISION_SYSTEM_PROMPT =
    "あなたは TASFUL Builder AI の現場写真診断アシスタントです。建設・住宅リフォーム現場の参考情報のみを提供します。\n\n" +
    "【回答に必ず含める項目（見出し付きで整理）】\n" +
    "1. 画像から見える範囲\n" +
    "2. 想定される状態\n" +
    "3. 補修で済む可能性\n" +
    "4. 交換が必要な可能性\n" +
    "5. 追加確認すべき点\n" +
    "6. 材料候補\n" +
    "7. 概算見積の参考レンジ（幅を持たせた参考値）\n" +
    "8. 注意事項\n\n" +
    "【必須免責（回答末尾）】\n" +
    VISION_DISCLAIMER +
    "\n\n" +
    "【禁止】採用確定・契約成立・請求確定・施工可否の断定・構造/安全/法適合の断定。\n" +
    "不明点は「現地確認が必要」と明記してください。TASFUL AI Workspace や AI 秘書の代わりにはなりません。";

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  }

  function stripDataUrlPrefix(dataUrl) {
    const s = String(dataUrl || "");
    const idx = s.indexOf(",");
    return idx >= 0 ? s.slice(idx + 1) : s;
  }

  function mimeFromFile(file) {
    const type = String(file?.type || "").toLowerCase();
    if (ACCEPT_TYPES.includes(type)) return type;
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }

  function isAcceptedImage(file) {
    if (!file) return false;
    if (ACCEPT_TYPES.includes(file.type)) return true;
    return ACCEPT_EXT.test(String(file.name || ""));
  }

  function isImageTooLarge(file) {
    return Number(file?.size || 0) > MAX_IMAGE_BYTES;
  }

  function needsSitePhoto(text) {
    return VISION_PHOTO_HINT.test(String(text || ""));
  }

  function buildSystemPrompt(actor) {
    const role = actor?.label || actor?.actorType || "guest";
    return `${FIELD_VISION_SYSTEM_PROMPT}\n\n利用者ロール: ${role}`;
  }

  function ensureDisclaimer(text) {
    const body = String(text || "").trim();
    if (!body) return VISION_DISCLAIMER;
    if (body.includes("確定判断できません") || body.includes(VISION_DISCLAIMER)) return body;
    return `${body}\n\n${VISION_DISCLAIMER}`;
  }

  function formatForDisplay(draft) {
    const body = String(draft || "")
      .replace(/^【下書き・確認用】\s*/u, "")
      .replace(/\n\n---\n※本回答は AI 下書きです.*$/su, "")
      .trim();
    return ensureDisclaimer(body);
  }

  function mockVisionReply(userText, hasImage) {
    const topic = String(userText || "").slice(0, 80);
    const imageLine = hasImage
      ? "添付画像から、外装・部材の劣化や施工痕跡が確認できる範囲で整理しました（モック）。"
      : "写真がないため、一般的な参考情報のみです（モック）。";
    return ensureDisclaimer(
      [
        "【モック · Vision 参考回答】",
        "",
        "1. 画像から見える範囲",
        `- ${imageLine}`,
        "",
        "2. 想定される状態",
        "- 経年劣化または施工上の不具合の可能性があります（要現地確認）。",
        "",
        "3. 補修で済む可能性",
        "- 部分補修・部分塗装・シーリング打替え等で済むケースがあります。",
        "",
        "4. 交換が必要な可能性",
        "- 下地劣化・広範囲の剥離・機能不全がある場合は部材交換を検討。",
        "",
        "5. 追加確認すべき点",
        "- 触診・含水率・裏側の状態・近隣部材への影響。",
        "",
        "6. 材料候補",
        "- 用途に応じたシーリング材 / 塗料 / パッキン / 部材メーカー指定品（現地で選定）。",
        "",
        "7. 概算見積の参考レンジ",
        "- 部分補修: 数万円〜 / 部材交換: 数万〜数十万円（幅広く、現調後に精査）。",
        "",
        "8. 注意事項",
        `- 相談内容: ${topic || "（未入力）"}`,
        "- 本番では Edge 経由の Gemini Vision 応答に置き換わります。",
      ].join("\n")
    );
  }

  /**
   * @param {File} file
   * @returns {Promise<object>}
   */
  async function fileToImageAttachment(file) {
    if (!isAcceptedImage(file)) {
      throw new Error("unsupported_type");
    }
    if (isImageTooLarge(file)) {
      throw new Error("too_large");
    }
    const dataUrl = await readAsDataURL(file);
    return {
      name: String(file.name || "site-photo.jpg").slice(0, 200),
      mimeType: mimeFromFile(file),
      kind: "image",
      base64: stripDataUrlPrefix(dataUrl),
      sizeBytes: Number(file.size) || 0,
    };
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
  async function runFieldDiagnosis(params) {
    const userText = String(params?.userText || "").trim();
    if (!userText) {
      return { ok: false, error: "empty_text", reply: "" };
    }

    const Core = global.TasuBuilderAICore;
    if (!Core?.runFieldVision) {
      return { ok: false, error: "core_missing", reply: "Builder AI Vision モジュールが読み込まれていません。" };
    }

    const photoFile = params?.photoFile || null;
    let attachments = [];

    if (photoFile) {
      try {
        attachments = [await fileToImageAttachment(photoFile)];
      } catch (err) {
        const code = String(err?.message || err);
        if (code === "too_large") {
          return { ok: false, error: "image_too_large", reply: `画像は ${MAX_IMAGE_MB}MB 以下にしてください。` };
        }
        if (code === "unsupported_type") {
          return { ok: false, error: "unsupported_type", reply: "jpg / png / webp 形式の画像を選択してください。" };
        }
        return { ok: false, error: "read_failed", reply: "画像の読み込みに失敗しました。別の画像でお試しください。" };
      }
    } else if (needsSitePhoto(userText)) {
      return { ok: true, reply: PHOTO_GUIDE, usedVision: false, photoRequired: true, usedRemote: false };
    }

    const actor = params?.actor || global.TasuBuilderAIContext?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
    const history = Array.isArray(params?.messages)
      ? params.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant"))
          .map((m) => ({ role: m.role, content: String(m.content || "") }))
      : [];

    const result = await Core.runFieldVision({
      userText,
      attachments,
      actor,
      messages: history,
      preferRemote: params?.preferRemote,
    });

    let reply = formatForDisplay(result?.draft || result?.error || "");
    if (!attachments.length && result?.ok && !result?.usedRemote) {
      reply = ensureDisclaimer(`${TEXT_ONLY_STUB}\n\n${reply}`);
    }

    return {
      ok: Boolean(result?.ok && reply),
      reply,
      usedVision: attachments.length > 0,
      usedRemote: Boolean(result?.usedRemote),
      fallback_used: Boolean(result?.fallback_used),
      apiError: result?.apiError || "",
      error: result?.error || "",
    };
  }

  global.TasuBuilderAIVision = {
    MAX_IMAGE_BYTES,
    MAX_IMAGE_MB,
    VISION_DISCLAIMER,
    PHOTO_GUIDE,
    FIELD_VISION_SYSTEM_PROMPT,
    buildSystemPrompt,
    fileToImageAttachment,
    isAcceptedImage,
    isImageTooLarge,
    needsSitePhoto,
    formatForDisplay,
    mockVisionReply,
    runFieldDiagnosis,
  };
})(typeof window !== "undefined" ? window : globalThis);
