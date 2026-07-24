(function () {
  "use strict";

  var STAGING_REF = "ahlxuyvhzqdqaojiywmu";
  var PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
  var CREATE_TALK_PATH = "/api/platform-request-create-talk";
  var LISTING_TYPE = "platform_request";
  var SERVICE_TYPE = "platform_request";
  var LOCAL_KEY = "tasu_platform_request_talk_rooms_v1";

  /** @type {Map<string, Promise<object>>} */
  var inflight = new Map();

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

  function isConfigured() {
    if (!window.TasuSupabase?.isConfigured?.()) return false;
    var ref = window.TasuSupabase?.getProjectRef?.() || "";
    if (!ref || ref === PRODUCTION_REF) return false;
    return ref === STAGING_REF;
  }

  function getAccessToken() {
    var sb = window.TasuSupabase?.getClient?.();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      return res?.data?.session?.access_token || null;
    });
  }

  function readLocalMap() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function writeLocalMap(map) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map || {}));
  }

  function localRoomIdForMatch(matchId) {
    return "local-room-platform-request-" + pickStr(matchId);
  }

  function isLocalRoomId(roomId) {
    return /^local-room-platform-request-/i.test(pickStr(roomId));
  }

  function cacheLocalRoom(matchId, roomId) {
    var mid = pickStr(matchId);
    var rid = pickStr(roomId);
    if (!mid || !rid) return;
    var map = readLocalMap();
    map[mid] = rid;
    writeLocalMap(map);
  }

  function getCachedLocalRoom(matchId) {
    var map = readLocalMap();
    return pickStr(map[pickStr(matchId)]);
  }

  function registerLocalTalkRoom(opts, roomId) {
    var rid = pickStr(roomId) || localRoomIdForMatch(opts.matchId);
    var ownerId = pickStr(opts.ownerId);
    var candidateId = pickStr(opts.candidateUserId);
    var title = pickStr(opts.title, "Platform Request");
    var thread = {
      id: rid,
      listing: { id: pickStr(opts.matchId), type: LISTING_TYPE, title: title },
      partner: {
        id: candidateId || "candidate",
        displayName: pickStr(opts.partnerName, "候補者"),
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=P",
      },
      buyerId: ownerId,
      sellerId: candidateId,
      status: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
      source: SERVICE_TYPE,
    };
    try {
      window.TasuChatSupabase?.registerLocalConsultRoom?.(thread, []);
    } catch (_eReg) {
      /* ignore */
    }
    cacheLocalRoom(opts.matchId, rid);
    return rid;
  }

  function buildTalkHref(roomId, opts) {
    var rid = pickStr(roomId);
    if (!rid) return "";
    opts = opts || {};
    var requestId = pickStr(opts.requestId);
    var matchId = pickStr(opts.matchId);
    var returnTo = pickStr(
      opts.returnTo,
      requestId
        ? "platform-request-detail.html?id=" + encodeURIComponent(requestId)
        : "platform-request.html"
    );
    var sp = new URLSearchParams();
    sp.set("thread", rid);
    sp.set("roomId", rid);
    sp.set("from", "platform_request");
    sp.set("source", SERVICE_TYPE);
    if (requestId) sp.set("requestId", requestId);
    if (matchId) sp.set("matchId", matchId);
    sp.set("returnTo", returnTo);
    return "chat-detail.html?" + sp.toString();
  }

  function navigateToTalk(roomId, opts) {
    var href = buildTalkHref(roomId, opts);
    if (!href) return false;
    window.location.href = href;
    return true;
  }

  function ensureTalkRoomViaEdge(requestId, matchId) {
    var rid = pickStr(requestId);
    var mid = pickStr(matchId);
    if (!isUuid(rid) || !isUuid(mid)) {
      return Promise.resolve({ ok: false, reason: "invalid_args" });
    }
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, reason: "not_configured" });
    }

    var inflightKey = rid + ":" + mid;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    var run = getAccessToken().then(function (token) {
      if (!token) return { ok: false, reason: "not_authenticated" };
      return fetch(CREATE_TALK_PATH, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: rid, match_id: mid }),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: false, error: "invalid_json" };
          }).then(function (body) {
            if (!res.ok) {
              return {
                ok: false,
                reason: pickStr(body?.error, "edge_error"),
                status: res.status,
                error: body,
              };
            }
            var roomId = pickStr(body?.room_id);
            if (!roomId) {
              return { ok: false, reason: "missing_room_id", error: body };
            }
            return {
              ok: true,
              roomId: roomId,
              created: Boolean(body?.created),
              reused: Boolean(body?.reused),
              source: "edge",
            };
          });
        })
        .catch(function (err) {
          return { ok: false, reason: "network_error", error: err };
        });
    });

    inflight.set(inflightKey, run);
    return run.finally(function () {
      inflight.delete(inflightKey);
    });
  }

  function ensureTalkRoomLocal(requestId, matchId, opts) {
    var mid = pickStr(matchId);
    var cached = getCachedLocalRoom(mid);
    if (cached) {
      return Promise.resolve({
        ok: true,
        roomId: cached,
        created: false,
        reused: true,
        source: "local_cache",
      });
    }
    var roomId = registerLocalTalkRoom(
      {
        matchId: mid,
        requestId: requestId,
        ownerId: pickStr(opts?.ownerId),
        candidateUserId: pickStr(opts?.candidateUserId),
        title: pickStr(opts?.title),
        partnerName: pickStr(opts?.partnerName),
      },
      localRoomIdForMatch(mid)
    );
    return Promise.resolve({
      ok: true,
      roomId: roomId,
      created: true,
      reused: false,
      source: "local_fallback",
    });
  }

  function startTalkForMatch(requestId, matchId, opts) {
    opts = opts || {};
    if (isConfigured()) {
      return ensureTalkRoomViaEdge(requestId, matchId).then(function (res) {
        if (res.ok) return res;
        return ensureTalkRoomLocal(requestId, matchId, opts);
      });
    }
    return ensureTalkRoomLocal(requestId, matchId, opts);
  }

  function startTalkAndNavigate(requestId, matchId, opts) {
    return startTalkForMatch(requestId, matchId, opts).then(function (res) {
      if (!res.ok) return res;
      navigateToTalk(res.roomId, {
        requestId: requestId,
        matchId: matchId,
        returnTo: opts?.returnTo,
      });
      return res;
    });
  }

  window.TasuPlatformRequestTalkBridge = {
    STAGING_REF: STAGING_REF,
    CREATE_TALK_PATH: CREATE_TALK_PATH,
    LISTING_TYPE: LISTING_TYPE,
    SERVICE_TYPE: SERVICE_TYPE,
    LOCAL_KEY: LOCAL_KEY,
    isUuid: isUuid,
    isConfigured: isConfigured,
    isLocalRoomId: isLocalRoomId,
    buildTalkHref: buildTalkHref,
    navigateToTalk: navigateToTalk,
    ensureTalkRoomViaEdge: ensureTalkRoomViaEdge,
    ensureTalkRoomLocal: ensureTalkRoomLocal,
    startTalkForMatch: startTalkForMatch,
    startTalkAndNavigate: startTalkAndNavigate,
    getCachedLocalRoom: getCachedLocalRoom,
  };
})();
