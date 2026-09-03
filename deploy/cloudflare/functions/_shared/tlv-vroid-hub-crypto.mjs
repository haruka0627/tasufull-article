/**
 * PKCE (RFC 7636 S256) + AES-GCM cookie payloads for VRoid Hub tokens.
 * Tokens never go to the browser as JSON. Cookie is HttpOnly.
 */

const TE = new TextEncoder();
const TD = new TextDecoder();

function b64url(bytes) {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return b64;
}

function b64urlFromBuf(buf) {
  return b64url(new Uint8Array(buf));
}

function b64urlDecode(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = String(s).replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n) {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
}

export function generatePkceVerifier() {
  // RFC 7636: 43–128 unreserved chars
  const raw = b64urlFromBuf(randomBytes(32).buffer);
  return raw.length >= 43 ? raw : `${raw}${b64urlFromBuf(randomBytes(16).buffer)}`.slice(0, 64);
}

export async function pkceChallengeS256(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", TE.encode(verifier));
  return b64urlFromBuf(digest);
}

export function generateOAuthState() {
  return b64urlFromBuf(randomBytes(24).buffer);
}

async function importAesKey(secret) {
  const raw = TE.encode(String(secret || ""));
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(secret, obj) {
  if (!secret) throw new Error("encryption_key_missing");
  const key = await importAesKey(secret);
  const iv = randomBytes(12);
  const pt = TE.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return `${b64url(iv)}.${b64urlFromBuf(ct)}`;
}

export async function decryptJson(secret, packed) {
  if (!secret || !packed || String(packed).indexOf(".") < 0) return null;
  try {
    const [ivB, ctB] = String(packed).split(".");
    const key = await importAesKey(secret);
    const iv = b64urlDecode(ivB);
    const ct = b64urlDecode(ctB);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return JSON.parse(TD.decode(pt));
  } catch {
    return null;
  }
}

const SENSITIVE_KEY =
  /^(access_token|refresh_token|token|client_secret|code_verifier|code|authorization|secret)$/i;

export function redactSecrets(value, depth = 0) {
  if (depth > 8) return "[max-depth]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (/^Bearer\s+\S+/i.test(value)) return "Bearer [redacted]";
    if (/blob\.core\.windows|X-Amz-Signature|X-Amz-Credential|presigned/i.test(value)) {
      return "[redacted-url]";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k) || /token|secret|verifier/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactSecrets(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function parseCookie(header, name) {
  const raw = String(header || "");
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    if (p.slice(0, eq).trim() === name) return decodeURIComponent(p.slice(eq + 1));
  }
  return "";
}

export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  parts.push(`Max-Age=${Number(opts.maxAge || 0)}`);
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function isLocalOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}
