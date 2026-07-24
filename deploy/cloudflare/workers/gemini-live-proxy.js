/**
 * Gemini Live WebSocket Proxy — Cloudflare Worker
 *
 * 本番用: ブラウザ → Worker → Gemini Live API
 * GEMINI_API_KEY は wrangler secret 経由で設定。ブラウザには一切露出しない。
 *
 * 認可:
 *   Phase A — Origin allowlist により TASFUL Pages からの接続のみ許可
 *   Phase B — 短命 session token（CF Pages Function で発行）による認証
 *
 * Deploy:
 *   npx wrangler deploy
 *   npx wrangler secret put GEMINI_API_KEY
 *
 * Note: 初期実装は Worker 単体で十分。
 *       長時間接続・複数接続の集中管理が必要になれば Durable Objects へ拡張可能。
 */

// Origin allowlist — 許可する接続元
var ALLOWED_ORIGINS = [
  "http://127.0.0.1:8788",
  "http://localhost:8788",
  "https://tasful-article.pages.dev",
  "https://*.tasful-article.pages.dev",
  // TODO: 本番カスタムドメイン確定後に追加
  // TODO: workers.dev のまま公開可能にする場合、Origin check + session token で保護
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  for (var i = 0; i < ALLOWED_ORIGINS.length; i++) {
    var pattern = ALLOWED_ORIGINS[i];
    if (pattern.indexOf("*.") !== -1) {
      // Wildcard: "https://*.tasful-article.pages.dev" → suffix ".tasful-article.pages.dev"
      var afterStar = pattern.slice(pattern.indexOf("*.") + 1); // ".tasful-article.pages.dev"
      var prefix = pattern.slice(0, pattern.indexOf("*"));       // "https://"
      if (origin.startsWith(prefix) && origin.endsWith(afterStar)) {
        // middle part must not contain "/" (prevents "evil.tasful-article.pages.dev.evil.com")
        var middle = origin.slice(prefix.length, origin.length - afterStar.length);
        if (middle.indexOf("/") === -1) return true;
      }
    } else if (origin === pattern) {
      return true;
    }
  }
  return false;
}

// 短命 session token 検証（Phase B）
async function verifySessionToken(token, secretRaw) {
  if (!token || !token.includes(".")) return false;
  var parts = token.split(".");
  if (parts.length !== 2) return false;
  var payloadB64 = parts[0];
  var sig = parts[1].toLowerCase();

  try {
    // JSON payload を decode
    var payloadJson = decodeURIComponent(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/").split("").map(function(c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("")));

    var payload = JSON.parse(payloadJson);

    // 有効期限チェック
    var nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) return false;

    // feature チェック
    if (payload.feature !== "voice_live_minute") return false;

    // HMAC 署名検証
    var encoder = new TextEncoder();
    var keyData = encoder.encode(secretRaw);
    var cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    var data = encoder.encode(payloadB64);
    var expectedSig = new Uint8Array(sig.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
    return await crypto.subtle.verify("HMAC", cryptoKey, expectedSig, data);
  } catch (e) {
    return false;
  }
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var origin = request.headers.get("Origin");

    // HTTP GET: health check
    var upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      // Health check は Origin チェックをスキップ
      return new Response(JSON.stringify({
        ok: true,
        protocol: "wss",
        env: "worker",
        originAllowed: origin ? isOriginAllowed(origin) : "no_origin_header",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // WebSocket upgrade: Origin チェック
    if (!origin || !isOriginAllowed(origin)) {
      return new Response(JSON.stringify({
        error: "forbidden",
        reason: "origin_not_allowed",
        origin: origin || "(missing)",
      }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // session token チェック
    var sessionToken = url.searchParams.get("session");
    if (!sessionToken) {
      return new Response(JSON.stringify({
        error: "forbidden",
        reason: "missing_session_token",
      }), { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } });
    }

    var secret = String(env.GEMINI_LIVE_SESSION_SECRET || env.GEMINI_API_KEY || "dev_secret_phase_a").trim();
    var valid = await verifySessionToken(sessionToken, secret);
    if (!valid) {
      return new Response(JSON.stringify({
        error: "forbidden",
        reason: "invalid_session_token",
      }), { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } });
    }

    var apiKey = String(env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return new Response("GEMINI_API_KEY not configured", { status: 503 });
    }

    var geminiUrl = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=" + encodeURIComponent(apiKey);

    try {
      // Connect to Gemini Live
      var geminiResponse = await fetch(geminiUrl, {
        headers: { Upgrade: "websocket" },
      });

      if (!geminiResponse.ok || !geminiResponse.webSocket) {
        return new Response("Failed to connect to Gemini Live: " + geminiResponse.status, { status: 502 });
      }

      var pair = new WebSocketPair();
      var client = pair[0];
      var server = pair[1];
      var remote = geminiResponse.webSocket;

      server.accept();

      // Client → Gemini
      server.addEventListener("message", function (event) {
        try {
          if (remote.readyState === 1) remote.send(event.data);
        } catch (e) { /* ignore */ }
      });
      server.addEventListener("close", function () {
        try { remote.close(1000, "client_closed"); } catch (e) { /* ignore */ }
      });
      server.addEventListener("error", function () {
        try { remote.close(1011, "client_error"); } catch (e) { /* ignore */ }
      });

      // Gemini → Client
      remote.addEventListener("message", function (event) {
        try {
          if (server.readyState === 1) server.send(event.data);
        } catch (e) { /* ignore */ }
      });
      remote.addEventListener("close", function () {
        try { server.close(1000, "gemini_closed"); } catch (e) { /* ignore */ }
      });
      remote.addEventListener("error", function () {
        try { server.close(1011, "gemini_error"); } catch (e) { /* ignore */ }
      });

      return new Response(null, { status: 101, webSocket: client });
    } catch (err) {
      console.error("[gemini-live-worker]", err.message || err);
      return new Response("Proxy error: " + (err.message || "unknown"), { status: 500 });
    }
  },
};
