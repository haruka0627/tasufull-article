/**
 * TASFUL TALK — Builder通知マスター v1.0（デモシード）
 *
 * - builder_board（一般案件）: board / public-board へ案内
 * - admin_ops（運営管理案件）: カレンダー・スレッド・入退場（管理者のみ一覧表示）
 */
(function (global) {
  "use strict";

  const SOURCE = "builder_master_v1";
  const VERSION = "v1";
  const CATEGORY = "Builder";

  const BOARD_PROJECT_ID = "demo-project-001";
  const BOARD_THREAD_ID = "thread-demo-001";
  const BOARD_PUBLIC_PROJECT_ID = "pub-board-project-001";
  const BOARD_PUBLIC_JOB_ID = "pub-board-job-001";
  const OPS_PROJECT_ID = "builder_demo_001";
  const OPS_THREAD_ID = "builder_thread_demo_001";

  const BOARD_PROJECT_DETAIL = `builder/board-project-detail.html?id=${BOARD_PROJECT_ID}`;
  const BOARD_PROJECT_APPLICATIONS = `${BOARD_PROJECT_DETAIL}&view=applications&role=owner`;
  const BOARD_THREAD = `builder/board-thread.html?thread_id=${BOARD_THREAD_ID}`;
  const BOARD_COMPLETION = `${BOARD_THREAD}&role=owner#completion`;
  const PUBLIC_PROJECT_DETAIL = `public-board-detail.html?id=${BOARD_PUBLIC_PROJECT_ID}&type=project`;
  const PUBLIC_JOB_DETAIL = `public-board-detail.html?id=${BOARD_PUBLIC_JOB_ID}&type=job`;
  const OPS_CALENDAR = `builder/partner-assignment.html?role=partner&projectId=${OPS_PROJECT_ID}`;
  const OPS_COMPLETION = `builder/mvp-thread.html?thread_id=${OPS_THREAD_ID}&role=owner#completion`;
  const OPS_THREAD = `builder/mvp-thread.html?thread_id=${OPS_THREAD_ID}&role=owner`;
  const OPS_THREAD_PARTNER = `builder/mvp-thread.html?thread_id=${OPS_THREAD_ID}&role=partner`;
  const OPS_ATTENDANCE = `${OPS_THREAD}#photos`;

  const BOARD_PROJECT_TITLE = "新宿区 共同住宅 外装改修";
  const BOARD_JOB_TITLE = "横浜市 内装施工スタッフ募集";
  const BOARD_APPLY_TITLE = "東京都 外壁塗装案件";
  const OPS_PROJECT_TITLE = "新宿区 共同住宅 外装改修";

  const SCOPE_LABELS = Object.freeze({
    admin_ops: "Builder運営",
    builder_board: "Builder一般",
  });

  const SUBTYPE_LABELS = Object.freeze({
    project: "案件",
    thread: "スレッド",
    attendance: "入退場",
    application: "応募",
  });

  const ADMIN_OPS_TITLE_PATTERNS = Object.freeze([
    /新着案件が入りました/,
    /完了報告差し戻し/,
    /完了承認/,
    /承認済み/,
    /差し戻し/,
    /案件を受けました/,
    /入場しました/,
    /退場しました/,
    /完了報告が提出されました/,
    /カレンダーで確認/,
    /案件が開始されました/,
    /作業開始/,
    /作業終了/,
    /現場に入りました/,
    /現場を退出/,
    /入場予定/,
    /入退場を確認/,
    /現場写真/,
    /請求書を見る/,
    /請求書が届きました/,
    /手配/,
    /新しい仕事が入りました/,
    /案件に招待されました/,
  ]);

  /** 運営⇔パートナー Builder 行動フロー（7件） */
  const BUILDER_OPS_FLOW_CASES = Object.freeze([
    {
      id: "builder-ops-flow-001",
      step: 1,
      action: "運営が案件登録",
      actionTag: "新着案件",
      triggeredBy: "ops",
      recipient: "partner",
      title: "新着案件が入りました",
      expectPath: "builder/partner-assignment.html",
      expectQuery: { role: "partner", projectId: OPS_PROJECT_ID },
    },
    {
      id: "builder-ops-flow-002",
      step: 2,
      action: "パートナーが受諾",
      actionTag: "受諾",
      triggeredBy: "partner",
      recipient: "ops",
      title: "案件を受けました",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
    },
    {
      id: "builder-ops-flow-003",
      step: 3,
      action: "パートナーが入場",
      actionTag: "入場",
      triggeredBy: "partner",
      recipient: "ops",
      title: "入場しました",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
    },
    {
      id: "builder-ops-flow-004",
      step: 4,
      action: "パートナーが退場",
      actionTag: "退場",
      triggeredBy: "partner",
      recipient: "ops",
      title: "退場しました",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
    },
    {
      id: "builder-ops-flow-005",
      step: 5,
      action: "パートナーが完了報告",
      actionTag: "完了報告",
      triggeredBy: "partner",
      recipient: "ops",
      title: "完了報告が提出されました",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
      expectHash: "completion",
    },
    {
      id: "builder-ops-flow-006",
      step: 6,
      action: "運営が承認",
      actionTag: "承認",
      triggeredBy: "ops",
      recipient: "partner",
      title: "承認済み",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "partner" },
    },
    {
      id: "builder-ops-flow-007",
      step: 7,
      action: "運営が差し戻し",
      actionTag: "差し戻し",
      triggeredBy: "ops",
      recipient: "partner",
      title: "差し戻し",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "partner" },
    },
  ]);

  /** 通知導線テスト用デモ（6件） */
  /** 通知タブ + TASFUL TALK へ同時配信する運営⇔パートナー通知 */
  const BUILDER_OPS_TALK_IDS = new Set([
    "builder-ops-route-001",
    "builder-ops-route-002",
    "builder-ops-route-003",
    "builder-ops-route-004",
    "builder-ops-route-005",
    "builder-ops-route-006",
    "builder-ops-flow-001",
    "builder-ops-flow-002",
    "builder-ops-flow-003",
    "builder-ops-flow-004",
    "builder-ops-flow-005",
    "builder-ops-flow-006",
  ]);

  const BUILDER_OPS_ROUTE_DEMO_CASES = Object.freeze([
    {
      id: "builder-ops-route-001",
      title: "新しい案件が追加されました",
      actionLabel: "確認する",
      role: "パートナー",
      expectPath: "builder/partner-assignment.html",
      expectQuery: { role: "partner", projectId: OPS_PROJECT_ID },
    },
    {
      id: "builder-ops-route-002",
      title: "案件を受諾しました",
      actionLabel: "確認する",
      role: "運営",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
    },
    {
      id: "builder-ops-route-003",
      title: "新しいメッセージがあります",
      direction: "運営→パートナー",
      actionLabel: "確認する",
      role: "パートナー",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "partner" },
    },
    {
      id: "builder-ops-route-004",
      title: "新しいメッセージがあります",
      direction: "パートナー→運営",
      actionLabel: "確認する",
      role: "運営",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
    },
    {
      id: "builder-ops-route-005",
      title: "完了報告が提出されました",
      actionLabel: "確認する",
      role: "運営",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "owner" },
      expectHash: "completion",
    },
    {
      id: "builder-ops-route-006",
      title: "完了報告が承認されました",
      actionLabel: "確認する",
      role: "パートナー",
      expectPath: "builder/mvp-thread.html",
      expectQuery: { thread_id: OPS_THREAD_ID, role: "partner" },
    },
  ]);

  /** @deprecated — BUILDER_OPS_FLOW_CASES を使用 */
  const BUILDER_OPS_VERIFY_CASES = BUILDER_OPS_FLOW_CASES;

  const NOTIFY_TAG_TONES = Object.freeze({
    Builder: "indigo",
    運営: "amber",
    パートナー: "teal",
    新着案件: "blue",
    受諾: "green",
    入場: "cyan",
    退場: "slate",
    完了報告: "purple",
    承認: "green",
    差し戻し: "rose",
    メッセージ: "cyan",
  });

  function buildNotifyTags(row) {
    const tags = ["Builder"];
    const recipient = pickStr(row.recipientRole, row.audience);
    if (recipient === "partner") tags.push("パートナー");
    if (recipient === "owner" || recipient === "ops") tags.push("運営");
    const actionTag = pickStr(row.actionTag);
    if (actionTag) tags.push(actionTag);
    return tags;
  }

  function withOpsFlowTags(row) {
    const id = String(row?.id || "");
    const mirrorToTalk = BUILDER_OPS_TALK_IDS.has(id);
    return {
      ...row,
      notifyTags: buildNotifyTags(row),
      sendTalkMessage: mirrorToTalk,
      officialRoomId: mirrorToTalk ? "official_platform" : null,
    };
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  /** @deprecated — ストア・公式トークから除去 */
  const DEPRECATED_IDS = Object.freeze([
    "builder-estimate-request-001",
    "builder-estimate-received-001",
    "builder-estimate-approved-001",
    "builder-completion-approved-001",
    "builder-completion-rejected-001",
    "builder-thread-reply-001",
    "builder-thread-site-update-001",
    "builder-project-new-001",
    "builder-project-invite-001",
    "builder-project-started-001",
    "builder-schedule-changed-001",
    "builder-completion-received-001",
    "builder-invoice-received-001",
    "builder-payment-completed-001",
    "builder-thread-message-001",
    "builder-thread-photo-001",
    "builder-thread-drawing-001",
    "builder-thread-urgent-001",
    "builder-attendance-enter-001",
    "builder-attendance-leave-001",
    "builder-attendance-start-001",
    "builder-attendance-finish-001",
    "builder-attendance-late-001",
    "builder-board-match-001",
    "builder-ops-calendar-001",
    "builder-ops-started-001",
    "builder-ops-invoice-001",
    "builder-ops-attendance-enter-001",
    "builder-ops-attendance-start-001",
    "builder-ops-photo-001",
    "builder-ops-verify-new-project-001",
    "builder-ops-verify-partner-msg-001",
    "builder-ops-verify-completion-reject-001",
    "builder-ops-verify-completion-approve-001",
    "builder-ops-verify-accepted-001",
    "builder-ops-verify-owner-msg-001",
    "builder-ops-verify-enter-001",
    "builder-ops-verify-leave-001",
    "builder-ops-verify-completion-submit-001",
  ]);

  const BUILDER_TALK_IDS = new Set([
    "builder-board-publish-001",
    "builder-board-selected-001",
    "builder-board-hire-owner-001",
  ]);

  function withTalkDelivery(row) {
    const id = String(row.id || "");
    const sendTalkMessage =
      row.sendTalkMessage === true || (row.sendTalkMessage === undefined && BUILDER_TALK_IDS.has(id));
    return {
      ...row,
      sendNotification: row.sendNotification !== false,
      sendTalkMessage,
      officialRoomId: sendTalkMessage ? row.officialRoomId || "official_platform" : null,
    };
  }

  function isAdminOpsBuilderNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (n.audienceScope === "admin_ops" || n.projectKind === "admin_ops") return true;
    const title = String(n.title || "");
    const label = String(n.actionLabel || "");
    return ADMIN_OPS_TITLE_PATTERNS.some((re) => re.test(title) || re.test(label));
  }

  function isBuilderBoardNotification(n) {
    if (!n || typeof n !== "object") return false;
    return n.audienceScope === "builder_board";
  }

  function getScopeLabel(n) {
    if (!n || typeof n !== "object") return "";
    if (isAdminOpsBuilderNotification(n)) return SCOPE_LABELS.admin_ops;
    if (isBuilderBoardNotification(n)) return SCOPE_LABELS.builder_board;
    if (String(n.type || "").toLowerCase() === "builder") return SCOPE_LABELS.builder_board;
    return "";
  }

  function getScopeTone(n) {
    return isAdminOpsBuilderNotification(n) ? "amber" : "blue";
  }

  function getProjectTitle(n) {
    if (!n || typeof n !== "object") return "";
    const explicit = String(n.projectTitle || n.project_title || "").trim();
    if (explicit) return explicit;
    return "";
  }

  function withProjectTitle(row, projectTitle) {
    return { ...row, projectTitle };
  }

  function buildMaster(now) {
    const t = Number(now) || Date.now();
    const iso = (ms) => new Date(t - ms).toISOString();

    const boardRows = [
      withProjectTitle({
        id: "builder-board-publish-001",
        notifyType: "project_published",
        subType: "project",
        audienceScope: "builder_board",
        audience: "all",
        title: "新しい案件が公開されました",
        body: "新宿区 共同住宅 外装改修が公開されました。",
        actionLabel: "詳細を見る",
        href: PUBLIC_PROJECT_DETAIL,
        priority: "high",
        createdAt: iso(1000 * 60 * 3),
        createdAtLabel: "3分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-job-001",
        notifyType: "job_published",
        subType: "project",
        audienceScope: "builder_board",
        audience: "all",
        title: "新しい求人が公開されました",
        body: "横浜市 内装施工スタッフ募集が公開されました。",
        actionLabel: "詳細を見る",
        href: PUBLIC_JOB_DETAIL,
        priority: "high",
        createdAt: iso(1000 * 60 * 5),
        createdAtLabel: "5分前",
      }, BOARD_JOB_TITLE),
      withProjectTitle({
        id: "builder-board-apply-001",
        notifyType: "application_received",
        subType: "application",
        audienceScope: "builder_board",
        audience: "owner",
        title: "応募がありました",
        body: "東京都 外壁塗装案件に新しい応募が届いています。",
        actionLabel: "応募者を見る",
        href: BOARD_PROJECT_APPLICATIONS,
        priority: "high",
        createdAt: iso(1000 * 60 * 8),
        createdAtLabel: "8分前",
      }, BOARD_APPLY_TITLE),
      withProjectTitle({
        id: "builder-board-selected-001",
        notifyType: "application_selected",
        subType: "thread",
        audienceScope: "builder_board",
        audience: "partner",
        title: "採用されました",
        body: "新宿区 共同住宅 外装改修 — やりとりチャットへ進んでください。",
        actionLabel: "チャットを開く",
        href: BOARD_THREAD,
        priority: "high",
        createdAt: iso(1000 * 60 * 12),
        createdAtLabel: "12分前",
        sendTalkMessage: true,
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-hire-owner-001",
        notifyType: "hire_confirmed",
        subType: "thread",
        audienceScope: "builder_board",
        audience: "owner",
        title: "採用が完了しました",
        body: "株式会社オレンジ建装さんとのやりとりチャットへ進んでください。",
        actionLabel: "チャットを開く",
        href: BOARD_THREAD,
        priority: "high",
        createdAt: iso(1000 * 60 * 14),
        createdAtLabel: "14分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-reject-001",
        notifyType: "application_rejected",
        subType: "application",
        audienceScope: "builder_board",
        audience: "partner",
        title: "今回は見送りになりました",
        body: "新宿区 共同住宅 外装改修の選考結果が届きました。",
        actionLabel: "案件を見る",
        href: PUBLIC_PROJECT_DETAIL,
        priority: "medium",
        createdAt: iso(1000 * 60 * 16),
        createdAtLabel: "16分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-thread-001",
        notifyType: "thread_message",
        subType: "thread",
        audienceScope: "builder_board",
        audience: "both",
        title: "新しいメッセージが届きました",
        body: "新宿区 共同住宅 外装改修のスレッドに新しいメッセージがあります。",
        actionLabel: "やり取りを見る",
        href: BOARD_THREAD,
        priority: "high",
        createdAt: iso(1000 * 60 * 22),
        createdAtLabel: "22分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-attach-001",
        notifyType: "thread_attachment",
        subType: "thread",
        audienceScope: "builder_board",
        audience: "both",
        title: "添付ファイルが届きました",
        body: "平面図.pdf がスレッドに追加されました。",
        actionLabel: "ファイルを確認",
        href: BOARD_THREAD,
        priority: "medium",
        createdAt: iso(1000 * 60 * 28),
        createdAtLabel: "28分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-update-001",
        notifyType: "project_updated",
        subType: "project",
        audienceScope: "builder_board",
        audience: "both",
        title: "案件内容が更新されました",
        body: "新宿区 共同住宅 外装改修の工期・条件が更新されました。",
        actionLabel: "変更内容を見る",
        href: BOARD_PROJECT_DETAIL,
        priority: "medium",
        createdAt: iso(1000 * 60 * 35),
        createdAtLabel: "35分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-completion-001",
        notifyType: "completion_report",
        subType: "project",
        audienceScope: "builder_board",
        audience: "owner",
        title: "完了報告が届きました",
        body: "新宿区 共同住宅 外装改修 — 完了報告をご確認ください。",
        actionLabel: "チャットを開く",
        href: BOARD_COMPLETION,
        priority: "high",
        createdAt: iso(1000 * 60 * 42),
        createdAtLabel: "42分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-payment-001",
        notifyType: "payment_completed",
        subType: "thread",
        audienceScope: "builder_board",
        audience: "owner",
        title: "取引が完了しました",
        body: "新宿区 共同住宅 外装改修の完了報告が承認されました。",
        actionLabel: "チャットを開く",
        href: OPS_THREAD,
        priority: "medium",
        createdAt: iso(1000 * 60 * 48),
        createdAtLabel: "48分前",
      }, BOARD_PROJECT_TITLE),
      withProjectTitle({
        id: "builder-board-cancel-001",
        notifyType: "project_cancelled",
        subType: "project",
        audienceScope: "builder_board",
        audience: "both",
        title: "案件がキャンセルされました",
        body: "新宿区 共同住宅 外装改修がキャンセルされました。",
        actionLabel: "詳細を見る",
        href: BOARD_PROJECT_DETAIL,
        priority: "medium",
        createdAt: iso(1000 * 60 * 55),
        createdAtLabel: "55分前",
      }, BOARD_PROJECT_TITLE),
    ];

    const adminOpsRouteRows = [
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-001",
          notifyType: "project_assigned",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "新着案件",
          triggeredBy: "ops",
          title: "新しい案件が追加されました",
          body: "運営が案件を登録しました。案件確認画面で内容をご確認ください。",
          actionLabel: "確認する",
          href: OPS_CALENDAR,
          priority: "high",
          createdAt: iso(1000 * 60 * 1),
          createdAtLabel: "1分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-002",
          notifyType: "project_accepted",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "受諾",
          triggeredBy: "partner",
          title: "案件を受諾しました",
          body: "パートナーが案件を受諾しました。案件スレッドで詳細を確認できます。",
          actionLabel: "確認する",
          href: OPS_THREAD,
          priority: "high",
          createdAt: iso(1000 * 60 * 2),
          createdAtLabel: "2分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-003",
          notifyType: "thread_message",
          subType: "thread",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "メッセージ",
          triggeredBy: "ops",
          title: "新しいメッセージがあります",
          body: "運営から新しいメッセージがあります（運営→パートナー）。",
          actionLabel: "確認する",
          href: OPS_THREAD_PARTNER,
          priority: "high",
          createdAt: iso(1000 * 60 * 3),
          createdAtLabel: "3分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-004",
          notifyType: "thread_message",
          subType: "thread",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "メッセージ",
          triggeredBy: "partner",
          title: "新しいメッセージがあります",
          body: "パートナーから新しいメッセージがあります（パートナー→運営）。",
          actionLabel: "確認する",
          href: OPS_THREAD,
          priority: "high",
          createdAt: iso(1000 * 60 * 4),
          createdAtLabel: "4分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-005",
          notifyType: "completion_submitted",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "完了報告",
          triggeredBy: "partner",
          title: "完了報告が提出されました",
          body: "パートナーから完了報告が届きました。完了報告セクションをご確認ください。",
          actionLabel: "確認する",
          href: OPS_COMPLETION,
          priority: "high",
          createdAt: iso(1000 * 60 * 5),
          createdAtLabel: "5分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-route-006",
          notifyType: "completion_approved",
          subType: "thread",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "承認",
          triggeredBy: "ops",
          title: "完了報告が承認されました",
          body: "運営が完了報告を承認しました。案件スレッドで結果を確認できます。",
          actionLabel: "確認する",
          href: OPS_THREAD_PARTNER,
          priority: "high",
          createdAt: iso(1000 * 60 * 6),
          createdAtLabel: "6分前",
        }),
        OPS_PROJECT_TITLE
      ),
    ];

    const adminOpsRows = [
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-001",
          notifyType: "project_assigned",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "新着案件",
          triggeredBy: "ops",
          title: "新しい案件が追加されました",
          body: "運営が案件を登録しました。新宿区 共同住宅 外装改修の手配が届いています。",
          actionLabel: "確認する",
          href: OPS_CALENDAR,
          priority: "high",
          createdAt: iso(1000 * 60 * 7),
          createdAtLabel: "7分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-002",
          notifyType: "project_accepted",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "受諾",
          triggeredBy: "partner",
          title: "案件を受諾しました",
          body: "パートナーが案件を受諾しました。株式会社オレンジ建装さんが作業を開始します。",
          actionLabel: "確認する",
          href: OPS_THREAD,
          priority: "high",
          createdAt: iso(1000 * 60 * 12),
          createdAtLabel: "12分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-003",
          notifyType: "attendance_enter",
          subType: "attendance",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "入場",
          triggeredBy: "partner",
          title: "入場しました",
          body: "パートナーが現場に入場しました。田中さんが作業を開始しています。",
          actionLabel: "確認する",
          href: OPS_THREAD,
          priority: "medium",
          createdAt: iso(1000 * 60 * 18),
          createdAtLabel: "18分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-004",
          notifyType: "attendance_leave",
          subType: "attendance",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "退場",
          triggeredBy: "partner",
          title: "退場しました",
          body: "パートナーが現場から退場しました。本日の作業が終了しました。",
          actionLabel: "確認する",
          href: OPS_THREAD,
          priority: "medium",
          createdAt: iso(1000 * 60 * 24),
          createdAtLabel: "24分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-005",
          notifyType: "completion_submitted",
          subType: "project",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "owner",
          recipientRole: "owner",
          actionTag: "完了報告",
          triggeredBy: "partner",
          title: "完了報告が提出されました",
          body: "パートナーから完了報告が届きました。内容を確認して承認または差し戻しを行ってください。",
          actionLabel: "確認する",
          href: OPS_COMPLETION,
          priority: "high",
          createdAt: iso(1000 * 60 * 30),
          createdAtLabel: "30分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-006",
          notifyType: "completion_approved",
          subType: "thread",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "承認",
          triggeredBy: "ops",
          title: "完了報告が承認されました",
          body: "運営が完了報告を承認しました。案件は承認済みの状態です。",
          actionLabel: "確認する",
          href: OPS_THREAD_PARTNER,
          priority: "high",
          createdAt: iso(1000 * 60 * 36),
          createdAtLabel: "36分前",
        }),
        OPS_PROJECT_TITLE
      ),
      withProjectTitle(
        withOpsFlowTags({
          id: "builder-ops-flow-007",
          notifyType: "completion_rejected",
          subType: "thread",
          audienceScope: "admin_ops",
          projectKind: "admin_ops",
          audience: "partner",
          recipientRole: "partner",
          actionTag: "差し戻し",
          triggeredBy: "ops",
          title: "差し戻し",
          body: "運営が完了報告を差し戻しました。修正内容を確認して再提出してください。",
          actionLabel: "スレッドを開く",
          href: OPS_THREAD_PARTNER,
          priority: "high",
          createdAt: iso(1000 * 60 * 42),
          createdAtLabel: "42分前",
        }),
        OPS_PROJECT_TITLE
      ),
    ];

    return [...boardRows, ...adminOpsRouteRows, ...adminOpsRows].map((row) =>
      withTalkDelivery({
        ...row,
        category: CATEGORY,
        serviceType: "builder",
        type: "builder",
        targetUrl: row.href,
        source: SOURCE,
        builderMasterVersion: VERSION,
        readAt: null,
      })
    );
  }

  const BUILDER_OPS_FLOW_IDS = new Set(BUILDER_OPS_FLOW_CASES.map((c) => c.id));
  const BUILDER_OPS_ROUTE_DEMO_IDS = new Set(BUILDER_OPS_ROUTE_DEMO_CASES.map((c) => c.id));
  const BUILDER_OPS_DEMO_VISIBLE_IDS = new Set([
    ...BUILDER_OPS_FLOW_IDS,
    ...BUILDER_OPS_ROUTE_DEMO_IDS,
  ]);

  function isBuilderOpsRouteDemoNotification(n) {
    return BUILDER_OPS_ROUTE_DEMO_IDS.has(String(n?.id || ""));
  }

  function isBuilderOpsFlowDemoNotification(n) {
    return BUILDER_OPS_DEMO_VISIBLE_IDS.has(String(n?.id || ""));
  }

  function isBuilderMasterNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (DEPRECATED_IDS.includes(String(n.id || ""))) return false;
    if (n.source === SOURCE) return true;
    if (n.builderMasterVersion === VERSION) return true;
    return String(n.id || "").startsWith("builder-");
  }

  function getSubTypeLabel(subType) {
    return SUBTYPE_LABELS[String(subType || "")] || "";
  }

  global.TasuTalkBuilderNotifyMaster = {
    SOURCE,
    VERSION,
    CATEGORY,
    SUBTYPE_LABELS,
    DEPRECATED_IDS,
    BUILDER_TALK_IDS,
    BUILDER_OPS_TALK_IDS,
    BOARD_THREAD,
    BOARD_PROJECT_DETAIL,
    PUBLIC_PROJECT_DETAIL,
    OPS_CALENDAR,
    OPS_THREAD,
    OPS_THREAD_PARTNER,
    OPS_ATTENDANCE,
    OPS_COMPLETION,
    BUILDER_OPS_FLOW_CASES,
    BUILDER_OPS_ROUTE_DEMO_CASES,
    BUILDER_OPS_FLOW_IDS,
    BUILDER_OPS_ROUTE_DEMO_IDS,
    BUILDER_OPS_DEMO_VISIBLE_IDS,
    BUILDER_OPS_VERIFY_CASES,
    NOTIFY_TAG_TONES,
    buildNotifyTags,
    isBuilderOpsRouteDemoNotification,
    isBuilderOpsFlowDemoNotification,
    BOARD_PROJECT_TITLE,
    BOARD_APPLY_TITLE,
    OPS_PROJECT_TITLE,
    SCOPE_LABELS,
    buildMaster,
    isBuilderMasterNotification,
    isAdminOpsBuilderNotification,
    isBuilderBoardNotification,
    getScopeLabel,
    getScopeTone,
    getProjectTitle,
    getSubTypeLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
