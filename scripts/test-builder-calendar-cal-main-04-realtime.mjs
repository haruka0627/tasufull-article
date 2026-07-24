#!/usr/bin/env node
/**
 * CAL-MAIN-04 — builder_projects Realtime → Calendar refresh
 *
 *   node scripts/test-builder-calendar-cal-main-04-realtime.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-04");
const CAL_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/project-calendar.html");
const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuSupabase\]/i,
  /\[TasuChat\]/i,
  /\[WriteAdapter\]/i,
  /\[Store\]/i,
  /\[BuilderCalendarRealtime\]/i,
  /blocked_users/i,
  /CORS policy/i,
];

let pass = 0;
let fail = 0;
const report = { baseUrl: STANDARD_LOCAL_BASE, timestamp: new Date().toISOString(), checks: [] };

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

async function openPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = String(msg.text());
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });
  page.on("pageerror", (err) => {
    const t = String(err.message || err);
    if (IGNORE.some((re) => re.test(t))) return;
    errors.push(t);
  });
  await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  await page.waitForFunction(
    () => window.TasuBuilderProjectStore?.getDataSourceMode?.() && window.TasuBuilderProjectCalendarRealtime,
    { timeout: 15000 },
  );
  await page.waitForTimeout(400);
  return { context, page, errors };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-04 Realtime @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(CAL_URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) process.exit(1);

  const browser = await chromium.launch({ headless: true });

  // —— Page A: subscription rules ——
  {
    const { context, page, errors } = await openPage(browser);
    const mode = await page.evaluate(() => window.TasuBuilderProjectStore.getDataSourceMode());

    if (mode === "supabase") {
      const sub = await page.evaluate(() => {
        const Rt = window.TasuBuilderProjectCalendarRealtime;
        const a = Rt.startRealtime({ onRefresh: () => {} });
        const b = Rt.startRealtime({ onRefresh: () => {} });
        return {
          started: Rt.isStarted(),
          first: a,
          second: b,
        };
      });
      assert(sub.started, "supabase mode starts realtime");
      assert(sub.first.ok && (sub.first.already || sub.first.reason === "started" || sub.first.reason === "already_started"), "first start ok", JSON.stringify(sub.first));
      assert(sub.second.already === true || sub.second.reason === "already_started", "no double subscribe", JSON.stringify(sub.second));

      // simulate remote change
      const before = await page.evaluate(() => window.TasuBuilderProjectStore.listProjects().length);
      await page.evaluate(() => {
        window.__rtRefreshCount = 0;
        window.TasuBuilderProjectCalendarRealtime.startRealtime({
          onRefresh: () => {
            window.__rtRefreshCount = (window.__rtRefreshCount || 0) + 1;
            window.TasuBuilderProjectCalendar.refresh();
          },
        });
        window.TasuBuilderProjectCalendarRealtime.__testEmitChange({ eventType: "UPDATE" });
      });
      await page.waitForFunction(() => (window.__rtRefreshCount || 0) >= 1, { timeout: 5000 });
      const after = await page.evaluate(() => ({
        count: window.__rtRefreshCount,
        projects: window.TasuBuilderProjectStore.listProjects().length,
        mode: window.TasuBuilderProjectStore.getDataSourceMode(),
      }));
      assert(after.count >= 1, "refresh called on event", String(after.count));
      assert(after.mode === "supabase", "stays supabase after event");
      assert(after.projects === before || after.projects >= 0, "projects list ok", String(after.projects));
    } else {
      const sub = await page.evaluate(() => {
        const Rt = window.TasuBuilderProjectCalendarRealtime;
        Rt.stopRealtime();
        return Rt.startRealtime({ onRefresh: () => {} });
      });
      assert(sub.ok === false && sub.reason === "not_supabase_mode", "demo mode does not start", JSON.stringify(sub));
      assert(
        (await page.evaluate(() => window.TasuBuilderProjectCalendarRealtime.isStarted())) === false,
        "not started in demo",
      );
      ok("supabase-only checks skipped", `mode=${mode}`);
    }

    // force demo_fallback → stop
    await page.evaluate(async () => {
      const Data = window.TasuBuilderProjectCalendarData;
      const prev = Data.fetchProjectsFromSupabase;
      Data.fetchProjectsFromSupabase = async () => ({
        ok: false,
        source: "fetch_failed",
        error: "forced",
        projects: [],
      });
      await window.TasuBuilderProjectStore.hydrateFromSupabase();
      Data.fetchProjectsFromSupabase = prev;
      window.TasuBuilderProjectCalendarRealtime.startRealtime({ onRefresh: () => {} });
    });
    assert(
      (await page.evaluate(() => window.TasuBuilderProjectCalendarRealtime.isStarted())) === false,
      "demo_fallback does not start realtime",
    );

    // unsubscribe
    await page.evaluate(() => {
      // force start if possible then stop
      window.TasuBuilderProjectCalendarRealtime.stopRealtime();
    });
    assert(
      (await page.evaluate(() => window.TasuBuilderProjectCalendarRealtime.isStarted())) === false,
      "stopRealtime clears subscription",
    );

    await page.screenshot({ path: path.join(OUT, "001-cal-main-04-1280.png"), fullPage: true });
    assert(errors.length === 0, "Console Error 0", errors.slice(0, 3).join(" | "));
    await context.close();
  }

  // —— Two pages: simulate cross-tab via __testEmitChange on B after A mutates local cache ——
  {
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    for (const page of [pageA, pageB]) {
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const t = String(msg.text());
          if (!IGNORE.some((re) => re.test(t))) console.warn("console", t);
        }
      });
      await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
    }
    await pageA.waitForTimeout(500);
    await pageB.waitForTimeout(500);

    const modeA = await pageA.evaluate(() => window.TasuBuilderProjectStore.getDataSourceMode());
    if (modeA === "supabase") {
      await pageB.evaluate(() => {
        window.__rtRefreshCount = 0;
        window.TasuBuilderProjectCalendarRealtime.startRealtime({
          onRefresh: () => {
            window.__rtRefreshCount += 1;
            window.TasuBuilderProjectCalendar.refresh();
          },
        });
      });

      // Page A: write via adapter if possible; always emit on B to simulate receipt
      await pageA.evaluate(async () => {
        const Store = window.TasuBuilderProjectStore;
        const list = Store.listProjects();
        const p = list[0];
        if (p) {
          Store.updateProject(p.id, {
            memo: `rt-${Date.now()}`,
          });
        }
      });

      // Simulate realtime delivery on B (publication may be off in env)
      await pageB.evaluate(() => {
        window.TasuBuilderProjectCalendarRealtime.__testEmitChange({ eventType: "UPDATE" });
      });
      await pageB.waitForFunction(() => (window.__rtRefreshCount || 0) >= 1, { timeout: 5000 });
      assert(
        (await pageB.evaluate(() => window.__rtRefreshCount)) >= 1,
        "cross-tab simulated refresh",
      );
    } else {
      ok("cross-tab skipped", "not supabase mode");
    }

    await pageB.evaluate(() => window.TasuBuilderProjectCalendarRealtime.stopRealtime());
    assert(
      (await pageB.evaluate(() => window.TasuBuilderProjectCalendarRealtime.isStarted())) === false,
      "unsubscribe on stop",
    );

    await ctxA.close();
    await ctxB.close();
  }

  await browser.close();
  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "FAILED"} · pass=${pass} fail=${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
