#!/usr/bin/env node
/**
 * スクショ生成後に manifest を更新し、screenshots-viewer.html?latest=1 を開く。
 *   node scripts/open-latest-screenshots.mjs
 *   node scripts/open-latest-screenshots.mjs --all
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import { assertQaCenterReady } from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const latestOnly = !process.argv.includes("--all");
const VIEWER_PORT = Number(process.env.SCREENSHOT_VIEWER_PORT || 5501);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** @param {string} url */
function openBrowser(url) {
  if (process.env.SCREENSHOT_VIEWER_NO_OPEN === "1") {
    console.log(`[screenshots-viewer] ${url}`);
    return;
  }
  const plat = process.platform;
  if (plat === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (plat === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

/** @param {string} base */
async function probeDevServer(base) {
  try {
    const res = await fetch(`${base}/screenshots-viewer.html`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** @returns {Promise<{ base: string, close?: () => void }>} */
async function resolveServerBase() {
  const candidates = [
    process.env.BASE_URL,
    process.env.BENCH_BASE_URL,
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5173",
  ]
    .filter(Boolean)
    .map((u) => String(u).replace(/\/$/, ""));

  for (const base of candidates) {
    if (await probeDevServer(base)) {
      console.log(`[screenshots-viewer] using existing dev server: ${base}`);
      return { base };
    }
  }

  const server = await new Promise((resolve) => {
    const s = createServer(async (req, res) => {
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
    s.listen(VIEWER_PORT, "127.0.0.1", () => resolve(s));
  });

  const base = `http://127.0.0.1:${VIEWER_PORT}`;
  console.log(`[screenshots-viewer] started static server: ${base}`);
  return {
    base,
    close: () => server.close(),
  };
}

const { manifest, outPath } = await writeScreenshotsManifest(root);
console.log(
  `[screenshots-viewer] manifest ${manifest.showing}/${manifest.total} (registered ${manifest.registeredCount}, unregistered ${manifest.unregisteredCount}, archived ${manifest.ignoredCount}) → ${outPath}`
);

const qaGate = assertQaCenterReady(manifest);
if (!qaGate.ok) {
  console.warn(`[screenshots-viewer] ${qaGate.message}`);
  if (process.env.SCREENSHOT_QA_STRICT === "1") {
    process.exitCode = 1;
  }
}

const { base, close } = await resolveServerBase();
const query = latestOnly ? "?latest=1" : "";
const url = `${base}/screenshots-viewer.html${query}`;
openBrowser(url);
console.log(`[screenshots-viewer] opened ${url}`);

if (close) {
  console.log("[screenshots-viewer] Ctrl+C でサーバーを停止");
  process.on("SIGINT", () => {
    close();
    process.exit(0);
  });
}
