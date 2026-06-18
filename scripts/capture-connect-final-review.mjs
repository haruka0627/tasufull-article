#!/usr/bin/env node
/**
 * Connect — 最終UX監査（調査・キャプチャ・レポートのみ）
 *   node scripts/capture-connect-final-review.mjs
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
const OUT = path.join(root, "screenshots", "connect-final-review");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const SELLER_ID = "u_sachi";
const BUYER_ID = "u_hiro";
const THREAD_ID = "chat-demo-skill-deal-001";
const LISTING_ID = "demo-skill-001";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications",
  "tasful_talk_notifications_seeded_v2",
];

/** @type {Array<{ key: string, label: string, notifyIds: string[], navId?: string }>} */
const CONNECT_NOTIFY_CATEGORIES = [
  {
    key: "identity",
    label: "本人確認通知",
    notifyIds: ["platform-chat-demo-connect-identity-001"],
    navId: "platform-chat-demo-connect-identity-001",
  },
  {
    key: "payout",
    label: "振込設定通知",
    notifyIds: ["platform-chat-demo-connect-payout-001"],
    navId: "platform-chat-demo-connect-payout-001",
  },
  {
    key: "connect_pay",
    label: "Connect支払い通知",
    notifyIds: ["platform-chat-demo-connect-pay-a-001"],
    navId: "platform-chat-demo-connect-pay-a-001",
  },
  {
    key: "connect_related",
    label: "Connect関連通知",
    notifyIds: [
      "platform-chat-demo-connect-refund-001",
      "platform-verify-chat-demo-connect-complete-001",
      "platform-verify-skill-connect-complete-001",
    ],
    navId: "platform-verify-chat-demo-connect-complete-001",
  },
];

const IDENTITY_SCENES = [
  { key: "identity-start", label: "本人確認開始", step: "identity" },
  { key: "identity-reviewing", label: "本人確認中（審査）", step: "reviewing" },
  { key: "identity-ready", label: "本人確認完了", step: "ready" },
];

const PAYOUT_SCENES = [
  { key: "payout-qualification", label: "振込設定（資格確認）", step: "qualification", openPayout: true },
  { key: "payout-account", label: "口座設定", step: "qualification", openPayout: true, seedBank: true },
];

const CHAT_SCENES = [
  {
    key: "completion-pending",
    label: "Connect完了申請",
    userId: BUYER_ID,
    geminiKey: null,
  },
  {
    key: "completion-payment",
    label: "Connect支払い完了",
    userId: SELLER_ID,
    geminiKey: "completion",
  },
];

const FORBIDDEN_COMPLETED_CHAT_LABELS = [
  "やりとり完了を承認",
  "取引完了",
  "キャンセル申請",
  "承認する",
  "却下する",
  "レビューする",
  "レビューを書く",
];

const ALLOWED_COMPLETED_CHAT_SNIPPETS = ["取引が完了しました", "このやりとりは完了しています"];

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

function paymentSettingsUrl(base, step = "", userId = SELLER_ID) {
  const q = new URLSearchParams({
    talkDev: "1",
    userId,
  });
  if (step) q.set("connectStep", step);
  return buildLocalPageUrl(base, `payment-settings.html?${q.toString()}`);
}

function salesFeesUrl(base, userId = SELLER_ID) {
  return buildLocalPageUrl(base, `sales-fees.html?talkDev=1&userId=${encodeURIComponent(userId)}`);
}

function talkNotifyUrl(base, userId = SELLER_ID) {
  return buildLocalPageUrl(
    base,
    `talk-home.html?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

function chatUrl(base, userId, extra = {}) {
  const q = new URLSearchParams({
    thread: THREAD_ID,
    userId,
    listingId: LISTING_ID,
    demoProfile: "skill",
    demoConnect: "1",
    platform_connect: "1",
    connectEntryPayment: "1",
    entryProfile: "skill",
    liveFlow: "1",
    review: "chat-demo",
    talkDev: "1",
    from: "talk",
    ...extra,
  });
  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);
}

async function resetConnectStores(page) {
  await page.evaluate(
    ({ sellerId }) => {
      localStorage.removeItem("tasful_connect_onboarding_v1");
      localStorage.removeItem("tasful_demo_connect_seller_status_v1");
      localStorage.removeItem("tasful_payment_settings");
      localStorage.removeItem("tasu_service_deals");
      const Connect = window.TasuPlatformChatConnectChatFlow;
      if (Connect?.setSellerConnectStatus) Connect.setSellerConnectStatus(sellerId, "identity");
    },
    { sellerId: SELLER_ID }
  );
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
    globalThis.__tasuTalkNotificationsBootstrapped = false;
  }, { markers: MASTER_MARKERS });
}

async function openNotifyCenter(page, base, userId = SELLER_ID) {
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

async function setConnectStep(page, step, opts = {}) {
  await page.evaluate(
    ({ step, seedBank }) => {
      const PS = window.TasuPaymentSettings;
      if (PS?.saveConnectOnboarding && PS?.renderConnectOnboarding) {
        PS.saveConnectOnboarding({ step });
      } else {
        localStorage.setItem(
          "tasful_connect_onboarding_v1",
          JSON.stringify({ step, updatedAt: new Date().toISOString() })
        );
      }
      if (seedBank && PS?.saveSettings) {
        const next = PS.saveSettings({
          bankName: "TASFUL銀行",
          branchName: "東京支店",
          accountType: "普通",
          accountNumber: "1234567",
          accountHolder: "タスフル サチコ",
        });
        PS.applyToForm?.(next);
        const setVal = (sel, val) => {
          const el = document.querySelector(sel);
          if (el) el.value = val ?? "";
        };
        setVal("[data-payment-bank-name]", "TASFUL銀行");
        setVal("[data-payment-branch-name]", "東京支店");
        setVal("[data-payment-account-number]", "1234567");
        setVal("[data-payment-account-holder]", "タスフル サチコ");
      }
      window.TasuPaymentSettings?.renderConnectOnboarding?.();
    },
    { step, seedBank: Boolean(opts.seedBank) }
  );
  if (opts.openPayout || opts.seedBank) {
    await page.evaluate(() => {
      const fold = document.querySelector("[data-payment-payout-fold]");
      if (fold) fold.open = true;
      document.getElementById("payoutAccountTitle")?.scrollIntoView?.({ block: "start" });
    });
    await page.waitForTimeout(400);
  }
}

async function seedConnectNotifications(page, base) {
  await page.evaluate(
    ({ sellerId, buyerId, identityHref, payoutHref }) => {
      const store = window.TasuTalkNotifications;
      if (!store?.getAll) return;
      const removeIds = new Set([
        "platform-chat-demo-connect-identity-001",
        "platform-chat-demo-connect-payout-001",
        "platform-chat-demo-connect-pay-a-001",
        "platform-chat-demo-connect-refund-001",
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
          minimalNotifyCard: true,
          notifyDeadlineLabel: "期限: 7日以内",
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
          href: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo`,
          targetUrl: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo`,
          recipientUserId: sellerId,
          createdAt: new Date(Date.now() - 120000).toISOString(),
        },
        {
          id: "platform-chat-demo-connect-refund-001",
          type: "skill",
          category: "Connect",
          title: "返金が処理されました",
          body: "キャンセルに伴う返金が処理されました。",
          actionLabel: "確認する",
          href: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo`,
          recipientUserId: sellerId,
          createdAt: new Date(Date.now() - 180000).toISOString(),
        },
        {
          id: "platform-verify-chat-demo-connect-complete-001",
          type: "skill",
          category: "Connect",
          title: "やりとり完了の確認をお願いします",
          body: "出品者からやりとり完了の申請が届きました。",
          actionLabel: "確認する",
          href: `chat-detail.html?thread=chat-demo-skill-deal-001&userId=${encodeURIComponent(sellerId)}&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1`,
          recipientUserId: sellerId,
          createdAt: new Date(Date.now() - 240000).toISOString(),
        },
      ];
      if (store.saveAll) {
        store.saveAll([...rows, ...kept], { localOnly: true, silent: true });
      } else if (store.add) {
        rows.forEach((row) => store.add(row));
      }
      window.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
      );
    },
    {
      sellerId: SELLER_ID,
      buyerId: BUYER_ID,
      identityHref: paymentSettingsUrl(base, "identity").replace(/^https?:\/\/[^/]+/, ""),
      payoutHref: paymentSettingsUrl(base, "qualification").replace(/^https?:\/\/[^/]+/, ""),
    }
  );
}

async function seedSalesDeals(page) {
  await page.evaluate(({ sellerId }) => {
    const now = new Date().toISOString();
    const deals = [
      {
        id: "connect_audit_deal_001",
        service_id: "business-demo-field-001",
        provider_user_id: sellerId,
        client_user_id: "u_hiro",
        status: "fee_paid",
        payout_status: "transferred",
        agreed_amount: 88000,
        platform_fee_amount: 4400,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: now,
        created_at: now,
        updated_at: now,
        estimate_note: "外壁塗装（Connect監査デモ）",
      },
      {
        id: "connect_audit_deal_002",
        service_id: "business-demo-clean-001",
        provider_user_id: sellerId,
        client_user_id: "u_taro",
        status: "fee_paid",
        payout_status: "pending",
        agreed_amount: 55000,
        platform_fee_amount: 2750,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "ハウスクリーニング",
      },
      {
        id: "connect_audit_deal_003",
        service_id: "business-demo-garden-001",
        provider_user_id: sellerId,
        client_user_id: "u_yuki",
        status: "fee_paid",
        payout_status: "scheduled",
        agreed_amount: 42000,
        platform_fee_amount: 2100,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "庭木剪定・除草",
      },
      {
        id: "connect_audit_deal_004",
        service_id: "business-demo-photo-001",
        provider_user_id: sellerId,
        client_user_id: "u_ken",
        status: "fee_paid",
        payout_status: "completed",
        agreed_amount: 32000,
        platform_fee_amount: 1600,
        platform_fee_rate: 0.05,
        platform_fee_paid_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        created_at: now,
        updated_at: now,
        estimate_note: "商品撮影・レタッチ",
      },
    ];
    localStorage.setItem("tasu_service_deals", JSON.stringify(deals));
  }, { sellerId: SELLER_ID });
}

async function seedCompletionChat(page, mode) {
  await page.evaluate(
    ({ threadId, sellerId, buyerId, listingId, mode }) => {
      const store = window.TasuChatThreadStore;
      const Flow = window.TasuPlatformChatConnectChatFlow;
      const now = new Date().toISOString();
      const threads = (store?.readAll?.() || []).filter((t) => String(t.id) !== threadId);
      threads.unshift({
        id: threadId,
        chatDomain: "work",
        threadKind: "listing_inquiry",
        listingId,
        listingType: "skill",
        listingTitle: "プロ品質の動画編集・ショート動画制作",
        category: "スキル",
        dealId: "skill_deal_demo_001",
        sellerId,
        sellerName: "さちこ",
        partnerUserId: sellerId,
        buyerId,
        buyerName: "ひろ",
        roomStatus: mode === "payment" ? "completed" : "completion_pending",
        status: mode === "payment" ? "completed" : "completion_pending",
        connectEntryPayment: true,
        connectEntryPaidAt: now,
        platformContactKind: "purchase",
        completionRequestedBy: sellerId,
        completionRequestedAt: now,
        completionApprovedBy: mode === "payment" ? buyerId : undefined,
        completionApprovedAt: mode === "payment" ? now : undefined,
        completionDeliverySummary: "納品データをお送りしました",
        source: "chat-dual-window-demo",
        lastMessage: mode === "payment" ? "報酬の支払いが完了しました" : "納品完了を申請しました",
        createdAt: now,
        updatedAt: now,
      });
      store?.writeAll?.(threads);

      const raw = localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (mode === "pending") {
        map[threadId] = [
          {
            id: `msg-${threadId}-pending`,
            chatId: threadId,
            senderId: sellerId,
            senderName: "さちこ",
            text: "",
            createdAt: now,
            kind: "connect_completion_pending_card",
            connectPendingCard: {
              title: "やりとり完了申請",
              body: "承認すると報酬が支払われます。",
              status: "pending",
            },
          },
        ];
        Flow?.setPaymentState?.(threadId, { status: "pending" });
      } else {
        map[threadId] = [
          {
            id: `msg-${threadId}-payment`,
            chatId: threadId,
            senderId: "system",
            senderName: "TASFUL",
            text: "",
            createdAt: now,
            kind: "connect_payment_done_card",
            connectPaymentCard: {
              title: "✓ やりとりが完了しました",
              body: "報酬の支払いが完了しました",
            },
          },
        ];
        Flow?.setPaymentState?.(threadId, { status: "paid", paidAt: now });
      }
      localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    },
    { threadId: THREAD_ID, sellerId: SELLER_ID, buyerId: BUYER_ID, listingId: LISTING_ID, mode }
  );
}

async function extractNotifyAudit(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 2) issues.push(`横スクロール (${scrollW}px)`);

    const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
    const connectCards = cards.filter((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      return chip === "Connect" || /connect/i.test(id);
    });

    const cardRows = connectCards.map((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      const rect = el.getBoundingClientRect();
      const title = el.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const cta = el.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__card-cta");
      const ctaRect = cta?.getBoundingClientRect();
      const row =
        window.TasuTalkNotifications?.findById?.(id) ||
        (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find((n) => n.id === id);
      const href = String(row?.href || row?.targetUrl || cta?.getAttribute("href") || "").trim();
      let minFont = 99;
      el.querySelectorAll(".talk-notify-card__title, .talk-notify-card__text, .talk-notify-card__category-chip").forEach((node) => {
        const fs = parseFloat(getComputedStyle(node).fontSize) || 0;
        if (fs > 0 && fs < minFont) minFont = fs;
      });
      if (vpLabel === "390" && !el.classList.contains("talk-notify-card--cta-only")) {
        if (ctaRect && rect.width && ctaRect.width / rect.width > 0.92) {
          minors.push(`${id}: CTA幅 ${Math.round((ctaRect.width / rect.width) * 100)}%`);
        }
        if (ctaRect && ctaRect.height > 52) minors.push(`${id}: CTA高さ ${Math.round(ctaRect.height)}px`);
        if (minFont && minFont < 11) minors.push(`${id}: フォント ${minFont}px`);
      }
      return { id, title, chip, href, ctaText: cta?.textContent?.trim() || "", height: Math.round(rect.height) };
    });

    const gaps = [];
    for (let i = 1; i < connectCards.length; i += 1) {
      const a = connectCards[i - 1].getBoundingClientRect();
      const b = connectCards[i].getBoundingClientRect();
      gaps.push(Math.round(b.top - a.bottom));
    }

    return {
      totalCardCount: cards.length,
      connectCardCount: connectCards.length,
      cards: cardRows,
      cardGapsPx: gaps,
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
    }));
  });
}

async function auditPaymentSettings(page, sceneKey, vpLabel) {
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

      const step = window.TasuPaymentSettings?.resolveConnectStep?.() || "";
      const badge = text("[data-connect-status-badge]");
      const lead = text("[data-connect-lead]");
      const currentStep = document.querySelector(".dash-connect-step.is-current .dash-connect-step__label")?.textContent?.trim() || "";
      const hasHere = Boolean(document.querySelector(".dash-connect-step__here"));
      const identityPanel = visible("[data-connect-identity-panel]");
      const qualificationPanel = visible("[data-connect-qualification-panel]");
      const readyBenefits = visible("[data-connect-ready-benefits]");
      const payoutFoldOpen = document.querySelector("[data-payment-payout-fold]")?.open === true;
      const bankName = (document.querySelector("[data-payment-bank-name]")?.value || "").trim();

      const identity = {
        step,
        badge,
        lead,
        currentStep,
        hasHere,
        identityPanel,
        qualificationPanel,
        readyBenefits,
        identityCta: text("[data-connect-identity-submit]"),
      };

      const payout = {
        payoutFoldOpen,
        bankName,
        accountNumber: (document.querySelector("[data-payment-account-number]")?.value || "").trim(),
        payoutTitle: text("#payoutAccountTitle"),
        scrollPayoutCta: text("[data-connect-scroll-payout]"),
      };

      if (sceneKey.startsWith("identity")) {
        if (!badge) issues.push("ステータスバッジなし");
        if (!hasHere && step !== "ready") minors.push("「いまここ」表示なし");
        if (sceneKey === "identity-start" && !identityPanel) issues.push("本人確認パネル非表示");
        if (sceneKey === "identity-reviewing" && !/審査/.test(badge + lead)) minors.push("審査中の文言が弱い");
        if (sceneKey === "identity-ready" && !readyBenefits) issues.push("完了状態（ready benefits）非表示");
      }

      if (sceneKey.startsWith("payout")) {
        if (!qualificationPanel && step === "qualification") minors.push("振込先パネル非表示（qualification以外の可能性）");
        if (!payoutFoldOpen) minors.push("振込先口座フォールドが閉じている");
        if (sceneKey === "payout-account" && !bankName) issues.push("口座情報が未入力");
      }

      const main = document.querySelector("[data-connect-onboarding], .dash-content");
      const mainRect = main?.getBoundingClientRect();
      const vw = doc.clientWidth;
      if (vpLabel === "1280" && mainRect && mainRect.width < vw * 0.45) {
        minors.push(`1280px 間延び（コンテンツ幅 ${Math.round(mainRect.width)}px）`);
      }
      if (vpLabel === "1280" && mainRect) {
        const deadRight = vw - mainRect.right;
        if (deadRight > vw * 0.35) minors.push(`右デッドスペース ${Math.round(deadRight)}px`);
      }

      const buttons = [...document.querySelectorAll(".dash-btn, [data-connect-identity-submit], [data-payment-save-bank]")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (vpLabel === "390" && buttons.length >= 2) {
        for (let i = 0; i < buttons.length - 1; i += 1) {
          const a = buttons[i].getBoundingClientRect();
          const b = buttons[i + 1].getBoundingClientRect();
          if (a.bottom > b.top + 2 && Math.abs(a.left - b.left) < 40) {
            minors.push("ボタン縦方向の重なり疑い");
            break;
          }
        }
      }

      return { identity, payout, issues: [...new Set(issues)], minors: [...new Set(minors)] };
    },
    { sceneKey, vpLabel }
  );
}

async function auditSalesPage(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 2) issues.push(`横スクロール (${scrollW}px)`);

    const statLabels = [...document.querySelectorAll(".sf-stat__label")].map((el) => el.textContent?.trim() || "");
    const statValues = [...document.querySelectorAll(".sf-stat__value")].map((el) => el.textContent?.trim() || "");
    const statusTexts = [...document.querySelectorAll(".sf-status")].map((el) => el.textContent?.trim() || "");
    const rowCount = document.querySelectorAll("[data-sf-tbody] tr").length;

    const hasNetSales = statLabels.some((l) => /差引売上/.test(l));
    const hasPending = statusTexts.some((s) => /保留/.test(s));
    const hasPaid = statusTexts.some((s) => /振込済|完了|支払い済/.test(s));

    if (!hasNetSales) issues.push("差引売上サマリーなし");
    if (rowCount === 0) minors.push("取引行が0件（デモデータ不足の可能性）");
    if (!hasPending) minors.push("「保留中」ステータスが一覧にない");
    if (!hasPaid && rowCount > 0) minors.push("「振込済」相当のステータスラベルが弱い");

    const wrap = document.querySelector("[data-sf-table-wrap]");
    const wrapRect = wrap?.getBoundingClientRect();
    if (vpLabel === "390" && wrapRect && wrapRect.width > doc.clientWidth + 2) {
      minors.push("売上テーブルがビューポートをはみ出す可能性");
    }
    if (vpLabel === "1280" && wrapRect) {
      const deadRight = doc.clientWidth - wrapRect.right;
      if (deadRight > doc.clientWidth * 0.4) minors.push(`右デッドスペース ${Math.round(deadRight)}px`);
    }

    return {
      statLabels,
      statValues,
      statusTexts,
      rowCount,
      hasNetSales,
      hasPending,
      hasPaid,
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
}

async function auditChatPage(page, sceneKey, vpLabel) {
  return page.evaluate(
    ({ sceneKey, vpLabel, forbiddenLabels, allowedSnippets }) => {
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

      const visibleTextNodes = (labels) => {
        const hits = [];
        const nodes = document.querySelectorAll(
          "button, a[role='button'], .chat-complete-btn, [data-platform-review-open], [data-platform-job-review-open], .chat-job-review-prompt__btn"
        );
        for (const node of nodes) {
          if (node.hidden) continue;
          const st = getComputedStyle(node);
          if (st.display === "none" || st.visibility === "hidden") continue;
          const r = node.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
          if (!text) continue;
          for (const label of labels) {
            if (text.includes(label)) hits.push(label);
          }
        }
        return [...new Set(hits)];
      };

      const pending = {
        hasCard: visible("[data-connect-pending-card]"),
        hasApprove: visible("[data-connect-complete-approve]"),
        title: document.querySelector("[data-connect-pending-card] .chat-connect-card__title")?.textContent?.trim() || "",
      };
      const payment = {
        hasCard: visible("[data-connect-payment-card]"),
        title: document.querySelector("[data-connect-payment-card] .chat-connect-card__title")?.textContent?.trim() || "",
        body: document.querySelector("[data-connect-payment-card] .chat-connect-card__body")?.textContent?.trim() || "",
      };
      const payoutNote = document.querySelector(".chat-manual-pay__note")?.textContent?.trim() || "";
      const headerActions = {
        approveComplete: visible("#chatApproveCompleteBtn"),
        complete: visible("#chatCompleteBtn"),
        cancelRequest: visible("#chatCancelRequestBtn"),
        cancelApprove: visible("#chatCancelRespondApproveBtn"),
        cancelReject: visible("#chatCancelRespondRejectBtn"),
        reviewBar: visible("#chatReviewBarBtn"),
      };
      const forbiddenVisible = sceneKey === "completion-payment" ? visibleTextNodes(forbiddenLabels) : [];
      const allowedVisible = sceneKey === "completion-payment" ? visibleTextNodes(allowedSnippets) : [];

      if (sceneKey === "completion-pending") {
        if (!pending.hasCard) issues.push("完了申請カードなし");
        if (!pending.hasApprove) issues.push("承認ボタンなし");
        const reviewInPending = document.querySelector(
          "[data-connect-pending-card] [data-platform-review-open], [data-connect-pending-card] .chat-job-review-prompt__btn"
        );
        if (reviewInPending) issues.push("完了申請カード内にレビューCTAが混在");
      }
      if (sceneKey === "completion-payment") {
        if (!payment.hasCard) issues.push("支払い完了カードなし");
        if (!/完了|支払い/.test(payment.title + payment.body)) minors.push("支払い完了の文言が弱い");
        const reviewInChat = document.querySelector(
          "[data-platform-review-open], [data-platform-job-review-open], .chat-job-review-prompt__btn, [data-platform-job-review-prompt], [data-builder-mvp-thread-review-prompt], #chatReviewBarBtn:not([hidden])"
        );
        if (reviewInChat && visible("[data-platform-review-open], [data-platform-job-review-open], .chat-job-review-prompt__btn, [data-platform-job-review-prompt], [data-builder-mvp-thread-review-prompt], #chatReviewBarBtn")) {
          issues.push("完了済みチャット内にレビューCTAが残っている");
        }
        if (headerActions.approveComplete) issues.push("完了後画面にやりとり完了承認ボタンが残っている");
        if (headerActions.complete) issues.push("完了後画面に取引完了ボタンが残っている");
        if (headerActions.cancelRequest) issues.push("完了後画面にキャンセル申請ボタンが残っている");
        if (headerActions.cancelApprove) issues.push("完了後画面に承認するボタンが残っている");
        if (headerActions.cancelReject) issues.push("完了後画面に却下するボタンが残っている");
        if (forbiddenVisible.length) {
          issues.push(`完了後画面に禁止CTAが表示: ${forbiddenVisible.join(" / ")}`);
        }
        const pageText = String(document.body?.innerText || "").replace(/\s+/g, " ");
        const allowedInPage = allowedSnippets.filter((snippet) => pageText.includes(snippet));
        if (!allowedInPage.length && !allowedVisible.length) {
          minors.push("完了メッセージ（取引が完了しました等）の視認性が弱い");
        }
      }

      const input = document.querySelector("#chatInput, .chat-compose textarea, .chat-input-wrap");
      const inputRect = input?.getBoundingClientRect();
      const msgs = document.querySelector("#chatMessages, .chat-messages");
      const msgsRect = msgs?.getBoundingClientRect();
      let ctaOverlap = null;
      if (vpLabel === "390" && inputRect && msgsRect && inputRect.top > 0 && inputRect.top < window.innerHeight) {
        const lastCard = msgs?.querySelector(".chat-card:last-child, .chat-connect-card-wrap:last-child");
        const lastRect = lastCard?.getBoundingClientRect();
        if (lastRect && lastRect.bottom > inputRect.top + 2) {
          ctaOverlap = Math.round(lastRect.bottom - inputRect.top);
          if (ctaOverlap > 24) minors.push(`固定入力欄と本文重なり ${ctaOverlap}px`);
        }
      }

      return {
        pending,
        payment,
        payoutNote,
        headerActions,
        forbiddenVisible,
        allowedVisible,
        ctaOverlap,
        issues: [...new Set(issues)],
        minors: [...new Set(minors)],
      };
    },
    {
      sceneKey,
      vpLabel,
      forbiddenLabels: FORBIDDEN_COMPLETED_CHAT_LABELS,
      allowedSnippets: ALLOWED_COMPLETED_CHAT_SNIPPETS,
    }
  );
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

function buildGeminiChecklist(notifyAudit, navChecks, pages, vpLabel) {
  const navFail = navChecks.filter((n) => n.verdict === "FAIL").length;
  const navPass = navChecks.filter((n) => n.verdict === "PASS").length;
  const identityPage = pages.find((p) => p.stepId === `connect-identity-start-${vpLabel}`);
  const payoutPage = pages.find((p) => p.stepId === `connect-payout-account-${vpLabel}`);
  const salesPage = pages.find((p) => p.stepId === `connect-sales-${vpLabel}`);
  const notifyPage = pages.find((p) => p.stepId === `connect-notify-list-${vpLabel}`);

  return [
    {
      item: "本人確認（開始・審査・完了の状態表示）",
      ok: Boolean(identityPage?.data?.identity?.badge),
      note: identityPage?.data?.identity?.badge || "—",
    },
    {
      item: "振込設定（口座・振込先の分かりやすさ）",
      ok: Boolean(payoutPage?.data?.payout?.payoutFoldOpen),
      note: payoutPage?.data?.payout?.bankName || payoutPage?.data?.payout?.scrollPayoutCta || "—",
    },
    {
      item: "Connect通知（本人確認・振込・関連）",
      ok: (notifyAudit?.connectCardCount || 0) >= 4,
      note: `Connect ${notifyAudit?.connectCardCount || 0}件`,
    },
    {
      item: "売上画面（売上・ステータス区別）",
      ok: Boolean(salesPage?.data?.hasNetSales),
      note: salesPage?.data?.statusTexts?.join(", ") || "—",
    },
    {
      item: "通知→遷移 HTTP 200",
      ok: vpLabel !== "390" ? true : navFail === 0 && navPass >= 3,
      note: vpLabel !== "390" ? "390pxで検証" : `PASS ${navPass} / FAIL ${navFail}`,
    },
    {
      item: "390px 横スクロール・CTA被り",
      ok:
        vpLabel !== "390" ||
        (!(notifyPage?.issues || []).some((i) => /横スクロール/.test(i)) &&
          !(pages || []).some((p) => p.viewport === "390" && (p.data?.ctaOverlap || 0) > 12)),
      note: notifyPage?.data?.connectCardCount ? `Connect通知${notifyPage.data.connectCardCount}件` : "—",
    },
    {
      item: "1280px 間延び・デッドスペース",
      ok:
        vpLabel !== "1280" ||
        !(pages || []).some((p) => p.viewport === "1280" && (p.minors || []).some((m) => /間延び|デッド/.test(m))),
      note: "ダッシュボード幅を確認",
    },
  ];
}

const base = await findDevServerBaseUrl({ probePath: "payment-settings.html" });
const report = {
  generatedAt: new Date().toISOString(),
  base,
  overall: "PASS",
  pages: [],
  identityScenes: {},
  payoutScenes: {},
  salesScenes: {},
  notifyCategories: {},
  chatScenes: {},
  navigationChecks: [],
  uxReview: { byViewport: {}, geminiChecklist: [] },
  uiConcerns: [],
  fixPriorities: [],
  geminiShots: {},
  verdicts: {
    identity: "PASS",
    payoutSettings: "PASS",
    salesScreen: "PASS",
    connectNotify: "PASS",
  },
};

await withPlaywrightBrowser(async (browser) => {const requestCtx = await browser.newContext();
const request = requestCtx.request;

// --- 本人確認・振込設定 ---
for (const scene of [...IDENTITY_SCENES, ...PAYOUT_SCENES]) {
  const bucket = scene.key.startsWith("identity") ? report.identityScenes : report.payoutScenes;
  if (!bucket[scene.key]) {
    bucket[scene.key] = { label: scene.label, verdict: "PASS", viewports: [], issues: [], minors: [] };
  }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      await page.goto(paymentSettingsUrl(base, scene.step), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("[data-connect-onboarding]", { timeout: 20000 });
      await resetConnectStores(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-connect-onboarding]", { timeout: 20000 });
      await setConnectStep(page, scene.step, { openPayout: scene.openPayout, seedBank: scene.seedBank });

      const audit = await auditPaymentSettings(page, scene.key, vp.label);
      const fileViewport = `${vp.label}-${scene.key}-viewport.png`;
      await page.locator("[data-connect-onboarding]").scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
      const fileFull = `${vp.label}-${scene.key}-full.png`;
      await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });

      if (scene.key === "identity-start" && vp.label === "390") {
        report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
        report.geminiShots[vp.label].identity = fileViewport;
      }
      if (scene.key === "payout-account" && vp.label === "390") {
        report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
        report.geminiShots[vp.label].payoutSettings = fileViewport;
      }

      const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
      const row = { viewport: vp.label, file: fileViewport, fileFull, verdict, audit, url: paymentSettingsUrl(base, scene.step) };
      bucket[scene.key].viewports.push(row);
      bucket[scene.key].issues.push(...audit.issues);
      bucket[scene.key].minors.push(...audit.minors);
      if (verdict === "FAIL") bucket[scene.key].verdict = "FAIL";
      else if (verdict === "MINOR" && bucket[scene.key].verdict === "PASS") bucket[scene.key].verdict = "MINOR";

      const stepPrefix = scene.key.startsWith("identity") ? "connect-identity" : "connect-payout";
      report.pages.push({
        viewport: vp.label,
        stepId: `${stepPrefix}-${scene.key.replace(/^(identity|payout)-/, "")}-${vp.label}`,
        stepName: scene.label,
        file: fileViewport,
        verdict,
        issues: audit.issues,
        minors: audit.minors,
        data: audit,
      });
    } catch (err) {
      const msg = String(err?.message || err);
      bucket[scene.key].verdict = "FAIL";
      bucket[scene.key].viewports.push({ viewport: vp.label, verdict: "FAIL", issues: [msg] });
      report.pages.push({
        viewport: vp.label,
        stepId: `connect-${scene.key}-${vp.label}`,
        stepName: scene.label,
        verdict: "FAIL",
        issues: [msg],
        minors: [],
      });
    } finally {
      await context.close();
    }
  }
}

// --- 売上画面 ---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await page.goto(salesFeesUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-sf-stats]", { timeout: 20000 });
    await seedSalesDeals(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-sf-tbody] tr", { timeout: 15000 });

    const audit = await auditSalesPage(page, vp.label);
    const fileViewport = `${vp.label}-sales-viewport.png`;
    await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
    const fileFull = `${vp.label}-sales-full.png`;
    await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });

    if (vp.label === "390") {
      report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
      report.geminiShots[vp.label].sales = fileViewport;
    }
    if (vp.label === "1280") {
      report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
      report.geminiShots[vp.label].sales = fileViewport;
    }

    const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
    report.salesScenes.viewport = report.salesScenes.viewport || { label: "売上・手数料管理", verdict: "PASS", viewports: [] };
    report.salesScenes.viewport.viewports.push({ viewport: vp.label, file: fileViewport, verdict, audit });
    if (verdict === "FAIL") report.salesScenes.viewport.verdict = "FAIL";
    else if (verdict === "MINOR" && report.salesScenes.viewport.verdict === "PASS") {
      report.salesScenes.viewport.verdict = "MINOR";
    }

    report.pages.push({
      viewport: vp.label,
      stepId: `connect-sales-${vp.label}`,
      stepName: "売上・手数料管理",
      file: fileViewport,
      verdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });
  } catch (err) {
    report.salesScenes.viewport = { label: "売上・手数料管理", verdict: "FAIL", viewports: [{ viewport: vp.label, verdict: "FAIL", issues: [String(err?.message || err)] }] };
    report.pages.push({
      viewport: vp.label,
      stepId: `connect-sales-${vp.label}`,
      stepName: "売上・手数料管理",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

// --- Connect通知 ---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await openNotifyCenter(page, base, SELLER_ID);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-notify-id]").length >= 3,
      { timeout: 45000 }
    );
    await seedConnectNotifications(page, base);
    await page.waitForTimeout(1200);
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-notify-id]").length >= 5,
      { timeout: 45000 }
    );

    const audit = await extractNotifyAudit(page, vp.label);
    const storeRows = await extractStoreRows(page);

    const geminiFirst = `${vp.label}-gemini-first-view.png`;
    await page.screenshot({ path: path.join(OUT, geminiFirst), fullPage: false });
    const geminiList = `${vp.label}-gemini-notify-list.png`;
    await page.screenshot({ path: path.join(OUT, geminiList), fullPage: true });

    report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
    report.geminiShots[vp.label].connectNotify = geminiList;
    report.geminiShots[vp.label].firstView = geminiFirst;

    for (const cat of CONNECT_NOTIFY_CATEGORIES) {
      const found = audit.cards.find((c) => cat.notifyIds.includes(c.id));
      const row = storeRows.find((r) => cat.notifyIds.includes(r.id));
      if (!report.notifyCategories[cat.key]) {
        report.notifyCategories[cat.key] = { label: cat.label, verdict: "PASS", items: [], issues: [], minors: [] };
      }
      const itemVerdict = found ? "PASS" : "FAIL";
      if (!found) report.notifyCategories[cat.key].issues.push(`${cat.label}カード未検出`);
      report.notifyCategories[cat.key].items.push({
        id: cat.notifyIds[0],
        title: found?.title || row?.title || "",
        ctaText: found?.ctaText || row?.actionLabel || "",
        href: found?.href || row?.href || "",
        verdict: itemVerdict,
      });
      if (itemVerdict === "FAIL") report.notifyCategories[cat.key].verdict = "FAIL";
    }

    const notifyVerdict =
      audit.issues.length ? "FAIL" : audit.minors.length || audit.connectCardCount < 4 ? "MINOR" : "PASS";
    report.uxReview.byViewport[vp.label] = {
      notifyAudit: audit,
      geminiChecklist: buildGeminiChecklist(audit, report.navigationChecks, report.pages, vp.label),
    };

    report.pages.push({
      viewport: vp.label,
      stepId: `connect-notify-list-${vp.label}`,
      stepName: "Connect通知一覧",
      file: geminiList,
      verdict: notifyVerdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });

    if (vp.label === "390") {
      const seen = new Set();
      for (const probe of [
        { id: "platform-chat-demo-connect-identity-001", label: "本人確認" },
        { id: "platform-chat-demo-connect-payout-001", label: "振込設定" },
        { id: "platform-verify-chat-demo-connect-complete-001", label: "Connect完了" },
      ]) {
        if (seen.has(probe.label)) continue;
        const card = audit.cards.find((c) => c.id === probe.id) || storeRows.find((r) => r.id === probe.id);
        const href = card?.href || "";
        const probeRes = await probeHref(request, base, href);
        const verdict = probeRes.ok ? "PASS" : "FAIL";
        report.navigationChecks.push({
          id: probe.id,
          label: probe.label,
          href: probeRes.url || href,
          status: probeRes.status,
          verdict,
          error: probeRes.error || "",
        });
        seen.add(probe.label);
      }
    }
  } catch (err) {
    report.pages.push({
      viewport: vp.label,
      stepId: `connect-notify-list-${vp.label}`,
      stepName: "Connect通知一覧",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

// --- Connect完了導線（チャット）---
for (const scene of CHAT_SCENES) {
  if (!report.chatScenes[scene.key]) {
    report.chatScenes[scene.key] = { label: scene.label, verdict: "PASS", viewports: [], issues: [], minors: [] };
  }
  const mode = scene.key === "completion-pending" ? "pending" : "payment";

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      await page.goto(chatUrl(base, scene.userId), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(
        () => window.TasuChatThreadStore?.writeAll && window.TasuPlatformChatConnectChatFlow,
        { timeout: 30000 }
      );
      await seedCompletionChat(page, mode);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#chatMessages, .chat-card, .chat-connect-card", { timeout: 25000 }).catch(() => {});
      if (scene.key === "completion-payment") {
        await page
          .waitForFunction(
            () => {
              const hidden = (id) => {
                const el = document.getElementById(id);
                return !el || el.hidden || getComputedStyle(el).display === "none";
              };
              return (
                hidden("chatApproveCompleteBtn") &&
                hidden("chatCompleteBtn") &&
                hidden("chatCancelRequestBtn") &&
                hidden("chatCancelRespondApproveBtn") &&
                hidden("chatCancelRespondRejectBtn")
              );
            },
            { timeout: 15000 }
          )
          .catch(() => {});
      }
      await page.waitForTimeout(800);

      const audit = await auditChatPage(page, scene.key, vp.label);
      const fileViewport = `${vp.label}-${scene.key}-viewport.png`;
      await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
      const fileFull = `${vp.label}-${scene.key}-full.png`;
      await page.screenshot({ path: path.join(OUT, fileFull), fullPage: vp.width >= 960 });

      const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
      report.chatScenes[scene.key].viewports.push({ viewport: vp.label, file: fileViewport, verdict, audit });
      report.chatScenes[scene.key].issues.push(...audit.issues);
      report.chatScenes[scene.key].minors.push(...audit.minors);
      if (verdict === "FAIL") report.chatScenes[scene.key].verdict = "FAIL";
      else if (verdict === "MINOR" && report.chatScenes[scene.key].verdict === "PASS") {
        report.chatScenes[scene.key].verdict = "MINOR";
      }

      report.pages.push({
        viewport: vp.label,
        stepId: `connect-chat-${scene.key}-${vp.label}`,
        stepName: scene.label,
        file: fileViewport,
        verdict,
        issues: audit.issues,
        minors: audit.minors,
        data: audit,
      });
    } catch (err) {
      report.chatScenes[scene.key].verdict = "FAIL";
      report.pages.push({
        viewport: vp.label,
        stepId: `connect-chat-${scene.key}-${vp.label}`,
        stepName: scene.label,
        verdict: "FAIL",
        issues: [String(err?.message || err)],
        minors: [],
      });
    } finally {
      await context.close();
    }
  }
}

await requestCtx.close();
});

for (const cat of Object.values(report.notifyCategories)) {
  if (cat.verdict !== "FAIL") cat.verdict = cat.issues.length ? "FAIL" : cat.minors?.length ? "MINOR" : "PASS";
}

for (const vp of VIEWPORTS) {
  const notifyPage = report.pages.find((p) => p.stepId === `connect-notify-list-${vp.label}`);
  report.uxReview.byViewport[vp.label] = {
    ...report.uxReview.byViewport[vp.label],
    geminiChecklist: buildGeminiChecklist(
      notifyPage?.data || {},
      report.navigationChecks,
      report.pages,
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

report.verdicts.identity = Object.values(report.identityScenes).every((s) => s.verdict !== "FAIL")
  ? Object.values(report.identityScenes).some((s) => s.verdict === "MINOR")
    ? "MINOR"
    : "PASS"
  : "FAIL";

report.verdicts.payoutSettings = Object.values(report.payoutScenes).every((s) => s.verdict !== "FAIL")
  ? Object.values(report.payoutScenes).some((s) => s.verdict === "MINOR")
    ? "MINOR"
    : "PASS"
  : "FAIL";

report.verdicts.salesScreen = report.salesScenes.viewport?.verdict || "PASS";
report.verdicts.connectNotify = Object.values(report.notifyCategories).every((c) => c.verdict !== "FAIL")
  ? Object.values(report.notifyCategories).some((c) => c.verdict === "MINOR") ||
    report.pages.some((p) => p.stepId?.startsWith("connect-notify") && p.verdict === "MINOR")
    ? "MINOR"
    : "PASS"
  : "FAIL";

report.overall = resolveOverall(stats.failCount + navFail, stats.minorCount);

if (navFail) report.uiConcerns.push(`Connect通知→遷移で HTTP エラー ${navFail}件`);
if (report.pages.some((p) => p.stepId?.includes("sales") && (p.minors || []).some((m) => /保留中|振込済/.test(m)))) {
  report.uiConcerns.push("売上画面に「保留中」「振込済」の区別ラベルが不足（現状は「完了」のみ）");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /横スクロール|固定|被り|重なり/.test(m)))) {
  report.uiConcerns.push("390pxで横スクロール・ボタン/固定CTA被りの懸念");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /間延び|デッド/.test(m)))) {
  report.uiConcerns.push("1280pxで間延び・デッドスペースの懸念");
}
if (report.identityScenes["identity-reviewing"]?.minors?.some((m) => /審査/.test(m))) {
  report.uiConcerns.push("本人確認「審査中」状態の視認性を要確認");
}
if (!report.uiConcerns.length) {
  report.uiConcerns.push("致命的な問題は検出されませんでした — 本番投入可レベル");
}

if (stats.failCount + navFail === 0) {
  report.fixPriorities.push("Connect UXは本番可（FAIL 0）");
}
if (navFail) report.fixPriorities.push("P1: Connect通知→遷移先の HTTP エラー解消");
if (report.verdicts.salesScreen === "MINOR") {
  report.fixPriorities.push("P2: 売上画面に保留中/振込済ステータスを追加し区別を明確化");
}
if (report.uiConcerns.some((c) => /390px/.test(c))) {
  report.fixPriorities.push("P3: 390px ボタン・固定CTAの余白調整（任意）");
}
if (report.uiConcerns.some((c) => /1280px|デッド/.test(c))) {
  report.fixPriorities.push("P3: 1280px ダッシュボード幅のバランス（任意）");
}
if (!report.fixPriorities.length) report.fixPriorities.push("必須修正なし");

report.finalNotes = {
  identityUx: report.verdicts.identity === "FAIL" ? "要修正" : report.verdicts.identity === "MINOR" ? "軽微" : "本番可",
  payoutSettings: report.verdicts.payoutSettings === "FAIL" ? "要修正" : "本番可",
  salesScreen: report.verdicts.salesScreen,
  connectNotify: report.verdicts.connectNotify === "FAIL" ? "要修正" : "本番可",
  completionFlow: Object.values(report.chatScenes).every((s) => s.verdict !== "FAIL") ? "本番可" : "要確認",
  failCount: stats.failCount + navFail,
};

report.summary = {
  overall: report.overall,
  failCount: stats.failCount + navFail,
  minorCount: stats.minorCount,
  passCount: stats.passCount,
  navigationPass: report.navigationChecks.filter((n) => n.verdict === "PASS").length,
  navigationFail: navFail,
  verdicts: report.verdicts,
  identityScenes: Object.fromEntries(
    Object.entries(report.identityScenes).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
  ),
  payoutScenes: Object.fromEntries(
    Object.entries(report.payoutScenes).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
  ),
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
  const verdictRows = Object.entries(report.verdicts)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`)
    .join("");
  const gemini = report.uxReview.geminiChecklist
    .map((c) => `<li>${c.ok ? "✓" : "△"} ${esc(c.item)} — ${esc(c.note || "")}</li>`)
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Connect最終UX</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc}table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0}td,th{border:1px solid #e2e8f0;padding:8px;font-size:.8125rem}ul{line-height:1.6}${SCREENSHOT_BACK_NAV_CSS}</style></head>
<body>${renderScreenshotBackNav()}<h1>Connect 最終UX監査</h1>
<p>総合: <strong>${esc(report.overall)}</strong> · FAIL ${report.summary.failCount} · MINOR ${report.summary.minorCount} · ${esc(report.generatedAt)}</p>
<h2>領域別判定</h2><table><tr><th>領域</th><th>判定</th></tr>${verdictRows}</table>
<h2>Geminiチェックリスト</h2><ul>${gemini}</ul>
<h2>気になるUI</h2><ul>${report.uiConcerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>修正優先順位</h2><ol>${report.fixPriorities.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
</body></html>`;
}

fs.writeFileSync(path.join(OUT, "index.html"), renderLocalIndex());

const reviewUrl = await finalizeVerification(root, { primaryFolder: "connect-final-review", openBrowser: false });
console.log(`Connect final review: ${report.overall} (FAIL ${report.summary.failCount}, MINOR ${report.summary.minorCount})`);
console.log(`Report: ${path.join(OUT, "report.json")}`);
console.log(`Review: ${reviewUrl}`);

await closeAllBrowsers();
