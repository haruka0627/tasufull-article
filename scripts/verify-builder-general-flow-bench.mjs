#!/usr/bin/env node
/**
 * Builder 一般案件フロー — partner_user / user_user / vendor_user 2窓ベンチ検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const FLOWS = ["partner_user", "user_user", "vendor_user"];
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(120000);

for (const flow of FLOWS) {
  const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${flow}&benchViewport=390`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#builderBenchGeneralRow", { timeout: 60000 });

  record(`${flow} toolbar`, (await page.locator("#builderBenchGeneralRow").count()) > 0);

  const cycle = await page.evaluate(async () => {
    const bench = window.TasuBuilderGeneralFlowBench;
    if (!bench?.runFullCycle) return { ok: false, error: "no_bench" };
    return bench.runFullCycle();
  });

  record(`${flow} full cycle`, cycle?.ok === true, cycle?.error || "");

  const diag = cycle?.diag || {};
  const state = cycle?.state || {};
  const checks = [
    ["application_notification_created", diag.application_notification_created],
    ["chat_started", diag.chat_started],
    ["thread_created", diag.thread_created],
    ["message_notification_created", diag.message_notification_created],
    ["attachment_visible", diag.attachment_visible],
    ["completion_submitted_notification_created", diag.completion_submitted_notification_created],
    ["completion_approved_notification_created", diag.completion_approved_notification_created],
    ["completion_notification_created", diag.completion_notification_created],
    ["review_notification_created", diag.review_notification_created],
    ["review_submitted", diag.review_submitted],
    ["thread_exists_after_complete", diag.thread_exists_after_complete],
  ];
  for (const [name, val] of checks) {
    record(`${flow} ${name}`, val === true);
  }

  const persist = await page.evaluate((tid) => {
    const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const thread = mvp.threads?.[tid];
    return {
      threadType: thread?.thread_type || thread?.threadType,
      status: thread?.status,
      review: thread?.review_submission?.status,
      msgCount: (thread?.messages || []).length,
      exists: Boolean(thread),
    };
  }, state.threadId || "");

  record(`${flow} threadType preserved`, Boolean(persist.threadType));
  record(`${flow} thread remains`, persist.exists === true && persist.status === "completed");
  record(`${flow} messages`, persist.msgCount >= 2, String(persist.msgCount));
  record(`${flow} review saved`, persist.review === "submitted");
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("All general flow bench checks passed");
