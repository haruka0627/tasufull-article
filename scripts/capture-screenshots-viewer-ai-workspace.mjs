#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * screenshots-viewer.html — AI Workspace カテゴリ表示確認
 *   node scripts/capture-screenshots-viewer-ai-workspace.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "screenshots-viewer");
const PORT = Number(process.env.SCREENSHOT_VIEWER_PORT || 5500);

const CURATED = [
  "screenshots/ai-workspace-multi-ai/chatgpt-real-api.png",
  "screenshots/ai-workspace-multi-ai/claude-real-api.png",
  "screenshots/ai-workspace-search/vendor-search.png",
  "screenshots/ai-workspace-search/worker-search.png",
  "screenshots/ai-workspace-search/product-search.png",
  "screenshots/ai-workspace-action/inquiry-generated.png",
  "screenshots/ai-workspace-action/talk-draft-card.png",
  "screenshots/ai-workspace-action/chat-input-prefilled.png",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      try {
        const file = join(root, p.replace(/^\//, ""));
        const data = await readFile(file);
        res.writeHead(200, {
          "Content-Type": MIME[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeScreenshotsManifest(root);

  const server = await startServer();
  const base = `http://127.0.0.1:${PORT}`;
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    await page.goto(`${base}/screenshots-viewer.html?category=ai-workspace&mode=registered`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector(".shot-card", { timeout: 15000 });
    await page.waitForFunction(
      (expected) => document.querySelectorAll(".shot-card").length >= expected,
      CURATED.length,
      { timeout: 15000 }
    );
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".shot-card")).map((card) => {
        const img = card.querySelector("img");
        const src = img?.getAttribute("src") || "";
        const title = card.querySelector(".shot-title")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const reportLink = card.querySelector('.shot-link[href*="ai-workspace-inquiry-to-talk"]');
        return { src, title, hasInquiryReport: Boolean(reportLink) };
      });
      const passBadges = document.querySelectorAll(".badge--pass").length;
      const hasCategoryNav = Boolean(document.getElementById("category-nav")?.children?.length);
      const flowHeader = Boolean(document.querySelector("[data-inquiry-flow]"));
      const flowNames = ["inquiry-generated.png", "talk-draft-card.png", "chat-input-prefilled.png"];
      const flowIndexes = flowNames.map((name) => cards.findIndex((c) => c.src.includes(name)));
      const flowConsecutive =
        flowIndexes.every((i) => i >= 0) &&
        flowIndexes[1] === flowIndexes[0] + 1 &&
        flowIndexes[2] === flowIndexes[1] + 1;
      const prefilledCard = cards.find((c) => c.src.includes("chat-input-prefilled"));
      return {
        cardCount: cards.length,
        passBadges,
        hasCategoryNav,
        flowHeader,
        flowConsecutive,
        flowIndexes,
        prefilledTitle: prefilledCard?.title || "",
        prefilledHasReport: prefilledCard?.hasInquiryReport === true,
        status: document.getElementById("status")?.textContent || "",
        pageTitle: document.querySelector(".topbar h1")?.textContent || "",
      };
    });

    const outPath = join(outDir, "ai-workspace-gallery.png");
    await page.screenshot({ path: outPath, fullPage: true });

    const report = {
      capturedAt: new Date().toISOString(),
      url: `${base}/screenshots-viewer.html?category=ai-workspace`,
      expected: CURATED.length,
      cardCount: state.cardCount,
      passBadges: state.passBadges,
      hasCategoryNav: state.hasCategoryNav,
      flowHeader: state.flowHeader,
      flowConsecutive: state.flowConsecutive,
      prefilledTitle: state.prefilledTitle,
      prefilledHasReport: state.prefilledHasReport,
      status: state.status,
      pageTitle: state.pageTitle,
      passed:
        state.cardCount >= CURATED.length &&
        state.pageTitle.includes("QA") &&
        state.hasCategoryNav &&
        state.flowConsecutive &&
        state.prefilledHasReport &&
        state.prefilledTitle.includes("TALK入力欄への下書き反映"),
      screenshot: "screenshots/screenshots-viewer/ai-workspace-gallery.png",
    };

    await writeFile(join(root, "reports", "screenshots-viewer-ai-workspace.json"), JSON.stringify(report, null, 2));

    console.log("viewer URL:", report.url);
    console.log("cards:", state.cardCount, "/", CURATED.length);
    console.log("screenshot:", outPath);
    console.log(report.passed ? "PASS" : "FAIL");

    if (!report.passed) process.exitCode = 1;
    });
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
