#!/usr/bin/env node
/**
 * TALK 通知導線レビュー準備 — 実クリック検証 + 390px キャプチャ + QA Center
 *   node scripts/capture-talk-notify-flow-review.mjs
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import {
  assertQaCenterReady,
  countRegisteredSearchMatches,
  formatPassReportQaSection,
  FLOW_SEARCH,
} from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "talk-notify-flow");
const reportPath = join(root, "reports", "talk-notify-flow-review-prep.md");
const QA_SEARCH_KEYWORD =
  FLOW_SEARCH.find((f) => f.id === "talk-notify-flow")?.viewerSearch || "talk-notify";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

/** @type {Array<{ id: string, kind: string, notifyId: string, userId: string, title: string, expectedDest: RegExp, expectedActions: string[], shot: string, gemini: string, seedConnect?: boolean }>} */
const FLOW_CATALOG = [
  {
    id: "chat",
    kind: "チャット通知",
    notifyId: "platform-verify-job-full-poster-start-001",
    userId: "u_job_demo_full",
    title: "応募者とのやりとりを開始してください",
    expectedDest: /chat-detail\.html/i,
    expectedActions: ["メッセージ入力（返信）", "相手・案件コンテキスト表示"],
    shot: "talk-notify-chat-detail-mobile390.png",
    gemini: "talk-notify-chat-detail.png",
  },
  {
    id: "purchase",
    kind: "購入通知",
    notifyId: "platform-verify-skill-purchase-001",
    userId: "u_sachi",
    title: "スキルが購入されました",
    expectedDest: /platform-chat-fee-pay\.html/i,
    expectedActions: ["支払い確認 / Stripeで支払う", "購入者・掲載コンテキスト表示"],
    shot: "talk-notify-purchase-mobile390.png",
    gemini: "talk-notify-purchase.png",
  },
  {
    id: "completion",
    kind: "完了報告通知",
    notifyId: "platform-verify-builder-completion-001",
    userId: "u_sachi",
    title: "完了報告が届きました",
    expectedDest: /board-thread\.html/i,
    expectedActions: ["承認する", "差し戻し"],
    shot: "talk-notify-completion-mobile390.png",
    gemini: "talk-notify-completion.png",
  },
  {
    id: "review",
    kind: "レビュー通知",
    notifyId: "platform-verify-job-full-review-001",
    userId: "u_hiro",
    title: "評価をお願いします",
    expectedDest: /chat-detail\.html/i,
    expectedActions: ["レビューする / 評価入力", "取引相手コンテキスト表示"],
    shot: "talk-notify-review-mobile390.png",
    gemini: "talk-notify-review.png",
  },
  {
    id: "connect",
    kind: "Connect通知",
    notifyId: "platform-chat-demo-connect-identity-001",
    userId: "u_sachi",
    title: "【重要】売上の受け取りには本人確認が必要です",
    expectedDest: /payment-settings\.html/i,
    expectedActions: ["本人確認を始める"],
    shot: "talk-notify-connect-mobile390.png",
    gemini: "talk-notify-connect.png",
    seedConnect: true,
  },
];

function notifyUrl(base, userId) {
  const u = new URL(`${base}/talk-home.html`);
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", userId);
  return u.toString();
}

function paymentSettingsIdentityUrl(base, userId) {
  const u = new URL(`${base}/payment-settings.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", userId);
  u.searchParams.set("connectStep", "identity");
  return `${u.pathname}${u.search}`;
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => globalThis.localStorage.removeItem(k));
    globalThis.localStorage.removeItem("tasful_talk_notifications");
  }, { markers: MASTER_MARKERS });
}

async function seedConnectNotification(page, base, userId) {
  const href = paymentSettingsIdentityUrl(base, userId);
  await page.evaluate(
    ({ sellerId, identityHref }) => {
      const store = window.TasuTalkNotifications;
      if (!store?.getAll || !store?.saveAll) return;
      const id = "platform-chat-demo-connect-identity-001";
      const row = {
        id,
        type: "skill",
        category: "Connect",
        title: "【重要】売上の受け取りには本人確認が必要です",
        body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
        actionLabel: "本人確認を進める",
        href: identityHref,
        targetUrl: identityHref,
        priority: "high",
        recipientUserId: sellerId,
        source: "platform_chat_demo_connect_requirements_v1",
        minimalNotifyCard: true,
        notifyDeadlineLabel: "期限: 7日以内",
        createdAt: new Date().toISOString(),
      };
      const next = (store.getAll() || []).filter((n) => String(n.id) !== id);
      next.unshift(row);
      store.saveAll(next, { localOnly: true, silent: true });
      window.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
      );
    },
    { sellerId: userId, identityHref: href }
  );
}

async function openNotifyTab(page, base, userId) {
  await page.goto(notifyUrl(base, userId), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
  await page.locator('[data-talk-tab="notify"], [data-talk-nav-notify]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function waitForNotifyCard(page, notifyId) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`).first();
  await card.waitFor({ state: "attached", timeout: 20000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  return card;
}

async function clickNotifyFromList(page, notifyId) {
  const card = await waitForNotifyCard(page, notifyId);
  const tier = await card.getAttribute("data-talk-notify-tier");
  const navHref = await page.evaluate((id) => {
    const row = window.TasuTalkNotifications?.findById?.(id);
    const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return pickStr(built?.href, row?.href, row?.targetUrl);
    function pickStr(...vals) {
      for (const v of vals) {
        const s = String(v ?? "").trim();
        if (s) return s;
      }
      return "";
    }
  }, notifyId);

  if (tier === "normal") {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {}),
      page.evaluate((id) => {
        const el = document.querySelector(`article[data-talk-notify-id="${id}"]`);
        el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }, notifyId),
    ]);
  } else {
    const btn = card.locator(
      "[data-talk-notify-action], [data-anpi-notify-inline-safe], .talk-notify-card__minimal-action"
    ).first();
    await btn.waitFor({ state: "visible", timeout: 10000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {}),
      btn.click(),
    ]);
  }

  if (/talk-home\.html/i.test(page.url()) && navHref) {
    await page.goto(new URL(navHref, page.url()).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
  }
  return page.url();
}

async function prepareDestination(page, flowId) {
  if (flowId === "connect") {
    await page.waitForSelector("[data-connect-onboarding]", { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      if (window.TasuPaymentSettings?.resolveConnectStep?.() !== "identity") {
        window.TasuPaymentSettings?.saveConnectOnboarding?.({ step: "identity" });
        window.TasuPaymentSettings?.renderConnectOnboarding?.();
      }
    });
    await page.waitForSelector("[data-connect-identity-panel]:not([hidden])", { timeout: 10000 }).catch(() => {});
  }
  if (flowId === "purchase") {
    await page.waitForSelector("[data-platform-fee-pay-panel]", { timeout: 15000 }).catch(() => {});
    await page.waitForSelector("[data-platform-fee-card]:not([hidden]), [data-platform-fee-pay]", {
      timeout: 15000,
    }).catch(() => {});
  }
  if (flowId === "completion") {
    await page.waitForSelector("#completion, [data-builder-thread-completion-host]", {
      timeout: 15000,
    }).catch(() => {});
    await page.waitForFunction(
      () =>
        document.querySelector("[data-thread-completion-approve]") ||
        document.querySelector(".mvp-thread-completion--notify-focus"),
      { timeout: 20000 }
    ).catch(() => {});
    await page.evaluate(() => {
      const panel = document.querySelector("[data-builder-board-thread-completion-panel]");
      if (panel) panel.hidden = false;
      if (location.hash !== "#completion") location.hash = "completion";
    });
    await page.locator("[data-thread-completion-approve], .mvp-thread-completion--notify-focus").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
  }
  if (flowId === "review") {
    await page.waitForSelector("#chatMessages, .chat-card", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (flowId === "chat") {
    await page.waitForSelector("#chatInput", { timeout: 20000 }).catch(() => {});
    await page
      .waitForFunction(
        () => {
          const sub = document.querySelector("#chatSub")?.textContent?.trim() || "";
          const title = document.querySelector("#chatTitle")?.textContent?.trim() || "";
          return sub.length > 2 || title.length > 2;
        },
        { timeout: 20000 }
      )
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(500);
}

async function auditDestination(page, flowId) {
  return page.evaluate((id) => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      if (!el || el.hidden) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const text = (sel, { allowHidden = false } = {}) => {
      const el = document.querySelector(sel);
      if (!el) return "";
      if (!allowHidden && !visible(sel)) return "";
      return (el.textContent || "").trim();
    };
    const labels = [...document.querySelectorAll("button, textarea, a.shop-checkout__btn, a.dash-btn")]
      .filter((el) => {
        if (el.hidden) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const st = getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden";
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const params = new URLSearchParams(location.search);
    const base = {
      url: location.href,
      pageTitle: document.title,
      fromNotify: params.get("from") === "notify",
      returnLink:
        text("[data-platform-fee-back-link]") ||
        text(".page-subnav__link") ||
        text("[data-talk-back]") ||
        text(".chat-detail__back"),
      actionLabels: [...new Set(labels)].slice(0, 14),
    };

    if (id === "chat") {
      return {
        ...base,
        peer: text("#chatSub", { allowHidden: true }),
        title: text("#chatTitle", { allowHidden: true }),
        listing: text("#chatListingMeta", { allowHidden: true }),
        listingLink: text("#chatListingDetailLink", { allowHidden: true }),
        hasChatInput: visible("#chatInput"),
        chatInputPlaceholder: document.querySelector("#chatInput")?.getAttribute("placeholder") || "",
      };
    }
    if (id === "purchase") {
      return {
        ...base,
        feeTitle: text("[data-platform-fee-pay-title]"),
        listing: text("[data-platform-fee-listing]"),
        tradeListing: text("[data-platform-fee-trade-listing]", { allowHidden: true }),
        buyer: text("[data-platform-fee-buyer]", { allowHidden: true }),
        tradeAmount: text("[data-platform-fee-trade-amount]", { allowHidden: true }),
        amount: text("[data-platform-fee-amount-default], [data-platform-fee-amount]"),
        hasTradePanel: visible("[data-platform-fee-trade-panel]"),
        hasPayCta: visible("[data-platform-fee-pay]"),
      };
    }
    if (id === "completion") {
      return {
        ...base,
        notifyFocus: document.body.classList.contains("builder-board-thread--notify-completion"),
        reporter: text(".mvp-thread-completion__notify-reporter strong", { allowHidden: true }),
        completionTitle: text(".mvp-thread-completion__title, .mvp-thread-completionChatCard__title"),
        hasApprove: visible("[data-thread-completion-approve]"),
        hasReject: visible("[data-thread-completion-reject-open]"),
        project: text(".mvp-slack-thread__title, [data-builder-mvp-thread-project-title]"),
      };
    }
    if (id === "review") {
      return {
        ...base,
        peer: text("#chatSub", { allowHidden: true }),
        hasReviewBar: visible("#chatReviewBarBtn"),
        hasReviewModal: visible("#chatReviewModal:not([hidden])"),
        openReviewParam: params.get("openReview") || "",
      };
    }
    if (id === "connect") {
      return {
        ...base,
        connectStep: window.TasuPaymentSettings?.resolveConnectStep?.() || "",
        hasIdentityPanel: visible("[data-connect-identity-panel]"),
        hasIdentityCta: visible("[data-connect-identity-submit]"),
        identityCta: text("[data-connect-identity-submit]"),
      };
    }
    return base;
  }, flowId);
}

function evaluateFlowPass(flow, actualUrl, audit) {
  const destPass = flow.expectedDest.test(actualUrl);
  let actionPass = false;
  let actualActions = audit.actionLabels || [];

  if (flow.id === "chat") {
    const hasContext = Boolean(audit.peer) || Boolean(audit.title) || Boolean(audit.listingLink);
    actionPass = audit.hasChatInput && hasContext;
    actualActions = [
      audit.hasChatInput ? `返信入力: ${audit.chatInputPlaceholder || "メッセージ入力"}` : "",
      audit.peer ? `相手: ${audit.peer}` : "",
      audit.title ? `スレッド: ${audit.title}` : "",
      audit.listingLink ? `掲載: ${audit.listingLink}` : audit.listing ? `案件: ${audit.listing}` : "",
    ].filter(Boolean);
  } else if (flow.id === "purchase") {
    actionPass =
      audit.hasPayCta &&
      audit.hasTradePanel &&
      Boolean(audit.buyer) &&
      Boolean(audit.tradeListing || audit.listing);
    actualActions = [
      audit.buyer ? `購入者: ${audit.buyer}` : "",
      audit.tradeListing || audit.listing
        ? `案件: ${audit.tradeListing || audit.listing}`
        : "",
      audit.tradeAmount || audit.amount
        ? `やり取り手数料: ${audit.tradeAmount || audit.amount}`
        : "",
      audit.hasPayCta ? "Stripeで支払う" : "",
    ].filter(Boolean);
  } else if (flow.id === "completion") {
    actionPass = audit.hasApprove && audit.hasReject && Boolean(audit.reporter);
    actualActions = [
      audit.reporter ? `報告者: ${audit.reporter}` : "",
      audit.hasApprove ? "承認する" : "",
      audit.hasReject ? "差し戻す" : "",
      audit.notifyFocus ? "通知フォーカス表示" : "",
    ].filter(Boolean);
  } else if (flow.id === "review") {
    actionPass = audit.hasReviewBar || audit.hasReviewModal || audit.openReviewParam === "1";
    actualActions = [
      audit.hasReviewBar ? "レビューバー" : "",
      audit.hasReviewModal ? "レビューモーダル" : "",
      audit.peer ? `相手: ${audit.peer}` : "",
    ].filter(Boolean);
  } else if (flow.id === "connect") {
    actionPass = audit.hasIdentityCta && /identity/.test(audit.connectStep || "");
    actualActions = [
      audit.identityCta || (audit.hasIdentityCta ? "本人確認を始める" : ""),
      audit.connectStep ? `Connect状態: ${audit.connectStep}` : "",
    ].filter(Boolean);
  }

  const returnPass = audit.fromNotify || /通知|戻る|TALK/i.test(audit.returnLink || "");
  return {
    pass: destPass && actionPass && returnPass,
    destPass,
    actionPass,
    returnPass,
    actualActions: actualActions.length ? actualActions : audit.actionLabels?.slice(0, 6) || [],
  };
}

const GEMINI_A_ONLY = process.argv.includes("--gemini-a");
const ACTIVE_FLOWS = GEMINI_A_ONLY
  ? FLOW_CATALOG.filter((f) => f.id === "purchase")
  : FLOW_CATALOG;

async function main() {
  await mkdir(outDir, { recursive: true });

  const base = await requireDevServer();
  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    flows: [],
    shots: [],
    checks: {
      notifyToAction: "通知クリック後、遷移先で次アクションが把握できる",
      contextClear: "相手・案件・取引状態が分かる",
      returnPath: "from=notify または戻る導線が表示される",
      mobile390: "390px 幅で主要操作要素が表示される",
    },
    passed: false,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

    for (const flow of ACTIVE_FLOWS) {
      await openNotifyTab(page, base, flow.userId);
      await resetNotifyStore(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-notify-list]", { timeout: 30000 });
      await page.waitForTimeout(800);
      if (flow.seedConnect) await seedConnectNotification(page, base, flow.userId);
      await page.waitForTimeout(flow.seedConnect ? 1200 : 800);

      let actualUrl = "";
      let audit = {};
      let evalResult = { pass: false, actualActions: [] };

      try {
        await waitForNotifyCard(page, flow.notifyId);
        actualUrl = await clickNotifyFromList(page, flow.notifyId);
        await prepareDestination(page, flow.id);
        audit = await auditDestination(page, flow.id);
        evalResult = evaluateFlowPass(flow, actualUrl, audit);

        await page.screenshot({ path: join(outDir, flow.shot), fullPage: false });
        report.shots.push(flow.shot);
      } catch (err) {
        evalResult = { pass: false, actualActions: [], error: String(err?.message || err) };
        try {
          await page.screenshot({ path: join(outDir, flow.shot), fullPage: false });
          report.shots.push(flow.shot);
        } catch {
          /* ignore */
        }
      }

      report.flows.push({
        kind: flow.kind,
        notifyId: flow.notifyId,
        title: flow.title,
        userId: flow.userId,
        expectedDest: flow.expectedDest.toString(),
        expectedActions: flow.expectedActions,
        actualUrl: actualUrl || page.url(),
        actualActions: evalResult.actualActions,
        returnLink: audit.returnLink || "",
        fromNotify: audit.fromNotify === true,
        destPass: evalResult.destPass,
        actionPass: evalResult.actionPass,
        returnPass: evalResult.returnPass,
        pass: evalResult.pass === true,
        screenshot: flow.shot,
        error: evalResult.error || "",
      });
    }

    for (const flow of ACTIVE_FLOWS) {
      try {
        await copyFile(join(outDir, flow.shot), join(outDir, flow.gemini));
        report.shots.push(flow.gemini);
      } catch {
        /* ignore */
      }
    }

    const { manifest } = await writeScreenshotsManifest(root);
    const qaSection = formatPassReportQaSection({
      searchKeyword: QA_SEARCH_KEYWORD,
      baseUrl: base,
      manifest,
    });
    const qaGate = assertQaCenterReady(manifest);
    const searchCount = countRegisteredSearchMatches(manifest.images || [], QA_SEARCH_KEYWORD);

    report.qa = {
      searchKeyword: QA_SEARCH_KEYWORD,
      viewerUrl: qaSection.viewerUrl,
      registeredMatchCount: searchCount,
      unregisteredCount: qaSection.unregisteredCount,
      qaGatePass: qaGate.ok,
    };

    report.passed =
      report.flows.every((f) => f.pass) &&
      qaGate.ok &&
      report.shots.length >= ACTIVE_FLOWS.length;

    const md = [
      "# TALK 通知導線 — レビュー準備",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## 目的",
      "",
      "通知一覧のUI整理後、**通知を押した後にTALK内で迷わず行動できるか**を実クリックで確認する。",
      "",
      "## 確認観点",
      "",
      "| 観点 | 確認内容 |",
      "|------|----------|",
      `| 次アクションの明確さ | ${report.checks.notifyToAction} |`,
      `| コンテキスト | ${report.checks.contextClear} |`,
      `| 戻り導線 | ${report.checks.returnPath} |`,
      `| モバイル操作性 | ${report.checks.mobile390} |`,
      "",
      "## 導線検証（実クリック）",
      "",
      "| 通知名 | 遷移先 | 期待アクション | 実際の次アクション | 結果 |",
      "|--------|--------|----------------|-------------------|------|",
      ...report.flows.map((f) => {
        const dest = f.actualUrl || "—";
        const expected = (f.expectedActions || []).join(" / ");
        const actual = (f.actualActions || []).join(" / ") || "—";
        return `| ${f.title} | ${dest} | ${expected} | ${actual} | ${f.pass ? "PASS" : "FAIL"} |`;
      }),
      "",
      "## 対象導線",
      "",
      "1. チャット通知 → chat-detail.html → 返信",
      "2. 購入通知 → 取引チャット / 支払い確認 → 取引開始",
      "3. 完了報告通知 → board-thread.html#completion → 承認 / 差し戻し",
      "4. レビュー通知 → chat-detail.html / review導線 → 評価入力",
      "5. Connect通知 → payment-settings.html → 本人確認",
      "",
      "## 登録スクショ（390px）",
      "",
      ...FLOW_CATALOG.map((f) => `- \`screenshots/talk-notify-flow/${f.shot}\``),
      "",
      "## Gemini 提出セット",
      "",
      ...FLOW_CATALOG.map((f) => `- \`screenshots/talk-notify-flow/${f.gemini}\``),
      "",
      qaSection.markdown || [
        "## QA Center",
        "",
        `- 検索: \`${QA_SEARCH_KEYWORD}\` (${searchCount} 件)`,
        `- Viewer: ${qaSection.viewerUrl}`,
        `- 未登録: ${qaSection.unregisteredCount}`,
        `- QA Gate: ${qaGate.ok ? "PASS" : "FAIL"}`,
      ].join("\n"),
      "",
      report.passed ? "**全体: PASS**" : "**全体: FAIL**",
      "",
    ].join("\n");

    await writeFile(reportPath, md, "utf8");
    console.log(`Report: ${reportPath}`);
    console.log(report.passed ? "PASS" : "FAIL");
    if (!report.passed) {
      console.error(JSON.stringify(report.flows.filter((f) => !f.pass), null, 2));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
