/**
 * Gemini OCR — IP rate limit (fail-closed · atomic Supabase RPC)
 *
 * - Client IP: CF-Connecting-IP only（X-Forwarded-For / X-Real-IP / body は無視）
 * - Bucket key: HMAC-SHA256(OCR_IP_RATE_HMAC_SECRET, ...) · raw IP 非保存
 * - Limits (server-fixed):
 *     burst:     10 / 60s
 *     sustained: 60 / 3600s
 * - Atomicity: consume_ocr_ip_rate_limit の条件付き UPDATE
 */
var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

export var OCR_IP_BURST_LIMIT = 10;
export var OCR_IP_BURST_WINDOW_SEC = 60;
export var OCR_IP_SUSTAINED_LIMIT = 60;
export var OCR_IP_SUSTAINED_WINDOW_SEC = 3600;

var LOCAL_ORIGINS = Object.freeze([
  "http://127.0.0.1:8788",
  "http://localhost:8788",
]);

function pickStr() {
  for (var i = 0; i < arguments.length; i += 1) {
    var s = String(arguments[i] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getSupabaseConfig(env) {
  var url = pickStr(env && env.TASFUL_SUPABASE_URL, env && env.SUPABASE_URL).replace(/\/$/, "");
  var serviceRoleKey = pickStr(env && env.SUPABASE_SERVICE_ROLE_KEY);
  return { url: url, serviceRoleKey: serviceRoleKey };
}

function assertKnownSupabaseUrl(url) {
  if (!url) return false;
  var hasStaging = url.indexOf(STAGING_REF) >= 0;
  var hasProduction = url.indexOf(PRODUCTION_REF) >= 0;
  if (hasStaging && !hasProduction) return true;
  if (hasProduction && !hasStaging) return true;
  return false;
}

export function isLocalDevOrigin(origin) {
  return LOCAL_ORIGINS.indexOf(String(origin || "")) >= 0;
}

/**
 * IPv4 / IPv6 正規化。不正値は ""。
 * IPv4-mapped IPv6 (::ffff:a.b.c.d) は IPv4 に統一。
 */
export function normalizeClientIp(raw) {
  if (typeof raw !== "string") return "";
  var value = raw.trim();
  if (!value) return "";
  // comma / 複数値 / 空白混入は拒否（spoof chain 防止）
  if (/[\s,]/.test(value)) return "";
  // zone id 拒否
  if (value.indexOf("%") >= 0) return "";

  // port 付き IPv4 (1.2.3.4:443) 拒否 — CF-Connecting-IP は port を付けない
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) return "";
  // bracket IPv6 with port ([::1]:443) 拒否
  if (/^\[.*\]:\d+$/.test(value)) return "";
  // strip optional brackets for pure IPv6
  if (value.charAt(0) === "[" && value.charAt(value.length - 1) === "]") {
    value = value.slice(1, -1);
  }

  var mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) value = mapped[1];

  if (isValidIpv4(value)) return value.toLowerCase();
  if (isValidIpv6(value)) return canonicalizeIpv6(value);
  return "";
}

function isValidIpv4(value) {
  var parts = value.split(".");
  if (parts.length !== 4) return false;
  for (var i = 0; i < 4; i += 1) {
    if (!/^\d{1,3}$/.test(parts[i])) return false;
    var n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
    // leading zero は 0 以外で拒否（octal 曖昧さ回避）
    if (parts[i].length > 1 && parts[i].charAt(0) === "0") return false;
  }
  return true;
}

function isValidIpv6(value) {
  // 簡易: 展開可能かで判定
  try {
    canonicalizeIpv6(value);
    return true;
  } catch (_e) {
    return false;
  }
}

function canonicalizeIpv6(value) {
  var lower = String(value).toLowerCase();
  if (!/^[0-9a-f:]+$/.test(lower)) throw new Error("bad_ipv6");
  if ((lower.match(/::/g) || []).length > 1) throw new Error("bad_ipv6");

  var halves = lower.split("::");
  var left = halves[0] === "" ? [] : halves[0].split(":");
  var right = halves.length === 1 ? [] : halves[1] === "" ? [] : halves[1].split(":");
  left = left.filter(Boolean);
  right = right.filter(Boolean);

  var fill = 8 - left.length - right.length;
  if (halves.length === 2) {
    if (fill < 0) throw new Error("bad_ipv6");
    if (fill === 0 && left.length + right.length !== 8) throw new Error("bad_ipv6");
  } else if (left.length !== 8) {
    throw new Error("bad_ipv6");
  } else {
    fill = 0;
  }

  var parts = left.concat(Array(Math.max(fill, 0)).fill("0")).concat(right);
  if (parts.length !== 8) throw new Error("bad_ipv6");

  return parts
    .map(function (part) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error("bad_ipv6");
      return ("0000" + part).slice(-4);
    })
    .join(":");
}

/**
 * CF-Connecting-IP のみ。欠落時:
 *   - local Origin → 127.0.0.1（開発例外）
 *   - それ以外 → fail（""）
 */
export function resolveTrustedClientIp(request, origin) {
  var headers = request && request.headers;
  var raw = headers && typeof headers.get === "function" ? headers.get("CF-Connecting-IP") : "";
  // 他 header は読まない（意図的）
  var normalized = normalizeClientIp(raw || "");
  if (normalized) return { ok: true, ip: normalized, source: "cf" };

  if (isLocalDevOrigin(origin) && (!raw || !String(raw).trim())) {
    return { ok: true, ip: "127.0.0.1", source: "local-fallback" };
  }
  return { ok: false, error: "ip_unavailable" };
}

function toHex(buffer) {
  var bytes = new Uint8Array(buffer);
  var out = "";
  for (var i = 0; i < bytes.length; i += 1) {
    out += ("0" + bytes[i].toString(16)).slice(-2);
  }
  return out;
}

async function hmacSha256Hex(secret, message) {
  var enc = new TextEncoder();
  var key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  var sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

/** ログ用 · 短い不可逆 correlation（bucket key / IP 全文は出さない） */
export function rateLimitCorrelation(bucketKey) {
  var s = String(bucketKey || "");
  if (!s) return "";
  var h = 2166136261;
  for (var i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function windowStartEpoch(nowSec, windowSec) {
  return Math.floor(nowSec / windowSec) * windowSec;
}

async function buildBucketKey(secret, ip, windowKind, windowStart) {
  // versioned material · 単純 SHA(IP) の総当たりを避ける
  return hmacSha256Hex(secret, "ocr-ip-v1|" + windowKind + "|" + windowStart + "|" + ip);
}

async function callConsumeRpc(config, body) {
  var res = await fetch(config.url + "/rest/v1/rpc/consume_ocr_ip_rate_limit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.serviceRoleKey,
      apikey: config.serviceRoleKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("rate_limit_backend");
  }
  return await res.json();
}

function unavailableResponse() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limit_unavailable",
      provider: "gemini",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

function limitedResponse(retryAfterSec) {
  var retry = Math.max(1, Math.min(3600, Math.floor(Number(retryAfterSec) || 60)));
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limited",
      provider: "gemini",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": String(retry),
      },
    }
  );
}

/**
 * @returns {Promise<{ blocked: Response|null, meta: object|null }>}
 */
export async function enforceOcrIpRateLimit(request, env, origin) {
  var resolved = resolveTrustedClientIp(request, origin);
  if (!resolved.ok) {
    console.error("[ocr-ip-rate] ip unavailable", { code: "ip_unavailable" });
    return { blocked: unavailableResponse(), meta: null };
  }

  var secret = pickStr(env && env.OCR_IP_RATE_HMAC_SECRET);
  if (!secret || secret.length < 16) {
    console.error("[ocr-ip-rate] secret missing", { code: "secret_missing" });
    return { blocked: unavailableResponse(), meta: null };
  }

  var config = getSupabaseConfig(env);
  if (!config.url || !assertKnownSupabaseUrl(config.url) || !config.serviceRoleKey) {
    console.error("[ocr-ip-rate] backend config", { code: "backend_config" });
    return { blocked: unavailableResponse(), meta: null };
  }

  var nowMs = Date.now();
  var nowSec = Math.floor(nowMs / 1000);

  var windows = [
    {
      kind: "burst",
      limit: OCR_IP_BURST_LIMIT,
      windowSec: OCR_IP_BURST_WINDOW_SEC,
    },
    {
      kind: "sustained",
      limit: OCR_IP_SUSTAINED_LIMIT,
      windowSec: OCR_IP_SUSTAINED_WINDOW_SEC,
    },
  ];

  try {
    for (var i = 0; i < windows.length; i += 1) {
      var w = windows[i];
      var start = windowStartEpoch(nowSec, w.windowSec);
      var expiresAt = new Date((start + w.windowSec) * 1000).toISOString();
      var windowStartIso = new Date(start * 1000).toISOString();
      var bucketKey = await buildBucketKey(secret, resolved.ip, w.kind, start);

      var row = await callConsumeRpc(config, {
        p_bucket_key: bucketKey,
        p_window_kind: w.kind,
        p_limit: w.limit,
        p_window_start: windowStartIso,
        p_expires_at: expiresAt,
      });

      if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.ok !== "boolean") {
        console.error("[ocr-ip-rate] malformed response", {
          code: "malformed",
          rid: rateLimitCorrelation(bucketKey),
        });
        return { blocked: unavailableResponse(), meta: null };
      }

      if (row.ok !== true) {
        if (row.error !== "rate_limited") {
          console.error("[ocr-ip-rate] backend error", {
            code: "backend_error",
            rid: rateLimitCorrelation(bucketKey),
          });
          return { blocked: unavailableResponse(), meta: null };
        }
        var retryAfter = start + w.windowSec - nowSec;
        return {
          blocked: limitedResponse(retryAfter),
          meta: {
            windowKind: w.kind,
            rid: rateLimitCorrelation(bucketKey),
          },
        };
      }
    }

    return {
      blocked: null,
      meta: { source: resolved.source },
    };
  } catch (_err) {
    console.error("[ocr-ip-rate] unavailable", { code: "backend_exception" });
    return { blocked: unavailableResponse(), meta: null };
  }
}
