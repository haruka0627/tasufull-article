#!/usr/bin/env node
/**
 * TASFUL AI compact panel — talk-home + chat-detail
 *   node scripts/test-talk-tasful-ai-sheet-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

const FRIEND_THREAD_ID = "talk-mock-friend-001";

async function openTalkHomeRoom(page) {
  await page.waitForSelector(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`, {
    timeout: 15000,
  });
  await page.click(`[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`);
  await page.waitForFunction(
    () => document.querySelector(".talk-line-split")?.classList.contains("talk-line-split--room-open"),
    { timeout: 10000 }
  );
  await page.waitForSelector("[data-talk-tasful-ai-open]", { state: "visible", timeout: 10000 });
}

async function assertIconOnlyAiBtn(page, contextLabel) {
  return page.evaluate((label) => {
    const btn =
      label === "chat-detail"
        ? document.getElementById("chatAiBtn")
        : document.querySelector("[data-talk-tasful-ai-open]");
    if (!btn) return { ok: false, reason: "missing btn" };
    const cs = getComputedStyle(btn);
    const rect = btn.getBoundingClientRect();
    const borderW = Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0);
    const bg = cs.backgroundColor || "";
    const transparentBg =
      bg === "transparent" || bg === "rgba(0, 0, 0, 0)" || (bg.startsWith("rgba") && bg.includes(", 0)"));
    return {
      ok:
        !btn.querySelector(".talk-tasful-ai-btn__label") &&
        !!btn.querySelector(".talk-tasful-ai-btn__icon") &&
        btn.getAttribute("aria-label") === "TASFUL AIを開く" &&
        rect.width >= 32 &&
        rect.width <= 36 &&
        rect.height >= 32 &&
        rect.height <= 36 &&
        borderW < 0.5 &&
        transparentBg,
      width: rect.width,
    };
  }, contextLabel);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    console.log("\n--- talk-home (390px) ---");
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await mobile.waitForFunction(() => typeof window.TasuTalkTasfulAiSheet?.open === "function");
    await mobile.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await openTalkHomeRoom(mobile);

    const mobileLayout = await mobile.evaluate(() => {
      const toolbar = document.querySelector(".talk-line-composer__toolbar");
      if (!toolbar) return { ok: false };
      const kids = [...toolbar.children];
      const attachIdx = kids.findIndex((el) => el.matches("[data-talk-line-action='attach']"));
      const aiIdx = kids.findIndex((el) => el.matches("[data-talk-tasful-ai-open]"));
      const inputIdx = kids.findIndex((el) => el.querySelector("[data-talk-line-composer-input]") != null);
      const sendIdx = kids.findIndex((el) => el.matches("[data-talk-line-composer-send]"));
      const aiBtn = kids[aiIdx];
      const aiRect = aiBtn?.getBoundingClientRect();
      const sendRect = kids[sendIdx]?.getBoundingClientRect();
      return {
        ok: attachIdx >= 0 && aiIdx > attachIdx && inputIdx > aiIdx && sendIdx > inputIdx && sendIdx - aiIdx > 1,
        separatedFromSend: aiRect && sendRect ? sendRect.left - aiRect.right > 40 : false,
      };
    });
    if (!mobileLayout.ok) fail("talk-home composer order (attach / AI / input / send)");
    else pass("talk-home composer order (attach / AI / input / send)");
    if (!mobileLayout.separatedFromSend) fail("talk-home AI separated from send");
    else pass("talk-home AI separated from send");

    const mobileIcon = await assertIconOnlyAiBtn(mobile, "talk-home");
    if (!mobileIcon.ok) fail(`talk-home 390px icon-only AI (${JSON.stringify(mobileIcon)})`);
    else pass("talk-home 390px icon-only AI");

    await mobile.click("[data-talk-tasful-ai-open]");
    await mobile.waitForTimeout(200);

    const sheetMobile = await mobile.evaluate(() => {
      const sheet = document.querySelector("[data-talk-tasful-ai-sheet]");
      const panel = document.querySelector(".talk-tasful-ai-sheet__panel");
      const title = document.getElementById("talkTasfulAiSheetTitle")?.textContent?.trim();
      const greeting = document.querySelector(".talk-tasful-ai-sheet__greeting")?.textContent?.trim();
      const avatar = document.querySelector(".talk-tasful-ai-sheet__avatar");
      const input = document.querySelector("[data-talk-tasful-ai-input]");
      const send = document.querySelector("[data-talk-tasful-ai-send]");
      const bodyText = sheet?.textContent || "";
      const menuHits = ["返信を提案", "話題を提案", "要約する", "ムード分析", "文章作成", "翻訳"].filter((label) =>
        bodyText.includes(label)
      );
      const tabbar = document.querySelector("[data-talk-mobile-tabbar]");
      const tabbarHidden =
        tabbar &&
        getComputedStyle(tabbar).opacity === "0" &&
        getComputedStyle(tabbar).pointerEvents === "none";
      const toast = document.querySelector("[data-talk-tasful-ai-toast]");
      const toastCs = toast ? getComputedStyle(toast) : null;
      const toastRect = toast?.getBoundingClientRect();
      const toastPeek =
        toast &&
        toastCs &&
        toastCs.visibility !== "hidden" &&
        Number(toastCs.opacity) > 0.01 &&
        toastRect &&
        toastRect.height > 0 &&
        toastRect.bottom > window.innerHeight - 4;
      const avatarRect = avatar?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      return {
        open: sheet && !sheet.hidden && sheet.classList.contains("talk-tasful-ai-sheet--mobile"),
        version: sheet?.dataset?.tasfulAiSheetVersion,
        title,
        greeting,
        hasInput: !!input,
        hasSend: send?.textContent?.trim() === "送信",
        menuHits,
        noLegacyMenu: !document.querySelector("[data-talk-tasful-ai-action]"),
        tabbarHidden,
        noToastPeek: !toastPeek,
        avatarOk: avatar && avatarRect && avatarRect.width >= 24 && avatarRect.width <= 32,
        panelHeight: panelRect?.height || 999,
        noHeaderMark: !document.querySelector(".talk-tasful-ai-sheet__header-mark"),
      };
    });

    if (!sheetMobile.open) fail("talk-home opens mobile compact sheet");
    else pass("talk-home opens mobile compact sheet");
    if (!sheetMobile.noToastPeek) fail("talk-home no bottom toast peek");
    else pass("talk-home no bottom toast peek");
    if (sheetMobile.version !== "6") fail(`talk-home sheet DOM version (${sheetMobile.version})`);
    else pass("talk-home sheet DOM v6 compact");
    if (sheetMobile.title !== "TASFUL AI") fail("talk-home header title");
    else pass("talk-home header title TASFUL AI");
    if (sheetMobile.greeting !== "こんにちは、何を手伝いますか？") fail(`talk-home greeting (${sheetMobile.greeting})`);
    else pass("talk-home greeting");
    if (!sheetMobile.hasInput || !sheetMobile.hasSend) fail("talk-home input + send");
    else pass("talk-home input + send");
    if (sheetMobile.menuHits.length) fail(`talk-home menu labels present (${sheetMobile.menuHits.join(", ")})`);
    else pass("talk-home no menu labels");
    if (!sheetMobile.noLegacyMenu) fail("talk-home no legacy action buttons");
    else pass("talk-home no legacy action buttons");
    if (!sheetMobile.tabbarHidden) fail("talk-home bottom nav hidden while sheet open");
    else pass("talk-home bottom nav hidden while sheet open");
    if (!sheetMobile.avatarOk) fail("talk-home subtle avatar");
    else pass("talk-home subtle avatar");
    if (!sheetMobile.noHeaderMark) fail("talk-home no header mark");
    else pass("talk-home no header mark");
    if (sheetMobile.panelHeight > 280) fail(`talk-home compact panel height (${sheetMobile.panelHeight}px)`);
    else pass("talk-home compact panel height");

    await mobile.fill("[data-talk-tasful-ai-input]", "テストメッセージ");
    await mobile.click("[data-talk-tasful-ai-send]");
    await mobile.waitForTimeout(400);
    const submitMobile = await mobile.evaluate(() => {
      const raw = localStorage.getItem("tasu_talk_tasful_ai_runs_v1");
      const toast = document.querySelector("[data-talk-tasful-ai-toast]");
      let entry = null;
      try {
        entry = raw ? JSON.parse(raw)[0] : null;
      } catch {
        entry = null;
      }
      return {
        sheetClosed: document.querySelector("[data-talk-tasful-ai-sheet]")?.hidden === true,
        saved: entry?.text === "テストメッセージ" && entry?.source === "talk-compact",
        toastText: toast?.textContent?.trim(),
        toastVisible: toast?.classList.contains("is-visible"),
      };
    });
    if (!submitMobile.saved) fail("talk-home localStorage dummy save");
    else pass("talk-home localStorage dummy save");
    if (!submitMobile.sheetClosed) fail("talk-home sheet closes after send");
    else pass("talk-home sheet closes after send");
    if (!submitMobile.toastVisible || !submitMobile.toastText?.includes("TASFUL AIに送信しました")) {
      fail(`talk-home send toast (${submitMobile.toastText})`);
    } else pass("talk-home send toast");

    console.log("\n--- talk-home (PC) ---");
    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await pc.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    await openTalkHomeRoom(pc);
    const pcIcon = await assertIconOnlyAiBtn(pc, "talk-home");
    if (!pcIcon.ok) fail(`talk-home PC icon-only AI (${JSON.stringify(pcIcon)})`);
    else pass("talk-home PC icon-only AI");
    await pc.click("[data-talk-tasful-ai-open]");
    await pc.waitForTimeout(200);
    const sheetPc = await pc.evaluate(() => {
      const sheet = document.querySelector("[data-talk-tasful-ai-sheet]");
      const panel = document.querySelector(".talk-tasful-ai-sheet__panel");
      const bodyText = sheet?.textContent || "";
      const menuHits = ["返信を提案", "話題を提案", "要約する"].filter((label) => bodyText.includes(label));
      const toast = document.querySelector("[data-talk-tasful-ai-toast]");
      const toastCs = toast ? getComputedStyle(toast) : null;
      const toastPeek =
        toast && toastCs && toastCs.visibility !== "hidden" && Number(toastCs.opacity) > 0.01;
      return {
        open: sheet && !sheet.hidden && sheet.classList.contains("talk-tasful-ai-sheet--desktop"),
        menuHits,
        hasGreeting: document.querySelector(".talk-tasful-ai-sheet__greeting") != null,
        hasInput: !!document.querySelector("[data-talk-tasful-ai-input]"),
        panelHeight: panel?.getBoundingClientRect().height || 999,
        noToastPeek: !toastPeek,
      };
    });
    if (!sheetPc.open) fail("talk-home PC modal layout");
    else pass("talk-home PC modal layout");
    if (sheetPc.menuHits.length) fail(`talk-home PC menu labels (${sheetPc.menuHits.join(", ")})`);
    else pass("talk-home PC no menu labels");
    if (!sheetPc.hasGreeting || !sheetPc.hasInput) fail("talk-home PC compact UI");
    else pass("talk-home PC compact UI");
    if (sheetPc.panelHeight > 320) fail(`talk-home PC compact panel (${sheetPc.panelHeight}px)`);
    else pass("talk-home PC compact panel");
    if (!sheetPc.noToastPeek) fail("talk-home PC no toast peek");
    else pass("talk-home PC no toast peek");
    await pc.keyboard.press("Escape");
    await pc.waitForTimeout(150);
    if (!(await pc.evaluate(() => document.querySelector("[data-talk-tasful-ai-sheet]")?.hidden)))
      fail("talk-home ESC closes sheet");
    else pass("talk-home ESC closes sheet");

    console.log("\n--- chat-detail (390px) ---");
    await mobile.goto(
      buildLocalPageUrl(
        base,
        "chat-detail.html",
        "?thread=chat-demo-skill-deal-001&userId=u_me&talkDev=1&review=chat-demo"
      ),
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await mobile.waitForFunction(() => typeof window.TasuTalkTasfulAiSheet?.open === "function");
    await mobile.waitForSelector("#chatAiBtn", { timeout: 45000 });
    const chatMobileIcon = await assertIconOnlyAiBtn(mobile, "chat-detail");
    if (!chatMobileIcon.ok) fail(`chat-detail 390px icon-only AI (${JSON.stringify(chatMobileIcon)})`);
    else pass("chat-detail 390px icon-only AI");
    const chatMobileLayout = await mobile.evaluate(() => {
      const ai = document.getElementById("chatAiBtn");
      const send = document.getElementById("chatSend");
      const aiRect = ai?.getBoundingClientRect();
      const sendRect = send?.getBoundingClientRect();
      return { separatedFromSend: aiRect && sendRect ? sendRect.left - aiRect.right > 40 : false };
    });
    if (!chatMobileLayout.separatedFromSend) fail("chat-detail AI separated from send");
    else pass("chat-detail AI separated from send");
    await mobile.click("#chatAiBtn");
    await mobile.waitForTimeout(200);
    const chatSheet = await mobile.evaluate(() => {
      const sheet = document.querySelector("[data-talk-tasful-ai-sheet]");
      const bodyText = sheet?.textContent || "";
      const menuLabels = ["返信を提案", "話題を提案", "要約する", "その他の機能", "ムード分析", "文章作成", "翻訳"];
      const menuHits = menuLabels.filter((label) => bodyText.includes(label));
      return (
        sheet &&
        !sheet.hidden &&
        document.querySelector(".talk-tasful-ai-sheet__greeting")?.textContent?.includes("何を手伝いますか") &&
        !!document.querySelector("[data-talk-tasful-ai-input]") &&
        !document.querySelector("[data-talk-tasful-ai-action]") &&
        menuHits.length === 0
      );
    });
    if (!chatSheet) fail("chat-detail opens compact sheet");
    else pass("chat-detail opens compact sheet");

    console.log("\n--- chat-detail (PC) ---");
    await pc.goto(
      buildLocalPageUrl(
        base,
        "chat-detail.html",
        "?thread=chat-demo-skill-deal-001&userId=u_me&talkDev=1&review=chat-demo"
      ),
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await pc.waitForSelector("#chatAiBtn", { timeout: 45000 });
    const composerOk = await pc.evaluate(() => {
      const toolbar = document.querySelector(".chat-composer__toolbar");
      const ai = document.getElementById("chatAiBtn");
      const input = document.getElementById("chatInput");
      const send = document.getElementById("chatSend");
      const attach = document.getElementById("chatAttach");
      if (!toolbar || !ai || !input || !send || !attach) return { ok: false };
      const order = [...toolbar.children];
      const iAttach = order.findIndex((n) => n.contains(attach));
      const iAi = order.findIndex((n) => n.contains(ai));
      const iInput = order.findIndex((n) => n.contains(input));
      const iSend = order.findIndex((n) => n.contains(send));
      return { ok: iAttach >= 0 && iAi > iAttach && iInput > iAi && iSend > iInput && iSend - iAi > 1 };
    });
    if (!composerOk.ok) fail("chat-detail composer order (attach / AI / input / send)");
    else pass("chat-detail composer order (attach / AI / input / send)");
    const chatPcIcon = await assertIconOnlyAiBtn(pc, "chat-detail");
    if (!chatPcIcon.ok) fail(`chat-detail PC icon-only AI (${JSON.stringify(chatPcIcon)})`);
    else pass("chat-detail PC icon-only AI");

    await mobile.close();
    await pc.close();

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length})`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All TASFUL AI compact panel checks passed.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
