/**
 * Builder Notify Dispatch（CAL-MAIN-06 / CAL-MAIN-15）
 *
 * Talk 通知カード生成の薄い入口。既存 master 形式を壊さず Hub ID を載せる。
 * CAL-MAIN-15: calendar 系は Talk 成功時に MVP ベルをスキップするための入口。
 */
(function (global) {
  "use strict";

  const SOURCE = "builder_dispatch_v1";
  const CALENDAR_MVP_BELL_KINDS = Object.freeze([
    "calendar_assignment",
    "calendar_accepted",
    "calendar_declined",
  ]);

  function pickStr() {
    for (let i = 0; i < arguments.length; i += 1) {
      const v = arguments[i];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  }

  function getMap() {
    return global.TasuBuilderProjectIdMap || null;
  }

  function getMaster() {
    return global.TasuTalkBuilderNotifyMaster || null;
  }

  /**
   * 既存 master 行 / 任意 payload を Hub 付きに正規化
   */
  function enrichBuilderNotify(row) {
    const MapApi = getMap();
    if (!MapApi?.enrichNotifyPayload) return row;
    return MapApi.enrichNotifyPayload(row);
  }

  /**
   * 運営→パートナー新着案件通知（既存 ops-flow-001 形式）
   * @param {{ hubProjectId: string, title?: string, legacyProjectId?: string, preferHubNav?: boolean }} input
   */
  function notifyPartnerNewProject(input) {
    const MapApi = getMap();
    const hubProjectId = pickStr(input?.hubProjectId, input?.hub_project_id);
    const title = pickStr(input?.title, input?.projectTitle) || "新しい案件";
    let legacyProjectId = pickStr(input?.legacyProjectId, input?.legacy_project_id);
    if (!legacyProjectId && MapApi?.hubToLegacy) {
      legacyProjectId = MapApi.hubToLegacy(hubProjectId);
    }
    if (hubProjectId && legacyProjectId && MapApi?.linkIds) {
      MapApi.linkIds({
        hubProjectId,
        legacyProjectId,
        source: "notify_dispatch",
      });
    }

    const projectIdForUrl = legacyProjectId || hubProjectId;
    const legacyHref = projectIdForUrl
      ? `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectIdForUrl)}`
      : "builder/partner-assignment.html?role=partner";

    const hubHref =
      hubProjectId && MapApi?.buildHubCalendarHref
        ? MapApi.buildHubCalendarHref(hubProjectId)
        : "";

    const preferHubNav = input?.preferHubNav === true && Boolean(hubHref);
    const baseHref = preferHubNav ? hubHref : legacyHref;

    const row = enrichBuilderNotify({
      id: pickStr(input?.id) || `builder-dispatch-new-${Date.now()}`,
      notifyType: "project_assigned",
      subType: "project",
      audienceScope: "admin_ops",
      projectKind: "admin_ops",
      audience: "partner",
      recipientRole: "partner",
      actionTag: "新着案件",
      triggeredBy: "ops",
      title: "新しい案件が追加されました",
      body: `運営が案件を登録しました。${title}の手配が届いています。`,
      actionLabel: "確認する",
      href: baseHref,
      priority: "high",
      category: "Builder",
      serviceType: "builder",
      type: "builder",
      source: SOURCE,
      projectTitle: title,
      projectId: legacyProjectId || hubProjectId,
      legacyProjectId: legacyProjectId || "",
      hubProjectId: hubProjectId || "",
      hubHref,
      createdAt: new Date().toISOString(),
    });

    return pushToTalkStore(row);
  }

  function pushToTalkStore(row) {
    const store = global.TasuTalkNotifications || global.TasuTalkNotificationsStore;
    if (store && typeof store.add === "function") {
      try {
        const saved = store.add(row);
        return { ok: true, notification: saved || row, persisted: true };
      } catch {
        return { ok: false, notification: row, persisted: false, reason: "talk_add_failed" };
      }
    }
    return { ok: false, notification: row, persisted: false, reason: "talk_store_unavailable" };
  }

  /** Talk 通知タブへ書き込めるか */
  function isTalkNotifyAvailable() {
    const store = global.TasuTalkNotifications || global.TasuTalkNotificationsStore;
    return Boolean(store && typeof store.add === "function");
  }

  /**
   * CAL-MAIN-15: Talk に同等通知を書けたとき MVP ベルをスキップ
   * @param {string} kind calendar_assignment | calendar_accepted | calendar_declined
   * @param {{ ok?: boolean, persisted?: boolean }|null} talkResult
   */
  function shouldSkipMvpCalendarBell(kind, talkResult) {
    if (!CALENDAR_MVP_BELL_KINDS.includes(String(kind || ""))) return false;
    return Boolean(talkResult && talkResult.ok && talkResult.persisted);
  }

  function resolveIds(input) {
    const MapApi = getMap();
    let hubProjectId = pickStr(input?.hubProjectId, input?.hub_project_id);
    let legacyProjectId = pickStr(input?.legacyProjectId, input?.legacy_project_id, input?.projectId, input?.project_id);
    if (!hubProjectId && legacyProjectId && MapApi?.legacyToHub) {
      hubProjectId = MapApi.legacyToHub(legacyProjectId);
    }
    if (!legacyProjectId && hubProjectId && MapApi?.hubToLegacy) {
      legacyProjectId = MapApi.hubToLegacy(hubProjectId);
    }
    return { hubProjectId, legacyProjectId };
  }

  /**
   * 運営→パートナー手配（calendar_assignment）
   */
  function notifyCalendarAssignment(input) {
    const ids = resolveIds(input);
    const title = pickStr(input?.title, input?.projectTitle) || "新しい案件";
    const partnerId = pickStr(input?.partnerId, input?.recipientPartnerId);
    const assignmentId = pickStr(input?.assignmentId);
    const projectIdForUrl = ids.legacyProjectId || ids.hubProjectId;
    let href = pickStr(input?.href);
    if (!href && projectIdForUrl) {
      const sp = new URLSearchParams();
      sp.set("role", "partner");
      sp.set("projectId", projectIdForUrl);
      if (partnerId) sp.set("partnerId", partnerId);
      if (assignmentId) sp.set("calendarEventId", assignmentId);
      href = `builder/partner-assignment.html?${sp.toString()}`;
    }
    const MapApi = getMap();
    const hubHref =
      ids.hubProjectId && MapApi?.buildHubCalendarHref
        ? MapApi.buildHubCalendarHref(ids.hubProjectId)
        : pickStr(input?.hubHref);

    const row = enrichBuilderNotify({
      id: pickStr(input?.id) || `builder-dispatch-assign-${Date.now()}`,
      notifyType: "project_assigned",
      subType: "project",
      audienceScope: "admin_ops",
      projectKind: "admin_ops",
      audience: "partner",
      recipientRole: "partner",
      actionTag: "新着案件",
      triggeredBy: "ops",
      title: "新しい案件が追加されました",
      body: pickStr(input?.body) || `運営が案件を登録しました。${title}の手配が届いています。`,
      actionLabel: "確認する",
      href,
      priority: "high",
      category: "Builder",
      serviceType: "builder",
      type: "builder",
      source: SOURCE,
      projectTitle: title,
      projectId: ids.legacyProjectId || ids.hubProjectId,
      legacyProjectId: ids.legacyProjectId || "",
      hubProjectId: ids.hubProjectId || "",
      hubHref: hubHref || "",
      createdAt: new Date().toISOString(),
    });
    return pushToTalkStore(row);
  }

  /**
   * 受諾: 運営向け Talk 通知（パートナー向け確認は任意）
   */
  function notifyCalendarAccepted(input) {
    const ids = resolveIds(input);
    const title = pickStr(input?.title, input?.projectTitle) || "案件";
    const partnerName = pickStr(input?.partnerName, "パートナー");
    const threadId = pickStr(input?.threadId, input?.thread_id);
    const href = pickStr(
      input?.href,
      threadId ? `builder/mvp-thread.html?thread_id=${encodeURIComponent(threadId)}&role=owner` : "",
      ids.legacyProjectId
        ? `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(ids.legacyProjectId)}`
        : ""
    );
    const MapApi = getMap();
    const hubHref =
      ids.hubProjectId && MapApi?.buildHubCalendarHref
        ? MapApi.buildHubCalendarHref(ids.hubProjectId)
        : "";

    const ownerRow = enrichBuilderNotify({
      id: pickStr(input?.id) || `builder-dispatch-accepted-${Date.now()}`,
      notifyType: "project_accepted",
      subType: "project",
      audienceScope: "admin_ops",
      projectKind: "admin_ops",
      audience: "owner",
      recipientRole: "owner",
      actionTag: "受諾",
      triggeredBy: "partner",
      title: "パートナーが案件を受けました",
      body: pickStr(input?.body) || `${partnerName} が「${title}」を受諾しました。`,
      actionLabel: "確認する",
      href: href || "builder/admin-calendar.html",
      priority: "high",
      category: "Builder",
      serviceType: "builder",
      type: "builder",
      source: SOURCE,
      projectTitle: title,
      projectId: ids.legacyProjectId || ids.hubProjectId,
      legacyProjectId: ids.legacyProjectId || "",
      hubProjectId: ids.hubProjectId || "",
      hubHref: hubHref || "",
      threadId,
      createdAt: new Date().toISOString(),
    });
    return pushToTalkStore(ownerRow);
  }

  /**
   * 辞退: 運営向け Talk 通知
   */
  function notifyCalendarDeclined(input) {
    const ids = resolveIds(input);
    const title = pickStr(input?.title, input?.projectTitle) || "案件";
    const partnerName = pickStr(input?.partnerName, "パートナー");
    const href = pickStr(
      input?.href,
      ids.legacyProjectId
        ? `builder/admin-calendar.html?projectId=${encodeURIComponent(ids.legacyProjectId)}`
        : "builder/admin-calendar.html"
    );
    const MapApi = getMap();
    const hubHref =
      ids.hubProjectId && MapApi?.buildHubCalendarHref
        ? MapApi.buildHubCalendarHref(ids.hubProjectId)
        : "";

    const row = enrichBuilderNotify({
      id: pickStr(input?.id) || `builder-dispatch-declined-${Date.now()}`,
      notifyType: "project_declined",
      subType: "project",
      audienceScope: "admin_ops",
      projectKind: "admin_ops",
      audience: "owner",
      recipientRole: "owner",
      actionTag: "辞退",
      triggeredBy: "partner",
      title: "パートナーが案件を辞退しました",
      body: pickStr(input?.body) || `${partnerName} が「${title}」を辞退しました。`,
      actionLabel: "確認する",
      href,
      priority: "high",
      category: "Builder",
      serviceType: "builder",
      type: "builder",
      source: SOURCE,
      projectTitle: title,
      projectId: ids.legacyProjectId || ids.hubProjectId,
      legacyProjectId: ids.legacyProjectId || "",
      hubProjectId: ids.hubProjectId || "",
      hubHref: hubHref || "",
      createdAt: new Date().toISOString(),
    });
    return pushToTalkStore(row);
  }

  /**
   * master 配列全体を enrich（buildMaster 後処理用）
   */
  function enrichMasterRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => enrichBuilderNotify(row));
  }

  /**
   * 遷移 href。既定は既存挙動。preferHub で Calendar。
   */
  function resolveActionHref(notification, options) {
    const MapApi = getMap();
    if (MapApi?.resolveNotifyHref) {
      return MapApi.resolveNotifyHref(notification, options);
    }
    return pickStr(notification?.href, notification?.targetUrl);
  }

  global.TasuBuilderNotifyDispatch = {
    SOURCE,
    CALENDAR_MVP_BELL_KINDS,
    enrichBuilderNotify,
    enrichMasterRows,
    notifyPartnerNewProject,
    notifyCalendarAssignment,
    notifyCalendarAccepted,
    notifyCalendarDeclined,
    isTalkNotifyAvailable,
    shouldSkipMvpCalendarBell,
    resolveActionHref,
  };
})(typeof window !== "undefined" ? window : globalThis);
