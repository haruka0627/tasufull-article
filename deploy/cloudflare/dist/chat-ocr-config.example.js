/**
 * OCR 設定（このファイルを chat-ocr-config.js にコピー）
 *
 * provider:
 * - "none"       … OCR スキップ（テキスト審査のみ）
 * - "tesseract"  … ブラウザ内 Tesseract.js（簡易・APIキー不要）
 * - "gemini"     … 未実装（chat-ocr.js の Gemini Vision 差し替え口）
 * - "cloudflare" … 未実装
 */
window.TASU_CHAT_OCR_CONFIG = {
  provider: "tesseract",
  tesseract: {
    lang: "jpn+eng",
  },
};
