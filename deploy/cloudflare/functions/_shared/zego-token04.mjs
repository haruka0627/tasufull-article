/**
 * ZEGO Token04 生成（Cloudflare Workers / Web Crypto）
 * 参考: ZEGOCLOUD zego_server_assistant token/nodejs/token04（サーバー側のみ · secret 非公開）
 */

function packInt64BE(n) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(n), false);
  return new Uint8Array(buf);
}

function packInt16BE(n) {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * @param {number} appId
 * @param {string} userId
 * @param {string} serverSecret 32 byte
 * @param {number} effectiveTimeInSeconds
 * @param {string} [payload]
 */
export async function generateToken04(appId, userId, serverSecret, effectiveTimeInSeconds, payload = "") {
  if (!appId || typeof appId !== "number") throw new Error("appIDInvalid");
  if (!userId || typeof userId !== "string") throw new Error("userIDInvalid");
  if (!serverSecret || serverSecret.length !== 32) throw new Error("secretInvalid");
  if (!effectiveTimeInSeconds || effectiveTimeInSeconds <= 0) {
    throw new Error("effectiveTimeInSecondsInvalid");
  }

  const ctime = Math.floor(Date.now() / 1000);
  const expire = ctime + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  const tokenJson = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce,
    ctime,
    expire,
    payload: payload || "",
  });

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const keyBytes = new TextEncoder().encode(serverSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const plainBytes = new TextEncoder().encode(tokenJson);
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, plainBytes);
  const encrypted = new Uint8Array(encryptedBuffer);

  const blob = concatBytes([
    packInt64BE(expire),
    packInt16BE(iv.length),
    iv,
    packInt16BE(encrypted.length),
    encrypted,
  ]);

  return `04${bytesToBase64(blob)}`;
}

/**
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {boolean} opts.canPublish
 */
export function buildRtcRoomPayload({ roomId, canPublish }) {
  return JSON.stringify({
    room_id: roomId,
    privilege: {
      1: 1,
      2: canPublish ? 1 : 0,
    },
    stream_id_list: null,
  });
}
