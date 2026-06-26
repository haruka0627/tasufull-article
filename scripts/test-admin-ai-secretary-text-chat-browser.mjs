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
  throw new Error(msg);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /favicon|ERR_BLOCKED_BY_CLIENT|CORS|ERR_FAILED|serper-search|\/api\/secretary-deepseek-chat|supabase\.co|Failed to load resource/i.test(
    t
  );
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function testDashboardChat(page) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    const msg = String(err.message || err);
    if (!isIgnorableConsoleError(msg)) consoleErrors.push(msg);
  });

  await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      window.TasuSecretaryDeepSeekAdapter?.completeTurn &&
      window.TasuAdminAiSecretaryPhase2?.sendMessage &&
      window.TasuSecretaryOpsContextBuilder?.build,
    null,
    { timeout: 15000 }
  );
  pass("DeepSeek adapter script loaded");

  await page.evaluate(() => {
    const Adapter = window.TasuSecretaryDeepSeekAdapter;
    if (!Adapter || Adapter.__regressionHooked) return;
    Adapter.__regressionHooked = true;
    Adapter.postSecretaryEdge = async () => ({
      ok: true,
      reply: "regression mock reply",
      modelLabel: "DeepSeek",
      httpStatus: 200,
      configured: true,
      data: { usedDeepSeek: true },
    });
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

  const badConsole = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  if (badConsole.length) fail(`console errors: ${badConsole.slice(0, 2).join(" | ")}`);
  pass("dashboard chat console clean");
}

async function testTalkOpsRoomChat(page) {
  await page.evaluate(() => {
    const Adapter = window.TasuSecretaryDeepSeekAdapter;
    if (Adapter && !Adapter.__regressionHooked) {
      Adapter.__regressionHooked = true;
      Adapter.postSecretaryEdge = async () => ({
        ok: true,
        reply: "talk ops mock reply",
        modelLabel: "DeepSeek",
        httpStatus: 200,
        configured: true,
        data: { usedDeepSeek: true },
      });
    }
  });
  await page.goto(pageUrl("talk-ops-room.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.TasuSecretaryDeepSeekAdapter?.completeTurn &&
      window.TasuAdminAiSecretaryPhase2?.sendMessage &&
      window.TasuSecretaryOpsContextBuilder?.build,
    null,
    { timeout: 15000 }
  );

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
  try {
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
  } catch (err) {
    console.error(String(err?.message || err));
    process.exitCode = 1;
  }
});

await closeAllBrowsers();
if (process.exitCode) process.exit(process.exitCode);
