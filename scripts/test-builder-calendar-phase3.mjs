#!/usr/bin/env node
/**
 * Builder Project Calendar Phase 3 — UI polish regression
 *
 *   node scripts/test-builder-calendar-phase3.mjs
 *
 * Requires: npm run dev (http://127.0.0.1:8788)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-phase3");
const PAGE_PATH = "builder/project-calendar.html";
const URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, PAGE_PATH);

const VIEWPORTS = {
  pc: { name: "1280", width: 1280, height: 900 },
  tablet: { name: "768", width: 768, height: 1024 },
  mobile: { name: "390", width: 390, height: 844 },
};

const IGNORE = [/favicon/i, /Failed to load resource/i, /net::ERR_/i, /CDN|fonts\.g|placehold/i];

let pass = 0;
let fail = 0;
const report = {
  baseUrl: STANDARD_LOCAL_BASE,
  url: URL,
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

async function openPage(browser, viewport) {
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
  const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 10000 });
  await page.waitForTimeout(400);
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== Builder Calendar Phase 3 @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    console.error("Start `npm run dev` and re-run.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // —— PC: 右パネル要約 ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.pc);
    assert(status === 200, "PC HTTP", String(status));
    assert((await overflowX(page)) === 0, "PC overflow-x 0");
    assert(errors.length === 0, "PC Console Error 0", errors.slice(0, 3).join(" | "));

    await page.evaluate(() => window.TasuBuilderProjectCalendar.clearSelection());
    await page.waitForTimeout(200);

    const summary = await page.evaluate(() => {
      const host = document.querySelector("[data-builder-pc-detail-summary]");
      if (!host) return null;
      const Store = window.TasuBuilderProjectStore;
      return {
        title: host.querySelector(".builder-pc-detail__summaryTitle")?.textContent?.trim() || "",
        hint: host.querySelector(".builder-pc-detail__summaryHint")?.textContent?.trim() || "",
        today: host.querySelector("[data-builder-pc-summary-today]")?.textContent?.trim() || "",
        week: host.querySelector("[data-builder-pc-summary-week]")?.textContent?.trim() || "",
        delayed: host.querySelector("[data-builder-pc-summary-delayed]")?.textContent?.trim() || "",
        expectToday: `${Store.getTodayProjects().length}件`,
        expectWeek: `${Store.getThisWeekProjects().length}件`,
        expectDelayed: `${Store.getDelayedProjects().length}件`,
        emptyMsg: host.textContent?.includes("カレンダーから案件を選択してください") || false,
      };
    });
    assert(Boolean(summary), "PC summary card present");
    assert(summary?.title === "案件詳細", "PC summary title", summary?.title);
    assert(summary?.today === summary?.expectToday, "PC today count", summary?.today);
    assert(summary?.week === summary?.expectWeek, "PC week count", summary?.week);
    assert(summary?.delayed === summary?.expectDelayed, "PC delayed count", summary?.delayed);
    assert(summary?.hint.includes("案件を選択すると"), "PC summary hint");
    assert(!summary?.emptyMsg, "PC no blank-only empty message");

    await shot(page, "001-pc-summary-1280");

    const event = page.locator(".builder-pc-day:not(.builder-pc-day--muted) .builder-pc-event").first();
    if ((await event.count()) > 0) {
      await event.click();
      await page.waitForTimeout(200);
      const detail = await page.evaluate(() => ({
        hasSummary: Boolean(document.querySelector("[data-builder-pc-detail-summary]")),
        title: document.querySelector(".builder-pc-detail__title")?.textContent?.trim() || "",
      }));
      assert(!detail.hasSummary, "PC select hides summary");
      assert(Boolean(detail.title), "PC select shows project detail", detail.title);
      await shot(page, "002-pc-detail-1280");
    } else {
      ok("PC select skip", "no events");
    }

    assert(errors.length === 0, "PC Console Error 0 (end)", errors.slice(0, 3).join(" | "));
    await context.close();
  }

  // —— Tablet ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.tablet);
    assert(status === 200, "Tablet HTTP", String(status));
    assert((await overflowX(page)) === 0, "Tablet overflow-x 0");
    assert(errors.length === 0, "Tablet Console Error 0", errors.slice(0, 3).join(" | "));
    await page.evaluate(() => window.TasuBuilderProjectCalendar.clearSelection());
    await page.waitForTimeout(200);
    assert((await page.locator("[data-builder-pc-detail-summary]").count()) > 0, "Tablet summary card");
    await shot(page, "003-tablet-768");
    await context.close();
  }

  // —— Mobile 一覧 Accordion ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.mobile);
    assert(status === 200, "Mobile agenda HTTP", String(status));
    assert((await overflowX(page)) === 0, "Mobile agenda overflow-x 0");
    assert(errors.length === 0, "Mobile agenda Console Error 0", errors.slice(0, 3).join(" | "));

    const initial = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("[data-builder-pc-accordion]")];
      return {
        keys: sections.map((s) => s.getAttribute("data-builder-pc-accordion")),
        open: sections.map((s) => s.classList.contains("is-open")),
        markers: sections.map((s) => s.querySelector(".builder-pc-accordion__marker")?.textContent?.trim()),
        state: window.TasuBuilderProjectCalendar.getAccordionState(),
      };
    });
    assert(initial.keys.join(",") === "today,week,delayed", "Mobile accordion sections", initial.keys.join(","));
    assert(initial.open[0] === true, "Mobile today open by default");
    assert(initial.open[1] === false, "Mobile week closed by default");
    assert(initial.open[2] === false, "Mobile delayed closed by default");
    assert(initial.markers[0] === "▼" && initial.markers[1] === "▶" && initial.markers[2] === "▶", "Mobile markers");

    // Toggle week open
    await page.locator('[data-builder-pc-accordion-toggle="week"]').click();
    await page.waitForTimeout(200);
    let afterWeek = await page.evaluate(() => window.TasuBuilderProjectCalendar.getAccordionState());
    assert(afterWeek.week === true && afterWeek.today === true, "Mobile week toggle open", JSON.stringify(afterWeek));

    // Toggle today closed (multiple open allowed — week stays open)
    await page.locator('[data-builder-pc-accordion-toggle="today"]').click();
    await page.waitForTimeout(200);
    afterWeek = await page.evaluate(() => window.TasuBuilderProjectCalendar.getAccordionState());
    assert(afterWeek.today === false && afterWeek.week === true, "Mobile multi-open ok", JSON.stringify(afterWeek));

    // Open delayed too
    await page.locator('[data-builder-pc-accordion-toggle="delayed"]').click();
    await page.waitForTimeout(200);
    const multi = await page.evaluate(() => window.TasuBuilderProjectCalendar.getAccordionState());
    assert(multi.week && multi.delayed && !multi.today, "Mobile delayed open", JSON.stringify(multi));

    await shot(page, "004-mobile-agenda-accordion-390");

    // 状態保持: 月へ切替 → 一覧へ戻る
    await page.locator('[data-builder-pc-view="month"]').click();
    await page.waitForTimeout(250);
    assert((await page.locator(".builder-pc-month").count()) > 0, "Mobile month view");

    // 件数 Badge: 0件の日は非表示
    const badgeCheck = await page.evaluate(() => {
      const days = [...document.querySelectorAll(".builder-pc-day:not(.builder-pc-day--muted)")];
      let withBadge = 0;
      let zeroWithBadge = 0;
      let zeroWithout = 0;
      days.forEach((day) => {
        const events = day.querySelectorAll(".builder-pc-event").length;
        const more = day.querySelector(".builder-pc-event-more");
        const badge = day.querySelector(".builder-pc-day__count");
        const hasProjects = events > 0 || Boolean(more);
        if (badge) {
          withBadge += 1;
          const label = badge.textContent?.trim() || "";
          if (!/^(1|2|3\+)$/.test(label)) zeroWithBadge += 1;
          if (!hasProjects) zeroWithBadge += 1;
        } else if (!hasProjects) {
          zeroWithout += 1;
        }
      });
      return { withBadge, zeroWithBadge, zeroWithout, total: days.length };
    });
    assert(badgeCheck.zeroWithBadge === 0, "Mobile month badge only when projects", JSON.stringify(badgeCheck));
    assert(badgeCheck.zeroWithout > 0 || badgeCheck.withBadge > 0, "Mobile month badge coverage", JSON.stringify(badgeCheck));

    await shot(page, "005-mobile-month-390");

    await page.locator('[data-builder-pc-view="agenda"]').click();
    await page.waitForTimeout(300);
    const preserved = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("[data-builder-pc-accordion]")];
      return {
        state: window.TasuBuilderProjectCalendar.getAccordionState(),
        open: sections.map((s) => s.classList.contains("is-open")),
        markers: sections.map((s) => s.querySelector(".builder-pc-accordion__marker")?.textContent?.trim()),
      };
    });
    assert(
      preserved.state.today === false && preserved.state.week === true && preserved.state.delayed === true,
      "Mobile accordion state preserved",
      JSON.stringify(preserved.state),
    );
    assert(
      preserved.open.join(",") === "false,true,true",
      "Mobile accordion DOM preserved",
      preserved.open.join(","),
    );
    assert(
      preserved.markers.join(",") === "▶,▼,▼",
      "Mobile accordion markers preserved",
      preserved.markers.join(","),
    );

    await shot(page, "006-mobile-agenda-preserved-390");
    assert(errors.length === 0, "Mobile Console Error 0 (end)", errors.slice(0, 3).join(" | "));
    await context.close();
  }

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
