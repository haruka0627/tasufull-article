#!/usr/bin/env node
/**
 * TASFUL TALK — AI下書き → 投稿フォーム反映
 *
 *   node scripts/test-talk-ai-draft-apply-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DRAFTS_KEY = "tasful_talk_ai_drafts";
const JOB_ID = "talk-ai-test-job-apply";
const PROJECT_ID = "talk-ai-test-project-apply";
const BUSINESS_ID = "talk-ai-test-business-apply";
const SHOP_ID = "talk-ai-test-shop-apply";
const INVALID_ID = "talk-ai-invalid-000";

const JOB_OUTPUT = `【求人掲載下書き（モック）】

募集タイトル：E2Eテスト求人スタッフ

仕事内容：
接客とレジ業務を担当していただきます。

勤務地：東京都渋谷区
雇用形態：アルバイト
給与：時給1,350円〜

予算目安：面接後相談`;

const PROJECT_OUTPUT = `【案件掲載下書き（モック）】

案件名：E2E外装改修案件

概要：
共同住宅の外装改修です。

作業内容：
足場設置と塗装工事

エリア：東京, 新宿区
予算目安：800万円
工期：2026年7月〜9月`;

const BUSINESS_OUTPUT = `【業務サービス掲載下書き（モック）】

タイトル：E2E外壁塗装サービス
カテゴリ：建築・修理
料金：980000
詳細説明：
戸建・マンションの外壁塗装・防水工事。現地調査・見積無料。
タグ：外壁, 塗装, 防水`;

const SHOP_OUTPUT = `【店舗掲載下書き（モック）】

店舗名：E2Eテストカフェ
カテゴリ：店舗・販売
店舗カテゴリ：飲食・レストラン
詳細説明：
ランチとスイーツが人気のカフェ。テイクアウト対応。
タグ：カフェ, ランチ, テイクアウト`;

async function seedDrafts(page) {
  await page.evaluate(
    ({ draftsKey, jobId, projectId, businessId, shopId, jobOutput, projectOutput, businessOutput, shopOutput }) => {
      const now = new Date().toISOString();
      const rows = [
        {
          id: jobId,
          mode: "job",
          input: "E2E求人入力",
          output: jobOutput,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: projectId,
          mode: "project",
          input: "E2E案件入力",
          output: projectOutput,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: businessId,
          mode: "business",
          input: "E2E業務サービス入力",
          output: businessOutput,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: shopId,
          mode: "shop",
          input: "E2E店舗入力",
          output: shopOutput,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem(draftsKey, JSON.stringify(rows));
    },
    {
      draftsKey: DRAFTS_KEY,
      jobId: JOB_ID,
      projectId: PROJECT_ID,
      businessId: BUSINESS_ID,
      shopId: SHOP_ID,
      jobOutput: JOB_OUTPUT,
      projectOutput: PROJECT_OUTPUT,
      businessOutput: BUSINESS_OUTPUT,
      shopOutput: SHOP_OUTPUT,
    }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/talk-home.html`, { waitUntil: "domcontentloaded" });
    await seedDrafts(page);

    const jobUrl = `${BASE}/post.html?type=job&talkDraftId=${encodeURIComponent(JOB_ID)}`;
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(400);

    if (!page.url().includes("type=job")) fail("job url missing type=job");
    else pass("job url has type=job");
    if (page.url().includes("talkDraftId=")) fail("job talkDraftId still in url");
    else pass("job talkDraftId consumed from url");

    const jobBanner = await page.locator("[data-talk-draft-banner]").textContent();
    if (!jobBanner?.includes("AI下書きを読み込み")) fail(`job banner: ${jobBanner}`);
    else pass("job success banner");

    const jobTitle = await page.inputValue("#jobTitle");
    if (!jobTitle.includes("E2Eテスト求人")) fail(`jobTitle: ${jobTitle}`);
    else pass("job title applied");

    const jobStatus = await page.evaluate(
      ({ key, id }) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        return list.find((d) => d.id === id)?.status;
      },
      { key: DRAFTS_KEY, id: JOB_ID }
    );
    if (jobStatus !== "used") fail(`job status: ${jobStatus}`);
    else pass("job draft status used");

    const projectUrl = `${BASE}/builder/mvp-project-new.html?talkDraftId=${encodeURIComponent(PROJECT_ID)}`;
    await page.goto(projectUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(500);

    if (!page.url().includes("mvp-project-new")) fail("project page navigation");
    else pass("project page loaded");
    if (page.url().includes("talkDraftId=")) fail("project talkDraftId still in url");
    else pass("project talkDraftId consumed");

    const projectBanner = await page.locator("[data-talk-draft-banner]").textContent();
    if (!projectBanner?.includes("AI下書きを読み込み")) fail(`project banner: ${projectBanner}`);
    else pass("project success banner");

    const projectTitle = await page.inputValue("[data-builder-mvp-project-title]");
    if (!projectTitle.includes("E2E外装改修")) fail(`project title: ${projectTitle}`);
    else pass("project title applied");

    const projectStatus = await page.evaluate(
      ({ key, id }) => {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        return list.find((d) => d.id === id)?.status;
      },
      { key: DRAFTS_KEY, id: PROJECT_ID }
    );
    if (projectStatus !== "used") fail(`project status: ${projectStatus}`);
    else pass("project draft status used");

    const businessUrl = `${BASE}/post.html?scope=business&talkDraftId=${encodeURIComponent(BUSINESS_ID)}`;
    await page.goto(businessUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(500);

    const businessBanner = await page.locator("[data-talk-draft-banner]").textContent();
    if (!businessBanner?.includes("AI下書きを読み込み")) fail(`business banner: ${businessBanner}`);
    else pass("business success banner");

    const businessTitle = await page.inputValue("#title");
    if (!businessTitle.includes("E2E外壁塗装")) fail(`business title: ${businessTitle}`);
    else pass("business title applied");

    const businessScope = await page.evaluate(
      () =>
        document.querySelector('input[data-post-scope]')?.value ||
        document.body.dataset.postScope ||
        ""
    );
    if (businessScope !== "business") fail(`business scope: ${businessScope}`);
    else pass("business scope active");

    const shopUrl = `${BASE}/post.html?scope=business&postType=shop-store&talkDraftId=${encodeURIComponent(SHOP_ID)}`;
    await page.goto(shopUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(500);

    const shopBanner = await page.locator("[data-talk-draft-banner]").textContent();
    if (!shopBanner?.includes("AI下書きを読み込み")) fail(`shop banner: ${shopBanner}`);
    else pass("shop success banner");

    const shopTitle = await page.inputValue("#title");
    if (!shopTitle.includes("E2Eテストカフェ")) fail(`shop title: ${shopTitle}`);
    else pass("shop title applied");

    const shopCat = await page.evaluate(
      () => document.querySelector('[data-shop-store-category-pick]:checked')?.value || ""
    );
    if (shopCat !== "restaurant") fail(`shop category: ${shopCat}`);
    else pass("shop category applied");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/post.html`, { waitUntil: "domcontentloaded" });
    const agentTitle = await page.locator("#postAgentTitle").textContent();
    if (!agentTitle?.includes("TASFUL AI 下書き作成")) fail(`post agent title: ${agentTitle}`);
    else pass("post.html uses TASFUL AI label");

    await page.goto(`${BASE}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded" });
    await page.locator('.talk-ai-tool-card[data-talk-ai-pick="business"]').click();
    await page.waitForTimeout(200);
    const businessHint = await page.locator("[data-talk-ai-hint]").textContent();
    if (!businessHint?.includes("業務サービス")) fail(`business hint: ${businessHint}`);
    else pass("talk-home business mode opens composer");

    await page.locator("[data-talk-ai-input]").fill("外壁塗装の掲載文案");
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    const businessApplyVisible = await page.locator("[data-talk-ai-apply-form]").isVisible();
    if (!businessApplyVisible) fail("apply button hidden for business mode");
    else pass("apply button visible for business");

    await page.locator('.talk-ai-tool-card[data-talk-ai-pick="shop"]').click();
    await page.waitForTimeout(200);
    await page.locator("[data-talk-ai-input]").fill("カフェの店舗掲載文案");
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    const shopApplyVisible = await page.locator("[data-talk-ai-apply-form]").isVisible();
    if (!shopApplyVisible) fail("apply button hidden for shop mode");
    else pass("apply button visible for shop");

    await page.goto(`${BASE}/post.html?type=job&talkDraftId=${INVALID_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(300);
    const invalidBanner = await page.locator("[data-talk-draft-banner]").textContent().catch(() => "");
    if (!invalidBanner?.includes("読み込めません")) fail("invalid id should show warn banner");
    else pass("invalid draftId warn banner");

    const formOk = await page.evaluate(() => Boolean(document.getElementById("listingForm")));
    if (!formOk) fail("form missing on invalid draft");
    else pass("invalid draftId form still works");

    await page.goto(`${BASE}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded" });
    await seedDrafts(page);
    await page.locator('.talk-ai-tool-card[data-talk-ai-pick="job"]').click();
    await page.locator("[data-talk-ai-input]").fill("遷移テスト");
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    const applyVisible = await page.locator("[data-talk-ai-apply-form]").isVisible();
    if (!applyVisible) fail("apply button hidden for job mode");
    else pass("apply button visible for job");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("\nOK: AI draft apply (job + project + business + shop + invalid + talk-home)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
