#!/usr/bin/env node
/**
 * 実画面NG状態の6項目診断
 * URL: worker-0, liveFlow=1, B=購入済み/確認待ち, A=空
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedWorkerBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const PARENT_URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "worker-notify-real-screen");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 900 } })
).newPage();

const parentMsgs = [];
page.on("console", (m) => {
  const t = m.text();
  if (/notify|bench|worker|refresh|filter/i.test(t)) parentMsgs.push(t);
});

const report = { at: new Date().toISOString(), checks: {}, ok: false };

try {
  await page.goto(PARENT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const bFrame = () => page.frames().find((f) => /detail-worker|buyer-wait/i.test(f.url()));
  let bf = bFrame();
  if (bf && /detail-worker/i.test(bf.url())) {
    await bf.locator("[data-listing-primary-cta]").first().click({ timeout: 8000 }).catch(() => {
      return bf.evaluate(() => document.querySelector("[data-listing-primary-cta]")?.click());
    });
    await page.waitForTimeout(5000);
  }

  report.parentUrl = await page.evaluate(() => location.href);
  report.steadyUrlMatch =
    report.parentUrl.includes("benchPattern=worker-0") &&
    !report.parentUrl.includes("liveFlowReset=1") &&
    !report.parentUrl.includes("benchReconcile=");

  report.checks[1] = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const hits = all.filter((n) => String(n.title || "").includes("依頼が届きました"));
    return {
      ok: hits.length > 0,
      total: all.length,
      hits: hits.map((n) => ({
        id: n.id,
        title: n.title,
        recipientUserId: n.recipientUserId,
        recipientRole: n.recipientRole,
        source: n.source,
        type: n.type,
        listingId: n.listingId,
      })),
    };
  });

  report.checks[2] = await page.evaluate(() => {
    const aSrc = document.getElementById("frame-a-notify")?.src || "";
    let aUserId = "";
    try {
      aUserId = new URL(aSrc).searchParams.get("userId") || "";
    } catch {
      /* ignore */
    }
    const hits = (JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]")).filter((n) =>
      String(n.title || "").includes("依頼が届きました")
    );
    const latest = hits[hits.length - 1] || null;
    return {
      ok: latest?.recipientUserId === aUserId && aUserId === "demo-worker-001",
      aUserId,
      recipientUserId: latest?.recipientUserId || "",
      hitCount: hits.length,
    };
  });

  report.checks[3] = { ...report.checks[2], label: "A上 notify iframe userId" };

  report.checks[4] = await page.evaluate(() => {
    const bSrc = document.getElementById("frame-b-chat")?.src || "";
    const onBuyerWait = /buyer-wait/i.test(bSrc);
    return { ok: onBuyerWait, bSrc: bSrc.slice(0, 140), onBuyerWait };
  });

  report.checks[5] = await page.evaluate(() => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    if (!aWin) return { ok: false, error: "no_a_window" };
    const rows =
      aWin.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
    const filtered =
      aWin.TasuTalkJobFullReviewMode?.filterJobFullReviewNotifications?.(rows) || rows;
    return {
      ok: rows.some((n) => String(n.title || "").includes("依頼が届きました")),
      rowCount: rows.length,
      filteredCount: filtered.length,
      titles: rows.map((n) => n.title),
      filteredTitles: filtered.map((n) => n.title),
      profileId: aWin.TasuPlatformChatDualWindowDemo?.getProfile?.()?.id || null,
      listenerReady: !!aWin.__benchNotifyMessageListenerReady,
    };
  });

  report.checks[6] = await page.evaluate(() => {
    const aWin = document.getElementById("frame-a-notify")?.contentWindow;
    if (!aWin) return { ok: false, error: "no_a_window" };
    const all = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const uid = new URL(document.getElementById("frame-a-notify").src).searchParams.get("userId");
    const Review = aWin.TasuTalkChatDemoReviewMode;
    const Live = aWin.TasuPlatformChatLiveFlow;
    const profile = aWin.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const target = all.find((n) => String(n.title || "").includes("依頼が届きました"));
    const diag = target
      ? {
          isRuntime: Live?.isRuntimeLiveFlowNotification?.(target),
          matchesProfile: Live?.notificationMatchesProfile?.(target, profile),
          isInitialContact: Review?.filterChatDemoReviewNotifications
            ? null
            : null,
          demoUserMatch: Review?.notificationMatchesDemoUser?.(target),
          initialContact: (() => {
            const src = String(target?.source || "").toLowerCase();
            const type = String(target?.type || "").toLowerCase();
            return Live?.isRuntimeLiveFlowNotification?.(target) && src === "platform" && type === "worker";
          })(),
        }
      : null;
    const filtered = Review?.filterChatDemoReviewNotifications?.(all) || all;
    const passed = filtered.filter((n) => String(n.title || "").includes("依頼が届きました"));
    const cards = [...aWin.document.querySelectorAll(".talk-notify-card")];
    const visible = cards.filter((c) => {
      const r = c.getBoundingClientRect();
      const st = aWin.getComputedStyle(c);
      return r.height > 8 && st.display !== "none" && st.visibility !== "hidden";
    });
    const emptyText = aWin.document.body?.textContent?.includes("該当する通知はありません");
    return {
      ok: visible.some((c) =>
        (c.querySelector(".talk-notify-card__title")?.textContent || "").includes("依頼が届きました")
      ),
      aUserId: uid,
      filterPassedCount: passed.length,
      visibleCardCount: visible.length,
      emptyText,
      diag,
      domTitles: visible.map((c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim()),
    };
  });

  report.checks[8] = report.checks[6];

  await page.locator("#frame-a-notify").screenshot({ path: path.join(OUT, "a-notify-real-screen.png") });
  await page.screenshot({ path: path.join(OUT, "full-bench-real-screen.png") });

  report.ok = report.checks[6]?.ok === true;
} catch (e) {
  report.error = String(e.message || e);
  report.ok = false;
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "diagnose-report.json"), JSON.stringify(report, null, 2));
console.log("\n=== WORKER NOTIFY REAL SCREEN DIAGNOSE ===");
for (const [k, v] of Object.entries(report.checks)) {
  console.log(`[${k}] ${v?.ok ? "OK" : "NG"}`, JSON.stringify(v).slice(0, 200));
}
console.log(`RESULT: ${report.ok ? "OK" : "NG (matches user report)"}`);
console.log(`Report: ${OUT}/diagnose-report.json`);
process.exit(report.ok ? 0 : 1);
