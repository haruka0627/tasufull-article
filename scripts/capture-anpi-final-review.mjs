#!/usr/bin/env node
/**
 * 安否フロー — 最終UX監査（調査・キャプチャ・レポートのみ）
 *   node scripts/capture-anpi-final-review.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { renderScreenshotBackNav, SCREENSHOT_BACK_NAV_CSS } from "./lib/screenshot-image-viewer.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = path.join(root, "screenshots", "anpi-final-review");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const DEMO_NOTIFY_KEY = "tasful_anpi_notify_demo_v1";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const ADMIN_KEY = "tasu_anpi_line_admin_v1";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_talk_notifications",
  "tasful_talk_notifications_seeded_v2",
  "tasful_anpi_notify_master_v1",
];

const SEED_CONTEXT = {
  user_id: "anpi_user_final_review",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: "holder_final_review",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  line_notification_enabled: true,
  line_user_id: "line_user_final_review",
  line_linked_at: new Date().toISOString(),
  consent: {
    no_auto_execution: true,
    self_confirm_required: true,
    tasful_no_guarantee: true,
    emergency_contact_required: true,
    agreed_at: new Date().toISOString(),
  },
  created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  updated_at: new Date(Date.now() - 3600000).toISOString(),
};

const SEED_LOGS = [
  {
    id: "anpi_review_urgent_1",
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_final_review",
    user_name: "山田太郎",
    contract_holder_id: "holder_final_review",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】緊急キーワード",
    message: "息苦しいと感じています",
    status: "local_only",
    is_read: false,
    priority: "urgent",
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "anpi_review_call",
    event_type: "call_consent_accepted",
    user_id: "anpi_user_final_review",
    user_name: "山田太郎",
    contract_holder_id: "holder_final_review",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】電話（同意）",
    message: "電話での安否確認に同意しました",
    status: "local_only",
    is_read: false,
    priority: "high",
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "anpi_review_ai",
    event_type: "ai_search",
    user_id: "anpi_user_final_review",
    user_name: "山田太郎",
    contract_holder_id: "holder_final_review",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】AI検索",
    message: "買い物代行をお願いしたい",
    status: "local_only",
    is_read: true,
    priority: "normal",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "anpi_review_sent",
    event_type: "urgent_keyword_detected",
    contract_holder_id: "holder_final_review",
    title: "LINE送信済みサンプル",
    message: "運営ログ確認用",
    is_read: true,
    line_notification_enabled: true,
    line_user_id: "line_user_final_review",
    line_status: "sent",
    line_sent_at: new Date(Date.now() - 120000).toISOString(),
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "anpi_review_failed",
    event_type: "urgent_keyword_detected",
    contract_holder_id: "holder_final_review",
    title: "LINE送信失敗サンプル",
    message: "運営ログ確認用",
    is_read: true,
    line_notification_enabled: true,
    line_user_id: "line_user_final_review",
    line_status: "failed",
    line_error_message: "Push API timeout (demo)",
    line_error_code: "TIMEOUT",
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
];

/** @type {Array<{ key: string; label: string; notifyIds: string[] }>} */
const ANPI_NOTIFY_CATEGORIES = [
  { key: "check", label: "安否確認通知", notifyIds: ["anpi-check-request-001"] },
  { key: "family", label: "家族応答通知", notifyIds: ["anpi-family-response-001"] },
  { key: "no_response", label: "未応答通知", notifyIds: ["anpi-no-response-001"] },
  {
    key: "related",
    label: "災害・訓練・設定",
    notifyIds: ["anpi-disaster-info-001", "anpi-drill-001", "anpi-setting-updated-001"],
  },
];

const DASH_SCENES = [
  { key: "dashboard", label: "安否ダッシュボード", hash: "", geminiKey: "dashboard" },
  { key: "check-response", label: "安否回答（未回答）", hash: "check", geminiKey: "response" },
  { key: "check-answered", label: "安否回答（回答済）", hash: "check", answered: true },
  { key: "family", label: "家族/確認者側", hash: "family" },
  { key: "no-response", label: "未回答一覧", hash: "no-response", geminiKey: "noResponse" },
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

function anpiDashboardUrl(base, hash = "") {
  const q = hash ? `#${hash}` : "";
  return buildLocalPageUrl(base, `anpi-dashboard.html${q}`);
}

function anpiNotificationsUrl(base) {
  return buildLocalPageUrl(base, "anpi-notifications.html");
}

function anpiAdminUrl(base) {
  return buildLocalPageUrl(base, "anpi-line-admin.html?anpi_admin=1");
}

function talkNotifyUrl(base) {
  return buildLocalPageUrl(base, "talk-home.html?tab=notify&talkDev=1&benchEmbed=1&userId=u_me");
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
    globalThis.__tasuTalkNotificationsBootstrapped = false;
  }, { markers: MASTER_MARKERS });
}

async function seedAnpiContext(page) {
  await page.evaluate(
    ({ ctxKey, ctx, logsKey, logs, adminKey }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logsKey, JSON.stringify(logs));
      localStorage.setItem(adminKey, "1");
    },
    {
      ctxKey: STORAGE_CONTEXT,
      ctx: SEED_CONTEXT,
      logsKey: STORAGE_LOGS,
      logs: SEED_LOGS,
      adminKey: ADMIN_KEY,
    }
  );
}

async function resetAnpiResponseDemo(page) {
  await page.evaluate((demoKey) => {
    localStorage.removeItem(demoKey);
  }, DEMO_NOTIFY_KEY);
}

/** platform master v3 では anpi 専用マスターが自動適用されないため明示シード */
async function seedAnpiNotifyMaster(page) {
  const seeded = await page.evaluate(() => {
    const store = window.TasuTalkNotifications;
    const seeds = window.TasuTalkAnpiNotifyMaster?.buildMaster?.(Date.now()) || [];
    if (!store?.applyAnpiMasterV1 || !seeds.length) {
      return { ok: false, reason: "missing_api", count: 0 };
    }
    try {
      localStorage.removeItem("tasful_anpi_notify_master_v1");
    } catch {
      /* ignore */
    }
    store.applyAnpiMasterV1(seeds);
    window.TasuTalkData?.invalidateNotificationsBootstrap?.();
    window.dispatchEvent(
      new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
    );
    return { ok: true, count: seeds.length };
  });
  if (!seeded.ok) throw new Error(`anpi notify seed failed: ${seeded.reason || "unknown"}`);
  await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 30000 });
  await page.waitForTimeout(700);
  return seeded;
}

const ANPI_HREF_FALLBACK = Object.freeze({
  "anpi-check-request-001": "anpi-dashboard.html#check",
  "anpi-family-response-001": "anpi-dashboard.html#family",
  "anpi-no-response-001": "anpi-dashboard.html#no-response",
  "anpi-disaster-info-001": "anpi-dashboard.html#disaster",
  "anpi-drill-001": "anpi-dashboard.html#drill",
  "anpi-setting-updated-001": "anpi-register.html",
});

const USER_DEBUG_TERMS = [
  { key: "edge_function", pattern: "Edge Function", flags: "i" },
  { key: "failed_to_fetch", pattern: "Failed to fetch", flags: "i" },
  { key: "local_storage", pattern: "localStorage", flags: "i" },
  { key: "token_exchange", pattern: "Token Exchange", flags: "i" },
  { key: "push_api", pattern: "Push API", flags: "i" },
  { key: "reachability", pattern: "到達性", flags: "" },
];

const GEMINI_BEFORE_FILES = [
  "390-gemini-anpi-notify-card.png",
  "390-gemini-notify-list.png",
  "390-check-response-viewport.png",
  "390-dashboard-viewport.png",
  "390-no-response-viewport.png",
  "1280-check-response-viewport.png",
  "1280-dashboard-viewport.png",
  "1280-no-response-viewport.png",
];

async function auditUserFacingDebug(page) {
  return page.evaluate((terms) => {
    const roots = [
      document.querySelector("[data-anpi-dashboard-shell]"),
      document.querySelector('[data-talk-panel="notify"]'),
      document.querySelector("[data-anpi-notifications-root]"),
      document.querySelector("main"),
    ].filter(Boolean);
    const text = (roots.length ? roots : [document.body])
      .map((el) => {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return "";
        return el.innerText || "";
      })
      .join("\n");
    const hits = terms
      .filter((t) => new RegExp(t.pattern, t.flags || "").test(text))
      .map((t) => t.key);
    const adminHost = document.querySelector("[data-anpi-line-admin]");
    const adminVisible =
      adminHost &&
      !adminHost.hidden &&
      adminHost.innerHTML.trim().length > 20 &&
      getComputedStyle(adminHost).display !== "none" &&
      getComputedStyle(adminHost).visibility !== "hidden";
    return { hits, adminVisible, count: hits.length };
  }, USER_DEBUG_TERMS);
}

async function openNotifyCenter(page, base) {
  await page.goto(talkNotifyUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
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

async function waitDashboardShell(page) {
  await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 25000 });
  await page.waitForFunction(
    () => {
      const checkHost = document.querySelector("#check [data-anpi-notify-card]");
      const summary = document.querySelector("[data-anpi-summary-unread]");
      return (
        (checkHost && checkHost.innerHTML.trim().length > 20) ||
        (summary && summary.textContent.trim().length > 0)
      );
    },
    { timeout: 25000 }
  ).catch(() => {});
  await page.waitForTimeout(1200);
}

async function gotoDashboardScene(page, base, hash, opts = {}) {
  const url = anpiDashboardUrl(base, hash);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await seedAnpiContext(page);
  if (!opts.keepAnswered) await resetAnpiResponseDemo(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitDashboardShell(page);
  if (hash) {
    await page.evaluate((h) => {
      if (location.hash.replace("#", "") !== h) location.hash = h;
      window.dispatchEvent(new Event("hashchange"));
    }, hash);
    await page.waitForTimeout(900);
  }
  if (opts.answered) {
    const btn = page.locator('[data-anpi-notify-action="check-safe"]');
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForSelector("[data-anpi-notify-answered]", { timeout: 10000 });
      await page.waitForTimeout(500);
    }
  }
}

async function extractTalkAnpiAudit(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 8) issues.push(`横スクロール (${scrollW}px)`);

    const cards = [...document.querySelectorAll("[data-talk-notify-id]")].filter((el) => {
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const id = el.getAttribute("data-talk-notify-id") || "";
      return chip === "安否" || /^anpi-/.test(id);
    });

    const cardRows = cards.map((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      const rect = el.getBoundingClientRect();
      const title = el.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const cta =
        el.querySelector("[data-anpi-notify-inline-safe], [data-talk-notify-action], .talk-notify-card__minimal-action") ||
        el.querySelector(".talk-notify-card__card-cta");
      const ctaRect = cta?.getBoundingClientRect();
      const ctaText = cta?.textContent?.trim() || "";
      const row =
        window.TasuTalkNotifications?.findById?.(id) ||
        (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find((n) => n.id === id);
      const href = String(row?.href || row?.targetUrl || cta?.getAttribute("href") || "").trim();
      const isImportant = Boolean(el.closest(".talk-notify-section--important"));
      const hasSafeCta = /無事/.test(ctaText);
      const hasDetailCta = Boolean(
        el.querySelector("[data-talk-notify-action]:not([data-anpi-notify-inline-safe])") ||
          (/確認|詳細/.test(ctaText) && !hasSafeCta)
      );
      let minFont = 99;
      el.querySelectorAll(".talk-notify-card__title, .talk-notify-card__text, .talk-notify-card__category-chip").forEach((node) => {
        const fs = parseFloat(getComputedStyle(node).fontSize) || 0;
        if (fs > 0 && fs < minFont) minFont = fs;
      });
      if (vpLabel === "390") {
        if (ctaRect && rect.width && ctaRect.width / rect.width > 0.95 && !el.classList.contains("talk-notify-card--cta-only")) {
          minors.push(`${id}: CTA幅 ${Math.round((ctaRect.width / rect.width) * 100)}%`);
        }
        if (ctaRect && (ctaRect.height < 36 || ctaRect.height > 56)) {
          minors.push(`${id}: CTA高さ ${Math.round(ctaRect.height)}px`);
        }
        if (minFont && minFont < 11) minors.push(`${id}: フォント ${minFont}px`);
        const titleEl = el.querySelector(".talk-notify-card__title");
        if (titleEl && titleEl.scrollWidth > titleEl.clientWidth + 2) {
          minors.push(`${id}: タイトル文字切れ`);
        }
      }
      return { id, title, chip, href, ctaText, isImportant, hasSafeCta, hasDetailCta, height: Math.round(rect.height) };
    });

    const checkCard = cardRows.find((c) => c.id === "anpi-check-request-001");

    return {
      anpiCardCount: cards.length,
      cards: cardRows,
      checkNotify: checkCard || null,
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
}

async function auditDashboardScene(page, sceneKey, vpLabel) {
  return page.evaluate(
    ({ sceneKey, vpLabel }) => {
      const issues = [];
      const minors = [];
      const doc = document.documentElement;
      const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
      if (scrollW > doc.clientWidth + 8) issues.push(`横スクロール (${scrollW}px)`);

      const visible = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden) return false;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const text = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() || "";

      const check = {
        hasActions: visible("[data-anpi-notify-check-actions]"),
        hasAnswered: visible("[data-anpi-notify-answered]"),
        safeBtn: text('[data-anpi-notify-action="check-safe"]'),
        helpBtn: text('[data-anpi-notify-action="check-help"]'),
        answeredLabel: text("[data-anpi-notify-answered] .anpi-notify-status__title"),
      };

      const family = {
        hasSummary: visible("[data-anpi-family-check-summary]"),
        unanswered: text("[data-anpi-family-check-summary] .info-value"),
        safeCount: [...document.querySelectorAll("[data-anpi-family-check-summary] dd")].map((el) => el.textContent?.trim()),
        itemCount: document.querySelectorAll("[data-anpi-notify-family-item]").length,
        lastUpdated: text("[data-anpi-family-check-summary]"),
      };

      const noResponse = {
        itemCount: document.querySelectorAll("[data-anpi-notify-nr-item], [data-anpi-notify-no-response-item]").length,
        hasRemind: visible('[data-anpi-notify-action="nr-remind"]'),
        hasCall: visible('[data-anpi-notify-action="nr-call"]'),
        names: [...document.querySelectorAll("[data-anpi-notify-nr-item] .anpi-notify-nr-item__name, .anpi-notify-list-item__title")].map(
          (el) => el.textContent?.trim()
        ),
      };

      const dashboard = {
        hasSummary: Boolean(
          document.querySelector("[data-anpi-summary-grid]") &&
            document.querySelector("[data-anpi-summary-unread]")
        ),
        hasRecent:
          Boolean(document.querySelector("[data-anpi-recent-list]")) ||
          document.querySelectorAll(".anpi-recent-list__item").length > 0,
        hasActionRequired: Boolean(document.querySelector("[data-anpi-action-required-list]")),
        unreadStat: text("[data-anpi-summary-unread]"),
      };

      if (sceneKey === "check-response") {
        if (!check.hasActions) issues.push("回答ボタン群なし");
        if (!check.safeBtn) issues.push("「無事です」CTAなし");
        if (!check.helpBtn) minors.push("「支援が必要です」ボタンの視認性要確認");
      }
      if (sceneKey === "check-answered") {
        if (!check.hasAnswered) issues.push("回答済み状態が表示されない");
        if (!/回答済み/.test(check.answeredLabel)) minors.push("回答済みラベルが弱い");
      }
      if (sceneKey === "family") {
        if (!family.hasSummary) issues.push("家族安否サマリーなし");
        if (!/未回答|無事|最終更新/.test(family.lastUpdated)) minors.push("未回答/無事/最終更新の表示が弱い");
        if (family.itemCount === 0) minors.push("家族回答リストが空");
      }
      if (sceneKey === "no-response") {
        if (noResponse.itemCount === 0) issues.push("未回答者リストなし");
        if (!noResponse.hasRemind && !noResponse.hasCall) minors.push("リマインド/電話CTAなし");
        if (!document.querySelector(".anpi-notify-nr-elapsed-badge")) {
          minors.push("未回答経過バッジなし");
        }
      }
      if (sceneKey === "dashboard") {
        if (!dashboard.hasSummary) issues.push("ダッシュボードサマリーなし");
      }

      const fixedCta = document.querySelector("[data-tasu-app-tabbar-injected]");
      let ctaOverlap = null;
      if (vpLabel === "390" && sceneKey.startsWith("check")) {
        const actions = document.querySelector("[data-anpi-notify-check-actions]");
        const tabbar = fixedCta;
        if (actions && tabbar) {
          const aRect = actions.getBoundingClientRect();
          const tRect = tabbar.getBoundingClientRect();
          if (aRect.bottom > tRect.top - 4) {
            ctaOverlap = Math.round(aRect.bottom - tRect.top);
            if (ctaOverlap > 12) minors.push(`固定CTA/タブバー被り ${ctaOverlap}px`);
          }
        }
      }

      const mainCol = document.querySelector(".anpi-dashboard-main, .anpi-dash-layout");
      const mainRect = mainCol?.getBoundingClientRect();
      if (vpLabel === "1280" && mainRect) {
        const deadRight = doc.clientWidth - mainRect.right;
        if (deadRight > doc.clientWidth * 0.35) minors.push(`右デッドスペース ${Math.round(deadRight)}px`);
        if (mainRect.width < doc.clientWidth * 0.42) minors.push(`1280px 間延び（幅 ${Math.round(mainRect.width)}px）`);
      }

      return {
        check,
        family,
        noResponse,
        dashboard,
        ctaOverlap,
        issues: [...new Set(issues)],
        minors: [...new Set(minors)],
      };
    },
    { sceneKey, vpLabel }
  );
}

async function auditHistoryPage(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 8) issues.push(`横スクロール (${scrollW}px)`);

    const unread = document.querySelector("[data-anpi-summary-unread]")?.textContent?.trim() || "";
    const total = document.querySelector("[data-anpi-summary-total]")?.textContent?.trim() || "";
    const urgent = document.querySelector("[data-anpi-summary-urgent]")?.textContent?.trim() || "";
    const cardCount = document.querySelectorAll("[data-anpi-card]").length;
    const emptyHidden = document.querySelector("[data-anpi-empty]")?.hidden !== false;

    if (emptyHidden && cardCount === 0) issues.push("通知履歴が空");
    if (cardCount > 0 && !/件/.test(unread + total)) minors.push("サマリー件数表示が弱い");

    const urgentZone = document.querySelector("[data-anpi-urgent-zone]");
    if (urgentZone && !urgentZone.hidden && urgentZone.querySelectorAll("[data-anpi-card]").length === 0) {
      minors.push("緊急ゾーン表示だがカードなし");
    }

    const wrap = document.querySelector(".anpi-notifications-main");
    const wrapRect = wrap?.getBoundingClientRect();
    if (vpLabel === "1280" && wrapRect) {
      const deadRight = doc.clientWidth - wrapRect.right;
      if (deadRight > doc.clientWidth * 0.4) minors.push(`右デッドスペース ${Math.round(deadRight)}px`);
    }

    return {
      unread,
      total,
      urgent,
      cardCount,
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
}

async function auditOpsAdmin(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 8) issues.push(`横スクロール (${scrollW}px)`);

    const denied = Boolean(document.querySelector("[data-anpi-line-admin-denied]"));
    const pageInner = Boolean(document.querySelector("[data-anpi-line-admin-page]"));
    const sentCount = document.body.textContent?.match(/送信済み件数[\s\S]*?(\d+)/)?.[1] || "";
    const failedCount = document.body.textContent?.match(/送信失敗件数[\s\S]*?(\d+)/)?.[1] || "";
    const hasRecentSent = /最近の送信ログ/.test(document.body.textContent || "");
    const hasRecentFailed = /最近の失敗ログ/.test(document.body.textContent || "");
    const logItems = document.querySelectorAll(".anpi-line-admin__log-item, .anpi-line-admin-page__logs li").length;

    if (denied) issues.push("管理者画面アクセス拒否");
    if (!pageInner && !denied) issues.push("運営画面が描画されない");
    if (!hasRecentSent) minors.push("送信ログセクションなし");
    if (!hasRecentFailed) minors.push("失敗ログセクションなし");
    if (logItems === 0) minors.push("通知履歴ログ行が0件");

    const inner = document.querySelector("[data-anpi-line-admin-page]");
    const innerRect = inner?.getBoundingClientRect();
    if (vpLabel === "1280" && innerRect && innerRect.width < doc.clientWidth * 0.45) {
      minors.push(`1280px 情報密度が低い（幅 ${Math.round(innerRect.width)}px）`);
    }

    return {
      denied,
      pageInner,
      sentCount,
      failedCount,
      logItems,
      hasRecentSent,
      hasRecentFailed,
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
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
  const checkNotify = notifyAudit?.checkNotify;
  const responsePage = pages.find((p) => p.stepId === `anpi-check-response-${vpLabel}`);
  const familyPage = pages.find((p) => p.stepId === `anpi-family-${vpLabel}`);
  const historyPage = pages.find((p) => p.stepId === `anpi-history-${vpLabel}`);

  return [
    {
      item: "安否通知の緊急性・無事CTA",
      ok: Boolean(checkNotify?.isImportant && checkNotify?.hasSafeCta),
      note: checkNotify ? `${checkNotify.title?.slice(0, 24)} / ${checkNotify.ctaText}` : "—",
    },
    {
      item: "安否回答（迷わず回答・回答後状態）",
      ok: Boolean(responsePage?.data?.check?.hasActions || pages.find((p) => p.stepId === `anpi-check-answered-${vpLabel}`)?.data?.check?.hasAnswered),
      note: responsePage?.data?.check?.safeBtn || "—",
    },
    {
      item: "家族/確認者（未回答・無事・最終更新）",
      ok: Boolean(familyPage?.data?.family?.hasSummary),
      note: familyPage?.data?.family?.safeCount?.join(" ") || "—",
    },
    {
      item: "履歴の見やすさ",
      ok: (historyPage?.data?.cardCount || 0) > 0,
      note: historyPage ? `${historyPage.data.cardCount}件 / 緊急${historyPage.data.urgent}` : "—",
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
        (!(notifyAudit?.issues || []).some((i) => /横スクロール/.test(i)) &&
          !(pages || []).some((p) => p.viewport === "390" && (p.data?.ctaOverlap || 0) > 20)),
      note: notifyAudit?.anpiCardCount ? `安否通知${notifyAudit.anpiCardCount}件` : "—",
    },
    {
      item: "1280px 間延び・デッドスペース",
      ok:
        vpLabel !== "1280" ||
        !(pages || []).some((p) => p.viewport === "1280" && (p.minors || []).some((m) => /間延び|デッド|密度/.test(m))),
      note: "ダッシュボード幅を確認",
    },
  ];
}

const base = await findDevServerBaseUrl({ probePath: "anpi-dashboard.html" });
const beforeDir = path.join(OUT, "gemini-before");
fs.mkdirSync(beforeDir, { recursive: true });
for (const file of GEMINI_BEFORE_FILES) {
  const src = path.join(OUT, file);
  const dest = path.join(beforeDir, `before-${file}`);
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    try {
      fs.copyFileSync(src, dest);
    } catch {
      /* ignore */
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  base,
  overall: "PASS",
  pages: [],
  notifyCategories: {},
  dashScenes: {},
  historyScenes: {},
  opsScenes: {},
  navigationChecks: [],
  uxReview: { byViewport: {}, geminiChecklist: [] },
  uiConcerns: [],
  fixPriorities: [],
  geminiShots: {},
  geminiBeforeAfter: {},
  userDebugAudit: { totalHits: 0, pages: [] },
  verdicts: {
    anpiNotify: "PASS",
    responseScreen: "PASS",
    familyVerifier: "PASS",
    opsSide: "PASS",
    history: "PASS",
  },
};

report.geminiBeforeAfter = Object.fromEntries(
  GEMINI_BEFORE_FILES.map((file) => [
    file.replace(/\.(png|jpg)$/i, ""),
    {
      before: fs.existsSync(path.join(beforeDir, `before-${file}`))
        ? `gemini-before/before-${file}`
        : null,
      after: file,
    },
  ])
);

const browser = await chromium.launch({ headless: true });
const requestCtx = await browser.newContext();
const request = requestCtx.request;

// --- 安否通知（TALK）---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await openNotifyCenter(page, base);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
    await page.waitForFunction(
      () => {
        const panel = document.querySelector('[data-talk-panel="notify"]');
        return panel && !panel.hidden;
      },
      { timeout: 45000 }
    );
    await seedAnpiNotifyMaster(page);

    const audit = await extractTalkAnpiAudit(page, vp.label);
    const storeRows = await page.evaluate(() =>
      (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || []).map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category || "",
        actionLabel: n.actionLabel || "",
        href: String(n.href || n.targetUrl || ""),
      }))
    );

    const geminiFirst = `${vp.label}-gemini-first-view.png`;
    await page.screenshot({ path: path.join(OUT, geminiFirst), fullPage: false });
    const geminiList = `${vp.label}-gemini-notify-list.png`;
    await page.screenshot({ path: path.join(OUT, geminiList), fullPage: true });

    if (vp.label === "390") {
      report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
      report.geminiShots[vp.label].anpiNotify = geminiList;
      report.geminiShots[vp.label].firstView = geminiFirst;
      const checkCard = page.locator('article[data-talk-notify-id="anpi-check-request-001"]');
      if ((await checkCard.count()) > 0) {
        await checkCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const geminiCheck = `${vp.label}-gemini-anpi-notify-card.png`;
        await checkCard.screenshot({ path: path.join(OUT, geminiCheck) });
        report.geminiShots[vp.label].anpiNotifyCard = geminiCheck;
      }
    }

    for (const cat of ANPI_NOTIFY_CATEGORIES) {
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
      audit.issues.length || audit.anpiCardCount < 4
        ? audit.anpiCardCount === 0
          ? "FAIL"
          : "MINOR"
        : audit.minors.length
          ? "MINOR"
          : "PASS";

    const debugAudit = await auditUserFacingDebug(page);
    if (debugAudit.count > 0 || debugAudit.adminVisible) {
      audit.issues.push(
        debugAudit.adminVisible
          ? "利用者画面に運営デバッグパネルが表示"
          : `利用者画面にデバッグ文言: ${debugAudit.hits.join(", ")}`
      );
    }
    report.userDebugAudit.pages.push({
      stepId: `anpi-notify-list-${vp.label}`,
      hits: debugAudit.hits,
      adminVisible: debugAudit.adminVisible,
      count: debugAudit.count,
    });

    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-notify-list-${vp.label}`,
      stepName: "安否通知一覧",
      file: geminiList,
      verdict: audit.issues.length ? "FAIL" : notifyVerdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });

    if (vp.label === "390") {
      for (const probe of [
        { id: "anpi-check-request-001", label: "安否確認" },
        { id: "anpi-family-response-001", label: "家族応答" },
        { id: "anpi-no-response-001", label: "未応答" },
      ]) {
        const card = audit.cards.find((c) => c.id === probe.id) || storeRows.find((r) => r.id === probe.id);
        const href = card?.href || ANPI_HREF_FALLBACK[probe.id] || "";
        const probeRes = await probeHref(request, base, href);
        report.navigationChecks.push({
          id: probe.id,
          label: probe.label,
          href: probeRes.url || href,
          status: probeRes.status,
          verdict: probeRes.ok ? "PASS" : "FAIL",
          error: probeRes.error || "",
        });
      }
    }
  } catch (err) {
    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-notify-list-${vp.label}`,
      stepName: "安否通知一覧",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

// --- ダッシュボード各シーン ---
for (const scene of DASH_SCENES) {
  if (!report.dashScenes[scene.key]) {
    report.dashScenes[scene.key] = { label: scene.label, verdict: "PASS", viewports: [], issues: [], minors: [] };
  }

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    try {
      await gotoDashboardScene(page, base, scene.hash, { answered: scene.answered, keepAnswered: false });

      const audit = await auditDashboardScene(page, scene.key, vp.label);
      const fileViewport = `${vp.label}-${scene.key}-viewport.png`;
      if (scene.hash) {
        const anchor = page.locator(`#${scene.hash}`);
        if ((await anchor.count()) > 0) {
          await anchor.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(400);
        }
      }
      await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
      const fileFull = `${vp.label}-${scene.key}-full.png`;
      await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });

      const debugAudit = await auditUserFacingDebug(page);
      if (debugAudit.count > 0 || debugAudit.adminVisible) {
        audit.issues.push(
          debugAudit.adminVisible
            ? "利用者画面に運営デバッグパネルが表示"
            : `利用者画面にデバッグ文言: ${debugAudit.hits.join(", ")}`
        );
      }
      report.userDebugAudit.pages.push({
        stepId: `anpi-${scene.key}-${vp.label}`,
        hits: debugAudit.hits,
        adminVisible: debugAudit.adminVisible,
        count: debugAudit.count,
      });

      if (scene.geminiKey && vp.label === "390") {
        report.geminiShots[vp.label] = report.geminiShots[vp.label] || {};
        report.geminiShots[vp.label][scene.geminiKey] = fileViewport;
      }

      const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
      report.dashScenes[scene.key].viewports.push({ viewport: vp.label, file: fileViewport, verdict, audit });
      report.dashScenes[scene.key].issues.push(...audit.issues);
      report.dashScenes[scene.key].minors.push(...audit.minors);
      if (verdict === "FAIL") report.dashScenes[scene.key].verdict = "FAIL";
      else if (verdict === "MINOR" && report.dashScenes[scene.key].verdict === "PASS") {
        report.dashScenes[scene.key].verdict = "MINOR";
      }

      report.pages.push({
        viewport: vp.label,
        stepId: `anpi-${scene.key}-${vp.label}`,
        stepName: scene.label,
        file: fileViewport,
        verdict,
        issues: audit.issues,
        minors: audit.minors,
        data: audit,
      });
    } catch (err) {
      report.dashScenes[scene.key].verdict = "FAIL";
      report.pages.push({
        viewport: vp.label,
        stepId: `anpi-${scene.key}-${vp.label}`,
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

// --- 履歴（安否通知センター）---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await page.goto(anpiNotificationsUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await seedAnpiContext(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-notifications-root]", { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-anpi-card]").length > 0 || !document.querySelector("[data-anpi-empty]")?.hidden,
      { timeout: 20000 }
    ).catch(() => {});
    await page.waitForTimeout(1200);

    const audit = await auditHistoryPage(page, vp.label);
    const fileViewport = `${vp.label}-history-viewport.png`;
    await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
    const fileFull = `${vp.label}-history-full.png`;
    await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });

    const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
    report.historyScenes.viewport = report.historyScenes.viewport || { label: "安否通知履歴", verdict: "PASS", viewports: [] };
    report.historyScenes.viewport.viewports.push({ viewport: vp.label, file: fileViewport, verdict, audit });
    if (verdict === "FAIL") report.historyScenes.viewport.verdict = "FAIL";
    else if (verdict === "MINOR" && report.historyScenes.viewport.verdict === "PASS") {
      report.historyScenes.viewport.verdict = "MINOR";
    }

    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-history-${vp.label}`,
      stepName: "安否通知履歴",
      file: fileViewport,
      verdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });
  } catch (err) {
    report.historyScenes.viewport = { label: "安否通知履歴", verdict: "FAIL", viewports: [{ viewport: vp.label, verdict: "FAIL", issues: [String(err?.message || err)] }] };
    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-history-${vp.label}`,
      stepName: "安否通知履歴",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

// --- 運営側（LINE運用）---
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  try {
    await page.goto(anpiAdminUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await seedAnpiContext(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-line-admin-root]", { timeout: 20000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-anpi-line-admin-page]") ||
        document.querySelector("[data-anpi-line-admin-denied]"),
      { timeout: 30000 }
    );
    await page.waitForTimeout(1200);

    const audit = await auditOpsAdmin(page, vp.label);
    const fileViewport = `${vp.label}-ops-admin-viewport.png`;
    await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
    const fileFull = `${vp.label}-ops-admin-full.png`;
    await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });

    const verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";
    report.opsScenes.viewport = report.opsScenes.viewport || { label: "運営側LINE運用", verdict: "PASS", viewports: [] };
    report.opsScenes.viewport.viewports.push({ viewport: vp.label, file: fileViewport, verdict, audit });
    if (verdict === "FAIL") report.opsScenes.viewport.verdict = "FAIL";
    else if (verdict === "MINOR" && report.opsScenes.viewport.verdict === "PASS") {
      report.opsScenes.viewport.verdict = "MINOR";
    }

    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-ops-admin-${vp.label}`,
      stepName: "運営側LINE運用",
      file: fileViewport,
      verdict,
      issues: audit.issues,
      minors: audit.minors,
      data: audit,
    });
  } catch (err) {
    report.opsScenes.viewport = { label: "運営側LINE運用", verdict: "FAIL", viewports: [{ viewport: vp.label, verdict: "FAIL", issues: [String(err?.message || err)] }] };
    report.pages.push({
      viewport: vp.label,
      stepId: `anpi-ops-admin-${vp.label}`,
      stepName: "運営側LINE運用",
      verdict: "FAIL",
      issues: [String(err?.message || err)],
      minors: [],
    });
  } finally {
    await context.close();
  }
}

await requestCtx.close();
await browser.close();

for (const cat of Object.values(report.notifyCategories)) {
  if (cat.verdict !== "FAIL") cat.verdict = cat.issues.length ? "FAIL" : cat.minors?.length ? "MINOR" : "PASS";
}

for (const vp of VIEWPORTS) {
  const notifyPage = report.pages.find((p) => p.stepId === `anpi-notify-list-${vp.label}`);
  report.uxReview.byViewport[vp.label] = {
    notifyAudit: notifyPage?.data || {},
    geminiChecklist: buildGeminiChecklist(notifyPage?.data || {}, report.navigationChecks, report.pages, vp.label),
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

report.verdicts.anpiNotify = Object.values(report.notifyCategories).every((c) => c.verdict !== "FAIL")
  ? Object.values(report.notifyCategories).some((c) => c.verdict === "MINOR") ||
    report.pages.some((p) => p.stepId?.startsWith("anpi-notify") && p.verdict === "MINOR")
    ? "MINOR"
    : "PASS"
  : "FAIL";

report.verdicts.responseScreen = ["check-response", "check-answered"].every((k) => report.dashScenes[k]?.verdict !== "FAIL")
  ? ["check-response", "check-answered"].some((k) => report.dashScenes[k]?.verdict === "MINOR")
    ? "MINOR"
    : "PASS"
  : "FAIL";

report.verdicts.familyVerifier = report.dashScenes.family?.verdict || "PASS";
report.verdicts.opsSide = report.opsScenes.viewport?.verdict || "PASS";
report.verdicts.history = report.historyScenes.viewport?.verdict || "PASS";

report.userDebugAudit.totalHits = report.userDebugAudit.pages.reduce(
  (sum, p) => sum + (p.count || 0) + (p.adminVisible ? 1 : 0),
  0
);
if (report.userDebugAudit.totalHits > 0) {
  report.uiConcerns.push(`利用者画面にデバッグ情報 ${report.userDebugAudit.totalHits}件`);
}

report.overall = resolveOverall(stats.failCount + navFail, stats.minorCount);

if (navFail) report.uiConcerns.push(`安否通知→遷移で HTTP エラー ${navFail}件`);
const hScrollFails = report.pages.filter((p) => (p.issues || []).some((i) => /横スクロール/.test(i)));
if (hScrollFails.length) {
  report.uiConcerns.push(
    `横スクロール検出: ${hScrollFails.map((p) => `${p.stepName}(${p.viewport}px)`).join("、")}`
  );
}
if (report.pages.some((p) => (p.minors || []).some((m) => /固定CTA|被り/.test(m)))) {
  report.uiConcerns.push("390pxで固定CTA被りの懸念");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /間延び|デッド|密度/.test(m)))) {
  report.uiConcerns.push("1280pxで間延び・デッドスペース・情報密度の懸念");
}
if (report.pages.some((p) => (p.minors || []).some((m) => /CTA高さ|フォント|文字切れ/.test(m)))) {
  report.uiConcerns.push("390pxでボタンサイズ・文字切れに注意");
}
const duplicateCheckCard = report.pages.some(
  (p) => p.stepId?.startsWith("anpi-notify") && (p.data?.cards || []).filter((c) => c.id === "anpi-check-request-001").length > 1
);
if (duplicateCheckCard) {
  report.uiConcerns.push("安否確認通知カードが重複表示（同一IDの2要素）");
}
if (!report.uiConcerns.length) {
  report.uiConcerns.push("致命的な問題は検出されませんでした — 本番投入可レベル");
}

report.fixPriorities = [];
if (stats.failCount + navFail === 0) {
  report.fixPriorities.push("安否フローは本番可（FAIL 0）");
}
if (report.userDebugAudit.totalHits > 0) {
  report.fixPriorities.push("P1: 利用者画面の運営・デバッグ情報を非表示");
}
if (navFail) report.fixPriorities.push("P1: 安否通知→遷移先の HTTP エラー解消");
if (report.verdicts.opsSide === "FAIL") {
  report.fixPriorities.push("P1: 運営側LINE運用 — 390px 横スクロール解消（ログテーブル・統計グリッドの折り返し）");
}
if (duplicateCheckCard) {
  report.fixPriorities.push("P2: 安否確認通知の重複DOM表示を整理");
}
if (report.verdicts.opsSide === "MINOR") {
  report.fixPriorities.push("P2: 運営側の送信/失敗ログ表示を充実");
}
if (report.uiConcerns.some((c) => /固定CTA|被り/.test(c))) {
  report.fixPriorities.push("P3: 390px 固定CTA・ボタンサイズ調整（任意）");
}
if (report.uiConcerns.some((c) => /1280px|デッド|間延び/.test(c))) {
  report.fixPriorities.push("P3: 1280px レイアウト幅バランス（任意）");
}
if (!report.fixPriorities.length) report.fixPriorities.push("必須修正なし");

report.finalNotes = {
  anpiNotify: report.verdicts.anpiNotify === "FAIL" ? "要修正" : "本番可",
  responseScreen: report.verdicts.responseScreen,
  familyVerifier: report.verdicts.familyVerifier,
  opsSide: report.verdicts.opsSide,
  history: report.verdicts.history,
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
  userDebugHits: report.userDebugAudit.totalHits,
  geminiBeforeAfter: report.geminiBeforeAfter,
  notifyCategoryVerdicts: Object.fromEntries(
    Object.entries(report.notifyCategories).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
  ),
  dashSceneVerdicts: Object.fromEntries(
    Object.entries(report.dashScenes).map(([k, v]) => [k, { label: v.label, verdict: v.verdict }])
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
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>安否最終UX</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc}table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0}td,th{border:1px solid #e2e8f0;padding:8px;font-size:.8125rem}ul,ol{line-height:1.6}${SCREENSHOT_BACK_NAV_CSS}</style></head>
<body>${renderScreenshotBackNav()}<h1>安否フロー 最終UX監査</h1>
<p>総合: <strong>${esc(report.overall)}</strong> · FAIL ${report.summary.failCount} · MINOR ${report.summary.minorCount} · ${esc(report.generatedAt)}</p>
<h2>領域別判定</h2><table><tr><th>領域</th><th>判定</th></tr>${verdictRows}</table>
<h2>Geminiチェックリスト</h2><ul>${gemini}</ul>
<h2>気になるUI</h2><ul>${report.uiConcerns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>修正優先順位</h2><ol>${report.fixPriorities.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
</body></html>`;
}

fs.writeFileSync(path.join(OUT, "index.html"), renderLocalIndex());

const reviewUrl = await finalizeVerification(root, { primaryFolder: "anpi-final-review", openBrowser: false });
console.log(`Anpi final review: ${report.overall} (FAIL ${report.summary.failCount}, MINOR ${report.summary.minorCount})`);
console.log(`Report: ${path.join(OUT, "report.json")}`);
console.log(`Review: ${reviewUrl}`);
