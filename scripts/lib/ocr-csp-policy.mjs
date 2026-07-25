/**
 * OCR surface CSP policies（SSOT）
 * deploy/cloudflare/_headers の OCR path ルールと一致させること。
 * production に localhost / Gemini API 直接続は含めない。
 */

export const OCR_CSP_SURFACES = Object.freeze([
  "/chat-detail.html",
  "/post.html",
  "/ai-workspace.html",
  "/builder/builder-ai.html",
]);

const SUPABASE_CONNECT = [
  "https://ddojquacsyqesrjhcvmn.supabase.co",
  "https://ahlxuyvhzqdqaojiywmu.supabase.co",
  "wss://ddojquacsyqesrjhcvmn.supabase.co",
  "wss://ahlxuyvhzqdqaojiywmu.supabase.co",
].join(" ");

const COMMON = {
  "default-src": "'self'",
  "base-uri": "'self'",
  "object-src": "'none'",
  "form-action": "'self'",
  "frame-ancestors": "'self'",
  "frame-src": "'none'",
  "manifest-src": "'self'",
  // 既存: supabase-js (jsDelivr) · pdf.js (cdnjs)
  "script-src": "'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  // Google Fonts CSS · self CSS（privacy / compat）
  "style-src": "'self' https://fonts.googleapis.com",
  "font-src": "'self' https://fonts.gstatic.com",
  // OCR preview: data/blob · chat avatar placeholder
  "img-src": "'self' data: blob: https://placehold.co",
  // pdf.js worker is CDN URL（blob worker ではない）
  "worker-src": "'self' https://cdnjs.cloudflare.com",
  "media-src": "'self' blob:",
  "connect-src": `'self' ${SUPABASE_CONNECT}`,
};

/** AI Workspace Live は same-origin session + Workers WebSocket proxy */
const AI_WORKSPACE_CONNECT = `${COMMON["connect-src"]} wss://gemini-live-proxy.tasful-article.workers.dev`;

/**
 * ai-workspace のみ style-src 'unsafe-inline' を許可する理由（F9 報告用）:
 * - ai-workspace-settings.js が設定パネル HTML に style= 属性を多数生成
 * - ai-workspace-speech-recognition.js / tts.js / live.js が <style> を動的挿入
 * - OCR 専用の最小差分では外部CSS化できない（別commit群の UI リファクタが必要）
 * script-src には 'unsafe-inline' / 'unsafe-eval' を付けない
 */
const AI_WORKSPACE_STYLE =
  "'self' https://fonts.googleapis.com 'unsafe-inline'";

function serialize(directives) {
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");
}

export const OCR_CSP_BY_PATH = Object.freeze({
  "/chat-detail.html": serialize(COMMON),
  "/post.html": serialize(COMMON),
  "/builder/builder-ai.html": serialize(COMMON),
  "/ai-workspace.html": serialize({
    ...COMMON,
    "connect-src": AI_WORKSPACE_CONNECT,
    "style-src": AI_WORKSPACE_STYLE,
  }),
});

/** style-src で 'unsafe-inline' を許す surface（上記理由） */
export const OCR_CSP_STYLE_UNSAFE_INLINE_PATHS = Object.freeze(["/ai-workspace.html"]);

export const OCR_CSP_FORBIDDEN_TOKENS = Object.freeze([
  "default-src *",
  "script-src *",
  "connect-src *",
  "img-src *",
  "style-src *",
  "'unsafe-eval'",
  "generativelanguage.googleapis.com",
  "https://*.google.com",
  "http://localhost",
  "http://127.0.0.1",
  "ws://localhost",
  "ws://127.0.0.1",
]);

/** script-src では全 surface で 'unsafe-inline' 禁止 */
export const OCR_CSP_DISALLOW_SCRIPT_UNSAFE_INLINE = true;
