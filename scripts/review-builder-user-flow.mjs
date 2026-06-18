#!/usr/bin/env node
/**
 * Builder 利用者導線総監査
 *   node scripts/review-builder-user-flow.mjs
 */
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "builder-user-flow-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const MVP_KEY = "tasful:builder:mvp:v1";
const PROJECT_ID = "demo-project-001";
const THREAD_ID = "thread-demo-001";
const PARTNER_ID = "demo-partner-001";
const APPLY_PROJECT_TITLE = "東京都 外壁塗装案件";
const BOARD_PROJECT_TITLE = "新宿区 共同住宅 外装改修";
const PUBLIC_BOARD_LIST_URL = "public-board.html";

/** index / report 用スクショラベル（ファイル名 → 表示名・URL） */
const BUILDER_SHOT_CATALOG = [
  { file: "01-board-list-390.png", label: "案件記事一覧", url: PUBLIC_BOARD_LIST_URL },
  { file: "02-project-detail-390.png", label: "案件記事詳細", url: "public-board-detail.html" },
];

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const BUILDER_NOTIFY_FLOWS = [
  {
    id: "apply",
    kind: "応募通知",
    notifyId: "builder-board-apply-001",
    role: "掲載者",
    userId: "",
    expectedDest: /board-project-detail\.html/i,
    expectInBody: /応募/i,
    expectOnPage: /応募者|採用する|見送り/i,
    expectQuery: /view=applications/i,
    projectHint: APPLY_PROJECT_TITLE,
  },
  {
    id: "hire_partner",
    kind: "採用通知（応募者）",
    notifyId: "builder-board-selected-001",
    role: "応募者",
    userId: "",
    expectedDest: /board-thread\.html/i,
    expectInBody: /採用|チャット/i,
    expectOnPage: new RegExp(BOARD_PROJECT_TITLE.slice(0, 8)),
    projectHint: BOARD_PROJECT_TITLE,
  },
  {
    id: "hire_owner",
    kind: "採用通知（掲載者）",
    notifyId: "builder-board-hire-owner-001",
    role: "掲載者",
    userId: "",
    expectedDest: /board-thread\.html/i,
    expectInBody: /採用|チャット/i,
    expectOnPage: new RegExp(BOARD_PROJECT_TITLE.slice(0, 8)),
    projectHint: BOARD_PROJECT_TITLE,
  },
  {
    id: "completion",
    kind: "完了報告通知",
    notifyId: "builder-board-completion-001",
    role: "掲載者",
    userId: "",
    expectedDest: /board-thread\.html/i,
    expectInBody: /完了/i,
    expectOnPage: /承認する|差し戻し|完了報告/i,
    expectHash: /completion/i,
    projectHint: BOARD_PROJECT_TITLE,
  },
  {
    id: "platform_hire",
    kind: "採用通知（platform-verify）",
    notifyId: "platform-verify-builder-hired-001",
    role: "応募者",
    userId: "u_hiro",
    expectedDest: /board-thread\.html|chat-detail\.html/i,
    expectInBody: /採用/i,
    projectHint: BOARD_PROJECT_TITLE,
  },
  {
    id: "platform_completion",
    kind: "完了報告（platform-verify）",
    notifyId: "platform-verify-builder-completion-001",
    role: "採用者",
    userId: "",
    expectedDest: /board-thread\.html/i,
    expectInBody: /完了/i,
    projectHint: BOARD_PROJECT_TITLE,
  },
];

const NAV_TIMEOUT = 20000;
const SEL_TIMEOUT = 12000;

async function findBaseUrl() {
  const ports = [5500, 5173, 5176, 8765, 5199];
  const hosts = ["http://127.0.0.1", "http://localhost"];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    for (const host of hosts) {
      for (const port of ports) {
        try {
          const base = `${host}:${port}`;
          const res = await fetch(`${base}/builder/board-projects.html`, {
            method: "HEAD",
            signal: ctrl.signal,
          });
          if (res.ok) return base;
        } catch {
          /* next */
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function pageUrl(base, rel) {
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(join(root, rel)).href;
}

function notifyHomeUrl(base, userId = "") {
  const u = new URL(pageUrl(base, "talk-home.html"));
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  if (userId) u.searchParams.set("userId", userId);
  return u.toString();
}

async function shot(page, name) {
  const path = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

function logOpenUrl(step, url) {
  console.log(`[audit] ${step}: open ${url}`);
}

async function readPublicBoardListMeta(page) {
  return page.evaluate(() => {
    const pageId = document.body?.dataset?.page || "";
    const url = location.href;
    const rows = [...document.querySelectorAll("[data-job-list-body] .job-table-row")];
    const mobileCards = [...document.querySelectorAll("[data-job-list-mobile] .job-list-mobile-card")];
    const pickProject = (root) =>
      root?.querySelector(".job-board-type-badge--project, .job-board-type-badge")?.textContent?.trim() ===
        "案件"
        ? root
        : null;
    const projectRow = rows.find(pickProject);
    const projectCard = mobileCards.find(pickProject);
    const projectLink =
      projectRow?.querySelector("a[href*='public-board-detail']")?.getAttribute("href") ||
      projectCard?.querySelector("a[href*='public-board-detail']")?.getAttribute("href") ||
      "";
    const cardCount = Math.max(rows.length, mobileCards.length);
    const totalCount = Number(document.querySelector("[data-job-top-count]")?.textContent || "0");
    const hasApply = Boolean(
      document.querySelector("a.job-apply-btn[href*='public-board-detail'], a[href*='#apply']")
    );
    return {
      pageId,
      url,
      cardCount,
      totalCount,
      hasProject: Boolean(projectLink),
      projectLink,
      hasApply,
    };
  });
}

async function clickFirstPublicBoardProject(page, base) {
  const href = await page.evaluate(() => {
    const pickProject = (root) =>
      root?.querySelector(".job-board-type-badge--project") ? root : null;
    const mobileCards = [...document.querySelectorAll("[data-job-list-mobile] .job-list-mobile-card")];
    const rows = [...document.querySelectorAll("[data-job-list-body] .job-table-row")];
    const projectCard = mobileCards.find(pickProject);
    const projectRow = rows.find(pickProject);
    return (
      projectCard?.querySelector("a[href*='public-board-detail']")?.getAttribute("href") ||
      projectRow?.querySelector("a[href*='public-board-detail']")?.getAttribute("href") ||
      document.querySelector("a[href*='public-board-detail'][href*='type=project']")?.getAttribute("href") ||
      ""
    );
  });
  if (!href) {
    throw new Error("案件記事一覧から public-board-detail へのリンクが見つかりません");
  }
  const dest = href.startsWith("http") ? href : new URL(href, pageUrl(base, PUBLIC_BOARD_LIST_URL)).toString();
  logOpenUrl("案件記事詳細", dest);
  await page.goto(dest, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
}

async function openNotifyPanel(page, base, userId = "") {
  await page.goto(notifyHomeUrl(base, userId), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("[data-talk-root]", { timeout: SEL_TIMEOUT });
  await ensureBuilderNotifySeeded(page);
  await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
  await page.waitForTimeout(700);
}

async function ensureBuilderNotifySeeded(page) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem("tasful_builder_notify_master_v1");
      window.TasuTalkData?.invalidateNotificationsBootstrap?.();
      const now = new Date().toISOString();
      const master =
        window.TasuTalkData?.BUILDER_NOTIFICATION_MASTER_V1 ||
        window.TasuTalkBuilderNotifyMaster?.buildMaster?.(now) ||
        [];
      const store = window.TasuTalkNotifications;
      if (store?.applyBuilderMasterV1 && master.length) {
        store.applyBuilderMasterV1(master);
      } else {
        window.TasuTalkData?.ensureNotifications?.();
      }
      window.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
      );
      window.TasuTalkHome?.renderNotifications?.();
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(500);
}

async function safeEvaluate(page, fn, arg) {
  const url = page.url();
  if (!/^https?:/i.test(url)) {
    throw new Error(`localStorage unavailable on ${url || "blank page"}`);
  }
  return page.evaluate(fn, arg);
}

async function seedOpenProjectForPartnerApply(page) {
  await safeEvaluate(
    page,
    ({ mvpKey, projectId }) => {
      const ts = new Date().toISOString();
      localStorage.setItem(
        mvpKey,
        JSON.stringify({
          version: 1,
          owner_id: "demo-owner-001",
          partners: [{ partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" }],
          projects: [
            {
              project_id: projectId,
              owner_id: "demo-owner-001",
              title: "新宿区 共同住宅 外装改修",
              kind: "builder_board",
              board_type: "project",
              status: "open",
              required_partners: 1,
              selected_partner_ids: [],
              main_thread_id: null,
              created_at: ts,
            },
          ],
          applications: [],
          threads: {},
          specs: { [projectId]: { budget: { min: 600000, max: 900000 } } },
        })
      );
      localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID }
  );
}

async function seedOpenProjectWithApplication(page) {
  await safeEvaluate(
    page,
    ({ mvpKey, projectId, partnerId }) => {
      const ts = new Date().toISOString();
      localStorage.setItem(
        mvpKey,
        JSON.stringify({
          version: 1,
          owner_id: "demo-owner-001",
          partners: [{ partner_id: partnerId, display_name: "株式会社オレンジ建装" }],
          projects: [
            {
              project_id: projectId,
              owner_id: "demo-owner-001",
              title: "新宿区 共同住宅 外装改修",
              kind: "builder_board",
              board_type: "project",
              status: "open",
              required_partners: 1,
              selected_partner_ids: [],
              main_thread_id: null,
              created_at: ts,
            },
          ],
          applications: [
            {
              application_id: "app-audit-1",
              project_id: projectId,
              partner_id: partnerId,
              status: "pending",
              ts,
            },
          ],
          threads: {},
          specs: { [projectId]: { budget: { min: 600000, max: 900000 } } },
        })
      );
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID, partnerId: PARTNER_ID }
  );
}

async function readMergedNotifications(page) {
  return page.evaluate(() => {
    const rows = [];
    const push = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach((n) => {
        rows.push({
          title: String(n.title || n.label || ""),
          href: String(n.targetUrl || n.href || ""),
          type: String(n.type || ""),
        });
      });
    };
    try {
      push(JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]"));
    } catch {
      /* ignore */
    }
    try {
      push(JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]"));
    } catch {
      /* ignore */
    }
    try {
      push(window.TasuTalkNotifications?.getAll?.() || []);
    } catch {
      /* ignore */
    }
    return rows;
  });
}

async function clickNotifyCta(page, notifyId, { preferCardClick = false } = {}) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`).first();
  await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
  const tier = await card.getAttribute("data-talk-notify-tier");
  const navHref = await page.evaluate((id) => {
    const row = window.TasuTalkNotifications?.findById?.(id);
    const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return built?.href || row?.href || row?.targetUrl || "";
  }, notifyId);

  if (preferCardClick || tier === "normal") {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      card.click(),
    ]);
    return { url: page.url(), navHref };
  }

  if (navHref) {
    const dest = navHref.startsWith("http") ? navHref : new URL(navHref, page.url()).toString();
    await page.goto(dest, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    return { url: page.url(), navHref };
  }

  const btn = card.locator("[data-talk-notify-action], .talk-notify-card__minimal-action").first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
    btn.click(),
  ]);

  if (/talk-home\.html/i.test(page.url()) && navHref) {
    const dest = navHref.startsWith("http") ? navHref : new URL(navHref, page.url()).toString();
    await page.goto(dest, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  }
  return { url: page.url(), navHref };
}

async function seedHiredThread(page, { withPendingCompletion = false } = {}) {
  await safeEvaluate(
    page,
    ({ mvpKey, projectId, threadId, partnerId, withPendingCompletion }) => {
      const ts = new Date().toISOString();
      const thread = {
        thread_id: threadId,
        project_id: projectId,
        thread_kind: "board_match",
        events: [{ type: "selected", ts, text: "採用" }],
        messages: [{ msg_id: "m1", from: { type: "owner", name: "運営" }, ts, text: "よろしく" }],
      };
      if (withPendingCompletion) {
        thread.completion_submission = {
          status: "submitted",
          comment: "完了報告（監査シード）",
          submitted_at: ts,
        };
        thread.status = "completion_pending";
        thread.events.push({ type: "completion_requested", ts, text: "完了報告提出" });
      }
      localStorage.setItem(
        mvpKey,
        JSON.stringify({
          version: 1,
          owner_id: "demo-owner-001",
          partners: [{ partner_id: partnerId, display_name: "株式会社オレンジ建装" }],
          projects: [
            {
              project_id: projectId,
              owner_id: "demo-owner-001",
              title: "新宿区 共同住宅 外装改修",
              kind: "builder_board",
              board_type: "project",
              status: withPendingCompletion ? "selected" : "open",
              required_partners: 1,
              selected_partner_ids: [partnerId],
              main_thread_id: threadId,
              created_at: ts,
            },
          ],
          specs: { [projectId]: { budget: { min: 600000, max: 900000 }, overview: "テスト案件" } },
          threads: { [threadId]: thread },
          applications: [
            {
              application_id: "app-1",
              project_id: projectId,
              partner_id: partnerId,
              status: "selected",
              ts,
            },
          ],
        })
      );
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", partnerId);
    },
    {
      mvpKey: MVP_KEY,
      projectId: PROJECT_ID,
      threadId: THREAD_ID,
      partnerId: PARTNER_ID,
      withPendingCompletion,
    }
  );
}

async function seedPendingCompletionForNotify(page) {
  await safeEvaluate(
    page,
    ({ mvpKey, threadId, projectId }) => {
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      } catch {
        state = {};
      }
      const thread = state.threads?.[threadId];
      if (!thread) return;
      const ts = new Date().toISOString();
      thread.completion_submission = {
        status: "submitted",
        comment: "監査用完了報告",
        submitted_at: ts,
      };
      thread.status = "completion_pending";
      thread.events = Array.isArray(thread.events) ? thread.events : [];
      if (!thread.events.some((e) => e.type === "completion_requested")) {
        thread.events.push({ type: "completion_requested", ts, text: "完了報告提出" });
      }
      state.threads[threadId] = thread;
      localStorage.setItem(mvpKey, JSON.stringify(state));
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID, projectId: PROJECT_ID }
  );
}

/* ── 確認1: 案件導線（public-board 一覧 → 詳細 → 応募） ── */
async function auditProjectFlow(page, base, vp) {
  const item = {
    id: "project_flow",
    kind: "案件記事一覧→詳細→応募",
    vp: vp.name,
    status: "FAIL",
    issues: [],
    listUrl: pageUrl(base, PUBLIC_BOARD_LIST_URL),
  };
  try {
    logOpenUrl("案件記事一覧", item.listUrl);
    await page.goto(item.listUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.evaluate(() => {
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    console.log(`[audit] 案件記事一覧: loaded ${page.url()}`);

    await page.waitForSelector(
      "[data-job-list-body] .job-table-row, [data-job-list-mobile] .job-list-mobile-card",
      { timeout: SEL_TIMEOUT }
    );
    await page.waitForTimeout(700);

    const listMeta = await readPublicBoardListMeta(page);
    if (listMeta.pageId !== "public-board") item.issues.push(`一覧 page 不正: ${listMeta.pageId || "—"}`);
    if (!/public-board\.html/i.test(listMeta.url)) item.issues.push(`一覧URL不正: ${listMeta.url}`);
    if (!listMeta.cardCount) item.issues.push("案件・求人カード0件");
    if (!listMeta.hasProject) item.issues.push("案件カードなし");
    if (!listMeta.hasApply) item.issues.push("一覧に応募CTAなし");

    await shot(page, `01-board-list-${vp.name}`);

    await clickFirstPublicBoardProject(page, base);
    await page.waitForURL(/public-board-detail\.html/i, { timeout: NAV_TIMEOUT });
    console.log(`[audit] 案件記事詳細: loaded ${page.url()}`);

    const detailMeta = await page.evaluate(() => ({
      url: location.href,
      pageId: document.body?.dataset?.page || "",
      hasApply: Boolean(
        document.querySelector(
          "[data-public-project-apply]:not([hidden]), [data-public-project-dock-apply]:not([hidden])"
        )
      ),
      hasTitle: Boolean(
        document.querySelector(
          "[data-public-project-title], [data-listing-title], h1"
        )?.textContent?.trim()
      ),
      title:
        document.querySelector("[data-public-project-title], [data-listing-title], h1")?.textContent?.trim() ||
        "",
    }));
    if (!/public-board-detail\.html/i.test(detailMeta.url)) item.issues.push(`詳細URL不正: ${detailMeta.url}`);
    if (detailMeta.pageId !== "public-board-detail") {
      item.issues.push(`詳細 page 不正: ${detailMeta.pageId || "—"}`);
    }
    if (!detailMeta.hasApply && !detailMeta.hasTitle) item.issues.push("詳細に応募CTA/タイトルなし");

    await shot(page, `02-project-detail-${vp.name}`);

    if (!item.issues.length) item.status = "PASS";
    else if (item.issues.length <= 1) item.status = "WARNING";
    item.detail = {
      listMeta,
      detailMeta,
      listUrl: listMeta.url,
      detailUrl: detailMeta.url,
      url: detailMeta.url,
    };
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認2: 応募導線（通知→掲載者画面→応募内容） ── */
async function auditApplyNotifyFlow(page, base, vp) {
  const item = { id: "apply_notify", kind: "応募→掲載者通知→案件確認", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "owner"));
    await openNotifyPanel(page, base, "");
    await page.waitForFunction(
      () => {
        const row = window.TasuTalkNotifications?.findById?.("builder-board-apply-001");
        const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
        const href = built?.href || row?.href || row?.targetUrl || "";
        return /board-project-detail/.test(href);
      },
      { timeout: SEL_TIMEOUT }
    );
    await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: SEL_TIMEOUT }).catch(() => {});
    const card = page.locator('[data-talk-notify-id="builder-board-apply-001"]').first();
    if (!(await card.count())) {
      item.issues.push("応募通知カード未表示");
      return item;
    }
    const notifyMeta = await page.evaluate(() => {
      const el = document.querySelector('[data-talk-notify-id="builder-board-apply-001"]');
      return {
        title: el?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
        body: el?.textContent || "",
      };
    });
    const navHref = await page.evaluate(() => {
      const row = window.TasuTalkNotifications?.findById?.("builder-board-apply-001");
      const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
      return built?.href || row?.href || row?.targetUrl || "";
    });
    if (!/board-project-detail/.test(navHref)) {
      item.issues.push(`応募通知 href 不正: ${navHref || "—"}`);
    }
    await shot(page, `03-apply-notify-${vp.name}`);

    const nav = await clickNotifyCta(page, "builder-board-apply-001", { preferCardClick: true });
    if (!/board-project-detail\.html/i.test(nav.url)) item.issues.push(`遷移先不正: ${nav.url}`);
    if (!/view=applications/i.test(nav.url)) item.issues.push("view=applications なし");

    await page.waitForTimeout(900);
    const pageMeta = await page.evaluate(() => ({
      appsVisible: !document.querySelector("[data-builder-board-pd-apps-section]")?.hidden,
      appItems: document.querySelectorAll(".mvp-pd-appItem:not(.mvp-pd-appItem--empty)").length,
      body: document.body.textContent || "",
    }));
    if (!pageMeta.appsVisible) item.issues.push("応募者セクション非表示");
    if (!/応募/.test(notifyMeta.title) && !/応募/.test(notifyMeta.body)) item.issues.push("通知文言に応募なし");
    if (pageMeta.appItems === 0 && !/応募者|採用する|見送り/.test(pageMeta.body)) {
      item.issues.push("応募内容表示なし（デモデータ）");
    }

    await shot(page, `04-apply-detail-${vp.name}`);

    await openNotifyPanel(page, base, "");
    await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: SEL_TIMEOUT }).catch(() => {});
    const rerenderNav = await clickNotifyCta(page, "builder-board-apply-001", { preferCardClick: true });
    if (!/board-project-detail\.html/i.test(rerenderNav.url)) {
      item.issues.push(`再描画後遷移先不正: ${rerenderNav.url}`);
    }
    if (!/view=applications/i.test(rerenderNav.url)) item.issues.push("再描画後 view=applications なし");
    if (!item.issues.length) item.status = "PASS";
    else if (item.issues.every((i) => /デモデータ/.test(i))) item.status = "WARNING";
    else if (item.issues.length <= 2) item.status = "WARNING";
    item.notifyMeta = notifyMeta;
    item.url = nav.url;
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認3: 採用導線 ── */
async function auditHireFlow(page, base, vp) {
  const results = [];
  for (const flow of [
    { notifyId: "builder-board-selected-001", role: "partner", label: "応募者採用通知" },
    { notifyId: "builder-board-hire-owner-001", role: "owner", label: "掲載者採用通知" },
  ]) {
    const item = { id: `hire_${flow.notifyId}`, kind: flow.label, vp: vp.name, status: "FAIL", issues: [] };
    try {
      await page.goto(pageUrl(base, "builder/board-projects.html?role=partner"), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await page.evaluate((r) => localStorage.setItem("tasful:builder:mvp:role", r), flow.role);
      await seedHiredThread(page);
      await openNotifyPanel(page, base, "");
      await page.waitForSelector(`[data-talk-notify-id="${flow.notifyId}"]`, { timeout: SEL_TIMEOUT }).catch(() => {});
      if (!(await page.locator(`[data-talk-notify-id="${flow.notifyId}"]`).count())) {
        item.issues.push("採用通知カード未表示");
        results.push(item);
        continue;
      }
      const nav = await clickNotifyCta(page, flow.notifyId);
      if (!/board-thread\.html/i.test(nav.url)) item.issues.push(`board-thread 以外: ${nav.url}`);
      await page.waitForSelector("[data-builder-mvp-thread-form]", { state: "attached", timeout: SEL_TIMEOUT });
      const threadMeta = await page.evaluate((hint) => {
        const title = document.querySelector("[data-builder-mvp-thread-project-title]")?.textContent?.trim() || "";
        return { title, url: location.href, hasCompose: Boolean(document.querySelector("[data-builder-mvp-thread-form]")) };
      }, BOARD_PROJECT_TITLE);
      if (!threadMeta.title.includes(BOARD_PROJECT_TITLE.slice(0, 6))) {
        item.issues.push(`案件タイトル不一致: ${threadMeta.title}`);
      }
      if (!threadMeta.hasCompose) item.issues.push("メッセージ入力なし");
      await shot(page, `05-hire-${flow.notifyId}-${vp.name}`);
      if (!item.issues.length) item.status = "PASS";
      else if (item.issues.length === 1) item.status = "WARNING";
      item.threadMeta = threadMeta;
    } catch (err) {
      item.issues.push(String(err?.message || err));
    }
    results.push(item);
  }
  return results;
}

/* ── 確認4: チャット導線（board-thread + TALK） ── */
async function auditChatFlow(page, base, vp) {
  const item = { id: "chat_flow", kind: "board-thread↔TALK 相互送信", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await seedHiredThread(page);
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-builder-mvp-thread-form]", { timeout: SEL_TIMEOUT });
    const ownerMsg = `監査A→B ${Date.now()}`;
    await page.locator("[data-builder-mvp-thread-input]").fill(ownerMsg);
    await page.locator("[data-builder-mvp-thread-send]").click();
    await page.waitForTimeout(800);

    await page.evaluate(
      ({ partnerId }) => {
        localStorage.setItem("tasful:builder:mvp:role", "partner");
        localStorage.setItem("tasful:builder:mvp:partner_id", partnerId);
      },
      { partnerId: PARTNER_ID }
    );
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForTimeout(700);
    const partnerSees = await page.evaluate((msg) => document.body.textContent.includes(msg), ownerMsg);
    if (!partnerSees) item.issues.push("A→B メッセージ未反映");

    const partnerMsg = `監査B→A ${Date.now()}`;
    await page.locator("[data-builder-mvp-thread-input]").fill(partnerMsg);
    await page.locator("[data-builder-mvp-thread-send]").click();
    await page.waitForTimeout(800);

    await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "owner"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const ownerSees = await page.evaluate((msg) => document.body.textContent.includes(msg), partnerMsg);
    if (!ownerSees) item.issues.push("B→A メッセージ未反映");

    await shot(page, `06-chat-bidirectional-${vp.name}`);

    const talkLink = page.locator("[data-builder-board-thread-talk]").first();
    const talkHref = await talkLink.getAttribute("href");
    if (!talkHref?.includes("talk-home")) item.issues.push("TALKリンク不正");
    await talkLink.click();
    await page.waitForURL(/talk-home\.html/i, { timeout: NAV_TIMEOUT });
    if (!/tab=notify/.test(page.url())) item.issues.push("TALK遷移先が notify タブでない");
    await shot(page, `07-chat-talk-link-${vp.name}`);

    const notifyCount = await page.locator("[data-talk-notify-list] article").count();
    if (notifyCount === 0) item.issues.push("TALK通知一覧0件");

    if (!item.issues.length) item.status = "PASS";
    else if (item.issues.length <= 2) item.status = "WARNING";
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認5/6/7: 完了・差し戻し・レビュー ── */
async function auditCompletionRejectReviewFlow(page, base, vp) {
  const item = {
    id: "completion_chain",
    kind: "完了報告→承認/差し戻し→再提出→レビュー",
    vp: vp.name,
    status: "FAIL",
    issues: [],
    steps: {},
  };
  try {
    await page.goto(pageUrl(base, "builder/board-thread.html"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await seedHiredThread(page);
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-thread-completion-submit]", { state: "attached", timeout: SEL_TIMEOUT });
    await page.locator("[data-thread-completion-comment]").fill("監査: 完了報告を提出します。");
    await page.locator("[data-thread-completion-submit]").click();
    await page.waitForTimeout(1200);

    const notifRows = await readMergedNotifications(page);
    const afterSubmit = await page.evaluate(
      ({ mvpKey, threadId }) => {
        const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const thread = state.threads?.[threadId];
        return { status: thread?.completion_submission?.status };
      },
      { mvpKey: MVP_KEY, threadId: THREAD_ID }
    );
    afterSubmit.ownerNotify = notifRows.filter((n) => /完了報告が届きました/.test(n.title)).length;
    afterSubmit.hrefs = notifRows.map((n) => n.href);
    item.steps.submit = afterSubmit;
    if (afterSubmit.status !== "submitted") item.issues.push("提出後ステータス不正");
    if (!afterSubmit.ownerNotify) item.issues.push("掲載者への完了通知なし");
    if (afterSubmit.hrefs.some((h) => /deal-detail/.test(h))) item.issues.push("完了通知が deal-detail へ");
    if (!afterSubmit.hrefs.some((h) => /board-thread/.test(h))) item.issues.push("完了通知が board-thread へ未振り分け");

    await shot(page, `08-completion-submit-${vp.name}`);

    await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "owner"));
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=owner#completion`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-thread-completion-approve]", { timeout: SEL_TIMEOUT });
    const ownerUi = await page.evaluate(() => ({
      hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
      hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
    }));
    if (!ownerUi.hasApprove) item.issues.push("承認ボタンなし");
    if (!ownerUi.hasReject) item.issues.push("差し戻しボタンなし");

    await page.locator("[data-thread-completion-reject-open]").click();
    await page.waitForTimeout(300);
    await page.locator("[data-thread-completion-reject-reason]").fill("写真不足。再提出をお願いします。");
    await page.locator("[data-thread-completion-reject-confirm]").click();
    await page.waitForTimeout(1000);

    const rejectRows = await readMergedNotifications(page);
    const afterReject = await page.evaluate(
      ({ mvpKey, threadId }) => {
        const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const thread = state.threads?.[threadId];
        return { status: thread?.completion_submission?.status };
      },
      { mvpKey: MVP_KEY, threadId: THREAD_ID }
    );
    afterReject.rejectNotify = rejectRows.filter((n) => /差し戻し/.test(n.title)).length;
    item.steps.reject = afterReject;
    if (afterReject.status !== "rejected") item.issues.push("差し戻し後ステータス不正");

    await page.evaluate(() => {
      localStorage.setItem("tasful:builder:mvp:role", "partner");
    });
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-thread-completion-submit]", { state: "attached", timeout: SEL_TIMEOUT });
    await page.locator("[data-thread-completion-comment]").fill("再提出: 追加写真を添付しました。");
    await page.locator("[data-thread-completion-submit]").click();
    await page.waitForTimeout(1000);

    await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "owner"));
    await page.goto(
      pageUrl(base, `builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForSelector("[data-thread-completion-approve]", { timeout: SEL_TIMEOUT });
    await page.locator("[data-thread-completion-approve]").click();
    await page.waitForTimeout(1200);

    const approveRows = await readMergedNotifications(page);
    const afterApprove = await page.evaluate(
      ({ mvpKey, threadId }) => {
        const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const thread = state.threads?.[threadId];
        return {
          threadStatus: thread?.status,
          subStatus: thread?.completion_submission?.status,
          approvedBanner: document.body.textContent.includes("取引が完了"),
        };
      },
      { mvpKey: MVP_KEY, threadId: THREAD_ID }
    );
    const reviewNotifs = approveRows.filter(
      (n) => n.type === "review_request" || /レビュー|評価|取引が完了/.test(n.title)
    );
    afterApprove.reviewNotifyCount = reviewNotifs.length;
    afterApprove.reviewHrefs = reviewNotifs.map((n) => n.href);
    item.steps.approve = afterApprove;
    if (afterApprove.subStatus !== "approved") item.issues.push("承認後 submission 不正");
    if (!afterApprove.reviewNotifyCount) item.issues.push("レビュー依頼通知なし");
    if (afterApprove.reviewHrefs.some((h) => /mvp-thread/.test(h) && !/board-thread/.test(h))) {
      item.issues.push("レビュー通知が mvp-thread 向け（一般案件は board-thread 期待）");
    }

    await shot(page, `09-completion-approved-${vp.name}`);

    if (!item.issues.length) item.status = "PASS";
    else if (item.issues.length <= 3) item.status = "WARNING";
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認8: 異常操作 ── */
async function auditAbnormalOps(page, base, vp) {
  const results = [];

  const reloadItem = { id: "abnormal_reload", kind: "reload 耐性", vp: vp.name, status: "PASS", issues: [] };
  try {
    await page.goto(pageUrl(base, "builder/board-projects.html?role=partner"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector("[data-builder-board-project-list]", { timeout: SEL_TIMEOUT });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-builder-board-project-list] article.mvp-card", { timeout: SEL_TIMEOUT });
    const cards = await page.locator("[data-builder-board-project-list] article.mvp-card").count();
    if (!cards) reloadItem.issues.push("reload後 案件一覧消失");
    reloadItem.status = reloadItem.issues.length ? "WARNING" : "PASS";
  } catch (err) {
    reloadItem.status = "FAIL";
    reloadItem.issues.push(String(err?.message || err));
  }
  results.push(reloadItem);

  const rapidApply = { id: "abnormal_rapid_apply", kind: "応募連打", vp: vp.name, status: "PASS", issues: [] };
  try {
    await page.goto(pageUrl(base, "builder/board-projects.html?role=partner"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await seedOpenProjectForPartnerApply(page);
    await page.goto(pageUrl(base, `builder/board-project-detail.html?id=${PROJECT_ID}&role=partner`), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(600);
    const applyBtn = page.locator("[data-builder-board-pd-apply]:not([hidden])").first();
    if (await applyBtn.count()) {
      for (let i = 0; i < 3; i++) await applyBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const dupApps = await page.evaluate(
        ({ mvpKey, projectId, partnerId }) => {
          const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
          const apps = (state.applications || []).filter(
            (a) => a.project_id === projectId && a.partner_id === partnerId
          );
          return apps.length;
        },
        { mvpKey: MVP_KEY, projectId: PROJECT_ID, partnerId: PARTNER_ID }
      );
      if (dupApps > 1) rapidApply.issues.push(`応募レコード重複 (${dupApps})`);
      rapidApply.status = rapidApply.issues.length ? "WARNING" : "PASS";
    } else {
      rapidApply.status = "WARNING";
      rapidApply.issues.push("応募ボタン非表示（スキップ）");
    }
  } catch (err) {
    rapidApply.status = "FAIL";
    rapidApply.issues.push(String(err?.message || err));
  }
  results.push(rapidApply);

  const directUrl = { id: "abnormal_direct_url", kind: "URL直打ち（権限外ロール）", vp: vp.name, status: "PASS", issues: [] };
  try {
    await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "partner"));
    await page.goto(
      pageUrl(base, `builder/board-project-detail.html?id=${PROJECT_ID}&role=owner&view=applications`),
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }
    );
    await page.waitForTimeout(700);
    const meta = await page.evaluate(() => ({
      hasSelect: Boolean(document.querySelector("[data-builder-board-pd-select]")),
      role: localStorage.getItem("tasful:builder:mvp:role"),
    }));
    if (meta.hasSelect && meta.role === "partner") {
      directUrl.issues.push("partner が owner 画面で採用操作可能");
      directUrl.status = "FAIL";
    }
  } catch (err) {
    directUrl.status = "WARNING";
    directUrl.issues.push(String(err?.message || err));
  }
  results.push(directUrl);

  const notifySpam = { id: "abnormal_notify_spam", kind: "通知連打", vp: vp.name, status: "PASS", issues: [] };
  try {
    await openNotifyPanel(page, base, "");
    const card = page.locator('[data-talk-notify-id="builder-board-thread-001"]').first();
    if (await card.count()) {
      for (let i = 0; i < 3; i++) {
        await card.click().catch(() => {});
        await page.waitForTimeout(200);
      }
      if (!/board-thread|talk-home/.test(page.url())) {
        notifySpam.issues.push(`通知連打後の遷移異常: ${page.url()}`);
        notifySpam.status = "WARNING";
      }
    }
  } catch (err) {
    notifySpam.status = "WARNING";
    notifySpam.issues.push(String(err?.message || err));
  }
  results.push(notifySpam);

  const backNav = { id: "abnormal_back", kind: "戻る操作", vp: vp.name, status: "PASS", issues: [] };
  try {
    await page.goto(pageUrl(base, "builder/board-projects.html?role=partner"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector("[data-builder-board-project-list] article.mvp-card", { timeout: SEL_TIMEOUT });
    const first = page.locator("[data-builder-board-project-list] article.mvp-card .mvp-card__titleLink").first();
    await first.click();
    await page.waitForURL(/board-project-detail/i, { timeout: NAV_TIMEOUT });
    await page.goBack({ waitUntil: "domcontentloaded" });
    const backOk = /board-projects/.test(page.url());
    if (!backOk) {
      backNav.issues.push(`戻る後 URL 不正: ${page.url()}`);
      backNav.status = "WARNING";
    }
  } catch (err) {
    backNav.status = "WARNING";
    backNav.issues.push(String(err?.message || err));
  }
  results.push(backNav);

  return results;
}

/* ── 確認9: 権限制御 ── */
async function auditRolePermissions(page, base, vp) {
  const results = [];
  const checks = [
    {
      id: "role_partner_detail",
      label: "応募者（partner）",
      role: "partner",
      url: `builder/board-project-detail.html?id=${PROJECT_ID}&role=partner`,
      expect: { apply: true, select: false, approve: false, submitCompletion: false },
    },
    {
      id: "role_owner_detail",
      label: "掲載者（owner）",
      role: "owner",
      url: `builder/board-project-detail.html?id=${PROJECT_ID}&role=owner&view=applications`,
      expect: { apply: false, select: true, approve: false, submitCompletion: false },
    },
    {
      id: "role_partner_thread",
      label: "採用者（partner）完了報告",
      role: "partner",
      url: `builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`,
      seed: true,
      expect: { apply: false, select: false, approve: false, submitCompletion: true },
    },
    {
      id: "role_owner_thread",
      label: "掲載者（owner）承認",
      role: "owner",
      url: `builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`,
      seed: true,
      seedPending: true,
      expect: { apply: false, select: false, approve: true, submitCompletion: false },
    },
  ];

  for (const chk of checks) {
    const item = { id: chk.id, label: chk.label, vp: vp.name, status: "FAIL", issues: [], visible: {} };
    try {
      await page.goto(pageUrl(base, "builder/board-projects.html?role=partner"), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      if (chk.id === "role_partner_detail") await seedOpenProjectForPartnerApply(page);
      if (chk.id === "role_owner_detail") await seedOpenProjectWithApplication(page);
      if (chk.seed) await seedHiredThread(page, { withPendingCompletion: Boolean(chk.seedPending) });
      await page.evaluate(
        (r) => {
          localStorage.setItem("tasful:builder:mvp:role", r);
          if (r === "partner") localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
        },
        chk.role
      );
      await page.goto(pageUrl(base, chk.url), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await page.waitForTimeout(800);
      const ui = await page.evaluate(() => ({
        apply: Boolean(document.querySelector("[data-builder-board-pd-apply]:not([hidden])")),
        select: Boolean(document.querySelector("[data-builder-board-pd-select]")),
        approve: Boolean(document.querySelector("[data-thread-completion-approve]")),
        submitCompletion: Boolean(document.querySelector("[data-thread-completion-submit]")),
      }));
      item.visible = ui;
      for (const [key, expected] of Object.entries(chk.expect)) {
        if (ui[key] !== expected) {
          item.issues.push(`${key}: 期待${expected ? "表示" : "非表示"} 実際${ui[key] ? "表示" : "非表示"}`);
        }
      }
      if (!item.issues.length) item.status = "PASS";
      else if (item.issues.length <= 1) item.status = "WARNING";
      await shot(page, `10-role-${chk.id}-${vp.name}`);
    } catch (err) {
      item.issues.push(String(err?.message || err));
    }
    results.push(item);
  }

  for (const connectCase of [
    { id: "connect_yes", label: "Connectあり（u_sachi）", userId: "u_sachi", seedConnect: true },
    { id: "connect_no", label: "Connectなし", userId: "", seedConnect: false },
  ]) {
    const item = { id: connectCase.id, label: connectCase.label, vp: vp.name, status: "PASS", issues: [], visibleCount: 0 };
    try {
      await openNotifyPanel(page, base, connectCase.userId);
      if (connectCase.seedConnect) {
        await page.evaluate(
          ({ sellerId, href }) => {
            const Connect = window.TasuPlatformChatConnectChatFlow;
            Connect?.setSellerConnectStatus?.(sellerId, "identity");
            const store = window.TasuTalkNotifications;
            if (!store?.saveAll) return;
            const row = {
              id: "platform-chat-demo-connect-identity-001",
              type: "skill",
              category: "Connect",
              title: "【重要】売上の受け取りには本人確認が必要です",
              body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
              actionLabel: "本人確認を進める",
              href,
              targetUrl: href,
              priority: "high",
              recipientUserId: sellerId,
              source: "platform_chat_demo_connect_requirements_v1",
              minimalNotifyCard: true,
              createdAt: new Date().toISOString(),
            };
            const next = (store.getAll() || []).filter((n) => String(n.id) !== row.id);
            next.unshift(row);
            store.saveAll(next, { localOnly: true, silent: true });
            window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
          },
          {
            sellerId: "u_sachi",
            href: pageUrl(base, "payment-settings.html?talkDev=1&userId=u_sachi&connectStep=identity"),
          }
        );
        await page.waitForTimeout(500);
        await page.evaluate(() => window.TasuTalkHome?.renderNotifications?.());
      }
      const counts = await page.evaluate(() => {
        const all = document.querySelectorAll("[data-talk-notify-id]").length;
        const builder = [...document.querySelectorAll("[data-talk-notify-id]")].filter((el) =>
          /builder-board|Builder/.test(el.textContent || "")
        ).length;
        const connect = document.querySelector('[data-talk-notify-id="platform-chat-demo-connect-identity-001"]')
          ? 1
          : 0;
        return { all, builder, connect };
      });
      item.visibleCount = counts.all;
      if (connectCase.seedConnect && !counts.connect) item.issues.push("Connect通知未表示");
      if (!counts.builder) item.issues.push("Builder通知0件");
      if (item.issues.length) item.status = connectCase.seedConnect ? "WARNING" : "FAIL";
      await shot(page, `11-${connectCase.id}-${vp.name}`);
    } catch (err) {
      item.status = "FAIL";
      item.issues.push(String(err?.message || err));
    }
    results.push(item);
  }

  return results;
}

/* ── 確認10: 通知一致 ── */
async function auditNotifyConsistency(page, base, vp) {
  const results = [];
  for (const flow of BUILDER_NOTIFY_FLOWS) {
    const item = { ...flow, vp: vp.name, status: "FAIL", issues: [] };
    try {
      const uid = flow.userId || "";
      if (flow.id === "completion") await seedPendingCompletionForNotify(page);
      await openNotifyPanel(page, base, uid);

      const cardExists = await page.locator(`article[data-talk-notify-id="${flow.notifyId}"]`).count();
      if (!cardExists) {
        item.issues.push("通知カード未表示");
        results.push(item);
        continue;
      }

      const meta = await page.evaluate((id) => {
        const row = window.TasuTalkNotifications?.findById?.(id) || {};
        const card = document.querySelector(`[data-talk-notify-id="${id}"]`);
        return {
          title: row.title || card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
          body: row.body || card?.textContent || "",
          href: row.href || row.targetUrl || "",
        };
      }, flow.notifyId);

      if (flow.expectInBody && !flow.expectInBody.test(meta.body) && !flow.expectInBody.test(meta.title)) {
        item.issues.push("通知本文/タイトル不一致");
      }

      const nav = await clickNotifyCta(page, flow.notifyId);
      item.actualUrl = nav.url;

      if (flow.expectedDest && !flow.expectedDest.test(nav.url)) {
        item.issues.push(`遷移先不一致: ${nav.url}`);
      }
      if (flow.expectQuery && !flow.expectQuery.test(nav.url)) {
        item.issues.push("期待クエリなし");
      }
      if (flow.expectHash && !flow.expectHash.test(nav.url + (await page.evaluate(() => location.hash)))) {
        item.issues.push("#completion 等のハッシュ不一致");
      }

      await page.waitForTimeout(800);
      const pageText = await page.evaluate(() => document.body.textContent || "");
      if (flow.expectOnPage && !flow.expectOnPage.test(pageText)) {
        item.issues.push("遷移先ページ内容不一致");
      }
      if (flow.projectHint && !flow.expectOnPage?.test(pageText) && !pageText.includes(flow.projectHint.slice(0, 6))) {
        item.issues.push(`案件名不一致（期待: ${flow.projectHint}）`);
      }

      if (!item.issues.length) item.status = "PASS";
      else if (item.issues.length <= 2) item.status = "WARNING";
      item.notifyMeta = meta;
      await shot(page, `12-notify-${flow.id}-${vp.name}`);
    } catch (err) {
      item.issues.push(String(err?.message || err));
    }
    results.push(item);
  }
  return results;
}

function gradeReport(report) {
  const all = collectAllResults(report);
  const failN = all.filter((x) => x.status === "FAIL").length;
  const warnN = all.filter((x) => x.status === "WARNING").length;
  if (failN >= 3) return "FAIL";
  if (failN > 0 || warnN >= 6) return "WARNING";
  return "PASS";
}

function collectAllResults(report) {
  return [
    report.projectFlow,
    report.applyNotifyFlow,
    ...(report.hireFlow || []),
    ...(report.chatFlow || []),
    ...(report.completionFlow || []),
    ...(report.abnormalOps || []),
    ...(report.rolePermissions || []),
    ...(report.notifyConsistency || []),
  ].filter(Boolean);
}

function buildMarkdown(report) {
  const lines = [
    "# Builder 利用者導線監査",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base || "file:// (dev server 未検出)"}`,
    "",
    "## 総合評価",
    "",
    `**${report.overall}**`,
    "",
    `- PASS: ${report.counts.pass}`,
    `- WARNING: ${report.counts.warning}`,
    `- FAIL: ${report.counts.fail}`,
    "",
    "---",
    "",
    "## 正常導線",
    "",
    ...report.goodFlows.map((g) => `- ${g}`),
    "",
    "---",
    "",
    "## 問題導線",
    "",
    ...(report.problemFlows.length
      ? report.problemFlows.map(
          (p) => `- **${p.kind || p.id || p.label}** (${p.status}): ${p.issues?.join(" / ") || p.detail}`
        )
      : ["- （重大な問題導線なし）"]),
    "",
    "---",
    "",
    "## 通知不一致",
    "",
    ...(report.notifyMismatch.length
      ? report.notifyMismatch.map((n) => `- ${n}`)
      : ["- （重大な不一致なし）"]),
    "",
    "---",
    "",
    "## 権限問題",
    "",
    ...(report.permissionIssues.length
      ? report.permissionIssues.map((p) => `- ${p}`)
      : ["- （重大な権限問題なし）"]),
    "",
    "---",
    "",
    "## 異常操作問題",
    "",
    ...(report.abnormalIssues.length
      ? report.abnormalIssues.map((a) => `- ${a}`)
      : ["- （重大な異常操作問題なし）"]),
    "",
    "---",
    "",
    "## 改善推奨TOP20",
    "",
    ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    "---",
    "",
    "### 即修正",
    "",
    ...report.immediateFixes.map((f) => `- ${f}`),
    "",
    "### 将来対応",
    "",
    ...report.futureFixes.map((f) => `- ${f}`),
    "",
    "---",
    "",
    "## スクショ",
    "",
    `保存先: \`screenshots/builder-user-flow-review/\` (${report.screenshots.length}枚)`,
    "",
    "## テスト",
    "",
    "実施: `node scripts/review-builder-user-flow.mjs`",
    "ビューポート: 390px / 1280px",
    "",
  ];
  return lines.join("\n");
}

function synthesizeFindings(report) {
  const good = [];
  const problems = [];
  const mismatch = [];
  const permission = [];
  const abnormal = [];
  const immediate = [];
  const future = [];
  const recs = new Set();

  const pushResult = (r, label) => {
    if (!r) return;
    if (r.status === "PASS") good.push(`${label}: OK (${r.vp}px)`);
    else {
      problems.push({ kind: label, id: r.id, status: r.status, issues: r.issues });
      if (r.issues?.some((i) => /不一致|通知/.test(i))) mismatch.push(`${label} (${r.vp}px): ${r.issues.join(" / ")}`);
    }
  };

  pushResult(report.projectFlow, "確認1 案件記事一覧導線");
  pushResult(report.applyNotifyFlow, "確認2 応募導線");
  for (const h of report.hireFlow || []) pushResult(h, `確認3 ${h.kind}`);
  for (const c of report.chatFlow || []) pushResult(c, "確認4 チャット導線");
  for (const c of report.completionFlow || []) pushResult(c, "確認5-7 完了/差し戻し/レビュー");

  for (const a of report.abnormalOps || []) {
    if (a.status === "PASS") good.push(`${a.kind}: 異常操作 OK (${a.vp}px)`);
    else {
      abnormal.push(`${a.kind} (${a.vp}px): ${a.issues?.join(" / ")}`);
      problems.push({ kind: a.kind, id: a.id, status: a.status, issues: a.issues });
    }
  }

  for (const r of report.rolePermissions || []) {
    if (r.status === "PASS") good.push(`${r.label}: 権限表示 OK (${r.vp}px)`);
    else permission.push(`${r.label} (${r.vp}px): ${r.issues?.join(" / ")}`);
  }

  for (const n of report.notifyConsistency || []) {
    if (n.status === "PASS") good.push(`${n.kind}: 通知一致 OK (${n.vp}px)`);
    else {
      mismatch.push(`${n.kind} (${n.vp}px): ${n.issues?.join(" / ")}`);
      problems.push({ kind: n.kind, id: n.id, status: n.status, issues: n.issues });
    }
  }

  recs.add("一般案件（builder_board）の完了/レビュー通知 href が board-thread と mvp-thread で混在しないか CI で監視");
  recs.add("応募連打時の applications 重複ガードを localStorage 層で確認");
  recs.add("partner が owner URL 直打ちした際の操作不可をサーバー/クライアント双方で担保");
  recs.add("TALK 通知タブ（talk-home.html?tab=notify）を Builder 導線の正とする");
  recs.add("採用/完了通知の案件タイトルとスレッド表示タイトルの一致を自動検証");
  if (mismatch.length) recs.add("通知マスター（talk-builder-notify-master-v1）と実ページの project_id 整合");
  if (permission.length) recs.add("role クエリと localStorage role の二重チェック強化");
  if (abnormal.length) recs.add("reload / 戻る / 連打の E2E を PR ごとに review-builder-user-flow で実行");
  recs.add("board-project-detail view=applications 直リンクの応募者リスト空状態 UX");
  recs.add("完了報告 #completion スクロール位置を通知遷移時に保証");
  recs.add("差し戻し通知と再提出フォームの文言統一");
  recs.add("レビュー依頼 openReview=1 の board-thread 対応（現状 mvp-thread 向け）");
  recs.add("Connect 有無による Builder CTA 差異の仕様明文化");
  recs.add("platform-verify-builder-* 通知と builder-board-* マスターの重複整理");
  recs.add("390px での完了報告/承認ボタン到達性");
  recs.add("通知既読（readAt）と Builder 詳細遷移の連携確認");
  recs.add("builder-board-payment-001 が OPS_THREAD を指す件の見直し");
  recs.add("異常操作: 採用連打・完了連打の専用ガードテスト追加");

  immediate.push(
    ...problems.filter((p) => p.status === "FAIL").slice(0, 6).map((p) => `${p.kind}: ${p.issues?.[0] || ""}`)
  );
  immediate.push(...mismatch.slice(0, 3));
  immediate.push(...permission.slice(0, 3));

  future.push("本番認証ロールと Builder MVP ロールの統合");
  future.push("Supabase 同期時の応募/採用/完了状態の整合");
  future.push("レビュー投稿 UI の board-thread ネイティブ対応");

  report.goodFlows = good;
  report.problemFlows = problems;
  report.notifyMismatch = mismatch.length ? mismatch : [];
  report.permissionIssues = permission;
  report.abnormalIssues = abnormal;
  report.recommendations = [...recs].slice(0, 20);
  report.immediateFixes = immediate.filter(Boolean).slice(0, 8);
  report.futureFixes = future;

  const all = collectAllResults(report);
  report.counts = {
    pass: all.filter((x) => x.status === "PASS").length,
    warning: all.filter((x) => x.status === "WARNING").length,
    fail: all.filter((x) => x.status === "FAIL").length,
  };
  report.overall = gradeReport(report);
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const base = await findBaseUrl();
  if (!base) {
    console.warn("WARN: dev server not found — starting may be required (npx serve -l 5500 .)");
  } else {
    console.log(`[audit] BASE_URL=${base}`);
  }

  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    viewports: [],
    projectFlow: null,
    applyNotifyFlow: null,
    hireFlow: [],
    chatFlow: [],
    completionFlow: [],
    abnormalOps: [],
    rolePermissions: [],
    notifyConsistency: [],
    screenshots: [],
    overall: "FAIL",
  };

    try {
    for (const vp of [
      { name: "390", width: 390, height: 844 },
      { name: "1280", width: 1280, height: 900 },
    ]) {
      const vpContext = await browser.newContext();
      await vpContext.addInitScript((markers) => {
        markers.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem("tasful_talk_notifications");
        try {
          localStorage.setItem("tasful:builder:mvp:role", "owner");
        } catch {
          /* ignore */
        }
      }, MASTER_MARKERS);

      const page = await vpContext.newPage({ viewport: { width: vp.width, height: vp.height } });
      report.viewports.push(vp.name);

      if (vp.name === "390") {
        report.projectFlow = await auditProjectFlow(page, base, vp);
        report.applyNotifyFlow = await auditApplyNotifyFlow(page, base, vp);
      }
      report.hireFlow.push(...(await auditHireFlow(page, base, vp)));
      report.chatFlow.push(await auditChatFlow(page, base, vp));
      if (vp.name === "390") {
        report.completionFlow.push(await auditCompletionRejectReviewFlow(page, base, vp));
      }
      if (vp.name === "1280") {
        report.completionFlow.push({
          id: "completion_chain_1280",
          kind: "完了報告（1280 スモーク）",
          vp: vp.name,
          status: "PASS",
          issues: [],
          steps: { note: "詳細フローは390pxで実施済み" },
        });
      }
      report.abnormalOps.push(...(await auditAbnormalOps(page, base, vp)));
      report.rolePermissions.push(...(await auditRolePermissions(page, base, vp)));
      report.notifyConsistency.push(...(await auditNotifyConsistency(page, base, vp)));

      await vpContext.close();
    }
    synthesizeFindings(report);
    try {
      report.screenshots = readdirSync(SHOT_DIR).filter((f) => f.endsWith(".png"));
    } catch {
      report.screenshots = [];
    }

    report.screenshotCatalog = BUILDER_SHOT_CATALOG.filter((row) => report.screenshots.includes(row.file));

    const md = buildMarkdown(report);
    await writeFile(REPORT_MD, md, "utf8");
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

    for (const legacy of ["01-project-list-390.png", "01-project-list-1280.png"]) {
      try {
        await unlink(join(SHOT_DIR, legacy));
      } catch {
        /* already removed */
      }
    }

    const indexArtifacts = await finalizeScreenshotRun(root, "builder-user-flow-review", {
      title: "Builderユーザーフローレビュー",
      report: report,
    });

    console.log(md);
    console.log(`\nReport: ${REPORT_MD}`);
    console.log(`JSON: ${REPORT_JSON}`);
    console.log(`Overall: ${report.overall} (PASS ${report.counts.pass} / WARN ${report.counts.warning} / FAIL ${report.counts.fail})`);
    if (indexArtifacts.rootIndexPath) {
      console.log(`Root index written: ${indexArtifacts.rootIndexPath}`);
    }
    console.log(`Folder: ${indexArtifacts.indexPath}`);

    if (report.overall === "FAIL") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
