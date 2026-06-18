#!/usr/bin/env node
/**
 * job-0 求人フロー — 2窓390px 検証（Connectなし・やりとり開始通知含む）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  BUYER_ID,
  clickFeePayButton,
  collectFlowSnapshot,
  readFrameHref,
  waitFeePayComplete,
  waitFeePayReady,
  waitFrameUrl,
} from "./lib/bench-job-hire-e2e.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "job-0-bench-flow-390");
const BENCH_URL =
  `${BASE}/chat-dual-window-demo.html?benchPattern=job-0&demoProfile=job&demoConnect=0` +
  `&benchViewport=390&talkDev=1&review=chat-demo&liveFlow=1`;

const CHAT_STARTED_TITLE = "やりとりが開始されました";

fs.mkdirSync(OUT, { recursive: true });

async function pollUntil(page, timeoutMs, evaluateFn, args) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(evaluateFn, args)) return true;
    } catch {
      /* navigation */
    }
    await page.waitForTimeout(200);
  }
  return false;
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

const report = { benchUrl: BENCH_URL, steps: [], ok: false, message: "" };
const log = (step, data) => report.steps.push({ step, at: new Date().toISOString(), ...(data || {}) });

try {
  await page.goto(BENCH_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => {
      const a = document.getElementById("frame-a-notify");
      const b = document.getElementById("frame-b-chat");
      return Boolean(a?.src && b?.src && !String(a.src).includes("about:blank"));
    },
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(800);

  const normalized = await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    return {
      benchPattern: params.get("benchPattern"),
      demoConnect: params.get("demoConnect"),
      platformConnect: params.get("platform_connect"),
      patterns: (window.TasuPlatformChatLiveFlow?.getManualBenchPatterns?.() || [])
        .filter((p) => p.categoryId === "job")
        .map((p) => p.id),
    };
  });
  log("bench_normalized", normalized);
  if (normalized.benchPattern !== "job-0") throw new Error(`expected job-0, got ${normalized.benchPattern}`);
  if (normalized.demoConnect !== "0") throw new Error(`job must be demoConnect=0, got ${normalized.demoConnect}`);
  if (normalized.patterns.includes("job-1")) throw new Error("job-1 pattern must not exist");

  await page.screenshot({ path: path.join(OUT, "01-initial-390.png") });

  const applyResult = await page.evaluate(() => {
    const bWin = document.getElementById("frame-b-chat")?.contentWindow;
    const store = bWin?.TasuJobApplicationsStore || window.TasuJobApplicationsStore;
    const listing = store?.resolveListing?.("job_demo_full_001");
    if (!listing) return { ok: false, reason: "no_listing" };
    return store?.submitApplication?.(listing);
  });
  log("b_apply", applyResult);
  if (!applyResult?.ok && applyResult?.reason !== "already_applied") {
    throw new Error(`B apply failed: ${applyResult?.reason || "unknown"}`);
  }

  await page.evaluate(() => {
    window.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.("u_job_demo_full", {
      immediate: true,
      force: true,
    });
  });
  await page.waitForTimeout(600);

  const aApplyOk = await pollUntil(page, 6000, () => {
    const doc = document.getElementById("frame-a-notify")?.contentWindow?.document;
    return [...(doc?.querySelectorAll(".talk-notify-card__title") || [])].some((el) =>
      /応募/.test(String(el.textContent || ""))
    );
  });
  log("a_apply_notify", { ok: aApplyOk });
  if (!aApplyOk) throw new Error("A apply notify not visible within 6s");
  await page.screenshot({ path: path.join(OUT, "02-a-apply-notify-390.png") });

  await page.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false);
    const href = window.TasuPlatformChatLiveFlow?.managementPageUrl?.(profile, profile?.partnerAId);
    const el = document.getElementById("frame-a-chat");
    if (el && href) {
      const u = new URL(href, location.href);
      u.searchParams.set("benchEmbed", "1");
      u.searchParams.set("benchViewport", "390");
      u.searchParams.set("userId", profile.partnerAId);
      u.searchParams.set("benchRole", "poster");
      el.src = u.href;
    }
  });
  await waitFrameUrl(page, "frame-a-chat", /detail-job.*applications/i, 20000, "a_applications");
  await page.screenshot({ path: path.join(OUT, "03-a-applications-390.png") });

  const payNav = await page.evaluate(() => {
    const listing = window.TasuJobApplicationsStore?.resolveListing?.("job_demo_full_001");
    const app = window.TasuJobApplicationsStore?.listByJob?.("job_demo_full_001")?.[0];
    if (!listing || !app) return { ok: false, reason: "missing_app" };
    const result = window.TasuJobApplicationsStore?.beginJobChat?.("job_demo_full_001", app.application_id);
    if (!result?.ok || !result.payUrl) return { ok: false, reason: "begin_failed", result };
    const el = document.getElementById("frame-a-chat");
    if (el) {
      const u = new URL(result.payUrl, location.href);
      u.searchParams.set("benchEmbed", "1");
      u.searchParams.set("benchViewport", "390");
      u.searchParams.set("userId", "u_job_demo_full");
      u.searchParams.set("benchRole", "poster");
      el.src = u.href;
    }
    return { ok: true, payUrl: el?.src || result.payUrl };
  });
  log("a_proceed_fee", payNav);
  if (!payNav.ok) throw new Error(`beginJobChat failed: ${payNav.reason || "unknown"}`);
  await page.waitForTimeout(1200);

  const feeWait = await waitFeePayReady(page, 35000, "fee_pay");
  if (!feeWait.ok) throw new Error(feeWait.message || "fee pay not ready");
  await page.screenshot({ path: path.join(OUT, "04-a-fee-pay-390.png") });

  const payClick = await clickFeePayButton(page);
  if (!payClick.ok) throw new Error(`fee pay click failed: ${payClick.reason}`);
  const completeWait = await waitFeePayComplete(page, 20000, "fee_complete");
  if (!completeWait.ok) throw new Error(completeWait.message || "fee complete timeout");
  log("fee_pay", { ok: true });
  await page.screenshot({ path: path.join(OUT, "05-after-chat-start-390.png") });

  const storageRows = await page.evaluate(({ buyer, title }) => {
    const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    return all.filter(
      (n) =>
        String(n.recipientUserId) === buyer &&
        String(n.title || "").includes(title.slice(0, 6))
    );
  }, { buyer: BUYER_ID, title: CHAT_STARTED_TITLE });
  log("storage_chat_started", { count: storageRows.length });
  if (!storageRows.length) throw new Error("B storage missing やりとりが開始されました");

  await page.evaluate(() => {
    window.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.("u_hiro", {
      immediate: true,
      force: true,
    });
  });

  const bCardOk = await pollUntil(page, 6000, ({ title }) => {
    const doc = document.getElementById("frame-b-notify")?.contentWindow?.document;
    return [...(doc?.querySelectorAll(".talk-notify-card__title") || [])].some((el) =>
      String(el.textContent || "").includes(title.slice(0, 6))
    );
  }, { title: CHAT_STARTED_TITLE });
  if (!bCardOk) throw new Error("B notify card missing within 6s");
  await page.screenshot({ path: path.join(OUT, "06-b-chat-started-notify-390.png") });

  const bNotify = page.frames().find(
    (f) => /talk-home.*tab=notify/i.test(f.url()) && /u_hiro/i.test(f.url())
  );
  if (bNotify) {
    await bNotify.evaluate(() => {
      document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
    });
  }
  await waitFrameUrl(page, "frame-b-chat", /chat-detail\.html/i, 20000, "b_chat");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "07-b-chat-detail-390.png") });

  const composerOk = await pollUntil(page, 20000, () => {
    const doc = document.getElementById("frame-b-chat")?.contentWindow?.document;
    if (!doc) return false;
    const input = doc.querySelector("#chatInput, .chat-input");
    const send = doc.querySelector("#chatSend, .chat-send");
    return Boolean(input && send && !input.disabled);
  });
  log("b_composer", { ok: composerOk });
  if (!composerOk) throw new Error("B composer not ready");

  const jobEndUi = await page.evaluate(() => {
    const doc = document.getElementById("frame-a-chat")?.contentWindow?.document;
    const texts = [...(doc?.querySelectorAll("button") || [])].map((b) =>
      String(b.textContent || "").trim()
    );
    return {
      hasEndRequest: texts.some((t) => t.includes("終了を依頼")),
      hasGenericTradeComplete: texts.some((t) => t === "取引完了"),
      hasConnectPending: Boolean(doc?.querySelector("[data-connect-pending-card]")),
    };
  });
  log("job_end_ui", jobEndUi);

  report.ok = true;
  report.message = "PASS";
} catch (err) {
  report.ok = false;
  report.message = String(err?.message || err);
  report.snapshot = await collectFlowSnapshot(page).catch(() => null);
  await page.screenshot({ path: path.join(OUT, "99-failure-390.png") }).catch(() => null);
}

fs.writeFileSync(path.join(OUT, "verify-report.json"), JSON.stringify(report, null, 2));
});
console.log(JSON.stringify(report, null, 2));
await closeAllBrowsers();
process.exit(report.ok ? 0 : 1);
