/**
 * OCR 設定（未設定時は OCR スキップ＝送信継続）
 */
window.TASU_CHAT_OCR_CONFIG = window.TASU_CHAT_OCR_CONFIG || {
  provider: "tesseract",
  tesseract: {
    lang: "jpn+eng",
  },
};
