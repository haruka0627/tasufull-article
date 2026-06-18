import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { writeScreenshotsIndex } from "./screenshots-index.mjs";

const VIEWER_PORT = Number(process.env.SCREENSHOT_INDEX_PORT || 5502);

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
};

/**
 * @param {string} [indexPath]
 */
export function reviewIndexUrl(indexPath = "/screenshots/index.html") {
  return `http://localhost:${VIEWER_PORT}${indexPath}`;
}

/**
 * @param {string} [indexPath]
 */
export function printReviewBanner(indexPath = "/screenshots/index.html") {
  const url = reviewIndexUrl(indexPath);
  console.log("==================================");
  console.log("SCREENSHOT REVIEW");
  console.log(url);
  console.log("==================================");
  return url;
}

/**
 * @param {string} url
 */
export function openBrowser(url) {
  if (process.env.SCREENSHOT_INDEX_NO_OPEN === "1") {
    console.log(`[verify-index] ${url}`);
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

/**
 * @returns {Promise<boolean>}
 */
async function probeReviewServer() {
  const bases = [`http://127.0.0.1:${VIEWER_PORT}`, `http://localhost:${VIEWER_PORT}`];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/screenshots/index.html`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

/**
 * @param {string} root
 * @returns {Promise<{ base: string, close: () => void, reused: boolean }>}
 */
export async function resolveStaticServer(root) {
  const base = `http://127.0.0.1:${VIEWER_PORT}`;

  if (await probeReviewServer()) {
    return { base, close: () => {}, reused: true };
  }

  return new Promise((resolve, reject) => {
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

    server.on("error", async (err) => {
      if (err && err.code === "EADDRINUSE") {
        if (await probeReviewServer()) {
          resolve({ base, close: () => {}, reused: true });
          return;
        }
      }
      reject(err);
    });

    server.listen(VIEWER_PORT, "127.0.0.1", () => {
      resolve({
        base,
        close: () => server.close(),
        reused: false,
      });
    });
  });
}

/** @deprecated use resolveStaticServer */
export async function startStaticServer(root) {
  return resolveStaticServer(root);
}

/**
 * @param {string} root
 * @param {{ hash?: string, keepServer?: boolean, primaryFolder?: string }} [opts]
 */
export async function finalizeVerification(root, opts = {}) {
  const { outPath, data } = await writeScreenshotsIndex(root, {
    primaryFolder: opts.primaryFolder,
    refreshFolderIndexes: opts.refreshFolderIndexes === true,
  });
  const failCount = data.failItems?.length || 0;
  const hash = opts.hash || (failCount ? "#fail-section" : "#top");
  const { close, reused } = await resolveStaticServer(root);

  const bannerUrl = printReviewBanner();
  const openUrl = `${bannerUrl}${hash}`;
  openBrowser(openUrl);

  const summary = {
    ok: data.overall !== "FAIL",
    outPath,
    url: openUrl,
    reviewUrl: bannerUrl,
    serverReused: reused,
    overall: data.overall,
    failCount,
    minorCount: data.minorItems?.length || 0,
    aiSummary: data.aiSummary,
    failItems: (data.failItems || []).map((f) => ({
      pageName: f.pageName,
      viewportLabel: f.viewportLabel,
      cause: f.cause,
      screenshot: f.screenshot,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  const keepServer = opts.keepServer === true || process.env.SCREENSHOT_INDEX_KEEP_SERVER === "1";
  if (keepServer && !reused) {
    console.log("[verify-index] Ctrl+C でサーバーを停止");
    await new Promise((resolve) => process.on("SIGINT", resolve));
    close();
  } else if (!reused) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    close();
  }

  return summary;
}

/**
 * index 生成のみ（ブラウザ起動なし）
 * @param {string} root
 */
export async function buildVerificationIndex(root, opts = {}) {
  return writeScreenshotsIndex(root, opts);
}
