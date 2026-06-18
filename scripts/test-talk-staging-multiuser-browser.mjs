#!/usr/bin/env node
/**
 * TASFUL TALK — ステージング複数ユーザー smoke
 *
 *   node scripts/test-talk-staging-multiuser-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { ensureTalkTestUsers } from "./lib/talk-rls-test-auth.mjs";
import {
  enableTalkDevMode,
  gotoTalkHome,
  signInTalkTestUser,
  talkHomeUrl,
} from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const USERS = ["u_me", "u_store", "u_worker"];
const MARKER = process.env.TALK_TEST_MARKER || `staging-multi-${Date.now()}`;

async function main() {
  await ensureTalkTestUsers(["u_admin", "u_me", "u_store", "u_worker"]);
  await withPlaywrightBrowser(async (browser) => {const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  
    const sender = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await enableTalkDevMode(sender);
    sender.on("dialog", (d) => d.accept());
    await gotoTalkHome(sender, BASE, "u_admin", "ai");
    await signInTalkTestUser(sender, "u_admin");
    await sender.reload({ waitUntil: "load" });
    await sender.waitForFunction(() => typeof window.TasuTalkRuntime !== "undefined", {
      timeout: 20000,
    });
    await sender.evaluate(() => {
      window.__TASU_TALK_SKIP_ACTION_CONFIRM = true;
    });
    await sender.waitForTimeout(1000);

    const fanoutOk = await sender.evaluate(async (marker) => {
      const recipients = [
        {
          userId: "u_me",
          notification: { type: "system", title: `fanout ${marker}`, body: marker, source: "staging" },
        },
        {
          userId: "u_store",
          notification: { type: "system", title: `fanout ${marker}`, body: marker, source: "staging" },
        },
        {
          userId: "u_worker",
          notification: { type: "system", title: `fanout ${marker}`, body: marker, source: "staging" },
        },
      ];
      return window.TasuTalkNotifications?.deliverToUsers?.(recipients);
    }, MARKER);

    if (!fanoutOk?.ok) fail(`fanout deliver (${fanoutOk?.reason || "unknown"})`);
    else pass(`fanout deliver mode=${fanoutOk.mode || "?"} count=${fanoutOk.delivered}`);

    for (const uid of USERS) {
      const page =
        uid === "u_me"
          ? sender
          : await browser.newPage({ viewport: { width: 390, height: 844 } });
      if (uid !== "u_me") {
        await enableTalkDevMode(page);
        page.on("dialog", (d) => d.accept());
        await gotoTalkHome(page, BASE, uid, "notify");
        await signInTalkTestUser(page, uid);
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => typeof window.TasuTalkRuntime !== "undefined", {
          timeout: 20000,
        });
        await page.waitForTimeout(1400);
      } else {
        await signInTalkTestUser(page, "u_me");
        await gotoTalkHome(page, BASE, "u_me", "notify");
        await page.waitForTimeout(1200);
      }

      const hasMarker = await page.evaluate((marker) => {
        const rows = window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false }) || [];
        return rows.some(
          (n) => String(n.body || "").includes(marker) || String(n.title || "").includes(marker)
        );
      }, MARKER);

      if (!hasMarker) fail(`${uid} sees fanout notification`);
      else pass(`${uid} sees fanout notification`);

      if (uid !== "u_me") await page.close();
    }

    await gotoTalkHome(sender, BASE, "u_store", "ai");
    await sender.waitForTimeout(800);
    await sender.locator('[data-talk-ai-mode="qa"]').click();
    await sender.locator("[data-talk-ai-input]").fill(`${MARKER}-store-ai`);
    await sender.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await sender.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    await sender.locator("[data-talk-ai-save]").click();
    await sender.waitForTimeout(600);

    const mePage = await browser.newPage();
    await gotoTalkHome(mePage, BASE, "u_me", "ai");
    await mePage.waitForTimeout(1200);
    const meHasStoreDraft = await mePage.evaluate((marker) => {
      const list = window.TasuTalkAiDrafts?.readAll?.() || [];
      return list.some((d) => String(d.input || "").includes(`${marker}-store-ai`));
    }, MARKER);
    if (meHasStoreDraft) fail("u_me must not see u_store AI draft locally");
    else pass("u_me isolated from u_store AI draft");
    await mePage.close();
    await sender.close();
    });
  

  console.log("\n---");
  if (errors.length) {
    console.error(`FAILED (${errors.length})`);
    errors.forEach((e) => console.error(`  - ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("Staging multi-user checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
