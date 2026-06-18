#!/usr/bin/env node
/**
 * general-demo-002 を tasful_listings に seed（最新デモ内容で upsert）
 *
 *   node scripts/seed-general-demo-002.mjs
 *   BASE_URL=http://localhost:5180 node scripts/seed-general-demo-002.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const STORAGE_KEY = "tasful_listings";
const DEMO_ID = "general-demo-002";

async function main() {
  console.log(`\nseed general-demo-002 — ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE}/detail-general.html`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const result = await page.evaluate(({ key, demoId }) => {
      const store = window.TasuListingLocalStore;
      if (store?.refreshGeneralDemo) {
        const record = store.refreshGeneralDemo();
        return { ok: true, mode: "refresh", record };
      }
      if (store?.seedGeneralDemoIfMissing) {
        const record = store.seedGeneralDemoIfMissing();
        return { ok: true, mode: "store", record };
      }
      return { ok: false, error: "TasuListingLocalStore unavailable" };
    }, { key: STORAGE_KEY, demoId: DEMO_ID });

    if (!result.ok) {
      console.error("  NG  seed failed:", result.error || "unknown");
      process.exitCode = 1;
      return;
    }

    console.log(`  OK  mode=${result.mode} id=${result.record?.id}`);
    console.log(`  OK  title=${result.record?.title}`);
    console.log(`  OK  source=${result.record?.source}`);
  } catch (err) {
    console.error("  NG ", err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  console.log("");
}

main();
