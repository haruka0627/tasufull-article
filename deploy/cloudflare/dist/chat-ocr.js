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
   * --- 差し替え口: Gemini Vision ---
   * async function extractViaGeminiVision(imageUrl) {
   *   const apiKey = getConfig().gemini?.apiKey;
   *   // POST generativelanguage.googleapis.com … image + prompt でテキスト抽出
   *   return { ok: true, text: "...", provider: "gemini" };
   * }
   */

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
   * @returns {Promise<OcrExtractResult>}
   */
  async function extractTextFromImage(imageUrl) {
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
        // 差し替え口: return await extractViaGeminiVision(url);
        console.warn("[TasuChat] OCR provider 'gemini' is not configured yet.");
        return { ok: false, text: "", error: "gemini_not_configured", provider: "gemini" };
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
   * @returns {Promise<{ ocrText: string, results: OcrExtractResult[] }>}
   */
  async function extractTextFromImages(imageUrls) {
    const list = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
    if (!list.length || getProviderName() === "none") {
      return { ocrText: "", results: [] };
    }

    /** @type {OcrExtractResult[]} */
    const results = [];
    /** @type {string[]} */
    const texts = [];

    for (const url of list) {
      const result = await extractTextFromImage(url);
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
  };
})();
