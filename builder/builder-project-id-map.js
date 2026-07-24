/**
 * Builder Project ID Map（CAL-MAIN-06）
 *
 * legacy（MVP Talk）↔ Hub（Calendar / builder_projects）の薄い対応表。
 * MVP キー削除・一括変換はしない。localStorage に差分のみ蓄積。
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_project_id_map_v1";
  const VERSION = 1;

  /** デモ既定ペア（起動時に seed。MVP / Hub 本体は変更しない） */
  const DEMO_PAIRS = Object.freeze([
    Object.freeze({
      hubProjectId: "PRJ-2026-001",
      legacyProjectId: "builder_demo_001",
      legacyThreadId: "builder_thread_demo_001",
      talkRoomId: "builder-cal-PRJ-2026-001",
      source: "demo",
    }),
    Object.freeze({
      hubProjectId: "PRJ-2026-002",
      legacyProjectId: "demo-project-001",
      legacyThreadId: "thread-demo-001",
      talkRoomId: "builder-cal-PRJ-2026-002",
      source: "demo",
    }),
    Object.freeze({
      hubProjectId: "PRJ-2026-003",
      legacyProjectId: "pub-board-project-001",
      legacyThreadId: "",
      talkRoomId: "builder-cal-PRJ-2026-003",
      source: "demo",
    }),
    /** Supabase seed UUID も同一 legacy に寄せる（Staging 読取時） */
    Object.freeze({
      hubProjectId: "a0000000-0000-0000-0000-000000000001",
      legacyProjectId: "builder_demo_001",
      legacyThreadId: "builder_thread_demo_001",
      talkRoomId: "builder-cal-CAL-DEMO-001",
      source: "demo_supabase",
    }),
    Object.freeze({
      hubProjectId: "a0000000-0000-0000-0000-000000000002",
      legacyProjectId: "demo-project-001",
      legacyThreadId: "thread-demo-001",
      talkRoomId: "builder-cal-CAL-DEMO-002",
      source: "demo_supabase",
    }),
    Object.freeze({
      hubProjectId: "a0000000-0000-0000-0000-000000000003",
      legacyProjectId: "pub-board-project-001",
      legacyThreadId: "",
      talkRoomId: "builder-cal-CAL-DEMO-003",
      source: "demo_supabase",
    }),
  ]);

  /** legacy → 優先 Hub（PRJ-* を UUID より優先） */
  const PREFERRED_HUB_PREFIX = "PRJ-";

  function pickStr() {
    for (let i = 0; i < arguments.length; i += 1) {
      const v = arguments[i];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  }

  function isUuid(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(id || "")
    );
  }

  function isHubProjectId(id) {
    const s = pickStr(id);
    if (!s) return false;
    if (s.startsWith(PREFERRED_HUB_PREFIX)) return true;
    if (isUuid(s)) return true;
    return false;
  }

  function isLegacyProjectId(id) {
    const s = pickStr(id);
    if (!s || isHubProjectId(s)) return false;
    return (
      s.startsWith("builder_demo_") ||
      s.startsWith("demo-project-") ||
      s.startsWith("pub-board-") ||
      s.startsWith("builder_")
    );
  }

  function emptyStore() {
    return { version: VERSION, pairs: [] };
  }

  function readStore() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyStore();
      const pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
      return {
        version: Number(parsed.version) || VERSION,
        pairs: pairs
          .map((p) => normalizePair(p))
          .filter((p) => p.hubProjectId || p.legacyProjectId || p.talkRoomId),
      };
    } catch {
      return emptyStore();
    }
  }

  function writeStore(store) {
    try {
      global.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: VERSION,
          pairs: (store.pairs || []).map((p) => normalizePair(p)),
        })
      );
    } catch {
      /* quota / private mode */
    }
  }

  function normalizePair(raw) {
    return {
      hubProjectId: pickStr(raw?.hubProjectId, raw?.hub_project_id),
      legacyProjectId: pickStr(raw?.legacyProjectId, raw?.legacy_project_id),
      legacyThreadId: pickStr(raw?.legacyThreadId, raw?.legacy_thread_id),
      talkRoomId: pickStr(raw?.talkRoomId, raw?.talk_room_id, raw?.talkThreadId, raw?.talk_thread_id),
      source: pickStr(raw?.source) || "runtime",
      updatedAt: pickStr(raw?.updatedAt) || new Date().toISOString(),
    };
  }

  function allPairs() {
    const stored = readStore().pairs;
    const byKey = new Map();
    DEMO_PAIRS.forEach((p) => {
      const key = `${p.hubProjectId}|${p.legacyProjectId}|${p.talkRoomId}`;
      byKey.set(key, normalizePair(p));
    });
    stored.forEach((p) => {
      const n = normalizePair(p);
      const key = `${n.hubProjectId}|${n.legacyProjectId}|${n.talkRoomId}`;
      byKey.set(key, n);
    });
    return Array.from(byKey.values());
  }

  function preferHubId(candidates) {
    const list = (candidates || []).map((c) => pickStr(c)).filter(Boolean);
    if (!list.length) return "";
    const prj = list.find((id) => id.startsWith(PREFERRED_HUB_PREFIX));
    if (prj) return prj;
    const uuid = list.find((id) => isUuid(id));
    if (uuid) return uuid;
    return list[0];
  }

  function legacyToHub(legacyId) {
    const id = pickStr(legacyId);
    if (!id) return "";
    if (isHubProjectId(id)) return id;
    const hubs = allPairs()
      .filter((p) => p.legacyProjectId === id || p.legacyThreadId === id)
      .map((p) => p.hubProjectId)
      .filter(Boolean);
    return preferHubId(hubs);
  }

  function hubToLegacy(hubId) {
    const id = pickStr(hubId);
    if (!id) return "";
    if (isLegacyProjectId(id)) return id;
    const legacies = allPairs()
      .filter((p) => p.hubProjectId === id)
      .map((p) => p.legacyProjectId)
      .filter(Boolean);
    return legacies[0] || "";
  }

  function talkRoomToHub(roomId) {
    const id = pickStr(roomId);
    if (!id) return "";
    const hubs = allPairs()
      .filter((p) => p.talkRoomId === id || p.legacyThreadId === id)
      .map((p) => p.hubProjectId)
      .filter(Boolean);
    return preferHubId(hubs);
  }

  function legacyThreadToHub(threadId) {
    const id = pickStr(threadId);
    if (!id) return "";
    const hubs = allPairs()
      .filter((p) => p.legacyThreadId === id)
      .map((p) => p.hubProjectId)
      .filter(Boolean);
    return preferHubId(hubs);
  }

  /**
   * 通知 payload / MVP 行 / 任意オブジェクトから Hub project id を解決
   */
  function resolveHubProjectId(payload) {
    if (payload == null) return "";
    if (typeof payload === "string" || typeof payload === "number") {
      const id = pickStr(payload);
      if (isHubProjectId(id)) return id;
      return legacyToHub(id) || talkRoomToHub(id);
    }
    if (typeof payload !== "object") return "";

    const explicitHub = pickStr(
      payload.hubProjectId,
      payload.hub_project_id,
      payload.hubId,
      payload.hub_id
    );
    if (explicitHub && isHubProjectId(explicitHub)) return explicitHub;
    if (explicitHub) {
      const mapped = legacyToHub(explicitHub);
      if (mapped) return mapped;
    }

    const candidates = [
      payload.projectId,
      payload.project_id,
      payload.id,
      payload.listingId,
      payload.listing_id,
    ]
      .map((c) => pickStr(c))
      .filter(Boolean);

    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (isHubProjectId(c)) return c;
      const fromLegacy = legacyToHub(c);
      if (fromLegacy) return fromLegacy;
    }

    const room = pickStr(
      payload.talkRoomId,
      payload.talk_room_id,
      payload.talkThreadId,
      payload.talk_thread_id,
      payload.threadId,
      payload.thread_id,
      payload.main_thread_id
    );
    if (room) {
      const fromRoom = talkRoomToHub(room) || legacyThreadToHub(room);
      if (fromRoom) return fromRoom;
    }

    const legacy = pickStr(payload.legacyProjectId, payload.legacy_project_id);
    if (legacy) return legacyToHub(legacy);

    return "";
  }

  function resolveLegacyProjectId(payload) {
    if (payload == null) return "";
    if (typeof payload === "string" || typeof payload === "number") {
      const id = pickStr(payload);
      if (isLegacyProjectId(id)) return id;
      return hubToLegacy(id);
    }
    if (typeof payload !== "object") return "";

    const explicit = pickStr(payload.legacyProjectId, payload.legacy_project_id);
    if (explicit) return explicit;

    const candidates = [payload.projectId, payload.project_id, payload.id]
      .map((c) => pickStr(c))
      .filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (isLegacyProjectId(c)) return c;
      const mapped = hubToLegacy(c);
      if (mapped) return mapped;
    }

    const hub = resolveHubProjectId(payload);
    return hub ? hubToLegacy(hub) : "";
  }

  /**
   * 対応を登録（MVP データは触らない）
   */
  function linkIds(input) {
    const pair = normalizePair(input || {});
    if (!pair.hubProjectId && !pair.legacyProjectId && !pair.talkRoomId) {
      return { ok: false, reason: "empty" };
    }
    const store = readStore();
    const idx = store.pairs.findIndex((p) => {
      if (pair.hubProjectId && p.hubProjectId === pair.hubProjectId) return true;
      if (pair.legacyProjectId && p.legacyProjectId === pair.legacyProjectId && pair.hubProjectId) {
        return p.hubProjectId === pair.hubProjectId;
      }
      return false;
    });
    const next = {
      ...pair,
      source: pair.source || "runtime",
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      store.pairs[idx] = {
        ...store.pairs[idx],
        ...next,
        hubProjectId: next.hubProjectId || store.pairs[idx].hubProjectId,
        legacyProjectId: next.legacyProjectId || store.pairs[idx].legacyProjectId,
        legacyThreadId: next.legacyThreadId || store.pairs[idx].legacyThreadId,
        talkRoomId: next.talkRoomId || store.pairs[idx].talkRoomId,
      };
    } else {
      store.pairs.push(next);
    }
    writeStore(store);
    return { ok: true, pair: idx >= 0 ? store.pairs[idx] : next };
  }

  /** Hub 案件保存時に talkRoomId を紐付け */
  function linkHubProject(project) {
    if (!project || typeof project !== "object") return { ok: false, reason: "invalid" };
    const hubProjectId = pickStr(project.id, project.projectId, project.project_id);
    if (!hubProjectId) return { ok: false, reason: "missing_hub_id" };
    const talkRoomId = pickStr(
      project.talkRoomId,
      project.talk_room_id,
      project.talkThreadId,
      project.talk_thread_id
    );
    const legacyProjectId = pickStr(project.legacyProjectId, project.legacy_project_id) || hubToLegacy(hubProjectId);
    return linkIds({
      hubProjectId,
      legacyProjectId,
      talkRoomId,
      source: "hub_store",
    });
  }

  function buildHubCalendarHref(hubProjectId) {
    const id = pickStr(hubProjectId);
    if (!id) return "";
    return `builder/project-calendar.html?projectId=${encodeURIComponent(id)}&openDetail=1`;
  }

  function buildHubDetailHref(hubProjectId) {
    const id = pickStr(hubProjectId);
    if (!id) return "";
    return `builder/project-detail.html?id=${encodeURIComponent(id)}`;
  }

  /**
   * href に hubProjectId クエリを付与（既存 path / 必須 query は維持）
   */
  function appendHubProjectIdToHref(href, hubProjectId) {
    const url = pickStr(href);
    const hub = pickStr(hubProjectId);
    if (!url || !hub || url === "#") return url;
    try {
      const base = global.location?.href || "http://localhost/";
      const u = new URL(url, base);
      if (!u.searchParams.get("hubProjectId")) {
        u.searchParams.set("hubProjectId", hub);
      }
      const origin = new URL(base).origin;
      let out = u.href;
      if (out.startsWith(origin)) out = out.slice(origin.length);
      if (out.startsWith("/")) out = out.slice(1);
      return out;
    } catch {
      if (/[?&]hubProjectId=/.test(url)) return url;
      return url.includes("?") ? `${url}&hubProjectId=${encodeURIComponent(hub)}` : `${url}?hubProjectId=${encodeURIComponent(hub)}`;
    }
  }

  /**
   * 通知行に Hub / legacy フィールドを付与。
   * 既定の href / targetUrl（遷移 path）は変更しない（既存導線・E2E 互換）。
   * Hub 遷移は hubHref / resolveNotifyHref({ preferHub: true }) で取得。
   */
  function enrichNotifyPayload(row) {
    if (!row || typeof row !== "object") return row;
    const legacyProjectId =
      resolveLegacyProjectId(row) ||
      pickStr(row.legacyProjectId, row.legacy_project_id, row.projectId, row.project_id);
    const hubProjectId = resolveHubProjectId(row);
    const talkRoomId = pickStr(
      row.talkRoomId,
      row.talk_room_id,
      row.threadId,
      row.thread_id
    );
    const hubHref = hubProjectId
      ? buildHubCalendarHref(hubProjectId)
      : pickStr(row.hubHref, row.hub_href);
    const baseHref = pickStr(row.href, row.targetUrl, row.actionUrl);

    return {
      ...row,
      legacyProjectId: legacyProjectId || pickStr(row.legacyProjectId),
      hubProjectId: hubProjectId || pickStr(row.hubProjectId),
      projectId: pickStr(row.projectId, row.project_id) || legacyProjectId || hubProjectId,
      talkRoomId: talkRoomId || pickStr(row.talkRoomId),
      hubHref: hubHref || "",
      href: baseHref || pickStr(row.href),
      targetUrl: baseHref || pickStr(row.targetUrl, row.href),
    };
  }

  /**
   * 遷移先解決。preferHub かつ hubHref があるときのみ Calendar へ。
   * 既定は既存 href（不明時・テスト互換）。
   */
  function resolveNotifyHref(row, options) {
    const opts = options && typeof options === "object" ? options : {};
    const enriched = enrichNotifyPayload(row || {});
    if (opts.preferHub && enriched.hubHref) return enriched.hubHref;
    return pickStr(enriched.href, enriched.targetUrl, row?.href, row?.targetUrl) || "";
  }

  function clearRuntimePairsForTests() {
    writeStore(emptyStore());
  }

  function getDemoPairs() {
    return DEMO_PAIRS.map((p) => ({ ...p }));
  }

  function listPairs() {
    return allPairs();
  }

  global.TasuBuilderProjectIdMap = {
    STORAGE_KEY,
    VERSION,
    DEMO_PAIRS,
    isHubProjectId,
    isLegacyProjectId,
    legacyToHub,
    hubToLegacy,
    talkRoomToHub,
    legacyThreadToHub,
    resolveHubProjectId,
    resolveLegacyProjectId,
    linkIds,
    linkHubProject,
    buildHubCalendarHref,
    buildHubDetailHref,
    appendHubProjectIdToHref,
    enrichNotifyPayload,
    resolveNotifyHref,
    listPairs,
    getDemoPairs,
    clearRuntimePairsForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
