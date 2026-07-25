/**
 * OCR 設定
 *
 * provider:
 * - "none"      … OCR を実行しない（添付がある場合は未検査として fail-closed）
 * - "tesseract" … ブラウザ内 OCR
 * - "gemini"    … Edge `/api/gemini-ocr`（キーはサーバのみ）
 *
 * 空抽出・OCR失敗・未検査は Commit A/B により送信停止。
 * gemini.endpoint は互換用。送信先は chat-ocr.js が same-origin `/api/gemini-ocr` に固定する。
 */
window.TASU_CHAT_OCR_CONFIG = window.TASU_CHAT_OCR_CONFIG || {
  provider: "gemini",
  gemini: {
    endpoint: "/api/gemini-ocr",
    timeoutMs: 15000,
    // decoded bytes · Edge MAX_BASE64_CHARS(6MiB) から換算した上限以下に正規化される
    maxBytes: Math.floor((6 * 1024 * 1024 * 3) / 4),
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
      "application/pdf",
    ],
  },
  tesseract: {
    lang: "jpn+eng",
  },
};
