(function () {
  "use strict";

  var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
  var TABLE = "platform_requests";

  var SELECT_COLUMNS =
    "id,owner_id,legacy_local_id,title,body,category,area,urgency,budget,photos,status,created_at,updated_at";

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
    return { code: String(error.code || "error"), message: msg };
  }

  function rowToStored(row, currentUserId) {
    if (!row || !row.id) return null;
    var ownerId = pickStr(row.owner_id);
    var createdAt = row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString();
    var updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : createdAt;
    var photos = Array.isArray(row.photos) ? row.photos : [];
    return {
      id: String(row.id),
      legacyLocalId: pickStr(row.legacy_local_id),
      ownerId: ownerId,
      title: pickStr(row.title),
      body: pickStr(row.body),
      category: pickStr(row.category),
      area: pickStr(row.area),
      urgency: pickStr(row.urgency) || "通常",
      budget: pickStr(row.budget),
      photos: photos,
      status: pickStr(row.status) || "open",
      createdAt: createdAt,
      updatedAt: updatedAt,
      author: "匿名",
      source: ownerId && currentUserId && ownerId === currentUserId ? "supabase" : "remote",
      isMine: Boolean(ownerId && currentUserId && ownerId === currentUserId),
    };
  }

  function payloadToInsert(payload, ownerId, legacyLocalId) {
    return {
      owner_id: ownerId,
      title: pickStr(payload.title),
      body: pickStr(payload.body),
      category: pickStr(payload.category),
      area: pickStr(payload.area),
      urgency: pickStr(payload.urgency) || "通常",
      budget: pickStr(payload.budget) || null,
      photos: Array.isArray(payload.photos) ? payload.photos : [],
      status: pickStr(payload.status) || "open",
      legacy_local_id: legacyLocalId || null,
    };
  }

  var SupabaseRequestStore = {
    STAGING_REF: STAGING_REF,
    PRODUCTION_REF: PRODUCTION_REF,
    TABLE: TABLE,

    isUuid: isUuid,
    isConfigured: isConfigured,
    getClient: getClient,
    getProjectRef: getProjectRef,
    mapError: mapError,
    rowToStored: rowToStored,

    getSessionUserId: function () {
      var sb = getClient();
      if (!sb) return Promise.resolve(null);
      return sb.auth.getSession().then(function (res) {
        return res?.data?.session?.user?.id || null;
      });
    },

    listRows: function (currentUserId) {
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
          var rows = (res.data || [])
            .map(function (row) {
              return rowToStored(row, currentUserId);
            })
            .filter(Boolean);
          return { ok: true, rows: rows };
        });
    },

    getById: function (id, currentUserId) {
      var sb = getClient();
      if (!sb || !id) return Promise.resolve({ ok: false, reason: "not_configured", row: null });

      var query = sb.from(TABLE).select(SELECT_COLUMNS);
      if (isUuid(id)) {
        query = query.eq("id", id);
      } else {
        query = query.eq("legacy_local_id", id);
      }

      return query.maybeSingle().then(function (res) {
        if (res.error) {
          return { ok: false, reason: mapError(res.error).code, error: res.error, row: null };
        }
        if (!res.data) return { ok: true, row: null };
        return { ok: true, row: rowToStored(res.data, currentUserId) };
      });
    },

    createRow: function (payload, ownerId, legacyLocalId) {
      var sb = getClient();
      if (!sb || !ownerId) {
        return Promise.resolve({ ok: false, reason: "not_authenticated", row: null });
      }
      var insert = payloadToInsert(payload, ownerId, legacyLocalId);
      return sb
        .from(TABLE)
        .insert(insert)
        .select(SELECT_COLUMNS)
        .single()
        .then(function (res) {
          if (res.error) {
            return { ok: false, reason: mapError(res.error).code, error: res.error, row: null };
          }
          return { ok: true, row: rowToStored(res.data, ownerId) };
        });
    },

    updateStatusRow: function (id, nextStatus, ownerId) {
      var sb = getClient();
      if (!sb || !ownerId || !isUuid(id)) {
        return Promise.resolve({ ok: false, reason: "invalid_request", row: null });
      }
      return sb
        .from(TABLE)
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("owner_id", ownerId)
        .select(SELECT_COLUMNS)
        .maybeSingle()
        .then(function (res) {
          if (res.error) {
            return { ok: false, reason: mapError(res.error).code, error: res.error, row: null };
          }
          if (!res.data) return { ok: false, reason: "not_found", row: null };
          return { ok: true, row: rowToStored(res.data, ownerId) };
        });
    },
  };

  window.TasuPlatformRequestSupabaseStore = SupabaseRequestStore;
})();
