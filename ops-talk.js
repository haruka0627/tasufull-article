/**
 * 運営用 TALK — AI秘書通知の受け皿（localStorage / ダミー）
 */
(function (global) {
  "use strict";

  const STORAGE_SEED_KEY = "tasu_ops_talk_seed_v1";
  let activeFilter = "all";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isOpsAccessAllowed() {
    if (global.TasuAuthOpsGuard?.canAccessOps) {
      return global.TasuAuthOpsGuard.canAccessOps() === true;
    }
    return global.TasuTalkRuntime?.isTalkAdmin?.() === true;
  }

  function ensureSeedNotifications() {
    try {
      if (global.localStorage?.getItem(STORAGE_SEED_KEY) === "1") return;
    } catch {
      return;
    }
    const store = global.TasuTalkNotifications;
    if (!store?.add) return;
    const existing = store.getAllForOps?.() || [];
    if (existing.length > 0) {
      try {
        global.localStorage.setItem(STORAGE_SEED_KEY, "1");
      } catch {
        /* ignore */
      }
      return;
    }
    const Audience = global.TasuTalkNotifyAudience;
    const now = new Date().toISOString();
    const seeds = [
      {
        title: "【AI秘書】返金候補の問い合わせ",
        body: "利用者から全額返金希望の問い合わせ。要確認。",
        source: "support",
        audienceScope: "admin_ops",
        priority: "important",
        category: "運営",
        targetUrl: "support-trouble-center.html",
        createdAt: now,
      },
      {
        title: "【OPS WATCH】Stripe Webhook 遅延",
        body: "Webhook 応答遅延を検知。Connect 決済フローを確認してください。",
        source: "ops_watch",
        audienceScope: "admin_ops",
        priority: "important",
        category: "Connect",
        targetUrl: Audience?.opsTalkUrl?.() || "ops-talk.html",
        opsWatchImportance: "high",
        createdAt: now,
      },
      {
        title: "【RLS】security warning — profiles",
        body: "RLS ポリシー未設定テーブルを検出。本番前に監査が必要です。",
        source: "admin_ops",
        audienceScope: "admin_ops",
        priority: "urgent",
        category: "運営",
        targetUrl: "admin-operations-dashboard.html#ops-ai-secretary",
        createdAt: now,
      },
    ];
    seeds.forEach((row) => {
      const payload = Audience?.withAdminOpsAudience ? Audience.withAdminOpsAudience(row) : row;
      store.add(payload);
    });
    try {
      global.localStorage.setItem(STORAGE_SEED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function syncOpsAssistant() {
    const Ops = global.TasuTalkOpsAssistant;
    if (Ops?.syncNotifications && global.TasuTalkNotifyAudience?.shouldSyncOpsAssistantHere?.()) {
      try {
        Ops.syncNotifications();
      } catch {
        /* ignore */
      }
    }
  }

  function hubItems() {
    const hub = global.TasuTalkOpsAssistant?.buildHubSections?.();
    if (!hub?.sections) return [];
    const rows = [];
    hub.sections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        rows.push({
          id: `hub-${item.id || item.title}`,
          title: item.title,
          meta: item.meta || sec.label,
          href: item.href || "support-trouble-center.html",
          badge: sec.label,
          priority: item.priority || "normal",
          unread: true,
          kind: "hub",
          source: item.source || sec.id,
        });
      });
    });
    return rows;
  }

  function notifyItems() {
    const store = global.TasuTalkNotifications;
    const list = store?.getAllForOps?.() || [];
    const Audience = global.TasuTalkNotifyAudience;
    return list.map((n) => ({
      id: `notify-${n.id}`,
      title: n.title,
      meta: String(n.body || "").slice(0, 120),
      href: n.targetUrl || n.href || Audience?.opsTalkUrl?.() || "ops-talk.html",
      badge: Audience?.badgeForNotification?.(n) || "重要",
      priority: String(n.priority || "").toLowerCase(),
      unread: store?.isUnread?.(n) !== false && !n.readAt,
      kind: "notify",
      source: n.source,
    }));
  }

  function mergeItems() {
    const byKey = new Map();
    [...hubItems(), ...notifyItems()].forEach((row) => {
      if (!row?.title) return;
      const key = `${row.kind}:${row.id}:${row.title}`;
      if (!byKey.has(key)) byKey.set(key, row);
    });
    return [...byKey.values()].sort((a, b) => {
      const score = (r) =>
        (r.priority === "critical" || r.priority === "urgent" ? 4 : 0) +
        (r.priority === "important" || r.priority === "high" ? 2 : 0) +
        (r.unread ? 1 : 0);
      return score(b) - score(a);
    });
  }

  function applyFilter(rows) {
    if (activeFilter === "important") {
      return rows.filter(
        (r) =>
          r.priority === "critical" ||
          r.priority === "urgent" ||
          r.priority === "important" ||
          r.priority === "high"
      );
    }
    if (activeFilter === "open") return rows.filter((r) => r.unread);
    if (activeFilter === "done") return rows.filter((r) => !r.unread);
    return rows;
  }

  function renderList() {
    const host = document.querySelector("[data-ops-talk-list]");
    if (!host) return;
    const rows = applyFilter(mergeItems());
    if (!rows.length) {
      host.innerHTML =
        '<p class="ops-talk-empty">運営通知はありません。AI秘書・監視系からの通知がここに集約されます。</p>';
      return;
    }
    host.innerHTML = rows
      .map((row) => {
        const badges = [
          `<span class="ops-talk-badge ops-talk-badge--kind">${esc(row.badge)}</span>`,
          row.unread
            ? '<span class="ops-talk-badge ops-talk-badge--open">未対応</span>'
            : '<span class="ops-talk-badge ops-talk-badge--done">対応済み</span>',
        ];
        if (row.priority === "urgent" || row.priority === "critical") {
          badges.push('<span class="ops-talk-badge ops-talk-badge--important">重要</span>');
        }
        return (
          `<a class="ops-talk-item" href="${esc(row.href)}" data-ops-talk-item>` +
          `<p class="ops-talk-item__title">${esc(row.title)}</p>` +
          `<p class="ops-talk-item__meta">${esc(row.meta || "")}</p>` +
          `<div class="ops-talk-item__badges">${badges.join("")}</div>` +
          `</a>`
        );
      })
      .join("");
  }

  function wireFilters() {
    document.querySelectorAll("[data-ops-talk-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.getAttribute("data-ops-talk-filter") || "all";
        document.querySelectorAll("[data-ops-talk-filter]").forEach((el) => {
          el.classList.toggle("is-active", el === btn);
        });
        renderList();
      });
    });
  }

  function showDenied() {
    const app = document.querySelector("[data-ops-talk-app]");
    if (!app) return;
    app.innerHTML =
      '<div class="ops-talk-denied">' +
      "<strong>運営用TALK</strong><br>" +
      "この画面は運営者専用です。プレビューは <code>?talkAdmin=1</code> を付けてください。" +
      '<br><a href="talk-home.html?tab=chat" style="color:#7dd3fc">利用者TALKへ</a>' +
      "</div>";
  }

  function init() {
    if (!isOpsAccessAllowed()) {
      showDenied();
      return;
    }
    ensureSeedNotifications();
    syncOpsAssistant();
    wireFilters();
    renderList();
    global.addEventListener("tasful-talk-notifications-changed", renderList);
    global.addEventListener("tasu:support-tickets-updated", () => {
      syncOpsAssistant();
      renderList();
    });
    global.addEventListener("tasu:ai-ops-cases-changed", () => {
      syncOpsAssistant();
      renderList();
    });
  }

  global.TasuOpsTalk = {
    init,
    mergeItems,
    isOpsAccessAllowed,
    ensureSeedNotifications,
  };

  if (document.querySelector("[data-ops-talk-app]")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(window);
