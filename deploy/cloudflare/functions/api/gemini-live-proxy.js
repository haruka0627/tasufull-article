/**
 * Gemini Live WebSocket Proxy — Pages Function（開発検証用）
 *
 * TODO: wrangler dev では WebSocketPair が動作せず 500 が返るため、
 *       開発時は Node.js proxy（scripts/dev-live-proxy.mjs 相当）を使う。
 *       本番では deploy/cloudflare/workers/gemini-live-proxy.js の Worker を使う。
 *       本番 Pages で WebSocketPair が動作確認できたらこのファイルを再有効化する。
 *
 *       現在は **開発検証用の参考実装として残置**。
 */

var GEMINI_LIVE_WS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequest(context) {
  try {
    return await handleRequest(context);
  } catch (err) {
    console.error("[gemini-live-proxy] unhandled:", err.message || err);
    return new Response("Internal error: " + (err.message || "unknown"), { status: 500 });
  }
}

async function handleRequest(context) {
  var request = context.request;
  var env = context.env;

  if (request.method === "OPTIONS") return handleOptions();

  var upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    return handleWebSocketUpgrade(request, env);
  }

  // Health check for HTTP GET
  return new Response(JSON.stringify({ ok: true, protocol: "wss" }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleWebSocketUpgrade(request, env) {
  var apiKey = String(env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return new Response("GEMINI_API_KEY not configured", { status: 503 });
  }

  var geminiUrl = GEMINI_LIVE_WS + "?key=" + encodeURIComponent(apiKey);

  try {
    // Connect to Gemini Live via Cloudflare's fetch WebSocket upgrade
    var geminiResponse = await fetch(geminiUrl, {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
      },
    });

    if (!geminiResponse.ok || !geminiResponse.webSocket) {
      console.error("[gemini-live-proxy] Gemini connect failed:", geminiResponse.status);
      return new Response("Failed to connect to Gemini Live: " + geminiResponse.status, { status: 502 });
    }

    // Use WebSocketPair to relay
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
    console.error("[gemini-live-proxy]", err.message || err);
    return new Response("Proxy error: " + (err.message || "unknown"), { status: 500 });
  }
}
