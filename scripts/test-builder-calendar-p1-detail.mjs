#!/usr/bin/env node
/**
 * Builder Calendar P1 — 案件詳細強化（現場アクション）
 *
 *   node scripts/test-builder-calendar-p1-detail.mjs
 *
 * Requires: npm run dev (http://127.0.0.1:8788)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-p1-detail");
const PAGE_PATH = "builder/project-calendar.html";
const URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, PAGE_PATH);

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
  await page.evaluate(() => {
    window.TasuBuilderProjectStore?.clearForTests?.();
    window.TasuBuilderProjectStore?.ensureSeed?.();
    window.TasuBuilderProjectCalendar?.refresh?.();
  });
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

async function selectAnyProject(page) {
  return page.evaluate(() => {
    const Store = window.TasuBuilderProjectStore;
    const Cal = window.TasuBuilderProjectCalendar;
    const list = Store.listScheduledProjects();
    const p = list.find((x) => x.siteAddress || x.estimate?.customerAddress) || list[0];
    if (!p) return null;
    Cal.selectProject(p.id);
    return {
      id: p.id,
      name: p.name,
      address: p.siteAddress || p.estimate?.customerAddress || "",
      phone: p.managerPhone || p.customerContact || "",
      talkThreadId: p.talkThreadId || "",
    };
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== Builder Calendar P1 Detail @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(URL).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    console.error("Start `npm run dev` and re-run.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // —— PC 1280 ——
  {
    const { context, page, errors, status } = await openPage(browser, { width: 1280, height: 900 });
    assert(status === 200, "PC HTTP", String(status));
    assert((await overflowX(page)) === 0, "PC overflow-x 0");
    assert(errors.length === 0, "PC Console Error 0", errors.slice(0, 3).join(" | "));

    const project = await selectAnyProject(page);
    await page.waitForTimeout(250);
    assert(Boolean(project), "PC project selected", project?.id);

    const detail = await page.evaluate(() => {
      const host = document.querySelector("[data-builder-pc-detail]");
      const title = host?.querySelector(".builder-pc-detail__title")?.textContent?.trim() || "";
      const fields = {
        address: host?.querySelector('[data-builder-pc-field="address"]')?.textContent?.trim() || "",
        manager: host?.querySelector('[data-builder-pc-field="manager"]')?.textContent?.trim() || "",
        phone: host?.querySelector('[data-builder-pc-field="phone"]')?.textContent?.trim() || "",
        memo: host?.querySelector('[data-builder-pc-field="memo"]')?.textContent?.trim() || "",
      };
      const actions = [...(host?.querySelectorAll("[data-builder-pc-action]") || [])].map((el) => ({
        action: el.getAttribute("data-builder-pc-action"),
        href: el.getAttribute("href") || "",
        tag: el.tagName.toLowerCase(),
        disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
      }));
      return { title, fields, actions };
    });

    assert(detail.title === project.name, "PC detail title", detail.title);
    assert(Boolean(detail.fields.address) && detail.fields.address !== "—", "PC address field", detail.fields.address);
    assert(Boolean(detail.fields.manager), "PC manager field", detail.fields.manager);
    assert(Boolean(detail.fields.phone), "PC phone field", detail.fields.phone);

    const byAction = Object.fromEntries(detail.actions.map((a) => [a.action, a]));
    assert(Boolean(byAction.map), "PC GoogleMap action");
    assert(
      byAction.map?.href.includes("google.com/maps/search") &&
        byAction.map.href.includes("query=") &&
        decodeURIComponent(byAction.map.href).includes(project.address.slice(0, 8)),
      "PC GoogleMap URL",
      byAction.map?.href,
    );
    assert(Boolean(byAction.nav), "PC nav action");
    assert(
      byAction.nav?.href.includes("google.com/maps/dir") && byAction.nav.href.includes("destination="),
      "PC nav URL",
      byAction.nav?.href,
    );
    assert(Boolean(byAction.tel), "PC tel action");
    assert(byAction.tel?.href.startsWith("tel:"), "PC tel link", byAction.tel?.href);
    assert(Boolean(byAction.message), "PC message entry");
    const talkReady = await page.evaluate(async (pid) => {
      const Talk = window.TasuBuilderProjectTalkRoom;
      const res = await Talk.ensureTalkRoomForProject(pid);
      const p = window.TasuBuilderProjectStore.getProject(pid);
      return {
        ok: res?.ok,
        roomId: res?.roomId || "",
        saved: p?.talkRoomId || "",
        placeholder: Talk.isPlaceholderTalkRoomId(res?.roomId),
        stable: Talk.isStableTalkRoomId(res?.roomId),
      };
    }, project.id);
    assert(talkReady.ok && talkReady.stable, "PC talk room ensure", JSON.stringify(talkReady));
    assert(talkReady.saved === talkReady.roomId, "PC talk room persisted", talkReady.saved);
    assert(!talkReady.placeholder, "PC no placeholder room id");
    assert(Boolean(byAction.attachments), "PC attachments entry");
    assert(Boolean(byAction.photos), "PC photos entry");
    assert(Boolean(byAction.completion), "PC completion entry");

    await shot(page, "001-pc-detail-1280");

    await page.locator('[data-builder-pc-action="attachments"]').click();
    await page.waitForTimeout(200);
    const attachView = await page.evaluate(() => ({
      mode: window.TasuBuilderProjectCalendar.getDetailViewMode(),
      empty: Boolean(document.querySelector("[data-builder-pc-attachments-empty]")),
      list: Boolean(document.querySelector("[data-builder-pc-attachments-list]")),
    }));
    assert(attachView.mode === "attachments", "PC attachments view");
    assert(attachView.empty || attachView.list, "PC attachments content");

    await page.locator('[data-builder-pc-detail-nav="main"]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-builder-pc-action="photos"]').click();
    await page.waitForTimeout(200);
    const photoView = await page.evaluate(() => ({
      mode: window.TasuBuilderProjectCalendar.getDetailViewMode(),
      empty: Boolean(document.querySelector("[data-builder-pc-photos-empty]")),
      list: Boolean(document.querySelector("[data-builder-pc-photos-list]")),
    }));
    assert(photoView.mode === "photos", "PC photos view");
    assert(photoView.empty || photoView.list, "PC photos content");

    await page.locator('[data-builder-pc-detail-nav="main"]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-builder-pc-action="completion"]').click();
    await page.waitForTimeout(200);
    assert((await page.locator("[data-builder-pc-completion-form]").count()) > 0, "PC completion form");
    await page.fill("[data-builder-pc-completion-memo]", "P1 Playwright 完了報告デモ");
    await page.selectOption("[data-builder-pc-completion-status]", "completed");
    await page.locator("[data-builder-pc-completion-submit]").click();
    await page.waitForTimeout(200);
    const saved = await page.evaluate(() => {
      const msg = document.querySelector("[data-builder-pc-completion-msg]");
      return msg && !msg.hidden && (msg.textContent || "").includes("保存");
    });
    assert(saved, "PC completion save demo");

    await shot(page, "002-pc-completion-1280");
    assert(errors.length === 0, "PC Console Error 0 (end)", errors.slice(0, 3).join(" | "));
    await context.close();
  }

  // —— Mobile 390: 一覧から選択 ——
  {
    const { context, page, errors, status } = await openPage(browser, { width: 390, height: 844 });
    assert(status === 200, "Mobile agenda HTTP", String(status));
    assert((await overflowX(page)) === 0, "Mobile agenda overflow-x 0");
    assert(errors.length === 0, "Mobile agenda Console Error 0", errors.slice(0, 3).join(" | "));

    const block = page.locator(".builder-pc-agendaBlock[data-builder-pc-project]").first();
    if ((await block.count()) === 0) {
      // open accordion today or pick any project via API then open sheet via selectProject
      await page.evaluate(() => {
        const p = window.TasuBuilderProjectStore.listScheduledProjects()[0];
        if (p) window.TasuBuilderProjectCalendar.selectProject(p.id);
      });
    } else {
      await block.click();
    }
    await page.waitForTimeout(300);

    const sheet = await page.evaluate(() => ({
      open: window.TasuBuilderProjectCalendar.isMobileDetailOpen(),
      visible: !document.querySelector("[data-builder-pc-mobile-detail]")?.hidden,
      title: document.querySelector("[data-builder-pc-mobile-detail-body] .builder-pc-detail__title")?.textContent?.trim() || "",
      actions: [...document.querySelectorAll("[data-builder-pc-mobile-detail-body] [data-builder-pc-action]")].map((el) =>
        el.getAttribute("data-builder-pc-action"),
      ),
    }));
    assert(sheet.open && sheet.visible, "Mobile agenda sheet open");
    assert(Boolean(sheet.title), "Mobile agenda detail title", sheet.title);
    assert(
      ["map", "nav", "tel", "message", "attachments", "photos", "completion"].every((a) => sheet.actions.includes(a)),
      "Mobile agenda actions",
      sheet.actions.join(","),
    );

    // each action clickable (no throw)
    for (const action of ["attachments", "photos", "completion"]) {
      await page.locator(`[data-builder-pc-mobile-detail-body] [data-builder-pc-action="${action}"]`).click();
      await page.waitForTimeout(150);
      const mode = await page.evaluate(() => window.TasuBuilderProjectCalendar.getDetailViewMode());
      assert(mode === action, `Mobile agenda ${action} opens`, mode);
      await page.locator('[data-builder-pc-mobile-detail-body] [data-builder-pc-detail-nav="main"]').click();
      await page.waitForTimeout(120);
    }

    // map/nav/tel/message are links — verify hrefs
    const links = await page.evaluate(() => {
      const body = document.querySelector("[data-builder-pc-mobile-detail-body]");
      const get = (a) => body?.querySelector(`[data-builder-pc-action="${a}"]`)?.getAttribute("href") || "";
      return { map: get("map"), nav: get("nav"), tel: get("tel"), message: get("message") };
    });
    assert(links.map.includes("maps/search"), "Mobile map URL", links.map);
    assert(links.nav.includes("maps/dir"), "Mobile nav URL", links.nav);
    assert(links.tel.startsWith("tel:"), "Mobile tel URL", links.tel);
    const mobileTalk = await page.evaluate(async () => {
      const pid = window.TasuBuilderProjectCalendar.getSelectedProject();
      const res = await window.TasuBuilderProjectTalkRoom.ensureTalkRoomForProject(pid);
      return {
        ok: res?.ok,
        roomId: res?.roomId || "",
        stable: window.TasuBuilderProjectTalkRoom.isStableTalkRoomId(res?.roomId),
      };
    });
    assert(mobileTalk.ok && mobileTalk.stable, "Mobile talk room ensure", JSON.stringify(mobileTalk));

    await shot(page, "003-mobile-agenda-detail-390");

    // close sheet, switch to month, select event
    await page.evaluate(() => window.TasuBuilderProjectCalendar.closeMobileDetail());
    await page.waitForTimeout(200);
    assert(
      (await page.evaluate(() => window.TasuBuilderProjectCalendar.isMobileDetailOpen())) === false,
      "Mobile sheet closes",
    );

    await page.locator('[data-builder-pc-view="month"]').click();
    await page.waitForTimeout(250);
    const monthEvent = page.locator(".builder-pc-day:not(.builder-pc-day--muted) .builder-pc-event").first();
    if ((await monthEvent.count()) > 0) {
      await monthEvent.click();
      await page.waitForTimeout(250);
      const monthSheet = await page.evaluate(() => ({
        open: window.TasuBuilderProjectCalendar.isMobileDetailOpen(),
        view: window.TasuBuilderProjectCalendar.getViewMode(),
        actions: document.querySelectorAll("[data-builder-pc-mobile-detail-body] [data-builder-pc-action]").length,
      }));
      assert(monthSheet.open, "Mobile month sheet open");
      assert(monthSheet.view === "month", "Mobile month view preserved");
      assert(monthSheet.actions >= 7, "Mobile month actions", String(monthSheet.actions));
      await shot(page, "004-mobile-month-detail-390");
    } else {
      ok("Mobile month event skip", "no events");
    }

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
