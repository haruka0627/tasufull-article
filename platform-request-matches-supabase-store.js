(function () {
  "use strict";

  var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
  var TABLE = "platform_request_matches";
  var MATCH_SYNC_PATH = "/api/platform-request-match-sync";

  var SELECT_COLUMNS =
    "id,request_id,candidate_id,candidate_type,candidate_user_id,match_score,match_reasons,status,created_at,updated_at";

  var DIRECT_USER_TYPES = { user: true, freelancer: true };

  function pickStr() {
    for (var i = 0; i < arguments.length; i += 1) {
      var s = String(arguments[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isUuid(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(id || "")
    );
  }

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function getProjectRef() {
    return window.TasuSupabase?.getProjectRef?.() || "";
  }

  function isConfigured() {
    if (!window.TasuSupabase?.isConfigured?.()) return false;
    var ref = getProjectRef();
    if (!ref) return false;
    if (ref === PRODUCTION_REF) return false;
    return ref === STAGING_REF;
  }

  function mapError(error) {
    if (!error) return { code: "unknown", message: "unknown_error" };
    var msg = String(error.message || error);
    if (error.code === "42501" || /permission|policy|row-level security/i.test(msg)) {
      return { code: "rls_denied", message: msg };
    }
    if (error.code === "23505" || /duplicate|unique/i.test(msg)) {
      return { code: "duplicate", message: msg };
    }
    return { code: String(error.code || "error"), message: msg };
  }

  function normalizeReasons(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (r) {
        return pickStr(r);
      }).filter(Boolean);
    }
    return [];
  }

  function rowToMatch(row) {
    if (!row || !row.id) return null;
    var type = pickStr(row.candidate_type);
    var shortId = pickStr(row.candidate_id).slice(0, 8);
    return {
      id: String(row.id),
      requestId: String(row.request_id),
      candidateId: String(row.candidate_id),
      candidateType: type,
      candidateUserId: pickStr(row.candidate_user_id) || null,
      matchScore: Number(row.match_score) || 0,
      matchReasons: normalizeReasons(row.match_reasons),
      status: pickStr(row.status) || "candidate",
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      displayName: type ? type + (shortId ? " · " + shortId : "") : "候補",
      source: "supabase",
    };
  }

  function resolveCandidateUserIdClient(type, candidateId) {
    var t = pickStr(type);
    var cid = pickStr(candidateId);
    if (!t || !cid || !isUuid(cid)) return null;
    if (DIRECT_USER_TYPES[t]) return cid;
    return null;
  }

  function getAccessToken() {
    var sb = getClient();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      return res?.data?.session?.access_token || null;
    });
  }

  var MatchesStore = {
    STAGING_REF: STAGING_REF,
    PRODUCTION_REF: PRODUCTION_REF,
    TABLE: TABLE,
    MATCH_SYNC_PATH: MATCH_SYNC_PATH,

    isUuid: isUuid,
    isConfigured: isConfigured,
    getClient: getClient,
    getProjectRef: getProjectRef,
    mapError: mapError,
    rowToMatch: rowToMatch,
    resolveCandidateUserIdClient: resolveCandidateUserIdClient,

    listForRequest: function (requestId) {
      var sb = getClient();
      if (!sb || !isUuid(requestId)) {
        return Promise.resolve({ ok: false, reason: "invalid_request", rows: [] });
      }
      return sb
        .from(TABLE)
        .select(SELECT_COLUMNS)
        .eq("request_id", requestId)
        .order("match_score", { ascending: false })
        .then(function (res) {
          if (res.error) {
            return { ok: false, reason: mapError(res.error).code, error: res.error, rows: [] };
          }
          var rows = (res.data || []).map(rowToMatch).filter(Boolean);
          return { ok: true, rows: rows };
        });
    },

    listForCandidate: function () {
      var sb = getClient();
      if (!sb) return Promise.resolve({ ok: false, reason: "not_configured", rows: [] });
      return sb
        .from(TABLE)
        .select(SELECT_COLUMNS)
        .order("created_at", { ascending: false })
        .then(function (res) {
          if (res.error) {
            return { ok: false, reason: mapError(res.error).code, error: res.error, rows: [] };
          }
          var rows = (res.data || []).map(rowToMatch).filter(Boolean);
          return { ok: true, rows: rows };
        });
    },

    createMatchesViaEdge: function (requestId, candidates) {
      if (!isConfigured() || !isUuid(requestId)) {
        return Promise.resolve({ ok: false, reason: "invalid_request", inserted: [], skipped: [] });
      }
      var list = Array.isArray(candidates) ? candidates : [];
      if (!list.length) {
        return Promise.resolve({ ok: true, inserted: [], skipped: [], reason: "empty" });
      }

      return getAccessToken().then(function (token) {
        if (!token) {
          return { ok: false, reason: "not_authenticated", inserted: [], skipped: [] };
        }
        return fetch(MATCH_SYNC_PATH, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_id: requestId,
            candidates: list,
          }),
        })
          .then(function (res) {
            return res.json().catch(function () {
              return { ok: false, error: "invalid_json" };
            }).then(function (body) {
              if (!res.ok) {
                return {
                  ok: false,
                  reason: pickStr(body?.error, body?.reason, "edge_error"),
                  inserted: [],
                  skipped: body?.skipped || [],
                  error: body,
                };
              }
              return {
                ok: Boolean(body?.ok),
                inserted: body?.inserted || [],
                skipped: body?.skipped || [],
                reason: body?.reason || "",
              };
            });
          })
          .catch(function (err) {
            return {
              ok: false,
              reason: "network_error",
              inserted: [],
              skipped: [],
              error: err,
            };
          });
      });
    },
  };

  window.TasuPlatformRequestMatchesSupabaseStore = MatchesStore;
})();
