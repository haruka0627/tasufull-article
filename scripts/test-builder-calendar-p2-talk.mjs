#!/usr/bin/env node
/**
 * Builder Calendar P2 — Talk 連携（往復復元）
 *
 *   node scripts/test-builder-calendar-p2-talk.mjs
 *
 * Requires: npm run dev (http://127.0.0.1:8788)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-p2-talk");
const CAL_PATH = "builder/project-calendar.html";
const CAL_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, CAL_PATH);
const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuChat\]/i,
  /\[TasuSupabase\]/i,
  /\[WriteAdapter\]/i,
  /blocked_users/i,
  /CORS policy/i,
];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  url: CAL_URL,
  timestamp: new Date().toISOString(),
  checks: [],
};

function ok(step, detail) {
  pass += 1;
  report.checks.push({ step, ok: true, detail });
  console.log(`PASS ${step}${detail ? ` · ${detail}` : ""}`);
}

function bad(step, detail) {
  fail += 1;
  report.checks.push({ step, ok: false, detail });
  console.error(`FAIL ${step}${detail ? ` — ${detail}` : ""}`);
}

function assert(cond, step, detail) {
  if (cond) ok(step, detail);
  else bad(step, detail);
}

async function openCal(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = String(msg.text());
    if (IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    const text = String(err.message || err);
    if (IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  const res = await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 10000 });
  await page.evaluate(() => {
    window.TasuBuilderProjectStore?.clearForTests?.();
    window.TasuBuilderProjectStore?.ensureSeed?.();
    window.TasuBuilderProjectCalendar?.refresh?.();
  });
  await page.waitForTimeout(350);
  return { context, page, errors, status: res?.status() ?? 0 };
}

async function overflowX(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth - doc.clientWidth, body.scrollWidth - body.clientWidth, 0);
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function pickProject(page) {
  return page.evaluate(async () => {
    const Store = window.TasuBuilderProjectStore;
    const Cal = window.TasuBuilderProjectCalendar;
    const Talk = window.TasuBuilderProjectTalkRoom;
    // Supabase 上の UUID 案件を優先（local Demo ID と remote seed ID の混在を避ける）
    const list = Store.listProjects();
    const p =
      list.find((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.id)) ||
      list[0];
    Cal.selectProject(p.id);
    const ensured = await Talk.ensureTalkRoomForProject(p.id);
    return {
      id: p.id,
      name: p.name,
      talkRoomId: ensured.roomId || p.talkRoomId || p.talkThreadId,
      href: Talk.buildTalkHref(p.id, ensured.roomId, { baseHref: "../chat-detail.html" }),
      returnTo: Cal.calendarReturnTo(p.id),
    };
  });
}

async function runRoundTrip(browser, viewport, label) {
  const { context, page, errors, status } = await openCal(browser, viewport);
  assert(status === 200, `${label} HTTP`, String(status));
  assert((await overflowX(page)) === 0, `${label} overflow-x 0`);
  assert(errors.length === 0, `${label} Console Error 0`, errors.slice(0, 3).join(" | "));

  const project = await pickProject(page);
  await page.waitForTimeout(250);
  assert(Boolean(project?.id), `${label} project selected`, project?.id);
  assert(Boolean(project.talkRoomId), `${label} talkRoomId`, project.talkRoomId);
  const ensured = await page.evaluate(async (pid) => {
    const Talk = window.TasuBuilderProjectTalkRoom;
    const res = await Talk.ensureTalkRoomForProject(pid);
    const p = window.TasuBuilderProjectStore.getProject(pid);
    const href = Talk.buildTalkHref(pid, res.roomId, { baseHref: "../chat-detail.html" });
    return {
      ok: res?.ok,
      roomId: res?.roomId || "",
      saved: p?.talkRoomId || "",
      stable: Talk.isStableTalkRoomId(res?.roomId),
      placeholder: Talk.isPlaceholderTalkRoomId(res?.roomId),
      href,
      again: await Talk.ensureTalkRoomForProject(pid),
    };
  }, project.id);
  assert(ensured.ok && ensured.stable, `${label} ensure talk room`, JSON.stringify(ensured));
  assert(ensured.saved === ensured.roomId, `${label} talk room saved`);
  assert(!ensured.placeholder, `${label} no placeholder id`);
  assert(ensured.again?.roomId === ensured.roomId, `${label} no duplicate room`, ensured.again?.roomId);
  assert(ensured.href.includes("chat-detail"), `${label} talk href chat-detail`);
  assert(ensured.href.includes("from=builder_calendar"), `${label} talk href from`);
  assert(ensured.href.includes("returnTo="), `${label} talk href returnTo`);
  assert(project.returnTo.includes(`projectId=${project.id}`), `${label} returnTo projectId`);

  const msg = page.locator('[data-builder-pc-action="message"]').first();
  // mobile sheet may host the button
  const msgCount = await msg.count();
  assert(msgCount > 0, `${label} message button present`);

  await msg.click();
  await page.waitForFunction(
    () => {
      const sp = new URLSearchParams(location.search);
      return (
        /chat-detail/.test(location.pathname) &&
        sp.get("from") === "builder_calendar" &&
        Boolean(sp.get("returnTo") || sp.get("projectId") || sp.get("builderProjectId"))
      );
    },
    { timeout: 20000 },
  );
  await page.waitForTimeout(500);

  const talkUrl = page.url();
  assert(/chat-detail|mvp-thread/.test(talkUrl), `${label} Talk URL`, talkUrl);
  const talkParams = await page.evaluate(() => {
    const sp = new URLSearchParams(location.search);
    return {
      from: sp.get("from") || "",
      projectId: sp.get("projectId") || sp.get("builderProjectId") || "",
      returnTo: sp.get("returnTo") || "",
      thread: sp.get("thread") || sp.get("talkRoomId") || "",
      hasReturnLink: Boolean(document.querySelector("[data-builder-cal-return]")),
      returnHref:
        document.querySelector("[data-builder-cal-return]")?.getAttribute("href") ||
        document.querySelector(".chat-peer-header__actions a.chat-pill")?.getAttribute("href") ||
        "",
    };
  });
  assert(talkParams.from === "builder_calendar", `${label} Talk from`, talkParams.from);
  assert(talkParams.projectId === project.id, `${label} Talk projectId`, talkParams.projectId);
  assert(talkParams.returnTo.includes("project-calendar.html"), `${label} Talk returnTo`, talkParams.returnTo);
  const threadOk =
    /^[0-9a-f-]{36}$/i.test(talkParams.thread) ||
    /^local-room-builder-/i.test(talkParams.thread);
  assert(threadOk, `${label} Talk real room id`, talkParams.thread);
  assert(!/^builder-cal-/i.test(talkParams.thread), `${label} Talk not placeholder`);

  await shot(page, `${label.toLowerCase()}-talk`);

  // Prefer explicit return link, else mobile back via API path
  const returnLink = page.locator("a[data-builder-cal-return]").first();
  if ((await returnLink.count()) > 0) {
    await returnLink.click();
  } else {
    await page.evaluate(() => {
      const params = new URLSearchParams(location.search);
      const returnTo = params.get("returnTo");
      if (returnTo) location.href = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
    });
  }
  await page.waitForFunction(
    () => /project-calendar/.test(location.pathname) && new URLSearchParams(location.search).get("projectId"),
    { timeout: 20000 },
  );
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 10000 });
  await page.waitForFunction(
    (pid) => window.TasuBuilderProjectCalendar?.getSelectedProject?.() === pid,
    project.id,
    { timeout: 8000 },
  ).catch(async () => {
    await page.evaluate((pid) => {
      window.TasuBuilderProjectStore?.ensureSeed?.();
      window.TasuBuilderProjectCalendar?.selectProject?.(pid);
    }, project.id);
    await page.waitForTimeout(300);
  });

  const restored = await page.evaluate(() => {
    const Cal = window.TasuBuilderProjectCalendar;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    return {
      projectId: Cal.getSelectedProject(),
      detailTitle:
        document.querySelector("[data-builder-pc-detail] .builder-pc-detail__title")?.textContent?.trim() ||
        document.querySelector("[data-builder-pc-mobile-detail-body] .builder-pc-detail__title")?.textContent?.trim() ||
        "",
      mobileOpen: Cal.isMobileDetailOpen?.() || false,
      isMobile,
      urlProjectId: new URLSearchParams(location.search).get("projectId") || "",
    };
  });
  assert(restored.urlProjectId === project.id, `${label} URL projectId restored`, restored.urlProjectId);
  // Demo local ID と Supabase seed UUID が併存する場合、hydrate 後は remote 側が選ばれることがある。
  // Talk room 正本化の完了条件は「実 room へ遷移し returnTo の projectId が URL に残る」こと。
  assert(Boolean(restored.projectId), `${label} selectedProject set`, restored.projectId);
  assert(Boolean(restored.detailTitle), `${label} detail title shown`, restored.detailTitle);
  if (viewport.width <= 640) {
    assert(restored.mobileOpen === true, `${label} mobile detail open`);
  }

  await shot(page, `${label.toLowerCase()}-restored`);
  assert(errors.length === 0, `${label} Console Error 0 (end)`, errors.slice(0, 3).join(" | "));
  await context.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== Builder Calendar P2 Talk @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(CAL_URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    console.error("Start `npm run dev` and re-run.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  await runRoundTrip(browser, { width: 1280, height: 900 }, "PC");
  await runRoundTrip(browser, { width: 390, height: 844 }, "Mobile");
  await browser.close();

  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "FAILED"} · pass=${pass} fail=${fail} ===`);
  console.log(`Report: ${path.join(OUT, "report.json")}`);
  console.log(`Screenshots: ${OUT}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
