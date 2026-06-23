/**
 * TASFUL LIVE — 収益化ステータス / 広告RPM（Phase 12: Supabase DB 優先 + localStorage fallback）
 */
(function (global) {
  "use strict";

  const C = () => global.TasuLiveConfig;

  let globalRpmCache = { value: null, at: 0 };
  const GLOBAL_RPM_CACHE_MS = 60_000;

  function isNetworkFallbackError(err) {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    if (err.status === 401 || err.status === 403) return false;
    return (
      /failed to fetch|network|timeout|edge skipped|未設定|load failed/i.test(msg) ||
      err.name === "TypeError"
    );
  }

  function normalizeStatus(status) {
    return C()?.normalizeMonetizationStatus?.(status) || (status === "none" ? "not_applied" : String(status || "not_applied"));
  }

  function rowToRecord(row) {
    if (!row) return { status: "not_applied" };
    return {
      status: normalizeStatus(row.status),
      appliedAt: row.applied_at || null,
      updatedAt: row.updated_at || null,
      reviewedAt: row.reviewed_at || null,
      reviewedBy: row.reviewed_by || null,
      note: row.note || "",
      adminNote: row.note || "",
      id: row.id || null,
    };
  }

  // --- localStorage fallback (Phase 10–11 stub) ---

  function statusKey(userId) {
    return `creator_monetization_status:${String(userId || "").trim()}`;
  }

  function noteKey(userId) {
    return `creator_monetization_note:${String(userId || "").trim()}`;
  }

  function readStore() {
    const cfg = C();
    try {
      const raw = global.localStorage?.getItem(cfg.CREATOR_MONETIZATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeStore(store) {
    const cfg = C();
    try {
      global.localStorage?.setItem(cfg.CREATOR_MONETIZATION_STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }

  function syncLegacyKeys(userId, record) {
    const id = String(userId || "").trim();
    if (!id || !global.localStorage) return;
    try {
      const status = normalizeStatus(record?.status);
      global.localStorage.setItem(statusKey(id), status === "not_applied" ? "none" : status);
      global.localStorage.setItem(noteKey(id), String(record?.adminNote || record?.note || ""));
    } catch {
      /* ignore */
    }
  }

  function readLegacyStatus(userId) {
    try {
      return global.localStorage?.getItem(statusKey(userId)) || null;
    } catch {
      return null;
    }
  }

  function getRecordLocal(userId) {
    const id = String(userId || "").trim();
    if (!id) return { status: "not_applied" };
    const store = readStore();
    const fromStore = store[id];
    if (fromStore) {
      return {
        status: normalizeStatus(fromStore.status),
        appliedAt: fromStore.appliedAt || null,
        updatedAt: fromStore.updatedAt || null,
        note: fromStore.note || "",
        adminNote: fromStore.adminNote || "",
      };
    }
    const legacy = readLegacyStatus(id);
    if (legacy) return { status: normalizeStatus(legacy) };
    return { status: "not_applied" };
  }

  function setRecordLocal(userId, patch) {
    const id = String(userId || "").trim();
    if (!id) throw new Error("userId が不正です");
    const store = readStore();
    const prev = store[id] || {};
    const now = new Date().toISOString();
    const nextStatus = normalizeStatus(patch.status ?? prev.status ?? "not_applied");
    const next = {
      ...prev,
      ...patch,
      status: nextStatus,
      updatedAt: now,
    };
    if (nextStatus === "pending" && !next.appliedAt) {
      next.appliedAt = now;
    }
    store[id] = next;
    writeStore(store);
    syncLegacyKeys(id, next);
    return next;
  }

  // --- Supabase DB ---

  async function fetchRecordFromDb(userId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return null;

    const id = String(userId || "").trim();
    if (!id) return null;

    const { data, error } = await client
      .from(cfg.TABLES.creatorMonetization)
      .select("id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at")
      .eq("user_id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToRecord(data) : { status: "not_applied" };
  }

  async function applyViaDb(userId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) throw new Error("Supabase が未設定です");

    const id = String(userId || "").trim();
    if (!id) throw new Error("userId が不正です");

    const existing = await fetchRecordFromDb(id).catch(() => getRecordLocal(id));
    const current = normalizeStatus(existing?.status);

    if (["pending", "approved", "suspended"].includes(current)) {
      const err = new Error(`重複申請できません（現在: ${cfg.labelMonetizationStatus(current)}）`);
      err.code = "duplicate_apply";
      throw err;
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: id,
      status: "pending",
      applied_at: now,
    };

    const { data, error } = await client
      .from(cfg.TABLES.creatorMonetization)
      .upsert(payload, { onConflict: "user_id" })
      .select("id, user_id, status, note, applied_at, reviewed_at, reviewed_by, created_at, updated_at")
      .maybeSingle();

    if (error) throw error;
    const record = rowToRecord(data);
    syncLegacyKeys(id, record);
    return record;
  }

  async function fetchGlobalRpmFromDb() {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from(cfg.TABLES.adRpmSettings)
      .select("rpm_yen")
      .eq("scope", "global")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.rpm_yen != null) return Number(data.rpm_yen);
    return null;
  }

  async function fetchAdRpmMapFromDb() {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return {};

    const { data, error } = await client
      .from(cfg.TABLES.adRpmSettings)
      .select("target_id, rpm_yen")
      .eq("scope", "ad")
      .eq("active", true);

    if (error) throw error;
    const map = {};
    for (const row of data || []) {
      if (row.target_id) map[String(row.target_id)] = Number(row.rpm_yen);
    }
    return map;
  }

  // --- Public API ---

  function getRecord(userId) {
    return getRecordLocal(userId);
  }

  async function getRecordAsync(userId) {
    try {
      const cfg = C();
      if (!cfg?.getClient?.()) return getRecordLocal(userId);
      return await fetchRecordFromDb(userId);
    } catch (err) {
      if (isNetworkFallbackError(err)) {
        console.warn("[TasuLiveMonetization] DB read fallback:", err.message || err);
        return getRecordLocal(userId);
      }
      throw err;
    }
  }

  function getStatus(userId) {
    return getRecord(userId).status;
  }

  async function getStatusAsync(userId) {
    const record = await getRecordAsync(userId);
    return record.status;
  }

  function setStatus(userId, status, extras = {}) {
    return setRecordLocal(userId, { status: normalizeStatus(status), ...extras });
  }

  function setRecord(userId, patch) {
    return setRecordLocal(userId, patch);
  }

  async function applyMonetization(userId) {
    try {
      const cfg = C();
      if (!cfg?.getClient?.()) return setRecordLocal(userId, { status: "pending" });
      return await applyViaDb(userId);
    } catch (err) {
      if (isNetworkFallbackError(err)) {
        console.warn("[TasuLiveMonetization] apply fallback:", err.message || err);
        return setRecordLocal(userId, { status: "pending" });
      }
      throw err;
    }
  }

  function listAllRecords() {
    const store = readStore();
    return Object.entries(store).map(([userId, row]) => ({
      userId,
      status: normalizeStatus(row?.status),
      appliedAt: row?.appliedAt || null,
      updatedAt: row?.updatedAt || null,
      note: row?.note || "",
      adminNote: row?.adminNote || "",
    }));
  }

  function listApplicationRecords() {
    return listAllRecords().filter((r) => r.status !== "not_applied" || r.appliedAt);
  }

  async function listApplicationsViaEdge() {
    const cfg = C();
    const data = await cfg.fetchMonetizationAdminViaEdge({ action: "list_applications", limit: 100 });
    return (data.items || []).map((item) => ({
      userId: item.user_id,
      status: normalizeStatus(item.status),
      appliedAt: item.applied_at || null,
      updatedAt: item.updated_at || null,
      note: item.note || "",
      adminNote: item.note || "",
      stats: item.stats || null,
      id: item.id || null,
    }));
  }

  async function getApplicationDetailViaEdge(userId) {
    const cfg = C();
    return cfg.fetchMonetizationAdminViaEdge({
      action: "get_application_detail",
      user_id: userId,
    });
  }

  async function reviewApplicationViaEdge(userId, reviewAction, note) {
    const cfg = C();
    return cfg.fetchMonetizationAdminViaEdge({
      action: "review_application",
      user_id: userId,
      review_action: reviewAction,
      note: note ?? undefined,
      source_page: "admin_videos",
    });
  }

  async function listRpmSettingsViaEdge() {
    const cfg = C();
    const data = await cfg.fetchMonetizationAdminViaEdge({ action: "list_rpm_settings" });
    return data.items || [];
  }

  async function updateRpmSettingViaEdge(id, patch) {
    const cfg = C();
    return cfg.fetchMonetizationAdminViaEdge({
      action: "update_rpm_setting",
      id,
      ...patch,
      source_page: "admin_videos",
    });
  }

  async function createRpmSettingViaEdge(scope, targetId, rpmYen) {
    const cfg = C();
    return cfg.fetchMonetizationAdminViaEdge({
      action: "create_rpm_setting",
      scope,
      target_id: targetId || undefined,
      rpm_yen: rpmYen,
      source_page: "admin_videos",
    });
  }

  const AD_RPM_STORAGE_KEY = "tlv-admin-ad-rpm-v1";
  const AD_ENDED_STORAGE_KEY = "tlv-admin-ad-ended-v1";

  function readAdRpmMap() {
    try {
      const raw = global.localStorage?.getItem(AD_RPM_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeAdRpmMap(map) {
    try {
      global.localStorage?.setItem(AD_RPM_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  let adRpmDbCache = { map: null, at: 0 };

  async function ensureAdRpmDbCache() {
    const now = Date.now();
    if (adRpmDbCache.map && now - adRpmDbCache.at < GLOBAL_RPM_CACHE_MS) {
      return adRpmDbCache.map;
    }
    try {
      const map = await fetchAdRpmMapFromDb();
      adRpmDbCache = { map, at: now };
      return map;
    } catch (err) {
      if (isNetworkFallbackError(err)) return null;
      throw err;
    }
  }

  function getAdRpm(adId, fallback) {
    const cfg = C();
    const map = readAdRpmMap();
    const v = map[String(adId || "")];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
    return fallback ?? cfg.CREATOR_ESTIMATED_RPM_YEN;
  }

  async function getAdRpmAsync(adId, fallback) {
    const cfg = C();
    try {
      const dbMap = await ensureAdRpmDbCache();
      if (dbMap && dbMap[String(adId || "")] != null) {
        return Number(dbMap[String(adId)]);
      }
      const globalRpm = await getGlobalRpmYenAsync();
      return getAdRpm(adId, fallback ?? globalRpm);
    } catch {
      return getAdRpm(adId, fallback);
    }
  }

  async function getGlobalRpmYenAsync() {
    const cfg = C();
    const now = Date.now();
    if (globalRpmCache.value != null && now - globalRpmCache.at < GLOBAL_RPM_CACHE_MS) {
      return globalRpmCache.value;
    }
    try {
      if (cfg?.getClient?.()) {
        const fromDb = await fetchGlobalRpmFromDb();
        if (fromDb != null) {
          globalRpmCache = { value: fromDb, at: now };
          return fromDb;
        }
      }
    } catch (err) {
      if (!isNetworkFallbackError(err)) console.warn("[TasuLiveMonetization] global RPM:", err);
    }
    const val = cfg.CREATOR_ESTIMATED_RPM_YEN;
    globalRpmCache = { value: val, at: now };
    return val;
  }

  async function setAdRpmAsync(adId, rpmYen) {
    try {
      const cfg = C();
      const adMap = await ensureAdRpmDbCache();
      const existing = adMap ? Object.entries(adMap).find(([k]) => k === String(adId)) : null;
      if (cfg?.fetchMonetizationAdminViaEdge) {
        const settings = await listRpmSettingsViaEdge().catch(() => []);
        const row = (settings || []).find((s) => s.scope === "ad" && String(s.target_id) === String(adId) && s.active);
        if (row?.id) {
          await updateRpmSettingViaEdge(row.id, { rpm_yen: Number(rpmYen) });
          adRpmDbCache = { map: null, at: 0 };
          return;
        }
        await createRpmSettingViaEdge("ad", adId, Number(rpmYen));
        adRpmDbCache = { map: null, at: 0 };
        return;
      }
      if (existing) {
        /* no edge — local only */
      }
    } catch (err) {
      if (!isNetworkFallbackError(err)) throw err;
      console.warn("[TasuLiveMonetization] setAdRpm fallback:", err.message || err);
    }
    const map = readAdRpmMap();
    map[String(adId)] = Number(rpmYen);
    writeAdRpmMap(map);
  }

  function setAdRpm(adId, rpmYen) {
    setAdRpmAsync(adId, rpmYen).catch(() => {
      const map = readAdRpmMap();
      map[String(adId)] = Number(rpmYen);
      writeAdRpmMap(map);
    });
    return readAdRpmMap();
  }

  function readAdEndedMap() {
    try {
      const raw = global.localStorage?.getItem(AD_ENDED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setAdEndedAt(adId, iso) {
    const map = readAdEndedMap();
    map[String(adId)] = iso || new Date().toISOString();
    try {
      global.localStorage?.setItem(AD_ENDED_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function getAdEndedAt(adId) {
    const map = readAdEndedMap();
    return map[String(adId || "")] || null;
  }

  function aggregateCreatorVideos(videos) {
    const list = videos || [];
    const active = list.filter((v) => v.status !== "removed");
    const totalViews = active.reduce((s, v) => s + Number(v.views_count || 0), 0);
    const totalLikes = active.reduce((s, v) => s + Number(v.likes_count || 0), 0);
    const totalReports = active.reduce((s, v) => s + Number(v.reports_count || 0), 0);
    const hiddenCount = active.filter((v) => v.status === "hidden").length;
    const removedCount = list.filter((v) => v.status === "removed").length;
    return {
      videoCount: active.length,
      totalViews,
      totalLikes,
      totalReports,
      hiddenCount,
      removedCount,
    };
  }

  function estimateImpressionsForVideo(video, hasActiveAd, { excludeAnomaly = false, risks = [] } = {}) {
    if (excludeAnomaly && shouldExcludeFromRevenueEstimate(risks)) return 0;
    return C().estimateAdImpressions(video?.views_count, hasActiveAd);
  }

  function shouldExcludeFromRevenueEstimate(risks) {
    return (risks || []).some(
      (f) =>
        f.level === "high" ||
        f.code === "ad_impression_spike" ||
        f.code === "ad-over" ||
        f.code === "device_view_burst",
    );
  }

  function mergeRiskFlags(baseFlags, dbFlags) {
    const seen = new Set((baseFlags || []).map((f) => f.code));
    const merged = [...(baseFlags || [])];
    for (const row of dbFlags || []) {
      const code = String(row.reason || row.code || "");
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const severity = String(row.severity || "medium");
      const level = severity === "high" ? "high" : severity === "low" ? "low" : "warn";
      merged.push({
        level,
        code,
        text: C().labelRiskReason(code),
        dbId: row.id,
        status: row.status,
      });
    }
    return merged;
  }

  async function fetchOpenRiskFlagsForTarget(targetType, targetId) {
    const cfg = C();
    await cfg.ensureSupabaseSession();
    const client = cfg.getClient();
    if (!client) return [];
    const { data, error } = await client
      .from(cfg.TABLES.riskFlags)
      .select("id, target_type, target_id, severity, reason, status, metadata, created_at")
      .eq("target_type", targetType)
      .eq("target_id", String(targetId || ""))
      .in("status", ["open", "watching"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.warn("[TasuLiveMonetization] risk flags skipped:", error);
      return [];
    }
    return data || [];
  }

  function assessCreatorRisks(stats, { totalImpressions = 0, recentViewsDelta = 0, dbFlags = [] } = {}) {
    const flags = [];
    const reports = Number(stats?.totalReports ?? 0);
    const views = Number(stats?.totalViews ?? 0);
    const likes = Number(stats?.totalLikes ?? 0);
    const hidden = Number(stats?.hiddenCount ?? 0);
    const removed = Number(stats?.removedCount ?? 0);

    if (reports >= 10) {
      flags.push({ level: "high", code: "reports-high", text: "通報10件以上 — 高リスク" });
    } else if (reports >= 3) {
      flags.push({ level: "warn", code: "reports-warn", text: "通報3件以上 — 注意" });
    }

    if (hidden > 0 || removed > 0) {
      flags.push({
        level: "warn",
        code: "hidden-videos",
        text: `非表示/停止動画 ${hidden + removed} 本`,
      });
    }

    if (views >= 500 && likes / Math.max(views, 1) < 0.001) {
      flags.push({ level: "warn", code: "low-like-ratio", text: "再生に対していいねが極端に少ない — 要確認" });
    }

    if (views > 0 && totalImpressions > views * 1.2) {
      flags.push({ level: "high", code: "ad-over", text: "広告表示が再生数に対して過多" });
    }

    if (views >= 5000 && likes < 10) {
      flags.push({ level: "warn", code: "spike-suspect", text: "急激な再生増加の可能性 — 要確認" });
    }

    if (recentViewsDelta >= 2000 && views >= 1000) {
      flags.push({
        level: "warn",
        code: "spike-suspect",
        text: `短期間で再生 +${recentViewsDelta.toLocaleString("ja-JP")} — 要確認`,
      });
    }

    return mergeRiskFlags(flags, dbFlags);
  }

  function canApplyStatus(status) {
    const s = normalizeStatus(status);
    return s === "not_applied" || s === "rejected";
  }

  global.TasuLiveMonetizationService = {
    statusKey,
    noteKey,
    getRecord,
    getRecordAsync,
    getStatus,
    getStatusAsync,
    setStatus,
    setRecord,
    applyMonetization,
    listAllRecords,
    listApplicationRecords,
    listApplicationsViaEdge,
    getApplicationDetailViaEdge,
    reviewApplicationViaEdge,
    listRpmSettingsViaEdge,
    updateRpmSettingViaEdge,
    createRpmSettingViaEdge,
    getAdRpm,
    getAdRpmAsync,
    getGlobalRpmYenAsync,
    setAdRpm,
    setAdRpmAsync,
    getAdEndedAt,
    setAdEndedAt,
    aggregateCreatorVideos,
    estimateImpressionsForVideo,
    assessCreatorRisks,
    shouldExcludeFromRevenueEstimate,
    mergeRiskFlags,
    fetchOpenRiskFlagsForTarget,
    canApplyStatus,
    normalizeStatus,
    AD_RPM_STORAGE_KEY,
    AD_ENDED_STORAGE_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
