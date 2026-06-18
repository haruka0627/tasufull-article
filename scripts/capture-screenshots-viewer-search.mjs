#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * screenshots-viewer 検索フィルタ + サムネイル表示の検証
 *   node scripts/capture-screenshots-viewer-search.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "screenshots-viewer");
const PORT = Number(process.env.SCREENSHOT_VIEWER_PORT || 8796);

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

async function runSearchCase(page, base, query, expect, category = "") {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (query) params.set("search", query);
  const qs = params.toString();
  await page.goto(`${base}/screenshots-viewer.html${qs ? `?${qs}` : ""}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("#search-input", { timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".shot-card").length > 0 || document.querySelector(".empty"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(400);

  return page.evaluate((expected) => {
    const cards = Array.from(document.querySelectorAll(".shot-card")).map((card) => {
      const img = card.querySelector(".shot-card__thumb img, .shot-card img");
      const style = img ? getComputedStyle(img) : null;
      return {
        src: img?.getAttribute("src") || "",
        hits: card.querySelectorAll(".search-hit").length,
        title: card.querySelector(".shot-title")?.textContent || "",
        maxHeight: style?.maxHeight || "",
        objectFit: style?.objectFit || "",
      };
    });
    const count = cards.length;
    const namesOk = (expected.names || []).every((name) => cards.some((c) => c.src.includes(name)));
    const onlyNames =
      expected.onlyNames == null ||
      cards.every((c) => (expected.onlyNames || []).some((name) => c.src.includes(name)));
    const minOk = count >= (expected.min || 0);
    const maxOk = expected.max == null || count <= expected.max;
    const exactOk = expected.exact == null || count === expected.exact;
    const hasHits = expected.requireHighlight ? cards.some((c) => c.hits > 0) : true;
    const hasGroupCount = expected.requireGroupCount
      ? Boolean(document.querySelector(".group-count"))
      : true;
    const thumbOk = cards.every((c) => {
      if (!c.maxHeight) return true;
      const px = parseFloat(c.maxHeight);
      return px <= 360;
    });
    return {
      query: expected.query,
      count,
      namesOk,
      onlyNames,
      minOk,
      maxOk,
      exactOk,
      hasHits,
      hasGroupCount,
      thumbOk,
      pass:
        namesOk &&
        onlyNames &&
        minOk &&
        maxOk &&
        exactOk &&
        hasHits &&
        hasGroupCount &&
        thumbOk,
      cards: cards.map((c) => c.src.split("/").pop()),
    };
  }, { ...expect, query });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeScreenshotsManifest(root);
  const server = await startServer();
  const base = `http://127.0.0.1:${PORT}`;
  await withPlaywrightBrowser(async (browser) => {const cases = [
    {
      query: "connect-verification.png",
      exact: 1,
      onlyNames: ["connect-verification.png"],
      names: ["connect-verification.png"],
      shot: "search-connect-verification.png",
    },
    {
      query: "chatgpt-real-api.png",
      exact: 1,
      onlyNames: ["chatgpt-real-api.png"],
      names: ["chatgpt-real-api.png"],
      shot: "search-chatgpt-real-api.png",
    },
    {
      query: "connect",
      min: 14,
      max: 14,
      names: ["connect-top.png"],
      shot: "search-connect-category.png",
    },
    {
      query: "問い合わせ",
      min: 3,
      max: 3,
      names: ["inquiry-generated.png", "talk-draft-card.png", "chat-input-prefilled.png"],
      requireHighlight: true,
      requireGroupCount: true,
    },
    {
      query: "verification",
      category: "connect",
      min: 1,
      max: 2,
      names: ["connect-verification.png"],
    },
  ];

  
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const results = [];
    for (const c of cases) {
      const result = await runSearchCase(page, base, c.query, c, c.category || "");
      results.push(result);
      console.log(
        result.pass ? "PASS" : "FAIL",
        c.category ? `[${c.category}]` : "",
        c.query,
        "→",
        result.count,
        "件",
        result.cards.join(", ")
      );

      if (c.shot) {
        await page.screenshot({
          path: join(outDir, c.shot),
          fullPage: true,
        });
      }
    }

    const passed = results.every((r) => r.pass);
    if (!passed) process.exitCode = 1;
    else console.log("SCREENSHOTS VIEWER SEARCH PASS");
    });
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
