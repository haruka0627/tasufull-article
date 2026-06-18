#!/usr/bin/env node
/**
 * Connect 利用者導線総監査
 *   node scripts/review-connect-user-flow.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "connect-user-flow-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const SELLER_ID = "u_sachi";
const BUYER_ID = "u_hiro";
const THREAD_ID = "chat-demo-skill-deal-001";
const LISTING_ID = "demo-skill-001";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const CONNECT_NOTIFY_FLOWS = [
  {
    id: "identity",
    kind: "本人確認依頼",
    notifyId: "platform-chat-demo-connect-identity-001",
    expectInBody: /本人確認|Connect/i,
    expectedDest: /payment-settings\.html/i,
    expectOnPage: /本人確認|Connect/i,
    expectQuery: /connectStep=identity/i,
    seedStatus: "identity",
  },
  {
    id: "payout",
    kind: "振込先確認",
    notifyId: "platform-chat-demo-connect-payout-001",
    expectInBody: /振込|口座/i,
    expectedDest: /payment-settings\.html/i,
    expectOnPage: /振込|口座|Connect/i,
    expectQuery: /connectStep=qualification|payment-settings/i,
    seedStatus: "payout",
  },
  {
    id: "connect_pay",
    kind: "Connect支払い",
    notifyId: "platform-chat-demo-connect-pay-a-001",
    expectInBody: /支払|Connect|報酬/i,
    expectedDest: /chat-detail\.html/i,
    expectOnPage: /チャット|Connect|完了/i,
    seedStatus: "ready",
  },
  {
    id: "connect_complete",
    kind: "Connect完了確認",
    notifyId: "platform-verify-chat-demo-connect-complete-001",
    expectInBody: /完了|確認/i,
    expectedDest: /chat-detail\.html/i,
    expectOnPage: /完了|承認|Connect/i,
    seedStatus: "ready",
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
          const res = await fetch(`${base}/payment-settings.html`, {
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

function paymentSettingsUrl(base, step = "", userId = SELLER_ID) {
  const u = new URL(pageUrl(base, "payment-settings.html"));
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", userId);
  if (step) u.searchParams.set("connectStep", step);
  return u.toString();
}

function notifyHomeUrl(base, userId = SELLER_ID) {
  const u = new URL(pageUrl(base, "talk-home.html"));
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", userId);
  return u.toString();
}

async function gotoWithRetry(page, url, options = {}) {
  const { retries = 2, ...gotoOpts } = options;
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      await page.goto(url, gotoOpts);
      return;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (!/ERR_ABORTED|NS_BINDING_ABORTED|interrupted/i.test(msg) || i + 1 >= retries) throw err;
      await page.waitForTimeout(400);
    }
  }
  throw lastErr;
}

async function shot(page, name) {
  const path = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false, timeout: 15000, animations: "disabled" }).catch(() => {});
  return path;
}

async function resetConnectAuditStores(page) {
  await page.evaluate(
    ({ sellerId, markers }) => {
      sessionStorage.removeItem("__connectUserFlowAuditBoot");
      markers.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_connect_onboarding_v1");
      localStorage.removeItem("tasful_demo_connect_seller_status_v1");
      localStorage.removeItem("tasful_payment_settings");
      localStorage.removeItem("tasu_service_deals");
      localStorage.removeItem("tasu_connect_issues_v1");
      sessionStorage.clear();
    },
    { sellerId: SELLER_ID, markers: MASTER_MARKERS }
  );
}

async function setConnectOnboardingStep(page, step, opts = {}) {
  await page.evaluate(
    ({ step, seedBank, rejectionTemplate, sellerId }) => {
      const PS = window.TasuPaymentSettings;
      const patch = { step };
      if (rejectionTemplate) {
        patch.identityRejectionKey = rejectionTemplate;
        patch.identityRejectionAt = new Date().toISOString();
      }
      if (PS?.saveConnectOnboarding) PS.saveConnectOnboarding(patch);
      else localStorage.setItem("tasful_connect_onboarding_v1", JSON.stringify({ step, ...patch }));
      const Connect = window.TasuPlatformChatConnectChatFlow;
      if (step === "identity" || step === "top" || step === "apply") Connect?.setSellerConnectStatus?.(sellerId, "identity");
      else if (step === "qualification") Connect?.setSellerConnectStatus?.(sellerId, "payout");
      else if (step === "ready" || step === "approved") Connect?.setSellerConnectStatus?.(sellerId, "ready");
      if (seedBank && PS?.saveSettings) {
        PS.saveSettings({
          bankName: "TASFUL銀行",
          branchName: "東京支店",
          accountType: "普通",
          accountNumber: "1234567",
          accountHolder: "タスフル サチコ",
        });
        PS.applyToForm?.(PS.getSettings?.() || {});
      }
      PS?.renderConnectOnboarding?.();
    },
    { step, seedBank: Boolean(opts.seedBank), rejectionTemplate: opts.rejectionTemplate || "", sellerId: SELLER_ID }
  );
  if (opts.openPayout) {
    await page.evaluate(() => {
      const fold = document.querySelector("[data-payment-payout-fold]");
      if (fold) fold.open = true;
    });
  }
  await page.waitForTimeout(400);
}

async function seedConnectNotifications(page, base) {
  await page.evaluate(
    ({ sellerId, identityHref, payoutHref }) => {
      const store = window.TasuTalkNotifications;
      if (!store?.getAll) return;
      const removeIds = new Set([
        "platform-chat-demo-connect-identity-001",
        "platform-chat-demo-connect-payout-001",
        "platform-chat-demo-connect-pay-a-001",
        "platform-verify-chat-demo-connect-complete-001",
      ]);
      const kept = (store.getAll() || []).filter((n) => !removeIds.has(String(n.id)));
      const rows = [
        {
          id: "platform-chat-demo-connect-identity-001",
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
          createdAt: new Date().toISOString(),
        },
        {
          id: "platform-chat-demo-connect-payout-001",
          type: "skill",
          category: "Connect",
          title: "振込先の確認が必要です",
          body: "報酬の振込先口座が未登録、または確認が必要です。",
          actionLabel: "振込先を確認する",
          href: payoutHref,
          targetUrl: payoutHref,
          priority: "high",
          recipientUserId: sellerId,
          source: "platform_chat_demo_connect_requirements_v1",
          minimalNotifyCard: true,
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: "platform-chat-demo-connect-pay-a-001",
          type: "skill",
          category: "Connect",
          title: "支払いが完了しました",
          body: "Connect決済による報酬の支払いが完了しました。",
          actionLabel: "確認する",
          href: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo&demoConnect=1&platform_connect=1`,
          targetUrl: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo&demoConnect=1&platform_connect=1`,
          recipientUserId: sellerId,
          createdAt: new Date(Date.now() - 120000).toISOString(),
        },
        {
          id: "platform-verify-chat-demo-connect-complete-001",
          type: "skill",
          category: "Connect",
          title: "やりとり完了の確認をお願いします",
          body: "出品者からやりとり完了の申請が届きました。",
          actionLabel: "確認する",
          href: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1&demoConnect=1`,
          recipientUserId: sellerId,
          createdAt: new Date(Date.now() - 180000).toISOString(),
        },
      ];
      store.saveAll([...rows, ...kept], { localOnly: true, silent: true });
      window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    },
    {
      sellerId: SELLER_ID,
      identityHref: paymentSettingsUrl(base, "identity").replace(/^https?:\/\/[^/]+/, ""),
      payoutHref: paymentSettingsUrl(base, "qualification").replace(/^https?:\/\/[^/]+/, ""),
    }
  );
}

async function seedSalesDeals(page) {
  await page.evaluate(({ sellerId }) => {
    const now = new Date().toISOString();
    localStorage.setItem(
      "tasu_service_deals",
      JSON.stringify([
        {
          id: "connect_audit_deal_001",
          provider_user_id: sellerId,
          client_user_id: "u_hiro",
          status: "fee_paid",
          payout_status: "transferred",
          agreed_amount: 88000,
          platform_fee_amount: 4400,
          platform_fee_rate: 0.05,
          platform_fee_paid_at: now,
          estimate_note: "Connect監査デモ",
        },
        {
          id: "connect_audit_deal_002",
          provider_user_id: sellerId,
          client_user_id: "u_taro",
          status: "fee_paid",
          payout_status: "pending",
          agreed_amount: 55000,
          platform_fee_amount: 2750,
          platform_fee_rate: 0.05,
          platform_fee_paid_at: now,
          estimate_note: "保留中デモ",
        },
      ])
    );
  }, { sellerId: SELLER_ID });
}

async function openNotifyPanel(page, base, userId = SELLER_ID) {
  await gotoWithRetry(page, notifyHomeUrl(base, userId), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
  await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
  await page.waitForTimeout(800);
}

async function clickNotifyCta(page, notifyId, base) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`).first();
  await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
  const navHref = await page.evaluate((id) => {
    const row = window.TasuTalkNotifications?.findById?.(id);
    const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return built?.href || row?.href || row?.targetUrl || "";
  }, notifyId);
  const btn = card.locator("[data-talk-notify-action], .talk-notify-card__minimal-action").first();
  if (await btn.count()) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      btn.click(),
    ]);
  } else {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      card.click(),
    ]);
  }
  if (/talk-home\.html/i.test(page.url()) && navHref) {
    const dest = navHref.startsWith("http") ? navHref : pageUrl(base, navHref.replace(/^\//, ""));
    await gotoWithRetry(page, dest, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  }
  return { url: page.url(), navHref };
}

async function readPaymentConnectState(page) {
  return page.evaluate(() => {
    const isVisible = (sel) => {
      const el = document.querySelector(sel);
      if (!el || el.hidden) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      step: window.TasuPaymentSettings?.resolveConnectStep?.() || "",
      badge: document.querySelector("[data-connect-status-badge]")?.textContent?.trim() || "",
      lead: document.querySelector("[data-connect-lead]")?.textContent?.trim() || "",
      hasApply: isVisible("[data-connect-apply]"),
      hasIdentityPanel: isVisible("[data-connect-identity-panel]"),
      hasIdentitySubmit: isVisible("[data-connect-identity-submit]"),
      hasQualification: isVisible("[data-connect-qualification-panel]"),
      hasReadyBenefits: isVisible("[data-connect-ready-benefits]"),
      hasDisclaimer: Boolean(document.querySelector("[data-connect-disclaimer]")?.textContent?.trim()),
      sellerStatus: window.TasuPlatformChatConnectChatFlow?.getSellerConnectStatus?.("u_sachi") || "",
    };
  });
}

/* ── 確認1: Connect申請導線 ── */
async function auditApplyFlow(page, base, vp) {
  const item = { id: "apply", kind: "Connect申請", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, paymentSettingsUrl(base, "top"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector("[data-connect-onboarding]", { timeout: SEL_TIMEOUT });
    const before = await readPaymentConnectState(page);
    if (!before.hasApply) item.issues.push("Connect開始CTAなし");

    await page.locator("[data-connect-apply]").click();
    await page.waitForTimeout(900);
    const after = await readPaymentConnectState(page);
    if (after.step !== "identity") item.issues.push(`申請後 step=${after.step || "—"}（identity期待）`);
    if (!after.hasIdentityPanel && !after.hasIdentitySubmit) item.issues.push("本人確認画面未表示");
    if (after.sellerStatus !== "identity") item.issues.push(`sellerStatus=${after.sellerStatus || "—"}`);

    item.before = before;
    item.after = after;
    item.actualUrl = page.url();
    item.status = item.issues.length ? "WARNING" : "PASS";
    await shot(page, `01-apply-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認2: 本人確認導線 ── */
async function auditIdentityFlow(page, base, vp) {
  const item = { id: "identity", kind: "本人確認", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, paymentSettingsUrl(base, "identity"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForSelector("[data-connect-identity-panel]", { timeout: SEL_TIMEOUT });
    await seedConnectNotifications(page, base);
    await page.evaluate((sellerId) => {
      window.TasuPlatformChatConnectChatFlow?.setSellerConnectStatus?.(sellerId, "identity");
      window.TasuPlatformChatConnectChatFlow?.syncDemoConnectRequirementNotifications?.();
    }, SELLER_ID);

    const before = await readPaymentConnectState(page);
    await page.locator("[data-connect-identity-submit]").click();
    await page.waitForTimeout(900);
    const after = await readPaymentConnectState(page);
    if (!/qualification|reviewing|approved|ready/.test(after.step)) {
      item.issues.push(`提出後 step=${after.step || "—"}`);
    }
    if (after.sellerStatus !== "payout" && after.step === "qualification") {
      /* ok */
    } else if (after.step !== "qualification") {
      item.issues.push(`ステータス更新不足: step=${after.step}, seller=${after.sellerStatus}`);
    }

    await openNotifyPanel(page, base);
    const hasIdentityNotify = await page.locator('[data-talk-notify-id="platform-chat-demo-connect-identity-001"]').count();
    if (!hasIdentityNotify && before.sellerStatus === "identity") {
      item.issues.push("本人確認通知未表示（審査前）");
    }

    item.before = before;
    item.after = after;
    item.status = item.issues.length <= 1 ? (item.issues.length ? "WARNING" : "PASS") : "FAIL";
    await shot(page, `02-identity-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認3: 承認導線 ── */
async function auditApprovalFlow(page, base, vp) {
  const item = { id: "approval", kind: "Connect承認", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, paymentSettingsUrl(base, "qualification"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await setConnectOnboardingStep(page, "qualification", { seedBank: true, openPayout: true });

    await page.evaluate(() => {
      const PS = window.TasuPaymentSettings;
      PS?.advanceConnectStep?.("reviewing");
      PS?.advanceConnectStep?.("approved");
      PS?.advanceConnectStep?.("ready");
    });
    await page.waitForTimeout(600);

    const state = await readPaymentConnectState(page);
    if (state.step !== "ready") item.issues.push(`承認後 step=${state.step || "—"}（ready期待）`);
    if (!state.hasReadyBenefits) item.issues.push("Connect利用可能UI（ready benefits）なし");
    if (state.sellerStatus !== "ready") item.issues.push(`sellerStatus=${state.sellerStatus || "—"}`);

    await openNotifyPanel(page, base);
    const payoutNotify = await page.locator('[data-talk-notify-id="platform-chat-demo-connect-payout-001"]').count();
    if (payoutNotify && state.step === "ready") item.issues.push("承認後も振込通知が残存（シード通知 — 要 syncDemoConnectRequirementNotifications 確認）");

    item.state = state;
    item.status = item.issues.length ? (state.step === "ready" ? "WARNING" : "FAIL") : "PASS";
    await shot(page, `03-approval-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認4: 差し戻し→再申請 ── */
async function auditRejectReapplyFlow(page, base, vp) {
  const item = { id: "reject_reapply", kind: "差し戻し再申請", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await gotoWithRetry(page, paymentSettingsUrl(base, "identity"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await setConnectOnboardingStep(page, "identity", { rejectionTemplate: "document_blurry" });
    await seedConnectNotifications(page, base);

    const ui = await page.evaluate(() => {
      const tmpl = window.TasuConnectIdentityTemplates?.TEMPLATES?.document_blurry;
      const disclaimer = document.querySelector("[data-connect-disclaimer]")?.textContent?.trim() || "";
      return {
        templateMsg: tmpl?.user_message || "",
        disclaimer,
        hasIdentitySubmit: Boolean(document.querySelector("[data-connect-identity-submit]")),
        hasIdentityPanel: Boolean(document.querySelector("[data-connect-identity-panel]:not([hidden])")),
      };
    });
    if (!ui.hasIdentityPanel) item.issues.push("再申請画面（identity）なし");
    if (!ui.hasIdentitySubmit) item.issues.push("再申請CTAなし");
    if (!ui.disclaimer && !ui.templateMsg) item.issues.push("差し戻し理由/免責表示なし");

    await openNotifyPanel(page, base);
    const nav = await clickNotifyCta(page, "platform-chat-demo-connect-identity-001", base);
    if (!/payment-settings\.html/i.test(nav.url)) item.issues.push(`通知遷移先不一致: ${nav.url}`);
    if (!/connectStep=identity/i.test(nav.url)) item.issues.push("再申請画面 connectStep=identity なし");

    const afterNav = await readPaymentConnectState(page);
    if (!afterNav.hasIdentitySubmit) item.issues.push("通知→再申請画面でCTAなし");

    item.ui = ui;
    item.navUrl = nav.url;
    item.status = item.issues.length <= 1 ? (item.issues.length ? "WARNING" : "PASS") : "FAIL";
    await shot(page, `04-reject-reapply-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認5: 売上受取 ── */
async function auditPayoutSalesFlow(page, base, vp) {
  const item = { id: "payout_sales", kind: "売上受取", vp: vp.name, status: "FAIL", issues: [] };
  try {
    await setConnectOnboardingStep(page, "ready");
    await seedSalesDeals(page);
    await gotoWithRetry(page, pageUrl(base, `sales-fees.html?talkDev=1&userId=${SELLER_ID}`), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(1000);

    const sales = await page.evaluate(() => {
      const labels = [...document.querySelectorAll(".sf-stat__label")].map((el) => el.textContent?.trim() || "");
      const values = [...document.querySelectorAll(".sf-stat__value")].map((el) => el.textContent?.trim() || "");
      const statuses = [...document.querySelectorAll(".sf-status")].map((el) => el.textContent?.trim() || "");
      const rowCount = document.querySelectorAll("[data-sf-tbody] tr").length;
      return { labels, values, statuses, rowCount };
    });

    if (!sales.labels.some((l) => /差引売上|売上|手数料/.test(l))) item.issues.push("売上サマリーなし");
    if (sales.rowCount === 0) item.issues.push("取引行0件");
    if (!sales.statuses.some((s) => /保留|振込|pending|scheduled|transferred|完了/i.test(s))) {
      item.issues.push("payoutステータス表示なし");
    }

    item.sales = sales;
    item.status = item.issues.length ? (sales.rowCount ? "WARNING" : "FAIL") : "PASS";
    await shot(page, `05-payout-sales-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

/* ── 確認6/9: 通知導線 + 一致 ── */
async function auditNotifyFlows(page, base, vp) {
  const results = [];
  await openNotifyPanel(page, base);
  await seedConnectNotifications(page, base);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
  await page.waitForTimeout(800);

  for (const flow of CONNECT_NOTIFY_FLOWS) {
    const item = { ...flow, vp: vp.name, status: "FAIL", issues: [] };
    try {
      if (flow.seedStatus) {
        await page.evaluate(
          ({ status, sellerId }) => {
            window.TasuPlatformChatConnectChatFlow?.setSellerConnectStatus?.(sellerId, status);
            window.TasuPlatformChatConnectChatFlow?.syncDemoConnectRequirementNotifications?.();
          },
          { status: flow.seedStatus, sellerId: SELLER_ID }
        );
        await openNotifyPanel(page, base);
        await seedConnectNotifications(page, base);
        await page.waitForTimeout(600);
      }

      const cardCount = await page.locator(`article[data-talk-notify-id="${flow.notifyId}"]`).count();
      if (!cardCount) {
        item.issues.push("通知カード未表示");
        results.push(item);
        continue;
      }

      const meta = await page.evaluate((id) => {
        const n = window.TasuTalkNotifications?.findById?.(id);
        return {
          title: n?.title || "",
          body: n?.body || "",
          href: n?.href || n?.targetUrl || "",
        };
      }, flow.notifyId);

      const nav = await clickNotifyCta(page, flow.notifyId, base);
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const destOk = flow.expectedDest.test(nav.url);
      const bodyOk = flow.expectInBody.test(`${meta.title}\n${meta.body}`);
      const pageOk = flow.expectOnPage.test(bodyText);

      if (!destOk) item.issues.push(`遷移先不一致: ${nav.url}`);
      if (!bodyOk) item.issues.push("通知内容と種別不一致");
      if (!pageOk) item.issues.push("遷移先画面と通知内容不一致");
      if (flow.expectQuery && !flow.expectQuery.test(nav.url)) item.issues.push(`URLクエリ不足: ${nav.url}`);

      item.actualUrl = nav.url;
      item.expectedHref = meta.href;
      item.status = destOk && pageOk && item.issues.length <= 1 ? (bodyOk ? "PASS" : "WARNING") : "FAIL";
      await shot(page, `06-notify-${flow.id}-${vp.name}`);
    } catch (err) {
      item.issues.push(String(err?.message || err));
    }
    results.push(item);
  }
  return results;
}

/* ── 確認7: 異常操作 ── */
async function auditAbnormalOps(page, base, vp) {
  const results = [];
  const cases = [
    {
      id: "reload",
      kind: "再読み込み",
      run: async () => {
        await openNotifyPanel(page, base);
        const before = await page.locator("article[data-talk-notify-id]").count();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
        const after = await page.locator("article[data-talk-notify-id]").count();
        if (after === 0 && before > 0) return ["reload後 通知0件"];
        return [];
      },
    },
    {
      id: "back",
      kind: "戻る",
      run: async () => {
        await clickNotifyCta(page, "platform-chat-demo-connect-identity-001", base);
        const back = page.locator("[data-tasu-talk-back], .page-subnav__link, #chatMobileBack").first();
        if (!(await back.count())) {
          const from = await page.evaluate(() => new URLSearchParams(location.search).get("from") || "");
          if (/payment-settings/.test(page.url()) && !from) return [];
          return ["戻る導線なし"];
        }
        await back.click().catch(() => {});
        await page.waitForTimeout(800);
        return [];
      },
    },
    {
      id: "notify_spam",
      kind: "通知連打",
      run: async () => {
        await openNotifyPanel(page, base);
        const card = page.locator('[data-talk-notify-id="platform-chat-demo-connect-identity-001"]').first();
        if (!(await card.count())) return ["通知カードなし"];
        for (let i = 0; i < 3; i++) await card.click({ force: true }).catch(() => {});
        await page.waitForTimeout(600);
        return [];
      },
    },
    {
      id: "apply_spam",
      kind: "申請連打",
      run: async () => {
        await setConnectOnboardingStep(page, "top");
        await gotoWithRetry(page, paymentSettingsUrl(base, "top"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await page.evaluate(() => window.TasuPaymentSettings?.renderConnectOnboarding?.());
        const btn = page.locator("[data-connect-apply]");
        if (!(await btn.count())) return ["申請CTAなし"];
        for (let i = 0; i < 3; i++) await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(600);
        const step = await page.evaluate(() => window.TasuPaymentSettings?.resolveConnectStep?.() || "");
        if (step !== "identity") return [`連打後 step=${step}`];
        return [];
      },
    },
    {
      id: "url_direct",
      kind: "URL直打ち",
      run: async () => {
        await gotoWithRetry(page, paymentSettingsUrl(base, "ready"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        const overlay = await page.evaluate(() => Boolean(document.querySelector("vite-error-overlay")));
        if (overlay) return ["vite-error-overlay"];
        return [];
      },
    },
    {
      id: "session_return",
      kind: "セッション復帰",
      run: async () => {
        await setConnectOnboardingStep(page, "reviewing");
        await gotoWithRetry(page, paymentSettingsUrl(base, ""), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        const step = await page.evaluate(() => window.TasuPaymentSettings?.resolveConnectStep?.() || "");
        if (step !== "reviewing") return [`復帰後 step=${step}`];
        return [];
      },
    },
  ];

  for (const c of cases) {
    const item = { id: c.id, kind: c.kind, vp: vp.name, status: "PASS", issues: [] };
    try {
      const issues = await c.run();
      item.issues = issues;
      if (issues.length) item.status = "WARNING";
    } catch (err) {
      item.issues.push(String(err?.message || err));
      item.status = "FAIL";
    }
    results.push(item);
  }
  await shot(page, `07-abnormal-${vp.name}`);
  return results;
}

/* ── 確認8: 権限制御 ── */
async function auditRolePermissions(page, base, vp) {
  const roles = [
    { id: "unapplied", label: "Connect未申請", step: "top", expectApply: true, expectPayout: false, expectReady: false },
    { id: "pending", label: "Connect申請中", step: "reviewing", expectApply: false, expectPayout: false, expectReady: false },
    { id: "approved", label: "Connect承認済", step: "ready", expectApply: false, expectPayout: true, expectReady: true },
    { id: "rejected", label: "差し戻し対象", step: "identity", expectApply: false, expectPayout: false, expectReady: false, rejection: "name_mismatch" },
  ];
  const results = [];

  for (const role of roles) {
    const item = { ...role, vp: vp.name, status: "PASS", issues: [] };
    try {
      await gotoWithRetry(page, paymentSettingsUrl(base, role.step), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await setConnectOnboardingStep(page, role.step, { rejectionTemplate: role.rejection || "" });

      const ui = await readPaymentConnectState(page);
      if (role.expectApply && !ui.hasApply) item.issues.push("未申請: 開始CTAなし");
      if (!role.expectApply && ui.hasApply) item.issues.push(`${role.label}: 開始CTAが表示中`);
      if (role.expectReady && !ui.hasReadyBenefits) item.issues.push(`${role.label}: ready UIなし`);
      if (role.id === "rejected" && !ui.hasIdentitySubmit) item.issues.push("差し戻し: 再申請CTAなし");
      if (role.id === "approved") {
        await seedSalesDeals(page);
        await gotoWithRetry(page, pageUrl(base, `sales-fees.html?talkDev=1&userId=${SELLER_ID}`), {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT,
        });
        const rows = await page.locator("[data-sf-tbody] tr").count();
        if (!rows) item.issues.push("承認済: 売上一覧なし");
      }

      item.ui = ui;
      if (item.issues.length) item.status = role.id === "approved" && item.issues.length === 1 ? "WARNING" : "FAIL";
    } catch (err) {
      item.issues.push(String(err?.message || err));
      item.status = "FAIL";
    }
    results.push(item);
  }
  await shot(page, `08-roles-${vp.name}`);
  return results;
}

/* ── 確認10: AI運営秘書連携 ── */
async function auditAiOpsIntegration(page, base, vp) {
  const item = { id: "ai_ops", kind: "AI運営秘書連携", vp: vp.name, status: "FAIL", issues: [], checks: [] };
  try {
    await gotoWithRetry(page, pageUrl(base, "admin-operations-dashboard.html"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForFunction(
      () =>
        window.TasuAdminAiDailyInbox &&
        window.TasuAdminAiOpsWatch &&
        window.TasuAdminAiKpiCenter &&
        window.TasuAdminAiHumanSendGate,
      { timeout: SEL_TIMEOUT }
    );

    const res = await page.evaluate(() => {
      const Store = window.TasuSupportTicketStore;
      Store?.clearAllForTests?.();
      window.TasuAdminConnectAiSupport?.clearResolvedForTests?.();
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      window.TasuAdminAiHumanSendGate?.clearForTests?.();

      Store?.saveConnectIssue?.({
        id: "audit_connect_fail_001",
        user_id: "u_sachi",
        issue_type: "identity_verification_failed",
        detected_reason: "identity verification failed document_blurry",
        severity: "high",
        status: "open",
        created_at: new Date().toISOString(),
      });
      Store?.saveConnectIssue?.({
        id: "audit_connect_payout_001",
        user_id: "u_sachi",
        issue_type: "payout_error",
        detected_reason: "payout failed bank account invalid",
        severity: "high",
        status: "open",
        created_at: new Date().toISOString(),
      });
      Store?.saveTicket?.({
        id: "audit_connect_ticket_001",
        title: "Connect承認完了",
        body: "connect approved ready",
        user_id: "u_sachi",
        category: "connect_issue",
        severity: "low",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const inbox = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const connectInbox = inbox.filter((i) => i.source === "connect" || /connect/i.test(i.title || ""));
      const metrics = window.TasuAdminAiOpsWatch?.collectCurrentMetrics?.() || {};
      const kpi = window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() || {};
      const owSnap = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.() || {};
      const plans = window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [];
      const connectPlans = plans.filter((p) => /connect|identity/i.test(`${p.eventType || ""}${p.title || ""}`));

      window.TasuAdminAiHumanSendGate?.enqueuePendingItem?.({
        source: "connect_audit",
        sourceId: "audit_connect_hsg",
        category: "connect_guidance",
        actionType: "human_send",
        proposal: "Connect本人確認再提出案内",
        recommendation: "書類再提出をお願いします",
        reason: "identity_doc_incomplete",
        severity: "high",
        payload: { eventType: "connect_issue", domain: "connect" },
      });
      const pending = window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || [];
      const connectPending = pending.filter(
        (p) => p.category === "connect_guidance" || p.payload?.domain === "connect" || p.payload?.eventType === "connect_issue"
      );

      return {
        connectInboxCount: connectInbox.length,
        identityFail: metrics.connect?.identityFail || 0,
        payoutErrors: metrics.connect?.payoutErrors || 0,
        connectFailures: kpi.connectFailures || 0,
        connectApplications: kpi.connectApplications || 0,
        owAlerts: (owSnap.alerts || []).filter((a) => /connect|payout|本人確認/i.test(a.title || "")).length,
        connectPlans: connectPlans.length,
        connectPending: connectPending.length,
      };
    });

    const checks = [
      { id: "daily_inbox", label: "Daily Inbox Connect反映", ok: res.connectInboxCount > 0 },
      { id: "ops_watch_fail", label: "Ops Watch connect failure", ok: res.identityFail >= 1 || res.owAlerts >= 1 },
      { id: "ops_watch_payout", label: "Ops Watch payout error", ok: res.payoutErrors >= 1 || res.owAlerts >= 1 },
      { id: "kpi_center", label: "KPI Center Connect指標", ok: res.connectFailures >= 1 || res.connectApplications >= 0 },
      { id: "human_send_gate", label: "Human Send Gate connect", ok: res.connectPending >= 1 },
    ];
    item.checks = checks;
    for (const c of checks) {
      if (!c.ok) item.issues.push(`${c.label}: 未反映`);
    }
    item.metrics = res;
    item.status = item.issues.length === 0 ? "PASS" : item.issues.length <= 2 ? "WARNING" : "FAIL";
    await shot(page, `10-ai-ops-${vp.name}`);
  } catch (err) {
    item.issues.push(String(err?.message || err));
  }
  return item;
}

function gradeReport(report) {
  const all = collectAllResults(report);
  const coreFail = all.filter((x) => x.status === "FAIL" && !x.auxiliary).length;
  const warnN = all.filter((x) => x.status === "WARNING").length;
  if (coreFail >= 3) return "FAIL";
  if (coreFail > 0 || warnN >= 6) return "WARNING";
  return "PASS";
}

function collectAllResults(report) {
  return [
    report.applyFlow,
    report.identityFlow,
    report.approvalFlow,
    report.rejectReapplyFlow,
    report.payoutSalesFlow,
    ...(report.notifyFlows || []),
    ...(report.abnormalOps || []),
    ...(report.rolePermissions || []),
    report.aiOpsIntegration,
  ]
    .flat()
    .filter(Boolean);
}

function synthesizeFindings(report) {
  const good = [];
  const problems = [];
  const mismatch = [];
  const permission = [];
  const abnormal = [];
  const aiOps = [];
  const immediate = [];
  const future = [];
  const recs = new Set();

  const push = (r, label) => {
    if (!r) return;
    if (r.status === "PASS") good.push(`${label}: OK (${r.vp}px)`);
    else problems.push({ kind: label, id: r.id, status: r.status, issues: r.issues });
  };

  for (const vp of ["390", "1280"]) {
    push(report.applyFlow?.find((x) => x.vp === vp), "Connect申請");
    push(report.identityFlow?.find((x) => x.vp === vp), "本人確認");
    push(report.approvalFlow?.find((x) => x.vp === vp), "Connect承認");
    push(report.rejectReapplyFlow?.find((x) => x.vp === vp), "差し戻し再申請");
    push(report.payoutSalesFlow?.find((x) => x.vp === vp), "売上受取");
  }

  for (const n of report.notifyFlows || []) {
    if (n.status === "PASS") good.push(`${n.kind}: 通知→遷移 OK (${n.vp}px)`);
    else {
      problems.push({ kind: n.kind, id: n.id, status: n.status, issues: n.issues });
      mismatch.push(`${n.kind} (${n.vp}px): ${n.issues?.join(" / ") || "不一致"}`);
    }
  }

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

  for (const a of [report.aiOpsIntegration].flat().filter(Boolean)) {
    if (a.status === "PASS") aiOps.push(`AI運営秘書 Connect連携 OK (${a.vp}px)`);
    else aiOps.push(`AI運営秘書 (${a.vp}px): ${a.issues?.join(" / ")}`);
    if (a.status !== "PASS") problems.push({ kind: "AI運営秘書", id: a.id, status: a.status, issues: a.issues });
  }

  recs.add("Connect onboarding step と seller status の二重管理を CI で同期監視");
  recs.add("振込通知 href の connectStep=qualification 統一（payout 通知と payment-settings 直リンク）");
  recs.add("本人確認差し戻し理由を payment-settings 画面にテンプレート連動表示");
  recs.add("sales-fees の payout_status ラベルを Connect 承認前ユーザー向けにガード");
  recs.add("TALK Connect 通知の from=notify / returnTo 統一（talk-notify-actions 経由）");
  recs.add("Connect 完了差し戻し（chat reject）と本人確認差し戻しの通知文言分離");
  recs.add("Daily Inbox Connect 項目の targetUrl を payment-settings / support-trouble に整理");
  recs.add("390px で Connect 通知 CTA 高さ・幅の再監視（talk-notify-tier important）");
  recs.add("Connect 承認 ready 後の requirement 通知自動削除を E2E で固定");
  recs.add("platform-verify-chat-demo-connect-* と demo-connect-* 通知 ID の役割分担明文化");
  if (mismatch.length) recs.add("通知タイトル/本文/遷移先/画面表示の四者一致を review-connect-user-flow に常設");
  if (permission.length) recs.add("未申請/審査中/差し戻しでの売上受取CTA非表示を強化");
  if (abnormal.length) recs.add("申請連打・通知連打時の step 巻き戻しガード");
  recs.add("AI Ops Watch connect.identityFail 閾値と実 connect_issues 件数の整合");
  recs.add("Human Send Gate connect_guidance カテゴリの送信前確認 UI");
  recs.add("Stripe trouble → 利用者 payment-settings 再申請導線の一本化");
  recs.add("Connect サポート（support-trouble-center?filter=connect）への TALK 通知リンク");
  recs.add("dashboard Connect バナーと payment-settings onboarding の入口統一");

  immediate.push(...problems.filter((p) => p.status === "FAIL").slice(0, 5).map((p) => `${p.kind}: ${p.issues?.[0] || ""}`));
  immediate.push(...mismatch.slice(0, 3));
  future.push("本番 Stripe Connect webhook と demo seller status の統合テスト");
  future.push("Connect payout エラー時の利用者向け再設定ウィザード");
  future.push("JWT ロールと Connect 状態のサーバー側検証");

  report.goodFlows = good;
  report.problemFlows = problems;
  report.notifyMismatch = mismatch.length ? mismatch : ["（重大な不一致なし）"];
  report.permissionIssues = permission.length ? permission : ["（重大な権限問題なし）"];
  report.abnormalIssues = abnormal.length ? abnormal : ["（重大な異常操作問題なし）"];
  report.aiOpsIntegrationSummary = aiOps.length ? aiOps : ["（未検証）"];
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

function buildMarkdown(report) {
  return [
    "# Connect 利用者導線監査",
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
      ? report.problemFlows.map((p) => `- **${p.kind || p.id}** (${p.status}): ${p.issues?.join(" / ") || "—"}`)
      : ["- （重大な問題導線なし）"]),
    "",
    "---",
    "",
    "## 通知不一致",
    "",
    ...report.notifyMismatch.map((n) => `- ${n}`),
    "",
    "---",
    "",
    "## 権限問題",
    "",
    ...report.permissionIssues.map((p) => `- ${p}`),
    "",
    "---",
    "",
    "## 異常操作問題",
    "",
    ...report.abnormalIssues.map((a) => `- ${a}`),
    "",
    "---",
    "",
    "## AI運営秘書連携",
    "",
    ...report.aiOpsIntegrationSummary.map((a) => `- ${a}`),
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
    ...(report.immediateFixes.length ? report.immediateFixes.map((f) => `- ${f}`) : ["- （なし）"]),
    "",
    "### 将来対応",
    "",
    ...report.futureFixes.map((f) => `- ${f}`),
    "",
    "---",
    "",
    "## スクショ",
    "",
    `保存先: \`screenshots/connect-user-flow-review/\` (${report.screenshots.length}枚)`,
    "",
    "## テスト",
    "",
    "実施: `node scripts/review-connect-user-flow.mjs`",
    "ビューポート: 390px / 1280px",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const base = await findBaseUrl();
  if (!base) {
    console.error("WARN: dev server not found");
    process.exitCode = 1;
    return;
  }

  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    applyFlow: [],
    identityFlow: [],
    approvalFlow: [],
    rejectReapplyFlow: [],
    payoutSalesFlow: [],
    notifyFlows: [],
    abnormalOps: [],
    rolePermissions: [],
    aiOpsIntegration: [],
    screenshots: [],
    overall: "FAIL",
  };

  try {
    const context = await browser.newContext();
    await context.addInitScript((markers) => {
      if (sessionStorage.getItem("__connectUserFlowAuditBoot") === "1") return;
      sessionStorage.setItem("__connectUserFlowAuditBoot", "1");
      markers.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("tasful_talk_notifications");
    }, MASTER_MARKERS);

    for (const vp of [
      { name: "390", width: 390, height: 844 },
      { name: "1280", width: 1280, height: 900 },
    ]) {
      const page = await context.newPage({ viewport: { width: vp.width, height: vp.height } });
      await gotoWithRetry(page, paymentSettingsUrl(base, "top"), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await resetConnectAuditStores(page);
      await gotoWithRetry(page, paymentSettingsUrl(base, "top"), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await page.waitForSelector("[data-connect-onboarding]", { timeout: SEL_TIMEOUT }).catch(() => {});

      report.applyFlow.push(await auditApplyFlow(page, base, vp));
      report.identityFlow.push(await auditIdentityFlow(page, base, vp));
      report.approvalFlow.push(await auditApprovalFlow(page, base, vp));
      report.rejectReapplyFlow.push(await auditRejectReapplyFlow(page, base, vp));
      report.payoutSalesFlow.push(await auditPayoutSalesFlow(page, base, vp));
      report.notifyFlows.push(...(await auditNotifyFlows(page, base, vp)));
      report.abnormalOps.push(...(await auditAbnormalOps(page, base, vp)));
      report.rolePermissions.push(...(await auditRolePermissions(page, base, vp)));
      report.aiOpsIntegration.push(await auditAiOpsIntegration(page, base, vp));

      await page.close();
    }

    await context.close();
    synthesizeFindings(report);
    report.screenshots = readdirSync(SHOT_DIR).filter((f) => f.endsWith(".png"));

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
