#!/usr/bin/env node
/**
 * post.html — AI Agent 下書き生成 E2E
 *
 * 事前: npm run dev
 *   node scripts/test-post-draft-browser.mjs
 *   BASE_URL=http://127.0.0.1:5179 node scripts/test-post-draft-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const PAGE = "/post.html";
const STORAGE_KEY = "tasful_agent_listing_draft";

const LONG_DESC =
  "特殊文字テスト：<>&\"'　全角スペース\n改行2行目\n" +
  "長文".repeat(40);
const SPECIAL_TITLE = '外壁塗装「特価」& <防水> パッケージ';
const TAGS = "外壁, 塗装, 防水, 特殊&記号";
const IMAGE_URLS = [
  "https://placehold.co/800x600/e8eef5/1e3a5f?text=Main",
  "https://placehold.co/800x600/dbeafe/1e3a5f?text=Sub+1",
];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("supabase") ||
    t.includes("Supabase") ||
    t.includes("chat-supabase")
  );
}

async function clearDraftStorage(page) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}

async function readFormValues(page) {
  return page.evaluate(() => ({
    title: document.getElementById("title")?.value ?? "",
    category: document.getElementById("category")?.value ?? "",
    price: document.getElementById("price")?.value ?? "",
    description: document.getElementById("description")?.value ?? "",
    tags: document.getElementById("tags")?.value ?? "",
    images: document.getElementById("images")?.value ?? "",
  }));
}

async function main() {
  console.log(`\npost AI下書き生成 E2E — ${BASE}${PAGE}\n`);

  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isIgnorableConsoleError(err.message)) {
      consoleErrors.push(err.message);
    }
  });

  try {
    await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-agent-panel]", { timeout: 20000 });
    await clearDraftStorage(page);
    pass("post.html が開く");

    const agentVisible = await page.locator("[data-agent-generate]").isVisible();
    if (agentVisible) pass("AI Agent パネル表示");
    else fail("AI Agent パネル表示");

    await page.fill('[data-agent-brief="title"]', SPECIAL_TITLE);
    await page.selectOption('[data-agent-brief="category"]', "建築・修理");
    await page.fill('[data-agent-brief="price"]', "120000");
    await page.fill('[data-agent-brief="description"]', LONG_DESC);
    await page.fill('[data-agent-brief="images"]', IMAGE_URLS.join("\n"));
    await page.fill('[data-agent-brief="tags"]', TAGS);

    await page.click("[data-agent-generate]");
    await page.waitForSelector('[data-agent-status]:not([hidden])', { timeout: 5000 });

    const statusText = await page.locator("[data-agent-status]").textContent();
    if (statusText?.includes("反映")) pass("生成ステータス", statusText.trim());
    else fail("生成ステータス", statusText || "");

    const values = await readFormValues(page);

    if (values.title === SPECIAL_TITLE) pass("title 反映", values.title.slice(0, 40));
    else fail("title 反映", values.title);

    if (values.category === "建築・修理") pass("category 反映", values.category);
    else fail("category 反映", values.category);

    if (values.price === "120000") pass("price 反映", values.price);
    else fail("price 反映", values.price);

    if (values.description === LONG_DESC) pass("description 反映（長文・特殊文字）");
    else fail("description 反映", `len=${values.description.length}`);

    if (values.tags.includes("外壁") && values.tags.includes("特殊&記号")) {
      pass("tags 反映", values.tags);
    } else {
      fail("tags 反映", values.tags);
    }

    const imageLines = values.images.split(/\r?\n/).filter(Boolean);
    if (imageLines.length >= 2 && imageLines[0].includes("placehold.co")) {
      pass("images 反映", `${imageLines.length}件`);
    } else {
      fail("images 反映", values.images.slice(0, 80));
    }

    const previewCount = await page.locator("[data-agent-images-preview] img").count();
    if (previewCount >= 2) pass("画像URLプレビュー", `${previewCount}枚`);
    else fail("画像URLプレビュー", `${previewCount}枚`);

    const mainPreviewVisible = await page.locator("[data-main-preview]:not([hidden]) img").count();
    if (mainPreviewVisible >= 1) pass("メイン画像プレビュー");
    else fail("メイン画像プレビュー");

    const galleryPreviewCount = await page
      .locator("[data-gallery-preview]:not([hidden]) img")
      .count();
    if (galleryPreviewCount >= 1) pass("ギャラリープレビュー", `${galleryPreviewCount}枚`);
    else fail("ギャラリープレビュー", `${galleryPreviewCount}枚`);

    const confirmOpen = await page.locator("[data-confirm-modal]:not([hidden])").isVisible();
    const successOpen = await page.locator("[data-success-modal]:not([hidden])").isVisible();
    if (!confirmOpen && !successOpen) pass("submit 未実行（確認/完了モーダル非表示）");
    else fail("submit 未実行", `confirm=${confirmOpen} success=${successOpen}`);

    const saved = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        return null;
      }
    }, STORAGE_KEY);

    if (saved?.title === SPECIAL_TITLE && saved?.price === 120000) {
      pass("localStorage 保存", STORAGE_KEY);
    } else {
      fail("localStorage 保存", saved ? JSON.stringify(saved).slice(0, 80) : "null");
    }

    await page.fill("#title", "手動編集タイトル");
    const edited = await page.inputValue("#title");
    if (edited === "手動編集タイトル") pass("手動編集可能");
    else fail("手動編集可能", edited);

    if (consoleErrors.length === 0) pass("console エラーなし");
    else fail("console エラーなし", consoleErrors.slice(0, 3).join(" | "));
  } catch (err) {
    fail("テスト実行", err.message);
  }  });
  

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) {
    process.exitCode = 1;
  }
}

main();

await closeAllBrowsers();
