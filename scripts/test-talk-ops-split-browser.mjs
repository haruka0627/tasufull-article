#!/usr/bin/env node
/**
 * 利用者TALK / 運営TALK 分離（兄弟構成: talk-home + audience）
 *   node scripts/test-talk-ops-split-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

const OPS_TALK_URL =
  "talk-home.html?audience=admin_ops&tab=chat&talkAdmin=1";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  
    console.log("\n--- user TALK (390px) ---");
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForFunction(() => typeof window.TasuTalkNotifications?.getAllForUser === "function");
    await mobile.waitForSelector(".talk-line-list__item", { timeout: 15000 });

    const userTalk = await mobile.evaluate(() => {
      const listText = document.querySelector(".talk-line-list")?.textContent || "";
      const ops = window.TasuTalkNotifications.getAllForOps();
      const user = window.TasuTalkNotifications.getAllForUser();
      return {
        audience: window.TasuTalkData?.getTalkAudience?.(),
        hasAiSecretaryInList: /AI運営秘書|AI秘書/.test(listText),
        opsCount: ops.length,
        userHasOpsWatch: user.some((n) => String(n.source || "").toLowerCase() === "ops_watch"),
        supportHref: window.TasuTalkData?.resolveChatTalkHref?.(
          window.TasuTalkData?.getStaticChatHubCards?.().find((c) => c.id === "talk-hub-support") || {}
        ),
      };
    });
    if (userTalk.audience !== "user") fail(`user TALK audience (${userTalk.audience})`);
    else pass("user TALK audience=user");
    if (userTalk.hasAiSecretaryInList) fail("user TALK list shows AI secretary");
    else pass("user TALK list no AI secretary");
    if (userTalk.userHasOpsWatch) fail("user notifications include ops_watch");
    else pass("user notifications exclude ops_watch");
    if (!userTalk.supportHref?.includes("#thread=talk-hub-support")) {
      fail(`support href should open inline room (${userTalk.supportHref})`);
    } else pass("TASFULサポート → inline support room");

    console.log("\n--- ops TALK (390px, talk-home) ---");
    await mobile.goto(
      buildLocalPageUrl(base, "talk-home.html", "?audience=admin_ops&tab=chat&talkAdmin=1"),
      {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForFunction(
      () => window.TasuTalkData?.isAdminOpsTalkAudience?.() === true,
      null,
      { timeout: 10000 }
    );
    await mobile.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    const opsTalk390 = await mobile.evaluate(() => {
      const ids = [...document.querySelectorAll(".talk-line-list__item")].map((el) =>
        el.getAttribute("data-talk-thread-id")
      );
      const cards = window.TasuTalkData?.getStaticChatHubCards?.() || [];
      return {
        audience: window.TasuTalkData?.getTalkAudience?.(),
        ids,
        cardCount: cards.length,
        hasAiRoom: ids.includes("talk-ops-operations-room"),
        hasOpsWatch: ids.includes("talk-hub-ops-watch"),
        hasInquiry: ids.includes("talk-hub-ops-inquiry"),
        hasConnect: ids.includes("talk-hub-ops-connect"),
        hasPayment: ids.includes("talk-hub-ops-payment"),
        hasAnpi: ids.includes("talk-hub-ops-anpi"),
        hasMarketplace: ids.includes("talk-hub-ops-marketplace"),
        customOpsLayout: Boolean(document.querySelector("[data-ops-talk-item]")),
      };
    });
    if (opsTalk390.audience !== "admin_ops") fail(`ops TALK audience (${opsTalk390.audience})`);
    else pass("ops TALK audience=admin_ops");
    if (opsTalk390.customOpsLayout) fail("ops TALK still uses custom layout");
    else pass("ops TALK uses talk-home list UI");
    const requiredRooms = [
      ["AI秘書", opsTalk390.hasAiRoom],
      ["OPS WATCH", opsTalk390.hasOpsWatch],
      ["問い合わせ", opsTalk390.hasInquiry],
      ["Connect", opsTalk390.hasConnect],
      ["決済", opsTalk390.hasPayment],
      ["安否", opsTalk390.hasAnpi],
      ["Marketplace", opsTalk390.hasMarketplace],
    ];
    requiredRooms.forEach(([label, ok]) => {
      if (!ok) fail(`ops TALK missing room: ${label}`);
      else pass(`ops TALK shows ${label}`);
    });
    if (opsTalk390.cardCount !== 7) fail(`ops hub cards (${opsTalk390.cardCount})`);
    else pass("ops TALK 7 hub cards");

    console.log("\n--- ops-talk.html redirect ---");
    await mobile.goto(buildLocalPageUrl(base, "ops-talk.html", "?talkAdmin=1"), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForFunction(
      () => window.TasuTalkData?.isAdminOpsTalkAudience?.() === true,
      null,
      { timeout: 10000 }
    );
    const redirected = await mobile.evaluate(() => ({
      href: location.href,
      hasTalkHomeList: Boolean(document.querySelector(".talk-line-list__item")),
    }));
    if (!redirected.href.includes("audience=admin_ops")) fail("ops-talk.html redirect missing audience");
    else pass("ops-talk.html → talk-home?audience=admin_ops");
    if (!redirected.hasTalkHomeList) fail("redirect target has no talk-home list");
    else pass("redirect lands on talk-home chat list");

    console.log("\n--- ops TALK AI room inline (PC) ---");
    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(
      buildLocalPageUrl(
        base,
        "talk-home.html",
        "?audience=admin_ops&tab=chat&talkAdmin=1&thread=talk-ops-operations-room"
      ),
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await pc.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 15000 });
    const opsPc = await pc.evaluate(() => ({
      composerHidden: document.querySelector("[data-talk-line-composer]")?.hidden === true,
      peerName: document.querySelector("[data-talk-line-peer-name]")?.textContent?.trim() || "",
      messageCount: document.querySelectorAll("[data-talk-line-messages] .chat-msg, [data-talk-line-messages] .chat-msg--ops-summary").length,
    }));
    if (!opsPc.composerHidden) fail("AI秘書 room composer visible");
    else pass("AI秘書 room composer hidden");
    if (!/AI秘書/.test(opsPc.peerName)) fail(`AI秘書 room header (${opsPc.peerName})`);
    else pass("AI秘書 room opens inline");
    if (opsPc.messageCount < 1) fail("AI秘書 room has no messages");
    else pass(`AI秘書 room messages (${opsPc.messageCount})`);

    const intakeStatus = await fetch(`${base}/support-intake.html`).then((r) => r.status);
    if (intakeStatus !== 200) fail(`support-intake HTTP ${intakeStatus}`);
    else pass("support-intake.html HTTP 200");

    await mobile.close();
    await pc.close();

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length})`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All talk ops split checks passed.");
    }
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
