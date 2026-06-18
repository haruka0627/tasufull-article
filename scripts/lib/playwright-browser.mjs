/**
 * Playwright headless lifecycle helpers — browser registry + guaranteed cleanup
 *
 * Importing this module registers process-level handlers (once) so orphaned
 * chrome-headless-shell / Chrome child processes are closed on:
 *   SIGINT, SIGTERM, uncaughtException, unhandledRejection, beforeExit
 */
import { chromium as playwrightChromium } from "playwright";

export const HEADLESS_LAUNCH_ARGS = Object.freeze([
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--mute-audio",
  "--renderer-process-limit=4",
]);

/** @type {Set<import('playwright').Browser>} */
const activeBrowsers = new Set();
let cleanupInstalled = false;
let shuttingDown = false;

/**
 * @param {import('playwright').Browser} browser
 */
function trackBrowser(browser) {
  activeBrowsers.add(browser);
  browser.on("disconnected", () => {
    activeBrowsers.delete(browser);
  });
}

export async function closeAllBrowsers() {
  const browsers = [...activeBrowsers];
  activeBrowsers.clear();
  await Promise.all(
    browsers.map(async (browser) => {
      try {
        if (browser.isConnected()) await browser.close();
      } catch {
        /* ignore */
      }
    })
  );
}

function installPlaywrightCleanupHandlers() {
  if (cleanupInstalled) return;
  cleanupInstalled = true;

  const shutdown = async (label) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await closeAllBrowsers();
    } catch {
      /* ignore */
    }
    if (label) {
      console.error(`[playwright-browser] cleanup (${label}), active=${activeBrowsers.size}`);
    }
  };

  process.once("SIGINT", () => {
    shutdown("SIGINT").finally(() => process.exit(130));
  });

  process.once("SIGTERM", () => {
    shutdown("SIGTERM").finally(() => process.exit(143));
  });

  process.on("uncaughtException", (err) => {
    shutdown("uncaughtException").finally(() => {
      console.error(err);
      process.exit(1);
    });
  });

  process.on("unhandledRejection", (reason) => {
    shutdown("unhandledRejection").finally(() => {
      console.error("Unhandled rejection:", reason);
      process.exit(1);
    });
  });

  process.on("beforeExit", () => {
    if (activeBrowsers.size > 0) {
      shutdown("beforeExit").catch(() => null);
    }
  });
}

installPlaywrightCleanupHandlers();

/**
 * @param {import('playwright').LaunchOptions} [options]
 */
export async function launchHeadlessBrowser(options = {}) {
  const browser = await playwrightChromium.launch({
    headless: true,
    args: HEADLESS_LAUNCH_ARGS,
    ...options,
  });
  trackBrowser(browser);
  return browser;
}

/**
 * @template T
 * @param {(browser: import('playwright').Browser) => Promise<T>} fn
 * @param {import('playwright').LaunchOptions} [launchOptions]
 */
export async function withPlaywrightBrowser(fn, launchOptions = {}) {
  const browser = await launchHeadlessBrowser(launchOptions);
  try {
    return await fn(browser);
  } finally {
    try {
      if (browser.isConnected()) await browser.close();
    } catch {
      /* ignore */
    }
    activeBrowsers.delete(browser);
  }
}

/**
 * @template T
 * @param {(session: { browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page }) => Promise<T>} fn
 * @param {{ launch?: import('playwright').LaunchOptions, context?: import('playwright').BrowserContextOptions, viewport?: { width: number, height: number } }} [options]
 */
export async function withPlaywrightSession(fn, options = {}) {
  return withPlaywrightBrowser(async (browser) => {
    let context = null;
    let page = null;
    try {
      context = await browser.newContext(options.context || {});
      page = await context.newPage();
      if (options.viewport) {
        await page.setViewportSize(options.viewport);
      }
      return await fn({ browser, context, page });
    } finally {
      if (page) await page.close().catch(() => null);
      if (context) await context.close().catch(() => null);
    }
  }, options.launch);
}

/** @returns {number} */
export function getActiveBrowserCount() {
  return activeBrowsers.size;
}

/** Windows: chrome-headless-shell + chrome プロセス数 */
export async function countChromeProcesses() {
  if (process.platform !== "win32") return null;
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "@('chrome-headless-shell','chrome') | ForEach-Object { (Get-Process $_ -ErrorAction SilentlyContinue).Count } | Measure-Object -Sum | Select-Object -ExpandProperty Sum",
    ]);
    const n = Number(String(stdout).trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/** Windows: chrome-headless-shell の WorkingSet MB 合計 */
export async function readHeadlessShellRssMb() {
  if (process.platform !== "win32") return null;
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "(Get-Process chrome-headless-shell -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum",
    ]);
    const bytes = Number(String(stdout).trim());
    if (!Number.isFinite(bytes) || bytes <= 0) return 0;
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  } catch {
    return null;
  }
}

/** Tracked launch — use instead of playwright.chromium.launch directly */
export const chromium = {
  /**
   * @param {import('playwright').LaunchOptions} [options]
   */
  launch(options) {
    return launchHeadlessBrowser(options);
  },
};

export { playwrightChromium };
