#!/usr/bin/env node

/**

 * Talk Builder workflow UI — chat-detail header, status, completion report

 *

 *   node scripts/verify-talk-builder-workflow-ui.mjs

 */

import { writeFileSync } from "node:fs";

import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";

import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";



const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPLETION_PHOTO = join(__dirname, "fixtures/completion-photo-1x1.png");



const THREADS_KEY = "tasful_chat_threads";

const MESSAGES_KEY = "tasful_chat_messages";

const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";

const REVEAL_KEY = "tasful:builder:contact-reveals:v1";



writeFileSync(

  COMPLETION_PHOTO,

  Buffer.from(

    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+B/g8ADggBAJj4+VkAAAAASUVORK5CYII=",

    "base64"

  )

);



const base = await findDevServerBaseUrl({ probePath: "chat-detail.html" });



const errors = [];

const pass = (m) => console.log(`  ✓ ${m}`);

const fail = (m) => {

  errors.push(m);

  console.log(`  ✗ ${m}`);

};



function chatUrl(threadId, extra = {}) {

  const q = new URLSearchParams({ thread: threadId, from: "builder", ...extra });

  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);

}



async function countVisibleHeaderActions(page) {

  return page.evaluate(() => {

    return [...document.querySelectorAll("[data-chat-header-action]")].filter((btn) => !btn.hidden).length;

  });

}



async function isStatusOverflowVisible(page) {

  return page.evaluate(() => {

    const btn = document.getElementById("chatOverflowBtn");

    if (!btn || btn.hidden) return false;

    const style = window.getComputedStyle(btn);

    return style.display !== "none" && style.visibility !== "hidden";

  });

}



async function isCallButtonEnabled(page) {

  return page.evaluate(() => {

    const btn = document.querySelector("[data-talk-call-start-button]:not([hidden])");

    return Boolean(btn && !btn.disabled);

  });

}



async function seedThreads(page) {

  await page.evaluate(

    ({ threadsKey, messagesKey, workflowKey, revealKey }) => {

      localStorage.removeItem(workflowKey);

      localStorage.removeItem(revealKey);

      const threads = [

        {

          id: "verify-worker-contact",

          chatDomain: "builder",

          threadKind: "worker_contact",

          builderFlow: "partner_user",

          listingTitle: "山本 電工",

          partner: { displayName: "山本 電工" },

          contactTargetId: "w1",

          source: "builder-mvp",

          status: "active",

          roomStatus: "active",

          lastMessage: "相談開始",

          updatedAt: new Date().toISOString(),

        },

        {

          id: "verify-vendor-contact",

          chatDomain: "builder",

          threadKind: "vendor_contact",

          builderFlow: "vendor_user",

          listingTitle: "株式会社オレンジ建装",

          partner: { displayName: "株式会社オレンジ建装" },

          contactTargetId: "demo-partner-001",

          source: "builder-mvp",

          status: "active",

          roomStatus: "active",

          lastMessage: "見積相談",

          updatedAt: new Date().toISOString(),

        },

        {

          id: "verify-project-thread",

          chatDomain: "builder",

          threadKind: "project_thread",

          builderFlow: "partner_user",

          projectId: "builder_demo_001",

          listingId: "builder_demo_001",

          listingTitle: "デモ案件 — 内装工事",

          partner: { displayName: "株式会社オレンジ建装", partnerId: "demo-partner-001" },

          contactTargetId: "demo-partner-001",

          source: "builder-mvp",

          status: "active",

          roomStatus: "active",

          lastMessage: "案件スレッド",

          updatedAt: new Date().toISOString(),

        },

        {

          id: "verify-admin-partner",

          chatDomain: "builder",

          threadKind: "calendar_request",

          builderThreadType: "admin_partner",

          builderFlow: "ops_partner",

          projectId: "builder_demo_001",

          listingTitle: "運営手配案件",

          partner: { displayName: "運営" },

          source: "builder-mvp",

          status: "active",

          roomStatus: "active",

          lastMessage: "運営案件",

          updatedAt: new Date().toISOString(),

        },

        {

          id: "verify-normal-chat",

          chatDomain: "work",

          threadKind: "listing_inquiry",

          listingTitle: "通常出品",

          partner: { displayName: "出品者A" },

          status: "active",

          roomStatus: "active",

          lastMessage: "通常",

          updatedAt: new Date().toISOString(),

        },

      ];

      localStorage.setItem(threadsKey, JSON.stringify(threads));

      localStorage.setItem(

        messagesKey,

        JSON.stringify({

          "verify-project-thread": [],

          "verify-worker-contact": [],

          "verify-vendor-contact": [],

          "verify-admin-partner": [],

          "verify-normal-chat": [{ id: "m1", senderId: "u1", text: "hello", createdAt: new Date().toISOString(), kind: "text" }],

        })

      );

    },

    { threadsKey: THREADS_KEY, messagesKey: MESSAGES_KEY, workflowKey: WORKFLOW_KEY, revealKey: REVEAL_KEY }

  );

}



for (const vp of BUILDER_QA_VIEWPORTS) {

  console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);



  await withPlaywrightBrowser(async (browser) => {

    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    const consoleErrors = [];

    page.on("console", (msg) => {

      if (msg.type() === "error") consoleErrors.push(msg.text());

    });



    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await page.waitForTimeout(400);
    await seedThreads(page);

    // worker_contact + reveal gate

    await page.goto(chatUrl("verify-worker-contact", { builderRole: "user" }), {

      waitUntil: "domcontentloaded",

      timeout: 20000,

    });

    await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });

    if (await page.locator("#talkBuilderContactRevealHost").isVisible()) pass("worker_contact shows 550yen gate");

    else fail("worker_contact 550yen gate missing");

    if (await page.locator("#chatInput").isDisabled()) pass("worker composer locked before reveal");

    else fail("worker composer should be locked");

    if ((await countVisibleHeaderActions(page)) === 0) pass("worker_contact hides header actions before reveal");

    else fail("worker_contact header actions should be hidden before reveal");

    if (!(await isStatusOverflowVisible(page))) pass("worker_contact hides status overflow before reveal");

    else fail("worker_contact status overflow should be hidden before reveal");

    page.once("dialog", (d) => d.accept());

    await page.locator("[data-builder-contact-reveal]").first().click();

    await page.waitForTimeout(600);

    if ((await countVisibleHeaderActions(page)) > 0) pass("worker_contact shows header actions after reveal");

    else fail("worker_contact header actions should appear after reveal");

    if (await page.locator(".builder-contact-reveal--open").isVisible()) pass("worker_contact keeps revealed contact panel");

    else fail("worker_contact revealed contact panel missing");

    if (await isCallButtonEnabled(page)) pass("worker_contact call button enabled after reveal");

    else fail("worker_contact call button should be enabled after reveal");

    if (!(await isStatusOverflowVisible(page))) pass("worker_contact hides status overflow after reveal");

    else fail("worker_contact status overflow should stay hidden after reveal");



    // vendor_contact

    await page.goto(chatUrl("verify-vendor-contact", { builderFlow: "vendor_user", builderRole: "user" }), {

      waitUntil: "domcontentloaded",

    });

    await page.locator("#talkBuilderWorkflowKind").waitFor({ state: "visible", timeout: 15000 });

    const vendorKind = await page.locator("#talkBuilderWorkflowKind").textContent();

    if (/業者相談/.test(vendorKind || "")) pass("vendor_contact header label");

    else fail(`vendor header expected 業者相談, got ${vendorKind}`);

    if ((await countVisibleHeaderActions(page)) === 0) pass("vendor_contact hides header actions before reveal");

    else fail("vendor_contact header actions should be hidden before reveal");

    page.once("dialog", (d) => d.accept());

    await page.locator("[data-builder-contact-reveal]").first().click();

    await page.waitForTimeout(600);

    if ((await countVisibleHeaderActions(page)) > 0) pass("vendor_contact shows header actions after reveal");

    else fail("vendor_contact header actions should appear after reveal");



    // project_thread — reveal then partner workflow

    await page.goto(chatUrl("verify-project-thread", { builderFlow: "partner_user", builderRole: "user" }), {

      waitUntil: "domcontentloaded",

    });

    await page.waitForTimeout(400);

    const projectRevealBtn = page.locator("[data-builder-contact-reveal]").first();

    if (await projectRevealBtn.count()) {

      if ((await countVisibleHeaderActions(page)) === 0) pass("project_thread hides header actions before reveal");

      else fail("project_thread header actions should be hidden before reveal");

      page.once("dialog", (d) => d.accept());

      await projectRevealBtn.click();

      await page.waitForTimeout(600);

    }

    if ((await countVisibleHeaderActions(page)) > 0) pass("project_thread shows header actions after reveal");

    else fail("project_thread header actions should appear after reveal");



    await page.goto(chatUrl("verify-project-thread", { builderFlow: "partner_user", builderRole: "partner" }), {

      waitUntil: "domcontentloaded",

    });

    await page.locator("#talkBuilderWorkflowStatusRow").waitFor({ state: "visible", timeout: 15000 });

    const badge0 = await page.locator("#talkBuilderWorkflowStatusBadge").textContent();

    if (/受諾済み/.test(badge0 || "")) pass("project_thread initial status accepted");

    else fail(`expected 受諾済み, got ${badge0}`);



    await page.locator('[data-talk-builder-next][data-next-status="started"]').click();

    await page.waitForTimeout(600);

    if (/作業開始/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent())) pass("accepted → started");

    else fail("accepted → started failed");



    await page.locator('[data-talk-builder-next][data-next-status="working"]').click();

    await page.waitForTimeout(600);

    if (/施工中/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent())) pass("started → working");

    else fail("started → working failed");



    await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();

    await page.locator("#talkBuilderCompletionWork").fill("壁紙張替え完了");

    await page.locator("#talkBuilderCompletionPhotos").setInputFiles(COMPLETION_PHOTO);

    await page.locator("#talkBuilderCompletionSubmit").click();

    await page.waitForTimeout(800);

    if (/依頼者確認待ち/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent()))

      pass("working → client_confirming via modal");

    else fail("completion report transition failed");



    if (await page.locator("[data-talk-builder-next]").first().isHidden()) pass("partner cannot approve");

    else fail("partner should not approve");



    await page.goto(chatUrl("verify-project-thread", { builderFlow: "partner_user", builderRole: "user" }), {

      waitUntil: "domcontentloaded",

    });

    await page.locator('[data-talk-builder-next][data-next-status="completed"]').first().click();

    await page.waitForTimeout(600);

    if (/完了/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent()))

      pass("user approved completed");

    else fail("user approval failed");



    // admin_partner — entry/exit required

    await page.evaluate(({ workflowKey }) => localStorage.removeItem(workflowKey), { workflowKey: WORKFLOW_KEY });

    await page.goto(chatUrl("verify-admin-partner", { builderFlow: "ops_partner", builderRole: "partner" }), {

      waitUntil: "domcontentloaded",

    });

    await page.locator("#talkBuilderWorkflowStatusRow").waitFor({ state: "visible", timeout: 15000 });

    if ((await countVisibleHeaderActions(page)) === 0) pass("admin_partner hides header actions");

    else fail("admin_partner header actions should stay hidden");

    if (!(await isStatusOverflowVisible(page))) pass("admin_partner hides status overflow");

    else fail("admin_partner status overflow should stay hidden");



    const adminSteps = [
      { label: "入場", expect: /入場済み/ },
      { label: "退場", expect: /退場済み/ },
    ];

    for (const step of adminSteps) {
      const btn = page.locator(`[data-talk-builder-next]:has-text("${step.label}")`).first();
      if (!new RegExp(step.label).test((await btn.textContent()) || "")) {
        fail(`admin expected button ${step.label}`);
        break;
      }
      await btn.click();
      await page.waitForTimeout(500);
      if (!step.expect.test((await page.locator("#talkBuilderWorkflowStatusBadge").textContent()) || "")) {
        fail(`admin after ${step.label} expected badge`);
        break;
      }
    }

    // 再入場 → 退場（入退場繰り返し）
    await page.locator('[data-talk-builder-next][data-next-status="entered"]').click();
    await page.waitForTimeout(400);
    if (/入場済み/.test((await page.locator("#talkBuilderWorkflowStatusBadge").textContent()) || ""))
      pass("admin re-enter from exited");
    else fail("admin re-enter failed");

    await page.locator('[data-talk-builder-next][data-next-status="exited"]').click();
    await page.waitForTimeout(400);
    if (/退場済み/.test((await page.locator("#talkBuilderWorkflowStatusBadge").textContent()) || ""))
      pass("admin re-exit after re-enter");
    else fail("admin re-exit failed");

    await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();

    await page.locator("#talkBuilderCompletionWork").fill("内装完了");

    await page.locator("#talkBuilderCompletionPhotos").setInputFiles(COMPLETION_PHOTO);

    await page.locator("#talkBuilderCompletionSubmit").click();

    await page.waitForTimeout(800);

    if (/運営承認待ち/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent()))

      pass("admin ops_confirming");

    else fail("admin ops_confirming failed");

    const partnerCard = page.locator("[data-talk-builder-completion-report]");
    if (await partnerCard.isVisible()) pass("partner completion report card visible");
    else fail("partner completion report card missing");

    const partnerThumb = page.locator("[data-talk-builder-completion-photo-thumb] img");
    if ((await partnerThumb.count()) >= 1) pass("partner sees completion photo thumbnail");
    else fail("partner completion photo thumbnail missing");

    await partnerThumb.first().click();
    await page.waitForTimeout(200);
    const lightbox = page.locator("#talkBuilderCompletionPhotoLightbox");
    if (await lightbox.isVisible()) pass("completion photo lightbox opens");
    else fail("completion photo lightbox missing");
    await page.locator(".talk-builder-completion-photo-lightbox__close").click();
    await page.waitForTimeout(150);

    await page.goto(chatUrl("verify-admin-partner", { builderFlow: "ops_partner", builderRole: "owner" }), {

      waitUntil: "domcontentloaded",

    });

    await page.waitForTimeout(500);

    const card = page.locator("[data-talk-builder-completion-report]");

    if (await card.isVisible()) pass("owner completion report card visible");

    else fail("owner completion report card missing");

    const cardText = (await card.textContent()) || "";

    if (/内装完了/.test(cardText)) pass("owner sees completion work content");

    else fail("owner completion work content missing");

    if ((await page.locator("[data-talk-builder-completion-photo-thumb] img").count()) >= 1)
      pass("owner sees completion photo thumbnail");
    else fail("owner completion photo thumbnail missing");

    if ((await page.locator("[data-talk-builder-completion-report] [data-talk-builder-next]").count()) >= 1)

      pass("owner completion card approve button");

    else fail("owner completion card approve button missing");

    await page.locator('[data-talk-builder-next][data-next-status="completed"]').first().click();

    await page.waitForTimeout(600);

    if (/完了/.test(await page.locator("#talkBuilderWorkflowStatusBadge").textContent()))

      pass("owner approved admin case");

    else fail("owner approval failed");



    // normal chat — no builder header

    await page.goto(chatUrl("verify-normal-chat"), { waitUntil: "domcontentloaded" });

    await page.waitForTimeout(800);

    if (await page.locator("#talkBuilderWorkflowPanel").isHidden()) pass("normal chat hides builder header");

    else fail("builder header visible on normal chat");

    if ((await countVisibleHeaderActions(page)) > 0) pass("normal chat shows header actions");

    else fail("normal chat header actions should remain visible");



    if (consoleErrors.length === 0) pass("console errors: 0");

    else fail(`console errors: ${consoleErrors.join(" | ")}`);

  });

}



await closeAllBrowsers();



console.log("\n=== summary ===");

if (errors.length) {

  console.error(`FAIL (${errors.length}):`);

  errors.forEach((e) => console.error(`  - ${e}`));

  process.exit(1);

}

console.log("PASS verify-talk-builder-workflow-ui");


