/**
 * Builder Calendar — Talk Room 正本化（CAL-MAIN-01 / CAL-MAIN-02）
 *
 * - 実 transaction_rooms.id（UUID）を builder project.talkRoomId に保存
 * - 仮 ID `builder-cal-*` は新規発行しない（既存データは Talk 開始時に昇格）
 * - 同一案件は listing_id + listing_type で再利用（重複作成しない）
 * - Supabase 不可時は安定 local-room-builder-{projectId}（fallback）
 * - 案件作成時（saveProject）でも ensure（CAL-MAIN-02）
 */
(function (global) {
  "use strict";

  const LISTING_TYPE = "builder_calendar";
  const SERVICE_TYPE = "builder_calendar";
  const LISTING_TYPE_GENERAL = "builder_board";
  const SERVICE_TYPE_GENERAL = "builder_general";
  const VERSION = "cal-main-02-p0-04-general";
  /** @type {Map<string, Promise<object>>} */
  const inflight = new Map();

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isUuidRoomId(roomId) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pickStr(roomId)
    );
  }

  /** 仮 ID（新規発行禁止。既存は Talk 開始時に昇格） */
  function isPlaceholderTalkRoomId(roomId) {
    const id = pickStr(roomId);
    if (!id) return true;
    return /^builder-cal-/i.test(id);
  }

  function isLocalBuilderRoomId(roomId) {
    return /^local-room-builder-/i.test(pickStr(roomId));
  }

  /** Talk 遷移可能な安定 ID（UUID or local fallback） */
  function isStableTalkRoomId(roomId) {
    const id = pickStr(roomId);
    if (!id || isPlaceholderTalkRoomId(id)) return false;
    return isUuidRoomId(id) || isLocalBuilderRoomId(id);
  }

  /** 実 Talk Room（UUID）のみ。local は ensure で UUID へ昇格を試みる */
  function isCanonicalTalkRoomId(roomId) {
    return isUuidRoomId(roomId);
  }

  /**
   * 作成直後用: 同期的に安定 ID を付与（UI ブロックなし）
   * 続けて ensureTalkRoomForProject で UUID 昇格を試みる。
   */
  function assignProvisionalTalkRoom(projectId) {
    const id = pickStr(projectId);
    if (!id) return { ok: false, reason: "missing_project_id" };
    const Store = getStore();
    const project = Store?.getProject?.(id);
    if (!project) return { ok: false, reason: "project_not_found" };
    const current = pickStr(project.talkRoomId, project.talkThreadId);
    if (isStableTalkRoomId(current)) {
      if (isLocalBuilderRoomId(current)) registerLocalRoom(project, current);
      return { ok: true, roomId: current, provisional: isLocalBuilderRoomId(current) };
    }
    const localId = localRoomIdForProject(id);
    registerLocalRoom(project, localId);
    persistTalkRoomId(id, localId);
    return { ok: true, roomId: localId, provisional: true };
  }

  function localRoomIdForProject(projectId) {
    return `local-room-builder-${pickStr(projectId)}`;
  }

  function getStore() {
    return global.TasuBuilderProjectStore;
  }

  function getMeId() {
    try {
      const fromChat = global.TasuChatSupabase?.getCurrentUserId?.();
      if (fromChat) return String(fromChat);
    } catch {
      /* ignore */
    }
    try {
      const raw = global.localStorage?.getItem?.("tasu-supabase-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        const uid = parsed?.user?.id;
        if (uid) return String(uid);
      }
    } catch {
      /* ignore */
    }
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return pickStr(cfg.currentUserId, cfg.me?.id, "u_me") || "u_me";
  }

  function sellerIdForProject(project) {
    return (
      pickStr(project?.managerPhone && project?.id, project?.assignedVendor) ||
      pickStr(project?.id) ||
      "builder_ops"
    );
  }

  function persistTalkRoomId(projectId, roomId) {
    const Store = getStore();
    const id = pickStr(projectId);
    const rid = pickStr(roomId);
    if (!id || !rid) return { ok: false, error: "persist_unavailable" };
    const existing = Store.getProject?.(id);
    if (existing && pickStr(existing.talkRoomId) === rid && pickStr(existing.talkThreadId) === rid) {
      return { ok: true, project: existing, unchanged: true };
    }
    // UI / fallback 正本は local に必ず保存（未認証 RLS 失敗でも破綻しない）
    const localRes = Store.patchProjectLocal
      ? Store.patchProjectLocal(id, { talkRoomId: rid, talkThreadId: rid })
      : Store.updateProject?.(id, { talkRoomId: rid, talkThreadId: rid });
    // 認証済みなら adapter 経由で DB も更新（失敗は握りつぶし · Console Error にしない）
    try {
      const project = Store.getProject?.(id);
      if (project && global.TasuBuilderProjectWriteAdapter?.writeProject) {
        global.TasuBuilderProjectWriteAdapter.writeProject(project).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return localRes || { ok: true };
  }

  async function findRoomByProjectId(projectId) {
    return findRoomByListing(projectId, LISTING_TYPE);
  }

  async function findRoomByListing(projectId, listingType) {
    const pid = pickStr(projectId);
    const lt = pickStr(listingType, LISTING_TYPE);
    if (!pid) return null;
    const sb = global.TasuSupabase?.getClient?.();
    if (!sb || !global.TasuSupabase?.isConfigured?.()) return null;
    if (global.location?.protocol === "file:") return null;
    try {
      const { data, error } = await sb
        .from("transaction_rooms")
        .select("*")
        .eq("listing_id", pid)
        .eq("listing_type", lt)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  }

  function registerLocalRoom(project, roomId) {
    const p = project || {};
    const id = pickStr(roomId) || localRoomIdForProject(p.id);
    const title = pickStr(p.name, "Builder 案件");
    const thread = {
      id,
      listing: { id: pickStr(p.id), type: LISTING_TYPE, title },
      partner: {
        id: sellerIdForProject(p),
        displayName: pickStr(p.managerName, p.assignedVendor, p.customerName, "Builder"),
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=B",
      },
      buyerId: getMeId(),
      sellerId: sellerIdForProject(p),
      status: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
      source: "builder_calendar",
    };
    try {
      global.TasuChatSupabase?.registerLocalConsultRoom?.(thread, []);
    } catch {
      /* ignore */
    }
    return id;
  }

  /**
   * 案件に紐づく Talk Room を取得または作成し、talkRoomId を保存する。
   * @param {string|object} projectOrId
   * @returns {Promise<{ok:boolean, roomId?:string, created?:boolean, reused?:boolean, mode?:string, reason?:string}>}
   */
  async function ensureTalkRoomForProject(projectOrId) {
    const Store = getStore();
    const projectId =
      typeof projectOrId === "string"
        ? pickStr(projectOrId)
        : pickStr(projectOrId?.id, projectOrId?.project_id);
    if (!projectId) return { ok: false, reason: "missing_project_id" };

    if (inflight.has(projectId)) {
      return inflight.get(projectId);
    }

    const run = ensureTalkRoomForProjectUnlocked(projectOrId, projectId);
    inflight.set(projectId, run);
    try {
      return await run;
    } finally {
      inflight.delete(projectId);
    }
  }

  async function ensureTalkRoomForProjectUnlocked(projectOrId, projectId) {
    const Store = getStore();
    const project =
      (typeof projectOrId === "object" && projectOrId?.id ? projectOrId : null) ||
      Store?.getProject?.(projectId);
    if (!project) return { ok: false, reason: "project_not_found" };

    const current = pickStr(project.talkRoomId, project.talkThreadId);
    // UUID のみ即 return。local-room-builder-* は実 room へ昇格を試みる
    if (isUuidRoomId(current)) {
      return { ok: true, roomId: current, created: false, reused: true, mode: "cached" };
    }

    // 既存 transaction_rooms（同一案件）
    const existing = await findRoomByProjectId(projectId);
    if (existing?.id) {
      const rid = String(existing.id);
      persistTalkRoomId(projectId, rid);
      return { ok: true, roomId: rid, created: false, reused: true, mode: "db_lookup" };
    }

    const meId = getMeId();
    const sellerId = sellerIdForProject(project) || `builder_${projectId}`;
    const title = `【Builder】${pickStr(project.name, projectId)}`;

    // Edge ensure-talk-room は CORS で失敗しやすいため、Calendar は client insert を優先
    // （TasuChatSupabase.createListingTalkRoom があれば再利用検索付きで使う）
    const Supabase = global.TasuChatSupabase;
    if (Supabase?.createListingTalkRoom) {
      try {
        const created = await Supabase.createListingTalkRoom({
          listing_id: projectId,
          listing_type: LISTING_TYPE,
          buyer_id: meId,
          seller_id: sellerId,
          title,
          status: "active",
          source: "builder_calendar",
          service_type: SERVICE_TYPE,
          service_ref_id: projectId,
        });
        if (created?.id && !isPlaceholderTalkRoomId(created.id)) {
          const rid = String(created.id);
          persistTalkRoomId(projectId, rid);
          return {
            ok: true,
            roomId: rid,
            created: Boolean(created.created),
            reused: Boolean(created.reused),
            mode: created.local ? "local_via_helper" : "client_insert",
          };
        }
      } catch {
        /* fall through */
      }
    }

    const sb = global.TasuSupabase?.getClient?.();
    if (sb && global.TasuSupabase?.isConfigured?.() && global.location?.protocol !== "file:") {
      try {
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        const { data, error } = await sb
          .from("transaction_rooms")
          .insert({
            listing_id: projectId,
            listing_type: LISTING_TYPE,
            title,
            buyer_id: meId,
            seller_id: sellerId,
            partner_id: sellerId,
            partner_display_name: pickStr(project.managerName, project.customerName, "Builder"),
            expires_at: expiresAt,
            status: "active",
          })
          .select("*")
          .single();
        if (!error && data?.id) {
          const rid = String(data.id);
          persistTalkRoomId(projectId, rid);
          return { ok: true, roomId: rid, created: true, reused: false, mode: "direct_insert" };
        }
      } catch {
        /* fall through to local */
      }
    }

    // localStorage fallback（安定 ID · 既に provisional があれば維持）
    if (isLocalBuilderRoomId(current)) {
      registerLocalRoom(project, current);
      return { ok: true, roomId: current, created: false, reused: true, mode: "local_cached" };
    }
    const localId = localRoomIdForProject(projectId);
    registerLocalRoom(project, localId);
    persistTalkRoomId(projectId, localId);
    return { ok: true, roomId: localId, created: true, reused: false, mode: "local_fallback" };
  }

  /**
   * Talk 遷移 URL（実 room 前提）
   */
  function buildTalkHref(projectId, roomId, opts) {
    const rid = pickStr(roomId);
    const pid = pickStr(projectId);
    if (!rid) return "";
    const returnTo = `builder/project-calendar.html?projectId=${encodeURIComponent(pid)}&openDetail=1`;
    const sp = new URLSearchParams();
    sp.set("thread", rid);
    sp.set("roomId", rid);
    sp.set("from", "builder_calendar");
    sp.set("builderFlow", "ops_partner");
    sp.set("builderRole", pickStr(opts?.role, "partner"));
    sp.set("projectId", pid);
    sp.set("builderProjectId", pid);
    sp.set("talkRoomId", rid);
    sp.set("returnTo", returnTo);
    sp.set("source", "builder_calendar");
    // builder/ 配下からは ../chat-detail
    const base = pickStr(opts?.baseHref, "../chat-detail.html");
    return `${base}?${sp.toString()}`;
  }

  function localRoomIdForGeneralProject(projectUuid) {
    return `local-room-builder-general-${pickStr(projectUuid)}`;
  }

  function registerGeneralLocalRoom(opts, roomId) {
    const projectUuid = pickStr(opts?.projectUuid, opts?.id);
    const projectKey = pickStr(opts?.projectKey, opts?.project_id);
    const ownerAuthUid = pickStr(opts?.ownerAuthUid, opts?.owner_id);
    const applicantAuthUid = pickStr(opts?.applicantAuthUid);
    const title = pickStr(opts?.title, projectKey, "一般案件");
    const rid = pickStr(roomId) || localRoomIdForGeneralProject(projectUuid);
    const thread = {
      id: rid,
      listing: { id: projectUuid || projectKey, type: LISTING_TYPE_GENERAL, title },
      partner: {
        id: applicantAuthUid || `general_applicant_${projectKey}`,
        displayName: pickStr(opts?.applicantName, "応募者"),
        avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=G",
      },
      buyerId: ownerAuthUid || getMeId(),
      sellerId: applicantAuthUid || `general_applicant_${projectKey}`,
      status: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
      source: SERVICE_TYPE_GENERAL,
    };
    try {
      global.TasuChatSupabase?.registerLocalConsultRoom?.(thread, []);
    } catch {
      /* ignore */
    }
    return rid;
  }

  /**
   * 一般案件（builder_board）選定後 — Talk Room ensure（Hub/Calendar 資産再利用）
   * @param {object} opts
   */
  async function ensureTalkRoomForGeneralProject(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const projectUuid = pickStr(o.projectUuid, o.id, o.uuid);
    const projectKey = pickStr(o.projectKey, o.project_id);
    if (!projectUuid && !projectKey) return { ok: false, reason: "missing_project_id" };

    const listingId = projectUuid || projectKey;
    const inflightKey = `general:${listingId}`;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const run = ensureTalkRoomForGeneralProjectUnlocked(o, listingId, projectUuid, projectKey);
    inflight.set(inflightKey, run);
    try {
      return await run;
    } finally {
      inflight.delete(inflightKey);
    }
  }

  async function ensureTalkRoomForGeneralProjectUnlocked(o, listingId, projectUuid, projectKey) {
    const existing = pickStr(o.talkRoomId, o.talk_room_id);
    if (isUuidRoomId(existing)) {
      return { ok: true, roomId: existing, created: false, reused: true, mode: "cached" };
    }

    const existingRoom = await findRoomByListing(listingId, LISTING_TYPE_GENERAL);
    if (existingRoom?.id) {
      const rid = String(existingRoom.id);
      return { ok: true, roomId: rid, created: false, reused: true, mode: "db_lookup" };
    }

    const ownerAuthUid = pickStr(o.ownerAuthUid, o.owner_id) || getMeId();
    const applicantAuthUid = pickStr(o.applicantAuthUid);
    const sellerId = applicantAuthUid || `general_applicant_${projectKey || listingId}`;
    const title = `【一般案件】${pickStr(o.title, projectKey, listingId)}`;

    const Supabase = global.TasuChatSupabase;
    if (Supabase?.createListingTalkRoom) {
      try {
        const created = await Supabase.createListingTalkRoom({
          listing_id: listingId,
          listing_type: LISTING_TYPE_GENERAL,
          buyer_id: ownerAuthUid,
          seller_id: sellerId,
          title,
          status: "active",
          source: SERVICE_TYPE_GENERAL,
          service_type: SERVICE_TYPE_GENERAL,
          service_ref_id: listingId,
        });
        if (created?.id && !isPlaceholderTalkRoomId(created.id)) {
          const rid = String(created.id);
          return {
            ok: true,
            roomId: rid,
            created: Boolean(created.created),
            reused: Boolean(created.reused),
            mode: created.local ? "local_via_helper" : "client_insert",
          };
        }
      } catch {
        /* fall through */
      }
    }

    const sb = global.TasuSupabase?.getClient?.();
    if (sb && global.TasuSupabase?.isConfigured?.() && global.location?.protocol !== "file:") {
      try {
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        const { data, error } = await sb
          .from("transaction_rooms")
          .insert({
            listing_id: listingId,
            listing_type: LISTING_TYPE_GENERAL,
            title,
            buyer_id: ownerAuthUid,
            seller_id: sellerId,
            partner_id: sellerId,
            partner_display_name: pickStr(o.applicantName, "応募者"),
            expires_at: expiresAt,
            status: "active",
          })
          .select("*")
          .single();
        if (!error && data?.id) {
          const rid = String(data.id);
          return { ok: true, roomId: rid, created: true, reused: false, mode: "direct_insert" };
        }
      } catch {
        /* fall through */
      }
    }

    const localId = localRoomIdForGeneralProject(projectUuid || projectKey);
    registerGeneralLocalRoom(o, localId);
    return { ok: true, roomId: localId, created: true, reused: false, mode: "local_fallback" };
  }

  /**
   * 一般案件 Talk 遷移 URL（UUID 正本）
   */
  function buildGeneralTalkHref(projectId, roomId, opts) {
    const rid = pickStr(roomId);
    const pid = pickStr(projectId);
    if (!rid) return "";
    const returnTo = `builder/board-project-detail.html?id=${encodeURIComponent(pid)}`;
    const sp = new URLSearchParams();
    sp.set("thread", rid);
    sp.set("roomId", rid);
    sp.set("from", "builder");
    sp.set("builderFlow", "partner_user");
    sp.set("builderRole", pickStr(opts?.role, "partner"));
    if (pid) {
      sp.set("projectId", pid);
      sp.set("builderProjectId", pid);
    }
    sp.set("talkRoomId", rid);
    sp.set("returnTo", returnTo);
    sp.set("source", SERVICE_TYPE_GENERAL);
    const base = pickStr(opts?.baseHref, "../chat-detail.html");
    return `${base}?${sp.toString()}`;
  }

  /**
   * Talk 遷移 ID 解決（一般案件）: DB UUID > ensure UUID > MVP thread fallback
   */
  function resolveGeneralTalkTarget(project, state) {
    const p = project && typeof project === "object" ? project : {};
    const talkRoomId = pickStr(p.talk_room_id, p.talkRoomId);
    if (isUuidRoomId(talkRoomId)) {
      return { kind: "uuid", id: talkRoomId, href: buildGeneralTalkHref(p.project_id, talkRoomId) };
    }
    if (isStableTalkRoomId(talkRoomId)) {
      return { kind: "stable", id: talkRoomId, href: buildGeneralTalkHref(p.project_id, talkRoomId) };
    }
    const threadId = pickStr(p.main_thread_id);
    if (threadId && state?.threads?.[threadId]) {
      return { kind: "mvp_thread", id: threadId, href: "" };
    }
    const match = Object.values(state?.threads || {}).find(
      (t) => String(t.project_id) === String(p.project_id)
    );
    const fallbackThread = pickStr(match?.thread_id);
    if (fallbackThread) {
      return { kind: "mvp_thread", id: fallbackThread, href: "" };
    }
    return { kind: "none", id: "", href: "" };
  }

  global.TasuBuilderProjectTalkRoom = {
    VERSION,
    LISTING_TYPE,
    LISTING_TYPE_GENERAL,
    isUuidRoomId,
    isLocalBuilderRoomId,
    isPlaceholderTalkRoomId,
    isStableTalkRoomId,
    isCanonicalTalkRoomId,
    localRoomIdForProject,
    localRoomIdForGeneralProject,
    assignProvisionalTalkRoom,
    findRoomByProjectId,
    findRoomByListing,
    ensureTalkRoomForProject,
    ensureTalkRoomForGeneralProject,
    buildTalkHref,
    buildGeneralTalkHref,
    resolveGeneralTalkTarget,
    persistTalkRoomId,
  };
})(typeof window !== "undefined" ? window : globalThis);
