#!/usr/bin/env node
/**
 * CAL-MAIN-15 — calendar 系 MVP ベル縮小（Talk 成功時 no-op）
 *
 *   node scripts/test-builder-calendar-cal-main-15-mvp-bell-shrink.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-15");
const ADMIN_URL = buildLocalPageUrl(STANDARD_LOCAL_BASE, "builder/admin-calendar.html?role=owner");

const IGNORE = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /CDN|fonts\.g|placehold/i,
  /\[TasuSupabase\]/i,
  /\[TasuChat\]/i,
  /\[WriteAdapter\]/i,
  /\[Store\]/i,
  /\[TasuTalkRoomEnsure\]/i,
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`=== CAL-MAIN-15 MVP Bell Shrink @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probe = await fetch(ADMIN_URL.split("?")[0]).catch(() => null);
  assert(probe?.ok, "HTTP 200", `status=${probe?.status ?? "unreachable"}`);
  if (!probe?.ok) {
    writeReport();
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
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

  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);

  const withTalk = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Dispatch = window.TasuBuilderNotifyDispatch;
    const Talk = window.TasuTalkNotifications;

    const listMvp = () => {
      const n = Bridge.getNotifications?.();
      return Array.isArray(n) ? n : [];
    };
    const listTalk = () => {
      const n = Talk?.getAll?.();
      return Array.isArray(n) ? n : [];
    };

    const talkBefore = listTalk().length;
    const mvpAssignBefore = listMvp().filter((n) => n.type === "calendar_assignment").length;
    const mvpHireBefore = listMvp().filter(
      (n) => n.type === "hire_confirmed" || n.type === "selected"
    ).length;

    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-15 Talk path",
      partnerId: "demo-partner-001",
      partnerName: "デモパートナー",
      start: "2027-05-01",
      end: "2027-05-02",
      location: "東京都",
      instructions: "talk path",
    });

    const talkAfterCreate = listTalk();
    const mvpAfterCreate = listMvp();
    const talkAssign = talkAfterCreate.filter(
      (n) =>
        n.source === Dispatch?.SOURCE ||
        String(n.id || "").includes("builder-dispatch") ||
        n.actionTag === "新着案件" ||
        String(n.title || "").includes("新しい案件が追加")
    );
    const mvpAssignAfter = mvpAfterCreate.filter((n) => n.type === "calendar_assignment");

    const accept = await Bridge.acceptCalendarAssignment(created.project_id);
    const talkAfterAccept = listTalk();
    const mvpAfterAccept = listMvp();
    const talkAccepted = talkAfterAccept.filter(
      (n) =>
        n.actionTag === "受諾" ||
        String(n.title || "").includes("受けました") ||
        String(n.title || "").includes("受諾")
    );
    const mvpHireAfter = mvpAfterAccept.filter(
      (n) => n.type === "hire_confirmed" || n.type === "selected"
    );

    const talkRow = talkAssign[talkAssign.length - 1];
    return {
      hasTalk: Dispatch?.isTalkNotifyAvailable?.() === true,
      createdOk: created?.ok === true,
      talkGrew: talkAfterCreate.length > talkBefore,
      mvpAssignCountDelta: mvpAssignAfter.length - mvpAssignBefore,
      talkAssignCount: talkAssign.length,
      talkHasHub: Boolean(talkRow?.hubProjectId || talkRow?.hubHref),
      talkHasLegacy: Boolean(talkRow?.legacyProjectId || talkRow?.projectId),
      talkHref: talkRow?.href || talkRow?.targetUrl || "",
      acceptOk: accept?.ok === true,
      talkAcceptedCount: talkAccepted.length,
      mvpHireDelta: mvpHireAfter.length - mvpHireBefore,
      skipHelper: Dispatch?.shouldSkipMvpCalendarBell?.("calendar_assignment", {
        ok: true,
        persisted: true,
      }),
    };
  });

  assert(withTalk.hasTalk, "Talk notify available on admin-calendar");
  assert(withTalk.createdOk, "create ok");
  assert(withTalk.talkGrew || withTalk.talkAssignCount > 0, "Talk got assignment notify");
  assert(withTalk.mvpAssignCountDelta === 0, "MVP bell skipped for assignment", String(withTalk.mvpAssignCountDelta));
  assert(withTalk.talkHasHub || withTalk.talkHasLegacy, "Talk payload has ids");
  assert(/partner-assignment/.test(withTalk.talkHref), "Talk href partner-assignment", withTalk.talkHref);
  assert(withTalk.acceptOk, "accept ok");
  assert(withTalk.talkAcceptedCount > 0, "Talk got accept notify");
  assert(withTalk.mvpHireDelta === 0, "MVP bell skipped for accept", String(withTalk.mvpHireDelta));
  assert(withTalk.skipHelper === true, "shouldSkipMvpCalendarBell true when Talk persisted");

  // Decline path
  const declinePath = await page.evaluate(async () => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Talk = window.TasuTalkNotifications;
    const mvpList = () => {
      const n = Bridge.getNotifications?.();
      return Array.isArray(n) ? n : [];
    };
    const talkList = () => {
      const n = Talk?.getAll?.();
      return Array.isArray(n) ? n : [];
    };
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-15 decline",
      partnerId: "demo-partner-001",
      start: "2027-05-10",
      end: "2027-05-11",
      location: "東京都",
      instructions: "decline",
    });
    const mvpBefore = mvpList().filter((n) => n.type === "request_declined").length;
    const talkBefore = talkList().filter(
      (n) => n.actionTag === "辞退" || String(n.title || "").includes("辞退")
    ).length;
    await Bridge.declineCalendarAssignment(created.project_id);
    const mvpAfter = mvpList().filter((n) => n.type === "request_declined").length;
    const talkAfter = talkList().filter(
      (n) => n.actionTag === "辞退" || String(n.title || "").includes("辞退")
    ).length;
    return {
      talkDelta: talkAfter - talkBefore,
      mvpDelta: mvpAfter - mvpBefore,
    };
  });
  assert(declinePath.talkDelta > 0, "Talk got decline notify");
  assert(declinePath.mvpDelta === 0, "MVP bell skipped for decline", String(declinePath.mvpDelta));

  // Fallback: Talk unavailable → MVP bell writes
  const fallback = await page.evaluate(() => {
    const Bridge = window.TasuBuilderBenchBridge;
    const Dispatch = window.TasuBuilderNotifyDispatch;
    const Talk = window.TasuTalkNotifications;
    const savedAdd = Talk?.add;
    if (Talk) Talk.add = undefined;

    const mvpList = () => {
      const n = Bridge.getNotifications?.();
      return Array.isArray(n) ? n : [];
    };
    const mvpBefore = mvpList().filter((n) => n.type === "calendar_assignment").length;
    const created = Bridge.createAdminCalendarProject({
      title: "CAL-MAIN-15 MVP fallback",
      partnerId: "demo-partner-001",
      start: "2027-06-01",
      end: "2027-06-02",
      location: "東京都",
      instructions: "fallback",
    });
    const mvpAfter = mvpList().filter((n) => n.type === "calendar_assignment").length;
    const skip = Dispatch?.shouldSkipMvpCalendarBell?.("calendar_assignment", {
      ok: false,
      persisted: false,
    });

    if (Talk && savedAdd) Talk.add = savedAdd;
    return {
      createdOk: created?.ok === true,
      mvpDelta: mvpAfter - mvpBefore,
      skipFalse: skip === false,
    };
  });
  assert(fallback.createdOk, "create ok without Talk");
  assert(fallback.mvpDelta > 0, "MVP bell fallback when Talk missing", String(fallback.mvpDelta));
  assert(fallback.skipFalse, "shouldSkip false when Talk not persisted");

  assert(errors.length === 0, "Console Error 0", errors.slice(0, 3).join(" | "));

  await browser.close();
  writeReport();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

function writeReport() {
  fs.writeFileSync(
    path.join(OUT, "result.json"),
    JSON.stringify({ ...report, pass, fail }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
