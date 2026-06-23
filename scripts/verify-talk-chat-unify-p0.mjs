#!/usr/bin/env node
/**
 * TASFUL TALK 統合 P0 検証
 *   node scripts/verify-talk-chat-unify-p0.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");

const results = [];
function pass(id, detail = "") {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}${detail ? `: ${detail}` : ""}`);
}
function fail(id, detail = "") {
  results.push({ id, ok: false, detail });
  console.error(`  FAIL  ${id}${detail ? `: ${detail}` : ""}`);
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

/** talk-home / talk-home.html（Pages の .html 除去後も一致） */
function isTalkChatHubUrl(url) {
  return /talk-home(?:\.html)?/i.test(String(url || "")) && /tab=chat/.test(String(url || ""));
}

async function collectConsoleErrors(page) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  const onPageError = (e) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    errors,
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

async function main() {
  console.log(`\nTALK chat unify P0 — ${BASE}\n`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const consoleProbe = await collectConsoleErrors(page);

    try {
      // P0-T01 redirect
      await page.goto(`${BASE}/chat-list.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      const url1 = page.url();
      if (isTalkChatHubUrl(url1)) {
        pass("P0-T01", url1.replace(BASE, ""));
      } else {
        fail("P0-T01", url1);
      }

      // P0-T02 thread query preserved
      await page.goto(`${BASE}/chat-list.html?thread=chat-demo-test-001`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const url2 = page.url();
      if (isTalkChatHubUrl(url2) && /thread=chat-demo-test-001/.test(url2)) {
        pass("P0-T02", url2.replace(BASE, ""));
      } else {
        fail("P0-T02", url2);
      }

      // P0-T03 dashboard link（pages.dev は member-auth ガードあり）
      await page.addInitScript(() => {
        try {
          localStorage.setItem(
            "tasu_member_session",
            JSON.stringify({ id: "u_me", email: "p0-verify@tasful.local", signedInAt: Date.now() })
          );
        } catch {
          /* ignore */
        }
      });
      await page.goto(`${BASE}/dashboard.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      const dashChat = page.locator('a.dash-sp-nav__chip[href*="talk-home"][href*="tab=chat"]');
      if ((await dashChat.count()) > 0) pass("P0-T03", "dashboard → TALK");
      else fail("P0-T03", "missing talk-home chip");

      // P0-T04 chat-detail back
      await page.goto(`${BASE}/chat-detail.html?thread=chat-demo-test-001`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const backHref = await page.locator('a.chat-pill[href*="talk-home"]').first().getAttribute("href");
      if (backHref && /talk-home(?:\.html)?/.test(backHref) && /tab=chat/.test(backHref)) {
        pass("P0-T04", backHref);
      } else {
        fail("P0-T04", backHref || "no back link");
      }

      // P0-T05 no legacy chat-list link on talk-home
      await page.goto(`${BASE}/talk-home.html?tab=chat&talkDev=1`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const legacyCount = await page.locator('a[href="chat-list.html"]').count();
      if (legacyCount === 0) pass("P0-T05", "legacy link removed");
      else fail("P0-T05", `found ${legacyCount}`);

      // P0-T06 notify CTA job apply (platform label)
      await page.addScriptTag({ url: `${BASE}/platform-notify-action-labels.js` });
      const applyLabel = await page.evaluate(() =>
        window.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.({
          title: "この求人に応募がありました",
          href: "detail-job.html#applications",
        })
      );
      if (applyLabel === "応募者を確認する") pass("P0-T06", applyLabel);
      else fail("P0-T06", String(applyLabel));

      // P0-T07 hired → TALK label
      const hiredLabel = await page.evaluate(() =>
        window.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.({
          title: "応募が承諾されました",
        })
      );
      if (hiredLabel === "TALKを開く") pass("P0-T07", hiredLabel);
      else fail("P0-T07", String(hiredLabel));

      // P0-T08 purchase notify → case label
      const purchaseLabel = await page.evaluate(() =>
        window.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.({
          title: "スキルが購入されました",
        })
      );
      if (purchaseLabel === "購入を確認する") pass("P0-T08", purchaseLabel);
      else fail("P0-T08", String(purchaseLabel));

      // P0-T09 breadcrumb config (source file check via fetch)
      const bcRes = await page.goto(`${BASE}/breadcrumb-config.js`, { waitUntil: "domcontentloaded" });
      const bcText = await bcRes?.text();
      if (bcText?.includes('"chat-list.html": "TASFUL TALK"')) pass("P0-T09", "breadcrumb label");
      else fail("P0-T09", "breadcrumb-config not updated");

      // P0-T10 console errors on key pages @ 1280
      const viewports = [
        { name: "1280", width: 1280, height: 900 },
        { name: "768", width: 768, height: 1024 },
        { name: "390", width: 390, height: 844 },
      ];
      const pagesToCheck = [
        "talk-home.html?tab=chat&talkDev=1",
        "dashboard.html",
        "chat-detail.html?thread=chat-demo-test-001",
      ];
      let consoleOk = true;
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        for (const p of pagesToCheck) {
          consoleProbe.errors.length = 0;
          await page.goto(`${BASE}/${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(400);
          if (consoleProbe.errors.length) {
            consoleOk = false;
            fail("P0-T10", `${vp.name}px ${p}: ${consoleProbe.errors.join(" | ")}`);
          }
        }
      }
      if (consoleOk) pass("P0-T10", "390/768/1280 — console error 0");
    } catch (err) {
      fail("EXCEPTION", err instanceof Error ? err.message : String(err));
    } finally {
      consoleProbe.detach();
    }
  });

  const ng = results.filter((r) => !r.ok);
  const verdict = ng.length === 0 ? "TALK_CHAT_UNIFY_P0_READY" : "TALK_CHAT_UNIFY_P0_BLOCKED";
  console.log(`\n--- ${results.length - ng.length}/${results.length} PASS — ${verdict} ---\n`);
  if (ng.length) process.exitCode = 1;
  return { results, verdict };
}

const out = await main();
await closeAllBrowsers();
export default out;
