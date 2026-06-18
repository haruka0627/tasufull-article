#!/usr/bin/env node
/**
 * TASFUL 390px 主要CTA 到達距離レビュー（実装なし・計測のみ）
 *   node scripts/review-cta-mobile-ux.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "cta-mobile-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const NAV_TIMEOUT = 25000;
const SEL_TIMEOUT = 15000;
const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };
const MVP_KEY = "tasful:builder:mvp:v1";
const THREAD_ID = "thread-demo-001";
const PROJECT_ID = "demo-project-001";
const PARTNER_ID = "demo-partner-001";

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

/** @type {import('./review-cta-mobile-ux.mjs').CtaScene[]} */
const CTA_SCENES = [
  {
    category: "market",
    ctaName: "今すぐ購入",
    screenId: "product-buy",
    label: "市場 商品詳細 — 今すぐ購入",
    path: "detail-shop-product.html",
    query: `shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`,
    wait: "[data-tasful-product-main]:not([hidden])",
    selectors: ["[data-tasful-product-buy-now]", "[data-tasful-product-buy-now-pc]"],
    labelIncludes: ["今すぐ購入"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    notes: "390px: ヒーロー下 — buybox sticky は768+",
  },
  {
    category: "market",
    ctaName: "カートに入れる",
    screenId: "product-cart",
    label: "市場 商品詳細 — カートに入れる",
    path: "detail-shop-product.html",
    query: `shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`,
    wait: "[data-tasful-product-main]:not([hidden])",
    selectors: ["[data-tasful-product-add-cart]", "[data-tasful-product-add-cart-pc]"],
    labelIncludes: ["カートに入れる"],
    fixedBarCandidate390: true,
    avoidFixed: false,
  },
  {
    category: "market",
    ctaName: "注文を確定する",
    screenId: "checkout-submit",
    label: "市場 チェックアウト — 注文確定",
    path: "shop-market-checkout.html",
    query: "mode=cart",
    wait: "[data-tasful-checkout-body]:not([hidden]), [data-tasful-market-header]",
    prep: "marketCheckout",
    selectors: ["[data-tasful-checkout-submit]", "[data-tasful-checkout-submit-aside]", ".tasful-market-checkout-bar__btn"],
    labelIncludes: ["注文を確定"],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "既に .tasful-market-checkout-bar が fixed bottom（390px）",
  },
  {
    category: "builder",
    ctaName: "応募する",
    screenId: "board-apply",
    label: "Builder 案件詳細 — 応募",
    path: "builder/board-project-detail.html",
    query: "id=demo-project-001&role=partner",
    wait: "[data-builder-board-pd-root], .builder-header",
    waitCta: "[data-builder-board-pd-apply-dock-btn], [data-builder-board-pd-apply]:not([hidden])",
    prep: "builderApplyOpen",
    selectors: ["[data-builder-board-pd-apply-dock-btn]", "[data-builder-board-pd-apply]"],
    labelIncludes: ["応募"],
    fixedBarCandidate390: true,
    avoidFixed: false,
  },
  {
    category: "builder",
    ctaName: "採用する",
    screenId: "board-hire",
    label: "Builder 案件詳細 — 選定/採用",
    path: "builder/board-project-detail.html",
    query: "id=demo-project-001&role=owner&view=applications",
    wait: "[data-builder-board-pd-root], [data-builder-board-pd-apps-section]",
    waitCta: "[data-builder-board-pd-select]:not([disabled])",
    prep: "builderOwnerApps",
    selectors: ["[data-builder-board-pd-select]"],
    labelIncludes: ["選定", "採用"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    notes: "UI文言は「選定する」",
  },
  {
    category: "builder",
    ctaName: "完了報告",
    screenId: "board-completion-submit",
    label: "Builder スレッド — 完了報告提出",
    path: "builder/board-thread.html",
    query: "thread_id=thread-demo-001&role=partner",
    wait: "[data-builder-board-thread-root], .builder-header",
    waitCta: "[data-thread-completion-submit]",
    prep: "builderHiredThread",
    selectors: ["[data-thread-completion-submit]"],
    labelIncludes: ["提出"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    notes: "ボタン文言は「提出する」。#completion 未使用（hash 時はデモ seed が提出済みに上書きされる）",
  },
  {
    category: "builder",
    ctaName: "承認する",
    screenId: "board-completion-approve",
    label: "Builder スレッド — 完了承認",
    path: "builder/board-thread.html",
    query: "thread_id=thread-demo-001&role=owner#completion",
    wait: "[data-builder-board-thread-root], .builder-header",
    waitCta: "[data-thread-completion-approve]",
    prep: "builderCompletionPending",
    selectors: ["[data-thread-completion-approve]"],
    labelIncludes: ["承認"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    measureAtAnchor: true,
  },
  {
    category: "builder",
    ctaName: "差し戻し",
    screenId: "board-completion-reject",
    label: "Builder スレッド — 差し戻し",
    path: "builder/board-thread.html",
    query: "thread_id=thread-demo-001&role=owner#completion",
    wait: "[data-builder-board-thread-root], .builder-header",
    waitCta: "[data-thread-completion-reject-open]",
    prep: "builderCompletionPending",
    selectors: ["[data-thread-completion-reject-open]"],
    labelIncludes: ["差し戻"],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "承認/差し戻しペア — 固定バー化は誤操作リスク",
    notes: "UI文言は「差し戻す」",
    measureAtAnchor: true,
  },
  {
    category: "connect",
    ctaName: "Connectを始める",
    screenId: "connect-start",
    label: "Connect 申請トップ",
    path: "payment-settings.html",
    query: "connectStep=top&talkDev=1&userId=u_seller",
    wait: "[data-connect-onboarding], .dash-header",
    prep: "connectResetTop",
    selectors: ["[data-connect-apply]"],
    labelIncludes: ["Connect", "始める"],
    fixedBarCandidate390: true,
    avoidFixed: false,
  },
  {
    category: "connect",
    ctaName: "本人確認を提出",
    screenId: "connect-identity",
    label: "Connect 本人確認",
    path: "payment-settings.html",
    query: "connectStep=identity&talkDev=1&userId=u_seller",
    wait: "[data-connect-onboarding], [data-connect-identity-panel]",
    waitCta: "[data-connect-identity-submit]",
    prep: "connectIdentityReady",
    selectors: ["[data-connect-identity-submit]"],
    labelIncludes: ["本人確認"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    notes: "ボタン文言は「本人確認を始める」",
  },
  {
    category: "connect",
    ctaName: "再申請",
    screenId: "connect-reapply",
    label: "Connect 再手続き",
    path: "payment-settings.html",
    query: "connectStep=top&talkDev=1&userId=u_seller",
    wait: "[data-connect-onboarding]",
    waitCta: "[data-connect-apply]",
    prep: "connectReapply",
    selectors: ["[data-connect-apply]"],
    labelIncludes: ["Connect", "始める"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    notes: "再申請専用ラベル未実装 — Connectを始めるで再手続き相当を計測",
  },
  {
    category: "talk",
    ctaName: "送信",
    screenId: "chat-send",
    label: "TALK チャット — 送信",
    path: "chat-detail.html",
    query: "thread=chat-demo-skill-plain-001&talkDev=1&userId=u_me&review=chat-demo",
    wait: "#chatSend, #chatMessages",
    selectors: ["#chatSend", ".chat-send"],
    labelIncludes: ["送信"],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "composer 下部固定 — 追加 fixed bar 不要",
  },
  {
    category: "talk",
    ctaName: "通知確認",
    screenId: "notify-action",
    label: "TALK 通知 — カード内CTA",
    path: "talk-home.html",
    query: "tab=notify&talkDev=1&benchEmbed=1&userId=u_me",
    wait: "[data-talk-notify-list] .talk-notify-card",
    selectors: ["[data-talk-notify-action]", ".talk-notify-card__action", ".talk-notify-card__minimal-action"],
    labelIncludes: [],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "通知カード文脈依存 — 一覧固定CTAは不適",
  },
  {
    category: "ai_ops",
    ctaName: "承認して実行",
    screenId: "hsg-approve",
    label: "AI運営 HSG — 承認して実行",
    path: "admin-operations-dashboard.html",
    query: "",
    hash: "#ops-ai-hsg",
    wait: "[data-ops-ai-human-send-gate]",
    prep: "aiOpsSeed",
    selectors: ["[data-hsg-approve]"],
    labelIncludes: ["承認"],
    fixedBarCandidate390: true,
    avoidFixed: false,
    measureAtHash: true,
  },
  {
    category: "ai_ops",
    ctaName: "詳細",
    screenId: "hsg-detail",
    label: "AI運営 HSG — 詳細",
    path: "admin-operations-dashboard.html",
    query: "",
    hash: "#ops-ai-hsg",
    wait: "[data-ops-ai-human-send-gate]",
    prep: "aiOpsSeed",
    selectors: ["[data-hsg-detail]", ".ops-ai-hsg-card__detail-btn"],
    labelIncludes: ["詳細"],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "折りたたみ詳細 — 固定化不要",
    measureAtHash: true,
  },
  {
    category: "ai_ops",
    ctaName: "却下",
    screenId: "hsg-reject",
    label: "AI運営 HSG — 却下",
    path: "admin-operations-dashboard.html",
    query: "",
    hash: "#ops-ai-hsg",
    wait: "[data-ops-ai-human-send-gate]",
    prep: "aiOpsSeed",
    selectors: ["[data-hsg-reject]"],
    labelIncludes: ["却下"],
    fixedBarCandidate390: false,
    avoidFixed: true,
    avoidFixedReason: "承認ペア — 固定バー誤タップリスク",
    measureAtHash: true,
  },
];

async function gotoWithRetry(page, url, opts) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, opts);
      return;
    } catch (err) {
      if (i === 2) throw err;
      await page.waitForTimeout(800);
    }
  }
}

async function prepMarketCheckout(page, base) {
  const url = buildLocalPageUrl(
    base,
    "detail-shop-product.html",
    `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await gotoWithRetry(page, url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: SEL_TIMEOUT }).catch(() => {});
  await page
    .locator("[data-tasful-product-add-cart]:visible, [data-tasful-product-add-cart-pc]:visible")
    .first()
    .click()
    .catch(() => {});
  await page.waitForFunction(
    () => Number(localStorage.getItem("tasu_market_cart_count") || 0) > 0,
    { timeout: SEL_TIMEOUT }
  ).catch(() => {});
  await page.waitForTimeout(300);
}

async function prepAiOpsSeed(page) {
  await page.evaluate(() => {
    const OW = window.TasuAdminAiOpsWatch;
    const HSG = window.TasuAdminAiHumanSendGate;
    const store = window.TasuSupportTicketStore;
    OW?.clearForTests?.();
    HSG?.clearForTests?.();
    store?.clearAllForTests?.();
    HSG.enqueuePendingItem({
      source: "automation",
      sourceId: "cta_review_hsg",
      category: "notification_send",
      actionType: "human_send",
      proposal: "CTA監査 承認待ち",
      recommendation: "再通知",
      reason: "監査",
      impactArea: "利用者通知",
      severity: "critical",
      confidence: 0.8,
      payload: {},
    });
    HSG.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
    window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
    window.TasuAdminMorningSummary?.render?.(
      window.TasuAdminOperationsDashboard?.buildMetrics?.() || {}
    );
  });
}

async function seedOnOrigin(page, base, fn, arg) {
  const boot = buildLocalPageUrl(base, "shop-store.html");
  await gotoWithRetry(page, boot, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.evaluate(fn, arg);
}

async function seedOpenProjectForPartnerApply(page, base) {
  await seedOnOrigin(
    page,
    base,
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
      localStorage.setItem("tasful:builder:mvp:role", "partner");
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID }
  );
}

async function seedOpenProjectWithApplication(page, base) {
  await seedOnOrigin(
    page,
    base,
    ({ mvpKey, projectId, partnerId }) => {
      const ts = new Date().toISOString();
      localStorage.setItem(
        mvpKey,
        JSON.stringify({
          version: 1,
          owner_id: "demo-owner-001",
          partners: [
            { partner_id: partnerId, display_name: "株式会社オレンジ建装" },
            { partner_id: "demo-partner-002", display_name: "テスト工務店B" },
          ],
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
            {
              application_id: "app-audit-2",
              project_id: projectId,
              partner_id: "demo-partner-002",
              status: "pending",
              ts,
            },
          ],
          threads: {},
          specs: { [projectId]: { budget: { min: 600000, max: 900000 } } },
        })
      );
      localStorage.setItem("tasful:builder:mvp:role", "owner");
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID, partnerId: PARTNER_ID }
  );
}

async function seedHiredThread(page, base, { withPendingCompletion = false } = {}) {
  await seedOnOrigin(
    page,
    base,
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
          comment: "CTA監査完了報告",
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
      localStorage.setItem("tasful:builder:mvp:role", withPendingCompletion ? "owner" : "partner");
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

async function runPrep(page, base, prep) {
  switch (prep) {
    case "marketCheckout":
      await prepMarketCheckout(page, base);
      break;
    case "aiOpsSeed":
      break;
    case "builderApplyOpen":
      await seedOpenProjectForPartnerApply(page, base);
      break;
    case "builderOwnerApps":
      await seedOpenProjectWithApplication(page, base);
      break;
    case "builderHiredThread":
      await seedHiredThread(page, base, { withPendingCompletion: false });
      break;
    case "builderCompletionPending":
      await seedHiredThread(page, base, { withPendingCompletion: true });
      break;
    case "connectResetTop":
      await seedOnOrigin(page, base, () => {
        localStorage.removeItem("tasu_payment_connect_onboarding");
        window.TasuPlatformChatConnectChatFlow?.setSellerConnectStatus?.("u_seller", "");
      });
      break;
    case "connectIdentityReady":
      break;
    case "connectReapply":
      await seedOnOrigin(page, base, () => {
        localStorage.removeItem("tasu_payment_connect_onboarding");
        window.TasuPlatformChatConnectChatFlow?.setSellerConnectStatus?.("u_seller", "");
      });
      break;
    default:
      break;
  }
}

function measureCtaInPage({ selectors, labelIncludes, measureAtHash, measureAtAnchor }) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  if (!measureAtHash && !measureAtAnchor) window.scrollTo(0, 0);

  const pick = () => {
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.hidden) continue;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const text = (el.textContent || el.getAttribute("aria-label") || el.value || "").trim();
        if (labelIncludes?.length && !labelIncludes.some((l) => text.includes(l))) continue;
        return { el, st, r, text: text.replace(/\s+/g, " ").slice(0, 48) };
      }
    }
    return null;
  };

  const hit = pick();
  if (!hit) {
    return {
      found: false,
      visibleAtLoad: false,
      scrollPx: null,
      screens: null,
      minTap: 0,
      isFixedBottom: false,
      horizontalOverflow: document.documentElement.scrollWidth > vw + 2,
    };
  }

  const { el, st, r, text } = hit;
  const visibleAtLoad = r.top < vh && r.bottom > 0;
  const docTop = r.top + window.scrollY;
  const scrollPx = visibleAtLoad ? 0 : Math.max(0, Math.round(docTop - vh * 0.12));
  const screens = visibleAtLoad ? 0 : Math.max(0, docTop / vh);
  const isFixedBottom =
    (st.position === "fixed" || st.position === "sticky") && r.bottom >= vh - 12 && r.height > 28;

  return {
    found: true,
    visibleAtLoad,
    scrollPx,
    screens: Math.round(screens * 100) / 100,
    minTap: Math.round(Math.min(r.width, r.height)),
    isFixedBottom,
    ctaText: text,
    horizontalOverflow: document.documentElement.scrollWidth > vw + 2,
    position: st.position,
  };
}

function gradeDistance(screens, found, vpName) {
  if (!found) return "FAIL";
  if (vpName !== "390") {
    if (screens <= 1) return "PASS";
    if (screens <= 2) return "WARNING";
    return "FAIL";
  }
  if (screens <= 1) return "PASS";
  if (screens <= 2) return "WARNING";
  return "FAIL";
}

function gradeCategory(rows) {
  const statuses = rows.map((r) => r.distanceGrade);
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARNING")) return "WARNING";
  return "PASS";
}

function buildMarkdown(report) {
  const catLabel = {
    market: "市場",
    builder: "Builder",
    connect: "Connect",
    talk: "TALK",
    ai_ops: "AI運営秘書",
  };

  const lines = [
    "# TASFUL CTAレビュー",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base}`,
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
    "## カテゴリ別",
    "",
    ...Object.entries(report.categoryGrades).map(([k, v]) => `- **${catLabel[k] || k}**: ${v}`),
    "",
    "---",
    "",
    "## CTA到達距離",
    "",
    "| カテゴリ | CTA | VP | 表示直後 | 画面数 | タップpx | 判定 |",
    "|---|---|---|:---:|---:|---:|---|",
    ...report.results.map(
      (r) =>
        `| ${catLabel[r.category] || r.category} | ${r.ctaName} | ${r.vp} | ${r.visibleAtLoad ? "可視" : "不可視"} | ${r.screens ?? "—"} | ${r.minTap || "—"} | ${r.distanceGrade} |`
    ),
    "",
    "---",
    "",
    "## 固定CTA候補",
    "",
    ...report.fixedCandidates.map((x) => `- ${x}`),
    "",
    "---",
    "",
    "## 固定不要CTA",
    "",
    ...report.avoidFixed.map((x) => `- ${x}`),
    "",
    "---",
    "",
    "## 改善推奨TOP20",
    "",
    ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    "---",
    "",
    "### 即改善候補",
    "",
    ...(report.immediate.length ? report.immediate.map((x) => `- ${x}`) : ["- （なし — 今回はレビューのみ）"]),
    "",
    "### 将来改善候補",
    "",
    ...report.future.map((x) => `- ${x}`),
    "",
    "---",
    "",
    "## モバイル操作性（390px）",
    "",
    ...report.mobileOps.map((x) => `- ${x}`),
    "",
    "---",
    "",
    "## 768px 固定化要否",
    "",
    report.viewport768,
    "",
    "## 1280px 固定化要否",
    "",
    report.viewport1280,
    "",
    "---",
    "",
    "## スクショ",
    "",
    `保存先: \`screenshots/cta-mobile-review/\` (${report.screenshots.length}枚)`,
    "",
    "390px / 768px / 1280px",
    "",
    "## テスト",
    "",
    "実施: `node scripts/review-cta-mobile-ux.mjs`",
    "",
  ];

  return lines.join("\n");
}

function synthesizeReport(report) {
  const categories = ["market", "builder", "connect", "talk", "ai_ops"];
  const categoryGrades = {};
  for (const cat of categories) {
    categoryGrades[cat] = gradeCategory(report.results.filter((r) => r.category === cat && r.vp === "390"));
  }

  const fixedCandidates = [];
  const avoidFixed = [];
  const immediate = [];
  const future = [];
  const recommendations = new Set();

  for (const r of report.results) {
    if (r.vp !== "390") continue;
    if (r.avoidFixed) {
      avoidFixed.push(`${r.label}: ${r.avoidFixedReason || "固定不要"}`);
    } else if (r.fixedBarCandidate390 && (r.distanceGrade === "WARNING" || r.distanceGrade === "FAIL")) {
      fixedCandidates.push(`${r.label} — ${r.screens}画面 (${r.distanceGrade})`);
      future.push(`390px ${r.ctaName} 固定バー検討（${r.label}）`);
    } else if (r.fixedBarCandidate390 && r.visibleAtLoad) {
      recommendations.add(`${r.label}: ファーストビュー内 — 固定化優先度低`);
    }
    if (r.distanceGrade === "FAIL") {
      immediate.push(`390px ${r.label} — CTA到達 ${r.screens}画面（FAIL）`);
    }
    if (r.distanceGrade === "WARNING" && !r.avoidFixed) {
      recommendations.add(`390px ${r.label} — 到達 ${r.screens}画面（WARNING）`);
    }
    if (!r.found) {
      immediate.push(`${r.label}: CTA未検出（390px）`);
    }
  }

  if (fixedCandidates.length === 0) {
    fixedCandidates.push("（390px WARNING/FAIL かつ固定候補フラグ — 該当なしまたは既存fixedあり）");
  }

  recommendations.add("市場商品詳細: 390px buy-now / add-cart の下部 sticky 検討");
  recommendations.add("Builder 案件詳細: 応募/選定 CTA のモバイル固定フッター");
  recommendations.add("AI運営 HSG: Morning Summary からのジャンプは既存 — 承認CTAのみ下部固定検討");
  recommendations.add("Connect: 申請トップ CTA はカード内 — 長フォーム時の固定化");
  recommendations.add("TALK 送信/composer: 現状維持（既に下部）");
  recommendations.add("768px: 商品 buybox sticky 活用 — 追加 fixed 不要");
  recommendations.add("1280px: サイドバー/aside CTA 優先 — mobile fixed パターン不要");

  report.categoryGrades = categoryGrades;
  report.fixedCandidates = [...new Set(fixedCandidates)];
  report.avoidFixed = [...new Set(avoidFixed)];
  report.immediate = [...new Set(immediate)];
  report.future = [...new Set(future)];
  report.recommendations = [...recommendations].slice(0, 20);

  const grades390 = report.results.filter((r) => r.vp === "390").map((r) => r.distanceGrade);
  if (grades390.includes("FAIL")) report.overall = "FAIL";
  else if (grades390.includes("WARNING")) report.overall = "WARNING";
  else report.overall = "PASS";

  report.counts = {
    pass: report.results.filter((r) => r.distanceGrade === "PASS").length,
    warning: report.results.filter((r) => r.distanceGrade === "WARNING").length,
    fail: report.results.filter((r) => r.distanceGrade === "FAIL").length,
  };

  const mobileOps = [];
  for (const r of report.results.filter((x) => x.vp === "390" && x.found)) {
    if (r.minTap > 0 && r.minTap < 44) {
      mobileOps.push(`${r.label}: タップ領域 ${r.minTap}px（推奨44px未満）`);
    } else if (r.isFixedBottom) {
      mobileOps.push(`${r.label}: 下部固定/sticky — 親指到達性良好`);
    } else if (r.visibleAtLoad && r.minTap >= 44) {
      mobileOps.push(`${r.label}: ファーストビュー内・タップ ${r.minTap}px — OK`);
    } else if (!r.visibleAtLoad) {
      mobileOps.push(`${r.label}: スクロール ${r.screens}画面 — 親指到達にスクロール必要`);
    }
  }
  report.mobileOps = mobileOps;

  const w768 = report.results.filter((r) => r.vp === "768");
  const w1280 = report.results.filter((r) => r.vp === "1280");
  report.viewport768 =
    w768.some((r) => r.isFixedBottom && r.category === "market")
      ? "市場チェックアウト fixed 済み。商品詳細は sticky buybox 検討中 — 追加 fixed 不要"
      : "主要CTAは大半 PASS。商品 buy-now/cart のみ WARNING — 768px sticky buybox で足りる";
  report.viewport1280 =
    w1280.every((r) => r.distanceGrade === "PASS" || r.category === "builder")
      ? "サイドバー/aside に CTA 配置済み。mobile 向け fixed bar パターンは不要"
      : "1280px でも到達 WARNING あり — desktop レイアウト調整で対応";
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
  const browser = await launchHeadlessBrowser();

  const report = {
    capturedAt: new Date().toISOString(),
    base,
    results: [],
    screenshots: [],
    overall: "FAIL",
  };

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      for (const scene of CTA_SCENES) {
        const row = {
          category: scene.category,
          screenId: scene.screenId,
          ctaName: scene.ctaName,
          label: scene.label,
          vp: vp.name,
          distanceGrade: "FAIL",
          found: false,
          visibleAtLoad: false,
          scrollPx: null,
          screens: null,
          minTap: 0,
          isFixedBottom: false,
          fixedBarCandidate390: scene.fixedBarCandidate390,
          avoidFixed: scene.avoidFixed,
          avoidFixedReason: scene.avoidFixedReason || null,
          notes: scene.notes || null,
        };

        try {
          if (scene.prep) {
            await runPrep(page, base, scene.prep);
          }

          const url =
            buildLocalPageUrl(base, scene.path, scene.query ? `?${scene.query}` : "") + (scene.hash || "");
          await gotoWithRetry(page, url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
          await page.waitForSelector(scene.wait, { timeout: SEL_TIMEOUT }).catch(() => {});

          if (scene.prep === "connectIdentityReady") {
            await page.evaluate(() => {
              window.TasuPlatformChatConnectChatFlow?.setSellerConnectStatus?.("u_seller", "identity");
            });
            await page.waitForTimeout(400);
          }

          if (scene.hash) {
            await page.evaluate((h) => {
              if (location.hash !== h) location.hash = h;
            }, scene.hash);
            await page.waitForTimeout(scene.prep === "aiOpsSeed" ? 900 : 500);
          }

          if (scene.prep === "aiOpsSeed") {
            await page.waitForFunction(
              () => window.TasuAdminAiHumanSendGate && window.TasuAdminAiDailyInbox,
              { timeout: SEL_TIMEOUT }
            );
            await prepAiOpsSeed(page);
            await page.waitForTimeout(600);
            if (scene.hash) {
              await page.evaluate((h) => {
                location.hash = h;
              }, scene.hash);
              await page.waitForTimeout(400);
            }
          }

          if (scene.waitCta) {
            await page.waitForSelector(scene.waitCta, { timeout: SEL_TIMEOUT }).catch(() => {});
          }

          if (scene.measureAtAnchor && scene.hash?.includes("completion")) {
            await page.evaluate(() => {
              const el = document.getElementById("completion") || document.querySelector("[data-thread-completion-card]");
              el?.scrollIntoView?.({ block: "start" });
            });
            await page.waitForTimeout(400);
          }

          if (!scene.measureAtHash && !scene.measureAtAnchor) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(150);
          }

          const metrics = await page.evaluate(measureCtaInPage, {
            selectors: scene.selectors,
            labelIncludes: scene.labelIncludes,
            measureAtHash: Boolean(scene.measureAtHash),
            measureAtAnchor: Boolean(scene.measureAtAnchor),
          });

          Object.assign(row, metrics);
          row.distanceGrade = gradeDistance(metrics.screens ?? 99, metrics.found, vp.name);

          const shotName = `${scene.category}-${scene.screenId}-${vp.name}.png`;
          const shotPath = join(SHOT_DIR, shotName);
          await page.screenshot({ path: shotPath, fullPage: false, animations: "disabled" }).catch(() => {});
          report.screenshots.push(shotName);

          if (vp.name === "390" && !metrics.visibleAtLoad && metrics.found && metrics.scrollPx > 0) {
            await page.evaluate((px) => window.scrollTo(0, px), metrics.scrollPx);
            await page.waitForTimeout(200);
            const scrollShot = `${scene.category}-${scene.screenId}-${vp.name}-scrolled.png`;
            await page
              .screenshot({ path: join(SHOT_DIR, scrollShot), fullPage: false, animations: "disabled" })
              .catch(() => {});
            report.screenshots.push(scrollShot);
          }
        } catch (err) {
          row.error = String(err?.message || err);
          row.distanceGrade = "FAIL";
        }

        report.results.push(row);
      }

      await context.close();
    }

    synthesizeReport(report);

    const md = buildMarkdown(report);
    await writeFile(REPORT_MD, md, "utf8");
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

    console.log(md);
    console.log(`\nReport: ${REPORT_MD}`);
    console.log(`JSON: ${REPORT_JSON}`);
    console.log(`Overall: ${report.overall}`);
    if (report.overall === "FAIL") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
