/**
 * Minimal LiveKit Access Token (JWT HS256) for Cloudflare Workers.
 * Spec-aligned with livekit-server-sdk AccessToken grants — no npm dependency.
 * Never log apiSecret or the full token.
 */

function base64UrlFromBytes(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlFromJson(obj) {
  return base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * @param {string} apiSecret
 * @param {string} signingInput
 */
async function signHs256(apiSecret, signingInput) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return base64UrlFromBytes(sig);
}

/**
 * @param {{
 *   apiKey: string,
 *   apiSecret: string,
 *   identity: string,
 *   name?: string,
 *   roomName: string,
 *   ttlSec?: number,
 *   canPublish?: boolean,
 *   canSubscribe?: boolean,
 *   canPublishData?: boolean,
 * }} opts
 */
export async function createLiveKitAccessToken(opts) {
  const apiKey = String(opts.apiKey || "").trim();
  const apiSecret = String(opts.apiSecret || "").trim();
  const identity = String(opts.identity || "").trim();
  const roomName = String(opts.roomName || "").trim();
  if (!apiKey || !apiSecret) throw new Error("livekit_credentials_missing");
  if (!identity) throw new Error("livekit_identity_required");
  if (!roomName) throw new Error("livekit_room_required");

  const now = Math.floor(Date.now() / 1000);
  let ttl = Number(opts.ttlSec);
  if (!Number.isFinite(ttl)) ttl = 900;
  ttl = Math.max(60, Math.min(3600, Math.floor(ttl)));

  const canPublish = opts.canPublish === true;
  const canSubscribe = opts.canSubscribe !== false;
  const canPublishData = opts.canPublishData === true;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now - 10,
    exp: now + ttl,
    iat: now,
    name: String(opts.name || identity).slice(0, 128),
    video: {
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    },
  };

  const signingInput = `${base64UrlFromJson(header)}.${base64UrlFromJson(payload)}`;
  const signature = await signHs256(apiSecret, signingInput);
  return {
    token: `${signingInput}.${signature}`,
    expiresAt: payload.exp,
    ttlSec: ttl,
    identity,
    roomName,
    canPublish,
    canSubscribe,
  };
}
