/**
 * TLV Live — ZEGO Token 発行（PoC · Cloudflare Pages Function）
 * Secret: ZEGO_APP_ID · ZEGO_SERVER_SECRET · ZEGO_SERVER（任意上書き）
 * 本番公開しない · Payment/Wallet とは無関係
 */
import { buildRtcRoomPayload, generateToken04 } from "../_shared/zego-token04.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const appId = Number(env.ZEGO_APP_ID || 0);
  const serverSecret = String(env.ZEGO_SERVER_SECRET || "").trim();
  const server = String(env.ZEGO_SERVER || "").trim();

  if (!appId || !serverSecret) {
    return jsonResponse(
      {
        error: "ZEGO credentials not configured",
        hint:
          ".env に ZEGO_APP_ID と ZEGO_SERVER_SECRET（32 byte）を設定するか、PoC 画面の manual token（Console 24h）を使用してください",
        configured: false,
      },
      503,
    );
  }

  if (serverSecret.length !== 32) {
    return jsonResponse(
      {
        error: "ZEGO_SERVER_SECRET must be 32 bytes",
        configured: false,
      },
      503,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const roomId = String(body.roomId || "").trim();
  const userId = String(body.userId || "").trim();
  const role = String(body.role || "audience").trim().toLowerCase();
  if (!roomId || !userId) {
    return jsonResponse({ error: "roomId and userId are required" }, 400);
  }

  const canPublish = role === "host" || role === "publisher";
  const effectiveSeconds = Math.min(Math.max(Number(body.effectiveSeconds || 3600), 60), 86400);
  const payload = buildRtcRoomPayload({ roomId, canPublish });

  try {
    const token = await generateToken04(appId, userId, serverSecret, effectiveSeconds, payload);
    return jsonResponse({
      token,
      appId,
      server: server || undefined,
      expiresIn: effectiveSeconds,
      role: canPublish ? "host" : "audience",
      configured: true,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err?.message || "token generation failed",
        configured: true,
      },
      500,
    );
  }
}
