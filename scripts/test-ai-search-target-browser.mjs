#!/usr/bin/env node
/**
 * AIワークスペース — 検索対象セレクター smoke test
 *   node scripts/test-ai-search-target-browser.mjs
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
};

function startServer(port = 8778) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      try {
        const file = join(root, p.replace(/^\//, ""));
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function sendConsult(page, text, timeoutMs = 20000) {
  const before = await page.locator("[data-ai-chat-messages] .ai-chat__msg--assistant").count();
  await page.fill("[data-ai-chat-input]", text);
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    (n) => document.querySelectorAll("[data-ai-chat-messages] .ai-chat__msg--assistant").length > n,
    before,
    { timeout: timeoutMs }
  );
  await page.waitForTimeout(400);
}

async function main() {
  const server = await startServer();
  const BASE = "http://127.0.0.1:8778";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForSelector("[data-ai-search-target-input]", { timeout: 15000 });

    const layout = await page.evaluate(() => {
      const composer = document.querySelector(".tga-composer__inner");
      const target = document.querySelector("[data-ai-search-target]");
      const form = document.querySelector("[data-ai-chat-form]");
      const checked = document.querySelector("[data-ai-search-target-input]:checked");
      const targetIndex = Array.from(composer?.children || []).indexOf(target);
      const formIndex = Array.from(composer?.children || []).indexOf(form);
      return {
        hasTarget: Boolean(target),
        defaultValue: checked?.value || "",
        targetAboveForm: targetIndex >= 0 && formIndex >= 0 && targetIndex < formIndex,
      };
    });

    if (layout.hasTarget && layout.targetAboveForm) pass("search target selector above input");
    else fail(`layout: ${JSON.stringify(layout)}`);

    if (layout.defaultValue === "tasful") pass("default target: TASFUL内");
    else fail(`default target unexpected: ${layout.defaultValue}`);

    await sendConsult(page, "草刈り業者探したい");
    const tasfulReply = await page.evaluate(() => {
      const last = document.querySelector("[data-ai-chat-messages] .ai-chat__msg--assistant:last-child");
      return {
        label: last?.querySelector("[data-ai-search-source]")?.textContent?.trim() || "",
        text: last?.textContent?.trim() || "",
        html: last?.innerHTML || "",
      };
    });
    if (/検索元:\s*TASFUL内/.test(tasfulReply.label)) pass(`tasful reply label: ${tasfulReply.label}`);
    else fail(`tasful label missing: ${tasfulReply.label}`);
    if (/Web検索を利用しました/.test(tasfulReply.text)) {
      fail("tasful mode must not show legacy web search badge");
    } else {
      pass("tasful mode no legacy web badge");
    }
    if (/TASFUL内の候補|AI検索結果/.test(tasfulReply.text)) {
      pass(`tasful result header: ${tasfulReply.text.match(/TASFUL内の候補|AI検索結果/)?.[0]}`);
    } else {
      fail(`tasful result header missing: ${tasfulReply.text.slice(0, 160)}`);
    }
    if (/AIまとめ/.test(tasfulReply.text)) fail("tasful mode must not show AI summary");
    else pass("tasful mode no AI summary");
    if (tasfulReply.html.includes("ai-cross-draft-panel")) pass("tasful draft collapsible");
    else fail("tasful missing collapsible draft panel");

    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-search-target-input]", { timeout: 15000 });
    await page.locator('input[data-ai-search-target-input][value="web"]').check({ force: true });
    await sendConsult(page, "インボイス制度とは");
    const webLabel = await page.evaluate(() => {
      const last = document.querySelector("[data-ai-chat-messages] .ai-chat__msg--assistant:last-child");
      const stored = JSON.parse(sessionStorage.getItem("tasu_ai_chat_cross-matching") || "[]");
      const lastMsg = stored[stored.length - 1];
      return {
        label: last?.querySelector("[data-ai-search-source]")?.textContent?.trim() || "",
        search_source: lastMsg?.search_source || "",
      };
    });
    if (/検索元:\s*Web/.test(webLabel.label) || webLabel.search_source === "web") {
      pass(`web reply label: ${webLabel.label || webLabel.search_source}`);
    } else {
      fail(`web label missing: ${JSON.stringify(webLabel)}`);
    }

    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-search-target-input]", { timeout: 15000 });
    await page.locator('input[data-ai-search-target-input][value="web"]').check({ force: true });
    await sendConsult(page, "外壁塗装の相場を知りたい");
    const webMarket = await page.evaluate(() => {
      const last = document.querySelector("[data-ai-chat-messages] .ai-chat__msg--assistant:last-child");
      return last?.textContent?.trim() || "";
    });
    if (/もう少し条件を具体的に/.test(webMarket)) {
      fail("web mode should not ask for more TASFUL criteria");
    } else if (/相場|外壁塗装|80万/.test(webMarket)) {
      pass("web mode answers market question");
    } else {
      fail(`web market reply unexpected: ${webMarket.slice(0, 200)}`);
    }
    if (/Web検索結果/.test(webMarket)) pass("web mode result header");
    else fail("web mode missing Web検索結果 header");
    if (/Web検索を利用しました/.test(webMarket)) fail("web mode must not show legacy web badge");
    if (/AIまとめ/.test(webMarket)) pass("web mode AI summary");
    else fail("web mode missing AI summary");

    await page.goto(`${BASE}/ai-workspace.html?mode=cross-matching`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-ai-search-target-input]", { timeout: 15000 });
    await page.locator('input[data-ai-search-target-input][value="both"]').check({ force: true });
    await sendConsult(page, "外壁塗装の相場と業者を探したい", 35000);
    const bothReply = await page.evaluate(() => {
      const last = document.querySelector("[data-ai-chat-messages] .ai-chat__msg--assistant:last-child");
      return {
        text: last?.textContent?.trim() || "",
        html: last?.innerHTML || "",
      };
    });
    if (!/検索元:\s*TASFUL内\s*\+\s*Web/.test(bothReply.text)) {
      fail(`both label missing: ${bothReply.text.slice(0, 120)}`);
    } else {
      pass("both reply label");
    }
    if (/もう少し条件を具体的に/.test(bothReply.text)) {
      fail("both mode should not stop on insufficient TASFUL criteria");
    } else {
      pass("both mode no criteria gate on web side");
    }
    if (!/TASFUL内の候補|ai-hybrid-section--site/.test(bothReply.html)) {
      fail("both mode missing TASFUL internal section");
    } else {
      pass("both mode includes TASFUL candidates");
    }
    if (!/相場|外壁塗装|80万/.test(bothReply.text)) {
      fail("both mode missing web market answer");
    } else {
      pass("both mode includes web market answer");
    }
    if (/Web検索を利用しました/.test(bothReply.text)) {
      fail("both mode must not show legacy web badge");
    } else {
      pass("both mode no legacy web badge");
    }
    if (!/Web検索結果/.test(bothReply.text)) {
      fail("both mode missing Web検索結果 section");
    } else {
      pass("both mode Web検索結果 section");
    }
    if (!/AIまとめ/.test(bothReply.text)) fail("both mode missing AI summary");
    else pass("both mode AI summary");

    const bothOrder = await page.evaluate(() => {
      const bubble = document.querySelector(
        "[data-ai-chat-messages] .ai-chat__msg--assistant:last-child .ai-chat__bubble--rich"
      );
      const html = bubble?.innerHTML || "";
      const idx = (needle) => html.indexOf(needle);
      return {
        site: idx("ai-hybrid-section--site"),
        web: idx("ai-hybrid-section--web"),
        summary: idx("ai-search-summary"),
        draft: idx("ai-cross-draft-panel"),
      };
    });
    if (
      bothOrder.site >= 0 &&
      bothOrder.web > bothOrder.site &&
      bothOrder.summary > bothOrder.web &&
      bothOrder.draft > bothOrder.summary
    ) {
      pass("both mode section order");
    } else {
      fail(`both mode section order wrong: ${JSON.stringify(bothOrder)}`);
    }

    const draftCollapsed = await page.locator(".ai-cross-draft-panel").first();
    if ((await draftCollapsed.getAttribute("open")) == null) pass("draft collapsed by default");
    else fail("draft should start collapsed");

    await draftCollapsed.locator(".ai-cross-draft-panel__summary").click();
    if (await draftCollapsed.evaluate((el) => el.hasAttribute("open"))) pass("draft expands on click");
    else fail("draft did not expand on click");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => {
      const bubble = document.querySelector(
        "[data-ai-chat-messages] .ai-chat__msg--assistant:last-child .ai-chat__bubble--rich"
      );
      const summary = bubble?.querySelector(".ai-search-summary__list");
      const cta = bubble?.querySelector(".ai-cross-cta, .ai-cross-card__ctas a, .ai-cross-card a");
      if (cta) cta.scrollIntoView({ block: "center", behavior: "instant" });
      const composer = document.querySelector(".tga-composer");
      const ctaRect = cta?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();
      return {
        summaryWrapOk: summary ? summary.scrollWidth <= (bubble?.clientWidth || 0) + 2 : false,
        hasCta: Boolean(cta),
        ctaNotUnderComposer: ctaRect && composerRect ? ctaRect.bottom <= composerRect.top + 2 : true,
      };
    });
    if (mobileLayout.summaryWrapOk) pass("mobile390 summary wrap ok");
    else fail("mobile390 summary wrap broken");
    if (!mobileLayout.hasCta) pass("mobile390 no CTA to check");
    else if (mobileLayout.ctaNotUnderComposer) pass("mobile390 CTA not hidden");
    else fail("mobile390 CTA hidden under composer");

    console.log(errors.length ? `\nFAILED (${errors.length})` : "\nALL PASSED");
    process.exitCode = errors.length ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
