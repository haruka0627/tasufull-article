/**
 * TASFUL TALK — 通知受信設定（localStorage、将来 Supabase 同期用）
 * キー: tasful_talk_notification_settings
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_notification_settings";
  const EVENT_NAME = "tasful-talk-notification-settings-changed";
  /** 将来 talk-supabase-sync.register({ id: SYNC_STORE_ID, table: "talk_notification_settings", ... }) */
  const SYNC_STORE_ID = "notification_settings";

  const TYPE_KEYS = Object.freeze(
    global.TasuTalkCategory?.NOTIFICATION_TYPE_KEYS || [
      "skill",
      "worker",
      "job",
      "product",
      "shop",
      "business",
      "builder",
      "anpi",
      "system",
    ]
  );

  const PRIORITY_KEYS = Object.freeze(["normal", "important", "urgent"]);

  const SEGMENT_KEYS = Object.freeze([
    "all",
    "construction",
    "job",
    "business",
    "shop",
    "anpi",
  ]);

  const TYPE_LABELS = Object.freeze(
    global.TasuTalkCategory?.TYPE_LABELS
      ? Object.fromEntries(
          TYPE_KEYS.map((k) => [k, `${global.TasuTalkCategory.TYPE_LABELS[k]}通知`])
        )
      : {
          skill: "スキル通知",
          worker: "ワーカー通知",
          job: "求人通知",
          product: "商品通知",
          shop: "店舗・販売通知",
          business: "業務サービス通知",
          builder: "Builder通知",
          anpi: "安否通知",
          system: "運営通知",
        }
  );

  const PRIORITY_LABELS = Object.freeze({
    normal: "通常通知",
    important: "重要通知",
    urgent: "緊急通知",
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function boolMap(keys, raw, fallbackTrue) {
    const out = {};
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (raw && typeof raw[k] === "boolean") out[k] = raw[k];
      else out[k] = fallbackTrue !== false;
    }
    return out;
  }

  function defaultSettings() {
    return {
      enabled: true,
      showMuted: false,
      types: boolMap(TYPE_KEYS, null, true),
      priorities: boolMap(PRIORITY_KEYS, null, true),
      segments: boolMap(SEGMENT_KEYS, null, true),
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "07:00",
      },
      updatedAt: nowIso(),
    };
  }

  function normalizeTimeHm(value, fallback) {
    const s = String(value || fallback || "22:00").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback || "22:00";
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  /**
   * @param {object} [raw]
   */
  function normalizeSettings(raw) {
    const base = defaultSettings();
    if (!raw || typeof raw !== "object") return base;

    return {
      enabled: raw.enabled !== false,
      showMuted: raw.showMuted === true,
      types: global.TasuTalkCategory?.migrateSettingsTypes
        ? global.TasuTalkCategory.migrateSettingsTypes(raw.types)
        : boolMap(TYPE_KEYS, raw.types, true),
      priorities: boolMap(PRIORITY_KEYS, raw.priorities, true),
      segments: boolMap(SEGMENT_KEYS, raw.segments, true),
      quietHours: {
        enabled: raw.quietHours?.enabled === true,
        start: normalizeTimeHm(raw.quietHours?.start, base.quietHours.start),
        end: normalizeTimeHm(raw.quietHours?.end, base.quietHours.end),
      },
      updatedAt: String(raw.updatedAt || nowIso()),
    };
  }

  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings();
      return normalizeSettings(JSON.parse(raw));
    } catch (err) {
      console.warn("[TasuTalkNotificationSettings] read failed:", err);
      return defaultSettings();
    }
  }

  function write(settings) {
    const safe = normalizeSettings(settings);
    safe.updatedAt = nowIso();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { settings: safe } }));
    } catch (err) {
      console.warn("[TasuTalkNotificationSettings] write failed:", err);
    }
    return safe;
  }

  function reset() {
    return write(defaultSettings());
  }

  /**
   * @param {object} patch
   */
  function update(patch) {
    return write({ ...read(), ...patch });
  }

  function parseMinutes(hm) {
    const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return 0;
    return Math.min(23, parseInt(m[1], 10)) * 60 + Math.min(59, parseInt(m[2], 10));
  }

  function isInQuietHours(settings, at) {
    const qh = settings?.quietHours;
    if (!qh?.enabled) return false;
    const start = parseMinutes(qh.start);
    const end = parseMinutes(qh.end);
    const d = at instanceof Date ? at : new Date();
    const cur = d.getHours() * 60 + d.getMinutes();
    if (start === end) return false;
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end;
  }

  function normalizeNotifyType(type, data) {
    if (global.TasuTalkCategory?.normalizeTalkNotificationType) {
      return global.TasuTalkCategory.normalizeTalkNotificationType(type, data);
    }
    const t = String(type || "system").toLowerCase();
    if (TYPE_KEYS.includes(t)) return t;
    return "system";
  }

  function normalizeNotifyPriority(priority) {
    const p = String(priority || "normal").toLowerCase();
    return PRIORITY_KEYS.includes(p) ? p : "normal";
  }

  /**
   * 通知の配信セグメント（将来の広告配信向け）
   * @param {object} n
   */
  function inferSegment(n) {
    const explicit = String(n?.targetSegment || n?.segment || "").trim();
    if (SEGMENT_KEYS.includes(explicit)) return explicit;

    const type = normalizeNotifyType(n?.type, n);
    if (type === "skill") return "construction";
    if (type === "job") return "job";
    if (type === "business") return "business";
    if (type === "shop" || type === "product") return "shop";
    if (type === "anpi") return "anpi";
    return "all";
  }

  /**
   * 受信設定により一覧に表示するか（保存は常に行う）
   * @param {object} notification
   * @param {object} [settings]
   */
  function isVisibleInInbox(notification, settings) {
    const s = normalizeSettings(settings || read());
    if (!s.enabled) return false;

    const type = normalizeNotifyType(notification?.type, notification);
    const priority = normalizeNotifyPriority(notification?.priority);
    const segment = inferSegment(notification);

    if (s.types[type] === false) return false;
    if (s.priorities[priority] === false) return false;
    const segKey = SEGMENT_KEYS.includes(segment) ? segment : "all";
    if (s.segments[segKey] === false) return false;

    if (isInQuietHours(s) && priority !== "urgent") return false;

    return true;
  }

  /**
   * @param {object} notification
   * @param {object} [settings]
   */
  function getHiddenReason(notification, settings) {
    if (isVisibleInInbox(notification, settings)) return "";
    const s = normalizeSettings(settings || read());
    if (!s.enabled) return "受信停止中";
    const type = normalizeNotifyType(notification?.type, notification);
    const priority = normalizeNotifyPriority(notification?.priority);
    if (s.types[type] === false) return "カテゴリOFF";
    if (s.priorities[priority] === false) return "優先度OFF";
    if (isInQuietHours(s) && priority !== "urgent") return "おやすみ時間";
    const segment = inferSegment(notification);
    if (s.segments[segment] === false) return "セグメントOFF";
    return "非表示";
  }

  global.TasuTalkNotificationSettings = {
    STORAGE_KEY,
    EVENT_NAME,
    SYNC_STORE_ID,
    TYPE_KEYS,
    PRIORITY_KEYS,
    SEGMENT_KEYS,
    TYPE_LABELS,
    PRIORITY_LABELS,
    defaultSettings,
    normalizeSettings,
    read,
    write,
    update,
    reset,
    isVisibleInInbox,
    getHiddenReason,
    inferSegment,
    isInQuietHours,
  };
})(typeof window !== "undefined" ? window : globalThis);
