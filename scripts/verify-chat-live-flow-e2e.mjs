#!/usr/bin/env node
/**
 * liveFlow=1 — 通知起点の実操作 E2E（求人 / スキル / 商品 / 業務サービス）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  runCategoryLiveFlowE2e,
  runJobLiveFlowE2e,
} from "./lib/live-flow-e2e.mjs";

const BASE = await requireDevServer();

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const issues = [];


  await runJobLiveFlowE2e(context, BASE, issues);
  await runCategoryLiveFlowE2e(context, BASE, "skill", issues);
  await runCategoryLiveFlowE2e(context, BASE, "product", issues);
  await runCategoryLiveFlowE2e(context, BASE, "business", issues);
});


if (issues.length) {
  console.error("verify-chat-live-flow-e2e FAILED:");
  issues.forEach((i) => console.error(" -", i));
  await closeAllBrowsers();
  process.exit(1);
}

console.log("verify-chat-live-flow-e2e OK");
console.log("flows: job, skill, product, business (liveFlow=1, 390px)");

await closeAllBrowsers();
