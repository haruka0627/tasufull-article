/**
 * プラット料金ルール統一 — 求人550円 / 他5% / Connect完了通知
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-fee-rules";
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

const NON_JOB_CASES = [
  { id: "skill", url: `${BASE_URL}/detail-skill.html?id=demo-skill-001`, cta: ".cta-consult" },
  {
    id: "product",
    url: `${BASE_URL}/detail-product.html?id=demo-product-001`,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--secondary",
  },
  {
    id: "worker",
    url: `${BASE_URL}/detail-worker.html?id=demo-worker-001`,
    cta: "[data-listing-primary-cta], .cta-consult",
  },
  {
    id: "business",
    url: `${BASE_URL}/detail-business-service.html?id=demo-business-service-001&platform_connect=0`,
    cta: "[data-business-service-consult], [data-biz-detail-inquiry]",
  },
  {
    id: "shop",
    url: `${BASE_URL}/detail-shop.html?id=demo-shop-reworks`,
    cta: "[data-shop-mobile-inquiry-dock] .shop-mobile-inquiry-dock__btn, [data-biz-detail-inquiry]",
  },
];

async function waitListing(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.querySelector("[data-shop-product-layout]:not([hidden])"),
    { timeout: 45000 }
  );
  await page.waitForTimeout(700);
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const report = {};

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  // 10-11. 通知タブ + TALK
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT_DIR, "01-notify-tab-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, "02-talk-official-tasful-390.png") });

  const notifyAudit = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const prepay = list.find((n) => String(n.title || "").includes("手数料が必要"));
    const complete = list.find((n) => n.title === "取引が完了しました");
    const talkCards =
      window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful")?.filter(
        (m) => m.kind === "notify_card"
      ) || [];
    return {
      prepay: prepay
        ? { title: prepay.title, actionLabel: prepay.actionLabel, body: prepay.body, href: prepay.href }
        : null,
      complete: complete
        ? { title: complete.title, actionLabel: complete.actionLabel, href: complete.href }
        : null,
      talkCardCount: talkCards.length,
    };
  });
  report.notifyAudit = notifyAudit;

  if (!notifyAudit.prepay?.actionLabel?.includes("確認")) errors.push("prepay 確認する missing");
  if (notifyAudit.prepay?.body) errors.push("prepay body should be empty");
  if (!notifyAudit.complete?.href || notifyAudit.complete.href === "#") errors.push("complete href missing");
  if (notifyAudit.complete?.href?.includes("deal-detail.html")) {
    errors.push(`complete href should be chat, got ${notifyAudit.complete.href}`);
  }
  if (notifyAudit.talkCardCount < 1) errors.push("TALK notify cards missing");

  // 9. Connectあり完了通知
  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, "03-connect-complete-notify-390.png") });

  // 4-8. Connectなし 各カテゴリ
  const categoryResults = [];
  for (const spec of NON_JOB_CASES) {
    const p = await context.newPage();
    p.on("dialog", async (d) => d.accept());
    const row = { id: spec.id, ok: false, errors: [] };
    try {
      if (spec.id === "worker") {
        await p.goto(`${spec.url}&talkDev=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await waitListing(p);
        const workerFee = await p.evaluate(() => {
          const Fee = window.TasuPlatformChatFee;
          const listing =
            window.__tasuDetailContactListing || { id: "demo-worker-001", listing_type: "worker" };
          const gate = Fee?.shouldGateChatStart?.(listing);
          const amount = Fee?.calcPreChatFee?.(listing);
          const reqStore = window.TasuWorkerRequestsStore;
          if (!reqStore?.commitAccept) {
            return { gate, amount, acceptHref: "", threadId: "", feeAmount: null };
          }
          const workerId = listing.id || "demo-worker-001";
          let pending = (reqStore.readAll?.() || []).find(
            (r) => String(r.worker_id) === String(workerId) && r.status === "requested"
          );
          if (!pending && reqStore.submitRequest) {
            reqStore.submitRequest(listing);
            pending = (reqStore.readAll?.() || []).find(
              (r) => String(r.worker_id) === String(workerId) && r.status === "requested"
            );
          }
          if (!pending) {
            return { gate, amount, acceptHref: "", threadId: "", feeAmount: null, reason: "no_request" };
          }
          const res = reqStore.commitAccept(workerId, pending.request_id);
          const tid = res?.threadId || res?.thread?.id;
          const fees = JSON.parse(localStorage.getItem("tasful_platform_chat_fees_v1") || "[]");
          const feeRow = fees.find((f) => String(f.threadId) === String(tid));
          const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
          const n = notifs.find((x) => x.source === "platform_fee_v1" && String(x.threadId) === String(tid));
          return {
            gate,
            amount,
            acceptHref: n?.href || "",
            threadId: tid,
            feeAmount: feeRow?.feeAmount,
          };
        });
        row.workerFee = workerFee;
        if (!workerFee.gate) row.errors.push("worker should gate");
        if (!workerFee.amount || workerFee.amount < 550) row.errors.push(`worker fee ${workerFee.amount}`);
        if (!workerFee.acceptHref?.includes("platform-chat-fee-pay")) {
          row.errors.push(`worker fee notify href: ${workerFee.acceptHref}`);
        }
        row.ok = row.errors.length === 0;
      } else if (spec.id === "business" || spec.id === "shop") {
        await p.goto(`${spec.url}${spec.url.includes("?") ? "&" : "?"}talkDev=1`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await waitListing(p);
        const apiResult = await p.evaluate((kind) => {
          const Fee = window.TasuPlatformChatFee;
          const listing =
            window.__tasuDetailContactListing ||
            window.__tasuListingDetail || {
              id: kind === "business" ? "demo-business-service-001" : "demo-shop-reworks",
              listing_type: kind === "business" ? "business_service" : "shop_store",
            };
          const gate = Fee?.shouldGateChatStart?.(listing);
          const amount = Fee?.calcPreChatFee?.(listing);
          const store = window.TasuChatThreadStore;
          const created = store?.createOrOpenThread?.(listing, { intent: "consult", feePending: true });
          const tid = created?.thread?.id || "";
          Fee?.ensurePendingFee?.(listing, created?.thread, {});
          const payHref =
            Fee?.buildFeePayUrl?.({
              threadId: tid,
              listingId: listing.id,
              category: Fee.resolveCategoryKey(listing),
              listing,
              thread: created?.thread,
            }) || "";
          return { gate, amount, payHref, threadId: tid, threadStatus: created?.thread?.status };
        }, spec.id);
        row.apiResult = apiResult;
        if (!apiResult?.gate) row.errors.push(`${spec.id} should gate`);
        if (!apiResult?.amount || apiResult.amount < 550) row.errors.push(`${spec.id} fee ${apiResult?.amount}`);
        if (!apiResult?.payHref?.includes("platform-chat-fee-pay")) {
          row.errors.push(`${spec.id} pay href: ${apiResult?.payHref}`);
        }
        if (apiResult?.threadStatus !== "fee_pending") {
          row.errors.push(`${spec.id} thread status ${apiResult?.threadStatus}`);
        }
        row.ok = row.errors.length === 0;
      } else {
        await p.goto(`${spec.url}${spec.url.includes("?") ? "&" : "?"}talkDev=1`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await waitListing(p);
        const route = await p.evaluate(() => {
          const listing = window.__tasuDetailContactListing || window.__tasuListingDetail;
          const Fee = window.TasuPlatformChatFee;
          const store = window.TasuChatThreadStore;
          const created = store?.createOrOpenThread?.(listing, { intent: "consult", feePending: true });
          const tid = created?.thread?.id || "";
          Fee?.ensurePendingFee?.(listing, created?.thread, {});
          const payUrl = Fee?.buildFeePayUrl?.({
            threadId: tid,
            listingId: listing?.id,
            category: Fee?.resolveCategoryKey?.(listing),
            listing,
            thread: created?.thread,
          });
          return {
            gate: Fee?.shouldGateChatStart?.(listing),
            amount: Fee?.calcPreChatFee?.(listing),
            payUrl,
            threadStatus: created?.thread?.status,
            threadId: tid,
          };
        });
        row.route = route;
        if (!route?.gate) row.errors.push(`${spec.id} should gate`);
        if (!route?.payUrl?.includes("platform-chat-fee-pay")) row.errors.push(`${spec.id} payUrl missing`);
        if (route?.threadStatus !== "fee_pending") row.errors.push(`${spec.id} status ${route?.threadStatus}`);
        if (spec.id === "skill") {
          await p.goto(`${BASE_URL}/${String(route.payUrl).replace(/^\//, "")}`, {
            waitUntil: "domcontentloaded",
          });
          await p.waitForTimeout(500);
          await p.screenshot({ path: path.join(OUT_DIR, "04-nonjob-fee-pay-skill-390.png") });
        }
        row.ok = row.errors.length === 0;
        row.feeAmount = route?.amount ? `¥${route.amount}` : "";
      }
    } catch (err) {
      row.errors.push(String(err?.message || err));
    } finally {
      await p.close();
    }
    categoryResults.push(row);
    if (!row.ok) errors.push(`${spec.id} connect-none route: ${row.errors.join("; ")}`);
  }
  report.categoryResults = categoryResults;

  // 1-3. 求人応募通知 + 550円 + 完了請求なし
  const jobPage = await context.newPage();
  jobPage.on("dialog", async (d) => d.accept());

  await jobPage.goto(
    `${BASE_URL}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1#applications`,
    { waitUntil: "domcontentloaded" }
  );
  await waitListing(jobPage);
  await jobPage.waitForFunction(
    () => {
      window.TasuJobDetailApplications?.refresh?.(
        window.__tasuDetailContactListing || window.__tasuDetailFavoriteListing
      );
      const section = document.querySelector("[data-job-applications-section]");
      return section && !section.hidden;
    },
    { timeout: 45000 }
  );
  await jobPage.screenshot({ path: path.join(OUT_DIR, "05-job-applications-390.png") });

  const jobRules = await jobPage.evaluate((jobId) => {
    const Fee = window.TasuPlatformChatFee;
    const listing = { listing_type: "job", id: jobId };
    return {
      gate: Fee?.shouldGateChatStart?.(listing),
      connect: Fee?.hasStripeConnect?.(listing, "job"),
      completion: Fee?.shouldNotifyOnCompletion?.(listing),
      flatFee: Fee?.calcJobChatFee?.(),
      jobPrepay: Fee?.calcPreChatFee?.(listing),
    };
  }, JOB_ID);
  report.jobRules = jobRules;

  if (!jobRules.gate) errors.push("job should gate chat start (550)");
  if (jobRules.connect) errors.push("job should not use Connect");
  if (jobRules.completion) errors.push("job should not notify completion fee");
  if (jobRules.flatFee !== 550) errors.push(`job flat fee expected 550, got ${jobRules.flatFee}`);
  if (jobRules.jobPrepay !== 550) errors.push(`job prepay expected 550, got ${jobRules.jobPrepay}`);

  const jobFlow = await jobPage.evaluate((jobId) => {
    const store = window.TasuJobApplicationsStore;
    const Fee = window.TasuPlatformChatFee;
    const app = store?.listByJob?.(jobId)?.find((a) => a.status === "applied");
    if (!app) return { ok: false, reason: "no_applied" };
    const begin = store.beginJobChat?.(jobId, app.application_id);
    if (!begin?.ok || !begin.threadId) return { ok: false, reason: begin?.reason || "begin_failed", begin };
    const threadsBefore = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const rowBefore = threadsBefore.find((t) => String(t.id) === String(begin.threadId));
    Fee?.markFeePaid?.(begin.threadId, {
      listingId: jobId,
      category: "job",
      feeAmount: begin.feeAmount || 550,
    });
    const activated = Fee?.activateThreadAfterPayment?.(begin.threadId);
    const threadsAfter = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const rowAfter = threadsAfter.find((t) => String(t.id) === String(begin.threadId));
    const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
    const apps = JSON.parse(localStorage.getItem("tasful_job_applications_v1") || "[]");
    const selected = apps.find((a) => String(a.application_id) === String(app.application_id));
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const activatedNotify = notifs.some(
      (n) => n.feePhase === "chat_activated" && String(n.threadId) === String(begin.threadId)
    );
    return {
      ok: Boolean(activated?.ok),
      begin,
      rowBeforeStatus: rowBefore?.status || "",
      rowAfterStatus: rowAfter?.status || "",
      msgCount: (msgs[begin.threadId] || []).length,
      appStatus: selected?.status || "",
      activatedNotify,
      payUrl: begin.payUrl,
      activated,
    };
  }, JOB_ID);
  report.jobFlow = jobFlow;
  if (!jobFlow?.ok) errors.push(`job flow: ${jobFlow?.reason || jobFlow?.activated?.reason || "failed"}`);
  if (jobFlow?.rowBeforeStatus !== "fee_pending") {
    errors.push(`job thread before pay: ${jobFlow?.rowBeforeStatus}`);
  }
  if (jobFlow?.rowAfterStatus !== "open") errors.push(`job thread after pay: ${jobFlow?.rowAfterStatus}`);
  if ((jobFlow?.msgCount || 0) < 1) errors.push("job messages not seeded");
  if (jobFlow?.appStatus !== "selected") errors.push(`job app status: ${jobFlow?.appStatus}`);
  if (!jobFlow?.activatedNotify) errors.push("job chat_activated notify missing");

  await jobPage.goto(`${BASE_URL}/${String(jobFlow?.payUrl || "").replace(/^\//, "")}`, {
    waitUntil: "domcontentloaded",
  });
  await jobPage.waitForTimeout(800);

  const jobPayUi = await jobPage.evaluate(() => ({
    amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim(),
    rate: document.querySelector("[data-platform-fee-rate]")?.textContent?.trim(),
    category: document.querySelector("[data-platform-fee-category]")?.textContent?.trim(),
    threadStatus: (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tid = params.get("thread");
        const raw = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
        const row = Array.isArray(raw) ? raw.find((t) => String(t.id) === tid) : null;
        return row?.status || "";
      } catch {
        return "";
      }
    })(),
  }));
  report.jobPayUi = jobPayUi;
  await jobPage.screenshot({ path: path.join(OUT_DIR, "06-job-fee-pay-550-390.png") });

  if (!jobPayUi.amount?.includes("550")) errors.push(`job pay amount: ${jobPayUi.amount}`);
  if (!jobPayUi.rate?.includes("550")) errors.push(`job pay rate label: ${jobPayUi.rate}`);
  if (jobPayUi.category !== "求人") errors.push(`job pay category: ${jobPayUi.category}`);

  const jobThreadId = jobFlow?.begin?.threadId || jobFlow?.begin?.threadId || "";
  await jobPage.goto(`${BASE_URL}/chat-list.html?thread=${encodeURIComponent(jobThreadId)}`, {
    waitUntil: "domcontentloaded",
  });
  await jobPage.waitForTimeout(600);
  await jobPage.screenshot({ path: path.join(OUT_DIR, "07-job-chat-after-pay-390.png") });

  // 12. スキル支払い後チャット（代表）
  const skillPage = await context.newPage();
  skillPage.on("dialog", async (d) => d.accept());
  await skillPage.goto(`${BASE_URL}/detail-skill.html?id=demo-skill-001&talkDev=1`, {
    waitUntil: "domcontentloaded",
  });
  await waitListing(skillPage);
  const skillFlow = await skillPage.evaluate(() => {
    const Fee = window.TasuPlatformChatFee;
    const listing = window.__tasuDetailContactListing || { id: "demo-skill-001", listing_type: "skill" };
    const store = window.TasuChatThreadStore;
    const created = store?.createOrOpenThread?.(listing, { intent: "consult", feePending: true });
    const tid = created?.thread?.id || "";
    const before = created?.thread?.status || "";
    Fee?.ensurePendingFee?.(listing, created?.thread, {});
    Fee?.markFeePaid?.(tid, { listingId: listing.id, category: "skill", feeAmount: Fee.calcPreChatFee(listing) });
    const activated = Fee?.activateThreadAfterPayment?.(tid);
    const after = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]").find(
      (t) => String(t.id) === tid
    );
    const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
    return {
      before,
      afterStatus: after?.status || "",
      msgCount: (msgs[tid] || []).length,
      activatedOk: Boolean(activated?.ok),
      threadId: tid,
    };
  });
  report.skillAfterPay = skillFlow;
  if (skillFlow.before !== "fee_pending") errors.push(`skill before pay: ${skillFlow.before}`);
  if (skillFlow.afterStatus !== "open") errors.push(`skill after pay: ${skillFlow.afterStatus}`);
  if (!skillFlow.activatedOk) errors.push("skill activate failed");
  await skillPage.goto(
    `${BASE_URL}/chat-list.html?thread=${encodeURIComponent(skillFlow.threadId || "")}`,
    { waitUntil: "domcontentloaded" }
  );
  await skillPage.screenshot({ path: path.join(OUT_DIR, "08-skill-chat-after-pay-390.png") });
  await skillPage.close();

  await jobPage.close();
    });

  report.errors = errors;
  report.screenshots = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  console.log(JSON.stringify(report, null, 2));

  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("ALL OK — platform fee rules verified");
}

await run();
