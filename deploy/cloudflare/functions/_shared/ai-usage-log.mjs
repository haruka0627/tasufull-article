/**
 * SAFE-06 — AI Usage Log ingest（Cloudflare Pages Functions）
 * service_role RPC · 失敗は握りつぶし（AI 本処理を再実行しない）
 */

var ALLOWED_FEATURES = {
  text_turn: true,
  vision_turn: true,
  ocr_turn: true,
  chat: true,
  voice_live: true,
  media_video: true,
  media_music: true,
};

var ALLOWED_PROVIDERS = {
  gemini: true,
  openai: true,
  claude: true,
  brave: true,
  serper: true,
  deepseek: true,
  unknown: true,
};

var ALLOWED_STATUSES = {
  success: true,
  error: true,
  denied: true,
};

var METADATA_ALLOWLIST = {
  surface: true,
  intent: true,
  http_status: true,
  source: true,
  quota_feature: true,
};

var METADATA_FORBIDDEN = {
  message: true,
  prompt: true,
  reply: true,
  text: true,
  content: true,
  body: true,
  history: true,
  attachments: true,
  image: true,
  base64: true,
  ocr_text: true,
  system_prompt: true,
  search_context: true,
  parts: true,
  candidates: true,
};

var MAX_METADATA_BYTES = 2048;
var UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export var USAGE_STATUS_SUCCESS = "success";
export var USAGE_STATUS_ERROR = "error";
export var USAGE_STATUS_DENIED = "denied";

function trimStr(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

export function newUsageRequestId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (_e) {
    /* fall through */
  }
  return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
}

export function isUuidLike(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function sanitizeUsageMetadata(raw) {
  if (raw == null) return { ok: true, metadata: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_metadata" };
  }
  var keys = Object.keys(raw);
  for (var i = 0; i < keys.length; i += 1) {
    if (METADATA_FORBIDDEN[keys[i]]) {
      return { ok: false, error: "metadata_forbidden_keys" };
    }
  }
  var out = {};
  for (var j = 0; j < keys.length; j += 1) {
    var key = keys[j];
    if (!METADATA_ALLOWLIST[key]) continue;
    var value = raw[key];
    if (value == null) continue;
    if (typeof value === "string") out[key] = value.trim().slice(0, 64);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.trunc(value);
    else if (typeof value === "boolean") out[key] = value;
  }
  var bytes = new TextEncoder().encode(JSON.stringify(out)).length;
  if (bytes > MAX_METADATA_BYTES) {
    return { ok: false, error: "metadata_too_large" };
  }
  return { ok: true, metadata: out };
}

function normalizeNonNeg(value) {
  if (value == null || value === "") return { ok: true, value: null };
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "invalid_units" };
  return { ok: true, value: n };
}

function getServiceConfig(env) {
  var url = trimStr(
    (env && (env.TASFUL_SUPABASE_URL || env.SUPABASE_URL)) || "",
    512
  ).replace(/\/$/, "");
  var serviceRoleKey = trimStr(
    (env && env.SUPABASE_SERVICE_ROLE_KEY) || "",
    2048
  );
  return { url: url, serviceRoleKey: serviceRoleKey };
}

/**
 * @returns {Promise<{ ok: true, duplicate: boolean } | { ok: false, error: string }>}
 */
export async function recordAiUsageEvent(input, env) {
  try {
    var requestId = trimStr(input && input.requestId, 128);
    if (requestId.length < 8) return { ok: false, error: "invalid_request_id" };

    var feature = trimStr(input && input.feature, 64).toLowerCase();
    if (!ALLOWED_FEATURES[feature]) return { ok: false, error: "invalid_feature" };

    var provider = trimStr(input && input.provider, 64).toLowerCase();
    if (!ALLOWED_PROVIDERS[provider]) return { ok: false, error: "invalid_provider" };

    var status = trimStr(input && input.status, 32).toLowerCase();
    if (!ALLOWED_STATUSES[status]) return { ok: false, error: "invalid_status" };

    var inputUnits = normalizeNonNeg(input && input.inputUnits);
    if (!inputUnits.ok) return { ok: false, error: "invalid_input_units" };
    var outputUnits = normalizeNonNeg(input && input.outputUnits);
    if (!outputUnits.ok) return { ok: false, error: "invalid_output_units" };
    var totalUnits = normalizeNonNeg(input && input.totalUnits);
    if (!totalUnits.ok) return { ok: false, error: "invalid_total_units" };
    var estimatedCost = normalizeNonNeg(input && input.estimatedCost);
    if (!estimatedCost.ok) return { ok: false, error: "invalid_estimated_cost" };

    var meta = sanitizeUsageMetadata((input && input.metadata) || null);
    if (!meta.ok) return { ok: false, error: meta.error };

    var userId = null;
    if (input && input.userId != null && String(input.userId).trim()) {
      var u = trimStr(input.userId, 128);
      if (!isUuidLike(u)) return { ok: false, error: "invalid_user_id" };
      userId = u;
    }

    var anonymousId =
      input && input.anonymousId ? trimStr(input.anonymousId, 128) || null : null;

    var config = getServiceConfig(env || {});
    if (!config.url || !config.serviceRoleKey) {
      console.error("[ai-usage-log] missing supabase service config");
      return { ok: false, error: "ingest_failed" };
    }

    var res = await fetch(config.url + "/rest/v1/rpc/ingest_ai_usage_event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.serviceRoleKey,
        apikey: config.serviceRoleKey,
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_user_id: userId,
        p_anonymous_id: anonymousId,
        p_feature: feature,
        p_provider: provider,
        p_model: input && input.model ? trimStr(input.model, 128) : null,
        p_status: status,
        p_input_units: inputUnits.value,
        p_output_units: outputUnits.value,
        p_total_units: totalUnits.value,
        p_estimated_cost: estimatedCost.value,
        p_currency:
          input && input.currency ? trimStr(input.currency, 8).toUpperCase() : "JPY",
        p_error_code: input && input.errorCode ? trimStr(input.errorCode, 128) : null,
        p_metadata: meta.metadata,
      }),
    });

    if (!res.ok) {
      console.error("[ai-usage-log] ingest http failed");
      return { ok: false, error: "ingest_failed" };
    }

    var row = null;
    try {
      row = await res.json();
    } catch (_e) {
      return { ok: false, error: "ingest_failed" };
    }

    if (row && typeof row === "object" && row.ok === false) {
      return { ok: false, error: String(row.error || "ingest_rejected") };
    }

    return {
      ok: true,
      duplicate: Boolean(row && row.duplicate === true),
    };
  } catch (_err) {
    console.error("[ai-usage-log] ingest exception");
    return { ok: false, error: "ingest_failed" };
  }
}

export function createUsageLogOnce() {
  var recorded = false;
  return {
    record: async function (input, env) {
      if (recorded) return { ok: true, duplicate: true };
      recorded = true;
      return recordAiUsageEvent(input, env);
    },
  };
}
