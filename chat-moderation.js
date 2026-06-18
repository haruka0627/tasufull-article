/**
 * 送信前メッセージ審査（regex / URL）
 * 将来: Gemini・画像OCR・URL安全性チェックを差し込む
 */
(function () {
  "use strict";

  /** @typedef {"ok" | "warning" | "blocked"} ModerationLevel */

  /**
   * @typedef {Object} ModerationInput
   * @property {string} [text]
   * @property {string[]} [imageUrls]
   * @property {string} [ocrText] 画像OCRで抽出したテキスト
   * @property {string} [userId]
   * @property {string} [roomId]
   */

  /**
   * @typedef {Object} ModerationResult
   * @property {boolean} allowed
   * @property {ModerationLevel} level
   * @property {string[]} reasons
   * @property {string} message
   */

  const BLOCKED_USER_MESSAGE =
    "連絡先交換・外部誘導・危険な内容が含まれている可能性があるため、送信できません。";

  /** @type {Array<{ key: string, label: string, test: (haystack: string, lower: string) => boolean }>} */
  const BLOCK_RULES = [
    {
      key: "phone",
      label: "電話番号",
      test: (_h, lower) =>
        /(?:\+?\d{1,3}[-\s.]?)?(?:\d{2,4}[-\s.]?){2}\d{2,4}/.test(lower) ||
        /\b0\d{1,4}[-\s.]?\d{1,4}[-\s.]?\d{3,4}\b/.test(lower),
    },
    {
      key: "email",
      label: "メールアドレス",
      test: (h) => /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(h),
    },
    {
      key: "line",
      label: "LINE ID / LINE誘導",
      test: (_h, lower) =>
        /\bline\s*[@:id｜|]?\s*[a-z0-9._-]{3,}/i.test(lower) ||
        /\bline\.me\b/.test(lower) ||
        /\bline:\/\/\b/.test(lower) ||
        /ライン(id|追加|交換|で連絡)/i.test(lower) ||
        /\blineid\b/.test(lower),
    },
    {
      key: "instagram",
      label: "Instagram",
      test: (_h, lower) =>
        /\binstagram\b/.test(lower) ||
        /\binsta\b/.test(lower) ||
        /\big\s*[@:]\s*[a-z0-9._]{2,}/i.test(lower) ||
        /\binstagram\.com\b/.test(lower),
    },
    {
      key: "discord",
      label: "Discord",
      test: (_h, lower) =>
        /\bdiscord\b/.test(lower) ||
        /\bdiscord\.gg\b/.test(lower) ||
        /\bdiscordapp\.com\b/.test(lower),
    },
    {
      key: "telegram",
      label: "Telegram",
      test: (_h, lower) =>
        /\btelegram\b/.test(lower) ||
        /\bt\.me\b/.test(lower) ||
        /\btelegram\.me\b/.test(lower),
    },
    {
      key: "external_url",
      label: "外部URL",
      test: (h, lower) =>
        /\bhttps?:\/\//i.test(h) ||
        /\bwww\.\S+/i.test(h) ||
        /\b[a-z0-9-]+\.(com|net|org|jp|io|app|xyz|link|me|co)\b/i.test(lower),
    },
    {
      key: "url_shortener",
      label: "URL短縮",
      test: (_h, lower) =>
        /\b(bit\.ly|t\.co|goo\.gl|tinyurl\.com|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at)\b/.test(
          lower
        ),
    },
    {
      key: "qr_hint",
      label: "QRコード誘導",
      test: (h) => /qr\s*コード|qr\s*code|キューアール|二次元コード/i.test(h),
    },
    {
      key: "investment_scam",
      label: "投資詐欺・高リターン勧誘",
      test: (h) =>
        /投資(案件|勧誘|詐欺|で儲)|確実に(儲|利益)|高リターン|元本保証|インサイダー|fx.*(勧誘|儲)|仮想通貨.*(必|確)/i.test(
          h
        ),
    },
    {
      key: "adult",
      label: "アダルト誘導",
      test: (h) =>
        /アダルト|18禁|風俗|援交|エロ(動画|サイト)|出会(い系|系サイト)|セフレ/i.test(h),
    },
    {
      key: "personal_info",
      label: "個人情報要求",
      test: (h) =>
        /(住所|電話番号|メールアドレス|口座|クレカ|カード番号|暗証番号|マイナンバー|身分証).*(教えて|送って|共有|ください)/i.test(
          h
        ) || /個人情報.*(教えて|送って|ください)/i.test(h),
    },
  ];

  /**
   * @param {string} text
   * @param {string[]} imageUrls
   * @param {string} [ocrText]
   */
  function buildHaystack(text, imageUrls, ocrText) {
    const parts = [String(text || "").trim(), String(ocrText || "").trim()];
    for (const url of imageUrls || []) {
      const s = String(url || "").trim();
      if (!s) continue;
      if (s.startsWith("data:")) continue;
      parts.push(s);
    }
    return parts.filter(Boolean).join("\n");
  }

  /**
   * @param {ModerationInput} input
   * @returns {ModerationResult}
   */
  function moderateMessage(input) {
    const text = String(input?.text ?? "");
    const imageUrls = Array.isArray(input?.imageUrls) ? input.imageUrls : [];
    const ocrText = String(input?.ocrText ?? "");
    const haystack = buildHaystack(text, imageUrls, ocrText);
    const lower = haystack.toLowerCase();

    if (!haystack) {
      return {
        allowed: true,
        level: "ok",
        reasons: [],
        message: "",
      };
    }

    /** @type {string[]} */
    const reasons = [];

    for (const rule of BLOCK_RULES) {
      if (rule.test(haystack, lower)) {
        reasons.push(rule.label);
      }
    }

    // --- 拡張ポイント: URL安全性チェック ---
    // 検出した URL ごとに Safe Browsing / 自前ブロックリスト / リダイレクト追跡を行う。

    if (reasons.length > 0) {
      return {
        allowed: false,
        level: "blocked",
        reasons,
        message: BLOCKED_USER_MESSAGE,
      };
    }

    // --- 拡張ポイント: Gemini判定 ---
    // userId / roomId / text / imageUrls を渡し、level: "warning" | "blocked" を返す。
    // Gemini が blocked の場合は allowed: false にマージする。

    return {
      allowed: true,
      level: "ok",
      reasons: [],
      message: "",
    };
  }

  window.TasuChatModeration = {
    moderateMessage,
    BLOCKED_USER_MESSAGE,
  };
})();
