#!/usr/bin/env node
/**
 * job-0 — 550円後 B-notify「応募が承諾されました」6項目診断
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const HIRED_TITLE = "応募が承諾されました";
const BUYER_ID = "u_hiro";

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

page.on("dialog", async (d) => {
  await d.accept();
});

function findFrame(page, pattern) {
  if (typeof pattern === "function") {
    return page.frames().find(pattern);
  }
  return page.frames().find((f) => pattern.test(f.url()));
}

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);

  const bDetail = findFrame(page, /detail-job/i);
  if (bDetail) {
    await bDetail.evaluate(() => {
      document.querySelector("[data-listing-primary-cta], [data-job-apply]")?.click();
    });
    await page.waitForTimeout(4000);
  }

  let mgmt = findFrame(
    page,
    (f) => /detail-job/i.test(f.url()) && /benchManagement=1|view=applications|#applications/i.test(f.url())
  );
  if (!mgmt) {
    const aNotify = page.frame({ url: /talk-home.*tab=notify/ });
    if (aNotify) {
      await aNotify.evaluate(() => {
        document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
      });
      await page.waitForTimeout(4000);
    }
    mgmt = findFrame(
      page,
      (f) => /detail-job/i.test(f.url()) && /benchManagement=1|view=applications|#applications/i.test(f.url())
    );
  }

  if (mgmt) {
    await mgmt.evaluate(() => {
      document.querySelector("[data-job-app-proceed]")?.click();
    });
    await page.waitForTimeout(3500);
  }

  const hookNotifySpy = `(() => {
    const orig = window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant;
    if (typeof orig !== "function") return false;
    window.TasuTalkPlatformNotify.notifyJobHiredToApplicant = function (...args) {
      window.__job0NotifyHiredCalled = true;
      return orig.apply(this, args);
    };
    return true;
  })()`;

  await page.evaluate(hookNotifySpy);

  const aFee = findFrame(page, /platform-chat-fee-pay/i);
  let notifyCalled = false;
  if (aFee) {
    await aFee.evaluate(hookNotifySpy);
    await aFee.evaluate(() => {
      window.confirm = () => true;
      document.querySelector("[data-platform-fee-pay]")?.click();
    });
    await page.waitForTimeout(5000);
    notifyCalled =
      (await page.evaluate(() => window.__job0NotifyHiredCalled === true).catch(() => false)) ||
      (await aFee.evaluate(() => window.__job0NotifyHiredCalled === true).catch(() => false));
  }

  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.getElementById("frame-b-notify")?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(600);

  const report = await page.evaluate(
    ({ hiredTitle, buyerId }) => {
      let all = [];
      try {
        const raw = localStorage.getItem("tasful_talk_notifications");
        all = raw ? JSON.parse(raw) : [];
      } catch {
        all = window.TasuTalkNotifications?.getAll?.() || [];
      }
      const hired = (Array.isArray(all) ? all : []).filter(
        (n) =>
          String(n.recipientUserId) === buyerId &&
          String(n.title || "").includes(String(hiredTitle).slice(0, 6))
      );
      const row = hired[0] || null;
      const bNotifySrc = document.getElementById("frame-b-notify")?.src || "";
      const directBCount = (() => {
        try {
          const raw = localStorage.getItem("tasful_talk_notifications");
          const all = raw ? JSON.parse(raw) : [];
          return (Array.isArray(all) ? all : []).filter((n) => String(n.recipientUserId) === buyerId).length;
        } catch {
          return 0;
        }
      })();
      let bIframeCardCount = 0;
      let bIframeEmpty = null;
      try {
        const doc = document.getElementById("frame-b-notify")?.contentWindow?.document;
        bIframeCardCount = doc?.querySelectorAll?.(".talk-notify-card")?.length || 0;
        bIframeEmpty = Boolean(doc?.querySelector?.(".talk-notify-empty-state__title"));
      } catch {
        bIframeEmpty = null;
      }
      let bDiag = null;
      try {
        bDiag = document.getElementById("frame-b-notify")?.contentWindow?.__tasuBenchNotifyRenderDiag || null;
      } catch {
        bDiag = null;
      }
      const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
      const hireThread = threads.find((t) => String(t.threadKind) === "job_hire");
      return {
        check1_notifyJobHiredToApplicantCalled: window.__job0NotifyHiredCalled === true,
        check2_recipientUserId: row?.recipientUserId || null,
        check2_ok: String(row?.recipientUserId) === buyerId,
        check3_title: row?.title || null,
        check3_ok: String(row?.title || "").includes(hiredTitle.slice(0, 6)),
        check4_href: row?.href || row?.targetUrl || null,
        check4_ok: /chat-detail\.html/i.test(String(row?.href || row?.targetUrl || "")),
        check4_threadMatch: hireThread?.id
          ? String(row?.href || "").includes(String(hireThread.id))
          : false,
        check5_bNotifyIframeUserId: (() => {
          try {
            return new URL(bNotifySrc, location.href).searchParams.get("userId");
          } catch {
            return null;
          }
        })(),
        check5_ok: (() => {
          try {
            return new URL(bNotifySrc, location.href).searchParams.get("userId") === buyerId;
          } catch {
            return false;
          }
        })(),
        check6_rowsLength: bDiag?.rowsLength ?? null,
        check6_domCardCount: bDiag?.domCardCount ?? null,
        check6_domEmpty: bDiag?.domEmpty ?? null,
        check6_domNeedsRender: bDiag?.domNeedsRender ?? null,
        check6_domTitle: bDiag?.domVisibleCardTitle || bDiag?.domEmptyText || "",
        check6_ok:
          Number(bDiag?.rowsLength) >= 1 &&
          Number(bDiag?.domCardCount) >= 1 &&
          bDiag?.domEmpty !== true &&
          String(bDiag?.domVisibleCardTitle || "").includes("応募が承諾"),
        check6_domTitles: bDiag?.recipientTitles || [],
        bNotifySrc,
        hireThreadId: hireThread?.id || null,
        storageHiredCount: hired.length,
        aOnChat: /chat-detail\.html/i.test(document.getElementById("frame-a-chat")?.src || ""),
        bOnChat: /chat-detail\.html/i.test(document.getElementById("frame-b-chat")?.src || ""),
        compareDirectBCount: directBCount,
        compareIframeBCardCount: bIframeCardCount,
        compareIframeBEmpty: bIframeEmpty,
        compareVerdict:
          directBCount < 1
            ? "通知生成バグ"
            : bIframeCardCount >= 1 && !bIframeEmpty
              ? "OK（本番UI）"
              : "talk-home描画/UIバグ",
      };
    },
    { hiredTitle: HIRED_TITLE, buyerId: BUYER_ID }
  );

  report.check1_notifyJobHiredToApplicantCalled =
    notifyCalled ||
    report.check1_notifyJobHiredToApplicantCalled ||
    report.storageHiredCount >= 1;
  report.ok =
    report.check1_notifyJobHiredToApplicantCalled &&
    report.check2_ok &&
    report.check3_ok &&
    report.check4_ok &&
    report.check5_ok &&
    report.check6_ok &&
    report.check6_domCardCount >= 1 &&
    report.check6_domEmpty !== true &&
    report.aOnChat &&
    report.bOnChat;

  console.log(JSON.stringify(report, null, 2));
  await closeAllBrowsers();
  process.exit(report.ok ? 0 : 1);
} catch (err) {
  console.error(err);
  await closeAllBrowsers();
  process.exit(1);
}
});

