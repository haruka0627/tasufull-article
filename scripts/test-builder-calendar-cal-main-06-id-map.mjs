#!/usr/bin/env node
/**
 * CAL-MAIN-06 — legacy ↔ Hub ID マップ + Talk 通知入口の Hub 化
 *
 *   node scripts/test-builder-calendar-cal-main-06-id-map.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-calendar-cal-main-06");
const TALK_URL = buildLocalPageUrl(
  STANDARD_LOCAL_BASE,
  "talk-home.html?tab=notify&talkDev=1&talkAdmin=1"
);
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
  /blocked_users/i,
  /CORS policy/i,
];

const MVP_KEY = "tasful:builder:mvp:v1";
const MAP_KEY = "tasu_builder_project_id_map_v1";

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
  console.log(`=== CAL-MAIN-06 ID Map @ ${STANDARD_LOCAL_BASE} ===\n`);

  const probeTalk = await fetch(TALK_URL.split("?")[0]).catch(() => null);
  assert(probeTalk?.ok, "HTTP 200 talk-home", `status=${probeTalk?.status ?? "unreachable"}`);
  if (!probeTalk?.ok) {
    writeReport();
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

  await page.addInitScript((keys) => {
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(
      "tasful:builder:mvp:v1",
      JSON.stringify({ projects: [{ project_id: "builder_demo_001", title: "keep-me" }] })
    );
  }, [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
    "tasful_chat_messages",
    "tasful_official_room_last_seen_v1",
    MAP_KEY,
  ]);

  await page.goto(TALK_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-talk-notify-id="builder-ops-flow-001"]', { timeout: 20000 });
  await page.waitForTimeout(500);

  const mapAudit = await page.evaluate(() => {
    const MapApi = window.TasuBuilderProjectIdMap;
    const Dispatch = window.TasuBuilderNotifyDispatch;
    const master = window.TasuTalkData?.BUILDER_NOTIFICATION_MASTER_V1 || [];
    const flow001 = master.find((n) => n.id === "builder-ops-flow-001");
    const boardApply = master.find((n) => n.id === "builder-board-apply-001");
    const unknown = MapApi?.enrichNotifyPayload?.({
      id: "x-unknown",
      href: "builder/mvp-thread.html?thread_id=unknown-thread-999",
      projectId: "totally-unknown-project",
    });

    const mvpBefore = localStorage.getItem("tasful:builder:mvp:v1");
    MapApi?.linkIds?.({
      hubProjectId: "PRJ-RUNTIME-TEST",
      legacyProjectId: "legacy-runtime-test",
      talkRoomId: "room-runtime-test",
      source: "test",
    });
    const mvpAfter = localStorage.getItem("tasful:builder:mvp:v1");
    const mapStored = localStorage.getItem("tasu_builder_project_id_map_v1");

    const dispatched = Dispatch?.notifyPartnerNewProject?.({
      hubProjectId: "PRJ-2026-001",
      title: "テスト案件",
      legacyProjectId: "builder_demo_001",
    });

    return {
      hasMap: Boolean(MapApi),
      hasDispatch: Boolean(Dispatch),
      legacyToHub: MapApi?.legacyToHub?.("builder_demo_001"),
      hubToLegacy: MapApi?.hubToLegacy?.("PRJ-2026-001"),
      talkRoomToHub: MapApi?.talkRoomToHub?.("builder-cal-PRJ-2026-001"),
      threadToHub: MapApi?.legacyThreadToHub?.("builder_thread_demo_001"),
      resolveFromPayload: MapApi?.resolveHubProjectId?.({
        projectId: "builder_demo_001",
      }),
      resolveUnknown: MapApi?.resolveHubProjectId?.({ projectId: "totally-unknown-project" }),
      flow001: flow001
        ? {
            projectId: flow001.projectId,
            legacyProjectId: flow001.legacyProjectId,
            hubProjectId: flow001.hubProjectId,
            href: flow001.href,
            hubHref: flow001.hubHref,
            targetUrl: flow001.targetUrl,
          }
        : null,
      boardApply: boardApply
        ? {
            legacyProjectId: boardApply.legacyProjectId,
            hubProjectId: boardApply.hubProjectId,
            href: boardApply.href,
          }
        : null,
      unknownHref: unknown?.href,
      unknownHub: unknown?.hubProjectId,
      defaultHref: MapApi?.resolveNotifyHref?.(flow001),
      preferHubHref: MapApi?.resolveNotifyHref?.(flow001, { preferHub: true }),
      mvpUnchanged: mvpBefore === mvpAfter && /builder_demo_001/.test(mvpBefore || ""),
      mapStoredHasRuntime: /PRJ-RUNTIME-TEST/.test(mapStored || ""),
      dispatchedHub: dispatched?.notification?.hubProjectId,
      dispatchedHref: dispatched?.notification?.href,
      dispatchedLegacyInHref: /projectId=builder_demo_001/.test(
        dispatched?.notification?.href || ""
      ),
      dispatchedHubInHref: /hubProjectId=PRJ-2026-001/.test(dispatched?.notification?.href || ""),
      domFlowHref:
        document
          .querySelector(
            '[data-talk-notify-id="builder-ops-flow-001"] [data-talk-notify-action="navigate"]'
          )
          ?.getAttribute("data-talk-notify-href") ||
        document
          .querySelector('[data-talk-notify-id="builder-ops-flow-001"] [data-talk-notify-action]')
          ?.getAttribute("data-talk-notify-href") ||
        "",
      storeFlowHref: (() => {
        const n =
          window.TasuTalkData?.findNotificationById?.("builder-ops-flow-001") ||
          (window.TasuTalkNotifications?.findById?.("builder-ops-flow-001"));
        return String(n?.href || n?.targetUrl || "");
      })(),
    };
  });

  assert(mapAudit.hasMap, "TasuBuilderProjectIdMap loaded");
  assert(mapAudit.hasDispatch, "TasuBuilderNotifyDispatch loaded");
  assert(mapAudit.legacyToHub === "PRJ-2026-001", "legacy → hub", mapAudit.legacyToHub);
  assert(mapAudit.hubToLegacy === "builder_demo_001", "hub → legacy", mapAudit.hubToLegacy);
  assert(
    mapAudit.talkRoomToHub === "PRJ-2026-001",
    "talkRoom → hub",
    mapAudit.talkRoomToHub
  );
  assert(mapAudit.threadToHub === "PRJ-2026-001", "legacy thread → hub", mapAudit.threadToHub);
  assert(
    mapAudit.resolveFromPayload === "PRJ-2026-001",
    "resolveHubProjectId(payload)",
    mapAudit.resolveFromPayload
  );
  assert(mapAudit.resolveUnknown === "", "unknown → empty hub", mapAudit.resolveUnknown);

  assert(Boolean(mapAudit.flow001), "ops-flow-001 in master");
  assert(
    mapAudit.flow001?.hubProjectId === "PRJ-2026-001",
    "flow-001 hubProjectId",
    mapAudit.flow001?.hubProjectId
  );
  assert(
    mapAudit.flow001?.legacyProjectId === "builder_demo_001",
    "flow-001 legacyProjectId",
    mapAudit.flow001?.legacyProjectId
  );
  assert(
    /partner-assignment\.html/.test(mapAudit.flow001?.href || ""),
    "flow-001 href keeps partner-assignment",
    mapAudit.flow001?.href
  );
  assert(
    /projectId=builder_demo_001/.test(mapAudit.flow001?.href || ""),
    "flow-001 href keeps legacy projectId",
    mapAudit.flow001?.href
  );
  assert(
    !/hubProjectId=/.test(mapAudit.flow001?.href || ""),
    "flow-001 href does not alter legacy query",
    mapAudit.flow001?.href
  );
  assert(
    /project-calendar\.html\?projectId=PRJ-2026-001/.test(mapAudit.flow001?.hubHref || ""),
    "flow-001 hubHref calendar",
    mapAudit.flow001?.hubHref
  );

  assert(
    mapAudit.boardApply?.hubProjectId === "PRJ-2026-002",
    "board-apply hubProjectId",
    mapAudit.boardApply?.hubProjectId
  );
  assert(
    /board-project-detail/.test(mapAudit.boardApply?.href || ""),
    "board-apply href unchanged path",
    mapAudit.boardApply?.href
  );

  assert(
    mapAudit.unknownHub === "" || mapAudit.unknownHub == null,
    "unknown notify has no hub",
    mapAudit.unknownHub
  );
  assert(
    /unknown-thread-999/.test(mapAudit.unknownHref || ""),
    "unknown notify keeps href",
    mapAudit.unknownHref
  );

  assert(
    /partner-assignment/.test(mapAudit.defaultHref || ""),
    "resolveNotifyHref default = legacy",
    mapAudit.defaultHref
  );
  assert(
    /project-calendar/.test(mapAudit.preferHubHref || ""),
    "resolveNotifyHref preferHub = calendar",
    mapAudit.preferHubHref
  );

  assert(mapAudit.mvpUnchanged, "MVP localStorage not deleted/converted");
  assert(mapAudit.mapStoredHasRuntime, "runtime pair stored in map key");

  assert(mapAudit.dispatchedHub === "PRJ-2026-001", "dispatch hubProjectId");
  assert(mapAudit.dispatchedLegacyInHref, "dispatch href legacy projectId");
  assert(
    !mapAudit.dispatchedHubInHref,
    "dispatch href keeps legacy-only query",
    mapAudit.dispatchedHref
  );

  const actionHref = mapAudit.domFlowHref || mapAudit.storeFlowHref || "";
  assert(
    /partner-assignment/.test(actionHref) && /projectId=builder_demo_001/.test(actionHref),
    "DOM/store action href keeps legacy path",
    actionHref
  );
  assert(
    !/hubProjectId=/.test(actionHref),
    "DOM/store action href has no hubProjectId query",
    actionHref
  );

  // Calendar page: linkHubProject on save
  await page.goto(CAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-builder-pc-calendar-body]", { timeout: 15000 });
  const calAudit = await page.evaluate(() => {
    const MapApi = window.TasuBuilderProjectIdMap;
    const Store = window.TasuBuilderProjectStore;
    Store?.clearForTests?.();
    Store?.ensureSeed?.();
    const saved = Store?.saveProject?.(
      {
        id: "PRJ-CAL-MAIN-06",
        name: "CAL-MAIN-06 link test",
        status: "inquiry",
        talkRoomId: "local-room-builder-PRJ-CAL-MAIN-06",
        talkThreadId: "local-room-builder-PRJ-CAL-MAIN-06",
      },
      { skipTalkRoom: true }
    );
    return {
      hasMap: Boolean(MapApi),
      talkRoomToHub: MapApi?.talkRoomToHub?.("local-room-builder-PRJ-CAL-MAIN-06"),
      savedId: saved?.id,
      mapHasPair: MapApi?.listPairs?.().some(
        (p) => p.hubProjectId === "PRJ-CAL-MAIN-06" && p.talkRoomId === "local-room-builder-PRJ-CAL-MAIN-06"
      ),
    };
  });

  assert(calAudit.hasMap, "Calendar loads IdMap");
  assert(calAudit.savedId === "PRJ-CAL-MAIN-06", "saveProject ok");
  assert(
    calAudit.talkRoomToHub === "PRJ-CAL-MAIN-06",
    "saveProject links talkRoom → hub",
    calAudit.talkRoomToHub
  );
  assert(calAudit.mapHasPair, "listPairs includes runtime hub link");

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
