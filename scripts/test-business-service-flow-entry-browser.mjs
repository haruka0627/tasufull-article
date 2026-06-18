#!/usr/bin/env node
/**
 * Step1: 業務詳細 CTA → business-service-flow（chat-detail + deal）
 *
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-business-service-flow-entry-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DEMO_ID = process.env.BSD_DEMO_ID || "business-demo-other-001";

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  console.log(`\n業務詳細 CTA 入口統一 Step1 — ${BASE}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/detail-business-service.html?id=${encodeURIComponent(DEMO_ID)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 25000 }
  );

  const beforeDeals = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("tasu_service_deals") || "[]").length;
    } catch {
      return 0;
    }
  });

  const estimateBtn = page.locator("[data-business-service-estimate]").first();
  if ((await estimateBtn.count()) === 0) {
    fail("見積もりCTAが存在する");
  } else {
    pass("見積もりCTAが存在する");
  }

  await estimateBtn.click();

  try {
    await page.waitForURL(/chat-detail\.html/, { timeout: 15000 });
    const url = page.url();
    const u = new URL(url);
    const roomId = u.searchParams.get("roomId") || u.searchParams.get("room") || "";
    const deal = u.searchParams.get("deal") || "";
    const thread = u.searchParams.get("thread") || "";

    if (thread && !roomId) {
      fail("chat-detail へ遷移（tasful 相談スレッドではない）", url);
    } else if (!roomId) {
      fail("roomId クエリがある", url);
    } else {
      pass("chat-detail へ遷移", roomId);
    }

    if (deal) {
      pass("deal クエリがある", deal);
    } else {
      fail("deal クエリがある", url);
    }

    const afterDeals = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tasu_service_deals") || "[]");
      } catch {
        return [];
      }
    });
    if (afterDeals.length > beforeDeals) {
      const latest = afterDeals[0];
      if (latest?.status === "consulting" && latest?.chat_id) {
        pass("service_deals に consulting + chat_id", `${latest.id}`);
      } else {
        fail("service_deals consulting/chat_id", JSON.stringify(latest));
      }
    } else {
      fail("service_deals が増える", `before=${beforeDeals} after=${afterDeals.length}`);
    }

    const threadsLen = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]").length;
      } catch {
        return 0;
      }
    });
    if (threadsLen === 0 || !thread) {
      pass("tasful_chat_threads 経由ではない");
    } else {
      fail("tasful_chat_threads 経由ではない", `threads=${threadsLen}`);
    }
  } catch (err) {
    fail("chat-detail へ遷移", String(err.message || err));
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
