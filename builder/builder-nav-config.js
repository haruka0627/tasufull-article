/**
 * Builder サイドバー — 将来ナビ正本（プレースホルダー含む）
 * docs/AI/BUILDER_ARCHITECTURE.md
 */
(function (global) {
  "use strict";

  const TALK_CHAT_HREF = "../talk-home.html?tab=chat&channel=builder&from=builder";

  const PARTNER_NAV = Object.freeze([
    { id: "dashboard", label: "ダッシュボード", href: "index.html" },
    { id: "calendar", label: "案件カレンダー", href: "project-calendar.html" },
    { id: "projects", label: "案件一覧", href: "board-projects.html" },
    { id: "worker-search", label: "ワーカー検索", href: "find-workers.html" },
    { id: "vendor-search", label: "業者検索", href: "partners.html" },
    { id: "vendor-pages", label: "業者ページ管理", href: "vendor-pages.html", badge: "準備中" },
    { id: "sep-1", sep: true },
    { id: "invoices", label: "請求書", href: "invoices.html", badge: "準備中" },
    { id: "documents", label: "書類・提出物", href: "mvp-templates.html" },
    { id: "notifications", label: "通知", href: "mvp-notifications.html" },
    { id: "talk", label: "TASFUL Talk", href: `${TALK_CHAT_HREF}&builderRole=partner` },
    { id: "sep-2", sep: true },
    { id: "settings", label: "設定", href: "settings.html" },
  ]);

  const USER_NAV = Object.freeze([
    { id: "dashboard", label: "ダッシュボード", href: "user-dashboard.html" },
    { id: "calendar", label: "案件カレンダー", href: "project-calendar.html" },
    { id: "projects", label: "案件一覧", href: "board-projects.html" },
    { id: "worker-search", label: "ワーカー検索", href: "find-workers.html" },
    { id: "vendor-search", label: "業者検索", href: "partners.html" },
    { id: "vendor-pages", label: "業者ページ管理", href: "vendor-pages.html", badge: "準備中" },
    { id: "sep-1", sep: true },
    { id: "invoices", label: "請求書", href: "invoices.html", badge: "準備中" },
    { id: "documents", label: "書類・提出物", href: "mvp-templates.html" },
    { id: "notifications", label: "通知", href: "mvp-notifications.html?role=user" },
    { id: "talk", label: "TASFUL Talk", href: `${TALK_CHAT_HREF}&builderRole=user` },
    { id: "sep-2", sep: true },
    { id: "settings", label: "設定", href: "settings.html" },
  ]);

  global.TasuBuilderNavConfig = {
    PARTNER_NAV,
    USER_NAV,
    talkChatHref(role) {
      const r = String(role || "partner").trim();
      return `${TALK_CHAT_HREF}&builderRole=${encodeURIComponent(r)}`;
    },
    getNavForRole(role) {
      return String(role || "").trim() === "user" ? USER_NAV : PARTNER_NAV;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
