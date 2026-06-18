#!/usr/bin/env node
/**
 * AI相談 → 生成AI コンシェルジュ委譲 E2E
 *
 *   node scripts/test-ai-concierge-handoff-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-ai-concierge-handoff-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const HANDOFFS = [
  {
    label: "character-chat",
    tabModeId: "AIキャラ会話",
    slug: "character-chat",
    genMode: "AIキャラ会話",
  },
  {
    label: "voice-chat",
    tabModeId: "音声会話AI",
    slug: "voice-chat",
    genMode: "音声会話AI",
  },
  {
    label: "my-character",
    tabModeId: "マイAIキャラ作成",
    slug: "my-character",
    genMode: "マイAIキャラ作成",
  },
  {
    label: "image-character",
    tabModeId: "画像キャラ化AI",
    slug: "image-character",
    genMode: "画像キャラ化AI",
  },
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

async function waitForGenAiMode(page, expectedMode) {
  await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 15000 });
  await page.waitForFunction(
    (mode) => {
      const chat = document.querySelector("[data-gen-ai-chat]");
      const view = document.querySelector("[data-gen-ai-chat-view]");
      return (
        chat?.getAttribute("data-mode") === mode &&
        view &&
        view.hidden === false
      );
    },
    expectedMode,
    { timeout: 15000 }
  );
}

async function testTabHandoff(page, { label, tabModeId, slug, genMode }) {
  await page.goto(`${BASE}/ai-workspace.html?mode=tasful-guide`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ai-mode-tab]", { timeout: 10000 });

  const handoffUrl = await page.evaluate(
    (modeId) => window.TasuAiModes?.getConciergeGenAiHandoffUrl?.(modeId),
    tabModeId
  );
  const expectedHandoff = `gen-ai-workspace.html?mode=${slug}`;
  if (handoffUrl !== expectedHandoff) fail(`${label} handoff url`, handoffUrl);
  else pass(`${label} handoff url`, handoffUrl);

  const tab = page.locator(`[data-ai-mode-tab][data-mode="${tabModeId}"]`);
  await tab.waitFor({ state: "visible", timeout: 10000 });

  await Promise.all([
    page.waitForURL(/gen-ai-workspace\.html/, { timeout: 15000 }),
    tab.click(),
  ]);

  pass(`${label} navigates`, page.url());

  await waitForGenAiMode(page, genMode);
  const active = await page.evaluate(() => ({
    mode: document.querySelector("[data-gen-ai-chat]")?.getAttribute("data-mode"),
    chatVisible: document.querySelector("[data-gen-ai-chat-view]")?.hidden === false,
  }));
  if (active.mode !== genMode) fail(`${label} active mode`, active.mode);
  else pass(`${label} gen-ai mode`, active.mode);
  if (!active.chatVisible) fail(`${label} chat view visible`);
  else pass(`${label} chat view open`);
}

async function testDirectSlug(page, { label, slug, genMode }) {
  await page.goto(`${BASE}/gen-ai-workspace.html?mode=${slug}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForGenAiMode(page, genMode);
  const mode = await page.evaluate(() =>
    document.querySelector("[data-gen-ai-chat]")?.getAttribute("data-mode")
  );
  if (mode !== genMode) fail(`${label} direct`, mode);
  else pass(`${label} direct`, mode);
}

async function testAiWorkspaceDeepLink(page, { tabModeId, slug, genMode }) {
  await page.goto(`${BASE}/ai-workspace.html?mode=${encodeURIComponent(tabModeId)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 15000 });
  pass(`deeplink ${tabModeId}`, page.url());
  await waitForGenAiMode(page, genMode);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("\n======== tab handoff (ai-workspace → gen-ai) ========");
  for (const h of HANDOFFS) {
    await testTabHandoff(page, h);
  }

  console.log("\n======== direct slug (gen-ai-workspace) ========");
  for (const h of HANDOFFS) {
    await testDirectSlug(page, h);
  }

  console.log("\n======== ai-workspace URL deeplink ========");
  for (const h of HANDOFFS) {
    await testAiWorkspaceDeepLink(page, {
      tabModeId: h.tabModeId,
      slug: h.slug,
      genMode: h.genMode,
    });
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((f) => console.error(`FAIL: ${f.step} ${f.detail || ""}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
