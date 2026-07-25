/**
 * Gemini OCR payload validation（MIME · base64 · size · magic bytes）
 * Cloudflare Pages Function / Node test 共用
 */

export const OCR_MAX_BASE64_CHARS = 6 * 1024 * 1024;
/** client DEFAULT_MAX_BYTES と一致: floor(MAX_BASE64_CHARS * 3 / 4) */
export const OCR_MAX_DECODED_BYTES = Math.floor((OCR_MAX_BASE64_CHARS * 3) / 4);

var ALLOWED_MIME = Object.freeze({
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/gif": true,
  "image/bmp": true,
  "application/pdf": true,
});

var MIME_ALIASES = Object.freeze({
  "image/jpg": "image/jpeg",
});

var MIN_BYTES = Object.freeze({
  "image/jpeg": 3,
  "image/png": 8,
  "image/webp": 12,
  "image/gif": 6,
  "image/bmp": 14,
  "application/pdf": 5,
});

/**
 * @param {unknown} raw
 * @returns {{ ok: true, mime: string } | { ok: false, error: string, status: number }}
 */
export function normalizeOcrMimeType(raw) {
  if (typeof raw !== "string") {
    return { ok: false, error: "unsupported_mime_type", status: 415 };
  }
  var trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "unsupported_mime_type", status: 415 };
  }
  // parameters（; …）は拒否
  if (trimmed.indexOf(";") >= 0) {
    return { ok: false, error: "unsupported_mime_type", status: 415 };
  }
  var lower = trimmed.toLowerCase();
  if (MIME_ALIASES[lower]) lower = MIME_ALIASES[lower];
  if (!ALLOWED_MIME[lower]) {
    return { ok: false, error: "unsupported_mime_type", status: 415 };
  }
  return { ok: true, mime: lower };
}

/**
 * Strict standard base64（whitespace / URL-safe / data-URL 禁止）
 * @param {unknown} raw
 * @returns {{ ok: true, base64: string, estimatedBytes: number } | { ok: false, error: string, status: number }}
 */
export function validateOcrBase64Syntax(raw) {
  if (typeof raw !== "string") {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  if (!raw) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  // whitespace / control
  if (/[\s]/.test(raw)) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  // data URL / URL-safe
  if (/^data:/i.test(raw) || raw.indexOf("-") >= 0 || raw.indexOf("_") >= 0) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  if (raw.length % 4 !== 0) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  // internal '=' only allowed as padding at end
  var eq = raw.indexOf("=");
  if (eq >= 0 && eq < raw.length - 2) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  if (raw.endsWith("===")) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  // padding: at most two; if one '=', previous must not be '='
  if (raw.endsWith("=") && !raw.endsWith("==") && raw.length >= 2 && raw[raw.length - 2] === "=") {
    return { ok: false, error: "invalid_base64", status: 400 };
  }

  var padding = 0;
  if (raw.endsWith("==")) padding = 2;
  else if (raw.endsWith("=")) padding = 1;
  var estimatedBytes = (raw.length / 4) * 3 - padding;
  if (!Number.isFinite(estimatedBytes) || estimatedBytes <= 0) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }

  if (raw.length > OCR_MAX_BASE64_CHARS) {
    return { ok: false, error: "attachment_too_large", status: 413 };
  }
  if (estimatedBytes > OCR_MAX_DECODED_BYTES) {
    return { ok: false, error: "attachment_too_large", status: 413 };
  }

  return { ok: true, base64: raw, estimatedBytes: estimatedBytes };
}

/**
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function decodeOcrBase64(base64) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  var binary = atob(base64);
  var out = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * @param {string} mime
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function ocrMagicMatches(mime, bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) return false;
  var min = MIN_BYTES[mime] || 0;
  if (bytes.length < min) return false;

  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mime === "image/gif") {
    // GIF87a / GIF89a
    return (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    );
  }
  if (mime === "image/webp") {
    // RIFF....WEBP
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  if (mime === "image/bmp") {
    return bytes[0] === 0x42 && bytes[1] === 0x4d;
  }
  if (mime === "application/pdf") {
    // %PDF-
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }
  return false;
}

/**
 * body から mime/base64 を取り出し、検証済み payload を返す。
 * dataUrl 互換: 抽出後に同じ厳格検証を適用。
 *
 * @param {object|null|undefined} body
 * @returns {{
 *   ok: true,
 *   mimeType: string,
 *   base64: string,
 *   bytes: Uint8Array,
 *   decodedBytes: number
 * } | {
 *   ok: false,
 *   error: string,
 *   status: number
 * }}
 */
export function validateOcrPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  var mimeRaw = body.mimeType !== undefined ? body.mimeType : body.mime;
  var base64Raw = body.base64 !== undefined ? body.base64 : body.imageBase64;

  if ((base64Raw === undefined || base64Raw === null || base64Raw === "") && body.dataUrl) {
    if (typeof body.dataUrl !== "string") {
      return { ok: false, error: "invalid_base64", status: 400 };
    }
    var m = body.dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+=*)$/);
    if (!m) {
      return { ok: false, error: "invalid_base64", status: 400 };
    }
    if (mimeRaw === undefined || mimeRaw === null || mimeRaw === "") {
      mimeRaw = m[1];
    }
    base64Raw = m[2];
  }

  var mimeResult = normalizeOcrMimeType(mimeRaw);
  if (!mimeResult.ok) return mimeResult;

  var b64Result = validateOcrBase64Syntax(base64Raw);
  if (!b64Result.ok) return b64Result;

  var bytes;
  try {
    bytes = decodeOcrBase64(b64Result.base64);
  } catch (_e) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }

  if (!bytes || bytes.length === 0) {
    return { ok: false, error: "invalid_base64", status: 400 };
  }
  if (bytes.length > OCR_MAX_DECODED_BYTES) {
    return { ok: false, error: "attachment_too_large", status: 413 };
  }

  var min = MIN_BYTES[mimeResult.mime] || 1;
  if (bytes.length < min) {
    return { ok: false, error: "payload_type_mismatch", status: 415 };
  }
  if (!ocrMagicMatches(mimeResult.mime, bytes)) {
    return { ok: false, error: "payload_type_mismatch", status: 415 };
  }

  return {
    ok: true,
    mimeType: mimeResult.mime,
    base64: b64Result.base64,
    bytes: bytes,
    decodedBytes: bytes.length,
  };
}

export function getOcrAllowedMimeTypes() {
  return Object.keys(ALLOWED_MIME);
}
