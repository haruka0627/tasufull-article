/**
 * Gemini Live WebSocket Proxy — Pages Function（公開 surface から隔離）
 *
 * Phase 3-A: 認証なしの残置実装を無効化（410 Gone）。
 * 本番 Live は Worker `deploy/cloudflare/workers/gemini-live-proxy.js` /
 * ローカル `scripts/dev-live-proxy.mjs`（:8789）を使用する。
 *
 * この Pages route では GEMINI_API_KEY を読まず、WebSocket upgrade もしない。
 */

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Upgrade, Connection",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === "OPTIONS") return handleOptions();

  return new Response(
    JSON.stringify({
      ok: false,
      error: "gone",
      code: "gemini_live_proxy_pages_disabled",
      message:
        "Pages gemini-live-proxy is disabled. Use the dedicated Worker or local live proxy.",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
