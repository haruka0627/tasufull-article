/**
 * partner-assignment Hub 読取アダプタ（CAL-MAIN-07）
 *
 * URL の projectId（legacy / Hub）を ID マップで解決し、
 * Hub Store の案件を既存 MVP 形式（project / spec / assignment）に変換する。
 * UI・MVP キーは変更しない。取得失敗時は呼び出し側で MVP fallback。
 */
(function (global) {
  "use strict";

  const SOURCE = "hub_adapter_v1";

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

  /**
   * @param {string} urlProjectId
   * @returns {{ urlId: string, hubId: string, legacyId: string, idCandidates: string[] }}
   */
  function resolveIds(urlProjectId) {
    const MapApi = getMap();
    const urlId = pickStr(urlProjectId);
    let hubId = "";
    let legacyId = "";

    if (MapApi) {
      if (MapApi.isHubProjectId?.(urlId)) {
        hubId = urlId;
        legacyId = MapApi.hubToLegacy?.(urlId) || "";
      } else {
        legacyId = urlId;
        hubId = MapApi.legacyToHub?.(urlId) || "";
      }
      if (!hubId) hubId = MapApi.resolveHubProjectId?.(urlId) || "";
      if (!legacyId) legacyId = MapApi.resolveLegacyProjectId?.(urlId) || "";
    } else if (urlId) {
      if (/^PRJ-/i.test(urlId) || /^[0-9a-f]{8}-/i.test(urlId)) hubId = urlId;
      else legacyId = urlId;
    }

    const idCandidates = Array.from(new Set([urlId, hubId, legacyId].filter(Boolean)));
    return { urlId, hubId, legacyId, idCandidates };
  }

  function loadHubProject(hubId) {
    const id = pickStr(hubId);
    if (!id) return null;
    const Store = getStore();
    if (!Store) return null;
    try {
      Store.ensureSeed?.();
    } catch {
      /* ignore */
    }
    try {
      const project = Store.getProject?.(id);
      return project && typeof project === "object" ? project : null;
    } catch {
      return null;
    }
  }

  function mapHubStatusToAssignment(status) {
    const s = pickStr(status).toLowerCase();
    if (s === "completed" || s === "cancelled" || s === "canceled") return "accepted";
    if (s === "in_progress" || s === "contracted") return "accepted";
    return "pending";
  }

  function formatYen(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "";
    return `¥${Math.round(n).toLocaleString("ja-JP")}`;
  }

  function formatSchedule(hub) {
    const start = pickStr(hub?.scheduleStartDate, hub?.schedule_start);
    const end = pickStr(hub?.scheduleEndDate, hub?.schedule_end);
    const phase = pickStr(hub?.schedulePhase, hub?.schedule_phase);
    if (start && end) return phase ? `${start}〜${end}（${phase}）` : `${start}〜${end}`;
    return start || end || "";
  }

  /**
   * Hub 案件 → partner-assignment が期待する MVP 形状
   * @param {object} hub
   * @param {{ urlId: string, hubId: string, legacyId: string, partnerId?: string, assignment?: object|null }} opts
   */
  function toMvpShape(hub, opts) {
    const urlId = pickStr(opts?.urlId);
    const hubId = pickStr(opts?.hubId, hub?.id);
    const legacyId = pickStr(opts?.legacyId);
    const partnerId = pickStr(opts?.partnerId);
    const existingAssignment = opts?.assignment && typeof opts.assignment === "object" ? opts.assignment : null;

    const title = pickStr(hub?.name, hub?.title, existingAssignment?.houseName) || "案件";
    const address = pickStr(hub?.siteAddress, hub?.site_address, existingAssignment?.siteAddress);
    const memo = pickStr(hub?.memo, existingAssignment?.notes);
    const reward = formatYen(hub?.finance?.estimateAmount ?? hub?.finance?.estimate_amount);
    const schedule = formatSchedule(hub);
    // CAL-MAIN-10: Hub local assignment を表示優先
    const hubAssignment =
      hub?.assignment && typeof hub.assignment === "object" ? hub.assignment : null;
    const assignmentStatus = pickStr(
      hubAssignment?.status,
      existingAssignment?.assignmentStatus,
      existingAssignment?.assignment_status,
      mapHubStatusToAssignment(hub?.status)
    );
    const resolvedPartnerId = pickStr(
      hubAssignment?.partnerId,
      existingAssignment?.partnerId,
      partnerId
    );

    /** 受諾/辞退は MVP 側 ID を優先（既存 write パス互換） */
    const actionProjectId = legacyId || urlId || hubId;

    const project = {
      project_id: actionProjectId,
      title,
      kind: "builder_board",
      board_type: "calendar",
      projectKind: "calendar",
      status: "open",
      required_partners: 1,
      selected_partner_ids:
        assignmentStatus === "accepted" && resolvedPartnerId ? [resolvedPartnerId] : [],
      calendar_assigned_partner_id: pickStr(
        resolvedPartnerId,
        existingAssignment?.partnerId,
        partnerId,
        hub?.assignedVendor
      ),
      assignment_status: assignmentStatus || "pending",
      _hubAssignment: hubAssignment || null,
      visibility: "partner_only",
      contact_policy: "tasful_talk_only",
      main_thread_id: pickStr(hub?.talkRoomId, hub?.talkThreadId, hub?.talk_room_id),
      source: "hub_calendar",
      hub_project_id: hubId,
      _hubProjectId: hubId,
      _hubSource: SOURCE,
    };

    const spec = {
      builder_summary: memo || title,
      overview: memo,
      description: memo,
      site_address: address,
      site_access: pickStr(existingAssignment?.siteAccess, existingAssignment?.site_access),
      access: pickStr(existingAssignment?.siteAccess, existingAssignment?.site_access),
      notes: memo,
      reward: reward || pickStr(existingAssignment?.reward),
      schedule_summary: schedule || pickStr(existingAssignment?.scheduleLabel),
      period: {
        start: pickStr(hub?.scheduleStartDate, hub?.schedule_start),
        end: pickStr(hub?.scheduleEndDate, hub?.schedule_end),
      },
      area: { label: address },
      attachments: Array.isArray(hub?.documents)
        ? hub.documents.map((d) => ({ name: pickStr(d?.title, d?.filename, d?.name), type: pickStr(d?.type, "file") }))
        : [],
    };

    const assignment = existingAssignment
      ? {
          ...existingAssignment,
          projectId: actionProjectId,
          partnerId: pickStr(existingAssignment.partnerId, resolvedPartnerId),
          houseName: pickStr(existingAssignment.houseName, title),
          summary: pickStr(existingAssignment.summary, memo, title),
          siteAddress: pickStr(existingAssignment.siteAddress, address),
          reward: pickStr(existingAssignment.reward, reward),
          scheduleLabel: pickStr(existingAssignment.scheduleLabel, schedule),
          assignmentStatus: assignmentStatus || "pending",
        }
      : {
          projectId: actionProjectId,
          partnerId: resolvedPartnerId || "",
          houseName: title,
          summary: memo || title,
          reward: reward || "",
          siteAddress: address,
          siteAccess: "",
          notes: memo,
          scheduleLabel: schedule,
          workDate: pickStr(hub?.scheduleStartDate, hub?.schedule_start),
          startTime: pickStr(hub?.workStartTime, hub?.work_start_time),
          endTime: pickStr(hub?.workEndTime, hub?.work_end_time),
          assignmentStatus: assignmentStatus || "pending",
          googleMapUrl: address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : "",
        };

    return {
      ok: true,
      source: "hub",
      project,
      spec,
      assignment,
      hubProjectId: hubId,
      legacyProjectId: legacyId,
      urlProjectId: urlId,
      actionProjectId,
    };
  }

  /**
   * assignment 検索コールバック付き解決。
   * @param {string} urlProjectId
   * @param {string} partnerId
   * @param {{ findAssignment?: (projectId: string, partnerId: string) => object|null }} [hooks]
   */
  function resolveForPartnerAssignment(urlProjectId, partnerId, hooks) {
    const ids = resolveIds(urlProjectId);
    if (!ids.urlId) {
      return { ok: false, reason: "missing_project_id", denied: false };
    }

    const findAssignment =
      typeof hooks?.findAssignment === "function" ? hooks.findAssignment : null;

    let assignment = null;
    if (findAssignment && partnerId) {
      for (let i = 0; i < ids.idCandidates.length; i += 1) {
        assignment = findAssignment(ids.idCandidates[i], partnerId);
        if (assignment) break;
      }
    }

    const hubId = ids.hubId;
    const hub = loadHubProject(hubId);
    if (!hub) {
      return {
        ok: false,
        reason: hubId ? "hub_not_found" : "hub_id_unresolved",
        denied: false,
        ...ids,
        assignment,
      };
    }

    // 割当チェック: assignment がある、または partnerId 未指定（表示のみ）
    if (partnerId && !assignment && hooks?.requireAssignment !== false) {
      // Hub 案件はあるが運営割当が無い → 呼び出し側で denied / MVP fallback 判断
      return {
        ok: false,
        reason: "not_assigned",
        denied: true,
        hubProject: hub,
        ...ids,
      };
    }

    const MapApi = getMap();
    const urlIsHub = Boolean(MapApi?.isHubProjectId?.(ids.urlId));
    // legacy URL: 運営 assignment を表示マスターに（既存デモ文言維持）
    // Hub URL: 割当は権限確認のみ、表示は Hub 正本
    const displayAssignment = assignment
      ? urlIsHub
        ? {
            projectId: assignment.projectId,
            partnerId: assignment.partnerId,
            assignmentStatus: pickStr(
              assignment.assignmentStatus,
              assignment.assignment_status,
              "pending"
            ),
          }
        : assignment
      : null;

    return toMvpShape(hub, {
      urlId: ids.urlId,
      hubId: hub.id || hubId,
      legacyId: ids.legacyId,
      partnerId,
      assignment: displayAssignment,
    });
  }

  /**
   * Hub を優先して読む。失敗時は ok:false（MVP fallback 用）。
   * requireAssignment=false のとき割当なしでも Hub 表示可。
   */
  function tryLoadHubDetail(urlProjectId, partnerId, hooks) {
    const opts = hooks && typeof hooks === "object" ? { ...hooks } : {};
    // デモ/通知導線: 割当が legacy ID 側にあれば OK。無ければ Hub 単独表示も許可しない（denied）。
    // ただし findAssignment が全候補で見つかれば ok。
    const result = resolveForPartnerAssignment(urlProjectId, partnerId, opts);
    if (result.ok) return result;

    // Hub はあるが not_assigned → denied として返す（MVP にも無ければ denied 表示）
    if (result.reason === "not_assigned" && result.hubProject) {
      // 割当なしでも Hub を見せるのは危険なので、partnerId 空のときのみ許可
      if (!pickStr(partnerId)) {
        return toMvpShape(result.hubProject, {
          urlId: result.urlId,
          hubId: result.hubId,
          legacyId: result.legacyId,
          partnerId: "",
          assignment: null,
        });
      }
    }
    return result;
  }

  /**
   * 非同期: Supabase hydrate 後に再取得（任意）
   */
  async function hydrateAndResolve(urlProjectId, partnerId, hooks) {
    const Store = getStore();
    if (Store?.hydrateFromSupabase) {
      try {
        await Store.hydrateFromSupabase();
      } catch {
        /* fallback to local */
      }
    }
    return tryLoadHubDetail(urlProjectId, partnerId, hooks);
  }

  /**
   * CAL-MAIN-18: Hub assignment.status を読む（無ければ空文字）
   * @param {object|null|undefined} project MVP or Hub-shaped project
   * @returns {string} pending|accepted|declined|""
   */
  function readHubAssignmentStatus(project) {
    const embedded =
      project?._hubAssignment && typeof project._hubAssignment === "object"
        ? project._hubAssignment
        : null;
    const embeddedStatus = pickStr(embedded?.status).toLowerCase();
    if (
      embeddedStatus === "accepted" ||
      embeddedStatus === "declined" ||
      embeddedStatus === "pending"
    ) {
      return embeddedStatus;
    }

    const MapApi = getMap();
    const Store = getStore();
    let hubId = pickStr(project?.hub_project_id, project?._hubProjectId, project?.id);
    const legacyId = pickStr(project?.project_id, project?.legacyProjectId);
    if (!hubId && MapApi) {
      if (MapApi.isHubProjectId?.(legacyId)) hubId = legacyId;
      else hubId = MapApi.legacyToHub?.(legacyId) || "";
    }
    if (!hubId || !Store?.getProject) return "";

    try {
      const hub = Store.getProject(hubId);
      const status = pickStr(hub?.assignment?.status).toLowerCase();
      if (status === "accepted" || status === "declined" || status === "pending") return status;
    } catch {
      /* ignore */
    }
    return "";
  }

  /**
   * CAL-MAIN-18: 表示用 assignment status（Hub Read 正本 → MVP fallback）
   * @param {object|null|undefined} project
   * @returns {"pending"|"accepted"|"declined"}
   */
  function resolveAssignmentStatus(project) {
    const hubStatus = readHubAssignmentStatus(project);
    if (hubStatus) return hubStatus;
    const mvp = pickStr(project?.assignment_status, project?.assignmentStatus).toLowerCase();
    if (mvp === "accepted" || mvp === "declined" || mvp === "pending") return mvp;
    return "pending";
  }

  /**
   * CAL-MAIN-17: Hub DB write 成功 + hydrate 確認時に MVP assignment_status write を止めるか
   * @returns {boolean}
   */
  function isStopMvpAssignmentWriteWhenDbOkEnabled() {
    return global.TASU_BUILDER_STOP_MVP_ASSIGNMENT_WRITE_WHEN_DB_OK !== false;
  }

  /**
   * @param {{ ok?: boolean, dbConfirmed?: boolean }|null|undefined} hubResult
   * @returns {boolean}
   */
  function shouldSkipMvpAssignmentStatusWrite(hubResult) {
    if (!isStopMvpAssignmentWriteWhenDbOkEnabled()) return false;
    return Boolean(hubResult && hubResult.ok === true && hubResult.dbConfirmed === true);
  }

  /**
   * CAL-MAIN-10 / CAL-MAIN-17: 受諾/辞退を Hub local assignment に書き、DB は await（best-effort）
   * local は常に維持。DB 成功 + hydrate(source=supabase) で status 一致なら dbConfirmed。
   * @param {{ projectId?: string, legacyProjectId?: string, hubProjectId?: string, status: string, partnerId?: string, partnerName?: string }} input
   * @returns {Promise<{ ok: boolean, hubProjectId?: string, assignment?: object, db_assignment?: object, dbConfirmed?: boolean, hydrate?: object, reason?: string }>}
   */
  async function writeAssignmentDecision(input) {
    const status = pickStr(input?.status).toLowerCase();
    if (status !== "accepted" && status !== "declined" && status !== "pending") {
      return { ok: false, reason: "invalid_status", dbConfirmed: false };
    }

    const MapApi = getMap();
    const Store = getStore();
    if (!Store?.patchProjectLocal && !Store?.saveProject) {
      return { ok: false, reason: "no_hub_store", dbConfirmed: false };
    }

    const legacyProjectId = pickStr(input?.legacyProjectId, input?.projectId);
    let hubProjectId = pickStr(input?.hubProjectId);
    if (!hubProjectId && MapApi) {
      if (MapApi.isHubProjectId?.(legacyProjectId)) hubProjectId = legacyProjectId;
      else hubProjectId = MapApi.legacyToHub?.(legacyProjectId) || "";
    }
    if (!hubProjectId) return { ok: false, reason: "hub_id_unresolved", dbConfirmed: false };

    try {
      Store.ensureSeed?.();
    } catch {
      /* ignore */
    }

    let existing = null;
    try {
      existing = Store.getProject?.(hubProjectId) || null;
    } catch {
      existing = null;
    }
    if (!existing) return { ok: false, reason: "hub_not_found", hubProjectId, dbConfirmed: false };

    const now = new Date().toISOString();
    const prev =
      existing.assignment && typeof existing.assignment === "object" ? existing.assignment : {};
    const partnerId = pickStr(input?.partnerId, prev.partnerId);
    const assignment = {
      status,
      partnerId,
      partnerName: pickStr(input?.partnerName, prev.partnerName),
      acceptedAt: status === "accepted" ? now : pickStr(prev.acceptedAt),
      declinedAt: status === "declined" ? now : pickStr(prev.declinedAt),
      updatedAt: now,
      source: "partner_assignment",
    };

    try {
      let saved = null;
      if (typeof Store.patchProjectLocal === "function") {
        const res = Store.patchProjectLocal(hubProjectId, { assignment });
        if (!res?.ok) {
          return {
            ok: false,
            reason: res?.error || "patch_failed",
            hubProjectId,
            dbConfirmed: false,
          };
        }
        saved = res.project;
      } else {
        saved = Store.saveProject(
          { ...existing, id: hubProjectId, assignment },
          { skipTalkRoom: true }
        );
      }
      if (legacyProjectId && MapApi?.linkIds) {
        MapApi.linkIds({
          legacyProjectId,
          hubProjectId: pickStr(saved?.id, hubProjectId),
          talkRoomId: pickStr(saved?.talkRoomId, existing.talkRoomId),
          source: "partner_assignment",
        });
      }

      const finalAssignment = saved?.assignment || assignment;
      const finalHubId = pickStr(saved?.id, hubProjectId);

      // CAL-MAIN-13/17: DB assignment jsonb を await（列無し / RLS / 未接続は ok:false）
      let dbWrite = { ok: false, skipped: true };
      try {
        const adapter = global.TasuBuilderProjectWriteAdapter;
        if (adapter?.writeAssignment) {
          const maybe = adapter.writeAssignment(finalHubId, {
            ...finalAssignment,
            legacyProjectId,
          });
          dbWrite =
            maybe && typeof maybe.then === "function"
              ? await maybe
              : maybe && typeof maybe === "object"
                ? maybe
                : { ok: false, skipped: true };
        }
      } catch (err) {
        dbWrite = {
          ok: false,
          skipped: false,
          reason: err && err.message ? err.message : "db_write_failed",
        };
      }

      let hydrate = null;
      let dbConfirmed = false;
      // writeAssignment が返した status と hydrate 後の status が一致するときだけ確定
      // （ok:true だけの不完全レスポンスでは MVP fallback を維持）
      const dbStatus = pickStr(
        dbWrite?.assignment?.status,
        typeof dbWrite?.assignment === "object" ? dbWrite.assignment?.status : ""
      ).toLowerCase();
      if (dbWrite?.ok === true && dbStatus === status) {
        try {
          if (typeof Store.hydrateFromSupabase === "function") {
            hydrate = await Store.hydrateFromSupabase();
          }
          const after = Store.getProject?.(finalHubId);
          const afterStatus = pickStr(after?.assignment?.status).toLowerCase();
          dbConfirmed = hydrate?.source === "supabase" && afterStatus === status;
        } catch {
          dbConfirmed = false;
        }
      }

      return {
        ok: true,
        hubProjectId: finalHubId,
        assignment: finalAssignment,
        db_assignment: dbWrite,
        dbConfirmed,
        hydrate,
      };
    } catch (err) {
      return {
        ok: false,
        reason: err && err.message ? err.message : String(err || "write_failed"),
        hubProjectId,
        dbConfirmed: false,
      };
    }
  }

  global.TasuBuilderPartnerAssignmentHubAdapter = {
    SOURCE,
    resolveIds,
    loadHubProject,
    toMvpShape,
    resolveForPartnerAssignment,
    tryLoadHubDetail,
    hydrateAndResolve,
    writeAssignmentDecision,
    readHubAssignmentStatus,
    resolveAssignmentStatus,
    isStopMvpAssignmentWriteWhenDbOkEnabled,
    shouldSkipMvpAssignmentStatusWrite,
  };
})(typeof window !== "undefined" ? window : globalThis);
