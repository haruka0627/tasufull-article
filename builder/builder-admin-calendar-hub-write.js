/**
 * 運営カレンダー案件 → Hub saveProject（CAL-MAIN-08 / CAL-MAIN-11）
 *
 * CAL-MAIN-11: Hub-primary。呼び出し側は先に createHubPrimaryProject を呼び、
 * MVP projects[] は互換ミラーとして書く。Hub 失敗時のみ MVP-only fallback。
 */
(function (global) {
  "use strict";

  const SOURCE = "admin_calendar_hub_primary";

  const CATEGORY_MAP = Object.freeze({
    scaffold: "other",
    interior: "interior",
    carpenter: "renovation",
    exterior: "exterior",
    roof: "roof",
    wet_area: "wet_area",
    renovation: "renovation",
    new_build: "new_build",
    other: "other",
  });

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

  function getStore() {
    return global.TasuBuilderProjectStore || null;
  }

  function mapCategory(raw) {
    const key = pickStr(raw).toLowerCase();
    return CATEGORY_MAP[key] || "other";
  }

  function newHubProjectId() {
    return `PRJ-ADMIN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function linkPair(legacyProjectId, hubProjectId, talkRoomId) {
    const MapApi = getMap();
    if (!MapApi?.linkIds) return;
    try {
      MapApi.linkIds({
        legacyProjectId: pickStr(legacyProjectId),
        hubProjectId: pickStr(hubProjectId),
        talkRoomId: pickStr(talkRoomId),
        source: SOURCE,
      });
    } catch {
      /* ignore */
    }
  }

  function scheduleTalkRoomLink(legacyProjectId, hubProject, ensurePromise) {
    const hubId = pickStr(hubProject?.id);
    if (!hubId) return;
    linkPair(legacyProjectId, hubId, pickStr(hubProject?.talkRoomId, hubProject?.talkThreadId));
    if (!ensurePromise || typeof ensurePromise.then !== "function") return;
    ensurePromise
      .then((project) => {
        linkPair(
          legacyProjectId,
          pickStr(project?.id, hubId),
          pickStr(project?.talkRoomId, project?.talkThreadId)
        );
      })
      .catch(() => {
        /* best-effort */
      });
  }

  function newLegacyProjectId() {
    return `proj-cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * CAL-MAIN-11: Hub を先に作成（正本）。legacy ID は互換用。
   * @param {{ legacyProjectId?: string, payload?: object, partnerName?: string, skipTalkRoom?: boolean }} input
   */
  function createHubPrimaryProject(input) {
    const payload = input?.payload && typeof input.payload === "object" ? input.payload : {};
    const legacyProjectId = pickStr(input?.legacyProjectId) || newLegacyProjectId();
    const result = ensureHubProjectForAdminCalendar({
      legacyProjectId,
      project: {
        project_id: legacyProjectId,
        title: pickStr(payload.title),
        calendar_assigned_partner_id: pickStr(payload.partnerId),
      },
      payload,
      partnerName: input?.partnerName,
      skipTalkRoom: input?.skipTalkRoom,
    });
    if (!result?.ok) {
      return {
        ok: false,
        reason: result?.reason || "hub_create_failed",
        legacyProjectId,
        primary: "none",
      };
    }
    return {
      ok: true,
      primary: "hub",
      legacyProjectId,
      hubProjectId: result.hubProjectId,
      duplicate: Boolean(result.duplicate),
      project: result.project,
    };
  }

  /**
   * 既存マップ / Hub を確認し、無ければ saveProject。
   * @param {{ project?: object, legacyProjectId?: string, payload?: object, partnerName?: string, skipTalkRoom?: boolean }} input
   * @returns {{ ok: boolean, hubProjectId?: string, duplicate?: boolean, reason?: string, project?: object }}
   */
  function ensureHubProjectForAdminCalendar(input) {
    const mvpProject = input?.project;
    const payload = input?.payload && typeof input.payload === "object" ? input.payload : {};
    const legacyProjectId = pickStr(
      input?.legacyProjectId,
      mvpProject?.project_id,
      mvpProject?.projectId
    );
    if (!legacyProjectId) return { ok: false, reason: "missing_legacy_id" };

    const Store = getStore();
    const MapApi = getMap();
    if (!Store?.saveProject) return { ok: false, reason: "no_hub_store" };

    try {
      Store.ensureSeed?.();
    } catch {
      /* ignore */
    }

    // 重複回避: 既存マップ → Hub が生きていれば再利用
    const mappedHubId = pickStr(MapApi?.legacyToHub?.(legacyProjectId));
    if (mappedHubId) {
      try {
        const existing = Store.getProject?.(mappedHubId);
        if (existing) {
          scheduleTalkRoomLink(legacyProjectId, existing, null);
          return {
            ok: true,
            hubProjectId: existing.id || mappedHubId,
            duplicate: true,
            project: existing,
          };
        }
      } catch {
        /* create new below */
      }
    }

    const title = pickStr(mvpProject?.title, payload.title) || "運営案件";
    const location = pickStr(payload.location, payload.siteAddress, payload.site_address);
    const start = pickStr(payload.start, payload.scheduleStartDate).slice(0, 10);
    const end = pickStr(payload.end, payload.scheduleEndDate).slice(0, 10) || start;
    const instructions = pickStr(payload.instructions, payload.notes, payload.memo, payload.description);
    const partnerName = pickStr(input?.partnerName, payload.partnerName);
    const hubId = mappedHubId || newHubProjectId();

    try {
      const saved = Store.saveProject(
        {
          id: hubId,
          name: title,
          category: mapCategory(payload.category || mvpProject?.category),
          status: "inquiry",
          scheduleStartDate: start,
          scheduleEndDate: end,
          schedulePhase: "inquiry",
          siteAddress: location === "—" ? "" : location,
          assignedVendor: partnerName,
          memo: instructions === "—" ? "" : instructions,
          source: "admin_calendar",
          workStartTime: pickStr(payload.startTime, "09:00"),
          workEndTime: pickStr(payload.endTime, "17:00"),
        },
        { skipTalkRoom: input?.skipTalkRoom === true }
      );

      const hubProjectId = pickStr(saved?.id, hubId);
      scheduleTalkRoomLink(legacyProjectId, saved, saved?._talkRoomEnsurePromise);

      // CAL-MAIN-10/13: 初期 assignment=pending（local + DB best-effort）
      try {
        const partnerId = pickStr(payload.partnerId, mvpProject?.calendar_assigned_partner_id);
        if (partnerId && Store.patchProjectLocal) {
          const pendingAssignment = {
            status: "pending",
            partnerId,
            partnerName: partnerName,
            source: SOURCE,
            updatedAt: new Date().toISOString(),
            legacyProjectId,
          };
          Store.patchProjectLocal(hubProjectId, { assignment: pendingAssignment });
          try {
            const adapter = global.TasuBuilderProjectWriteAdapter;
            const maybe = adapter?.writeAssignment?.(hubProjectId, pendingAssignment);
            if (maybe && typeof maybe.then === "function") maybe.catch(() => {});
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      const latest = Store.getProject?.(hubProjectId) || saved;
      return {
        ok: true,
        hubProjectId,
        duplicate: false,
        project: latest,
      };
    } catch (err) {
      return {
        ok: false,
        reason: err && err.message ? err.message : String(err || "save_failed"),
      };
    }
  }

  /**
   * MVP / Talk 通知 payload に Hub フィールドを付与（既存キーは維持）
   */
  function enrichNotifyWithHub(payload, legacyProjectId) {
    const row = payload && typeof payload === "object" ? { ...payload } : {};
    const legacyId = pickStr(legacyProjectId, row.project_id, row.projectId, row.legacyProjectId);
    const MapApi = getMap();
    const Dispatch = global.TasuBuilderNotifyDispatch;

    let hubProjectId = pickStr(row.hubProjectId, row.hub_project_id);
    if (!hubProjectId && MapApi?.legacyToHub && legacyId) {
      hubProjectId = MapApi.legacyToHub(legacyId);
    }

    if (hubProjectId) {
      row.hubProjectId = hubProjectId;
      row.legacyProjectId = legacyId || pickStr(row.legacyProjectId);
      if (MapApi?.buildHubCalendarHref) {
        row.hubHref = MapApi.buildHubCalendarHref(hubProjectId);
      }
    }

    if (Dispatch?.enrichBuilderNotify) {
      try {
        return Dispatch.enrichBuilderNotify(row);
      } catch {
        return row;
      }
    }
    if (MapApi?.enrichNotifyPayload) {
      try {
        return MapApi.enrichNotifyPayload(row);
      } catch {
        return row;
      }
    }
    return row;
  }

  global.TasuBuilderAdminCalendarHubWrite = {
    SOURCE,
    createHubPrimaryProject,
    ensureHubProjectForAdminCalendar,
    enrichNotifyWithHub,
    mapCategory,
    newLegacyProjectId,
    newHubProjectId,
  };
})(typeof window !== "undefined" ? window : globalThis);
