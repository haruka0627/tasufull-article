#!/usr/bin/env node
/**
 * Builder通知・取引チャット — 最終UX監査（調査・キャプチャ・レポートのみ）
 *   node scripts/capture-builder-final-review.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { renderScreenshotBackNav, SCREENSHOT_BACK_NAV_CSS } from "./lib/screenshot-image-viewer.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = path.join(root, "screenshots", "builder-final-review");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const MVP_KEY = "tasful:builder:mvp:v1";
const THREAD_ID = "thread-demo-001";
const OPS_THREAD_ID = "builder_thread_demo_001";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications",
  "tasful_talk_notifications_seeded_v2",
];

/** @type {Array<{ key: string, label: string, notifyIds: string[], navId: string }>} */
const BUILDER_NOTIFY_CATEGORIES = [
  {
    key: "apply",
    label: "応募通知",
    notifyIds: ["builder-board-apply-001", "platform-verify-job-full-apply-001"],
    navId: "builder-board-apply-001",
  },
  {
    key: "hired",
    label: "採用通知",
    notifyIds: ["platform-verify-builder-hired-001", "builder-board-selected-001"],
    navId: "platform-verify-builder-hired-001",
  },
  {
    key: "message",
    label: "メッセージ開始通知",
    notifyIds: ["platform-verify-job-full-poster-start-001", "builder-board-thread-001"],
    navId: "platform-verify-job-full-poster-start-001",
  },
  {
    key: "completion_notify",
    label: "完了報告通知",
    notifyIds: ["platform-verify-builder-completion-001", "builder-board-completion-001"],
    navId: "platform-verify-builder-completion-001",
  },
  {
    key: "review_notify",
    label: "レビュー通知",
    notifyIds: ["platform-verify-job-full-review-001"],
    navId: "platform-verify-job-full-review-001",
  },
  {
    key: "publish",
    label: "案件公開通知",
    notifyIds: ["platform-verify-builder-publish-001", "builder-board-publish-001"],
    navId: "platform-verify-builder-publish-001",
  },
];

const NAV_PROBE_IDS = [
  { id: "platform-verify-job-full-apply-001", label: "応募" },
  { id: "builder-board-apply-001", label: "応募（Builder board）" },
  { id: "platform-verify-builder-hired-001", label: "採用" },
  { id: "platform-verify-builder-completion-001", label: "完了報告" },
  { id: "platform-verify-job-full-review-001", label: "レビュー" },
];

function resolveOverall(failCount, minorCount) {
  if (failCount > 0) return "FAIL";
  if (minorCount > 0) return "MINOR";
  return "PASS";
}

function countVerdicts(items = []) {
  return {
    failCount: items.filter((i) => i.verdict === "FAIL").length,
    minorCount: items.filter((i) => i.verdict === "MINOR").length,
    passCount: items.filter((i) => i.verdict === "PASS").length,
  };
}

function talkNotifyUrl(base, userId = "u_me") {
  return buildLocalPageUrl(
    base,
    `talk-home.html?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

function seedBoardNormalChat() {
  return {
    version: 1,
    owner_id: "demo-owner-001",
    partners: [{ partner_id: "demo-partner-001", display_name: "株式会社オレンジ建装" }],
    projects: [
      {
        project_id: "demo-project-001",
        owner_id: "demo-owner-001",
        title: "新宿区 共同住宅 外装改修",
        kind: "builder_board",
        board_type: "project",
        projectKind: "project",
        status: "open",
        required_partners: 1,
        selected_partner_ids: ["demo-partner-001"],
        main_thread_id: THREAD_ID,
        created_at: "2026-05-25T10:10:00+09:00",
      },
    ],
    specs: { "demo-project-001": { overview: "外装改修" } },
    threads: {
      [THREAD_ID]: {
        thread_id: THREAD_ID,
        project_id: "demo-project-001",
        thread_kind: "board_match",
        status: "in_progress",
        events: [{ type: "created", ts: "2026-05-25T01:10:00.000Z", text: "案件を投稿しました（demo）" }],
        messages: [
          {
            msg_id: "msg-demo-001",
            from: { id: "demo-owner-001", type: "owner", name: "TASFUL運営" },
            ts: "2026-05-25T01:12:00.000Z",
            text: "よろしくお願いします。条件確認はTalkで。",
          },
          {
            msg_id: "msg-demo-002",
            from: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
            ts: "2026-05-26T04:15:00.000Z",
            text: "承知しました。14時に伺います。",
          },
        ],
        siteData: { photos: [], completed: false },
      },
    },
    applications: [
      {
        application_id: "app-demo-001",
        project_id: "demo-project-001",
        partner_id: "demo-partner-001",
        status: "selected",
        ts: "2026-05-28T02:00:00.000Z",
      },
    ],
  };
}

function seedBoardCompletionChat() {
  const state = seedBoardNormalChat();
  state.threads[THREAD_ID].status = "completion_pending";
  state.threads[THREAD_ID].completion_submission = {
    status: "submitted",
    comment: "足場工事が完了しました。写真・請求書を添付します。",
    attachments: [{ name: "作業報告書.pdf", type: "pdf" }],
    photos: [
      { name: "完了写真_01.jpg", type: "image" },
      { name: "完了写真_02.jpg", type: "image" },
    ],
    invoice: { name: "請求書.pdf", type: "pdf" },
    submitted_at: new Date().toISOString(),
    submitted_by: { id: "demo-partner-001", type: "partner", name: "株式会社オレンジ建装" },
  };
  state.threads[THREAD_ID].events.push({
    type: "completion_requested",
    ts: new Date().toISOString(),
    text: "完了報告を提出しました。",
  });
  return state;
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
    globalThis.__tasuTalkNotificationsBootstrapped = false;
  }, { markers: MASTER_MARKERS });
}

async function openNotifyCenter(page, base, userId = "u_me") {
  await page.goto(talkNotifyUrl(base, userId), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-talk-panel="notify"]');
      return panel && !panel.hidden && document.querySelectorAll("[data-talk-notify-id]").length > 0;
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(800);
}

async function extractNotifyAudit(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 2) issues.push(`横スクロール (${scrollW}px > ${doc.clientWidth}px)`);

    const cards = [...document.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const id = el.getAttribute("data-talk-notify-id") || "";
      return chip === "Builder" || chip === "求人" || /^builder-|^platform-verify-builder|^platform-verify-job/.test(id);
    });

    const sections = [...document.querySelectorAll(".talk-notify-section")].map((s) => ({
      title: s.querySelector(".talk-notify-section__title")?.textContent?.trim() || "",
      count: s.querySelectorAll("[data-talk-notify-id]").length,
    }));

    const cardRows = cards.map((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      const rect = el.getBoundingClientRect();
      const title = el.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const cta = el.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__card-cta");
      const ctaRect = cta?.getBoundingClientRect();
      const row =
        window.TasuTalkNotifications?.findById?.(id) ||
        (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find((n) => n.id === id);
      const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
      const href = String(
        cta?.getAttribute("href") ||
          cta?.getAttribute("data-talk-notify-href") ||
          built?.href ||
          row?.href ||
          row?.targetUrl ||
          ""
      ).trim();
      return {
        id,
        title,
        chip,
        cardWidth: Math.round(rect.width),
        ctaHeight: ctaRect ? Math.round(ctaRect.height) : 0,
        ctaWidth: ctaRect ? Math.round(ctaRect.width) : 0,
        ctaWidthPct: ctaRect && rect.width ? Math.round((ctaRect.width / rect.width) * 100) : 0,
        isCtaOnly: el.classList.contains("talk-notify-card--cta-only"),
        isJobDetails: el.classList.contains("talk-notify-card--job-details"),
        href,
        tier: el.closest(".talk-notify-section--important") ? "important" : "normal",
      };
    });

    const gaps = [];
    const allCards = [...document.querySelectorAll("[data-talk-notify-id]")];
    for (let i = 1; i < allCards.length; i += 1) {
      const prev = allCards[i - 1].getBoundingClientRect();
      const cur = allCards[i].getBoundingClientRect();
      gaps.push(Math.round(cur.top - prev.bottom));
    }

    const cardsInFv = allCards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.top < window.innerHeight * 0.9;
    }).length;

    for (const c of cardRows) {
      if (vpLabel === "390" && c.ctaHeight > 0 && !c.isCtaOnly && (c.chip === "Builder" || c.isJobDetails)) {
        if (c.ctaHeight > 44) minors.push(`CTA高さ過大 ${c.ctaHeight}px: ${c.id}`);
        if (c.ctaWidth > 140) minors.push(`CTA幅過大 ${c.ctaWidth}px: ${c.id}`);
        if (c.ctaWidthPct >= 88) minors.push(`CTA幅比率過大 ${c.ctaWidthPct}%: ${c.id}`);
      }
    }

    return {
      builderCardCount: cards.length,
      totalCardCount: allCards.length,
      sections,
      cards: cardRows,
      cardGapsPx: gaps.slice(0, 16),
      cardsInFirstViewport: cardsInFv,
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
}

async function extractStoreRows(page) {
  return page.evaluate(() => {
    const pickHref = (n) => String(n?.href || n?.targetUrl || "#").trim();
    return (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || []).map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category || "",
      actionLabel: n.actionLabel || "",
      href: pickHref(n),
      projectTitle: n.projectTitle || n.notifyListingTitle || "",
    }));
  });
}

async function probeHref(request, base, href) {
  const raw = String(href || "").trim();
  if (!raw || raw === "#") return { ok: false, status: 0, error: "empty_href" };
  try {
    const url = new URL(raw, base.endsWith("/") ? base : `${base}/`);
    const res = await request.get(url.toString(), { timeout: 15000, maxRedirects: 5 });
    return { ok: res.status() >= 200 && res.status() < 400, status: res.status(), url: url.pathname + url.search + url.hash };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

async function auditChatPage(page, sceneKey, vpLabel) {
  return page.evaluate(
    ({ sceneKey, vpLabel }) => {
      const issues = [];
      const minors = [];
      const doc = document.documentElement;
      const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
      if (scrollW > doc.clientWidth + 2) issues.push(`横スクロール (${scrollW}px)`);

      const visible = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden) return false;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const text = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() || "";

      const projectTitle =
        text("[data-builder-mvp-thread-project-title]") ||
        text(".mvp-slack-thread__title") ||
        text("#chatTitle") ||
        text(".builder-board-thread__title");
      const partner =
        text(".mvp-slack-thread__meta") ||
        text("#chatSub") ||
        text(".builder-board-thread__partner");
      const hasMessages = Boolean(
        document.querySelectorAll(".mvp-slack-thread__msgs li, [data-builder-mvp-thread-msgs] li, .mvp-slack-thread__message").length ||
          /メッセージ\s*\d+\s*件/.test(partner) ||
          document.querySelectorAll("#chatMessages .chat-card, .chat-card").length
      );
      const composeVisible = visible(".mvp-slack-thread__compose, #chatInput, .mvp-thread-compose");

      const completion = {
        hasApprove: visible("[data-thread-completion-approve]"),
        hasReject: visible("[data-thread-completion-reject-open]"),
        hasPhotos: /完了写真|写真/.test(document.body.textContent || ""),
        hasReport: /報告書|作業報告|請求書/.test(document.body.textContent || ""),
        summary: text(".mvp-thread-completion__summary, [data-thread-completion-card]"),
      };

      const reviewCue = /評価|レビュー|review/i.test(document.body.textContent || "");
      const reviewInput = visible("[data-chat-review-form], .chat-review, #reviewSection, textarea[name='review']");

      const fixedBar = document.querySelector(
        ".mvp-slack-thread__compose, .mvp-thread-compose, [data-shop-store-checkout-bar-mobile], .talk-line-room-header--fixed"
      );
      const fixedRect = fixedBar?.getBoundingClientRect();
      let ctaOverlap = null;
      if (vpLabel === "390" && fixedRect && fixedRect.height > 8) {
        const main = document.querySelector(".mvp-slack-thread__body, #chatMessages, .builder-board-thread__main");
        const mainRect = main?.getBoundingClientRect();
        if (mainRect && mainRect.bottom > fixedRect.top + 2) {
          ctaOverlap = Math.round(mainRect.bottom - fixedRect.top);
          minors.push(`固定バーと本文重なり gap ${ctaOverlap}px`);
        }
      }

      if (sceneKey === "board-thread" || sceneKey === "mvp-thread" || sceneKey === "chat-detail") {
        if (!projectTitle) minors.push("案件名の視認性が弱い");
        if (!partner && sceneKey !== "chat-detail") minors.push("相手情報が弱い");
        if (!hasMessages && sceneKey === "board-thread") minors.push("メッセージが表示されていない");
      }

      if (sceneKey === "completion") {
        if (!completion.hasApprove) issues.push("承認ボタンなし");
        if (!completion.hasReject) minors.push("差し戻しボタンなし");
        if (!completion.hasPhotos) minors.push("完了写真の視認性が弱い");
        if (!completion.hasReport) minors.push("報告書の視認性が弱い");
      }

      if (sceneKey === "review") {
        if (!reviewCue && !reviewInput) minors.push("レビュー導線が弱い");
      }

      const reviewInChat = document.querySelector(
        "[data-platform-review-open], [data-platform-job-review-open], .chat-job-review-prompt__btn, [data-platform-job-review-prompt], [data-builder-mvp-thread-review-open], [data-builder-mvp-thread-review-prompt]"
      );
      if (
        (sceneKey === "mvp-thread" || sceneKey === "chat-detail") &&
        reviewInChat &&
        !document.querySelector("[data-chat-review-form], .chat-review-modal, [data-builder-mvp-thread-review-modal]:not([hidden])")
      ) {
        issues.push("完了済みチャット内にレビューCTAが残っている");
      }

      if (vpLabel === "1280") {
        const main = document.querySelector("main, .mvp-slack-thread, .builder-board-thread, #chatMain");
        const mainW = main?.getBoundingClientRect().width || 0;
        const vw = doc.clientWidth;
        if (mainW > 0 && mainW < vw * 0.45) minors.push(`メイン幅が狭く間延び (${Math.round(mainW)}px / ${vw}px)`);
        const deadRight = vw - (main?.getBoundingClientRect().right || vw);
        if (deadRight > vw * 0.35) minors.push(`右デッドスペース ${Math.round(deadRight)}px`);
      }

      const priority = {
        projectTitle: Boolean(projectTitle),
        partner,
        messages: hasMessages,
        completion: sceneKey === "completion",
        compose: composeVisible,
      };

      return {
        projectTitle,
        partner,
        hasMessages,
        composeVisible,
        completion,
        reviewCue,
        priority,
        ctaOverlap,
        issues: [...new Set(issues)],
        minors: [...new Set(minors)],
      };
    },
    { sceneKey, vpLabel }
  );
}

function buildGeminiChecklist(notifyAudit, navChecks, chatPages, vpLabel) {
  const navFail = navChecks.filter((n) => n.verdict === "FAIL").length;
  const navPass = navChecks.filter((n) => n.verdict === "PASS").length;
  const ctaMinors = (notifyAudit?.minors || []).filter((m) => /CTA/.test(m));
  const overlapGaps = (notifyAudit?.cardGapsPx || []).filter((g) => g < -2);

  const completionPage = chatPages.find((p) => p.sceneKey === "completion" && p.viewport === vpLabel);
  const reviewPage = chatPages.find((p) => p.sceneKey === "review" && p.viewport === vpLabel);
  const boardPage = chatPages.find((p) => p.sceneKey === "board-thread" && p.viewport === vpLabel);

  return [
    {
      item: "通知一覧の一覧性（Builder関連）",
      ok: (notifyAudit?.builderCardCount || 0) >= 6,
      note: `Builder/求人 ${notifyAudit?.builderCardCount || 0}件 / 全${notifyAudit?.totalCardCount || 0}件`,
    },
    {
      item: "CTAサイズ（390px・コンパクト）",
      ok: vpLabel !== "390" || ctaMinors.length === 0,
      note: ctaMinors.length ? ctaMinors.slice(0, 2).join(" / ") : "許容範囲",
    },
    {
      item: "通知→遷移 HTTP 200",
      ok: vpLabel !== "390" ? true : navFail === 0 && navPass >= 4,
      note: vpLabel !== "390" ? "390pxで検証" : `PASS ${navPass} / FAIL ${navFail}`,
    },
    {
      item: "取引チャット情報優先順位（案件名→相手→メッセージ）",
      ok: Boolean(boardPage?.audit?.priority?.projectTitle && boardPage?.audit?.hasMessages),
      note: boardPage?.audit?.projectTitle?.slice(0, 40) || "—",
    },
    {
      item: "完了報告の視認性（写真・報告書・承認・差し戻し）",
      ok: Boolean(
        completionPage?.audit?.completion?.hasApprove &&
          completionPage?.audit?.completion?.hasPhotos &&
          completionPage?.audit?.completion?.hasReport
      ),
      note: completionPage
        ? `承認${completionPage.audit.completion.hasApprove ? "✓" : "×"} 写真${completionPage.audit.completion.hasPhotos ? "✓" : "×"} 報告${completionPage.audit.completion.hasReport ? "✓" : "×"}`
        : "—",
    },
    {
      item: "完了→レビュー導線",
      ok: Boolean(reviewPage?.audit?.reviewInput || reviewPage?.audit?.reviewCue),
      note: reviewPage?.url || "chat-detail review",
    },
    {
      item: "390px 固定バー・横スクロール",
      ok:
        vpLabel !== "390" ||
        (!(notifyAudit?.issues || []).some((i) => /横スクロール/.test(i)) &&
          !(chatPages || []).some((p) => p.viewport === "390" && (p.audit?.ctaOverlap || 0) > 8)),
      note: overlapGaps.length ? `通知gap被り${overlapGaps.length}` : "問題なし",
    },
    {
      item: "1280px 間延び・デッドスペース",
      ok:
        vpLabel !== "1280" ||
        !(chatPages || []).some((p) => p.viewport === "1280" && (p.audit?.minors || []).some((m) => /間延び|デッド/.test(m))),
      note: "1280pxチャット幅を確認",
    },
  ];
}

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const report = {
  generatedAt: new Date().toISOString(),
  base,
  overall: "PASS",
  pages: [],
  notifyCategories: {},
  chatScenes: {},
  navigationChecks: [],
  uxReview: { byViewport: {}, geminiChecklist: [] },
  uiConcerns: [],
  fixPriorities: [],
  geminiShots: {},
};

await withPlaywrightBrowser(async (browser) => {const requestCtx = await browser.newContext();
const request = requestCtx.request;

/** @type {Array<{ sceneKey: string, viewport: string, audit: object, url: string }>} */
const chatPageAudits = [];

// --- 通知一覧（390 / 1280）---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await openNotifyCenter(page, base);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-notify-id]").length >= 10,
      { timeout: 45000 }
    );

    const audit = await extractNotifyAudit(page, vp.label);
    const storeRows = await extractStoreRows(page);

    const geminiFirst = `${vp.label}-gemini-first-view.png`;
    await page.screenshot({ path: path.join(OUT, geminiFirst), fullPage: false });
    const geminiList = `${vp.label}-gemini-notify-list.png`;
    await page.screenshot({ path: path.join(OUT, geminiList), fullPage: true });

    report.geminiShots[vp.label] = {
      firstView: geminiFirst,
      notifyList: geminiList,
    };

    for (const cat of BUILDER_NOTIFY_CATEGORIES) {
      const row = storeRows.find((r) => cat.notifyIds.includes(r.id));
      const found = audit.cards.find((c) => cat.notifyIds.includes(c.id));
      if (!report.notifyCategories[cat.key]) {
        report.notifyCategories[cat.key] = {
          label: cat.label,
          verdict: "PASS",
          items: [],
          issues: [],
          minors: [],
        };
      }
      const bucket = report.notifyCategories[cat.key];
      if (row || found) {
        bucket.items.push({
          id: row?.id || found?.id,
          title: row?.title || found?.title,
          href: row?.href || found?.href,
          viewport: vp.label,
        });
        const cardId = found?.id || row?.id;
        if (cardId) {
          const el = await page.$(`[data-talk-notify-id="${cardId}"]`);
          if (el) {
            await el.scrollIntoViewIfNeeded();
            await page.waitForTimeout(250);
            const shot = `${vp.label}-notify-${cat.key}.png`;
            await el.screenshot({ path: path.join(OUT, shot) });
            bucket.items[bucket.items.length - 1].shot = shot;
          }
        }
      } else {
        bucket.minors.push(`${vp.label}: カード未検出`);
      }
    }

    if (vp.label === "390") {
      const probed = new Set();
      for (const probe of NAV_PROBE_IDS) {
        if (probed.has(probe.label)) continue;
        const row = storeRows.find((r) => r.id === probe.id);
        if (!row) continue;
        probed.add(probe.label);
        const http = await probeHref(request, base, row.href);
        report.navigationChecks.push({
          id: row.id,
          label: probe.label,
          title: row.title,
          href: row.href,
          status: http.status,
          ok: http.ok,
          verdict: http.ok ? "PASS" : "FAIL",
        });
        if (!http.ok) {
          const cat = BUILDER_NOTIFY_CATEGORIES.find((c) => c.notifyIds.includes(row.id) || c.navId === row.id);
          if (cat && report.notifyCategories[cat.key]) {
            report.notifyCategories[cat.key].issues.push(`遷移先エラー HTTP ${http.status || http.error}`);
          }
        }
      }
    }

    const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
    report.pages.push({
      viewport: vp.label,
      stepId: `builder-notify-list-${vp.label}`,
      stepName: "Builder通知一覧",
      file: geminiFirst,
      verdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });

    report.uxReview.byViewport[vp.label] = {
      viewport: vp.label,
      notifyAudit: audit,
      geminiChecklist: buildGeminiChecklist(audit, report.navigationChecks, chatPageAudits, vp.label),
    };
  } catch (err) {
    report.pages.push({
      viewport: vp.label,
      stepId: `builder-notify-list-${vp.label}`,
      stepName: "Builder通知一覧",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

// --- 取引チャット ---
const CHAT_SCENES = [
  {
    key: "board-thread",
    label: "board-thread",
    path: `/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`,
    seed: seedBoardNormalChat(),
    geminiKey: "chat",
  },
  {
    key: "mvp-thread",
    label: "mvp-thread",
    path: `/builder/mvp-thread.html?thread_id=${OPS_THREAD_ID}&role=owner`,
    seed: null,
    geminiKey: null,
  },
  {
    key: "chat-detail",
    label: "chat-detail",
    path: "/chat-detail.html?thread=chat-demo-job-full-001&userId=u_job_demo_full&talkDev=1&review=job-full",
    seed: null,
    geminiKey: null,
  },
  {
    key: "completion",
    label: "完了報告",
    path: `/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner&from=talk#completion`,
    seed: seedBoardCompletionChat(),
    geminiKey: "completion",
  },
  {
    key: "review",
    label: "レビュー",
    path: "/chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full&from=notify&demoState=completed&openReview=1",
    seed: null,
    geminiKey: null,
  },
];

for (const scene of CHAT_SCENES) {
  if (!report.chatScenes[scene.key]) {
    report.chatScenes[scene.key] = { label: scene.label, verdict: "PASS", viewports: [], issues: [], minors: [] };
  }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      if (scene.seed) {
        await page.goto(buildLocalPageUrl(base, "builder/board-thread.html"), {
          waitUntil: "domcontentloaded",
        });
        await page.evaluate(
          ({ mvpKey, state }) => {
            localStorage.setItem(mvpKey, JSON.stringify(state));
            localStorage.setItem("tasful:builder:mvp:role", "owner");
          },
          { mvpKey: MVP_KEY, state: scene.seed }
        );
      }

      const url = buildLocalPageUrl(base, scene.path.replace(/^\//, ""));
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      if (scene.key === "completion") {
        await page.waitForSelector("[data-thread-completion-approve], .mvp-thread-completion__summary", {
          timeout: 30000,
        }).catch(() => {});
        await page.evaluate(() => {
          document.getElementById("completion")?.scrollIntoView({ block: "start" });
          const panel = document.querySelector("[data-builder-board-thread-completion-panel]");
          if (panel) panel.hidden = false;
        });
        await page.waitForTimeout(600);
      }
      if (scene.key === "chat-detail" || scene.key === "review") {
        await page.waitForSelector("#chatMessages, #chatInput, .chat-card", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
      if (scene.key === "mvp-thread") {
        await page.waitForSelector("[data-builder-mvp-thread-project-title], .mvp-slack-thread", {
          timeout: 20000,
        }).catch(() => {});
        await page.waitForTimeout(600);
      }
      if (scene.key === "board-thread") {
        await page.waitForSelector(".mvp-slack-thread__title, .mvp-slack-thread__body", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(500);
      }

      const audit = await auditChatPage(page, scene.key, vp.label);
      const fileViewport = `${vp.label}-${scene.key}-viewport.png`;
      await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
      const fileFull = `${vp.label}-${scene.key}-full.png`;
      await page.screenshot({ path: path.join(OUT, fileFull), fullPage: vp.width >= 960 });

      if (scene.geminiKey) {
        report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
        report.geminiShots[vp.label][scene.geminiKey] = fileViewport;
      }

      const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
      const row = {
        viewport: vp.label,
        file: fileViewport,
        fileFull,
        verdict,
        audit,
        url: scene.path,
      };
      report.chatScenes[scene.key].viewports.push(row);
      if (audit.issues.length) report.chatScenes[scene.key].issues.push(...audit.issues);
      if (audit.minors.length) report.chatScenes[scene.key].minors.push(...audit.minors);
      if (verdict === "FAIL") report.chatScenes[scene.key].verdict = "FAIL";
      else if (verdict === "MINOR" && report.chatScenes[scene.key].verdict === "PASS") {
        report.chatScenes[scene.key].verdict = "MINOR";
      }

      chatPageAudits.push({ sceneKey: scene.key, viewport: vp.label, audit, url: scene.path });

      report.pages.push({
        viewport: vp.label,
        stepId: `builder-chat-${scene.key}`,
        stepName: `取引チャット: ${scene.label}`,
        file: fileViewport,
        verdict,
        issues: audit.issues,
        minors: audit.minors,
        data: { projectTitle: audit.projectTitle, partner: audit.partner },
      });
    } catch (err) {
      const msg = String(err?.message || err);
      report.chatScenes[scene.key].viewports.push({
        viewport: vp.label,
        verdict: "FAIL",
        issues: [msg],
      });
      report.chatScenes[scene.key].verdict = "FAIL";
      report.pages.push({
        viewport: vp.label,
        stepId: `builder-chat-${scene.key}`,
        stepName: `取引チャット: ${scene.label}`,
        verdict: "FAIL",
        issues: [msg],
        minors: [],
      });
    } finally {
      await context.close();
    }
  }
}

await requestCtx.close();
});

// カテゴリ判定
for (const cat of Object.values(report.notifyCategories)) {
  cat.verdict = cat.issues.length ? "FAIL" : cat.minors.length ? "MINOR" : "PASS";
}

// Gemini checklist 再計算（チャット監査後）
for (const vp of VIEWPORTS) {
  const notifyPage = report.pages.find((p) => p.stepId === `builder-notify-list-${vp.label}`);
  report.uxReview.byViewport[vp.label] = {
    ...report.uxReview.byViewport[vp.label],
    geminiChecklist: buildGeminiChecklist(
      notifyPage?.data || {},
      report.navigationChecks,
      chatPageAudits,
      vp.label
    ),
  };
}

report.uxReview.geminiChecklist = (() => {
  const map = new Map();
  for (const vp of VIEWPORTS) {
    for (const row of report.uxReview.byViewport[vp.label]?.geminiChecklist || []) {
      const prev = map.get(row.item);
      if (!prev || (prev.ok && !row.ok)) map.set(row.item, row);
    }
  }
  return [...map.values()];
})();

const navFail = report.navigationChecks.filter((n) => n.verdict === "FAIL").length;
const stats = countVerdicts(report.pages);
report.overall = resolveOverall(stats.failCount + navFail, stats.minorCount);

if (navFail) report.uiConcerns.push(`通知→遷移で HTTP エラー ${navFail}件`);
if (report.pages.some((p) => (p.minors || []).some((m) => /CTA/.test(m)))) {
  report.uiConcerns.push("Builder通知カードのCTAサイズに注意（390px）");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /固定バー|横スクロール/.test(m)))) {
  report.uiConcerns.push("390pxで固定バーまたは横スクロールの懸念");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /間延び|デッド/.test(m)))) {
  report.uiConcerns.push("1280pxで間延び・デッドスペースの懸念");
}
if (!report.uiConcerns.length) {
  report.uiConcerns.push("致命的な問題は検出されませんでした — 本番投入可レベル");
}

if (stats.failCount + navFail === 0) {
  report.fixPriorities.push("Builder通知・取引チャットは本番可（FAIL 0）");
}
if (navFail) report.fixPriorities.push("通知→遷移先の HTTP エラー解消");
if (report.uiConcerns.some((c) => /CTA/.test(c))) {
  report.fixPriorities.push("390px Builder通知CTAのコンパクト化（任意）");
}
if (report.uiConcerns.some((c) => /固定バー/.test(c))) {
  report.fixPriorities.push("モバイル取引チャットの固定バー余白調整");
}
if (report.uiConcerns.some((c) => /間延び|デッド/.test(c))) {
  report.fixPriorities.push("1280px チャットレイアウトの横幅バランス（任意）");
}
if (!report.fixPriorities.length) report.fixPriorities.push("必須修正なし");

report.finalNotes = {
  notifyUx: stats.failCount + navFail === 0 ? "本番可" : "要修正",
  builderChat: Object.values(report.chatScenes).every((s) => s.verdict !== "FAIL") ? "本番可" : "要確認",
  remaining: stats.failCount + navFail === 0 ? "FAIL 0 — MINORのみならリリース可" : "FAIL項目あり",
  failCount: stats.failCount + navFail,
};

report.summary = {
  overall: report.overall,
  failCount: stats.failCount + navFail,
  minorCount: stats.minorCount,
  passCount: stats.passCount,
  navigationPass: report.navigationChecks.filter((n) => n.verdict === "PASS").length,
  navigationFail: navFail,
  notifyCategoryVerdicts: Object.fromEntries(
    Object.entries(report.notifyCategories).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
  ),
  chatSceneVerdicts: Object.fromEntries(
    Object.entries(report.chatScenes).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
  ),
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

function renderLocalIndex() {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const catRows = Object.entries(report.notifyCategories)
    .map(
      ([, v]) =>
        `<tr><td>${esc(v.label)}</td><td>${esc(v.verdict)}</td><td>${v.items.length}</td></tr>`
    )
    .join("");
  const chatRows = Object.entries(report.chatScenes)
    .map(([, v]) => `<tr><td>${esc(v.label)}</td><td>${esc(v.verdict)}</td></tr>`)
    .join("");
  const gemini = report.uxReview.geminiChecklist
    .map((c) => `<li>${c.ok ? "✓" : "△"} ${esc(c.item)} — ${esc(c.note || "")}</li>`)
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Builder最終UX</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #e2e8f0;padding:8px;font-size:.8125rem}${SCREENSHOT_BACK_NAV_CSS}</style></head>
<body>${renderScreenshotBackNav()}<h1>Builder通知・取引チャット 最終UX監査</h1>
<p>総合: <strong>${esc(report.overall)}</strong> · FAIL ${report.summary.failCount} · ${esc(report.generatedAt)}</p>
<h2>通知カテゴリ</h2><table><tr><th>種別</th><th>判定</th><th>件</th></tr>${catRows}</table>
<h2>取引チャット</h2><table><tr><th>画面</th><th>判定</th></tr>${chatRows}</table>
<h2>Gemini UX</h2><ul>${gemini}</ul>
<h2>気になるUI</h2><ul>${report.uiConcerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>修正優先順位</h2><ol>${report.fixPriorities.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
</body></html>`;
}

fs.writeFileSync(path.join(OUT, "index.html"), renderLocalIndex());

console.log(JSON.stringify(report.summary, null, 2));
console.log(`Saved: ${OUT}/report.json`);

await finalizeVerification(root, { primaryFolder: "builder-final-review", openBrowser: false });

await closeAllBrowsers();
