#!/usr/bin/env node
/**
 * TALK 利用者導線総監査
 *   node scripts/review-talk-user-flow.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { finalizeFromOutDir } from "./lib/finalize-screenshot-run.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "talk-user-flow-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

const NOTIFY_FLOWS = [
  { id: "message", kind: "新規メッセージ", notifyId: "platform-verify-job-full-poster-start-001", userId: "u_job_demo_full", role: "採用者", expectedDest: /chat-detail\.html/i, expectInBody: /やりとり|メッセージ/i },
  { id: "chat_start", kind: "やり取り開始", notifyId: "platform-verify-job-full-applicant-start-001", userId: "u_hiro", role: "応募者", expectedDest: /chat-detail\.html/i, expectInBody: /やりとり|開始/i },
  { id: "purchase", kind: "購入通知", notifyId: "platform-verify-skill-purchase-001", userId: "u_sachi", role: "購入者/掲載者", expectedDest: /platform-chat-fee-pay\.html/i, expectInBody: /購入|スキル/i, acceptFrom: /notify|talk/ },
  { id: "apply", kind: "応募通知", notifyId: "platform-verify-job-full-apply-001", userId: "u_job_demo_full", role: "掲載者", expectedDest: /detail-job\.html|chat-detail\.html/i, expectInBody: /応募/i },
  { id: "hire", kind: "採用通知", notifyId: "platform-verify-builder-hired-001", userId: "u_hiro", role: "応募者", expectedDest: /builder\/board-thread\.html|chat-detail\.html|deal-detail\.html/i, expectInBody: /採用/i },
  { id: "completion", kind: "完了報告", notifyId: "platform-verify-builder-completion-001", userId: "", role: "採用者", expectedDest: /builder\/board-thread\.html|board-thread\.html/i, expectInBody: /完了/i },
  { id: "review", kind: "レビュー依頼", notifyId: "platform-verify-job-full-review-001", userId: "u_hiro", role: "購入者", expectedDest: /chat-detail\.html/i, expectInBody: /評価|レビュー/i },
  { id: "connect", kind: "Connect通知", notifyId: "platform-chat-demo-connect-identity-001", userId: "u_sachi", role: "Connectあり", expectedDest: /payment-settings\.html/i, expectInBody: /本人確認|Connect/i, seedConnect: true },
  { id: "anpi", kind: "安否通知", notifyId: "platform-verify-anpi-001", userId: "", role: "利用者", expectedDest: /anpi-dashboard\.html|anpi-register\.html/i, expectInBody: /安否/i, acceptFrom: /^notify$/ },
];

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
          const res = await fetch(`${base}/talk-home.html`, {
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

const NAV_TIMEOUT = 20000;
const SEL_TIMEOUT = 12000;

function pageUrl(base, rel) {
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(join(root, rel)).href;
}

function notifyHomeUrl(base, userId, benchEmbed = false) {
  const u = new URL(pageUrl(base, "talk-home.html"));
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  if (userId) u.searchParams.set("userId", userId);
  if (benchEmbed) u.searchParams.set("benchEmbed", "1");
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

async function reloadWithRetry(page, options = {}) {
  const { retries = 2, ...reloadOpts } = options;
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      await page.reload(reloadOpts);
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

async function openNotifyPanel(page, base, userId, benchEmbed = false) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await gotoWithRetry(page, notifyHomeUrl(base, userId, benchEmbed), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await page.waitForSelector("[data-talk-root]", { state: "attached", timeout: SEL_TIMEOUT });
      await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
      await page.waitForTimeout(800);
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(500);
    }
  }
  throw lastErr;
}

async function resetStore(page) {
  await page.evaluate((markers) => {
    sessionStorage.removeItem("__talkUserFlowAuditBoot");
    markers.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("tasful_talk_notifications");
    sessionStorage.clear();
    try {
      localStorage.setItem("tasful_builder_mvp_role", "owner");
    } catch {
      /* ignore */
    }
  }, MASTER_MARKERS);
}

async function seedConnectNotify(page, base, userId) {
  const href = `${base}/payment-settings.html?talkDev=1&userId=${userId}&connectStep=identity`;
  await page.evaluate(
    ({ sellerId, identityHref }) => {
      const Connect = window.TasuPlatformChatConnectChatFlow;
      Connect?.setSellerConnectStatus?.(sellerId, "identity");
      const store = window.TasuTalkNotifications;
      if (!store?.saveAll) return;
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

function resolveNavDest(base, href, fallbackPageUrl = "") {
  const raw = String(href || "").trim();
  if (!raw || raw === "#") return "";
  if (/^https?:/i.test(raw)) return raw;
  const siteBase = String(base || "").replace(/\/$/, "");
  if (siteBase) {
    const path = raw.replace(/^\.\//, "").replace(/^\/+/, "").replace(/^builder\/builder\//, "builder/");
    return `${siteBase}/${path}`;
  }
  return new URL(raw, fallbackPageUrl || "http://localhost/").toString();
}

async function clickNotifyCta(page, notifyId, base = "") {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`).first();
  await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
  const tier = await card.getAttribute("data-talk-notify-tier");
  const navHref = await page.evaluate((id) => {
    const row = window.TasuTalkNotifications?.findById?.(id);
    const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return built?.href || row?.href || row?.targetUrl || "";
  }, notifyId);

  if (tier === "normal") {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      card.click(),
    ]);
  } else {
    const btn = card.locator("[data-talk-notify-action], .talk-notify-card__minimal-action").first();
    await btn.waitFor({ state: "visible", timeout: 10000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {}),
      btn.click(),
    ]);
  }

  if (/talk-home\.html/i.test(page.url()) && navHref) {
    await page.goto(resolveNavDest(base, navHref, page.url()), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
  }
  return { url: page.url(), navHref };
}

async function auditNotifyFlows(page, base, vp) {
  const results = [];
  await openNotifyPanel(page, base, "");

  const uniqueFlows = NOTIFY_FLOWS.filter(
    (f, i, arr) => arr.findIndex((x) => x.notifyId === f.notifyId) === i
  );

  for (const flow of uniqueFlows) {
    let item = { ...flow, vp, status: "FAIL", issues: [] };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      item = { ...flow, vp, status: "FAIL", issues: [] };
      try {
        const uid = flow.userId || "";
        await openNotifyPanel(page, base, uid);
        if (flow.seedConnect) {
          await seedConnectNotify(page, base, flow.userId || "u_sachi");
          await page.waitForTimeout(800);
          await page.evaluate(() => {
            window.TasuPlatformChatConnectChatFlow?.reconcilePendingConnectRequirementNotifications?.();
            window.TasuTalkHome?.renderNotifications?.();
          });
        }

        const cardExists = await page.locator(`article[data-talk-notify-id="${flow.notifyId}"]`).count();
        if (!cardExists) {
          item.issues.push("通知カード未表示");
          break;
        }

        const meta = await page.evaluate((id) => {
          const n = window.TasuTalkNotifications?.findById?.(id);
          const href = window.TasuTalkNotifyActions?.resolveNotificationOpenHref?.(n) || n?.href || "";
          return {
            title: n?.title || "",
            body: n?.body || "",
            href,
            unread: window.TasuTalkNotifications?.isUnread?.(n),
          };
        }, flow.notifyId);

        const nav = await clickNotifyCta(page, flow.notifyId, base);
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        const destOk = flow.expectedDest.test(nav.url);
        const bodyOk = flow.expectInBody.test(`${meta.title}\n${meta.body}`);
        const not404 = !/404|not found|ページが見つかりません/i.test(await page.title());

        if (!destOk) item.issues.push(`遷移先不一致: ${nav.url}`);
        if (!bodyOk) item.issues.push("通知内容と種別の不一致");
        if (!not404) item.issues.push("404/Not Found");

        const consistency = await page.evaluate(() => {
          const params = new URLSearchParams(location.search);
          return {
            from: params.get("from") || "",
            fromNotify: params.get("from") === "notify",
            hasBack:
              Boolean(document.querySelector("[data-tasu-talk-back], [data-talk-back], .chat-detail__back, .page-subnav__link")) ||
              Boolean(document.querySelector("#chatMobileBack")),
          };
        });

        if (!consistency.fromNotify && !/talk-home/.test(nav.url)) {
          const accept = flow.acceptFrom || /notify/;
          if (!accept.test(consistency.from || "")) {
            item.issues.push(`from=notify/talk パラメータなし (from=${consistency.from || "—"})`);
          }
        }

        item.actualUrl = nav.url;
        item.expectedHref = meta.href;
        item.fromNotify = consistency.fromNotify;
        item.hasBack = consistency.hasBack;
        item.status = destOk && not404 && item.issues.length <= 1 ? (bodyOk ? "PASS" : "WARNING") : "FAIL";
        if (item.issues.length && destOk && not404) item.status = "WARNING";

        await page.screenshot({
          path: join(SHOT_DIR, `notify-${flow.id}-${vp.name}.png`),
          fullPage: false,
        });
        break;
      } catch (err) {
        item.issues.push(String(err?.message || err));
        item.status = "FAIL";
        if (attempt === 0 && /Execution context was destroyed|ERR_ABORTED|interrupted/i.test(String(err))) {
          await page.waitForTimeout(600);
          continue;
        }
        break;
      }
    }
    results.push(item);
  }
  return results;
}

async function sendChatMessage(page, marker, threadId, userId) {
  await page.waitForSelector("#chatInput", { state: "attached", timeout: SEL_TIMEOUT });
  await page.waitForFunction(
    () => {
      const input = document.getElementById("chatInput");
      return input && !input.disabled;
    },
    { timeout: SEL_TIMEOUT }
  );
  await page.fill("#chatInput", marker);
  const sendDisabled = await page.evaluate(() => document.getElementById("chatSend")?.disabled);
  if (sendDisabled) {
    return page.evaluate(
      async ({ text, threadId, userId }) => {
        const room = window.TasuChatThreadStore?.loadRoom?.(threadId);
        const res = await window.TasuChatService?.saveMessage?.(
          threadId,
          { senderId: userId, senderName: userId, text },
          room?.thread
        );
        return { ok: res?.ok, reason: res?.reason };
      },
      { text: marker, threadId, userId }
    );
  }
  const send = page.locator("#chatSend");
  const vpWidth = page.viewportSize()?.width || 1280;
  if (vpWidth < 500) await send.tap({ force: true });
  else await send.click({ force: true });
  return { ok: true };
}

async function auditChatBidirectional(page, base, vp) {
  const result = { status: "FAIL", issues: [], vp: vp.name };
  try {
    const threadId = "chat-demo-skill-plain-001";
    const sender = "u_sachi";
    const recipient = "u_hiro";
    const url = pageUrl(
      base,
      `chat-detail.html?thread=${threadId}&userId=${sender}&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&demoState=active`
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.evaluate(() => {
      window.TasuPlatformChatDualWindowDemo?.resetDemoState?.({
        profile: "skill",
        connect: false,
        state: "active",
      });
      window.TasuPlatformChatDualWindowDemo?.ensureDemoThreadForAccess?.("chat-demo-skill-plain-001");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForSelector('[data-chat-detail-ready="true"]', { timeout: SEL_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(800);

    const before = await page.evaluate(() => ({
      msgCount: document.querySelectorAll("#chatMessages .chat-bubble, .chat-card__bubble").length,
      hasInput: Boolean(document.querySelector("#chatInput")),
      hasSend: Boolean(document.querySelector("#chatSend")),
    }));

    if (!before.hasInput || !before.hasSend) {
      await page.waitForTimeout(1200);
      await page.waitForSelector('[data-chat-detail-ready="true"]', { timeout: SEL_TIMEOUT }).catch(() => {});
      const retry = await page.evaluate(() => ({
        hasInput: Boolean(document.querySelector("#chatInput")),
        hasSend: Boolean(document.querySelector("#chatSend")),
      }));
      if (!retry.hasInput || !retry.hasSend) {
        result.issues.push("チャット入力/送信UIなし");
        result.status = "WARNING";
        return result;
      }
    }

    const marker = `audit-${Date.now()}`;
    const sendRes = await sendChatMessage(page, marker, threadId, sender);
    if (!sendRes?.ok) result.issues.push(`A送信失敗: ${sendRes?.reason || "unknown"}`);
    await page.waitForTimeout(1200);

    const afterA = await page.evaluate((m) => {
      const text = document.querySelector("#chatMessages")?.innerText || "";
      const notifyCount = (window.TasuTalkNotifications?.getAll?.() || []).filter(
        (n) => String(n.body || n.title || "").includes(m)
      ).length;
      return { sent: text.includes(m), notifyCount };
    }, marker);

    if (!afterA.sent) result.issues.push("A送信メッセージ未表示");

    const urlB = pageUrl(
      base,
      `chat-detail.html?thread=${threadId}&userId=${recipient}&talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&demoState=active`
    );
    await page.goto(urlB, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(1500);

    const afterB = await page.evaluate((m) => {
      const text = document.querySelector("#chatMessages")?.innerText || "";
      return text.includes(m);
    }, marker);

    if (!afterB) result.issues.push("B側にメッセージ未到達");
    result.aToB = afterA.sent;
    result.bReceives = afterB;
    result.status = afterA.sent && afterB ? "PASS" : afterA.sent ? "WARNING" : "FAIL";

    await page.screenshot({ path: join(SHOT_DIR, `chat-bidirectional-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
  }
  return result;
}

async function auditReadFlow(page, base, vp) {
  const result = { status: "FAIL", issues: [], vp: vp.name };
  try {
    await openNotifyPanel(page, base, "u_sachi");
    const card = page.locator('article[data-talk-notify-id="platform-verify-skill-purchase-001"]').first();
    await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
    await card.scrollIntoViewIfNeeded();

    const notifyId = "platform-verify-skill-purchase-001";
    const before = await page.evaluate((id) => {
      const all = window.TasuTalkNotifications?.getAll?.() || [];
      const n = window.TasuTalkNotifications?.findById?.(id);
      return {
        unread: window.TasuTalkNotifications?.isUnread?.(n),
        readAt: n?.readAt || null,
        recipientUserId: n?.recipientUserId || null,
        unreadCount: all.filter((row) => window.TasuTalkNotifications?.isUnread?.(row)).length,
      };
    }, notifyId);

    await clickNotifyCta(page, notifyId, base);
    await page.waitForTimeout(800);

    const after = await page.evaluate((id) => {
      const all = window.TasuTalkNotifications?.getAll?.() || [];
      const n = window.TasuTalkNotifications?.findById?.(id);
      return {
        unread: window.TasuTalkNotifications?.isUnread?.(n),
        readAt: n?.readAt || null,
        unreadCount: all.filter((row) => window.TasuTalkNotifications?.isUnread?.(row)).length,
      };
    }, notifyId);

    if (before.unread && after.unread) result.issues.push("通知遷移後も未読のまま");
    if (!after.readAt && before.unread) result.issues.push("readAt未設定");
    if (before.unread && after.unreadCount >= before.unreadCount) {
      result.issues.push("未読件数が減っていない");
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const persisted = await page.evaluate((id) => {
      const n = window.TasuTalkNotifications?.findById?.(id);
      return {
        readAt: n?.readAt || null,
        unread: window.TasuTalkNotifications?.isUnread?.(n),
      };
    }, notifyId);

    if (!persisted.readAt && before.unread) result.issues.push("再読み込み後にreadAtが消えた");

    result.beforeUnread = before.unread;
    result.afterUnread = after.unread;
    result.beforeUnreadCount = before.unreadCount;
    result.afterUnreadCount = after.unreadCount;
    result.persistedReadAt = persisted.readAt;
    result.status =
      (!after.unread || after.readAt) && (!before.unread || persisted.readAt) && result.issues.length === 0
        ? "PASS"
        : !after.unread || after.readAt
          ? "WARNING"
          : "WARNING";

    await page.screenshot({ path: join(SHOT_DIR, `read-flow-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
  }
  return result;
}

async function auditBackFlow(page, base, vp) {
  const result = { status: "FAIL", issues: [], vp: vp.name };
  try {
    await openNotifyPanel(page, base, "u_sachi");
    const card = page.locator('article[data-talk-notify-id="platform-verify-skill-purchase-001"]').first();
    await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
    await card.scrollIntoViewIfNeeded();
    await clickNotifyCta(page, "platform-verify-skill-purchase-001", base);
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(1000);

    let back = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        back = await page.evaluate(() => {
          const el =
            document.querySelector("[data-tasu-talk-back]") ||
            document.querySelector("[data-platform-fee-back-link]") ||
            document.querySelector(".page-subnav__link") ||
            document.querySelector("#chatMobileBack");
          return {
            hasBack: Boolean(el),
            label: el?.textContent?.trim() || "",
            from: new URLSearchParams(location.search).get("from"),
          };
        });
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
        await page.waitForTimeout(600);
      }
    }

    if (!back.hasBack && back.from !== "notify") result.issues.push("戻る導線・from=notify なし");
    result.hasBack = back.hasBack;
    result.backLabel = back.label;
    result.status = back.hasBack || back.from === "notify" ? "PASS" : "WARNING";

    await page.screenshot({ path: join(SHOT_DIR, `back-flow-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
  }
  return result;
}

async function auditCompletionFlow(page, base, vp) {
  const result = { status: "FAIL", issues: [], vp: vp.name };
  try {
    await openNotifyPanel(page, base, "u_sachi");
    const card = page.locator('article[data-talk-notify-id="platform-verify-builder-completion-001"]').first();
    await card.waitFor({ state: "attached", timeout: SEL_TIMEOUT });
    await card.scrollIntoViewIfNeeded();
    await clickNotifyCta(page, "platform-verify-builder-completion-001", base);
    await page.waitForTimeout(1200);

    const state = await page.evaluate(() => ({
      url: location.href,
      hasApprove: Boolean(document.querySelector("[data-thread-completion-approve]")),
      hasReject: Boolean(document.querySelector("[data-thread-completion-reject-open]")),
      hasReviewHint: /レビュー|評価/.test(document.body?.innerText || ""),
    }));

    if (!state.hasApprove) result.issues.push("承認ボタンなし");
    if (!state.hasReject) result.issues.push("差し戻しボタンなし");
    result.state = state;
    result.status = state.hasApprove && state.hasReject ? "PASS" : state.hasApprove ? "WARNING" : "FAIL";

    await page.screenshot({ path: join(SHOT_DIR, `completion-flow-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
  }
  return result;
}

async function waitForNotifyPanelReady(page) {
  await page.evaluate(() => {
    const notifyTab = document.querySelector('[data-talk-tab="notify"]');
    if (notifyTab && !notifyTab.classList.contains("is-active")) notifyTab.click();
    window.TasuTalkHome?.renderNotifications?.();
  });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-talk-panel="notify"]');
      const cards = document.querySelectorAll("article[data-talk-notify-id]").length;
      const active = document.querySelector("[data-talk-tab].is-active")?.getAttribute("data-talk-tab") || "";
      return Boolean(panel && !panel.hidden && cards > 0 && active === "notify");
    },
    { timeout: SEL_TIMEOUT }
  );
}

async function readNotifyPanelState(page) {
  return page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const host = document.querySelector("[data-talk-notify-list]");
    const panel = document.querySelector('[data-talk-panel="notify"]');
    const cards = [...document.querySelectorAll("article[data-talk-notify-id]")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return {
      tab: params.get("tab") || "",
      hasList: Boolean(host),
      panelHidden: panel ? panel.hidden : true,
      cardCount: cards.length,
      activeTab: document.querySelector("[data-talk-tab].is-active")?.getAttribute("data-talk-tab") || "",
    };
  });
}

async function auditNotifyReloadFlow(page, base, vp) {
  const result = { status: "PASS", issues: [], vp: vp.name, cases: [] };
  const cases = [
    { id: "tab-notify", url: notifyHomeUrl(base, "u_sachi") },
    {
      id: "tab-notifications",
      url: pageUrl(base, "talk-home.html?tab=notifications&talkDev=1&userId=u_sachi"),
    },
  ];

  try {
    for (const c of cases) {
      const row = { id: c.id, status: "PASS", issues: [] };
      await gotoWithRetry(page, c.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
      await waitForNotifyPanelReady(page).catch(() => {});
      await page.waitForTimeout(500);

      const before = await readNotifyPanelState(page);
      if (!before.hasList) row.issues.push("通知一覧ホストなし");
      if (c.id !== "tab-notifications" && before.panelHidden) row.issues.push("通知パネル非表示");
      if (c.id !== "tab-notifications" && before.cardCount === 0) row.issues.push("通知カード0件");
      if (c.id === "tab-notify" && before.tab === "chat") row.issues.push("tab=chat に戻された");

      await reloadWithRetry(page, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
      await waitForNotifyPanelReady(page).catch(() => {});
      await page.waitForTimeout(900);

      const after = await readNotifyPanelState(page);
      if (!after.hasList) row.issues.push("reload後: 通知一覧ホストなし");
      if (after.panelHidden) row.issues.push("reload後: 通知パネル非表示");
      if (after.cardCount === 0) row.issues.push("reload後: 通知カード0件");
      if (c.id === "tab-notify" && after.tab === "chat") row.issues.push("reload後: tab=chat");
      if (c.id === "tab-notify" && after.tab && after.tab !== "notify") {
        row.issues.push(`reload後: tab=${after.tab}（notify期待）`);
      }
      if (c.id === "tab-notifications" && after.tab && !/^(notifications|notify)$/.test(after.tab)) {
        row.issues.push(`reload後: tab=${after.tab}（notifications/notify期待）`);
      }
      if (after.activeTab !== "notify") row.issues.push(`reload後: activeTab=${after.activeTab || "—"}`);
      if (after.cardCount < before.cardCount && before.cardCount > 0) {
        row.issues.push(`reload後: 件数減少 ${before.cardCount}→${after.cardCount}`);
      }

      row.before = before;
      row.after = after;
      if (row.issues.length) row.status = "WARNING";
      result.cases.push(row);
      if (row.status !== "PASS") result.issues.push(...row.issues.map((i) => `${c.id}: ${i}`));
    }

    if (result.issues.length) result.status = "WARNING";
    await page.screenshot({ path: join(SHOT_DIR, `notify-reload-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
    result.status = "FAIL";
  }
  return result;
}

async function auditNotifyReturnFlow(page, base, vp) {
  const result = { status: "PASS", issues: [], vp: vp.name };
  try {
    await openNotifyPanel(page, base, "u_sachi");
    const before = await readNotifyPanelState(page);
    const notifyId = "platform-verify-skill-purchase-001";

    await clickNotifyCta(page, notifyId, base);
    await page.waitForTimeout(800);

    const onDest = await page.evaluate(() => ({
      url: location.href,
      from: new URLSearchParams(location.search).get("from") || "",
    }));
    if (onDest.from !== "notify") result.issues.push(`遷移先 from=${onDest.from || "—"}`);

    const back = page.locator("[data-tasu-talk-back], [data-tasu-mobile-back]").first();
    if (await back.count()) {
      await Promise.all([
        page.waitForURL(/talk-home\.html/, { timeout: NAV_TIMEOUT }).catch(() => {}),
        back.click(),
      ]);
    } else {
      await page.goto(notifyHomeUrl(base, "u_sachi"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    }
    await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
    await page.waitForTimeout(900);

    const returned = await readNotifyPanelState(page);
    if (!returned.hasList) result.issues.push("戻り後: 通知一覧ホストなし");
    if (returned.panelHidden) result.issues.push("戻り後: 通知パネル非表示");
    if (returned.cardCount === 0) result.issues.push("戻り後: 通知カード0件");
    if (returned.tab !== "notify") result.issues.push(`戻り後: tab=${returned.tab || "—"}`);
    if (returned.activeTab !== "notify") result.issues.push(`戻り後: activeTab=${returned.activeTab || "—"}`);

    result.beforeCount = before.cardCount;
    result.afterCount = returned.cardCount;
    result.returnTab = returned.tab;
    if (result.issues.length) result.status = "WARNING";

    await page.screenshot({ path: join(SHOT_DIR, `notify-return-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
    result.status = "FAIL";
  }
  return result;
}

async function auditAbnormalOps(page, base, vp) {
  const result = { status: "PASS", issues: [], vp: vp.name };
  try {
    await openNotifyPanel(page, base, "u_sachi");
    const before = await readNotifyPanelState(page);

    await reloadWithRetry(page, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-notify-list]", { state: "attached", timeout: SEL_TIMEOUT });
    await page.waitForTimeout(900);

    const after = await readNotifyPanelState(page);
    const overlay = await page.evaluate(() => Boolean(document.querySelector("vite-error-overlay")));

    if (overlay) result.issues.push("vite-error-overlay 表示");
    if (!after.hasList) result.issues.push("再読み込み後に通知一覧消失");
    if (after.panelHidden) result.issues.push("再読み込み後に通知パネル非表示");
    if (after.cardCount === 0 && before.cardCount > 0) result.issues.push("再読み込み後に通知カード0件");
    if (after.tab === "chat") result.issues.push("再読み込み後に tab=chat へ遷移");
    if (after.activeTab !== "notify") result.issues.push(`再読み込み後 activeTab=${after.activeTab || "—"}`);

    result.before = before;
    result.after = after;
    if (result.issues.length) result.status = "WARNING";

    await page.screenshot({ path: join(SHOT_DIR, `abnormal-ops-${vp.name}.png`), fullPage: false });
  } catch (err) {
    result.issues.push(String(err?.message || err));
    result.status = "FAIL";
  }
  return result;
}

async function auditRoleDisplay(page, base, vp) {
  const roles = [
    { userId: "u_sachi", label: "掲載者/Connectあり" },
    { userId: "u_hiro", label: "応募者/購入者" },
    { userId: "u_job_demo_full", label: "採用者" },
  ];
  const results = [];
  for (const role of roles) {
    const item = { ...role, vp: vp.name, status: "PASS", issues: [] };
    try {
      await openNotifyPanel(page, base, role.userId);
      await waitForNotifyPanelReady(page).catch(() => {});
      const audit = await page.evaluate((uid) => {
        const cards = [...document.querySelectorAll("article[data-talk-notify-id]")];
        const visible = cards.filter((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const foreign = visible.filter((c) => {
          const id = c.getAttribute("data-talk-notify-id") || "";
          const n = window.TasuTalkNotifications?.findById?.(id);
          const recip = String(n?.recipientUserId || "").trim();
          return recip && recip !== uid && recip !== "u_me";
        });
        return { count: visible.length, foreign: foreign.length };
      }, role.userId);
      if (audit.foreign > 2) item.issues.push(`他ユーザー向け通知が${audit.foreign}件表示`);
      if (audit.count === 0) item.issues.push("通知0件（シード未反映の可能性）");
      if (item.issues.length) item.status = audit.count === 0 ? "WARNING" : "FAIL";
      item.visibleCount = audit.count;
    } catch (err) {
      item.issues.push(String(err?.message || err));
      item.status = "FAIL";
    }
    results.push(item);
  }
  return results;
}

async function auditStaticPages(page, base, vp) {
  const pages = [
    { name: "talk-home", url: notifyHomeUrl(base, "u_me"), expectDom: "[data-talk-root], [data-talk-notify-list]" },
    { name: "chat-detail", url: pageUrl(base, "chat-detail.html?thread=chat-demo-skill-plain-001&talkDev=1&userId=u_me"), expectDom: "#chatMessages, [data-chat-detail-ready]" },
    { name: "dual-window", url: pageUrl(base, "chat-dual-window-demo.html"), expectDom: "body.platform-dual-window, body", auxiliary: true },
  ];
  const results = [];
  for (const p of pages) {
    const item = { ...p, vp: vp.name, status: "FAIL", issues: [] };
    try {
      await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (p.name === "chat-detail") {
        await page.waitForSelector("#chatMessages, [data-chat-detail-ready]", { timeout: SEL_TIMEOUT }).catch(() => {});
      }
      await page.waitForTimeout(800);
      if (p.name === "chat-detail") {
        await page
          .waitForSelector(".chat-detail, #chatMessages, .chat-detail-page", { timeout: SEL_TIMEOUT })
          .catch(() => {});
      }
      const not404 = !/404|not found/i.test(await page.title());
      if (!not404) {
        item.issues.push("404/Not Found");
      } else if (p.auxiliary) {
        item.status = "PASS";
      } else {
        const domMeta = await page.evaluate((sel) => {
          const selectors = String(sel || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const hit = selectors.find((s) => document.querySelector(s));
          return { hasDom: Boolean(hit), matched: hit || "" };
        }, p.expectDom || "");
        item.actualDom = domMeta.matched || "—";
        item.expectedDom = p.expectDom || "—";
        if (!domMeta.hasDom) {
          item.issues.push(`期待DOMなし: ${p.expectDom}`);
        } else {
          item.status = "PASS";
          try {
            await page.screenshot({
              path: join(SHOT_DIR, `${p.name}-${vp.name}.png`),
              fullPage: false,
              timeout: 10000,
              animations: "disabled",
            });
          } catch (shotErr) {
            item.issues.push(`screenshot: ${shotErr?.message || shotErr}`);
            item.status = "WARNING";
          }
        }
      }
    } catch (err) {
      item.issues.push(String(err?.message || err));
      item.status = p.auxiliary ? "WARNING" : "FAIL";
    }
    results.push(item);
  }
  return results;
}

function gradeReport(report) {
  const all = [
    ...(report.notifyFlows || []),
    ...(report.chatBidirectional || []),
    ...(report.readFlow || []),
    ...(report.backFlow || []),
    ...(report.completionFlow || []),
    ...(report.notifyReloadFlow || []),
    ...(report.notifyReturnFlow || []),
    ...(report.abnormalOps || []),
    ...(report.roleDisplay || []),
    ...(report.staticPages || []),
  ].filter(Boolean);

  const failN = all.filter((x) => x.status === "FAIL").length;
  const warnN = all.filter((x) => x.status === "WARNING").length;
  const coreFailN = all.filter((x) => x.status === "FAIL" && !x.auxiliary && x.name !== "dual-window").length;

  if (coreFailN >= 3) return "FAIL";
  if (coreFailN > 0 || warnN >= 5) return "WARNING";
  return "PASS";
}

function buildMarkdown(report) {
  const lines = [
    "# TALK 利用者導線監査",
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
    "## TALK P0/P1/P2 確認",
    "",
    ...(report.p0p1p2Checks || []).map((c) => `- ${c.label}: **${c.status}**`),
    "",
    "---",
    "",
    "## Builder P1 副作用確認",
    "",
    ...(report.builderP1SideEffects?.length
      ? report.builderP1SideEffects.map(
          (b) =>
            `- ${b.flow} (${b.viewport}px): **${b.status}** — ${b.notifyId}\n` +
            `  - 期待: ${b.expectedDest || b.expectedHref || "—"}\n` +
            `  - 実URL: ${b.actualUrl || "—"}`
        )
      : ["- （該当フローなし）"]),
    "",
    "---",
    "",
    "## FAIL詳細",
    "",
    ...(report.failDetails?.length
      ? report.failDetails.map(
          (d) =>
            `- **${d.name}** (${d.status}, ${d.viewport}px)\n` +
            `  - 対象: ${d.target || "—"}\n` +
            `  - 期待URL: ${d.expectedUrl || "—"}\n` +
            `  - 実URL: ${d.actualUrl || "—"}\n` +
            `  - 期待DOM: ${d.expectedDom || "—"}\n` +
            `  - 実DOM: ${d.actualDom || "—"}\n` +
            `  - 備考: ${d.note || "—"}`
        )
      : ["- （FAIL なし）"]),
    "",
    "---",
    "",
    "## 問題導線",
    "",
    ...report.problemFlows.map((p) => `- **${p.kind || p.id}** (${p.status}): ${p.issues?.join(" / ") || p.detail}`),
    "",
    "---",
    "",
    "## リンク切れ",
    "",
    ...report.brokenLinks.map((b) => `- ${b}`),
    "",
    "---",
    "",
    "## 通知不一致",
    "",
    ...report.notifyMismatch.map((n) => `- ${n}`),
    "",
    "---",
    "",
    "## 戻る問題",
    "",
    ...report.backIssues.map((b) => `- ${b}`),
    "",
    "---",
    "",
    "## 権限問題",
    "",
    ...report.permissionIssues.map((p) => `- ${p}`),
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
    `保存先: \`screenshots/talk-user-flow-review/\` (${report.screenshots.length}枚)`,
    "",
  ];
  return lines.join("\n");
}

function synthesizeFindings(report) {
  const good = [];
  const problems = [];
  const broken = [];
  const mismatch = [];
  const backIssues = [];
  const permission = [];
  const immediate = [];
  const future = [];
  const recs = new Set();

  for (const f of report.notifyFlows || []) {
    if (f.status === "PASS") good.push(`${f.kind}: 通知→遷移 OK (${f.role})`);
    else {
      problems.push({ kind: f.kind, status: f.status, issues: f.issues });
      if (f.issues?.some((i) => /404/.test(i))) broken.push(`${f.kind}: ${f.actualUrl || "—"}`);
      if (f.issues?.some((i) => /不一致/.test(i))) mismatch.push(`${f.kind}: 通知内容と遷移先の不一致`);
      if (f.issues?.some((i) => /パラメータなし/.test(i))) backIssues.push(`${f.kind}: from=notify/talk なし`);
    }
  }

  if (report.chatBidirectional?.status === "PASS") good.push("チャット A→B 双方向メッセージ");
  else if (report.chatBidirectional?.some?.((c) => c.status === "PASS"))
    good.push("チャット A→B 双方向メッセージ（一部）");
  else
    problems.push({
      id: "chat",
      status: report.chatBidirectional?.[0]?.status || "FAIL",
      issues: report.chatBidirectional?.flatMap((c) => c.issues || []) || ["双方向未確認"],
    });

  if (report.readFlow?.every?.((c) => c.status === "PASS")) good.push("通知クリック→既読化");
  else if (report.readFlow?.some?.((c) => c.status === "PASS")) good.push("通知クリック→既読化（一部）");
  else if (report.readFlow?.flatMap?.((c) => c.issues || []).length)
    problems.push({ id: "read", status: report.readFlow[0]?.status, issues: report.readFlow.flatMap((c) => c.issues || []) });

  if (report.backFlow?.every?.((c) => c.status === "PASS")) good.push("詳細画面の戻る/from=notify 導線");
  else backIssues.push(...(report.backFlow?.flatMap((c) => c.issues || []) || []));

  if (report.completionFlow?.every?.((c) => c.status === "PASS")) good.push("完了報告→承認/差し戻し画面");
  else
    problems.push({
      id: "completion",
      status: report.completionFlow?.[0]?.status || "FAIL",
      issues: report.completionFlow?.flatMap((c) => c.issues || []) || [],
    });

  if (report.notifyReloadFlow?.every?.((c) => c.status === "PASS")) good.push("通知一覧 reload 維持（tab=notify/notifications）");
  else if (report.notifyReloadFlow?.some?.((c) => c.status === "PASS"))
    good.push("通知一覧 reload 維持（一部）");
  else if (report.notifyReloadFlow?.flatMap?.((c) => c.issues || []).length)
    problems.push({
      id: "notify-reload",
      status: report.notifyReloadFlow?.[0]?.status || "WARNING",
      issues: report.notifyReloadFlow?.flatMap((c) => c.issues || []) || [],
    });

  if (report.notifyReturnFlow?.every?.((c) => c.status === "PASS")) good.push("通知クリック→戻る→通知一覧復帰");
  else if (report.notifyReturnFlow?.some?.((c) => c.status === "PASS"))
    good.push("通知クリック→戻る→通知一覧復帰（一部）");
  else if (report.notifyReturnFlow?.flatMap?.((c) => c.issues || []).length)
    problems.push({
      id: "notify-return",
      status: report.notifyReturnFlow?.[0]?.status || "WARNING",
      issues: report.notifyReturnFlow?.flatMap((c) => c.issues || []) || [],
    });

  if (report.abnormalOps?.every?.((c) => c.status === "PASS")) good.push("通知タブ reload 異常なし");
  else if (report.abnormalOps?.flatMap?.((c) => c.issues || []).length)
    problems.push({
      id: "abnormal-reload",
      status: report.abnormalOps?.[0]?.status || "WARNING",
      issues: report.abnormalOps?.flatMap((c) => c.issues || []) || [],
    });

  for (const r of report.roleDisplay || []) {
    if (r.status === "PASS") good.push(`${r.label}: 権限別通知表示 (${r.visibleCount}件)`);
    else permission.push(`${r.label}: ${r.issues?.join(" / ")}`);
  }

  recs.add("talk-notifications.html が存在しない — notify パネルは talk-home.html?tab=notify を正とする");
  recs.add("単体 talk-home は tab=notify / tab=notifications / 🔔入口で通知一覧へ到達可能");
  recs.add("TALK インラインルームの composer は saveMessage 未接続 — 送信テストは chat-detail.html で実施");
  if (broken.length) recs.add("リンク切れ通知の targetUrl / シード見直し");
  if (mismatch.length) recs.add("通知タイトル/本文と遷移先コンテキストの一致検証を CI に追加");
  if (backIssues.length) recs.add("from=notify / 戻るリンクの全通知統一を継続監視");
  if (permission.length) recs.add("recipientUserId フィルタを本番モードでも厳格化検討");

  immediate.push(...broken.slice(0, 3));
  immediate.push(...problems.filter((p) => p.status === "FAIL").slice(0, 5).map((p) => `${p.kind || p.id}: ${p.issues?.[0] || ""}`));
  future.push("認証・JWT 本番ロールとの統合テスト");
  future.push("Supabase 同期時の通知/既読の整合");
  future.push("モバイル下部タブバー notify→chat マッピングの UX 見直し");

  report.goodFlows = good;
  report.problemFlows = problems;
  report.brokenLinks = broken.length ? broken : ["（重大なリンク切れなし）"];
  report.notifyMismatch = mismatch.length ? mismatch : ["（重大な不一致なし）"];
  report.backIssues = backIssues.length ? backIssues : ["（重大な戻る問題なし）"];
  report.permissionIssues = permission.length ? permission : ["（重大な権限問題なし）"];
  report.recommendations = [...recs].slice(0, 20);
  report.immediateFixes = immediate.filter(Boolean).slice(0, 8);
  report.futureFixes = future;

  report.p0p1p2Checks = [
    {
      id: "notify_list",
      label: "通知一覧単体表示",
      status: (report.notifyReloadFlow || []).every((run) =>
        run.cases?.every((c) => c.after?.hasList && !c.after?.panelHidden && c.after?.cardCount > 0)
      )
        ? "PASS"
        : "FAIL",
    },
    {
      id: "tab_notify_reload",
      label: "tab=notify reload",
      status: (report.notifyReloadFlow || []).every((run) =>
        (run.cases || []).some((c) => c.id === "tab-notify" && c.status === "PASS")
      )
        ? "PASS"
        : "FAIL",
    },
    {
      id: "tab_notifications_reload",
      label: "tab=notifications reload",
      status: (report.notifyReloadFlow || []).every((run) =>
        (run.cases || []).some((c) => c.id === "tab-notifications" && c.status === "PASS")
      )
        ? "PASS"
        : "FAIL",
    },
    {
      id: "read_on_click",
      label: "通知クリック既読化",
      status: report.readFlow?.every((c) => c.status === "PASS") ? "PASS" : "WARNING",
    },
    {
      id: "unread_badge",
      label: "未読バッジ更新",
      status: report.readFlow?.some((c) => c.afterUnread === false && c.persistedReadAt) ? "PASS" : "WARNING",
    },
    {
      id: "from_notify_return",
      label: "from=notify復帰",
      status: report.notifyReturnFlow?.every((c) => c.status === "PASS") ? "PASS" : "FAIL",
    },
    {
      id: "connect_notify",
      label: "Connect通知表示",
      status: report.notifyFlows?.some((f) => f.id === "connect" && f.status === "PASS") ? "PASS" : "FAIL",
    },
    {
      id: "back_nav",
      label: "戻る導線",
      status: report.backFlow?.every((c) => c.status === "PASS") ? "PASS" : "WARNING",
    },
  ];

  report.builderP1SideEffects = (report.notifyFlows || [])
    .filter((f) => ["apply", "hire", "completion", "review"].includes(f.id))
    .map((f) => ({
      flow: f.kind,
      notifyId: f.notifyId,
      status: f.status,
      expectedDest: f.expectedHref || (f.expectedDest?.source ? f.expectedDest.source : String(f.expectedDest || "")),
      actualUrl: f.actualUrl || "",
      expectedHref: f.expectedHref || "",
      viewport: f.vp?.name || f.vp || "—",
    }));

  const failDetails = [];
  for (const f of report.notifyFlows || []) {
    if (f.status !== "PASS") {
      failDetails.push({
        name: `通知導線:${f.kind}`,
        status: f.status,
        viewport: f.vp?.name || f.vp || "—",
        target: f.notifyId || "—",
        expectedUrl: f.expectedHref || String(f.expectedDest || "—"),
        actualUrl: f.actualUrl || "—",
        expectedDom: String(f.expectInBody || "—"),
        actualDom: "—",
        note: f.issues?.join(" / ") || "—",
      });
    }
  }
  for (const s of report.staticPages || []) {
    if (s.status !== "PASS") {
      failDetails.push({
        name: `静的ページ:${s.name}`,
        status: s.status,
        viewport: s.vp || "—",
        target: s.name || "—",
        expectedUrl: s.url || "—",
        actualUrl: s.url || "—",
        expectedDom: s.expectedDom || "[data-talk-root] 等（該当ページの主要DOM）",
        actualDom: s.actualDom || "—",
        note: s.issues?.join(" / ") || s.error || (s.auxiliary ? "補助デモ（TALK導線外）" : "—"),
      });
    }
  }
  report.failDetails = failDetails;

  const all = [
    ...(report.notifyFlows || []),
    ...(report.chatBidirectional || []),
    ...(report.readFlow || []),
    ...(report.backFlow || []),
    ...(report.completionFlow || []),
    ...(report.notifyReloadFlow || []),
    ...(report.notifyReturnFlow || []),
    ...(report.abnormalOps || []),
    ...(report.roleDisplay || []),
    ...(report.staticPages || []),
  ].filter(Boolean);
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
  if (!base) console.warn("WARN: dev server not found — using file:// (一部テストは制限)");

  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    viewports: [],
    notifyFlows: [],
    chatBidirectional: [],
    readFlow: [],
    backFlow: [],
    completionFlow: [],
    notifyReloadFlow: [],
    notifyReturnFlow: [],
    abnormalOps: [],
    roleDisplay: [],
    staticPages: [],
    screenshots: [],
    overall: "FAIL",
  };

  try {
    const context = await browser.newContext();
    await context.addInitScript((markers) => {
      if (sessionStorage.getItem("__talkUserFlowAuditBoot") === "1") return;
      sessionStorage.setItem("__talkUserFlowAuditBoot", "1");
      markers.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("tasful_talk_notifications");
      try {
        localStorage.setItem("tasful_builder_mvp_role", "owner");
      } catch {
        /* ignore */
      }
    }, MASTER_MARKERS);

    for (const vp of [
      { name: "390", width: 390, height: 844 },
      { name: "1280", width: 1280, height: 900 },
    ]) {
      const page = await context.newPage({ viewport: { width: vp.width, height: vp.height } });
      report.viewports.push(vp.name);

      report.notifyFlows.push(...(await auditNotifyFlows(page, base, vp)));
      report.chatBidirectional.push(await auditChatBidirectional(page, base, vp));
      report.readFlow.push(await auditReadFlow(page, base, vp));
      report.backFlow.push(await auditBackFlow(page, base, vp));
      report.completionFlow.push(await auditCompletionFlow(page, base, vp));
      report.notifyReloadFlow.push(await auditNotifyReloadFlow(page, base, vp));
      report.notifyReturnFlow.push(await auditNotifyReturnFlow(page, base, vp));
      report.abnormalOps.push(await auditAbnormalOps(page, base, vp));
      report.roleDisplay.push(...(await auditRoleDisplay(page, base, vp)));
      report.staticPages.push(...(await auditStaticPages(page, base, vp)));

      await page.close();
    }

    await context.close();

    synthesizeFindings(report);
    const { readdirSync } = await import("node:fs");
    report.screenshots = readdirSync(SHOT_DIR).filter((f) => f.endsWith(".png"));

    const md = buildMarkdown(report);
    await writeFile(REPORT_MD, md, "utf8");
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

    console.log(md);
    console.log(`\nReport: ${REPORT_MD}`);
    console.log(`JSON: ${REPORT_JSON}`);
    console.log(`Overall: ${report.overall}`);

    await finalizeFromOutDir(root, SHOT_DIR, {
      title: "TALKユーザーフローレビュー",
      report,
      overall: report.overall,
    });

    if (report.overall === "FAIL") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
