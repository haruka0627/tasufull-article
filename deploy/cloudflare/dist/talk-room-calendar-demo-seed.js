/**
 * TASFUL TALK — トークカレンダー実運用デモ予定
 */
(function (global) {
  "use strict";

  const DEMO_VERSION = "v1";
  const MARKER_KEY = "tasful_talk_calendar_demo_version";

  const DEMO_EVENT_IDS = Object.freeze([
    "cal-demo-friend-meeting-001",
    "cal-demo-friend-zoom-001",
    "cal-demo-friend-site-001",
    "cal-demo-platform-identity-001",
    "cal-demo-platform-review-001",
    "cal-demo-anpi-check-001",
    "cal-demo-ops-support-001",
  ]);

  function isoAtOffset(days, hours, minutes) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  }

  /** 来週の指定曜日（0=日 … 6=土） */
  function nextWeekOn(weekday, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function buildDemoEvents() {
    return [
      {
        id: "cal-demo-friend-meeting-001",
        threadId: "talk-mock-friend-001",
        title: "打ち合わせ",
        startsAt: isoAtOffset(1, 18, 0),
        location: "○○カフェ",
        memo: "案件の事前打ち合わせ",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-friend-zoom-001",
        threadId: "talk-mock-friend-001",
        title: "Zoomミーティング",
        startsAt: nextWeekOn(2, 20, 0),
        location: "オンライン",
        memo: "進捗確認",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-friend-site-001",
        threadId: "talk-mock-friend-001",
        title: "現地確認",
        startsAt: nextWeekOn(5, 10, 0),
        location: "埼玉県○○市",
        memo: "現場確認",
        mapUrl: "https://maps.google.com/?q=35.8617,139.6455",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-platform-identity-001",
        threadId: "official_platform",
        title: "本人確認期限",
        startsAt: isoAtOffset(7, 9, 0),
        memo: "本人確認手続きの期限です",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-platform-review-001",
        threadId: "official_platform",
        title: "レビュー投稿期限",
        startsAt: isoAtOffset(3, 9, 0),
        memo: "取引完了後のレビュー投稿期限です",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-anpi-check-001",
        threadId: "official_anpi",
        title: "安否確認予定",
        startsAt: isoAtOffset(1, 9, 0),
        memo: "安否確認の予定です",
        notifyEnabled: true,
      },
      {
        id: "cal-demo-ops-support-001",
        threadId: "official_tasful",
        title: "サポート回答予定",
        startsAt: isoAtOffset(1, 13, 0),
        memo: "運営サポートからの回答予定",
        notifyEnabled: true,
      },
    ];
  }

  function ensureDemoCalendarEvents(options) {
    const store = global.TasuTalkRoomCalendarStore;
    if (!store?.upsertEvents) return { ok: false, reason: "store-missing" };

    const force = options?.force === true;
    let marker = "";
    try {
      marker = String(global.localStorage?.getItem(MARKER_KEY) || "");
    } catch {
      /* ignore */
    }
    if (!force && marker === DEMO_VERSION) {
      const hasAll = DEMO_EVENT_IDS.every((id) =>
        store.listEvents("talk-mock-friend-001").some((e) => e.id === id) ||
        store.listEvents("official_platform").some((e) => e.id === id) ||
        store.listEvents("official_anpi").some((e) => e.id === id) ||
        store.listEvents("official_tasful").some((e) => e.id === id)
      );
      if (hasAll) return { ok: true, skipped: true, version: DEMO_VERSION };
    }

    store.removeEventsByIds?.(DEMO_EVENT_IDS);
    const saved = store.upsertEvents(buildDemoEvents());
    try {
      global.localStorage?.setItem(MARKER_KEY, DEMO_VERSION);
    } catch {
      /* ignore */
    }
    return { ok: true, count: saved.length, version: DEMO_VERSION };
  }

  function isDevSeedEnabled() {
    return global.TasuTalkRuntime?.isTalkDevMode?.() === true;
  }

  if (isDevSeedEnabled()) {
    ensureDemoCalendarEvents({ force: true });
  }

  global.TasuTalkRoomCalendarDemo = {
    DEMO_VERSION,
    DEMO_EVENT_IDS,
    buildDemoEvents,
    ensureDemoCalendarEvents,
  };
})(typeof window !== "undefined" ? window : globalThis);
