/**
 * 画像 OCR（送信前審査用）
 * プロバイダ差し替え: Tesseract.js → Gemini Vision / Cloudflare AI / OCR API
 */
(function () {
  "use strict";

  /**
   * @typedef {Object} OcrExtractResult
   * @property {boolean} ok
   * @property {string} text
   * @property {string} [error]
   * @property {string} [provider]
   */

  /** @type {Promise<unknown>|null} */
  let tesseractLoadPromise = null;

  function getConfig() {
    return window.TASU_CHAT_OCR_CONFIG || {};
  }

  function getProviderName() {
    return String(getConfig().provider || "none").toLowerCase();
  }

  /**
   * SAFE-05 guard コンテキスト（user_id + surface）
   * @param {{ user_id?: string, userId?: string, surface?: string } | undefined} options
   */
  function resolveOcrGuardContext(options) {
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
    const userId = String(
      options?.user_id || options?.userId || cfg.currentUserId || cfg.userId || cfg.user_id || ""
    ).trim();
    const path = String(window.location?.pathname || "");
    const surface =
      String(options?.surface || "").trim() ||
      (/\/ai-workspace\.html$/i.test(path) ? "ai-workspace" : "");
    return { user_id: userId, surface };
  }

  function parseDataUrl(dataUrl) {
    const src = String(dataUrl || "");
    const m = src.match(/^data:([^;]+);base64,(.+)$/i);
    if (!m) return null;
    return { mimeType: m[1].trim(), base64: m[2].trim() };
  }

  /**
   * Gemini OCR（Edge `/api/gemini-ocr` · API キーはサーバのみ）
   * @param {string} imageUrl data URL
   * @param {{ user_id?: string, userId?: string, surface?: string } | undefined} options
   * @returns {Promise<OcrExtractResult>}
   */
  async function extractViaGeminiVision(imageUrl, options) {
    const parsed = parseDataUrl(imageUrl);
    if (!parsed?.base64) {
      return { ok: false, text: "", error: "invalid_data_url", provider: "gemini" };
    }
    const guard = resolveOcrGuardContext(options);
    const endpoint = String(getConfig().gemini?.endpoint || "/api/gemini-ocr").trim();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mimeType: parsed.mimeType,
        base64: parsed.base64,
        user_id: guard.user_id,
        surface: guard.surface,
        feature: "ocr_turn",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        text: "",
        error: String(data?.error || `http_${res.status}`),
        provider: "gemini",
      };
    }
    return {
      ok: true,
      text: String(data?.text || "").trim(),
      provider: "gemini",
    };
  }

  /**
   * --- 差し替え口: Cloudflare AI / 外部 OCR API ---
   * async function extractViaCloudflare(imageUrl) { ... }
   */

  function loadTesseractScript() {
    if (window.Tesseract) {
      return Promise.resolve(window.Tesseract);
    }
    if (tesseractLoadPromise) {
      return tesseractLoadPromise;
    }
    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error("Tesseract failed to load"));
      };
      script.onerror = () => reject(new Error("Tesseract script load error"));
      document.head.appendChild(script);
    });
    return tesseractLoadPromise;
  }

  /**
   * @param {string} imageUrl
   * @returns {Promise<OcrExtractResult>}
   */
  async function extractViaTesseract(imageUrl) {
    const Tesseract = await loadTesseractScript();
    const lang = getConfig().tesseract?.lang || "jpn+eng";
    const { data } = await Tesseract.recognize(imageUrl, lang, {
      logger: () => {},
    });
    return {
      ok: true,
      text: String(data?.text || "").trim(),
      provider: "tesseract",
    };
  }

  /**
   * @param {string} imageUrl
   * @param {{ user_id?: string, userId?: string, surface?: string } | undefined} options
   * @returns {Promise<OcrExtractResult>}
   */
  async function extractTextFromImage(imageUrl, options) {
    const url = String(imageUrl || "").trim();
    if (!url) {
      return { ok: true, text: "", provider: "none" };
    }

    const provider = getProviderName();
    if (provider === "none") {
      return { ok: true, text: "", provider: "none" };
    }

    try {
      if (provider === "tesseract") {
        return await extractViaTesseract(url);
      }
      if (provider === "gemini") {
        return await extractViaGeminiVision(url, options);
      }
      if (provider === "cloudflare") {
        console.warn("[TasuChat] OCR provider 'cloudflare' is not configured yet.");
        return { ok: false, text: "", error: "cloudflare_not_configured", provider: "cloudflare" };
      }
      console.warn(`[TasuChat] Unknown OCR provider: ${provider}`);
      return { ok: false, text: "", error: "unknown_provider", provider };
    } catch (err) {
      console.warn("[TasuChat] OCR extract failed:", err);
      return {
        ok: false,
        text: "",
        error: err instanceof Error ? err.message : String(err),
        provider,
      };
    }
  }

  /**
   * @param {string[]} imageUrls
   * @param {{ user_id?: string, userId?: string, surface?: string } | undefined} options
   * @returns {Promise<{ ocrText: string, results: OcrExtractResult[] }>}
   */
  async function extractTextFromImages(imageUrls, options) {
    const list = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
    if (!list.length || getProviderName() === "none") {
      return { ocrText: "", results: [] };
    }

    /** @type {OcrExtractResult[]} */
    const results = [];
    /** @type {string[]} */
    const texts = [];

    for (const url of list) {
      const result = await extractTextFromImage(url, options);
      results.push(result);
      if (result.ok && result.text) {
        texts.push(result.text);
      }
    }

    return {
      ocrText: texts.join("\n"),
      results,
    };
  }

  window.TasuChatOcr = {
    extractTextFromImage,
    extractTextFromImages,
    getProviderName,
    resolveOcrGuardContext,
  };
})();
