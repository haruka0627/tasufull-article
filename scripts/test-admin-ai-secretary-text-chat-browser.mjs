#!/usr/bin/env node
/**
 * AI秘書テキストチャット E2E（Phase2）
 *   node scripts/test-admin-ai-secretary-text-chat-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  const hashIdx = rel.indexOf("#");
  const filePart = hashIdx >= 0 ? rel.slice(0, hashIdx) : rel;
  const hash = hashIdx >= 0 ? rel.slice(hashIdx + 1) : "";
  const [pathOnly, query] = filePart.split("?");
  const url = pathToFileURL(path.join(root, pathOnly));
  if (query) url.search = `?${query}`;
  if (hash) url.hash = hash;
  return url.href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function testDashboardChat(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuAdminAiSecretaryPhase2?.sendMessage, null, {
    timeout: 15000,
  });

  const input = page.locator("[data-ops-secretary-input]").first();
  const send = page.locator("[data-ops-secretary-send]").first();
  const log = page.locator("[data-ops-phase2-chat-log]").first();

  if (!(await input.isVisible())) fail("dashboard chat input visible");
  pass("dashboard chat input visible");

  if (!(await send.isVisible())) fail("dashboard send button visible");
  pass("dashboard send button visible");

  await input.fill("こんにちは");
  await send.click();

  await page.waitForFunction(
    () => {
      const log = document.querySelector("[data-ops-phase2-chat-log]");
      return log && log.querySelectorAll(".ops-p2-chat__msg--assistant").length >= 1;
    },
    null,
    { timeout: 20000 }
  );

  const msgCount = await log.locator(".ops-p2-chat__msg").count();
  if (msgCount < 2) fail(`dashboard chat messages expected >=2 got ${msgCount}`);
  pass(`dashboard chat round-trip (${msgCount} messages)`);

  const hubAttached = await page.locator("#ops-ai-secretary [data-talk-ops-hub]").count();
  if (hubAttached < 1) fail("dashboard ops hub missing after chat");
  pass("dashboard ops hub intact");
}

async function testTalkOpsRoomChat(page) {
  await page.goto(pageUrl("talk-ops-room.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiSecretaryPhase2?.sendMessage, null, {
    timeout: 15000,
  });

  const input = page.locator("#talk-ops-text-chat-input");
  await input.fill("本日の優先対応は？");
  await page.locator(".talk-ops-text-chat__form [data-ops-secretary-send]").click();

  await page.waitForFunction(
    () =>
      document.querySelector(".talk-ops-text-chat__log .ops-p2-chat__msg--assistant")?.textContent
        ?.length > 0,
    null,
    { timeout: 20000 }
  );
  pass("talk-ops-room text chat reply");

  await page.locator("[data-talk-ops-command-input]").fill("未対応だけ見せて");
  await page.locator("[data-talk-ops-command-form] button[type=submit]").click();
  await page.waitForFunction(
    () => {
      const pre = document.querySelector("[data-talk-ops-command-result]");
      return pre && !pre.hidden && pre.textContent.trim().length > 0;
    },
    null,
    { timeout: 10000 }
  );
  pass("talk-ops-room command form still works");
}

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("tasu_admin_ai_secretary_chat_v1");
    } catch {
      /* ignore */
    }
  });
  await testDashboardChat(page);
  await testTalkOpsRoomChat(page);
  console.log("\nAll AI secretary text chat checks passed.");
});

await closeAllBrowsers();
