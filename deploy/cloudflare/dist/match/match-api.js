/**
 * TASFUL MATCH — client API (client_stub demo · live production fetch)
 * Ref: reports/match-edge-jwt-design.md, reports/match-api-fetch-draft-review.md
 */
(function () {
  "use strict";

  const DEFAULT_CONFIG = Object.freeze({
    mode: "client_stub",
    functionsBaseUrl: "",
    getAuthHeaders: null,
    debugHeaders: false,
    timeoutMs: 10000,
  });

  const SWIPE_ACTIONS = ["like", "skip", "super_like"];
  const REPORT_REASONS = [
    "inappropriate_message",
    "impersonation",
    "harassment",
    "other",
  ];
  const VERIFICATION_TYPES = ["phone", "identity_document", "identity", "age"];
  const ADMIN_INTENTS = ["list_reports", "list_verifications", "list_profiles"];
  const ADMIN_ACTIONS = ["REPORT_REVIEW", "VERIFICATION_REVIEW", "PROFILE_ACTION"];
  const ADMIN_DECISIONS = {
    report: ["resolve", "dismiss"],
    verification: ["approve", "reject"],
    profile: ["suspend", "unsuspend"],
  };
  const MOD_SOURCES = ["profile", "photo", "message", "report", "system"];
  const MOD_SEVERITIES = ["low", "medium", "high", "critical"];

  const EDGE_FUNCTION_PATHS = Object.freeze({
    recordSwipe: "match-record-swipe",
    upsertProfile: "match-upsert-profile",
    uploadPhoto: "match-upload-photo",
    ensureTalkRoom: "match-ensure-talk-room",
    submitReport: "match-submit-report",
    blockUser: "match-block-user",
    submitVerification: "match-submit-verification",
    adminReview: "match-admin-review",
    moderationLog: "match-moderation-log",
    favoriteUser: "match-favorite",
    unfavoriteUser: "match-unfavorite",
    listFavorites: "match-list-favorites",
    recordProfileView: "match-record-profile-view",
    listProfileViews: "match-list-profile-views",
    saveSearch: "match-save-search",
    listSavedSearches: "match-list-saved-searches",
    deleteSavedSearch: "match-delete-saved-search",
    listPairs: "match-list-pairs",
    unmatchPair: "match-unmatch-pair",
    getCompatibility: "match-get-compatibility",
    getProfileCompleteness: "match-get-profile-completeness",
    updateActivity: "match-update-activity",
    searchProfiles: "match-search-profiles",
  });

  const FAVORITE_SOURCES = ["swipe", "profile", "search"];
  const PROFILE_VIEW_SOURCES = ["swipe_card", "profile_detail", "favorites"];

  const P15_STUB_FAVORITES = Object.freeze([
    {
      favorite_id: "00000000-0000-4000-8000-000000000101",
      target_user_id: "stub-user-yui",
      source: "profile",
      created_at: "2026-06-21T10:00:00Z",
      profile: {
        profile_id: "stub-profile-yui",
        display_name: "ゆい",
        age: 26,
        prefecture: "東京都",
        activity_label: "24時間以内に活動",
        main_photo_url: "🌸",
      },
    },
    {
      favorite_id: "00000000-0000-4000-8000-000000000102",
      target_user_id: "stub-user-kenta",
      source: "swipe",
      created_at: "2026-06-20T18:30:00Z",
      profile: {
        profile_id: "stub-profile-kenta",
        display_name: "けんた",
        age: 29,
        prefecture: "神奈川県",
        activity_label: "3日以内に活動",
        main_photo_url: "🎸",
      },
    },
  ]);

  const P15_STUB_FOOTPRINTS = Object.freeze([
    {
      viewer_user_id: "stub-user-misaki",
      footprint_label: "昨日",
      source: "profile_detail",
      profile: {
        display_name: "みさき",
        age: 25,
        activity_label: "24時間以内に活動",
        main_photo_url: "📷",
      },
    },
    {
      viewer_user_id: "stub-user-kenta",
      footprint_label: "今日",
      source: "swipe_card",
      profile: {
        display_name: "けんた",
        age: 29,
        activity_label: "3日以内に活動",
        main_photo_url: "🎸",
      },
    },
  ]);

  const P15_STUB_SAVED_SEARCHES = Object.freeze([
    {
      id: "00000000-0000-4000-8000-000000000201",
      name: "関東・20代後半",
      filters_json: {
        age_min: 25,
        age_max: 35,
        prefectures: ["東京都", "神奈川県"],
        purpose: ["love", "marriage"],
        verified_only: true,
      },
      is_default: true,
      last_used_at: null,
      updated_at: "2026-06-21T10:00:00Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      name: "カフェ好き",
      filters_json: { hobby_tag_ids: [], verified_only: false },
      is_default: false,
      last_used_at: null,
      updated_at: "2026-06-19T12:00:00Z",
    },
  ]);

  const P15_STUB_COMPLETENESS_ITEMS = Object.freeze([
    { key: "photo", label: "写真", done: true, weight: 20 },
    { key: "bio", label: "自己紹介", done: true, weight: 15 },
    { key: "birth_date", label: "年齢", done: true, weight: 10 },
    { key: "prefecture", label: "地域", done: true, weight: 10 },
    { key: "hobby", label: "趣味", done: true, weight: 15 },
    { key: "purpose", label: "目的", done: false, weight: 10 },
    { key: "relationship_view", label: "恋愛観", done: false, weight: 10 },
    { key: "verification", label: "本人確認", done: false, weight: 10 },
  ]);

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let apiConfig = {
    mode: DEFAULT_CONFIG.mode,
    functionsBaseUrl: DEFAULT_CONFIG.functionsBaseUrl,
    getAuthHeaders: DEFAULT_CONFIG.getAuthHeaders,
    debugHeaders: DEFAULT_CONFIG.debugHeaders,
    timeoutMs: DEFAULT_CONFIG.timeoutMs,
  };

  function getConfig() {
    return {
      mode: apiConfig.mode,
      functionsBaseUrl: apiConfig.functionsBaseUrl,
      getAuthHeaders: apiConfig.getAuthHeaders,
      debugHeaders: apiConfig.debugHeaders,
      timeoutMs: apiConfig.timeoutMs,
    };
  }

  function setConfig(next) {
    if (!next || typeof next !== "object") return getConfig();
    if (next.mode !== undefined) apiConfig.mode = String(next.mode);
    if (next.functionsBaseUrl !== undefined) {
      apiConfig.functionsBaseUrl = String(next.functionsBaseUrl);
    }
    if (next.getAuthHeaders !== undefined) {
      apiConfig.getAuthHeaders =
        typeof next.getAuthHeaders === "function" ? next.getAuthHeaders : null;
    }
    if (next.debugHeaders !== undefined) {
      apiConfig.debugHeaders = Boolean(next.debugHeaders);
    }
    if (next.timeoutMs !== undefined) {
      const ms = Number(next.timeoutMs);
      apiConfig.timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_CONFIG.timeoutMs;
    }
    return getConfig();
  }

  function isLiveMode() {
    var mode = currentMode();
    return mode === "live" || mode === "edge_stub";
  }

  function currentMode() {
    return apiConfig.mode || DEFAULT_CONFIG.mode;
  }

  function authContext() {
    const auth = window.TasfulMatchAuth;
    return {
      auth_mode: auth?.getState?.()?.mode || auth?.mode || "none",
      match_user_id: auth?.getMatchUserId?.() || null,
    };
  }

  function fail(code, message, extra) {
    const patch = extra && typeof extra === "object" ? extra : {};
    return { ok: false, mode: currentMode(), ...authContext(), code, message, ...patch };
  }

  function success(data) {
    return { ok: true, mode: currentMode(), ...authContext(), ...data };
  }

  function configure(options) {
    if (!options || typeof options !== "object") return getConfig();
    return setConfig(options);
  }

  function pickAuthorization(rawHeaders) {
    if (!rawHeaders || typeof rawHeaders !== "object") return "";
    const value = rawHeaders.Authorization || rawHeaders.authorization || "";
    return String(value).trim();
  }

  async function buildHeaders() {
    const cfg = getConfig();
    const provider = cfg.getAuthHeaders;
    if (typeof provider !== "function") {
      return {
        error: fail("auth_required", "Authorization header provider not configured", {
          status: 401,
        }),
      };
    }

    let authHeaders = {};
    try {
      authHeaders = await Promise.resolve(provider());
    } catch (_err) {
      return {
        error: fail("auth_required", "Failed to resolve auth headers", { status: 401 }),
      };
    }

    if (!authHeaders || typeof authHeaders !== "object") {
      authHeaders = {};
    }

    const authorization = pickAuthorization(authHeaders);
    if (!authorization) {
      return {
        error: fail("auth_required", "Authorization header required", { status: 401 }),
      };
    }

    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // x-match-user-id is debug-only; never trust client payload user_id.
    if (cfg.debugHeaders) {
      const matchUserId = window.TasfulMatchAuth?.getMatchUserId?.();
      if (matchUserId) {
        headers["x-match-user-id"] = String(matchUserId);
      }
    }

    return { headers };
  }

  function withTimeout(promise, timeoutMs) {
    const ms = Number(timeoutMs) || DEFAULT_CONFIG.timeoutMs;
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        const err = new Error("Request timed out");
        err.code = "timeout";
        reject(err);
      }, ms);

      Promise.resolve(promise).then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  function normalizeApiError(input) {
    const status = Number(input?.status) || 0;
    const data = input?.data && typeof input.data === "object" ? input.data : {};
    const code =
      typeof data.code === "string" && data.code
        ? data.code
        : typeof data.error === "string" && data.error
          ? data.error
          : status >= 500
            ? "server_error"
            : "http_error";
    const message =
      typeof data.message === "string" && data.message
        ? data.message
        : input?.defaultMessage || "Request failed";

    return {
      ok: false,
      mode: currentMode(),
      ...authContext(),
      code,
      message,
      status,
    };
  }

  async function callEdgeFunction(functionName, payload, options) {
    const cfg = getConfig();
    if (!isLiveMode()) {
      return fail("config_error", "Edge fetch is only allowed in live mode");
    }

    const base = String(cfg.functionsBaseUrl || "").trim().replace(/\/+$/, "");
    if (!base) {
      return fail("config_error", "functionsBaseUrl is not configured");
    }

    const retryOn401 = !(options && options.retryOn401 === false);
    let attemptedRefresh = false;

    async function doFetch() {
      const built = await buildHeaders();
      if (built.error) return { error: built.error };

      const url = base + "/" + String(functionName).replace(/^\/+/, "");
      const response = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: built.headers,
          body: JSON.stringify(payload),
          credentials: "omit",
        }),
        cfg.timeoutMs,
      );

      let data = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (_err) {
          data = { message: text };
        }
      }

      return { response, data };
    }

    try {
      let result = await doFetch();
      if (result.error) return result.error;

      if (
        retryOn401 &&
        !attemptedRefresh &&
        result.response &&
        (result.response.status === 401 || result.data?.code === "unauthorized")
      ) {
        const refresher = window.TasfulMatchAuth?.refreshAccessToken;
        if (typeof refresher === "function") {
          attemptedRefresh = true;
          const refreshed = await refresher();
          if (refreshed?.ok) {
            result = await doFetch();
            if (result.error) return result.error;
          }
        }
      }

      if (!result.response.ok) {
        const normalized = normalizeApiError({
          status: result.response.status,
          data: result.data,
          defaultMessage: "HTTP " + result.response.status,
        });
        if (window.MatchBetaGate?.handleApiResult?.(normalized)) {
          return normalized;
        }
        if (window.MatchLoginGate?.handleApiResult?.(normalized)) {
          return normalized;
        }
        return normalized;
      }

      const body =
        result.data && typeof result.data === "object" && !Array.isArray(result.data)
          ? result.data
          : { data: result.data };
      return {
        ok: body.ok !== false,
        mode: currentMode(),
        api_mode: "live_fetch",
        ...authContext(),
        ...body,
      };
    } catch (err) {
      if (err && err.code === "timeout") {
        return fail("timeout", "Request timed out");
      }
      return fail("network_error", err?.message || "Network error");
    }
  }

  function asObject(payload, label) {
    if (
      payload === undefined ||
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return { error: fail("validation_error", label + " must be an object") };
    }
    return { value: payload };
  }

  function requireString(field, value, maxLength) {
    if (value === undefined || value === null || value === "") {
      return { error: fail("validation_error", field + " is required") };
    }
    if (typeof value !== "string") {
      return { error: fail("validation_error", field + " must be a string") };
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return { error: fail("validation_error", field + " is required") };
    }
    if (trimmed.length > maxLength) {
      return {
        error: fail(
          "validation_error",
          field + " must be at most " + maxLength + " characters",
        ),
      };
    }
    return { value: trimmed };
  }

  function optionalString(field, value, maxLength) {
    if (value === undefined || value === null || value === "") return { value: "" };
    return requireString(field, value, maxLength);
  }

  function requireEnum(field, value, allowed) {
    const str = requireString(field, value, 64);
    if (str.error) return str;
    if (!allowed.includes(str.value)) {
      return {
        error: fail("validation_error", field + " must be one of: " + allowed.join(", ")),
      };
    }
    return str;
  }

  function requireUuidLike(field, value) {
    const str = requireString(field, value, 64);
    if (str.error) return str;
    if (!UUID_RE.test(str.value) && !str.value.startsWith("stub-")) {
      return { error: fail("validation_error", field + " must be a valid uuid") };
    }
    return str;
  }

  function requireUuid(field, value) {
    const str = requireString(field, value, 64);
    if (str.error) return str;
    if (!UUID_RE.test(str.value)) {
      return { error: fail("validation_error", field + " must be a valid uuid") };
    }
    return str;
  }

  function optionalObject(field, value) {
    if (value === undefined || value === null) return { value: {} };
    if (typeof value !== "object" || Array.isArray(value)) {
      return { error: fail("validation_error", field + " must be an object") };
    }
    return { value: value };
  }

  const SENSITIVE_TIMESTAMP_KEYS = ["last_active_at", "viewed_at"];

  function stripSensitiveTimestamps(value, depth) {
    if (!value || typeof value !== "object") return value;
    if (depth > 8) return value;
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return stripSensitiveTimestamps(item, depth + 1);
      });
    }
    const out = {};
    Object.keys(value).forEach(function (key) {
      if (SENSITIVE_TIMESTAMP_KEYS.indexOf(key) >= 0) {
        console.warn("[TasfulMatchAPI] stripped sensitive field:", key);
        return;
      }
      out[key] = stripSensitiveTimestamps(value[key], depth + 1);
    });
    return out;
  }

  function sanitizeP15Response(result) {
    if (!result || typeof result !== "object") return result;
    return stripSensitiveTimestamps(result, 0);
  }

  async function recordSwipe(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const target = requireString("target_user_id", body.value.target_user_id, 128);
    if (target.error) return target.error;

    const action = requireEnum("action", body.value.action, SWIPE_ACTIONS);
    if (action.error) return action.error;

    if (action.value === "super_like") {
      return {
        ok: false,
        mode: currentMode(),
        ...authContext(),
        code: "phase_not_enabled",
        message: "スーパーいいねは現在準備中です。",
      };
    }

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.recordSwipe, {
        target_user_id: target.value,
        action: action.value,
      });
    }

    return success({
      swipe_recorded: true,
      matched: false,
      pair_id: null,
    });
  }

  async function listPairs() {
    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.listPairs, {});
    }

    return success({ pairs: [] });
  }

  async function unmatchPair(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const pair = requireUuidLike("pair_id", body.value.pair_id);
    if (pair.error) return pair.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.unmatchPair, {
        pair_id: pair.value,
      });
    }

    return success({
      pair_id: pair.value,
      status: "unmatched",
      room_status: "cancelled",
      already_unmatched: false,
    });
  }

  async function upsertProfile(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const nickname = requireString("nickname", body.value.nickname, 20);
    if (nickname.error) return nickname.error;

    const gender = requireEnum("gender", body.value.gender, [
      "male",
      "female",
      "other",
      "private",
    ]);
    if (gender.error) return gender.error;

    const birthDate = requireString("birth_date", body.value.birth_date, 10);
    if (birthDate.error) return birthDate.error;

    const prefecture = requireString("prefecture", body.value.prefecture, 32);
    if (prefecture.error) return prefecture.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.upsertProfile, {
        nickname: nickname.value,
        gender: gender.value,
        birth_date: birthDate.value,
        prefecture: prefecture.value,
        city: body.value.city ?? null,
        bio: body.value.bio ?? null,
        purpose: body.value.purpose ?? null,
        relationship_view: body.value.relationship_view ?? null,
        weekend_style: body.value.weekend_style ?? null,
        hobby_slugs: Array.isArray(body.value.hobby_slugs) ? body.value.hobby_slugs : [],
        publish: body.value.publish === true,
      });
    }

    return success({
      profile_id: "stub-profile-id",
      created: true,
      profile_status: "active",
      completion_score: 72,
      public_profile: null,
    });
  }

  async function uploadPhoto(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const content = requireString("content_base64", body.value.content_base64, 3_000_000);
    if (content.error) return content.error;

    const contentType = requireEnum("content_type", body.value.content_type, [
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (contentType.error) return contentType.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.uploadPhoto, {
        content_base64: content.value,
        content_type: contentType.value,
        is_main: body.value.is_main === true,
        display_order: body.value.display_order,
      });
    }

    return success({
      photo_id: "stub-photo-id",
      storage_path: "stub-user-current/stub-photo.jpg",
      is_main: Boolean(body.value.is_main),
      display_order: 0,
    });
  }

  async function ensureTalkRoom(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const pair = requireUuidLike("pair_id", body.value.pair_id);
    if (pair.error) return pair.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.ensureTalkRoom, {
        pair_id: pair.value,
      });
    }

    return success({
      room_id: "stub-room-id",
      redirect_url: "../chat-detail.html?room=stub-room-id",
    });
  }

  async function submitReport(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const reported = requireString("reported_user_id", body.value.reported_user_id, 128);
    if (reported.error) return reported.error;

    const reason = requireEnum("reason", body.value.reason, REPORT_REASONS);
    if (reason.error) return reason.error;

    const detail = optionalString("detail", body.value.detail, 2000);
    if (detail.error) return detail.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.submitReport, {
        reported_user_id: reported.value,
        reason: reason.value,
        detail: detail.value,
      });
    }

    return success({
      report_id: "stub-report-id",
      status: "submitted",
    });
  }

  async function blockUser(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const blocked = requireString("blocked_user_id", body.value.blocked_user_id, 128);
    if (blocked.error) return blocked.error;

    const reason = optionalString("reason", body.value.reason, 500);
    if (reason.error) return reason.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.blockUser, {
        blocked_user_id: blocked.value,
        reason: reason.value,
      });
    }

    return success({
      blocked: true,
      pair_status: "blocked",
      room_status: "cancelled",
    });
  }

  async function listVerifications() {
    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.submitVerification, {
        intent: "list",
      });
    }

    const stub = window.TasfulMatchDataStub;
    if (stub && typeof stub.getCurrentVerification === "function") {
      const row = stub.getCurrentVerification();
      return success({
        items: row
          ? [
              {
                verification_id: row.verification_id,
                verification_type: row.verification_type === "identity_document"
                  ? "identity"
                  : row.verification_type,
                status: row.status === "not_submitted" ? "none" : row.status,
                submitted_at: row.submitted_at,
              },
            ]
          : [],
      });
    }

    return success({ items: [] });
  }

  async function submitVerification(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const type = requireEnum(
      "verification_type",
      body.value.verification_type,
      VERIFICATION_TYPES,
    );
    if (type.error) return type.error;

    if (body.value.metadata !== undefined && body.value.metadata !== null) {
      if (typeof body.value.metadata !== "object" || Array.isArray(body.value.metadata)) {
        return fail("validation_error", "metadata must be an object");
      }
    }

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.submitVerification, {
        intent: "submit",
        verification_type: type.value,
        id_document_type: body.value.id_document_type,
        metadata: body.value.metadata,
      });
    }

    return success({
      verification_id: "stub-verification-id",
      status: "pending",
    });
  }

  async function adminReview(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    if (isLiveMode()) {
      const intent = body.value.intent ? String(body.value.intent).trim().toLowerCase() : "";
      if (intent && ADMIN_INTENTS.includes(intent)) {
        const edgeBody = { intent };
        if (body.value.verification_type) {
          edgeBody.verification_type = String(body.value.verification_type);
        }
        return callEdgeFunction(EDGE_FUNCTION_PATHS.adminReview, edgeBody);
      }

      const action = body.value.action ? String(body.value.action).trim().toUpperCase() : "";
      if (!ADMIN_ACTIONS.includes(action)) {
        return fail(
          "validation_error",
          `action must be one of: ${ADMIN_ACTIONS.join(", ")}`,
        );
      }

      const edgeBody = { action };
      if (body.value.decision) edgeBody.decision = String(body.value.decision);
      if (body.value.note) edgeBody.note = String(body.value.note);
      if (body.value.report_id) edgeBody.report_id = String(body.value.report_id);
      if (body.value.verification_id) edgeBody.verification_id = String(body.value.verification_id);
      if (body.value.profile_id) edgeBody.profile_id = String(body.value.profile_id);
      return callEdgeFunction(EDGE_FUNCTION_PATHS.adminReview, edgeBody);
    }

    const intent = body.value.intent ? String(body.value.intent).trim().toLowerCase() : "";
    if (intent && ADMIN_INTENTS.includes(intent)) {
      return success({ items: [] });
    }

    return success({ reviewed: true });
  }

  async function moderationLog(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const source = requireEnum("source", body.value.source, MOD_SOURCES);
    if (source.error) return source.error;

    const target = requireString("target_user_id", body.value.target_user_id, 128);
    if (target.error) return target.error;

    const severity = requireEnum("severity", body.value.severity, MOD_SEVERITIES);
    if (severity.error) return severity.error;

    const reason = requireString("reason", body.value.reason, 500);
    if (reason.error) return reason.error;

    if (isLiveMode()) {
      return callEdgeFunction(EDGE_FUNCTION_PATHS.moderationLog, {
        source: source.value,
        target_user_id: target.value,
        severity: severity.value,
        reason: reason.value,
      });
    }

    return success({
      log_id: "stub-log-id",
      queued: true,
    });
  }

  async function favoriteUser(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const target = requireString("target_user_id", body.value.target_user_id, 128);
    if (target.error) return target.error;

    const source =
      body.value.source === undefined || body.value.source === ""
        ? { value: "profile" }
        : requireEnum("source", body.value.source, FAVORITE_SOURCES);
    if (source.error) return source.error;

    const note = optionalString("note", body.value.note, 200);
    if (note.error) return note.error;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.favoriteUser, {
          target_user_id: target.value,
          source: source.value,
          note: note.value,
        }),
      );
    }

    return success({
      favorite_id: P15_STUB_FAVORITES[0].favorite_id,
      created: true,
      target_user_id: target.value,
    });
  }

  async function unfavoriteUser(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const hasTarget = body.value.target_user_id !== undefined && body.value.target_user_id !== "";
    const hasFavoriteId = body.value.favorite_id !== undefined && body.value.favorite_id !== "";
    if (!hasTarget && !hasFavoriteId) {
      return fail("validation_error", "target_user_id or favorite_id is required");
    }

    let edgePayload = {};
    if (hasFavoriteId) {
      const favId = requireUuid("favorite_id", body.value.favorite_id);
      if (favId.error) return favId.error;
      edgePayload.favorite_id = favId.value;
    } else {
      const target = requireString("target_user_id", body.value.target_user_id, 128);
      if (target.error) return target.error;
      edgePayload.target_user_id = target.value;
    }

    if (isLiveMode()) {
      return sanitizeP15Response(await callEdgeFunction(EDGE_FUNCTION_PATHS.unfavoriteUser, edgePayload));
    }

    return success({
      unfavorited: true,
      target_user_id: edgePayload.target_user_id || "stub-user-yui",
    });
  }

  async function listFavorites(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    const limitRaw = body.value.limit;
    const limit =
      limitRaw === undefined || limitRaw === null
        ? 20
        : Math.min(50, Math.max(1, Number(limitRaw) || 20));

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.listFavorites, {
          limit: limit,
          cursor: body.value.cursor || null,
        }),
      );
    }

    return success({
      items: P15_STUB_FAVORITES.slice(),
      next_cursor: null,
    });
  }

  async function recordProfileView(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const viewed = requireString("viewed_user_id", body.value.viewed_user_id, 128);
    if (viewed.error) return viewed.error;

    const source =
      body.value.source === undefined || body.value.source === ""
        ? { value: "profile_detail" }
        : requireEnum("source", body.value.source, PROFILE_VIEW_SOURCES);
    if (source.error) return source.error;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.recordProfileView, {
          viewed_user_id: viewed.value,
          source: source.value,
        }),
      );
    }

    return success({ recorded: false, dedupe_bucket: "2026-06-21" });
  }

  async function listProfileViews(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    const limitRaw = body.value.limit;
    const limit =
      limitRaw === undefined || limitRaw === null
        ? 20
        : Math.min(50, Math.max(1, Number(limitRaw) || 20));

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.listProfileViews, {
          limit: limit,
          cursor: body.value.cursor || null,
        }),
      );
    }

    return success({
      items: P15_STUB_FOOTPRINTS.slice(),
      next_cursor: null,
    });
  }

  async function saveSearch(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const name = requireString("name", body.value.name, 40);
    if (name.error) return name.error;

    const filters = optionalObject("filters_json", body.value.filters_json);
    if (filters.error) return filters.error;

    const edgePayload = {
      id: body.value.id || null,
      name: name.value,
      filters_json: filters.value,
      is_default: Boolean(body.value.is_default),
    };

    if (edgePayload.id) {
      const id = requireUuid("id", edgePayload.id);
      if (id.error) return id.error;
      edgePayload.id = id.value;
    }

    if (isLiveMode()) {
      return sanitizeP15Response(await callEdgeFunction(EDGE_FUNCTION_PATHS.saveSearch, edgePayload));
    }

    return success({
      search_id: P15_STUB_SAVED_SEARCHES[0].id,
      updated: Boolean(edgePayload.id),
    });
  }

  async function listSavedSearches(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.listSavedSearches, {
          include_archived: Boolean(body.value.include_archived),
        }),
      );
    }

    return success({ items: P15_STUB_SAVED_SEARCHES.slice() });
  }

  async function deleteSavedSearch(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const id = requireUuid("id", body.value.id);
    if (id.error) return id.error;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.deleteSavedSearch, { id: id.value }),
      );
    }

    return success({ deleted: true, id: id.value });
  }

  async function searchProfiles(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    const filters = optionalObject("filters_json", body.value.filters_json);
    if (filters.error) return filters.error;

    const sortRaw = body.value.sort;
    const sort =
      sortRaw === "newest" || sortRaw === "online" || sortRaw === "recommended"
        ? sortRaw
        : "recommended";

    const limitRaw = body.value.limit;
    const limit =
      limitRaw === undefined || limitRaw === null
        ? undefined
        : Number.isFinite(Number(limitRaw))
          ? Math.min(50, Math.max(1, Math.floor(Number(limitRaw))))
          : undefined;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.searchProfiles, {
          filters_json: filters.value,
          sort: sort,
          limit: limit,
          cursor: body.value.cursor ?? null,
        }),
      );
    }

    const stub = window.TasfulMatchDataStub;
    if (stub && typeof stub.searchProfiles === "function") {
      const items = stub.searchProfiles(filters.value || {}, sort);
      return success({ items: items, total: items.length, sort: sort });
    }

    return success({ items: [], total: 0, sort: sort });
  }

  async function getCompatibility(payload) {
    const body = asObject(payload, "payload");
    if (body.error) return body.error;

    const target = requireString("target_user_id", body.value.target_user_id, 128);
    if (target.error) return target.error;

    if (isLiveMode()) {
      return sanitizeP15Response(
        await callEdgeFunction(EDGE_FUNCTION_PATHS.getCompatibility, {
          target_user_id: target.value,
        }),
      );
    }

    return success({
      percent: 78,
      score_raw: 78,
      common_points: [
        { key: "hobby", label: "カフェ巡り", icon: "☕" },
        { key: "hobby", label: "映画", icon: "🎬" },
        { key: "hobby", label: "旅行", icon: "✈️" },
      ],
      common_count: 3,
    });
  }

  async function getProfileCompleteness(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    if (isLiveMode()) {
      return sanitizeP15Response(await callEdgeFunction(EDGE_FUNCTION_PATHS.getProfileCompleteness, {}));
    }

    const doneCount = P15_STUB_COMPLETENESS_ITEMS.filter(function (item) {
      return item.done;
    }).length;

    return success({
      percent: 80,
      done_count: doneCount,
      total_count: P15_STUB_COMPLETENESS_ITEMS.length,
      items: P15_STUB_COMPLETENESS_ITEMS.map(function (item) {
        return { ...item };
      }),
    });
  }

  async function updateActivity(payload) {
    const body = asObject(payload || {}, "payload");
    if (body.error) return body.error;

    if (isLiveMode()) {
      return sanitizeP15Response(await callEdgeFunction(EDGE_FUNCTION_PATHS.updateActivity, {}));
    }

    return success({
      activity_label: "24時間以内に活動",
      bumped: false,
    });
  }

  if (window.TasfulMatchAuth?.getAuthHeaders) {
    configure({
      getAuthHeaders: function () {
        if (window.TasfulMatchAuth.ensureFreshAccessToken) {
          return window.TasfulMatchAuth.ensureFreshAccessToken().then(function () {
            return window.TasfulMatchAuth.getAuthHeaders();
          });
        }
        return window.TasfulMatchAuth.getAuthHeaders();
      },
    });
  }

  window.TasfulMatchAPI = {
    configure,
    isLiveMode,
    getConfig,
    getAuthHeadersProvider: function () {
      return apiConfig.getAuthHeaders;
    },
    recordSwipe,
    listPairs,
    unmatchPair,
    upsertProfile,
    uploadPhoto,
    ensureTalkRoom,
    submitReport,
    blockUser,
    submitVerification,
    listVerifications,
    adminReview,
    moderationLog,
    favoriteUser,
    unfavoriteUser,
    listFavorites,
    recordProfileView,
    listProfileViews,
    saveSearch,
    listSavedSearches,
    deleteSavedSearch,
    searchProfiles,
    getCompatibility,
    getProfileCompleteness,
    updateActivity,
  };

  Object.defineProperty(window.TasfulMatchAPI, "mode", {
    get: function () {
      return currentMode();
    },
  });
})();
