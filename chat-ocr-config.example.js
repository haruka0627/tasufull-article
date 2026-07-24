/**
 * OCR 設定（このファイルを chat-ocr-config.js にコピー）
 *
 * provider:
 * - "none"       … OCR スキップ（テキスト審査のみ）
 * - "tesseract"  … ブラウザ内 Tesseract.js（簡易・APIキー不要）
 * - "gemini"     … Edge `/api/gemini-ocr`（GEMINI_API_KEY はサーバのみ）
 * - "cloudflare" … 未実装
 */
window.TASU_CHAT_OCR_CONFIG = {
  provider: "gemini",
  gemini: {
    endpoint: "/api/gemini-ocr",
  },
  tesseract: {
    lang: "jpn+eng",
  },
};
