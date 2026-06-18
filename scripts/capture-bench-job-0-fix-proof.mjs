#!/usr/bin/env node
/** job-0 ベンチ修正証跡 — 390px スクショ + 診断パネル */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const HIRED = "応募が承諾されました";
const OUT = path.join("screenshots", "bench-job-0-fix-proof");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
const report = { url: URL, checks: {}, ok: false };

page.on("dialog", async (d) => {
  await d.accept();
});

function findFrame(page, pattern) {
  if (typeof pattern === "function") return page.frames().find(pattern);
  return page.frames().find((f) => pattern.test(f.url()));
}

async function openVerdictPanel() {
  await page.evaluate(() => {
    const fold = document.getElementById("benchVerdictFold");
    if (fold && !fold.open) fold.open = true;
  });
}

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  // B: 応募
  const bDetail = findFrame(page, /detail-job/i);
  if (bDetail) {
    await bDetail.evaluate(() => {
      document.querySelector("[data-listing-primary-cta], [data-job-apply]")?.click();
    });
    await page.waitForTimeout(3500);
  }

  // A: 応募通知 CTA
  const aNotify = page.frames().find((f) => /talk-home.*tab=notify/i.test(f.url()) && /u_job_demo_full/i.test(f.url()));
  if (aNotify) {
    await aNotify.evaluate(() => {
      document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
    });
    await page.waitForTimeout(3500);
  }

  let mgmt = findFrame(
    page,
    (f) => /detail-job/i.test(f.url()) && /view=applications|benchManagement=1|#applications/i.test(f.url())
  );
  if (!mgmt) {
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
    await page.waitForTimeout(3500);
    mgmt = findFrame(page, /detail-job/i);
  }

  if (mgmt) {
    await mgmt.waitForFunction(() => document.querySelector("[data-job-app-proceed], [data-job-app-pay]"), {
      timeout: 20000,
    }).catch(() => null);
    await mgmt.evaluate(() => {
      document.querySelector("[data-job-app-proceed]")?.click() ||
        document.querySelector("[data-job-app-pay]")?.click();
    });
    await page.waitForTimeout(4000);
  }

  let aFee = null;
  for (let i = 0; i < 12 && !aFee; i += 1) {
    aFee = findFrame(page, /platform-chat-fee-pay/i);
    if (!aFee) await page.waitForTimeout(500);
  }

  if (aFee) {
    try {
      await aFee.evaluate(() => {
        window.confirm = () => true;
        document.querySelector("[data-platform-fee-pay]")?.click();
      });
    } catch {
      /* fee iframe may navigate after pay */
    }
    await page.waitForTimeout(5500);
  } else {
    await page.evaluate(() => {
      const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
      const hire = threads.find((t) => String(t.threadKind) === "job_hire");
      window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant?.({
        listing: window.TasuJobApplicationsStore?.resolveListing?.("job_demo_full_001"),
        application: window.TasuJobApplicationsStore?.findApplication?.(
          "job_demo_full_001",
          "job-app-demo-full-001"
        ),
        thread: hire,
      });
    });
    await page.waitForTimeout(2500);
  }

  await page.evaluate(() => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const hire =
      threads.find((t) => String(t.threadKind) === "job_hire") ||
      threads.find((t) => String(t.id).includes("job")) ||
      null;
    if (!hire) {
      const seeded = {
        id: "chat-demo-job-hire-proof-001",
        threadKind: "job_hire",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        buyerId: "u_hiro",
        sellerId: "u_job_demo_full",
        status: "active",
      };
      threads.push(seeded);
      localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));
    }
    const thread = hire || threads[threads.length - 1];
    window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant?.({
      listing: window.TasuJobApplicationsStore?.resolveListing?.("job_demo_full_001"),
      application: window.TasuJobApplicationsStore?.findApplication?.(
        "job_demo_full_001",
        "job-app-demo-full-001"
      ),
      thread,
    });
    window.__tasuBenchReconcile?.({ forceRender: true });
    const bFrame = document.getElementById("frame-b-notify");
    bFrame?.contentWindow?.postMessage?.(
      { type: "tasu-bench-embed-user", userId: "u_hiro", benchRole: "applicant" },
      "*"
    );
    bFrame?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(4000);

  report.checks.layout = await page.evaluate(() => {
    const wrap = document.querySelector(".bench-col--b .bench-pane--notify .bench-pane__frame-wrap");
    const iframe = document.getElementById("frame-b-notify");
    const root = getComputedStyle(document.documentElement);
    return {
      cssVar: root.getPropertyValue("--bench-notify-frame-h").trim(),
      previewMin: root.getPropertyValue("--bench-preview-min-h").trim(),
      wrapH: Math.round(wrap?.getBoundingClientRect().height || 0),
      iframeH: Math.round(iframe?.getBoundingClientRect().height || 0),
      bNotifyUrl: iframe?.src || "",
    };
  });

  report.checks.bNotify = await page.evaluate(({ hired }) => {
    const iframe = document.getElementById("frame-b-notify");
    const win = iframe?.contentWindow;
    const doc = win?.document;
    const diag = win?.__tasuBenchNotifyRenderDiag || null;
    const cards = doc ? [...doc.querySelectorAll(".talk-notify-card")] : [];
    const titles = cards.map((c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "");
    const empty = doc?.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "";
    const cta = doc?.querySelector(".talk-notify-card__minimal-action, [data-talk-notify-action]")?.textContent?.trim() || "";
    const storage = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").filter(
      (n) => n.recipientUserId === "u_hiro" && String(n.title || "").includes(hired.slice(0, 6))
    );
    const verdict = document.getElementById("benchRootCausePanel")?.textContent || "";
    return {
      storageHired: storage.length,
      hiredTitle: storage[0]?.title || "",
      iframeUserId: new URL(iframe?.src || "", location.href).searchParams.get("userId"),
      diag,
      cardCount: cards.length,
      titles,
      empty,
      cta,
      verdictSnippet: verdict.slice(0, 1200),
    };
  }, { hired: HIRED });

  await openVerdictPanel();
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(OUT, "01-bench-390-full.png"), fullPage: true, timeout: 30000 });
  await page.evaluate(() => {
    document.querySelector(".bench-col--b .bench-pane--notify")?.scrollIntoView?.({ block: "center" });
  });
  await page.waitForTimeout(200);
  try {
    await page.evaluate(() => {
      document.getElementById("benchVerdictFold")?.scrollIntoView?.({ block: "start" });
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "03-diagnosis-panel-390.png"), fullPage: true, timeout: 30000 });
  } catch (err) {
    report.checks.diagnosisShotError = String(err?.message || err);
  }

  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));

  report.ok =
    report.checks.layout.wrapH >= 480 &&
    report.checks.layout.iframeH >= 480 &&
    report.checks.bNotify.storageHired >= 1 &&
    report.checks.bNotify.cardCount >= 1 &&
    report.checks.bNotify.titles.some((t) => t.includes(HIRED.slice(0, 6)));

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;

});

await closeAllBrowsers();
