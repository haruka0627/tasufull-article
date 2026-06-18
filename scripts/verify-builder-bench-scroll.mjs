#!/usr/bin/env node
/**
 * Builder 2窓ベンチ — 下段 iframe 縦スクロール検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function scrollProbe(doc, selector) {
  const win = doc?.defaultView;
  const scrollEl =
    doc?.querySelector(".builder-bench-scroll") ||
    doc?.querySelector("main") ||
    doc?.body;
  const target = doc?.querySelector(selector);
  if (!scrollEl || !target || !win) return { ok: false, error: "missing" };
  const overflowY = win.getComputedStyle(scrollEl).overflowY;
  const before = scrollEl.scrollTop;
  scrollEl.scrollTop = scrollEl.scrollHeight;
  const scrolled = scrollEl.scrollTop > before || scrollEl.scrollHeight <= scrollEl.clientHeight + 4;
  const rect = target.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= win.innerHeight + 2;
  return {
    ok: (overflowY === "auto" || overflowY === "scroll") && scrolled && inView,
    overflowY,
    scrolled,
    inView,
    scrollTop: scrollEl.scrollTop,
    scrollHeight: scrollEl.scrollHeight,
    clientHeight: scrollEl.clientHeight,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`;
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });

const tabNames = await page.evaluate(() => {
  const threadTab = document.querySelector('.bench-col--b [data-builder-tab="thread"]');
  return { threadTab: threadTab?.textContent?.trim() || "" };
});
record("ops_partner thread tab label", tabNames.threadTab === "現場連絡", tabNames.threadTab);

const audit = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  const bench = window.TasuBuilderDualWindowBench;
  await ops.opsAddCalendar();
  await new Promise((r) => setTimeout(r, 800));

  function probeFrame(frameId, selector) {
    const doc = document.getElementById(frameId)?.contentDocument;
    const win = doc?.defaultView;
    const scrollEl = doc?.querySelector(".builder-bench-scroll") || doc?.querySelector("main") || doc?.body;
    const target = doc?.querySelector(selector);
    if (!scrollEl || !target || !win) return { ok: false, error: "missing" };
    const overflowY = win.getComputedStyle(scrollEl).overflowY;
    const header = doc?.querySelector(".builder-header");
    const headerPos = header ? win.getComputedStyle(header).position : "";
    const before = scrollEl.scrollTop;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    const scrolled = scrollEl.scrollTop > before || scrollEl.scrollHeight <= scrollEl.clientHeight + 4;
    const rect = target.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < win.innerHeight;
    return {
      ok: (overflowY === "auto" || overflowY === "scroll") && scrolled && inView,
      overflowY,
      headerPos,
      scrolled,
      inView,
      benchEmbed: doc?.body?.classList.contains("builder-bench-embed"),
    };
  }

  const bCal = probeFrame("frame-b-calendar", "[data-mvp-cal-open-assignment], .mvp-cal-partnerSchedule__go");
  const aCal = probeFrame("frame-a-calendar", "[data-admin-cal-detail]");

  const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const cal = notifs.find((n) => n.type === "calendar_assignment");
  bench.handleNotificationNavigate({
    href: cal.href,
    notificationId: cal.id,
    side: "B",
    slot: "project",
  });
  await new Promise((r) => setTimeout(r, 500));
  const bProject = probeFrame("frame-b-project", "[data-partner-assignment-accept]");

  await ops.opsPartnerAccept();
  for (let i = 0; i < 50; i += 1) {
    await new Promise((r) => setTimeout(r, 200));
    const doc = document.getElementById("frame-b-thread")?.contentDocument;
    if (doc?.querySelector("[data-builder-mvp-thread-complete-open]")) break;
  }
  const bThreadDoc = document.getElementById("frame-b-thread")?.contentDocument;
  const bThreadWin = bThreadDoc?.defaultView;
  const bThreadMain = bThreadDoc?.querySelector(".mvp-slack-thread");
  const bThreadComplete = bThreadDoc?.querySelector("[data-builder-mvp-thread-complete-open]");
  const bThreadBody = bThreadDoc?.querySelector(".mvp-slack-thread__body");
  const bThreadCompose = bThreadDoc?.querySelector(".mvp-slack-thread__compose");
  let bThread = { ok: false, error: "missing" };
  if (bThreadMain && bThreadComplete && bThreadBody && bThreadCompose && bThreadWin) {
    await new Promise((r) => setTimeout(r, 300));
    bThreadMain.scrollTop = 0;
    const completeRect = bThreadComplete.getBoundingClientRect();
    const completeVisible =
      completeRect.bottom > 0 && completeRect.top < bThreadWin.innerHeight;
    const before = bThreadBody.scrollTop;
    bThreadBody.scrollTop = bThreadBody.scrollHeight;
    const bodyScrolled =
      bThreadBody.scrollTop > before || bThreadBody.scrollHeight <= bThreadBody.clientHeight + 4;
    const composeRect = bThreadCompose.getBoundingClientRect();
    const composeVisible =
      composeRect.bottom > 0 &&
      composeRect.top < bThreadWin.innerHeight &&
      composeRect.bottom <= bThreadWin.innerHeight + 2;
    bThread = {
      ok: completeVisible && bodyScrolled && composeVisible,
      completeVisible,
      bodyScrolled,
      composeVisible,
      headerPos: bThreadWin.getComputedStyle(bThreadDoc.querySelector(".builder-header")).position,
    };
  }

  const iframeClass = document.getElementById("frame-b-project")?.classList.contains("builder-bench-frame");

  return { bCal, aCal, bProject, bThread, iframeClass };
});

record("builder-bench-frame class on project iframe", audit.iframeClass === true);
record("B mvp-calendar scroll to CTA", audit.bCal?.ok === true, JSON.stringify(audit.bCal));
record("A admin-calendar scroll to detail panel", audit.aCal?.ok === true, JSON.stringify(audit.aCal));
record("B partner-assignment scroll to accept", audit.bProject?.ok === true, JSON.stringify(audit.bProject));
record(
  "B mvp-thread header actions and compose visible",
  audit.bThread?.ok === true,
  JSON.stringify(audit.bThread)
);
record(
  "bench embed headers not fixed",
  [audit.bCal, audit.aCal, audit.bProject, audit.bThread].every(
    (p) => !p?.headerPos || p.headerPos === "static"
  )
);

const passed = results.filter((r) => r.ok).length;
const total = results.length;
console.log(`\n${passed}/${total} passed`);
await browser.close();
process.exit(passed === total ? 0 : 1);
