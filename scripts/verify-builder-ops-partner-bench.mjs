#!/usr/bin/env node
/**
 * Builder ops_partner 2窓ベンチ — カレンダー〜完了フロー検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(90000);

const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });
await page.waitForFunction(
  () => {
    const doc = document.getElementById("frame-a-calendar")?.contentDocument;
    const grid = doc?.querySelector("[data-admin-cal-grid]");
    return (
      doc?.body?.dataset?.page === "builder-admin-calendar" &&
      !!doc.querySelector("[data-admin-cal-assignment-open]") &&
      (grid?.children?.length || 0) > 0
    );
  },
  { timeout: 30000 }
);
await page.waitForFunction(
  () => {
    const meta = document.getElementById("builderBenchMeta")?.textContent || "";
    return meta.includes("calendarFrameSrc=mvp-calendar.html");
  },
  { timeout: 15000 }
);

record("ops toolbar", (await page.locator("#builderBenchOpsRow").count()) > 0);
record(
  "calendar tab iframes",
  (await page.locator("#frame-a-calendar, #frame-b-calendar").count()) === 2
);
record(
  "idle shows admin calendar on A",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-a-calendar")?.contentDocument;
    return doc?.body?.dataset?.page === "builder-admin-calendar";
  })
);
record(
  "A calendar iframe src is admin-calendar",
  await page.evaluate(() => {
    const el = document.getElementById("frame-a-calendar");
    const src = el?.dataset?.currentSrc || el?.getAttribute("src") || "";
    try {
      const u = new URL(src, window.location.href);
      return (
        u.pathname.endsWith("/admin-calendar.html") &&
        u.searchParams.get("role") === "owner" &&
        u.searchParams.get("benchEmbed") === "1" &&
        u.searchParams.get("benchSide") === "A" &&
        u.searchParams.get("builderFlow") === "ops_partner"
      );
    } catch {
      return src.includes("admin-calendar.html") && src.includes("benchSide=A");
    }
  })
);
record(
  "idle shows partner calendar on B",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-calendar")?.contentDocument;
    return doc?.body?.dataset?.page === "builder-mvp-calendar";
  })
);
record(
  "idle meta shows calendarFrameSrc",
  await page.evaluate(() => {
    const meta = document.getElementById("builderBenchMeta")?.textContent || "";
    return meta.includes("calendarFrameSrc=mvp-calendar.html") && meta.includes("activeTab=calendar");
  })
);
record(
  "idle project frame blank on B",
  await page.evaluate(() => {
    const el = document.getElementById("frame-b-project");
    const src = el?.dataset?.currentSrc || el?.getAttribute("src") || "";
    return !src.includes("partner-assignment") && !src.includes("mvp-calendar");
  })
);
record(
  "idle hides assignment tabs on B",
  await page.evaluate(() => document.body.classList.contains("bench--ops-idle"))
);
record(
  "calendar panel active initially on A",
  await page.evaluate(() =>
    document.querySelector('.bench-col--a [data-panel="calendar"]')?.classList.contains("is-active")
  )
);

const preAccept = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  const bench = window.TasuBuilderDualWindowBench;
  if (!ops || !bench) return { ok: false, error: "no_bench" };
  const aBtn = document
    .getElementById("frame-a-calendar")
    ?.contentDocument?.querySelector("[data-admin-cal-assignment-open]");
  if (!aBtn) return { ok: false, error: "no_admin_btn" };
  aBtn.click();
  let add = null;
  for (let i = 0; i < 50; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    if (ops.opsState.currentStep === "calendar_added") {
      add = { ok: true, project_id: ops.opsState.projectId };
      break;
    }
  }
  if (!add?.ok) return { ok: false, step: "add", add, currentStep: ops.opsState.currentStep };
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const bText =
      document.getElementById("frame-b-calendar")?.contentDocument?.querySelector(
        "[data-mvp-cal-partner-accepted-list]"
      )?.textContent || "";
    if (bText.includes("ベンチ検証 — 新宿区 外装足場工事")) break;
  }
  const afterAddCalendarPage =
    document.getElementById("frame-b-calendar")?.contentDocument?.body?.dataset?.page || "";
  const afterAddActiveTab = bench.getActiveTabId?.("B") || "";
  const bCalendarListAfterAdd =
    document.getElementById("frame-b-calendar")?.contentDocument?.querySelector(
      "[data-mvp-cal-partner-accepted-list]"
    )?.textContent || "";
  const aCalendarDoc = document.getElementById("frame-a-calendar")?.contentDocument;
  const aCalendarTextAfterAdd =
    aCalendarDoc?.querySelector(".admin-cal-detail")?.textContent ||
    aCalendarDoc?.querySelector("[data-admin-cal-grid]")?.textContent ||
    aCalendarDoc?.body?.textContent ||
    "";
  const aCalendarAssignmentStored = (() => {
    try {
      const rows = JSON.parse(
        localStorage.getItem("tasful:builder:admin:calendarAssignments:v1") || "[]"
      );
      return rows.some((a) => String(a.houseName || "").includes("ベンチ検証 — 新宿区 外装足場工事"));
    } catch {
      return false;
    }
  })();
  const projectId = ops.opsState.projectId;
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const project = (mvp.projects || []).find((p) => p.project_id === projectId);
  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const calNotif = notifs.find((n) => n.type === "calendar_assignment");
  let ctaNav = { ok: false, error: "no_cta" };
  const cta = document.getElementById("frame-b-calendar")?.contentDocument?.querySelector(
    "[data-mvp-cal-open-assignment]"
  );
  if (cta) {
    cta.click();
    let bProjectDocAfterCta = null;
    for (let i = 0; i < 30; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      bProjectDocAfterCta = document.getElementById("frame-b-project")?.contentDocument;
      if (bProjectDocAfterCta?.querySelector("[data-partner-assignment-accept]")) break;
    }
    ctaNav = {
      ok: true,
      projectId: cta.getAttribute("data-project-id") || "",
      calendarEventId: cta.getAttribute("data-calendar-event-id") || "",
      activeTab: bench.getActiveTabId?.("B") || "",
      projectPage: bProjectDocAfterCta?.body?.dataset?.page || "",
      hasAccept: !!bProjectDocAfterCta?.querySelector("[data-partner-assignment-accept]"),
      hasDecline: !!bProjectDocAfterCta?.querySelector("[data-partner-assignment-decline]"),
      opsProjectId: ops.opsState.projectId,
    };
  }
  if (calNotif) {
    bench.handleNotificationNavigate({
      href: calNotif.href,
      notificationId: calNotif.id,
      side: "B",
      slot: "project",
      notificationType: "calendar_assignment",
    });
  }
  await new Promise((r) => setTimeout(r, 400));
  const bProjectTabActive = document
    .querySelector('.bench-col--b [data-builder-tab="project"]')
    ?.classList.contains("is-active");
  const bCalendarPanel = document.querySelector('.bench-col--b [data-panel="calendar"]');
  const bProjectPanel = document.querySelector('.bench-col--b [data-panel="project"]');
  const bCalendarPanelHidden =
    !bCalendarPanel?.classList.contains("is-active") && bCalendarPanel?.hasAttribute("hidden");
  const bProjectPanelVisible =
    bProjectPanel?.classList.contains("is-active") &&
    !bProjectPanel?.hasAttribute("hidden") &&
    (getComputedStyle(bProjectPanel).display === "flex" ||
      getComputedStyle(bProjectPanel).display === "block");
  const bProjectPanelRect = bProjectPanel?.getBoundingClientRect();
  const bProjectPanelSized =
    (bProjectPanelRect?.width || 0) > 0 && (bProjectPanelRect?.height || 0) > 0;
  const bCalendarDoc = document.getElementById("frame-b-calendar")?.contentDocument;
  const bCalendarPage = bCalendarDoc?.body?.dataset?.page || "";
  const bProjectDoc = document.getElementById("frame-b-project")?.contentDocument;
  const bProjectPage = bProjectDoc?.body?.dataset?.page || "";
  const bProjectHasAssignment = !!bProjectDoc?.querySelector("[data-partner-assignment-detail]");
  const bThreadBlank = Boolean(document.getElementById("frame-b-thread")?.srcdoc);
  const slotDebug = window.TasuBuilderDualWindowBench?.logBenchSlotDebug?.("B", "verify:afterNotify") || "";
  const activeTab = window.TasuBuilderDualWindowBench?.getActiveTabId?.("B") || "";
  const slotLogs = [...document.querySelectorAll(".builder-bench-events li")].map(
    (li) => li.textContent || ""
  );
  const hasThreadTabInDebug = slotLogs.some((t) => {
    if (!t.includes("bench_slot_debug") || !t.includes("activeTab=thread")) return false;
    const m = t.match(/threadId=([^|]*)/);
    return m && !String(m[1] || "").trim();
  });
  const projectBeforeAccept = (() => {
    const fresh = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    return (fresh.projects || []).find((p) => p.project_id === projectId);
  })();
  return {
    ok: true,
    add,
    noProjectThread: !projectBeforeAccept?.main_thread_id && !ops.opsState.threadId,
    mainThreadBeforeAccept: projectBeforeAccept?.main_thread_id || "",
    calNotif: Boolean(calNotif),
    afterAddCalendarPage,
    afterAddActiveTab,
    bCalendarListAfterAdd,
    aCalendarTextAfterAdd,
    aCalendarAssignmentStored,
    bCalendarPage,
    bProjectTabActive,
    bCalendarPanelHidden,
    bProjectPanelVisible,
    bProjectPanelSized,
    bProjectPage,
    bProjectHasAssignment,
    bProjectHasId: slotDebug.includes("partner-assignment") && slotDebug.includes("projectId="),
    bThreadBlank,
    projectId: ops.opsState.projectId,
    slotDebug,
    activeTab,
    hasThreadTabInDebug,
    slotLogs,
    ctaNav,
  };
});

record("calendar add ok", preAccept?.ok === true, preAccept?.step || preAccept?.error || "");
record(
  "admin calendar btn triggers bench add",
  preAccept?.ok === true,
  preAccept?.step || preAccept?.error || ""
);
record(
  "B stays on calendar slot after add",
  preAccept?.afterAddCalendarPage === "builder-mvp-calendar" && preAccept?.afterAddActiveTab === "calendar"
);
record(
  "demo project id after add",
  preAccept?.projectId === "demo-thread-list-002"
);
record(
  "B calendar shows bench event after add",
  String(preAccept?.bCalendarListAfterAdd || "").includes("ベンチ検証 — 新宿区 外装足場工事")
);
record(
  "A calendar shows bench event after add",
  preAccept?.aCalendarAssignmentStored === true ||
    String(preAccept?.aCalendarTextAfterAdd || "").includes("ベンチ検証 — 新宿区 外装足場工事")
);
record(
  "B calendar iframe scrollable",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-calendar")?.contentDocument;
    const main = doc?.querySelector(".mvp-cal-main");
    const body = doc?.body;
    if (!main || !body) return false;
    const style = doc.defaultView?.getComputedStyle(main);
    const overflowY = style?.overflowY || "";
    const overflowOk = overflowY === "auto" || overflowY === "scroll";
    const hasPendingHint = (doc.querySelector(".mvp-cal-partnerSchedule__list")?.textContent || "").includes(
      "通知から案件を確認"
    );
    const before = main.scrollTop;
    main.scrollTop = main.scrollHeight;
    const scrolled = main.scrollTop > before || main.scrollHeight <= main.clientHeight + 4;
    const goEl = doc.querySelector(".mvp-cal-partnerSchedule__go");
    const goVisible =
      goEl &&
      goEl.getBoundingClientRect().top >= 0 &&
      goEl.getBoundingClientRect().bottom <= (doc.defaultView?.innerHeight || 0) + 2;
    return (
      overflowOk &&
      hasPendingHint &&
      body.classList.contains("builder-bench-embed") &&
      (scrolled || goVisible)
    );
  })
);
record(
  "A admin calendar ops schedule class",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-a-calendar")?.contentDocument;
    const body = doc?.body;
    if (!body?.classList.contains("builder-bench-embed")) return false;
    return (
      body.classList.contains("admin-cal--ops-schedule") &&
      !body.classList.contains("mvp-cal--partner-schedule") &&
      body.dataset.page === "builder-admin-calendar"
    );
  })
);
record(
  "A admin calendar shows ops UI",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-a-calendar")?.contentDocument;
    const body = doc?.body;
    if (!body) return false;
    const assignmentOpen = doc.querySelector("[data-admin-cal-assignment-open]");
    const detail = doc.querySelector(".admin-cal-detailPanel");
    const filters = doc.querySelector(".admin-cal-filters");
    const legend = doc.querySelector(".admin-cal-legend");
    const viewTabs = doc.querySelector(".admin-cal-viewTabs");
    const hasOpsGrid = !!doc.querySelector("[data-admin-cal-grid]");
    const hasPartnerPick = !!doc.querySelector(".admin-cal-partnerPick, .admin-cal-partnerSection");
    return (
      assignmentOpen?.offsetParent !== null &&
      detail?.offsetParent !== null &&
      filters?.offsetParent !== null &&
      legend?.offsetParent !== null &&
      viewTabs?.offsetParent !== null &&
      hasOpsGrid &&
      !body.classList.contains("mvp-cal--partner-schedule")
    );
  })
);
record(
  "B partner calendar scoped dark class",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-calendar")?.contentDocument;
    const body = doc?.body;
    if (!body) return false;
    const params = new URLSearchParams(doc.defaultView?.location?.search || "");
    return (
      body.dataset.page === "builder-mvp-calendar" &&
      body.classList.contains("mvp-cal--partner-schedule") &&
      !body.classList.contains("admin-cal--ops-schedule") &&
      params.get("role") === "partner" &&
      params.get("benchSide") === "B"
    );
  })
);
record("no project thread before accept", preAccept?.noProjectThread === true);
record(
  "B calendar CTA opens partner-assignment",
  preAccept?.ctaNav?.ok === true &&
    preAccept?.ctaNav?.activeTab === "project" &&
    preAccept?.ctaNav?.projectPage === "builder-partner-assignment" &&
    preAccept?.ctaNav?.hasAccept === true &&
    preAccept?.ctaNav?.hasDecline === true &&
    preAccept?.ctaNav?.projectId === "demo-thread-list-002",
  preAccept?.ctaNav?.error || ""
);
record("calendar notification exists", preAccept?.calNotif === true);
record("B project tab after notify", preAccept?.bProjectTabActive === true);
record("B activeTab project after notify", preAccept?.activeTab === "project");
record("B calendar panel hidden after notify", preAccept?.bCalendarPanelHidden === true);
record(
  "B project panel visible after notify",
  preAccept?.bProjectPanelVisible === true && preAccept?.bProjectPanelSized === true
);
record(
  "idle tabs hidden after notify click",
  await page.evaluate(() => !document.body.classList.contains("bench--ops-idle"))
);
record("B slot debug no thread tab", preAccept?.hasThreadTabInDebug !== true);
record(
  "B slot debug shows project",
  String(preAccept?.slotDebug || "").includes("activeTab=project") &&
    String(preAccept?.slotDebug || "").includes("partner-assignment")
);
record("B project partner-assignment", preAccept?.bProjectPage === "builder-partner-assignment");
record("B project assignment detail", preAccept?.bProjectHasAssignment === true);
record(
  "B project scrollable to actions",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-project")?.contentDocument;
    const win = doc?.defaultView;
    const main = doc?.querySelector(".partner-assignment-main");
    const accept = doc?.querySelector("[data-partner-assignment-accept]");
    const decline = doc?.querySelector("[data-partner-assignment-decline]");
    if (!main || !accept || !decline || !win) return false;
    const overflowY = win.getComputedStyle(main).overflowY;
    const before = main.scrollTop;
    main.scrollTop = main.scrollHeight;
    const scrolled = main.scrollTop > before || main.scrollHeight <= main.clientHeight + 4;
    const rect = accept.getBoundingClientRect();
    const acceptInView = rect.top >= 0 && rect.bottom <= win.innerHeight + 2;
    return (overflowY === "auto" || overflowY === "scroll") && scrolled && acceptInView;
  })
);
record("B project iframe projectId", preAccept?.bProjectHasId === true);
record("B thread blank before accept", preAccept?.bThreadBlank === true);

const cycle = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  if (!ops) return { ok: false, error: "no_bench" };
  const accept = await ops.opsPartnerAccept();
  if (!accept?.ok) return { ok: false, step: "accept", accept };
  await ops.opsPartnerEnter();
  await ops.opsPartnerExit();
  const complete = await ops.opsPartnerComplete();
  if (!complete?.ok) return { ok: false, step: "complete", complete };
  const approve = await ops.opsAdminApprove();
  if (!approve?.ok) return { ok: false, step: "approve", approve };
  return { ok: true, state: ops.opsState, diag: ops.runOpsDiagnostics() };
});

record("full cycle", cycle?.ok === true, cycle?.step || cycle?.error || "");
record("project id set", Boolean(preAccept?.projectId), preAccept?.projectId || "");
await page.waitForTimeout(800);
record("B thread tab after accept", await page.evaluate(() =>
  document.querySelector('.bench-col--b [data-builder-tab="thread"]')?.classList.contains("is-active")
));
await page.waitForTimeout(1200);
record(
  "B thread loaded after accept",
  await page.evaluate(() => {
    const doc = document.getElementById("frame-b-thread")?.contentDocument;
    return doc?.body?.dataset?.page === "builder-mvp-thread";
  })
);

const afterAccept = cycle?.state || {};
record("partner accepted", afterAccept.partnerDecision === "accepted", afterAccept.threadId || "");
record("thread created", Boolean(afterAccept.threadId));

const diag = cycle?.diag || {};

record("entry message", diag.entryMessageCreated === true);
record("exit message", diag.exitMessageCreated === true);
record("entry_at saved", diag.entry_at_saved === true);
record("exit_at saved", diag.exit_at_saved === true);
record("entry notification", diag.entry_notification_created === true);
record("exit notification", diag.exit_notification_created === true);
record("completion report", diag.completionReportCreated === true);
record("completion photo", diag.completionPhotoVisible === true);
record("admin approved", diag.adminApprovalCompleted === true);
record("thread remains", diag.thread_exists_after_complete === true);

const persist = await page.evaluate((tid) => {
  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const thread = mvp.threads?.[tid];
  const site = thread?.siteData || {};
  return {
    entry_at: site.entry_at,
    exit_at: site.exit_at,
    entry_user_id: site.entry_user_id,
    exit_user_id: site.exit_user_id,
    threadStatus: thread?.status,
    eventTypes: (thread?.events || []).map((e) => e.type),
  };
}, afterAccept.threadId || "");
record("entry_at persists", Boolean(persist.entry_at));
record("exit_at persists", Boolean(persist.exit_at));
record("entry_user_id", Boolean(persist.entry_user_id));
record("exit_user_id", Boolean(persist.exit_user_id));

});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("All ops_partner bench checks passed");
