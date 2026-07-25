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
   * @property {string} [reason]
   * @property {string} [provider]
   * @property {boolean} [cancelled] ユーザーが送信前確認をキャンセルした
   */

  /** @type {Promise<unknown>|null} */
  let tesseractLoadPromise = null;

  /** Gemini OCR 送信先は same-origin 固定（config.gemini.endpoint は使用しない） */
  const GEMINI_OCR_ENDPOINT_PATH = "/api/gemini-ocr";

  /** Edge Function `MAX_BASE64_CHARS` と一致（base64 文字列長） */
  const SERVER_MAX_BASE64_CHARS = 6 * 1024 * 1024;
  /** decoded byte 上限（server base64 上限から換算 · client はこれを超えられない） */
  const DEFAULT_MAX_BYTES = Math.floor((SERVER_MAX_BASE64_CHARS * 3) / 4);
  const DEFAULT_TIMEOUT_MS = 15000;
  const MIN_TIMEOUT_MS = 1000;
  const MAX_TIMEOUT_MS = 30000;
  const DEFAULT_ALLOWED_MIME_TYPES = Object.freeze([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "application/pdf",
  ]);

  function getConfig() {
    return window.TASU_CHAT_OCR_CONFIG || {};
  }

  function getProviderName() {
    return String(getConfig().provider || "none").toLowerCase();
  }

  /** Function allowlist と一致（分類用 · entitlement 根拠にしない） */
  var OCR_ALLOWED_SURFACES = {
    "ai-workspace": true,
    chat: true,
    listing: true,
    "builder-ai": true,
  };

  /** 既存 caller 別名 → allowlist surface */
  var OCR_SURFACE_ALIASES = {
    chat_attachment: "chat",
    "chat-attachment": "chat",
    listing_attachment: "listing",
    "listing-attachment": "listing",
    builder_ai: "builder-ai",
    builder_ai_vision: "builder-ai",
    ai_workspace: "ai-workspace",
    workspace: "ai-workspace",
  };

  /**
   * @param {unknown} raw
   * @returns {string}
   */
  function normalizeClientOcrSurface(raw) {
    if (typeof raw !== "string") return "";
    var s = raw.trim().toLowerCase();
    if (!s) return "";
    if (OCR_SURFACE_ALIASES[s]) s = OCR_SURFACE_ALIASES[s];
    return OCR_ALLOWED_SURFACES[s] ? s : "";
  }

  /**
   * pathname から OCR 分類 surface を推論（未知は空 → Function が拒否）
   * @param {string} path
   * @returns {string}
   */
  function inferOcrSurfaceFromPath(path) {
    var p = String(path || "");
    if (/\/ai-workspace\.html$/i.test(p)) return "ai-workspace";
    if (/\/builder\/builder-ai\.html$/i.test(p) || /\/builder-ai\.html$/i.test(p)) {
      return "builder-ai";
    }
    if (/\/chat-detail\.html$/i.test(p) || /\/talk-home\.html$/i.test(p)) return "chat";
    if (/\/post\.html$/i.test(p) || /shop-market-listing/i.test(p)) return "listing";
    return "";
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
    const fromOpts = normalizeClientOcrSurface(options?.surface);
    const surface = fromOpts || inferOcrSurfaceFromPath(path);
    return { user_id: userId, surface };
  }

  function parseDataUrl(dataUrl) {
    const src = String(dataUrl || "");
    const m = src.match(/^data:([^;]+);base64,(.+)$/i);
    if (!m) return null;
    return { mimeType: m[1].trim(), base64: m[2].trim() };
  }

  function normalizeTimeoutMs(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
    if (n < MIN_TIMEOUT_MS) return DEFAULT_TIMEOUT_MS;
    if (n > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
    return Math.floor(n);
  }

  function normalizeMaxBytes(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_BYTES;
    return Math.min(Math.floor(n), DEFAULT_MAX_BYTES);
  }

  function normalizeAllowedMimeTypes(value) {
    if (!Array.isArray(value)) return DEFAULT_ALLOWED_MIME_TYPES.slice();
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i];
      if (typeof item !== "string") continue;
      const mime = item.trim().toLowerCase();
      if (mime && DEFAULT_ALLOWED_MIME_TYPES.includes(mime) && !out.includes(mime)) {
        out.push(mime);
      }
    }
    return out.length ? out : DEFAULT_ALLOWED_MIME_TYPES.slice();
  }

  /**
   * Gemini runtime 用 config snapshot（global を freeze しない）
   * @returns {{ timeoutMs: number, maxBytes: number, allowedMimeTypes: readonly string[], endpoint: string }}
   */
  function snapshotGeminiRuntimeConfig() {
    const fallback = () =>
      Object.freeze({
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxBytes: DEFAULT_MAX_BYTES,
        allowedMimeTypes: Object.freeze(DEFAULT_ALLOWED_MIME_TYPES.slice()),
        endpoint: "",
      });

    try {
      const raw = getConfig();
      let gemini = {};
      try {
        gemini =
          raw && typeof raw === "object" && raw.gemini && typeof raw.gemini === "object"
            ? raw.gemini
            : {};
      } catch {
        gemini = {};
      }

      let timeoutMs;
      let maxBytes;
      let allowedMimeTypes;
      let endpoint;
      try {
        timeoutMs = gemini.timeoutMs;
      } catch {
        timeoutMs = undefined;
      }
      try {
        maxBytes = gemini.maxBytes;
      } catch {
        maxBytes = undefined;
      }
      try {
        allowedMimeTypes = gemini.allowedMimeTypes;
      } catch {
        allowedMimeTypes = undefined;
      }
      try {
        endpoint = gemini.endpoint;
      } catch {
        endpoint = undefined;
      }

      return Object.freeze({
        timeoutMs: normalizeTimeoutMs(timeoutMs),
        maxBytes: normalizeMaxBytes(maxBytes),
        allowedMimeTypes: Object.freeze(normalizeAllowedMimeTypes(allowedMimeTypes)),
        // 互換用に保持するが fetch 先には使わない
        endpoint: typeof endpoint === "string" ? endpoint : "",
      });
    } catch {
      return fallback();
    }
  }

  function normalizeMimeType(mime) {
    if (typeof mime !== "string") return "";
    return mime.trim().toLowerCase();
  }

  /**
   * base64 → decoded byte 長（実decodeなし）。invalid は -1
   * @param {string} base64
   * @returns {number}
   */
  function estimateDecodedByteLength(base64) {
    const cleaned = String(base64 || "").replace(/\s+/g, "");
    if (!cleaned) return -1;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return -1;
    if (cleaned.length % 4 === 1) return -1;
    let padding = 0;
    if (cleaned.endsWith("==")) padding = 2;
    else if (cleaned.endsWith("=")) padding = 1;
    else if (cleaned.includes("=")) return -1;
    return Math.floor((cleaned.length * 3) / 4) - padding;
  }

  /**
   * Gemini OCR fetch URL を same-origin `/api/gemini-ocr` のみに固定する。
   * config.gemini.endpoint は読まない（改ざんによる任意 origin 送信を防止）。
   * @returns {string|null} 検証済み absolute URL · 取得不能時は null
   */
  function resolveGeminiOcrFetchUrl() {
    const originRaw = window.location && window.location.origin;
    if (typeof originRaw !== "string") return null;
    const origin = originRaw.trim();
    if (!origin || origin === "null" || origin === "undefined") return null;

    let pageOrigin;
    let url;
    try {
      pageOrigin = new URL(origin);
      url = new URL(GEMINI_OCR_ENDPOINT_PATH, pageOrigin.origin);
    } catch {
      return null;
    }

    if (
      url.origin !== pageOrigin.origin ||
      url.pathname !== GEMINI_OCR_ENDPOINT_PATH ||
      url.search !== "" ||
      url.hash !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.protocol !== pageOrigin.protocol
    ) {
      return null;
    }
    return url.href;
  }

  /**
   * Gemini OCR 成功 response の最低 shape 検証
   * @param {unknown} data
   * @returns {{ ok: true, text: string } | { ok: false, error: string }}
   */
  function normalizeGeminiOcrResponse(data) {
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "invalid_response" };
    }
    if (data.ok !== true) {
      return { ok: false, error: String(data.error || "ocr_not_ok") };
    }
    if (typeof data.text !== "string") {
      return { ok: false, error: "invalid_text" };
    }
    return { ok: true, text: data.text.trim() };
  }

  /**
   * @param {string} error
   * @param {string} [reason]
   * @param {{ cancelled?: boolean }} [extra]
   * @returns {OcrExtractResult}
   */
  function failGemini(error, reason, extra) {
    const code = String(error || "ocr_failed");
    /** @type {OcrExtractResult} */
    const result = {
      ok: false,
      text: "",
      error: code,
      reason: String(reason || code),
      provider: "gemini",
    };
    if (extra?.cancelled) result.cancelled = true;
    return result;
  }

  /** privacy gate 未ロード時は fail-closed（外部送信しない） */
  function resolvePrivacyGate() {
    try {
      const gate = window.TasuOcrPrivacyConsent;
      if (!gate || typeof gate.ensureConsent !== "function") return null;
      return gate;
    } catch {
      return null;
    }
  }

  /**
   * 外部送信前のプライバシー説明と明示操作。granted のときだけ送信してよい。
   * @param {string[]} sources data URL
   * @param {{ user_id?: string, userId?: string, surface?: string, objectUrls?: string[] } | undefined} options
   * @returns {Promise<{ granted: boolean, reason: string }>}
   */
  async function ensureGeminiOcrConsent(sources, options) {
    const gate = resolvePrivacyGate();
    if (!gate) return { granted: false, reason: "unavailable" };
    const guard = resolveOcrGuardContext(options);
    try {
      const decision = await gate.ensureConsent({
        surface: guard.surface || "unknown",
        provider: "gemini",
        sources,
        objectUrls: Array.isArray(options?.objectUrls) ? options.objectUrls : [],
      });
      return {
        granted: decision?.granted === true,
        reason: String(decision?.reason || ""),
      };
    } catch {
      return { granted: false, reason: "unavailable" };
    }
  }

  /**
   * @param {{ granted: boolean, reason: string }} consent
   * @returns {OcrExtractResult}
   */
  function consentFailure(consent) {
    if (consent.reason === "unavailable" || consent.reason === "no_source") {
      return failGemini("ocr_consent_unavailable", "ocr_consent_unavailable");
    }
    return failGemini("ocr_consent_declined", "user_cancelled", { cancelled: true });
  }

  /**
   * @param {number} status
   * @param {string} dataError
   */
  function classifyHttpError(status, dataError) {
    if (status === 413) {
      return { error: dataError || "payload_too_large", reason: "attachment_too_large" };
    }
    if (status === 415) {
      return { error: dataError || "unsupported_mime", reason: "unsupported_mime_type" };
    }
    if (status === 429) {
      return { error: dataError || "http_429", reason: "http_429" };
    }
    if (status === 401) {
      const err =
        dataError === "auth_invalid" || dataError === "auth_unavailable"
          ? dataError
          : "auth_required";
      return { error: err, reason: err };
    }
    if (status === 402) {
      return { error: dataError || "quota_exceeded", reason: "quota_exceeded" };
    }
    if (status === 403) {
      return { error: dataError || "auth_forbidden", reason: "auth_forbidden" };
    }
    if (status === 400) {
      const err = dataError || "http_400";
      return {
        error: err,
        reason: err === "invalid_surface" ? "invalid_surface" : "http_400",
      };
    }
    if (status >= 500) {
      if (dataError === "auth_unavailable") {
        return { error: "auth_unavailable", reason: "auth_unavailable" };
      }
      if (dataError === "usage_guard_unavailable") {
        return { error: "usage_guard_unavailable", reason: "usage_guard_unavailable" };
      }
      return { error: dataError || `http_${status}`, reason: "http_5xx" };
    }
    return { error: dataError || `http_${status}`, reason: `http_${status}` };
  }

  function isAbortError(err) {
    if (!err) return false;
    if (err.name === "AbortError") return true;
    return /aborted|AbortError/i.test(String(err.message || err));
  }

  /**
   * 現在の Supabase session access token（Bearer 用）
   * localStorage 直接 parse はしない。token は返却のみ・ログしない。
   * @returns {Promise<{ token: string, error: string }>}
   */
  async function resolveOcrAccessToken() {
    try {
      let sb = null;
      try {
        sb = window.TasuSupabase?.getClient?.() || null;
      } catch {
        sb = null;
      }
      if (!sb) {
        try {
          sb = window.TasuChatSupabase?.getClient?.() || null;
        } catch {
          sb = null;
        }
      }
      if (!sb || !sb.auth || typeof sb.auth.getSession !== "function") {
        return { token: "", error: "auth_unavailable" };
      }
      const res = await sb.auth.getSession();
      const token = String(res?.data?.session?.access_token || "").trim();
      if (!token) {
        return { token: "", error: "auth_required" };
      }
      return { token, error: "" };
    } catch {
      return { token: "", error: "auth_unavailable" };
    }
  }

  /**
   * Gemini OCR（Edge `/api/gemini-ocr` · API キーはサーバのみ）
   * @param {string} imageUrl data URL
   * @param {{ user_id?: string, userId?: string, surface?: string } | undefined} options
   * @param {ReturnType<typeof snapshotGeminiRuntimeConfig>} [runtimeCfg]
   * @returns {Promise<OcrExtractResult>}
   */
  async function extractViaGeminiVision(imageUrl, options, runtimeCfg) {
    const cfg = runtimeCfg || snapshotGeminiRuntimeConfig();
    const parsed = parseDataUrl(imageUrl);
    if (!parsed?.base64) {
      return failGemini("invalid_data_url", "invalid_data_url");
    }

    const mime = normalizeMimeType(parsed.mimeType);
    if (!mime || !cfg.allowedMimeTypes.includes(mime)) {
      return failGemini("unsupported_mime_type", "unsupported_mime_type");
    }

    const base64Clean = String(parsed.base64).replace(/\s+/g, "");
    if (base64Clean.length > SERVER_MAX_BASE64_CHARS) {
      return failGemini("attachment_too_large", "attachment_too_large");
    }
    const decodedBytes = estimateDecodedByteLength(base64Clean);
    if (decodedBytes < 0) {
      return failGemini("invalid_data_url", "invalid_data_url");
    }
    if (decodedBytes > cfg.maxBytes) {
      return failGemini("attachment_too_large", "attachment_too_large");
    }

    const endpoint = resolveGeminiOcrFetchUrl();
    if (!endpoint) {
      return failGemini("invalid_origin", "invalid_origin");
    }

    const auth = await resolveOcrAccessToken();
    if (!auth.token) {
      return failGemini(auth.error || "auth_required", auth.error || "auth_required");
    }

    const consent = options?._privacyGranted
      ? { granted: true, reason: "already_granted" }
      : await ensureGeminiOcrConsent([imageUrl], options);
    if (!consent.granted) {
      return consentFailure(consent);
    }

    const guard = resolveOcrGuardContext(options);
    const gate = resolvePrivacyGate();
    let succeeded = false;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }, cfg.timeoutMs);

    try {
      gate?.notifyRunStart?.();
    } catch {
      /* 状態通知の失敗で送信を止めない */
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + auth.token,
        },
        body: JSON.stringify({
          mimeType: mime,
          base64: base64Clean,
          user_id: guard.user_id,
          surface: guard.surface,
          feature: "ocr_turn",
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const dataError =
          data && typeof data === "object" && !Array.isArray(data) && data.error
            ? String(data.error)
            : "";
        const classified = classifyHttpError(res.status, dataError);
        return failGemini(classified.error, classified.reason);
      }
      const normalized = normalizeGeminiOcrResponse(data);
      if (!normalized.ok) {
        const reason =
          normalized.error === "invalid_text" || normalized.error === "invalid_response"
            ? "invalid_response"
            : normalized.error;
        return failGemini(normalized.error, reason);
      }
      succeeded = true;
      return {
        ok: true,
        text: normalized.text,
        provider: "gemini",
      };
    } catch (err) {
      if (timedOut || isAbortError(err)) {
        return failGemini("ocr_timeout", "ocr_timeout");
      }
      return failGemini(err instanceof Error ? err.message : String(err), "network_error");
    } finally {
      clearTimeout(timer);
      if (options?._skipPrivacyCleanup) {
        /* batch 側でまとめて cleanup */
      } else {
        // 同意は都度確認（使い切り）· object URL もここで解放
        try {
          gate?.notifyRunEnd?.({
            surface: guard.surface || "unknown",
            provider: "gemini",
            sources: [imageUrl],
            ok: succeeded,
          });
        } catch {
          /* cleanup 失敗で結果を変えない */
        }
      }
    }
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
    const provider = getProviderName();
    if (!list.length || provider === "none") {
      return { ocrText: "", results: [] };
    }

    /** @type {OcrExtractResult[]} */
    const results = [];
    /** @type {string[]} */
    const texts = [];
    const geminiCfg = provider === "gemini" ? snapshotGeminiRuntimeConfig() : null;

    // batch は 1 回の説明でまとめて確認（各 URL 個別に grant される）
    /** @type {{ user_id?: string, userId?: string, surface?: string, objectUrls?: string[], _privacyGranted?: boolean, _skipPrivacyCleanup?: boolean } | undefined} */
    let runOptions = options;
    if (provider === "gemini") {
      const consent = await ensureGeminiOcrConsent(list, options);
      if (!consent.granted) {
        const failure = consentFailure(consent);
        return {
          ocrText: "",
          results: list.map(() => ({ ...failure })),
        };
      }
      runOptions = Object.assign({}, options || {}, {
        _privacyGranted: true,
        _skipPrivacyCleanup: true,
      });
      try {
        resolvePrivacyGate()?.notifyRunStart?.();
      } catch {
        /* 状態通知の失敗で送信を止めない */
      }
    }

    for (const url of list) {
      let result;
      if (provider === "gemini" && geminiCfg) {
        try {
          result = await extractViaGeminiVision(url, runOptions, geminiCfg);
        } catch (err) {
          result = {
            ok: false,
            text: "",
            error: err instanceof Error ? err.message : String(err),
            provider: "gemini",
          };
        }
      } else {
        result = await extractTextFromImage(url, runOptions);
      }
      results.push(result);
      if (result.ok && result.text) {
        texts.push(result.text);
      }
    }

    if (provider === "gemini") {
      try {
        const gate = resolvePrivacyGate();
        const guard = resolveOcrGuardContext(options);
        const anyOk = results.some((r) => r.ok);
        gate?.notifyRunEnd?.({
          surface: guard.surface || "unknown",
          provider: "gemini",
          sources: list,
          ok: anyOk,
        });
      } catch {
        /* cleanup 失敗で結果を変えない */
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
