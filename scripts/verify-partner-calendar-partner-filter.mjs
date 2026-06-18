#!/usr/bin/env node
/**
 * パートナー導線 — partnerId フィルター・画面分離確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "fs";
import { auditPartnerAssignmentPage } from "./lib/audit-partner-assignment.mjs";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = "screenshots/partner-calendar-partner-filter";
mkdirSync(OUT, { recursive: true });

const RESET_KEYS = [
  "tasful:builder:admin:calendarAssignments:v1",
  "tasful:builder:mvp:v1",
  "tasful:builder:mvp:partner_id",
];

async function reset(page) {
  await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), RESET_KEYS);
}

async function auditPartnerCalendar(page, partnerId) {
  const url = `/builder/mvp-calendar.html?role=partner&partnerId=${encodeURIComponent(partnerId)}`;
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-mvp-cal-partner-accepted-list]", { timeout: 20000 });
  await page.waitForTimeout(900);

  return page.evaluate(() => {
    const issues = [];
    const cards = [...document.querySelectorAll(".mvp-cal-partnerSchedule__card")].map((el) => ({
      title: el.querySelector(".mvp-cal-partnerSchedule__title")?.textContent?.trim() || "",
      date: el.querySelector(".mvp-cal-partnerSchedule__date")?.textContent?.trim() || "",
      status: el.querySelector(".mvp-cal-partnerSchedule__status")?.textContent?.trim() || "",
      href: el.getAttribute("href") || "",
    }));

    const opsLayout = document.querySelector("[data-mvp-cal-ops-layout]");
    if (opsLayout && !opsLayout.hidden) {
      issues.push("運営用カレンダーレイアウトがパートナー画面に表示されています");
    }
    if (document.querySelector("[data-partner-assignment-accept]")) {
      issues.push("案件確認用ボタンがカレンダー画面に含まれています");
    }
    if (!cards.length) issues.push("受諾済み予定カードがありません");
    for (const c of cards) {
      if (!c.title) issues.push("案件名が空のカードがあります");
      if (!c.date) issues.push(`日程が空: ${c.title}`);
      if (!c.status) issues.push(`進行状況が空: ${c.title}`);
      if (!c.href.includes("mvp-thread.html")) {
        issues.push(`スレッド直行URLではない: ${c.title} → ${c.href || "(なし)"}`);
      }
    }

    return { ok: issues.length === 0, issues, cards };
  });
}

let results = [];
await withPlaywrightBrowser(async (browser) => {
for (const [label, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 900 }],
]) {
  const page = await browser.newPage({ viewport });
  await reset(page);

  const partnerA = await auditPartnerCalendar(page, "partner-a");
  await page.screenshot({ path: `${OUT}/partner-a-${label}.png`, fullPage: true });
  logScreenshotUrl(`partner-a-${label}`, "/builder/mvp-calendar.html?role=partner&partnerId=partner-a");
  results.push({ case: `partner-a-calendar/${label}`, ...partnerA });

  const titlesA = partnerA.cards?.map((c) => c.title) || [];
  if (titlesA.some((t) => t.includes("倉庫新築"))) {
    results.push({ case: `partner-a-isolation/${label}`, ok: false, issues: ["partner-a に倉庫案件が表示"] });
  } else {
    results.push({ case: `partner-a-isolation/${label}`, ok: true, issues: [] });
  }

  await reset(page);
  const partnerB = await auditPartnerCalendar(page, "partner-b");
  await page.screenshot({ path: `${OUT}/partner-b-${label}.png`, fullPage: true });
  results.push({ case: `partner-b-calendar/${label}`, ...partnerB });

  const titlesB = partnerB.cards?.map((c) => c.title) || [];
  if (titlesB.some((t) => t.includes("店舗内装リニューアル") && !t.includes("共同住宅"))) {
    results.push({ case: `partner-b-isolation/${label}`, ok: false, issues: ["partner-b に partner-a 専用案件が表示"] });
  } else if (!titlesB.some((t) => t.includes("倉庫"))) {
    results.push({ case: `partner-b-isolation/${label}`, ok: false, issues: ["partner-b に倉庫案件がない"] });
  } else {
    results.push({ case: `partner-b-isolation/${label}`, ok: true, issues: [] });
  }

  if (label === "390") {
    await reset(page);
    await page.goto(
      `${BASE}/builder/partner-assignment.html?role=partner&partnerId=partner-b&projectId=builder_demo_001&from=talk`,
      { waitUntil: "domcontentloaded" }
    );
    const denied = await auditPartnerAssignmentPage(page, {
      projectId: "builder_demo_001",
      title: "",
      expectDenied: true,
    });
    await page.screenshot({ path: `${OUT}/partner-b-denied-${label}.png`, fullPage: true });
    results.push({ case: "partner-b-assignment-denied", ...denied });

    await reset(page);
    await page.goto(
      `${BASE}/builder/partner-assignment.html?role=partner&partnerId=demo-partner-001&projectId=builder_demo_001`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForSelector("[data-partner-assignment-accept]", { timeout: 20000 });
    const match = await page.evaluate(() => {
      const raw = localStorage.getItem("tasful:builder:admin:calendarAssignments:v1");
      const list = raw ? JSON.parse(raw) : [];
      const assignment = list.find((a) => a.projectId === "builder_demo_001");
      return {
        title: assignment?.houseName || "",
        summary: assignment?.summary || "",
        address: assignment?.siteAddress || "",
      };
    });
    const partnerRows = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll(".mvp-cal-assignment__row")].map((row) => [
          row.querySelector("dt")?.textContent?.trim() || "",
          row.querySelector("dd")?.textContent?.trim() || "",
        ])
      )
    );
    const issues = [];
    if (partnerRows["案件名"] !== match.title) issues.push("案件名不一致");
    if (partnerRows["案件概要"] !== match.summary) issues.push("案件概要不一致");
    if (partnerRows["現場住所"] !== match.address) issues.push("現場住所不一致");
    results.push({ case: "admin-partner-match", ok: issues.length === 0, issues });
  }

  await page.close();
}

});

console.log("\n## パートナー導線 画面分離確認\n");
let failed = false;
for (const r of results) {
  const status = r.ok ? "OK" : "NG";
  if (!r.ok) failed = true;
  console.log(`- ${r.case}: ${status}`);
  if (r.issues?.length) r.issues.forEach((i) => console.log(`  - ${i}`));
}

await closeAllBrowsers();
process.exit(failed ? 1 : 0);
