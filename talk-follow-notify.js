/**
 * TASFUL TALK — フォロー対象の更新を通知タブへ配信
 * talk-follow-store.js / talk-notifications-store.js の後に読み込む
 */
(function (global) {
  "use strict";

  const LISTING_EVENT = "tasu:listings-updated";
  const BUILDER_EVENT = "builder:mvp-changed";

  let listingWatchReady = false;
  const listingUpdatedAtMap = new Map();

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function newNotifyId(targetId, userId, event) {
    return `talk-follow-${String(targetId)}-${String(userId)}-${String(event)}-${Date.now()}`;
  }

  function typeLabel(type) {
    if (global.TasuTalkCategory?.typeLabel) {
      return global.TasuTalkCategory.typeLabel(type);
    }
    return type || "掲載";
  }

  function buildListingMessages(record, mode) {
    const title = pickStr(record?.title) || pickStr(record?.id) || "掲載";
    const type =
      global.TasuTalkCategory?.resolveListingCategoryType?.(record) ||
      global.TasuTalkFollowStore?.resolveTypeFromListing?.(record) ||
      "";
    const label = typeLabel(type);
    if (mode === "create") {
      return {
        notifyTitle: `フォロー中の${label}が新規公開されました`,
        body: `${title} が新規掲載されました。`,
      };
    }
    return {
      notifyTitle: `フォロー中の${label}が更新されました`,
      body: `${title} に更新がありました。`,
    };
  }

  function buildBuilderMessages(project, mode) {
    const title = pickStr(project?.title, project?.project_id) || "Builder案件";
    if (mode === "create") {
      return {
        notifyTitle: "フォロー中のBuilder案件が新規公開されました",
        body: `${title} が新規案件として公開されました。`,
      };
    }
    return {
      notifyTitle: "フォロー中のBuilder案件が更新されました",
      body: `${title} に更新がありました。`,
    };
  }

  /**
   * @param {Array<{ userId: string, notification: object }>} items
   */
  async function deliverFollowNotifications(items) {
    if (!items?.length) return { ok: false, reason: "empty" };
    const store = global.TasuTalkNotifications;
    if (store?.deliverToUsers) {
      return store.deliverToUsers(items);
    }
    let delivered = 0;
    for (const item of items) {
      try {
        if (item.userId === global.TasuChatUserIdentity?.getEffectiveUserId?.()) {
          global.TasuTalkData?.addNotification?.(item.notification) ||
            store?.add?.(item.notification);
        } else {
          store?.appendFanout?.(item.userId, item.notification);
        }
        delivered += 1;
      } catch (err) {
        console.warn("[TasuTalkFollowNotify] deliver item failed:", err);
      }
    }
    return { ok: delivered > 0, delivered };
  }

  /**
   * @param {object} opts
   */
  async function notifyFollowers(opts) {
    const targetId = pickStr(opts?.targetId, opts?.id);
    const type =
      global.TasuTalkFollowStore?.normalizeFollowType?.(opts?.type, opts) ||
      global.TasuTalkCategory?.normalizeFollowType?.(opts?.type, opts) ||
      "";
    const event = pickStr(opts?.event) || "update";
    if (!targetId || !type) return { ok: false, reason: "invalid_target" };

    const followers = global.TasuTalkFollowStore?.getFollowersForTarget?.(targetId, type) || [];
    if (!followers.length) return { ok: true, delivered: 0, reason: "no_followers" };

    const messages = opts.messages || {};
    const notifyTitle = pickStr(messages.notifyTitle, opts?.title) || `フォロー中の${typeLabel(type)}のお知らせ`;
    const body = pickStr(messages.body, opts?.body) || "内容が更新されました。";
    const targetUrl = pickStr(opts?.targetUrl) || "#";
    const priority = pickStr(opts?.priority) || "important";

    const items = followers.map((row) => ({
      userId: row.userId,
      notification: {
        id: newNotifyId(targetId, row.userId, event),
        type,
        title: notifyTitle,
        body,
        targetUrl: pickStr(row.targetUrl, targetUrl),
        priority,
        source: "follow",
        followTargetId: targetId,
        followTargetType: type,
        createdAt: new Date().toISOString(),
      },
    }));

    return deliverFollowNotifications(items);
  }

  function onListingChanged(detail) {
    const record = detail?.record;
    const mode = pickStr(detail?.mode) || "update";
    if (!record?.id) return notifyFollowers({ ok: false, reason: "no_record" });

    const type = global.TasuTalkFollowStore?.resolveTypeFromListing?.(record);
    if (!type) return { ok: false, reason: "unsupported_type" };

    const targetUrl = global.TasuTalkFollowStore?.buildTargetUrl?.(record, type, record.id);
    const messages = buildListingMessages(record, mode === "create" ? "create" : "update");

    return notifyFollowers({
      targetId: record.id,
      type,
      event: mode === "create" ? "create" : "update",
      targetUrl,
      messages,
    });
  }

  function onProjectChanged(project, mode) {
    if (!project?.project_id) return { ok: false, reason: "no_project" };
    const targetUrl = `public-board-detail.html?id=${encodeURIComponent(project.project_id)}&type=project`;
    const messages = buildBuilderMessages(project, mode === "create" ? "create" : "update");
    return notifyFollowers({
      targetId: project.project_id,
      type: "builder",
      event: mode === "create" ? "create" : "update",
      targetUrl,
      messages,
    });
  }

  function scanListingsFromStorage() {
    const list = global.TasuListingLocalStore?.readAll?.() || [];
    const changes = [];

    for (const rec of list) {
      const id = String(rec?.id || "").trim();
      if (!id) continue;
      const ts = pickStr(rec.updatedAt, rec.updated_at, rec.createdAt, rec.created_at);
      const prev = listingUpdatedAtMap.get(id);
      if (listingWatchReady && prev && prev !== ts) {
        changes.push({ record: rec, mode: prev ? "update" : "create" });
      } else if (listingWatchReady && prev === undefined) {
        changes.push({ record: rec, mode: "create" });
      }
      listingUpdatedAtMap.set(id, ts);
    }

    listingWatchReady = true;
    return changes;
  }

  function onListingsUpdated() {
    const changes = scanListingsFromStorage();
    const results = [];
    for (const ch of changes) {
      results.push(onListingChanged(ch));
    }
    return results;
  }

  function initListingWatcher() {
    try {
      scanListingsFromStorage();
      listingWatchReady = true;
    } catch (err) {
      console.warn("[TasuTalkFollowNotify] listing watcher init failed:", err);
    }
  }

  global.addEventListener(LISTING_EVENT, () => {
    try {
      onListingsUpdated();
    } catch (err) {
      console.warn("[TasuTalkFollowNotify] listings-updated handler failed:", err);
    }
  });

  global.addEventListener(BUILDER_EVENT, (ev) => {
    const project = ev?.detail?.project;
    const mode = ev?.detail?.mode;
    if (!project) return;
    try {
      onProjectChanged(project, mode || "update");
    } catch (err) {
      console.warn("[TasuTalkFollowNotify] builder event failed:", err);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initListingWatcher);
  } else {
    initListingWatcher();
  }

  global.TasuTalkFollowNotify = {
    notifyFollowers,
    onListingChanged,
    onProjectChanged,
    onListingsUpdated,
    deliverFollowNotifications,
  };
})(typeof window !== "undefined" ? window : globalThis);
