#!/usr/bin/env node
/**
 * Talk プロフィールカード — UI レビュー用スクリーンショット
 *
 *   npm run dev 起動後:
 *   node scripts/capture-talk-profile-card-ui-review.mjs
 *
 * 出力: reports/ui-review/talk-profile-card/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  installTalkReviewStagingIsolation,
  reportTalkReviewStagingIsolation,
} from "./lib/ui-review-capture.mjs";

const OUT_DIR = join(process.cwd(), "reports", "ui-review", "talk-profile-card");
const THREAD_ID = "talk-mock-friend-001";
const THREADS_KEY = "tasful_chat_threads";

const REVIEW_AVATAR_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="114" height="114" viewBox="0 0 114 114">' +
      '<rect width="114" height="114" fill="#fff6df"/>' +
      '<circle cx="57" cy="57" r="34" fill="#7a5710"/>' +
      "</svg>"
  );
const REVIEW_COVER_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520">' +
      '<rect width="1200" height="520" fill="#2563eb"/>' +
      '<rect x="80" y="100" width="1040" height="320" fill="#3b82f6"/>' +
      "</svg>"
  );

/** Repo-root-relative path with `/` separators (for report.json only). */
function toRepoRelativePath(filepath) {
  return relative(process.cwd(), filepath).replaceAll("\\", "/");
}

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });

/** @type {string[]} */
const consoleErrors = [];
/** @type {string[]} */
const overflowIssues = [];

function buildFriendThread(withCover) {
  const profile = {
    user_id: "u_demo_friend_001",
    display_name: "田中 一郎",
    profile_image: REVIEW_AVATAR_DATA_URL,
  };
  if (withCover) {
    profile.cover_image = REVIEW_COVER_DATA_URL;
  }
  return {
    id: THREAD_ID,
    chatDomain: "friend",
    threadKind: "direct",
    partnerUserId: "u_demo_friend_001",
    partnerProfile: profile,
    partner: {
      id: "u_demo_friend_001",
      displayName: "田中 一郎",
      profile_image: REVIEW_AVATAR_DATA_URL,
      ...(withCover ? { cover_image: REVIEW_COVER_DATA_URL } : {}),
    },
    lastMessagePreview: "こんにちは",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Seed friend thread for a shot. Clears only the partner user entry from
 * `tasful_talk_profiles_v1` so prior shots cannot leak cover_image into later shots.
 * @returns {Promise<{ storageKey: string, userId: string, deleted: boolean }>}
 */
async function seedThread(page, withCover, shotLabel = "") {
  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), { waitUntil: "domcontentloaded" });
  const isolation = await page.evaluate(
    ({ threadsKey, thread }) => {
      const storageKey =
        (typeof window.TasuTalkChatProfile?.STORAGE_KEY === "string" &&
          window.TasuTalkChatProfile.STORAGE_KEY) ||
        "tasful_talk_profiles_v1";
      const userId = String(thread.partnerUserId || thread.partner?.id || "").trim();
      let deleted = false;
      if (userId) {
        try {
          const raw = localStorage.getItem(storageKey);
          const cache = raw ? JSON.parse(raw) : {};
          if (cache && typeof cache === "object") {
            deleted = Object.prototype.hasOwnProperty.call(cache, userId);
            delete cache[userId];
            localStorage.setItem(storageKey, JSON.stringify(cache));
          }
        } catch {
          localStorage.removeItem(storageKey);
          deleted = true;
        }
      }
      localStorage.setItem(threadsKey, JSON.stringify([thread]));
      return { storageKey, userId, deleted };
    },
    { threadsKey: THREADS_KEY, thread: buildFriendThread(withCover) }
  );
  console.log(
    `[profile-cache] shot=${shotLabel || "?"} key=${isolation.storageKey} userId=${isolation.userId || "(none)"} deleted=${isolation.deleted ? "yes" : "no"}`
  );
  return isolation;
}

async function openProfileCard(page) {
  await page.goto(buildLocalPageUrl(base, "talk-home.html?tab=chat"), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const rowSel = `[data-talk-select-thread][data-talk-thread-id="${THREAD_ID}"]`;
  await page.locator(rowSel).first().waitFor({ state: "visible", timeout: 20000 });
  await page.evaluate((threadId) => {
    const Card = window.TasuTalkProfileCard;
    if (!Card?.buildPayloadFromThread || !Card?.showTalkProfileCard) {
      throw new Error("TasuTalkProfileCard API missing");
    }
    const fromStore = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId);
    const fromList = (window.TasuChatThreadStore?.getAllForChatList?.() || []).find((t) => String(t.id) === threadId);
    const fromLs = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]").find(
      (t) => String(t.id) === threadId
    );
    const thread = fromStore || fromList || fromLs || null;
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    Card.showTalkProfileCard(Card.buildPayloadFromThread(thread));
  }, THREAD_ID);
  await page.locator("[data-talk-profile-card]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400);
}

async function applyDualHoverStyles(page) {
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "ui-review-profile-hover-sim";
    style.textContent =
      ".talk-profile-card__close, .talk-profile-card__favorite { background: rgba(30, 41, 59, 0.72) !important; }";
    document.head.appendChild(style);
  });
}

async function checkOverflow(page, label) {
  const result = await page.evaluate(() => {
    const panel = document.querySelector(".talk-profile-card__panel");
    if (!panel) return { ok: false, issues: ["profile panel not found"] };

    /** @type {string[]} */
    const issues = [];
    const probe = (el, name) => {
      if (!el) return;
      if (el.scrollWidth > el.clientWidth + 1) {
        issues.push(`${name}: horizontal overflow (${el.scrollWidth} > ${el.clientWidth})`);
      }
      if (el.scrollHeight > el.clientHeight + 1) {
        issues.push(`${name}: vertical overflow (${el.scrollHeight} > ${el.clientHeight})`);
      }
    };

    probe(panel, "panel");

    const cardRoot = document.querySelector("[data-talk-profile-card]:not([hidden])");
    probe(cardRoot, "cardRoot");

    return { ok: issues.length === 0, issues };
  });

  if (!result.ok) {
    overflowIssues.push(`${label}: ${result.issues.join("; ")}`);
  }
  return result;
}

async function captureShot(page, filename, viewport, options = {}) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  if (options.withCover !== undefined) {
    await seedThread(page, options.withCover, filename);
  }
  await openProfileCard(page);

  if (options.hoverActions) {
    await applyDualHoverStyles(page);
    await page.waitForTimeout(200);
  }

  const overflow = await checkOverflow(page, filename);
  await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false });
  return { filename, viewport: viewport.label, overflow };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n=== Talk profile card UI review capture ===`);
  console.log(`Base: ${base}`);
  console.log(`Output: ${OUT_DIR}\n`);

  /** @type {Array<Record<string, unknown>>} */
  const shots = [];

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(String(err?.message || err));
    });
    const stagingHits = await installTalkReviewStagingIsolation(page);

    shots.push(
      await captureShot(page, "001-default.png", { width: 1280, height: 900, label: "1280" }, { withCover: false })
    );
    shots.push(
      await captureShot(page, "002-cover-photo.png", { width: 1280, height: 900, label: "1280" }, { withCover: true })
    );
    shots.push(
      await captureShot(page, "003-hover-actions.png", { width: 1280, height: 900, label: "1280" }, {
        withCover: true,
        hoverActions: true,
      })
    );
    shots.push(
      await captureShot(page, "004-mobile-390.png", { width: 390, height: 844, label: "390" }, { withCover: true })
    );
    shots.push(
      await captureShot(page, "005-tablet-768.png", { width: 768, height: 1024, label: "768" }, { withCover: true })
    );

    await stagingHits.collectRealtimeStats();
    reportTalkReviewStagingIsolation(stagingHits);
    await page.close();
  }, { headless: true });

  await closeAllBrowsers();

  const uniqueErrors = [...new Set(consoleErrors.filter(Boolean))];
  const report = {
    feature: "talk-profile-card",
    capturedAt: new Date().toISOString(),
    baseUrl: base,
    outDir: toRepoRelativePath(OUT_DIR),
    consoleErrorCount: uniqueErrors.length,
    consoleErrors: uniqueErrors,
    overflowOk: overflowIssues.length === 0,
    overflowIssues,
    shots,
  };
  const reportPath = join(OUT_DIR, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\nCaptured:");
  for (const s of shots) {
    console.log(`  ${s.filename} (${s.viewport}) overflow: ${s.overflow.ok ? "OK" : "FAIL"}`);
  }
  console.log(`\nConsole errors: ${uniqueErrors.length}`);
  if (uniqueErrors.length) uniqueErrors.forEach((e) => console.log(`  - ${e}`));
  console.log(`Overflow issues: ${overflowIssues.length}`);
  if (overflowIssues.length) overflowIssues.forEach((e) => console.log(`  - ${e}`));
  console.log(`Report: ${reportPath}`);

  if (uniqueErrors.length || overflowIssues.length) {
    console.error("\nFAIL talk-profile-card UI review capture");
    process.exitCode = 1;
    return;
  }
  console.log("\nPASS talk-profile-card UI review capture");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
