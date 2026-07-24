(function () {
  "use strict";

  var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
  var TABLE = "platform_request_notifications";
  var NOTIFY_PATH = "/api/platform-request-notify";
  var LOCAL_KEY = "tasu_platform_request_notifications_v1";

  var SELECT_COLUMNS =
    "id,request_id,match_id,recipient_id,channel,status,created_at,sent_at";

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

  function newLocalId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "local-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function readLocalRows() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_eRead) {
      return [];
    }
  }

  function writeLocalRows(rows) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows || []));
  }

  function deriveMessage(row, ctx) {
    ctx = ctx || {};
    var matchId = pickStr(row.matchId, row.match_id);
    var recipientId = pickStr(row.recipientId, row.recipient_id);
    var ownerId = pickStr(ctx.ownerId);
    var matchCount = Number(ctx.matchCount) || 1;
    var requestStatus = pickStr(ctx.requestStatus, row.requestStatus);

    if (pickStr(row.message)) return row.message;

    if (matchId) {
      if (ownerId && recipientId === ownerId) {
        return String(matchCount) + "件の候補者が見つかりました";
      }
      return "あなた宛の依頼があります";
    }

    if (requestStatus === "closed") return "依頼が終了しました";
    if (requestStatus === "open") return "依頼が受付中になりました";
    if (ownerId && recipientId && recipientId !== ownerId) return "依頼が終了しました";
    return "依頼のステータスが更新されました";
  }

  function rowToNotification(row, currentUserId, ctx) {
    if (!row || !row.id) return null;
    var status = pickStr(row.status) || "pending";
    var createdAt = row.created_at || row.createdAt;
    var sentAt = row.sent_at || row.sentAt || null;
    var isUnread = status === "pending";
    var recipientId = pickStr(row.recipient_id, row.recipientId);
    var requestId = pickStr(row.request_id, row.requestId);
    var matchId = pickStr(row.match_id, row.matchId) || null;
    var kind = pickStr(row.kind);
    if (!kind) {
      if (matchId && recipientId === pickStr(ctx && ctx.ownerId)) kind = "match_owner";
      else if (matchId) kind = "match_candidate";
      else kind = "status";
    }
    return {
      id: String(row.id),
      requestId: requestId,
      matchId: matchId,
      recipientId: recipientId,
      channel: pickStr(row.channel) || "in_app",
      status: status,
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      sentAt: sentAt ? new Date(sentAt).toISOString() : null,
      isUnread: isUnread,
      kind: kind,
      message: deriveMessage(row, ctx),
      isOwnerNotification: kind === "match_owner" || (kind === "status" && recipientId === currentUserId),
      isCandidateNotification: kind === "match_candidate",
      source: pickStr(row.source) || "supabase",
    };
  }

  function getAccessToken() {
    var sb = getClient();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      return res?.data?.session?.access_token || null;
    });
  }

  function countMatchNotificationsForRequest(rows, requestId, recipientId) {
    var n = 0;
    (rows || []).forEach(function (row) {
      var rid = pickStr(row.requestId, row.request_id);
      var mid = pickStr(row.matchId, row.match_id);
      var rec = pickStr(row.recipientId, row.recipient_id);
      if (rid === requestId && mid && rec === recipientId) n += 1;
    });
    return n || 1;
  }

  function enrichNotifications(rows, currentUserId, ownerByRequest) {
    ownerByRequest = ownerByRequest || {};
    return (rows || [])
      .map(function (row) {
        var requestId = pickStr(row.request_id, row.requestId);
        var ownerId = pickStr(ownerByRequest[requestId]);
        var matchCount = countMatchNotificationsForRequest(rows, requestId, ownerId || currentUserId);
        return rowToNotification(row, currentUserId, {
          ownerId: ownerId,
          matchCount: matchCount,
          requestStatus: row.requestStatus,
        });
      })
      .filter(Boolean);
  }

  var NotificationStore = {
    STAGING_REF: STAGING_REF,
    PRODUCTION_REF: PRODUCTION_REF,
    TABLE: TABLE,
    NOTIFY_PATH: NOTIFY_PATH,
    LOCAL_KEY: LOCAL_KEY,

    isUuid: isUuid,
    isConfigured: isConfigured,
    getClient: getClient,
    mapError: mapError,
    rowToNotification: rowToNotification,
    deriveMessage: deriveMessage,

    listLocal: function (recipientId) {
      var uid = pickStr(recipientId);
      if (!uid) return [];
      return readLocalRows()
        .filter(function (row) {
          return pickStr(row.recipientId) === uid;
        })
        .map(function (row) {
          return rowToNotification(row, uid, {
            ownerId: row.ownerId,
            matchCount: row.matchCount || 1,
            requestStatus: row.requestStatus,
          });
        })
        .filter(Boolean);
    },

    addLocal: function (payload) {
      var recipientId = pickStr(payload.recipientId);
      if (!recipientId) return null;
      var rows = readLocalRows();
      var item = {
        id: newLocalId(),
        requestId: pickStr(payload.requestId),
        matchId: pickStr(payload.matchId) || null,
        recipientId: recipientId,
        ownerId: pickStr(payload.ownerId) || null,
        channel: "in_app",
        status: "pending",
        kind: pickStr(payload.kind) || "match_owner",
        message: pickStr(payload.message),
        requestStatus: pickStr(payload.requestStatus) || null,
        matchCount: Number(payload.matchCount) || 1,
        createdAt: new Date().toISOString(),
        sentAt: null,
        source: "local",
      };
      rows.unshift(item);
      writeLocalRows(rows);
      return rowToNotification(item, recipientId, {
        ownerId: item.ownerId,
        matchCount: item.matchCount,
        requestStatus: item.requestStatus,
      });
    },

    markLocalRead: function (id, recipientId) {
      var nid = pickStr(id);
      var uid = pickStr(recipientId);
      if (!nid || !uid) return false;
      var rows = readLocalRows();
      var changed = false;
      rows.forEach(function (row) {
        if (row.id === nid && row.recipientId === uid && row.status === "pending") {
          row.status = "sent";
          row.sentAt = new Date().toISOString();
          changed = true;
        }
      });
      if (changed) writeLocalRows(rows);
      return changed;
    },

    markAllLocalRead: function (recipientId) {
      var uid = pickStr(recipientId);
      if (!uid) return 0;
      var rows = readLocalRows();
      var count = 0;
      rows.forEach(function (row) {
        if (row.recipientId === uid && row.status === "pending") {
          row.status = "sent";
          row.sentAt = new Date().toISOString();
          count += 1;
        }
      });
      if (count) writeLocalRows(rows);
      return count;
    },

    listForRecipient: function (recipientId, ownerByRequest) {
      var sb = getClient();
      var uid = pickStr(recipientId);
      if (!sb || !uid) {
        return Promise.resolve({ ok: false, reason: "not_authenticated", rows: [] });
      }
      return sb
        .from(TABLE)
        .select(SELECT_COLUMNS)
        .eq("recipient_id", uid)
        .order("created_at", { ascending: false })
        .then(function (res) {
          if (res.error) {
            return { ok: false, reason: mapError(res.error).code, error: res.error, rows: [] };
          }
          var raw = res.data || [];
          var rows = enrichNotifications(raw, uid, ownerByRequest || {});
          return { ok: true, rows: rows };
        });
    },

    unreadCountForRecipient: function (recipientId) {
      return this.listForRecipient(recipientId).then(function (res) {
        if (!res.ok) return { ok: false, count: 0, reason: res.reason };
        var count = (res.rows || []).filter(function (row) {
          return row.isUnread;
        }).length;
        return { ok: true, count: count };
      });
    },

    markAsReadViaEdge: function (notificationIds) {
      var ids = (Array.isArray(notificationIds) ? notificationIds : [])
        .map(function (id) {
          return pickStr(id);
        })
        .filter(function (id) {
          return isUuid(id);
        });
      if (!ids.length) {
        return Promise.resolve({ ok: false, reason: "empty", updated: 0 });
      }
      if (!isConfigured()) {
        return Promise.resolve({ ok: false, reason: "not_configured", updated: 0 });
      }
      return getAccessToken().then(function (token) {
        if (!token) {
          return { ok: false, reason: "not_authenticated", updated: 0 };
        }
        return fetch(NOTIFY_PATH, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mark_read",
            notification_ids: ids,
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
                  updated: 0,
                  error: body,
                };
              }
              return {
                ok: Boolean(body?.ok),
                updated: Number(body?.updated) || 0,
                reason: body?.reason || "",
              };
            });
          })
          .catch(function (err) {
            return { ok: false, reason: "network_error", updated: 0, error: err };
          });
      });
    },

    notifyStatusChangeViaEdge: function (requestId, status, previousStatus) {
      if (!isConfigured() || !isUuid(requestId)) {
        return Promise.resolve({ ok: false, reason: "invalid_request", inserted: 0 });
      }
      var nextStatus = pickStr(status);
      if (!nextStatus) {
        return Promise.resolve({ ok: false, reason: "invalid_status", inserted: 0 });
      }
      return getAccessToken().then(function (token) {
        if (!token) {
          return { ok: false, reason: "not_authenticated", inserted: 0 };
        }
        return fetch(NOTIFY_PATH, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "status_changed",
            request_id: requestId,
            status: nextStatus,
            previous_status: pickStr(previousStatus) || null,
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
                  inserted: 0,
                  error: body,
                };
              }
              return {
                ok: Boolean(body?.ok),
                inserted: Number(body?.inserted) || 0,
                reason: body?.reason || "",
              };
            });
          })
          .catch(function (err) {
            return { ok: false, reason: "network_error", inserted: 0, error: err };
          });
      });
    },

    filterOwnerNotifications: function (rows) {
      return (rows || []).filter(function (row) {
        return row.kind === "match_owner" || row.kind === "status";
      });
    },

    filterCandidateNotifications: function (rows) {
      return (rows || []).filter(function (row) {
        return row.kind === "match_candidate";
      });
    },
  };

  window.TasuPlatformRequestNotificationStore = NotificationStore;
})();
