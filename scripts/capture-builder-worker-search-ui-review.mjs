#!/usr/bin/env node
/**
 * Builder ワーカー検索 — Screenshot Review（550円開示 → Talk → 通常チャット）
 *
 *   npm run dev 起動後:
 *   node scripts/capture-builder-worker-search-ui-review.mjs
 *
 * 出力: reports/ui-review/builder-worker-search/
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { createUiReviewSession } from "./lib/ui-review-capture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURE = "builder-worker-search";
const MVP_KEY = "tasful:builder:mvp:v1";
const THREADS_KEY = "tasful_chat_threads";
const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";
const COMPLETION_KEY = "tasful:talk:builder-completion-reports:v1";
const REVEAL_KEY = "tasful:builder:contact-reveals:v1";

const base = await findDevServerBaseUrl({ probePath: "builder/find-workers.html" });
const workersUrl = buildLocalPageUrl(base, "builder/find-workers.html");

async function resetWorkerContactState(page) {
  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ mvpKey, chatKey, revealKey, workflowKey, completionKey }) => {
      localStorage.removeItem(revealKey);
      localStorage.removeItem(workflowKey);
      localStorage.removeItem(completionKey);
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const threads = { ...(mvp.threads || {}) };
      Object.keys(threads).forEach((id) => {
        const t = threads[id];
        const kind = String(t?.thread_kind || t?.thread_type || "");
        if (kind === "worker_contact" || kind === "vendor_contact") delete threads[id];
      });
      mvp.threads = threads;
      localStorage.setItem(mvpKey, JSON.stringify(mvp));
      const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
      const filtered = (Array.isArray(chat) ? chat : []).filter((row) => {
        const k = String(row?.threadKind || row?.builderThreadType || "");
        return k !== "worker_contact" && k !== "vendor_contact";
      });
      localStorage.setItem(chatKey, JSON.stringify(filtered));
    },
    {
      mvpKey: MVP_KEY,
      chatKey: THREADS_KEY,
      revealKey: REVEAL_KEY,
      workflowKey: WORKFLOW_KEY,
      completionKey: COMPLETION_KEY,
    }
  );
}

function talkUrl(threadId, role) {
  const q = new URLSearchParams({
    thread: threadId,
    from: "builder",
    builderFlow: "partner_user",
    builderRole: role,
  });
  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);
}

async function navigateWorkerSearchToTalk(page) {
  await page.goto(workersUrl, { waitUntil: "domcontentloaded" });
  await page.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
  await page.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 12000 });
  if (!(await page.locator("[data-builder-fw-profile]:not([hidden])").isVisible().catch(() => false))) {
    await page.locator("[data-builder-fw-detail]").first().click();
    await page.locator("[data-builder-fw-profile]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
  }
  await page
    .locator("[data-builder-fw-profile]:not([hidden]) [data-builder-talk-contact]")
    .first()
    .click();
  await page.waitForURL(/chat-detail/i, { timeout: 20000 });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
  return new URL(page.url()).searchParams.get("thread") || "";
}

async function readDiagnostics(page, threadId = "") {
  return page.evaluate(
    ({ threadsKey, workflowKey, completionKey, tid }) => {
      const ws = window.TasuBuilderBillingPolicy?.POLICY?.workerSearch;
      const gp = window.TasuBuilderBillingPolicy?.POLICY?.generalProject;
      const threads = JSON.parse(localStorage.getItem(threadsKey) || "[]");
      const list = Array.isArray(threads) ? threads : [];
      const row = tid
        ? list.find((t) => String(t.id) === tid)
        : list.find((t) => String(t.threadKind || "") === "worker_contact");
      const id = tid || row?.id || "";
      const wf = JSON.parse(localStorage.getItem(workflowKey) || "{}");
      const reports = JSON.parse(localStorage.getItem(completionKey) || "{}");
      return {
        workerSearch: {
          contactRevealFeeYen: ws?.contactRevealFeeYen ?? null,
          completionCommission: ws?.completionCommission ?? null,
        },
        generalProjectCommissionRange: gp?.commissionPctRange ?? null,
        threadId: id || null,
        roomId: row?.roomId || id || null,
        threadKind: row?.threadKind || null,
        partnerUserId: row?.partnerUserId || null,
        hasWorkflowState: id ? Boolean(wf[id]) : false,
        hasCompletionReport: id ? Boolean(reports[id]) : false,
      };
    },
    {
      threadsKey: THREADS_KEY,
      workflowKey: WORKFLOW_KEY,
      completionKey: COMPLETION_KEY,
      tid: threadId,
    }
  );
}

async function probeForbiddenActions(page) {
  const panelText = (await page.locator("#talkBuilderWorkflowPanel").textContent().catch(() => "")) || "";
  const count = await page.locator("[data-talk-builder-next]:visible").count();
  return {
    visibleWorkflowButtons: count,
    hasCommissionPctText: /5\s*[〜~\-]\s*10\s*%/.test(panelText) || /案件手数料/.test(panelText),
  };
}

console.log(`\n=== Builder worker-search UI review capture ===`);
console.log(`Base: ${base}`);
console.log(`Output: reports/ui-review/${FEATURE}/\n`);

const session = createUiReviewSession(FEATURE, { baseUrl: base, viewports: ["1280"] });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await resetWorkerContactState(page);

  await session.captureStep(page, browser, {
    slug: "find-workers-results",
    label: "ワーカー検索 · 結果一覧",
    url: workersUrl,
    prepare: async (p) => {
      await p.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
      await p.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 12000 });
    },
    waitFor: "[data-builder-fw-results]",
  });

  await session.captureStep(page, browser, {
    slug: "worker-profile",
    label: "ワーカープロフィール",
    url: workersUrl,
    prepare: async (p) => {
      await p.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
      await p.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 12000 });
      await p.locator("[data-builder-fw-detail]").first().click();
      await p.locator("[data-builder-fw-profile]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
    },
    waitFor: "[data-builder-fw-profile]:not([hidden])",
  });

  await page
    .locator("[data-builder-fw-profile]:not([hidden]) [data-builder-talk-contact]")
    .first()
    .click();
  await page.waitForURL(/chat-detail/i, { timeout: 20000 });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
  const threadId = new URL(page.url()).searchParams.get("thread") || "";

  await session.captureStep(page, browser, {
    slug: "talk-before-reveal",
    label: "550円 連絡先開示前",
    url: page.url(),
    waitFor: "#talkBuilderContactRevealHost",
  });

  page.once("dialog", (d) => d.accept());
  await page.locator("[data-builder-contact-reveal]").first().click();
  await page.waitForTimeout(600);

  await session.captureStep(page, browser, {
    slug: "talk-after-reveal",
    label: "550円 開示後 · Talk 有効",
    url: page.url(),
    waitFor: "#chatInput",
    prepare: async (p) => {
      if (await p.locator("#chatInput").isDisabled()) {
        p.once("dialog", (d) => d.accept());
        await p.locator("[data-builder-contact-reveal]").first().click().catch(() => null);
        await p.waitForTimeout(500);
      }
    },
  });

  await page.locator("#chatInput").fill("ワーカー検索から相談します（UI review）");
  await page.locator("#chatSend").click();
  await page.waitForTimeout(600);

  await session.captureStep(page, browser, {
    slug: "normal-chat",
    label: "通常チャット送信",
    url: page.url(),
    waitFor: "#chatMessages",
  });

  await session.captureStep(page, browser, {
    slug: "thread-sync",
    label: "thread / roomId 同期（user 視点）",
    url: page.url(),
    waitFor: "#talkBuilderWorkflowKind",
  });

  const diagnostics = await readDiagnostics(page, threadId);
  const forbidden = await probeForbiddenActions(page);

  const reportPath = session.writeReport({
    feature: FEATURE,
    baseUrl: base,
    threadId,
    diagnostics,
    forbiddenActions: { user: forbidden },
    checks: {
      contactReveal550: diagnostics.workerSearch?.contactRevealFeeYen === 550,
      threadCreated: Boolean(diagnostics.threadId && diagnostics.roomId),
      partnerUserIdSet: Boolean(diagnostics.partnerUserId),
      workerThreadKind: diagnostics.threadKind === "worker_contact",
      noCompletionCommission: diagnostics.workerSearch?.completionCommission === false,
      noWorkflowState: !diagnostics.hasWorkflowState,
      noCompletionReport: !diagnostics.hasCompletionReport,
      noWorkflowButtons: forbidden.visibleWorkflowButtons === 0,
      noCommissionUi: !forbidden.hasCommissionPctText,
    },
  });

  console.log(`\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
  console.log(`Forbidden: ${JSON.stringify(forbidden)}`);
  console.log(`Report: ${reportPath}`);

  const checks = {
    contactReveal550: diagnostics.workerSearch?.contactRevealFeeYen === 550,
    threadCreated: Boolean(diagnostics.threadId && diagnostics.roomId),
    partnerUserIdSet: Boolean(diagnostics.partnerUserId),
    noCompletionCommission: diagnostics.workerSearch?.completionCommission === false,
    noWorkflowState: !diagnostics.hasWorkflowState,
    noWorkflowButtons: forbidden.visibleWorkflowButtons === 0,
    noCommissionUi: !forbidden.hasCommissionPctText,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    console.error("\n=== UI review checks FAILED ===");
    failed.forEach(([k]) => console.error(`  ✗ ${k}`));
    await closeAllBrowsers();
    process.exit(1);
  }

  console.log("\nPASS capture-builder-worker-search-ui-review");
});

await closeAllBrowsers();
