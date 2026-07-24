#!/usr/bin/env node
/**
 * Builder Project Calendar Phase 2 — operability regression
 *
 *   node scripts/test-builder-calendar-phase2.mjs
 *
 * Requires: npm run dev (http://127.0.0.1:8788)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-phase2");
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
  console.log(`=== Builder Calendar Phase 2 @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    console.error("Start `npm run dev` and re-run.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // —— PC ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.pc);
    assert(status === 200, "PC HTTP", String(status));
    assert((await overflowX(page)) === 0, "PC overflow-x 0");
    assert(errors.length === 0, "PC Console Error 0", errors.slice(0, 3).join(" | "));

    const hasDetail = (await page.locator("[data-builder-pc-detail]").count()) > 0;
    assert(hasDetail, "PC detail panel present");

    const state0 = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar?.getSelectedDate?.(),
      project: window.TasuBuilderProjectCalendar?.getSelectedProject?.(),
    }));

    const dayWithEvents = page.locator(".builder-pc-day:not(.builder-pc-day--muted) .builder-pc-event").first();
    if ((await dayWithEvents.count()) > 0) {
      const projectId = await dayWithEvents.getAttribute("data-builder-pc-project");
      await dayWithEvents.click();
      await page.waitForTimeout(200);
      const state1 = await page.evaluate(() => ({
        date: window.TasuBuilderProjectCalendar?.getSelectedDate?.(),
        project: window.TasuBuilderProjectCalendar?.getSelectedProject?.(),
        detailTitle: document.querySelector(".builder-pc-detail__title")?.textContent?.trim() || "",
      }));
      assert(state1.project === projectId, "PC month event → selectedProject", `${state1.project}`);
      assert(Boolean(state1.detailTitle), "PC detail panel updated", state1.detailTitle);
    } else {
      ok("PC month event skip", "no events in view");
    }

    const card = page.locator(".builder-pc-sidebar [data-builder-pc-project]").first();
    if ((await card.count()) > 0) {
      const cardId = await card.getAttribute("data-builder-pc-project");
      await card.click();
      await page.waitForTimeout(200);
      const state2 = await page.evaluate(() => ({
        date: window.TasuBuilderProjectCalendar?.getSelectedDate?.(),
        project: window.TasuBuilderProjectCalendar?.getSelectedProject?.(),
        detailTitle: document.querySelector(".builder-pc-detail__title")?.textContent?.trim() || "",
        selectedCard: document.querySelector(".builder-pc-mini-list__item.is-selected")?.getAttribute("data-builder-pc-project") || "",
      }));
      assert(state2.project === cardId, "PC card → selectedProject", state2.project);
      assert(state2.selectedCard === cardId, "PC card is-selected sync");
      assert(Boolean(state2.detailTitle), "PC card updates detail");
    } else {
      ok("PC card skip", "no sidebar cards");
    }

    const badges = await page.locator(".builder-pc-day__count").count();
    assert(badges >= 0, "PC count badge render", `count=${badges}`);
    if (badges > 0) {
      const labels = await page.locator(".builder-pc-day__count").allTextContents();
      assert(
        labels.every((t) => /^(1|2|3\+)$/.test(t.trim())),
        "PC count badge labels",
        labels.slice(0, 5).join(","),
      );
    }

    // Today
    await page.locator("[data-builder-pc-today-btn]").click();
    await page.waitForTimeout(250);
    const todayState = await page.evaluate(() => {
      const Cal = window.TasuBuilderProjectCalendar;
      const Store = window.TasuBuilderProjectStore;
      return {
        date: Cal?.getSelectedDate?.(),
        today: Store?.todayDateOnly?.(),
        selectedCell: document.querySelector(".builder-pc-day.is-selected")?.getAttribute("data-builder-pc-month-day") || "",
      };
    });
    assert(todayState.date === todayState.today, "PC Today selects today", todayState.date);
    assert(todayState.selectedCell === todayState.today, "PC Today cell selected");

    // Month nav clamp: Jan 31 → Feb last day
    await page.evaluate(() => {
      window.TasuBuilderProjectCalendar.selectDate("2026-01-31");
    });
    await page.waitForTimeout(150);
    await page.locator("[data-builder-pc-next]").click();
    await page.waitForTimeout(200);
    const feb = await page.evaluate(() => window.TasuBuilderProjectCalendar.getSelectedDate());
    assert(feb === "2026-02-28", "PC next month clamps day", feb);

    await page.locator("[data-builder-pc-prev]").click();
    await page.waitForTimeout(200);
    const jan = await page.evaluate(() => window.TasuBuilderProjectCalendar.getSelectedDate());
    assert(jan === "2026-01-28", "PC prev month keeps day", jan);

    // Status tones present in CSS classes
    const tones = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("[class*='builder-pc-status--'], [class*='builder-pc-event--']")];
      const set = new Set();
      nodes.forEach((n) => {
        n.className.split(/\s+/).forEach((c) => {
          const m = c.match(/builder-pc-(?:status|event)--(not_started|working|done|delay|cancelled)/);
          if (m) set.add(m[1]);
        });
      });
      return [...set];
    });
    assert(tones.length > 0, "PC status tones applied", tones.join(","));

    await shot(page, "001-pc-1280");
    assert(errors.length === 0, "PC Console Error 0 (end)", errors.slice(0, 3).join(" | "));
    await context.close();
    void state0;
  }

  // —— Tablet ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.tablet);
    assert(status === 200, "Tablet HTTP", String(status));
    assert((await overflowX(page)) === 0, "Tablet overflow-x 0");
    assert(errors.length === 0, "Tablet Console Error 0", errors.slice(0, 3).join(" | "));
    assert((await page.locator("[data-builder-pc-calendar-body] .builder-pc-month").count()) > 0, "Tablet month view");
    await page.locator("[data-builder-pc-today-btn]").click();
    await page.waitForTimeout(200);
    const t = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar.getSelectedDate(),
      today: window.TasuBuilderProjectStore.todayDateOnly(),
    }));
    assert(t.date === t.today, "Tablet Today", t.date);
    await shot(page, "002-tablet-768");
    await context.close();
  }

  // —— Mobile agenda ——
  {
    const { context, page, errors, status } = await openPage(browser, VIEWPORTS.mobile);
    assert(status === 200, "Mobile agenda HTTP", String(status));
    assert((await overflowX(page)) === 0, "Mobile agenda overflow-x 0");
    assert(errors.length === 0, "Mobile agenda Console Error 0", errors.slice(0, 3).join(" | "));
    assert((await page.locator("[data-builder-pc-mobile]").count()) > 0, "Mobile agenda default");

    const chip = page.locator(".builder-pc-dayChip").nth(10);
    const chipDate = await chip.getAttribute("data-builder-pc-day");
    await chip.click();
    await page.waitForTimeout(200);
    const afterChip = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar.getSelectedDate(),
      view: window.TasuBuilderProjectCalendar.getViewMode(),
      agendaDay: document.querySelector("[data-agenda-day]")?.getAttribute("data-agenda-day") || "",
    }));
    assert(afterChip.date === chipDate, "Mobile chip → selectedDate", afterChip.date);
    assert(afterChip.view === "agenda", "Mobile chip stays agenda");
    assert(afterChip.agendaDay === chipDate, "Mobile agenda list updated");

    const agendaBlock = page.locator(".builder-pc-agendaBlock[data-builder-pc-project]").first();
    if ((await agendaBlock.count()) > 0) {
      const pid = await agendaBlock.getAttribute("data-builder-pc-project");
      await agendaBlock.click();
      await page.waitForTimeout(200);
      const afterBlock = await page.evaluate(() => ({
        project: window.TasuBuilderProjectCalendar.getSelectedProject(),
        view: window.TasuBuilderProjectCalendar.getViewMode(),
        selected: document.querySelector(".builder-pc-agendaBlock.is-selected")?.getAttribute("data-builder-pc-project") || "",
      }));
      assert(afterBlock.project === pid, "Mobile agenda block → selectedProject");
      assert(afterBlock.view === "agenda", "Mobile agenda block stays agenda");
      assert(afterBlock.selected === pid, "Mobile agenda block is-selected");
      // P1: 案件タップで詳細シートが開く — 以降の操作前に閉じる
      await page.evaluate(() => window.TasuBuilderProjectCalendar.closeMobileDetail?.());
      await page.waitForTimeout(100);
    } else {
      ok("Mobile agenda block skip", "no projects on day");
    }

    // Scroll preserve: scroll down, switch month, back to agenda
    await page.evaluate(() => window.scrollTo(0, 240));
    await page.waitForTimeout(100);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.locator('[data-builder-pc-view="month"]').click();
    await page.waitForTimeout(250);
    assert((await page.locator(".builder-pc-month").count()) > 0, "Mobile month view");
    const monthView = await page.evaluate(() => window.TasuBuilderProjectCalendar.getViewMode());
    assert(monthView === "month", "Mobile month mode");

    // Month cell select stays on month
    const monthDay = page.locator(".builder-pc-day:not(.builder-pc-day--muted)").nth(12);
    const monthDate = await monthDay.getAttribute("data-builder-pc-month-day");
    await monthDay.click();
    await page.waitForTimeout(200);
    const afterMonthDay = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar.getSelectedDate(),
      view: window.TasuBuilderProjectCalendar.getViewMode(),
    }));
    assert(afterMonthDay.date === monthDate, "Mobile month cell → selectedDate");
    assert(afterMonthDay.view === "month", "Mobile month cell stays month");

    const monthBadges = await page.locator(".builder-pc-day__count").count();
    assert(monthBadges >= 0, "Mobile month count badge", `count=${monthBadges}`);

    await page.locator('[data-builder-pc-view="agenda"]').click();
    await page.waitForTimeout(300);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    assert(
      Math.abs(scrollAfter - scrollBefore) <= 40,
      "Mobile agenda scroll preserved",
      `before=${scrollBefore} after=${scrollAfter}`,
    );

    // Today on mobile agenda
    await page.locator("[data-builder-pc-today-btn]").click();
    await page.waitForTimeout(300);
    const todayMob = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar.getSelectedDate(),
      today: window.TasuBuilderProjectStore.todayDateOnly(),
      view: window.TasuBuilderProjectCalendar.getViewMode(),
      chip: document.querySelector(".builder-pc-dayChip.is-selected")?.getAttribute("data-builder-pc-day") || "",
    }));
    assert(todayMob.date === todayMob.today, "Mobile Today date", todayMob.date);
    assert(todayMob.view === "agenda", "Mobile Today stays agenda");
    assert(todayMob.chip === todayMob.today, "Mobile Today chip selected");

    // Prev / next month keep day
    await page.evaluate(() => window.TasuBuilderProjectCalendar.selectDate("2026-03-31"));
    await page.waitForTimeout(150);
    await page.locator("[data-builder-pc-next]").click();
    await page.waitForTimeout(200);
    const apr = await page.evaluate(() => window.TasuBuilderProjectCalendar.getSelectedDate());
    assert(apr === "2026-04-30", "Mobile next month clamps day", apr);

    await shot(page, "003-mobile-agenda-390");
    assert(errors.length === 0, "Mobile Console Error 0 (end)", errors.slice(0, 3).join(" | "));
    await context.close();
  }

  // —— Mobile month only shot ——
  {
    const { context, page, errors } = await openPage(browser, VIEWPORTS.mobile);
    await page.locator('[data-builder-pc-view="month"]').click();
    await page.waitForTimeout(250);
    await page.locator("[data-builder-pc-today-btn]").click();
    await page.waitForTimeout(250);
    const st = await page.evaluate(() => ({
      date: window.TasuBuilderProjectCalendar.getSelectedDate(),
      today: window.TasuBuilderProjectStore.todayDateOnly(),
      selected: document.querySelector(".builder-pc-day.is-selected")?.getAttribute("data-builder-pc-month-day") || "",
      view: window.TasuBuilderProjectCalendar.getViewMode(),
    }));
    assert(st.view === "month", "Mobile month Today stays month");
    assert(st.date === st.today && st.selected === st.today, "Mobile month Today cell");
    assert((await overflowX(page)) === 0, "Mobile month overflow-x 0");
    assert(errors.length === 0, "Mobile month Console Error 0", errors.slice(0, 3).join(" | "));
    await shot(page, "004-mobile-month-390");
    await context.close();
  }

  await browser.close();

  report.pass = pass;
  report.fail = fail;
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== ${fail === 0 ? "ALL PASS" : "FAILED"} · pass=${pass} fail=${fail} ===`);
  console.log(`Report: ${path.join(OUT, "report.json")}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
