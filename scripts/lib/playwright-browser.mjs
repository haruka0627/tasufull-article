/**
 * Playwright headless lifecycle helpers — page/context/browser close を finally で保証
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

/**
 * @param {import('playwright').LaunchOptions} [options]
 */
export async function launchHeadlessBrowser(options = {}) {
  return playwrightChromium.launch({
    headless: true,
    args: HEADLESS_LAUNCH_ARGS,
    ...options,
  });
}

/**
 * @template T
 * @param {(session: { browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page }) => Promise<T>} fn
 * @param {{ launch?: import('playwright').LaunchOptions, context?: import('playwright').BrowserContextOptions, viewport?: { width: number, height: number } }} [options]
 */
export async function withPlaywrightSession(fn, options = {}) {
  const browser = await launchHeadlessBrowser(options.launch);
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
    await browser.close().catch(() => null);
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

export { playwrightChromium as chromium };
