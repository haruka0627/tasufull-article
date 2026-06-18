#!/usr/bin/env node
/**
 * 固定URLのみ — worker 初回通知実画面検証
 * OK: B下CTA後 A上に「依頼が届きました」が視認できること
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  fixedWorkerBenchUrl,
  FIXED_WORKER_EXPECTED_NOTIFY_TITLE,
} from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "fixed-url-worker-notify");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 900 } })
).newPage();

const parentMsgs = [];
page.on("console", (msg) => {
  const t = msg.text();
  if (/Notify|bench|push|Worker|refresh/i.test(t)) parentMsgs.push(t);
});

const report = {
  at: new Date().toISOString(),
  url: URL,
  checks: {},
  ok: false,
  screenshots: {},
};

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);

  report.checks[1] = await page.evaluate((expectedPath) => {
    const u = new URL(location.href);
    const qs = u.search;
    const ok =
      u.pathname.endsWith("chat-dual-window-demo.html") &&
      qs.includes("talkDev=1") &&
      qs.includes("review=chat-demo") &&
      qs.includes("demoConnect=0") &&
      qs.includes("liveFlow=1") &&
      qs.includes("userId=u_hiro") &&
      qs.includes("benchViewport=390") &&
      qs.includes("benchPattern=worker-0") &&
      qs.includes("demoProfile=worker");
    return {
      ok,
      parentUrl: location.href,
      note: "親URL固定 — reset はページ内部で実行",
    };
  }, "");

  report.checks[2] = await page.evaluate(() => {
    const bSrc = document.getElementById("frame-b-chat")?.src || "";
    const aSrc = document.getElementById("frame-a-notify")?.src || "";
    let b = {};
    let a = {};
    try {
      b = Object.fromEntries(new URL(bSrc).searchParams);
    } catch {
      /* ignore */
    }
    try {
      a = Object.fromEntries(new URL(aSrc).searchParams);
    } catch {
      /* ignore */
    }
    return {
      ok:
        b.demoProfile === "worker" &&
        b.liveFlow === "1" &&
        b.userId === "u_hiro" &&
        b.benchEmbed === "1" &&
        a.demoProfile === "worker" &&
        a.liveFlow === "1" &&
        a.userId === "demo-worker-001",
      bSrc,
      aNotifySrc: aSrc,
      bParams: {
        demoProfile: b.demoProfile,
        liveFlow: b.liveFlow,
        userId: b.userId,
        benchEmbed: b.benchEmbed,
      },
      aParams: {
        demoProfile: a.demoProfile,
        liveFlow: a.liveFlow,
        userId: a.userId,
      },
    };
  });

  const notifyBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length
  );

  const bFrame = page.frames().find((f) => /detail-worker/i.test(f.url()));
  if (!bFrame) throw new Error("B detail-worker iframe not found");

  await bFrame.locator("[data-listing-primary-cta]").first().scrollIntoViewIfNeeded().catch(() => {});
  const ctaResult = await bFrame.evaluate(() => {
    const Gate = window.TasuPlatformChatFeeGateFlow;
    const store = window.TasuWorkerRequestsStore;
    const listing =
      window.__tasuDetailContactListing ||
      window.TasuListingDemoCatalog?.STORE_BY_ID?.["demo-worker-001"];
    const before = JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]").length;
    const btn = document.querySelector("[data-listing-primary-cta]");
    btn?.click();
    return { hasGate: !!Gate, hasStore: !!store, listingId: listing?.id, reqsBefore: before };
  });
  await page.waitForTimeout(4500);

  report.checks[3] = { ok: ctaResult.hasGate && ctaResult.hasStore, ...ctaResult };

  report.checks[4] = await page.evaluate(({ notifyBefore }) => {
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const delta = notifs.length - notifyBefore;
    const runtime = notifs.filter(
      (n) => String(n.source) === "platform" && String(n.type) === "worker"
    );
    const latest = runtime[runtime.length - 1] || null;
    return {
      ok: delta > 0 && !!latest,
      delta,
      latest: latest
        ? {
            title: latest.title,
            recipientUserId: latest.recipientUserId,
            listingId: latest.listingId,
          }
        : null,
    };
  }, { notifyBefore });

  report.checks[5] = await page.evaluate(() => {
    const aUserId = (() => {
      try {
        return new URL(document.getElementById("frame-a-notify").src).searchParams.get("userId");
      } catch {
        return "";
      }
    })();
    const latest = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]")
      .filter((n) => String(n.source) === "platform" && String(n.type) === "worker")
      .pop();
    return {
      ok: latest?.recipientUserId === aUserId && aUserId === "demo-worker-001",
      aUserId,
      recipientUserId: latest?.recipientUserId || "",
    };
  });

  report.checks[6] = await page.evaluate(() => {
    const reqs = JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]");
    return { ok: reqs.length > 0, workerRequestCount: reqs.length };
  });

  report.checks[7] = await page.evaluate(() => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    if (!aWin) return { ok: false, error: "no_a_notify_window" };
    const rows =
      aWin.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const hasRow = rows.some((n) => String(n.title || "").includes("依頼が届きました"));
    return {
      ok: hasRow,
      rowCount: rows.length,
      titles: rows.map((n) => n.title),
      listenerReady: !!aWin.__benchNotifyMessageListenerReady,
    };
  });

  const screenPath = path.join(OUT, "02-a-notify-screen-ok.png");
  const fullPath = path.join(OUT, "01-full-bench-after-cta.png");
  await page.locator("#frame-a-notify").screenshot({ path: screenPath });
  await page.screenshot({ path: fullPath, fullPage: false });
  report.screenshots = { aNotify: screenPath, fullBench: fullPath };

  report.checks[8] = await page.evaluate((expectedTitle) => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    if (!aWin) return { ok: false, visible: false, titles: [] };
    const cards = [...aWin.document.querySelectorAll(".talk-notify-card")];
    const visible = cards.filter((card) => {
      const r = card.getBoundingClientRect();
      const st = aWin.getComputedStyle(card);
      return (
        r.width > 8 &&
        r.height > 8 &&
        st.display !== "none" &&
        st.visibility !== "hidden" &&
        Number(st.opacity) > 0.05
      );
    });
    const titles = visible.map(
      (c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim() || ""
    );
    const ok = visible.some((c) => {
      const t = c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      return t.includes(expectedTitle);
    });
    return { ok, visibleCount: visible.length, titles };
  }, FIXED_WORKER_EXPECTED_NOTIFY_TITLE);

  report.ok = Object.values(report.checks).every((c) => c?.ok === true);
} catch (e) {
  report.error = String(e.message || e).split("\n")[0];
  report.ok = false;
} finally {
  await browser.close();
}

const reportPath = path.join(OUT, "verify-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log("\n=== FIXED URL WORKER NOTIFY ===");
console.log(`URL: ${URL}`);
for (const [k, v] of Object.entries(report.checks)) {
  console.log(`[${k}] ${v?.ok ? "OK" : "NG"}`, v?.error || "");
}
console.log(`\nRESULT: ${report.ok ? "SCREEN OK" : "SCREEN NG"}`);
if (report.screenshots?.aNotify) console.log(`Screenshot: ${report.screenshots.aNotify}`);
console.log(`Report: ${reportPath}`);
process.exit(report.ok ? 0 : 1);
