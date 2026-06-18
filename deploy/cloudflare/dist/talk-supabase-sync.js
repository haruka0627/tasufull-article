/**
 * TASFUL TALK — Supabase 同期（localStorage キャッシュ + オフラインキュー）
 * 各ストアが register() 後、initStore(id) / initAll() を呼ぶ。
 */
(function (global) {
  "use strict";

  const PENDING_KEY = "tasful_talk_sync_pending_v1";
  const PULL_LIMIT = 200;
  const realtimeChannels = new Map();
  const initPromises = new Map();

  function getUserId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      global.TASU_CHAT_SUPABASE_CONFIG?.me?.id ||
      "u_me"
    );
  }

  function isOnline() {
    return global.navigator?.onLine !== false;
  }

  function isAvailable() {
    if (!isOnline()) return false;
    if (global.location?.protocol === "file:") return false;
    if (!global.TasuSupabase?.isConfigured?.()) return false;
    return global.TasuTalkRuntime?.hasAuthenticatedTalkSession?.() === true;
  }

  function getClient() {
    try {
      return global.TasuSupabase?.getClient?.() || null;
    } catch (err) {
      console.warn("[TasuTalkSync] getClient failed:", err);
      return null;
    }
  }

  function readPending() {
    try {
      const raw = global.localStorage.getItem(PENDING_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writePending(list) {
    try {
      global.localStorage.setItem(PENDING_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch (err) {
      console.warn("[TasuTalkSync] pending write failed:", err);
    }
  }

  function enqueue(item) {
    const pending = readPending();
    pending.push({ ...item, at: Date.now() });
    writePending(pending.slice(-500));
  }

  function rowTs(row) {
    return String(row?.updatedAt || row?.updated_at || row?.createdAt || row?.created_at || "");
  }

  function mergeRows(local, remote, normalize) {
    const byId = new Map();
    for (const r of remote) {
      const n = normalize(r);
      if (n?.id) byId.set(String(n.id), n);
    }
    for (const r of local) {
      const n = normalize(r);
      if (!n?.id) continue;
      const id = String(n.id);
      const ex = byId.get(id);
      if (!ex || rowTs(n) >= rowTs(ex)) {
        byId.set(id, n);
      }
    }
    return Array.from(byId.values());
  }

  function readLocal(cfg) {
    try {
      const raw = global.localStorage.getItem(cfg.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(cfg.normalize);
    } catch (err) {
      console.warn(`[TasuTalkSync] local read ${cfg.id} failed:`, err);
      return [];
    }
  }

  function writeLocal(cfg, list, meta) {
    const max = cfg.maxRows || 100;
    const safe = Array.isArray(list) ? list.slice(0, max).map(cfg.normalize) : [];
    try {
      global.localStorage.setItem(cfg.storageKey, JSON.stringify(safe));
      global.dispatchEvent(
        new CustomEvent(cfg.eventName, { detail: { list: safe, source: meta?.source || "local" } })
      );
    } catch (err) {
      console.warn(`[TasuTalkSync] local write ${cfg.id} failed:`, err);
    }
    return safe;
  }

  async function fetchRemote(cfg) {
    const sb = getClient();
    if (!sb) return [];
    const uid = getUserId();
    const orderCol = cfg.orderColumn || "updated_at";
    const { data, error } = await sb
      .from(cfg.table)
      .select("*")
      .eq("user_id", uid)
      .order(orderCol, { ascending: false })
      .limit(PULL_LIMIT);
    if (error) {
      console.warn(`[TasuTalkSync] fetch ${cfg.id} failed:`, error.message || error);
      return null;
    }
    return Array.isArray(data) ? data.map(cfg.fromRow).filter(Boolean) : [];
  }

  async function upsertDb(cfg, appRow) {
    const sb = getClient();
    if (!sb) throw new Error("no_client");
    const dbRow = cfg.toRow(appRow, getUserId());
    const { error } = await sb.from(cfg.table).upsert(dbRow, { onConflict: "id" });
    if (error) throw error;
    return dbRow;
  }

  async function deleteDb(cfg, id) {
    const sb = getClient();
    if (!sb) throw new Error("no_client");
    const { error } = await sb
      .from(cfg.table)
      .delete()
      .eq("id", String(id))
      .eq("user_id", getUserId());
    if (error) throw error;
  }

  async function flushPendingForTable(table) {
    if (!isAvailable()) return;
    const pending = readPending();
    const rest = [];
    for (const item of pending) {
      if (item.table !== table) {
        rest.push(item);
        continue;
      }
      try {
        if (item.op === "delete") {
          const cfg = stores.get(item.storeId);
          if (cfg) await deleteDb(cfg, item.id);
        } else if (item.op === "upsert") {
          const sb = getClient();
          if (!sb) throw new Error("no_client");
          const { error } = await sb.from(table).upsert(item.row, { onConflict: "id" });
          if (error) throw error;
        }
      } catch (err) {
        console.warn(`[TasuTalkSync] flush pending failed (${table}):`, err);
        rest.push(item);
      }
    }
    writePending(rest);
  }

  async function reconcilePush(cfg, rows) {
    if (!isAvailable() || !rows?.length) return;
    const batch = rows.map((r) => cfg.toRow(r, getUserId()));
    const sb = getClient();
    if (!sb) return;
    try {
      const { error } = await sb.from(cfg.table).upsert(batch, { onConflict: "id" });
      if (error) throw error;
    } catch (err) {
      console.warn(`[TasuTalkSync] reconcile ${cfg.id} failed:`, err);
      for (const row of rows) {
        enqueue({ storeId: cfg.id, table: cfg.table, op: "upsert", row: cfg.toRow(row, getUserId()) });
      }
    }
  }

  const stores = new Map();

  function register(cfg) {
    if (!cfg?.id) return;
    stores.set(cfg.id, cfg);
  }

  async function pullAndMerge(cfg) {
    const local = readLocal(cfg);
    if (!isAvailable()) return local;
    const remote = await fetchRemote(cfg);
    if (remote === null) return local;
    const merged = mergeRows(local, remote, cfg.normalize);
    const sorted = cfg.sortMerged ? cfg.sortMerged(merged) : merged;
    writeLocal(cfg, sorted, { source: "merge" });
    await reconcilePush(cfg, sorted);
    return sorted;
  }

  let pullTimers = new Map();

  function schedulePull(cfg) {
    const existing = pullTimers.get(cfg.id);
    if (existing) clearTimeout(existing);
    pullTimers.set(
      cfg.id,
      setTimeout(() => {
        pullTimers.delete(cfg.id);
        pullAndMerge(cfg).catch((err) => {
          console.warn(`[TasuTalkSync] scheduled pull ${cfg.id}:`, err);
        });
      }, 280)
    );
  }

  function subscribeRealtime(cfg) {
    if (!isAvailable()) return () => {};
    const sb = getClient();
    if (!sb) return () => {};
    const uid = getUserId();
    const channelName = `tasful-talk-${cfg.id}-${uid}`;
    if (realtimeChannels.has(channelName)) return () => {};

    try {
      const channel = sb
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: cfg.table,
            filter: `user_id=eq.${uid}`,
          },
          () => schedulePull(cfg)
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn(`[TasuTalkSync] realtime error: ${cfg.id}`);
          }
        });
      realtimeChannels.set(channelName, channel);
      return () => {
        try {
          sb.removeChannel(channel);
        } catch {
          /* ignore */
        }
        realtimeChannels.delete(channelName);
      };
    } catch (err) {
      console.warn(`[TasuTalkSync] subscribe ${cfg.id} failed:`, err);
      return () => {};
    }
  }

  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise((resolve) => {
        global.setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  }

  async function initStore(id) {
    if (initPromises.has(id)) return initPromises.get(id);
    const cfg = stores.get(id);
    if (!cfg) return [];
    const p = (async () => {
      await withTimeout(flushPendingForTable(cfg.table), 4000, undefined);
      const list = await withTimeout(pullAndMerge(cfg), 8000, readLocal(cfg));
      subscribeRealtime(cfg);
      return list;
    })().catch((err) => {
      console.warn(`[TasuTalkSync] init ${id} failed:`, err);
      return readLocal(cfg);
    });
    initPromises.set(id, p);
    return p;
  }

  async function initAll() {
    const ids = Array.from(stores.keys());
    await Promise.all(ids.map((id) => initStore(id)));
  }

  function scheduleUpsert(id, appRow) {
    const cfg = stores.get(id);
    if (!cfg || !appRow) return;
    const run = async () => {
      if (!isAvailable()) {
        enqueue({
          storeId: id,
          table: cfg.table,
          op: "upsert",
          row: cfg.toRow(appRow, getUserId()),
        });
        return;
      }
      try {
        await upsertDb(cfg, appRow);
      } catch (err) {
        console.warn(`[TasuTalkSync] upsert ${id} failed:`, err);
        enqueue({
          storeId: id,
          table: cfg.table,
          op: "upsert",
          row: cfg.toRow(appRow, getUserId()),
        });
      }
    };
    void run();
  }

  function scheduleDelete(id, rowId) {
    const cfg = stores.get(id);
    if (!cfg || !rowId) return;
    const run = async () => {
      if (!isAvailable()) {
        enqueue({ storeId: id, table: cfg.table, op: "delete", id: String(rowId) });
        return;
      }
      try {
        await deleteDb(cfg, rowId);
      } catch (err) {
        console.warn(`[TasuTalkSync] delete ${id} failed:`, err);
        enqueue({ storeId: id, table: cfg.table, op: "delete", id: String(rowId) });
      }
    };
    void run();
  }

  function onOnline() {
    if (!isAvailable()) return;
    void (async () => {
      for (const cfg of stores.values()) {
        await flushPendingForTable(cfg.table);
        await pullAndMerge(cfg);
      }
    })();
  }

  if (!global.__tasfulTalkSyncOnlineBound) {
    global.__tasfulTalkSyncOnlineBound = true;
    global.addEventListener("online", onOnline);
  }

  global.TasuTalkSupabaseSync = {
    PENDING_KEY,
    getUserId,
    isAvailable,
    isOnline,
    register,
    initStore,
    initAll,
    scheduleUpsert,
    scheduleDelete,
    pullAndMerge,
    readLocal,
    writeLocal,
    mergeRows,
    flushPendingForTable,
  };
})(typeof window !== "undefined" ? window : globalThis);
