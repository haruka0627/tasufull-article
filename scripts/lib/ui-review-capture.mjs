/**
 * UI レビュー用 Playwright スクリーンショット — 共通ユーティリティ
 *
 * 保存先: reports/ui-review/{feature}/
 * 命名: {NNN}-{slug}-{viewport}.png  （例: 001-home-1280.png）
 *
 *   import { createUiReviewSession, UI_REVIEW_VIEWPORTS } from "./lib/ui-review-capture.mjs";
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BUILDER_QA_VIEWPORTS } from "./playwright-viewport.mjs";

/** @typedef {{ id: string, width: number, height: number, label: string }} UiReviewViewport */

export const UI_REVIEW_VIEWPORTS = BUILDER_QA_VIEWPORTS;

const DEFAULT_VIEWPORT_IDS = Object.freeze(["1280", "768", "390"]);

/** Repo-root-relative path with `/` separators (for report.json only). */
function toRepoRelativePath(filepath) {
  return relative(process.cwd(), filepath).replaceAll("\\", "/");
}

/**
 * @param {string} featureName
 */
export function uiReviewOutputDir(featureName) {
  const safe = String(featureName || "ui")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return join(process.cwd(), "reports", "ui-review", safe || "ui");
}

/**
 * @param {import('playwright').Page} page
 */
export function attachUiReviewConsole(page) {
  /** @type {string[]} */
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(String(err?.message || err));
  });
  return errors;
}

/** Staging project used by local Talk review pages (isolate only known probes). */
export const TALK_REVIEW_STAGING_HOST = "ahlxuyvhzqdqaojiywmu.supabase.co";

/**
 * Deterministic isolation for Talk UI review scripts.
 * HTTP mocks only:
 * - POST /functions/v1/gemini-chat
 * - GET  /rest/v1/transaction_rooms?select=id&limit=1
 * Realtime: no-op stub of staging Supabase client.channel / removeChannel (no product code change).
 * Other Staging HTTP requests are recorded then continued (so they stay visible).
 *
 * @param {import('playwright').Page} page
 */
export async function installTalkReviewStagingIsolation(page) {
  /** @type {{
   *   geminiChat: number,
   *   transactionRooms: number,
   *   unexpected: Array<{ method: string, url: string, pathname: string }>,
   *   realtime: null | {
   *     installed: boolean,
   *     channels: number,
   *     subscribes: number,
   *     unsubscribes: number,
   *     topics: string[],
   *     unexpectedRealtime: number,
   *   },
   * }} */
  const hits = {
    geminiChat: 0,
    transactionRooms: 0,
    unexpected: [],
    realtime: null,
  };

  await page.addInitScript((stagingHost) => {
    const stats = {
      installed: true,
      channels: 0,
      subscribes: 0,
      unsubscribes: 0,
      topics: /** @type {string[]} */ ([]),
      unexpectedRealtime: 0,
    };
    window.__TASUFUL_TALK_REVIEW_REALTIME_STATS__ = stats;

    function makeMockChannel(topic) {
      stats.channels += 1;
      stats.topics.push(String(topic || ""));
      const channel = {
        topic: String(topic || ""),
        on() {
          return channel;
        },
        subscribe(callback) {
          stats.subscribes += 1;
          queueMicrotask(() => {
            try {
              if (typeof callback === "function") callback("SUBSCRIBED");
            } catch {
              /* ignore */
            }
          });
          return channel;
        },
        unsubscribe() {
          stats.unsubscribes += 1;
          return Promise.resolve("ok");
        },
      };
      return channel;
    }

    function patchClient(client, url) {
      if (!client || client.__tasuTalkReviewRealtimePatched) return client;
      let hostOk = false;
      try {
        hostOk = new URL(String(url || "")).hostname === stagingHost;
      } catch {
        hostOk = false;
      }
      if (!hostOk) return client;

      client.__tasuTalkReviewRealtimePatched = true;
      client.channel = function (name) {
        return makeMockChannel(name);
      };
      client.removeChannel = function (channel) {
        stats.unsubscribes += 1;
        try {
          if (channel && typeof channel.unsubscribe === "function") channel.unsubscribe();
        } catch {
          /* ignore */
        }
        return "ok";
      };
      try {
        if (client.realtime && typeof client.realtime === "object") {
          client.realtime.connect = function () {};
          client.realtime.disconnect = function () {};
        }
      } catch {
        /* ignore */
      }
      return client;
    }

    function patchCreateClient(api) {
      if (!api?.createClient || api.__tasuTalkReviewCreatePatched) return;
      api.__tasuTalkReviewCreatePatched = true;
      const orig = api.createClient.bind(api);
      api.createClient = function (url, key, options) {
        return patchClient(orig(url, key, options), url);
      };
    }

    let stored = window.supabase;
    Object.defineProperty(window, "supabase", {
      configurable: true,
      enumerable: true,
      get() {
        return stored;
      },
      set(value) {
        stored = value;
        patchCreateClient(value);
      },
    });
    if (stored) patchCreateClient(stored);
  }, TALK_REVIEW_STAGING_HOST);

  await page.route(`https://${TALK_REVIEW_STAGING_HOST}/**`, async (route) => {
    const request = route.request();
    const rawUrl = request.url();
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      hits.unexpected.push({ method: request.method(), url: rawUrl, pathname: "" });
      await route.continue();
      return;
    }

    const method = request.method();
    const pathname = url.pathname;

    if (method === "OPTIONS" && (pathname === "/functions/v1/gemini-chat" || pathname === "/rest/v1/transaction_rooms")) {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
      return;
    }

    if (pathname === "/functions/v1/gemini-chat") {
      hits.geminiChat += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
        },
        // Gateway treats empty reply as usedRemote:false (no-op for Talk review UI).
        body: JSON.stringify({ reply: "" }),
      });
      return;
    }

    if (
      pathname === "/rest/v1/transaction_rooms" &&
      url.searchParams.get("select") === "id" &&
      url.searchParams.get("limit") === "1"
    ) {
      hits.transactionRooms += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "content-range": "*/0",
          "content-type": "application/json; charset=utf-8",
        },
        body: "[]",
      });
      return;
    }

    hits.unexpected.push({ method, url: rawUrl, pathname });
    await route.continue();
  });

  hits.collectRealtimeStats = async () => {
    hits.realtime = await page.evaluate(() => window.__TASUFUL_TALK_REVIEW_REALTIME_STATS__ || null);
    return hits.realtime;
  };

  return hits;
}

/**
 * @param {{
 *   geminiChat: number,
 *   transactionRooms: number,
 *   unexpected: Array<{ method: string, url: string, pathname: string }>,
 *   realtime?: null | {
 *     installed?: boolean,
 *     channels?: number,
 *     subscribes?: number,
 *     unsubscribes?: number,
 *     topics?: string[],
 *     unexpectedRealtime?: number,
 *   },
 *   collectRealtimeStats?: () => Promise<unknown>,
 * }} hits
 */
export function reportTalkReviewStagingIsolation(hits) {
  console.log("Talk review staging isolation:");
  console.log(`  gemini-chat mock hits: ${hits.geminiChat}`);
  console.log(`  transaction_rooms mock hits: ${hits.transactionRooms}`);
  console.log(`  unexpected Staging Supabase requests: ${hits.unexpected.length}`);
  for (const row of hits.unexpected) {
    console.log(`    ${row.method} ${row.url}`);
  }
  const rt = hits.realtime;
  console.log(`  realtime isolation installed: ${rt?.installed ? "yes" : "no"}`);
  console.log(`  realtime channel creates: ${rt?.channels ?? 0}`);
  console.log(`  realtime subscribes: ${rt?.subscribes ?? 0}`);
  console.log(`  realtime unsubscribes: ${rt?.unsubscribes ?? 0}`);
  console.log(`  realtime topics: ${(rt?.topics || []).join(", ") || "(none)"}`);
  console.log(`  unexpected Realtime endpoints: ${rt?.unexpectedRealtime ?? 0}`);
}

/**
 * Sum of every files[].consoleErrors length across steps (source of truth for report totals).
 * @param {Array<Record<string, unknown>>} stepList
 */
export function sumUiReviewFileConsoleErrors(stepList) {
  /** @type {string[]} */
  const all = [];
  for (const step of stepList || []) {
    for (const file of /** @type {Array<{ consoleErrors?: string[] }>} */ (step?.files || [])) {
      for (const err of file.consoleErrors || []) {
        if (err) all.push(err);
      }
    }
  }
  return all;
}

/**
 * @param {string} featureName
 * @param {{
 *   viewports?: string[],
 *   baseUrl?: string,
 *   preparePage?: (page: import('playwright').Page) => Promise<void>,
 * }} [opts]
 *
 * `preparePage` runs for every shot page (primary + secondary) after creation and
 * before console listeners / beforeGoto / first navigation. Opt-in; Talk uses it
 * for Staging isolation. Other callers omit it and keep prior behavior aside from
 * consoleErrorCount now matching files[].consoleErrors totals.
 */
export function createUiReviewSession(featureName, opts = {}) {
  const outDir = uiReviewOutputDir(featureName);
  mkdirSync(outDir, { recursive: true });

  /** @type {number} */
  let stepCounter = 0;

  /** @type {Array<Record<string, unknown>>} */
  const steps = [];

  /** @type {string[]} */
  const allConsoleErrors = [];

  const defaultViewportIds = opts.viewports || DEFAULT_VIEWPORT_IDS;
  const preparePage = typeof opts.preparePage === "function" ? opts.preparePage : null;

  const viewportMap = new Map(UI_REVIEW_VIEWPORTS.map((vp) => [vp.id, vp]));

  /**
   * @param {import('playwright').Page} page
   * @param {import('playwright').Browser} browser
   * @param {{
   *   slug: string,
   *   label?: string,
   *   url: string,
   *   viewports?: string[],
   *   prepare?: (page: import('playwright').Page) => Promise<void>,
   *   beforeGoto?: (page: import('playwright').Page) => Promise<void>,
   *   waitFor?: string,
   *   fullPage?: boolean,
   *   skipGoto?: boolean,
   * }} step
   */
  async function captureStep(page, browser, step) {
    stepCounter += 1;
    const stepNum = String(stepCounter).padStart(3, "0");
    const vpIds = step.viewports || defaultViewportIds;
    /** @type {Array<{ viewport: string, path: string, httpStatus: number, consoleErrors: string[] }>} */
    const files = [];
    /** @type {string[]} */
    const stepErrors = [];

    for (const vpId of vpIds) {
      const vp = viewportMap.get(vpId);
      if (!vp) continue;

      const shotPage =
        vpId === vpIds[0] ? page : await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

      // Isolation / page setup must run before any navigation (including beforeGoto).
      if (preparePage) {
        await preparePage(shotPage);
      }

      const consoleErrors = attachUiReviewConsole(shotPage);

      if (step.beforeGoto) {
        await step.beforeGoto(shotPage);
      }

      let httpStatus = 0;
      try {
        if (!step.skipGoto) {
          const res = await shotPage.goto(step.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          httpStatus = res?.status() || 0;
        } else {
          httpStatus = 200;
        }
      } catch (err) {
        consoleErrors.push(`goto failed (${vpId}): ${String(err?.message || err)}`);
      }

      if (step.waitFor) {
        await shotPage.locator(step.waitFor).waitFor({ state: "visible", timeout: 20000 }).catch(() => null);
      }

      if (step.prepare) {
        await step.prepare(shotPage);
      }

      await shotPage.waitForTimeout(400);

      const filename = `${stepNum}-${step.slug}-${vpId}.png`;
      const filepath = join(outDir, filename);
      await shotPage.screenshot({ path: filepath, fullPage: step.fullPage === true });

      // Collect after navigation/prepare so the live array is populated.
      const fileConsoleErrors = [...consoleErrors];
      stepErrors.push(...fileConsoleErrors);
      allConsoleErrors.push(...fileConsoleErrors);

      files.push({
        viewport: vpId,
        path: toRepoRelativePath(filepath),
        httpStatus,
        consoleErrors: fileConsoleErrors,
      });

      if (shotPage !== page) await shotPage.close();
    }

    const fileConsoleTotal = files.reduce((n, f) => n + (f.consoleErrors?.length || 0), 0);
    const entry = {
      step: stepCounter,
      slug: step.slug,
      label: step.label || step.slug,
      url: step.url,
      files,
      consoleErrorCount: fileConsoleTotal,
    };
    steps.push(entry);

    console.log(
      `  [ui-review] STEP ${stepNum} ${step.slug} — ${files.length} shot(s) · console errors: ${fileConsoleTotal}`
    );

    return entry;
  }

  /**
   * @param {{ feature?: string, baseUrl?: string, extra?: Record<string, unknown> }} [meta]
   */
  function writeReport(meta = {}) {
    const fromFiles = sumUiReviewFileConsoleErrors(steps);
    const report = {
      feature: featureName,
      capturedAt: new Date().toISOString(),
      outDir: toRepoRelativePath(outDir),
      stepCount: stepCounter,
      consoleErrorCount: fromFiles.length,
      consoleErrors: fromFiles,
      steps,
      ...meta,
    };
    const reportPath = join(outDir, "report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\n[ui-review] report: ${reportPath}`);
    console.log(`[ui-review] console errors: ${fromFiles.length}`);
    return { report, reportPath, ok: fromFiles.length === 0 };
  }

  return {
    outDir,
    captureStep,
    writeReport,
    get consoleErrors() {
      return allConsoleErrors;
    },
  };
}
