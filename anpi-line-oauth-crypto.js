/**
 * LINE OAuth トークン等のクライアント側暗号化（AES-GCM）
 */
(function (global) {
  "use strict";

  const CRYPTO_KEY_STORAGE = "tasu_anpi_line_crypto_key_v1";

  function b64FromBytes(bytes) {
    let s = "";
    bytes.forEach((b) => {
      s += String.fromCharCode(b);
    });
    return btoa(s);
  }

  function bytesFromB64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function getOrCreateCryptoKey() {
    if (!global.crypto?.subtle) {
      throw new Error("Web Crypto API が利用できません。");
    }

    let rawB64 = "";
    try {
      rawB64 = global.sessionStorage.getItem(CRYPTO_KEY_STORAGE) || "";
    } catch {
      /* ignore */
    }

    let raw;
    if (rawB64) {
      raw = bytesFromB64(rawB64);
    } else {
      raw = global.crypto.getRandomValues(new Uint8Array(32));
      try {
        global.sessionStorage.setItem(CRYPTO_KEY_STORAGE, b64FromBytes(raw));
      } catch {
        /* ignore */
      }
    }

    return global.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }

  /**
   * @param {string} plaintext
   * @returns {Promise<string>}
   */
  async function encryptSecret(plaintext) {
    const text = String(plaintext || "");
    if (!text) return "";
    const key = await getOrCreateCryptoKey();
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const cipher = await global.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return `${b64FromBytes(iv)}.${b64FromBytes(new Uint8Array(cipher))}`;
  }

  /**
   * @param {string} payload
   * @returns {Promise<string>}
   */
  async function decryptSecret(payload) {
    const packed = String(payload || "").trim();
    if (!packed) return "";
    const [ivB64, cipherB64] = packed.split(".");
    if (!ivB64 || !cipherB64) return "";
    const key = await getOrCreateCryptoKey();
    const iv = bytesFromB64(ivB64);
    const cipher = bytesFromB64(cipherB64);
    const plain = await global.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  }

  global.TasuAnpiLineOAuthCrypto = {
    encryptSecret,
    decryptSecret,
  };
})(typeof window !== "undefined" ? window : globalThis);
