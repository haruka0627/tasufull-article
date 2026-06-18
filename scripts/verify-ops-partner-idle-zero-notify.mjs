#!/usr/bin/env node
/**
 * ops_partner idle 初期状態 — 通知0件・Bカレンダー0件
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(90000);

const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });
await page.waitForTimeout(3000);

const idle = await page.evaluate(() => {
  const ops = window.TasuBuilderOpsPartnerBench;
  const diag = ops?.runOpsDiagnostics?.() || {};
  const talk = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const mvpNotifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const assignments = JSON.parse(
    localStorage.getItem("tasful:builder:admin:calendarAssignments:v1") || "[]"
  );
  const countFor = (uid) =>
    talk.filter((n) => String(n.recipientUserId || "") === uid).length;
  const aDoc = document.getElementById("frame-a-notify")?.contentDocument;
  const bDoc = document.getElementById("frame-b-notify")?.contentDocument;
  const bCalDoc = document.getElementById("frame-b-calendar")?.contentDocument;
  const aCards = aDoc?.querySelectorAll(".talk-notify-card, .builder-notification-card, [data-notification-id]")?.length || 0;
  const bCards = bDoc?.querySelectorAll(".talk-notify-card, .builder-notification-card, [data-notification-id]")?.length || 0;
  const bCalKpi = bCalDoc?.querySelector("[data-mvp-cal-partner-kpi]")?.textContent || "";
  const bCalItems = bCalDoc?.querySelectorAll("[data-mvp-cal-partner-accepted-list] li")?.length || 0;
  const events = window.TasuBuilderDualWindowBench?.getBenchEvents?.() || [];
  const meta = document.getElementById("builderBenchMeta")?.textContent || "";
  const bThreadSrc =
    document.getElementById("frame-b-thread")?.dataset?.currentSrc ||
    document.getElementById("frame-b-thread")?.getAttribute("src") ||
    "";
  const bProjectSrc =
    document.getElementById("frame-b-project")?.dataset?.currentSrc ||
    document.getElementById("frame-b-project")?.getAttribute("src") ||
    "";
  const aCalSrc =
    document.getElementById("frame-a-calendar")?.dataset?.currentSrc ||
    document.getElementById("frame-a-calendar")?.getAttribute("src") ||
    "";
  const bCalSrc =
    document.getElementById("frame-b-calendar")?.dataset?.currentSrc ||
    document.getElementById("frame-b-calendar")?.getAttribute("src") ||
    "";
  return {
    step: ops?.opsState?.currentStep || "",
    projectId: ops?.opsState?.projectId || "",
    threadId: ops?.opsState?.threadId || "",
    talkA: countFor("demo-owner-001"),
    talkB: countFor("demo-partner-001"),
    mvpNotifs: mvpNotifs.length,
    assignments: assignments.length,
    aCards,
    bCards,
    bCalKpi,
    bCalItems,
    diag,
    notificationCreatedEvent: events.some((e) => e.type === "notification_created"),
    meta,
    bThreadHasMvpThread: bThreadSrc.includes("mvp-thread.html"),
    bProjectHasDetail: bProjectSrc.includes("mvp-project-detail"),
    bootIdleDebug: meta.includes("source=bootIdle"),
    activeTabCalendar: meta.includes("activeTab=calendar"),
    activeTabNotThread: !meta.includes("activeTab=thread"),
    aCalAdmin: aCalSrc.includes("admin-calendar.html"),
    bCalPartner: bCalSrc.includes("mvp-calendar.html"),
    aCalNotProjectDetail: !aCalSrc.includes("mvp-project-detail"),
  };
});

record("idle step", idle.step === "idle", idle.step);
record("idle project empty", !idle.projectId, idle.projectId || "—");
record("idle thread empty", !idle.threadId, idle.threadId || "—");
record("idle talk A zero", idle.talkA === 0, String(idle.talkA));
record("idle talk B zero", idle.talkB === 0, String(idle.talkB));
record("idle mvp notifications zero", idle.mvpNotifs === 0, String(idle.mvpNotifs));
record("idle calendar assignments zero", idle.assignments === 0, String(idle.assignments));
record("idle A notify UI zero", idle.aCards === 0, String(idle.aCards));
record("idle B notify UI zero", idle.bCards === 0, String(idle.bCards));
record(
  "idle B calendar zero",
  idle.bCalItems === 0 && (idle.bCalKpi.includes("0件") || idle.bCalKpi === ""),
  `${idle.bCalKpi} items=${idle.bCalItems}`
);
record("diag idle_a_notify_zero", idle.diag.idle_a_notify_zero === true);
record("diag idle_b_notify_zero", idle.diag.idle_b_notify_zero === true);
record("diag idle_no_notification_created_event", idle.diag.idle_no_notification_created_event === true);
record("no notification_created event", !idle.notificationCreatedEvent);
record("boot debug source=bootIdle", idle.bootIdleDebug === true);
record("boot activeTab=calendar", idle.activeTabCalendar === true);
record("boot no mvp-thread iframe", !idle.bThreadHasMvpThread);
record("boot no mvp-project-detail iframe", !idle.bProjectHasDetail);
record("boot activeTab not thread", idle.activeTabNotThread === true);
record("A calendar is admin-calendar", idle.aCalAdmin === true);
record("B calendar is mvp-calendar", idle.bCalPartner === true);
record("A calendar not project-detail", idle.aCalNotProjectDetail === true);

await page.click("#opsAddCalendarBtn");
await page.waitForTimeout(3500);

const afterAdd = await page.evaluate(() => {
  const talk = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const mvpNotifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const bTalk = talk.filter((n) => String(n.recipientUserId || "") === "demo-partner-001");
  const calNotifs = mvpNotifs.filter((n) => n.type === "calendar_assignment");
  const bDoc = document.getElementById("frame-b-notify")?.contentDocument;
  const bText = bDoc?.body?.textContent || "";
  return {
    bTalkCount: bTalk.length,
    calNotifCount: calNotifs.length,
    bHasCalendarNotify: /現場予定|カレンダー|案件/.test(bText),
    step: window.TasuBuilderOpsPartnerBench?.opsState?.currentStep || "",
  };
});

record("after add B talk notify", afterAdd.bTalkCount >= 1 || afterAdd.calNotifCount >= 1, `talk=${afterAdd.bTalkCount} mvp=${afterAdd.calNotifCount}`);
record("after add step calendar_added", afterAdd.step === "calendar_added", afterAdd.step);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("ops_partner idle zero-notify checks passed");
