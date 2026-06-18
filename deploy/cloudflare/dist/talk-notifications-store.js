/**
 * TASFUL TALK — 通知（Supabase + localStorage キャッシュ）
 * キー: tasful_talk_notifications
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_notifications";
  const SYNC_STORE_ID = "notifications";
  const DB_TABLE = "talk_notifications";
  const LEGACY_READ_KEY = "tasful:talk:notifications:read:v1";
  const SEED_MARKER = "tasful_talk_notifications_seeded_v2";
  const MAX_NOTIFICATIONS = 500;
  const FANOUT_KEY = "tasful_talk_notify_fanout";

  const VALID_TYPES = new Set(
    global.TasuTalkCategory?.NOTIFICATION_TYPE_KEYS || [
      "skill",
      "worker",
      "job",
      "product",
      "shop",
      "business",
      "general",
      "builder",
      "anpi",
      "system",
    ]
  );

  const VALID_PRIORITIES = new Set(["normal", "important", "urgent", "high", "medium", "low"]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function newNotificationId() {
    return `talk-n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeType(type, data) {
    if (global.TasuTalkCategory?.normalizeTalkNotificationType) {
      return global.TasuTalkCategory.normalizeTalkNotificationType(type, data);
    }
    const t = String(type || "").toLowerCase();
    if (VALID_TYPES.has(t)) return t;
    return "system";
  }

  function normalizePriority(priority) {
    const p = String(priority || "normal").toLowerCase();
    return VALID_PRIORITIES.has(p) ? p : "normal";
  }

  function applyAttachedTalkFields(row) {
    const attach = global.TasuTalkOfficialRooms?.attachTalkFields;
    if (!attach) return row;
    const attached = attach({
      ...row,
      sendTalkMessage:
        rawSendTalkMessage(row) === undefined
          ? undefined
          : rawSendTalkMessage(row) === true,
    });
    return {
      ...row,
      sendNotification: attached.sendNotification !== false,
      sendTalkMessage: attached.sendTalkMessage === true,
      officialRoomId: attached.sendTalkMessage ? pickStr(attached.officialRoomId) || null : null,
    };
  }

  function rawSendTalkMessage(raw) {
    if (raw?.sendTalkMessage === true) return true;
    if (raw?.sendTalkMessage === false) return false;
    return undefined;
  }

  /**
   * @param {object} raw
   * @returns {object}
   */
  function normalizeNotification(raw) {
    const id = pickStr(raw?.id) || newNotificationId();
    const createdAt = pickStr(raw?.createdAt) || new Date().toISOString();
    const readAt = raw?.readAt ? pickStr(raw.readAt) : null;
    const targetUrl = pickStr(raw?.href, raw?.targetUrl, raw?.url) || "#";

    const updatedAt = pickStr(raw?.updatedAt, raw?.updated_at) || createdAt;
    const hiddenAt = raw?.hiddenAt ? pickStr(raw.hiddenAt) : raw?.hidden_at ? pickStr(raw.hidden_at) : null;
    const base = {
      id,
      type: normalizeType(raw?.type, raw),
      title: pickStr(raw?.title) || "（無題）",
      body: pickStr(raw?.body, raw?.message) || "",
      targetUrl,
      href: pickStr(raw?.href, targetUrl) || targetUrl,
      actionLabel: pickStr(raw?.actionLabel, raw?.action_label) || "",
      serviceType: pickStr(raw?.serviceType, raw?.service_type) || "",
      audience: pickStr(raw?.audience) || "",
      audienceScope: pickStr(raw?.audienceScope, raw?.audience_scope) || "",
      projectKind: pickStr(raw?.projectKind, raw?.project_kind) || "",
      recipientRole: pickStr(raw?.recipientRole, raw?.recipient_role) || "",
      recipientUserId: pickStr(raw?.recipientUserId, raw?.recipient_user_id) || "",
      senderUserId: pickStr(raw?.senderUserId, raw?.sender_user_id) || "",
      projectTitle: pickStr(raw?.projectTitle, raw?.project_title) || "",
      createdAtLabel: pickStr(raw?.createdAtLabel, raw?.created_at_label) || "",
      platformMasterVersion: pickStr(raw?.platformMasterVersion, raw?.platform_master_version) || "",
      subType: pickStr(raw?.subType, raw?.sub_type) || "",
      builderMasterVersion: pickStr(raw?.builderMasterVersion, raw?.builder_master_version) || "",
      anpiMasterVersion: pickStr(raw?.anpiMasterVersion, raw?.anpi_master_version) || "",
      createdAt,
      readAt: readAt || null,
      hiddenAt: hiddenAt || null,
      source: pickStr(raw?.source) || "tasful",
      category: pickStr(raw?.category, raw?.notifyCategory, raw?.categoryLabel) || "",
      priority: normalizePriority(raw?.priority),
      updatedAt,
      broadcastDraftId: pickStr(raw?.broadcastDraftId, raw?.broadcast_draft_id) || "",
      sourceDraftId: pickStr(raw?.sourceDraftId, raw?.source_draft_id) || "",
      followTargetId: pickStr(raw?.followTargetId, raw?.follow_target_id) || "",
      followTargetType: pickStr(raw?.followTargetType, raw?.follow_target_type) || "",
      opsWatchCategoryId: pickStr(raw?.opsWatchCategoryId, raw?.ops_watch_category_id) || "",
      opsWatchImportance: pickStr(raw?.opsWatchImportance, raw?.ops_watch_importance) || "",
      opsWatchKind: pickStr(raw?.opsWatchKind, raw?.ops_watch_kind) || "",
      opsWatchPinned: Boolean(raw?.opsWatchPinned || raw?.ops_watch_pinned),
      opsWatchArticleCount: Math.max(
        0,
        Number(raw?.opsWatchArticleCount ?? raw?.ops_watch_article_count) || 0
      ),
      opsWatchCardIds: Array.isArray(raw?.opsWatchCardIds)
        ? raw.opsWatchCardIds.map((id) => String(id)).filter(Boolean)
        : Array.isArray(raw?.ops_watch_card_ids)
          ? raw.ops_watch_card_ids.map((id) => String(id)).filter(Boolean)
          : [],
      opsWatchDetail:
        raw?.opsWatchDetail && typeof raw.opsWatchDetail === "object"
          ? raw.opsWatchDetail
          : raw?.ops_watch_detail && typeof raw.ops_watch_detail === "object"
            ? raw.ops_watch_detail
            : null,
      sendNotification: raw?.sendNotification !== false,
      sendTalkMessage: rawSendTalkMessage(raw) === true,
      officialRoomId: pickStr(raw?.officialRoomId, raw?.official_room_id) || null,
      actionTag: pickStr(raw?.actionTag, raw?.action_tag) || "",
      triggeredBy: pickStr(raw?.triggeredBy, raw?.triggered_by) || "",
      notifyTags: Array.isArray(raw?.notifyTags)
        ? raw.notifyTags.map((tag) => String(tag)).filter(Boolean)
        : Array.isArray(raw?.notify_tags)
          ? raw.notify_tags.map((tag) => String(tag)).filter(Boolean)
          : [],
      minimalNotifyCard: raw?.minimalNotifyCard === true,
      notifyListingTitle: pickStr(raw?.notifyListingTitle, raw?.notify_listing_title) || "",
      notifySupplementLine: pickStr(raw?.notifySupplementLine, raw?.notify_supplement_line) || "",
      notifyEventAt: pickStr(raw?.notifyEventAt, raw?.notify_event_at) || "",
      notifyEventAtLabel: pickStr(raw?.notifyEventAtLabel, raw?.notify_event_at_label) || "",
      feePhase: pickStr(raw?.feePhase, raw?.fee_phase) || "",
      threadId: pickStr(raw?.threadId, raw?.thread_id) || "",
      listingId: pickStr(raw?.listingId, raw?.listing_id) || "",
      reviewTargetUserId: pickStr(raw?.reviewTargetUserId, raw?.review_target_user_id) || "",
      applicationId: pickStr(raw?.applicationId, raw?.application_id) || "",
      feeAmount:
        raw?.feeAmount != null
          ? Math.round(Number(raw.feeAmount))
          : raw?.fee_amount != null
            ? Math.round(Number(raw.fee_amount))
            : null,
      connectMode: pickStr(raw?.connectMode, raw?.connect_mode) || "",
      channel: pickStr(raw?.channel) || "",
      shopName: pickStr(raw?.shopName, raw?.shop_name) || "",
      productName: pickStr(raw?.productName, raw?.product_name) || "",
      orderNumber: pickStr(raw?.orderNumber, raw?.order_number, raw?.orderId, raw?.order_id) || "",
      amount:
        raw?.amount != null
          ? Math.max(0, Math.round(Number(raw.amount)))
          : raw?.amount_yen != null
            ? Math.max(0, Math.round(Number(raw.amount_yen)))
            : null,
    };
    return applyAttachedTalkFields(base);
  }

  function applyOfficialTalkFieldsV1(masterRows) {
    let list = readList();
    const byId = new Map(
      (Array.isArray(masterRows) ? masterRows : []).map((row) => {
        const normalized = normalizeNotification(row);
        return [String(normalized.id), normalized];
      })
    );
    let changed = false;
    list = list.map((n) => {
      const patch = byId.get(String(n.id));
      const next = normalizeNotification(patch || n);
      if (
        n.sendNotification !== next.sendNotification ||
        n.sendTalkMessage !== next.sendTalkMessage ||
        n.officialRoomId !== next.officialRoomId
      ) {
        changed = true;
      }
      return next;
    });
    byId.forEach((patch, id) => {
      if (!list.some((n) => String(n.id) === id)) {
        list.unshift(patch);
        changed = true;
      }
    });
    if (changed) {
      writeList(list);
      global.TasuTalkOfficialRooms?.syncFromNotifications?.(readList());
    }
    return readList();
  }

  function syncOfficialTalkForNotification(row) {
    if (!row || row.sendTalkMessage !== true) return;
    global.TasuTalkOfficialRooms?.syncNotification?.(row);
  }

  function getCurrentUserId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function readFanoutMap() {
    try {
      const raw = global.localStorage.getItem(FANOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeFanoutMap(map) {
    try {
      global.localStorage.setItem(FANOUT_KEY, JSON.stringify(map && typeof map === "object" ? map : {}));
    } catch (err) {
      console.warn("[TasuTalkNotifications] fanout write failed:", err);
    }
  }

  function appendFanout(userId, notification) {
    const uid = String(userId || "").trim();
    if (!uid) return null;
    const map = readFanoutMap();
    const list = Array.isArray(map[uid]) ? map[uid].map(normalizeNotification) : [];
    const row = normalizeNotification(notification);
    const idx = list.findIndex((n) => String(n.id) === String(row.id));
    if (idx >= 0) list[idx] = row;
    else list.unshift(row);
    map[uid] = list.slice(0, MAX_NOTIFICATIONS);
    writeFanoutMap(map);
    return row;
  }

  function readList() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const base = Array.isArray(parsed) ? parsed.map(normalizeNotification) : [];
      const fanout = readFanoutMap()[getCurrentUserId()] || [];
      if (!Array.isArray(fanout) || !fanout.length) return base;

      const byId = new Map();
      fanout.map(normalizeNotification).forEach((n) => byId.set(String(n.id), n));
      base.forEach((n) => {
        byId.set(String(n.id), n);
      });
      return Array.from(byId.values()).sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt))
      );
    } catch {
      return [];
    }
  }

  function isOnline() {
    return global.navigator?.onLine !== false;
  }

  /**
   * 配信下書きなど — 複数ユーザーへ通知を届ける
   * @param {Array<{ userId: string, notification: object }>} items
   */
  async function deliverToUsers(items) {
    if (!isOnline()) {
      return { ok: false, reason: "offline" };
    }
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, reason: "empty_recipients" };
    }

    const currentUserId = getCurrentUserId();
    const normalized = items.map((item) => ({
      userId: String(item.userId || "").trim(),
      notification: normalizeNotification(item.notification),
    })).filter((item) => item.userId);

    if (!normalized.length) {
      return { ok: false, reason: "no_valid_recipients" };
    }

    const crossUser = normalized.some((item) => item.userId !== currentUserId);
    const runtime = global.TasuTalkRuntime;
    if (crossUser && runtime?.canClientDirectFanout?.() === false) {
      const edgeReason = runtime?.productionBroadcastBlockedReason?.();
      if (edgeReason === "production_edge_required") {
        return {
          ok: false,
          reason: edgeReason,
          message: "本番一斉配信は管理者API（Edge Function）経由のみです。現在は未設定です。",
        };
      }
      return {
        ok: false,
        reason: "production_fanout_forbidden",
        message: "本番ではクライアントから他ユーザーへ直接配信できません。",
      };
    }

    const useSupabase = global.TasuTalkSupabaseSync?.isAvailable?.() === true;
    const dbRows = normalized.map((item) =>
      notifyToDbRow(
        {
          ...item.notification,
          id:
            item.notification.id ||
            `talk-n-${item.notification.broadcastDraftId || "bcast"}-${item.userId}-${Date.now()}`,
        },
        item.userId
      )
    );

    let deliveryMode = "local_fanout";
    if (useSupabase) {
      const sb = global.TasuSupabase?.getClient?.();
      if (!sb) {
        return { ok: false, reason: "no_client" };
      }
      try {
        const { error } = await sb.from(DB_TABLE).upsert(dbRows, { onConflict: "id" });
        if (error) {
          const msg = String(error.message || error);
          const missingTable = /schema cache|not find the table|does not exist/i.test(msg);
          if (!missingTable) {
            console.warn("[TasuTalkNotifications] deliverToUsers db failed:", error);
            return { ok: false, reason: "db_error", message: msg };
          }
          console.warn("[TasuTalkNotifications] deliverToUsers db missing, local_fanout fallback");
        } else {
          deliveryMode = "supabase";
        }
      } catch (err) {
        const msg = err?.message || String(err);
        if (!/schema cache|not find the table|does not exist/i.test(msg)) {
          console.warn("[TasuTalkNotifications] deliverToUsers failed:", err);
          return { ok: false, reason: "db_error", message: msg };
        }
        console.warn("[TasuTalkNotifications] deliverToUsers exception, local_fanout fallback");
      }
    }

    let delivered = 0;
    for (const item of normalized) {
      appendFanout(item.userId, item.notification);
      if (item.userId === currentUserId) {
        add(item.notification);
      }
      delivered += 1;
    }

    return {
      ok: true,
      delivered,
      failed: 0,
      mode: deliveryMode,
    };
  }

  const EVENT_NAME = "tasful-talk-notifications-changed";

  function writeList(list, options) {
    const sync = global.TasuTalkSupabaseSync;
    if (sync?.writeLocal && options?.localOnly !== true) {
      return sync.writeLocal(
        {
          id: SYNC_STORE_ID,
          storageKey: STORAGE_KEY,
          eventName: EVENT_NAME,
          maxRows: MAX_NOTIFICATIONS,
          normalize: normalizeNotification,
        },
        list,
        { source: options?.source || "write" }
      );
    }
    const safe = Array.isArray(list) ? list.map(normalizeNotification) : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      if (options?.silent !== true) {
        global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
      }
    } catch (err) {
      console.warn("[TasuTalkNotifications] save failed:", err);
    }
    return safe;
  }

  function notifyToDbRow(row, userId) {
    const n = normalizeNotification(row);
    return {
      id: n.id,
      user_id: String(userId || ""),
      type: n.type,
      title: n.title,
      body: n.body,
      target_url: n.targetUrl,
      created_at: n.createdAt,
      read_at: n.readAt || null,
      source: n.source,
      priority: n.priority,
      updated_at: n.updatedAt || n.createdAt,
    };
  }

  function notifyFromDbRow(row) {
    if (!row || typeof row !== "object") return null;
    return normalizeNotification({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      targetUrl: row.target_url,
      createdAt: row.created_at,
      readAt: row.read_at,
      source: row.source,
      priority: row.priority,
      updatedAt: row.updated_at,
    });
  }

  function syncUpsert(row) {
    global.TasuTalkSupabaseSync?.scheduleUpsert?.(SYNC_STORE_ID, row);
  }

  function syncDelete(id) {
    global.TasuTalkSupabaseSync?.scheduleDelete?.(SYNC_STORE_ID, id);
  }

  function sortMerged(list) {
    return list
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function registerSupabaseSync() {
    const sync = global.TasuTalkSupabaseSync;
    if (!sync?.register || sync.__notificationsRegistered) return;
    sync.__notificationsRegistered = true;
    sync.register({
      id: SYNC_STORE_ID,
      table: DB_TABLE,
      storageKey: STORAGE_KEY,
      eventName: EVENT_NAME,
      maxRows: MAX_NOTIFICATIONS,
      orderColumn: "created_at",
      normalize: normalizeNotification,
      toRow: notifyToDbRow,
      fromRow: notifyFromDbRow,
      sortMerged,
    });
  }

  function init() {
    registerSupabaseSync();
    return global.TasuTalkSupabaseSync?.initStore?.(SYNC_STORE_ID) || Promise.resolve(readList());
  }

  function migrateLegacyReadIds(ids, list) {
    if (!ids?.size) return list;
    const now = new Date().toISOString();
    return list.map((n) => (ids.has(n.id) && !n.readAt ? { ...n, readAt: now } : n));
  }

  function readLegacyReadSet() {
    try {
      const raw = global.localStorage.getItem(LEGACY_READ_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  }

  /** @param {Array<object>} seeds */
  function seedIfEmpty(seeds) {
    let list = readList();
    const marker = global.localStorage.getItem(SEED_MARKER);

    if (!list.length && Array.isArray(seeds) && seeds.length) {
      list = seeds.map(normalizeNotification);
      const legacy = readLegacyReadSet();
      list = migrateLegacyReadIds(legacy, list);
      writeList(list);
      try {
        global.localStorage.setItem(SEED_MARKER, "1");
      } catch {
        /* ignore */
      }
      return list;
    }

    if (!marker && list.length) {
      try {
        global.localStorage.setItem(SEED_MARKER, "1");
      } catch {
        /* ignore */
      }
    }

    const legacy = readLegacyReadSet();
    if (legacy.size) {
      const migrated = migrateLegacyReadIds(legacy, list);
      if (migrated.some((n, i) => n.readAt !== list[i]?.readAt)) {
        writeList(migrated);
        list = migrated;
      }
      try {
        global.localStorage.removeItem(LEGACY_READ_KEY);
      } catch {
        /* ignore */
      }
    }

    return list;
  }

  const PLATFORM_MASTER_MARKER = "tasful_platform_notify_master_v2";

  function isPlatformVerifyMasterActive() {
    return /^v3/.test(global.TasuTalkPlatformNotifyMaster?.VERSION || "");
  }

  function isDemoSeedNotification(n) {
    if (!n || typeof n !== "object") return false;
    const id = String(n.id || "");
    const source = String(n.source || "").toLowerCase();
    if (String(n?.source || "").toLowerCase() === "ops_watch") return false;
    if (global.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification?.(n)) return false;
    if (id.startsWith("platform-verify-")) return false;
    if (
      source === "builder_master_v1" ||
      source === "anpi_master_v1" ||
      source === "platform_fee_master_v1" ||
      source === "builder-mvp" ||
      source === "anpi-dashboard"
    ) {
      return true;
    }
    if (id.startsWith("builder-") || id.startsWith("anpi-")) return true;
    if (id.startsWith("talk-n-")) return true;
    return isLegacyPlatformDemoNotification(n);
  }
  const LEGACY_PLATFORM_SEED_IDS = new Set([
    "talk-n-001",
    "talk-n-002",
    "talk-n-003",
    "talk-n-004",
    "talk-n-004a",
    "talk-n-005",
    "talk-n-007",
  ]);

  /** v3.7 — 旧求人デモ通知（統一フローへ置換済み） */
  const DEPRECATED_PLATFORM_NOTIFY_IDS = new Set([
    "platform-verify-job-apply-001",
    "platform-verify-job-hired-001",
  ]);

  function isDeprecatedPlatformNotification(n) {
    if (!n || typeof n !== "object") return false;
    const id = String(n.id || "");
    if (DEPRECATED_PLATFORM_NOTIFY_IDS.has(id)) return true;
    const href = String(n.href || n.targetUrl || n.actionUrl || "");
    if (/view=hire-result/.test(href)) return true;
    if (/job-completion\.html|job-review\.html/.test(href)) return true;
    return false;
  }

  function isLegacyPlatformDemoNotification(n) {
    if (!n || typeof n !== "object") return false;
    const id = String(n.id || "");
    if (LEGACY_PLATFORM_SEED_IDS.has(id)) return true;
    if (global.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification?.(n)) return false;
    if (id.startsWith("platform-verify-")) return false;
    if (id.startsWith("platform-fee-")) return true;
    if (id.startsWith("platform-") && !id.startsWith("platform-verify-")) return true;
    const source = String(n.source || "").toLowerCase();
    if (source === "platform_fee_master_v1" || n.platformFeeMasterVersion) return true;
    if (source === "platform_master_v1") {
      return !/^v3/.test(String(n.platformMasterVersion || ""));
    }
    return false;
  }

  function isMarketOrderNotification(n) {
    if (!n || typeof n !== "object") return false;
    const source = String(n.source || "").toLowerCase();
    const id = String(n.id || "");
    return source === "shop_market_order_v1" || id.startsWith("market-order-");
  }

  function isConnectRequirementNotification(n) {
    if (!n || typeof n !== "object") return false;
    const src = String(n?.source || "").toLowerCase();
    const id = String(n?.id || "");
    return (
      src === "platform_chat_demo_connect_requirements_v1" ||
      id === "platform-chat-demo-connect-identity-001" ||
      id === "platform-chat-demo-connect-payout-001"
    );
  }

  function preserveConnectRequirementNotifications(list) {
    return (list || []).filter(isConnectRequirementNotification);
  }

  function preserveMarketOrderNotifications(list) {
    return (list || []).filter(isMarketOrderNotification);
  }

  function isAiResponsePlanNotification(n) {
    return String(n?.source || "") === "ai_response_plan";
  }

  function isAiAutomationNotification(n) {
    return String(n?.source || "") === "ai_automation_engine";
  }

  function preserveAiResponsePlanNotifications(list) {
    return (list || []).filter(isAiResponsePlanNotification);
  }

  function preserveAutomationNotifications(list) {
    return (list || []).filter(isAiAutomationNotification);
  }

  function purgeLegacyPlatformDemoNotifications(list, options) {
    const preserveIds = new Set(options?.preserveIds || []);
    return (list || []).filter((n) => {
      if (preserveIds.has(String(n.id))) return true;
      if (isMarketOrderNotification(n)) return true;
      if (isConnectRequirementNotification(n)) return true;
      if (isAiResponsePlanNotification(n)) return true;
      if (isAiAutomationNotification(n)) return true;
      if (String(n.source || "").toLowerCase() === "ops_watch") return true;
      if (isDeprecatedPlatformNotification(n)) return false;
      if (isPlatformVerifyMasterActive()) {
        return !isDemoSeedNotification(n);
      }
      if (n.type === "builder" || n.type === "anpi") return true;
      if (isLegacyPlatformDemoNotification(n)) return false;
      return true;
    });
  }

  /**
   * プラット通知マスター — 既存ストアへ upsert（v3 は検証シードのみに置換）
   * @param {Array<object>} seeds
   * @param {{ preserveIds?: string[] }} [options]
   */
  function applyPlatformMasterV1(seeds, options) {
    if (!Array.isArray(seeds) || !seeds.length) return readList();
    const version = global.TasuTalkPlatformNotifyMaster?.VERSION || "v2";
    try {
      if (global.localStorage.getItem(PLATFORM_MASTER_MARKER) === version) return readList();
    } catch {
      /* ignore */
    }

    const prevList = readList();
    const prevIds = prevList.map((n) => String(n.id));
    let list;

    if (/^v3/.test(version)) {
      const opsWatch = prevList.filter((n) => String(n?.source || "").toLowerCase() === "ops_watch");
      const marketOrders = preserveMarketOrderNotifications(prevList);
      const aiResponsePlans = preserveAiResponsePlanNotifications(prevList);
      const automationNotifications = preserveAutomationNotifications(prevList);
      const connectRequirements = preserveConnectRequirementNotifications(prevList);
      list = seeds.map(normalizeNotification);
      list = [
        ...list,
        ...opsWatch,
        ...marketOrders,
        ...aiResponsePlans,
        ...automationNotifications,
        ...connectRequirements,
      ];
    } else {
      list = purgeLegacyPlatformDemoNotifications(prevList, options);
      const byId = new Map(list.map((n) => [String(n.id), n]));
      seeds.map(normalizeNotification).forEach((n) => byId.set(String(n.id), n));
      list = [...byId.values()];
    }

    writeList(list);

    const nextIds = new Set(list.map((n) => String(n.id)));
    const removedIds = prevIds.filter((id) => !nextIds.has(id));
    if (removedIds.length) {
      global.TasuTalkOfficialRooms?.purgeNotificationMessages?.(removedIds);
    }
    global.TasuTalkOfficialRooms?.syncFromNotifications?.(list);

    if (/^v3/.test(version)) {
      try {
        global.localStorage.removeItem("tasful_builder_notify_master_v1");
        global.localStorage.removeItem("tasful_anpi_notify_master_v1");
        global.localStorage.removeItem("tasful_platform_fee_notify_master_v2");
      } catch {
        /* ignore */
      }
    }

    try {
      global.localStorage.setItem(PLATFORM_MASTER_MARKER, version);
    } catch {
      /* ignore */
    }
    return list;
  }

  const BUILDER_MASTER_MARKER = "tasful_builder_notify_master_v1";

  /**
   * Builder通知マスター v1.0 — upsert（プラット・安否・既存 talk-n-008 は保持）
   * @param {Array<object>} seeds
   */
  function applyBuilderMasterV1(seeds) {
    if (!Array.isArray(seeds) || !seeds.length) return readList();
    try {
      if (global.localStorage.getItem(BUILDER_MASTER_MARKER) === "1") {
        return refreshBuilderNotifyMaster(seeds);
      }
    } catch {
      /* ignore */
    }

    let list = refreshBuilderNotifyMaster(seeds);

    try {
      global.localStorage.setItem(BUILDER_MASTER_MARKER, "1");
    } catch {
      /* ignore */
    }
    return list;
  }

  function mergeBuilderMasterSeed(existing, seed) {
    const next = normalizeNotification(seed);
    if (!existing) return next;
    return normalizeNotification({
      ...next,
      readAt: existing.readAt ?? next.readAt ?? null,
      hiddenAt: existing.hiddenAt ?? next.hiddenAt ?? null,
      updatedAt: existing.updatedAt || next.updatedAt,
    });
  }

  function refreshBuilderNotifyMaster(seeds) {
    const deprecated = new Set(global.TasuTalkBuilderNotifyMaster?.DEPRECATED_IDS || []);
    let list = readList();
    if (deprecated.size) {
      list = list.filter((n) => !deprecated.has(String(n.id)));
    }
    const byId = new Map(list.map((n) => [String(n.id), n]));
    seeds.forEach((seed) => {
      const id = String(seed?.id || "");
      if (!id) return;
      byId.set(id, mergeBuilderMasterSeed(byId.get(id), seed));
    });
    list = [...byId.values()];
    writeList(list);
    global.TasuTalkOfficialRooms?.purgeNotificationMessages?.(Array.from(deprecated));
    global.TasuTalkOfficialRooms?.syncFromNotifications?.(list);
    return list;
  }

  const ANPI_MASTER_MARKER = "tasful_anpi_notify_master_v1";
  const PLATFORM_FEE_MASTER_MARKER = "tasful_platform_fee_notify_master_v2";

  /**
   * @deprecated v3.3 以降は talk-platform-notify-master-v1.js に統合済み
   */
  function applyPlatformFeeMasterV1(seeds) {
    if (!Array.isArray(seeds) || !seeds.length) return readList();
    const version = "deprecated";
    try {
      if (global.localStorage.getItem(PLATFORM_FEE_MASTER_MARKER) === version) return readList();
    } catch {
      /* ignore */
    }

    let list = purgeLegacyPlatformDemoNotifications(readList());
    const byId = new Map(list.map((n) => [String(n.id), n]));
    seeds.map(normalizeNotification).forEach((n) => byId.set(String(n.id), n));
    list = [...byId.values()];
    writeList(list);
    global.TasuTalkOfficialRooms?.syncFromNotifications?.(list);

    try {
      global.localStorage.setItem(PLATFORM_FEE_MASTER_MARKER, version);
    } catch {
      /* ignore */
    }
    return list;
  }

  /**
   * 安否通知マスター v1.0 — upsert
   * @param {Array<object>} seeds
   */
  function applyAnpiMasterV1(seeds) {
    if (!Array.isArray(seeds) || !seeds.length) return readList();
    try {
      if (global.localStorage.getItem(ANPI_MASTER_MARKER) === "1") return readList();
    } catch {
      /* ignore */
    }

    let list = readList();
    const byId = new Map(list.map((n) => [String(n.id), n]));
    seeds.map(normalizeNotification).forEach((n) => byId.set(String(n.id), n));
    list = [...byId.values()];
    writeList(list);

    try {
      global.localStorage.setItem(ANPI_MASTER_MARKER, "1");
    } catch {
      /* ignore */
    }
    return list;
  }

  function getAll() {
    return readList().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function saveAll(list, options) {
    return writeList(list, options);
  }

  function findById(id) {
    return getAll().find((n) => String(n.id) === String(id)) || null;
  }

  function markRead(id) {
    const list = readList();
    const idx = list.findIndex((n) => String(n.id) === String(id));
    if (idx < 0) return null;
    if (!list[idx].readAt) {
      const now = new Date().toISOString();
      list[idx] = { ...list[idx], readAt: now, updatedAt: now };
      writeList(list, { localOnly: true });
      syncUpsert(list[idx]);
    }
    return list[idx];
  }

  function markUnread(id) {
    const list = readList();
    const idx = list.findIndex((n) => String(n.id) === String(id));
    if (idx < 0) return null;
    if (list[idx].readAt) {
      const now = new Date().toISOString();
      list[idx] = { ...list[idx], readAt: null, updatedAt: now };
      writeList(list, { localOnly: true });
      syncUpsert(list[idx]);
    }
    return list[idx];
  }

  function hideNotification(id) {
    const list = readList();
    const idx = list.findIndex((n) => String(n.id) === String(id));
    if (idx < 0) return null;
    if (!list[idx].hiddenAt) {
      const now = new Date().toISOString();
      list[idx] = { ...list[idx], hiddenAt: now, updatedAt: now };
      writeList(list, { localOnly: true });
      syncUpsert(list[idx]);
    }
    return list[idx];
  }

  function unhideNotification(id) {
    const list = readList();
    const idx = list.findIndex((n) => String(n.id) === String(id));
    if (idx < 0) return null;
    if (list[idx].hiddenAt) {
      const now = new Date().toISOString();
      list[idx] = { ...list[idx], hiddenAt: null, updatedAt: now };
      writeList(list, { localOnly: true });
      syncUpsert(list[idx]);
    }
    return list[idx];
  }

  function isUserHidden(n) {
    return Boolean(n?.hiddenAt);
  }

  function remove(id) {
    const before = readList().length;
    const list = readList().filter((n) => String(n.id) !== String(id));
    writeList(list, { localOnly: true });
    syncDelete(id);
    return list.length < before;
  }

  /**
   * @param {object} input
   * @returns {object}
   */
  function pruneOlderThreadMessageNotifications(list, row) {
    const source = pickStr(row?.source);
    if (source !== "platform_chat_demo_message_v1") return list;
    const threadId = pickStr(row?.threadId, row?.thread_id);
    const recipientUserId = pickStr(row?.recipientUserId, row?.recipient_user_id);
    const stableId = String(row.id || "");
    if (!threadId || !recipientUserId || !stableId) return list;
    return list.filter((n) => {
      if (String(n.id) === stableId) return true;
      if (pickStr(n?.source) !== "platform_chat_demo_message_v1") return true;
      if (pickStr(n?.threadId, n?.thread_id) !== threadId) return true;
      if (pickStr(n?.recipientUserId, n?.recipient_user_id) !== recipientUserId) return true;
      return false;
    });
  }

  function add(input) {
    const row = normalizeNotification({
      ...input,
      id: input?.id || newNotificationId(),
      createdAt: input?.createdAt || new Date().toISOString(),
      readAt: input?.readAt || null,
    });
    const isJobCompletionReview =
      String(row.title || "").includes("やり取りが完了") ||
      (String(row.type || "") === "job" && pickStr(row.reviewTargetUserId));
    if (isJobCompletionReview) {
      const payload = {
        recipientUserId: row.recipientUserId,
        reviewTargetUserId: row.reviewTargetUserId,
        notificationType: row.type,
        title: row.title,
        threadId: row.threadId,
        id: row.id,
      };
      try {
        console.info("[job-completion-notify] saveNotification:before", payload);
        const diag = global.__tasuJobCompletionNotifyDiag;
        if (diag && Array.isArray(diag.events)) {
          diag.events.push({
            step: "saveNotification:before",
            at: new Date().toISOString(),
            ...payload,
          });
        }
      } catch {
        /* ignore */
      }
    }
    let list = pruneOlderThreadMessageNotifications(readList(), row);
    const dup = list.findIndex((n) => String(n.id) === String(row.id));
    if (dup >= 0) {
      list[dup] = { ...list[dup], ...row, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(row);
    }
    writeList(list, { localOnly: true });
    syncUpsert(row);
    try {
      const type = normalizeType(row.type, row);
      const prio = String(row.priority || "").toLowerCase();
      if (type === "anpi" || prio === "urgent") {
        global.dispatchEvent(
          new CustomEvent("tasful-talk-anpi-arrived", { detail: { notification: row } })
        );
      }
    } catch (err) {
      console.warn("[TasuTalkNotifications] anpi event failed:", err);
    }
    syncOfficialTalkForNotification(row);
    if (String(row.title || "").includes("承諾")) {
      global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("TasuTalkNotifications.add:ok", {
        id: row.id,
        title: row.title,
        recipientUserId: row.recipientUserId,
      });
    }
    return row;
  }

  function isUnread(n) {
    return !n?.readAt;
  }

  function isFollowSource(notification) {
    return String(notification?.source || "").trim().toLowerCase() === "follow";
  }

  function notificationReferencesStaleThread(n, staleThreadIds) {
    const stale = (staleThreadIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    if (!stale.length) return false;
    const id = String(n?.id || "");
    const href = pickStr(n.href, n.targetUrl);
    const threadId = pickStr(n.threadId, n.thread_id);
    return stale.some((s) => {
      if (!s) return false;
      if (threadId === s) return true;
      if (id.includes(s)) return true;
      if (href.includes(s)) return true;
      try {
        return href.includes(encodeURIComponent(s));
      } catch {
        return false;
      }
    });
  }

  function isBenchJobRuntimeNotification(n, opts) {
    const id = String(n?.id || "");
    const title = String(n?.title || "");
    const src = String(n?.source || "");
    const type = String(n?.type || "");
    if (/^platform-chat-review-received-/i.test(id)) return true;
    if (/^platform-chat-completion-/i.test(id)) return true;
    if (/^platform-chat-/i.test(id)) return true;
    if (/レビューされました|やり取り完了|応募が承諾|採用されました|completion|review/i.test(title)) {
      return true;
    }
    if (opts?.removeJobBenchRuntime !== false) {
      if (src === "platform_chat_review_v1" || src === "platform_chat_completion_v1") return true;
      if (/^(job|platform|worker)$/i.test(type)) return true;
    }
    return false;
  }

  function shouldPurgeBenchRecipientNotification(n, userIds, opts) {
    const ids = userIds || new Set();
    const recipient = String(n?.recipientUserId || "").trim();
    const inRecipients = recipient && ids.has(recipient);
    if (!inRecipients && !opts?.purgeGlobalStaleReferences) return false;
    if (opts?.removeAllForRecipients === true && inRecipients) return true;
    if (notificationReferencesStaleThread(n, opts?.staleThreadIds)) return true;
    if (inRecipients && isBenchJobRuntimeNotification(n, opts)) return true;
    return false;
  }

  /** ベンチ再実行 — 指定ユーザー / 旧 thread 参照の通知を削除 */
  function purgeRecipientsNotifications(userIds, options) {
    const opts = options || {};
    const ids = new Set(
      (userIds || []).map((u) => String(u || "").trim()).filter(Boolean)
    );
    const removedIds = [];
    const next = readList().filter((n) => {
      if (!shouldPurgeBenchRecipientNotification(n, ids, opts)) return true;
      removedIds.push(String(n.id));
      return false;
    });
    writeList(next, { localOnly: true });
    try {
      global.TasuTalkOfficialRooms?.purgeNotificationMessages?.(removedIds);
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent("tasu:talk-notifications-changed"));
    } catch {
      /* ignore */
    }
    return { removedIds, kept: next.length };
  }

  function purgeNotificationsReferencingThreads(staleThreadIds) {
    const stale = (staleThreadIds || []).map((v) => String(v || "").trim()).filter(Boolean);
    if (!stale.length) return { removedIds: [], kept: 0 };
    return purgeRecipientsNotifications([], {
      staleThreadIds: stale,
      purgeGlobalStaleReferences: true,
      removeJobBenchRuntime: true,
    });
  }

  function markReadFromNotifyArrival() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const from = String(params.get("from") || "").toLowerCase();
      if (from !== "notify") return null;
      const id = pickStr(params.get("notify"), params.get("notificationId"), params.get("notifyId"));
      if (!id) return null;
      return markRead(id);
    } catch {
      return null;
    }
  }

  function bootNotifyArrivalRead() {
    if (global.__tasuNotifyArrivalMarkDone === true) return;
    const row = markReadFromNotifyArrival();
    if (row) global.__tasuNotifyArrivalMarkDone = true;
  }

  if (typeof global.document !== "undefined") {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", bootNotifyArrivalRead);
    } else {
      bootNotifyArrivalRead();
    }
  }

  registerSupabaseSync();

  global.TasuTalkNotifications = {
    STORAGE_KEY,
    DB_TABLE,
    SYNC_STORE_ID,
    EVENT_NAME,
    normalizeNotification,
    seedIfEmpty,
    applyPlatformMasterV1,
    applyBuilderMasterV1,
    refreshBuilderNotifyMaster,
    applyAnpiMasterV1,
    applyPlatformFeeMasterV1,
    applyOfficialTalkFieldsV1,
    init,
    getAll,
    saveAll,
    findById,
    markRead,
    markReadFromNotifyArrival,
    markUnread,
    hideNotification,
    unhideNotification,
    isUserHidden,
    remove,
    add,
    deliverToUsers,
    appendFanout,
    isUnread,
    isFollowSource,
    purgeRecipientsNotifications,
    purgeNotificationsReferencingThreads,
    FANOUT_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
