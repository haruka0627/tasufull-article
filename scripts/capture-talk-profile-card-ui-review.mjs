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

/** Selectors shared with scripts/verify-talk-profile-card.mjs. */
const CARD_SEL = "[data-talk-profile-card]";
const CARD_OPEN_SEL = "[data-talk-profile-card]:not([hidden])";
const PANEL_SEL = ".talk-profile-card__panel";
const COVER_SEL = "[data-talk-profile-cover]";
const NAME_SEL = "[data-talk-profile-name]";
const AVATAR_SEL = "[data-talk-profile-avatar] img";
const FAVORITE_SEL = "[data-talk-profile-favorite]";
const HOVER_TARGET_SEL = ".talk-profile-card__panel";
const HOVER_ACTION_SEL = ".talk-profile-card__close";
const FRIEND_ROW_SEL = `[data-talk-select-thread][data-talk-thread-id="${THREAD_ID}"]`;
const EXPECTED_PARTNER_USER_ID = "u_demo_friend_001";
const EXPECTED_DISPLAY_NAME = "田中 一郎";

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
/** @type {string[]} */
const assertionIssues = [];

function head(value, len = 60) {
  const text = String(value ?? "");
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

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

async function readActionStyle(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { background: "", opacity: "" };
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, opacity: style.opacity };
  }, HOVER_ACTION_SEL);
}

/**
 * Simulate the hover state and keep the pointer on the card while the shot is taken.
 * Style change is diagnostic only (focus may already match hover colors).
 * @returns {Promise<{
 *   beforeBackground: string,
 *   afterBackground: string,
 *   beforeOpacity: string,
 *   afterOpacity: string,
 *   hoverStyleChanged: boolean,
 *   hoverError: string
 * }>}
 */
async function applyHoverActions(page) {
  const before = await readActionStyle(page);
  await applyDualHoverStyles(page);
  let hoverError = "";
  try {
    await page.locator(HOVER_TARGET_SEL).first().hover({ timeout: 5000 });
  } catch (err) {
    hoverError = String(err?.message || err).split("\n")[0];
  }
  await page.waitForTimeout(200);
  const after = await readActionStyle(page);
  const hoverStyleChanged =
    before.background !== after.background || before.opacity !== after.opacity;
  return {
    beforeBackground: before.background,
    afterBackground: after.background,
    beforeOpacity: before.opacity,
    afterOpacity: after.opacity,
    hoverStyleChanged,
    hoverError,
  };
}

/**
 * Wait until the card is rendered in its expected state. Failures are returned
 * (not thrown) so the diagnostic snapshot below can still be logged.
 * @returns {Promise<string[]>}
 */
async function waitForCardState(page, expectCoverMode, expectHover) {
  /** @type {string[]} */
  const waitFailures = [];
  const wait = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      waitFailures.push(`${name}: ${String(err?.message || err).split("\n")[0]}`);
    }
  };

  await wait("card visible", () =>
    page.locator(CARD_OPEN_SEL).first().waitFor({ state: "visible", timeout: 8000 })
  );
  await wait("panel bounding box", () =>
    page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      },
      PANEL_SEL,
      { timeout: 8000 }
    )
  );
  await wait("display name", () =>
    page.waitForFunction(
      ({ sel, expected }) => (document.querySelector(sel)?.textContent || "").includes(expected),
      { sel: NAME_SEL, expected: EXPECTED_DISPLAY_NAME },
      { timeout: 8000 }
    )
  );
  await wait(`cover mode=${expectCoverMode}`, () =>
    page.waitForFunction(
      ({ sel, expected }) => document.querySelector(sel)?.dataset?.talkProfileCoverMode === expected,
      { sel: COVER_SEL, expected: expectCoverMode },
      { timeout: 8000 }
    )
  );
  await wait("avatar decoded", () =>
    page.waitForFunction(
      (sel) => {
        const img = document.querySelector(sel);
        return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
      },
      AVATAR_SEL,
      { timeout: 8000 }
    )
  );
  if (expectCoverMode === "photo") {
    await wait("cover image decoded", () =>
      page.waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const bg = getComputedStyle(el).backgroundImage || "";
          return bg.startsWith("url(") && bg.includes("data:image/svg+xml");
        },
        COVER_SEL,
        { timeout: 8000 }
      )
    );
  }
  if (expectHover) {
    await wait("hover action visible", () =>
      page.waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0 &&
            box.width > 0 &&
            box.height > 0
          );
        },
        HOVER_ACTION_SEL,
        { timeout: 8000 }
      )
    );
  }
  return waitFailures;
}

/** Snapshot the rendered card state used for both logging and assertions. */
async function readCardState(page) {
  return page.evaluate(async (sel) => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    const isVisible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        box.width > 0 &&
        box.height > 0
      );
    };

    const root = document.querySelector(sel.card);
    const panel = document.querySelector(sel.panel);
    const cover = document.querySelector(sel.cover);
    const avatar = document.querySelector(sel.avatar);
    const favorite = document.querySelector(sel.favorite);
    const hoverAction = document.querySelector(sel.hoverAction);

    const panelBox = rectOf(panel);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const inViewport = Boolean(
      panelBox &&
        panelBox.width > 0 &&
        panelBox.height > 0 &&
        panelBox.x < viewport.width &&
        panelBox.y < viewport.height &&
        panelBox.x + panelBox.width > 0 &&
        panelBox.y + panelBox.height > 0
    );

    const coverBg = cover ? getComputedStyle(cover).backgroundImage || "" : "";
    const coverMatch = coverBg.match(/url\((["']?)(.*?)\1\)/);
    const coverSrc = coverMatch ? coverMatch[2] : "";
    let coverLoaded = false;
    let coverNatural = null;
    if (coverSrc) {
      try {
        const probe = new Image();
        probe.src = coverSrc;
        await probe.decode();
        coverLoaded = probe.naturalWidth > 0 && probe.naturalHeight > 0;
        coverNatural = { width: probe.naturalWidth, height: probe.naturalHeight };
      } catch {
        coverLoaded = false;
      }
    }

    return {
      cardPresent: Boolean(root),
      cardHidden: root ? Boolean(root.hidden) : null,
      cardVisible: isVisible(root),
      rootBox: rectOf(root),
      panelPresent: Boolean(panel),
      panelBox,
      inViewport,
      viewport,
      scrollY: Math.round(window.scrollY),
      documentHeight: Math.round(document.documentElement.scrollHeight),
      friendRowPresent: Boolean(document.querySelector(sel.friendRow)),
      displayName: (document.querySelector(sel.name)?.textContent || "").trim(),
      coverMode: cover?.dataset?.talkProfileCoverMode || "",
      coverPhotoClass: Boolean(cover?.classList?.contains("talk-profile-card__cover--photo")),
      coverGradientClass: Boolean(cover?.classList?.contains("talk-profile-card__cover--gradient")),
      coverBox: rectOf(cover),
      coverSrc,
      coverLoaded,
      coverNatural,
      avatarPresent: Boolean(avatar),
      avatarSrc: avatar?.getAttribute("src") || "",
      avatarLoaded: Boolean(avatar && avatar.complete && avatar.naturalWidth > 0 && avatar.naturalHeight > 0),
      avatarNatural: avatar ? { width: avatar.naturalWidth, height: avatar.naturalHeight } : null,
      favoritePresent: Boolean(favorite),
      favoriteHidden: favorite ? Boolean(favorite.hidden) : null,
      hoverActionPresent: Boolean(hoverAction),
      hoverActionVisible: isVisible(hoverAction),
      hoverActionBox: rectOf(hoverAction),
      hoverActionPointerEvents: hoverAction ? getComputedStyle(hoverAction).pointerEvents : "",
      hoverActionInsidePanel: (() => {
        const actionBox = rectOf(hoverAction);
        if (!actionBox || !panelBox) return false;
        return (
          actionBox.x >= panelBox.x &&
          actionBox.y >= panelBox.y &&
          actionBox.x + actionBox.width <= panelBox.x + panelBox.width &&
          actionBox.y + actionBox.height <= panelBox.y + panelBox.height
        );
      })(),
    };
  }, {
    card: CARD_SEL,
    panel: PANEL_SEL,
    cover: COVER_SEL,
    name: NAME_SEL,
    avatar: AVATAR_SEL,
    favorite: FAVORITE_SEL,
    hoverAction: HOVER_ACTION_SEL,
    friendRow: FRIEND_ROW_SEL,
  });
}

function logCardState(label, state, hoverInfo, waitFailures) {
  const box = state.panelBox
    ? `${state.panelBox.x},${state.panelBox.y},${state.panelBox.width},${state.panelBox.height}`
    : "(none)";
  console.log(`[shot] ${label}`);
  console.log(`  card=${CARD_SEL} visible=${state.cardVisible} hidden=${state.cardHidden} inViewport=${state.inViewport}`);
  console.log(`  box=${box} viewport=${state.viewport.width}x${state.viewport.height} scrollY=${state.scrollY} docHeight=${state.documentHeight}`);
  console.log(`  name="${state.displayName}" friendRow=${state.friendRowPresent} partnerUserId(expected)=${EXPECTED_PARTNER_USER_ID}`);
  console.log(`  mode=${state.coverMode || "(none)"} photoClass=${state.coverPhotoClass} gradientClass=${state.coverGradientClass}`);
  console.log(`  cover=${state.coverSrc ? head(state.coverSrc, 60) : "(none)"} loaded=${state.coverLoaded}`);
  console.log(`  avatar=${state.avatarSrc ? head(state.avatarSrc, 60) : "(none)"} loaded=${state.avatarLoaded}`);
  console.log(
    `  hoverAction=${HOVER_ACTION_SEL} visible=${state.hoverActionVisible}` +
      ` insidePanel=${state.hoverActionInsidePanel}` +
      ` pointerEvents=${state.hoverActionPointerEvents || "(none)"}` +
      ` favoriteHidden=${state.favoriteHidden}` +
      (hoverInfo
        ? ` hoverStyleChanged=${hoverInfo.hoverStyleChanged}` +
          ` bg=${hoverInfo.beforeBackground}->${hoverInfo.afterBackground}` +
          ` error=${hoverInfo.hoverError || "(none)"}`
        : "")
  );
  if (waitFailures.length) {
    waitFailures.forEach((f) => console.log(`  wait-failed: ${f}`));
  }
}

function evaluateShotIssues(label, state, { expectCoverMode, expectHover, hoverInfo, waitFailures }) {
  /** @type {string[]} */
  const issues = [];
  waitFailures.forEach((f) => issues.push(`${label}: wait failed — ${f}`));

  if (!state.cardPresent) issues.push(`${label}: profile card element missing`);
  if (state.cardHidden) issues.push(`${label}: profile card is hidden`);
  if (!state.cardVisible) issues.push(`${label}: profile card is not visibly rendered`);
  if (!state.panelBox || state.panelBox.width <= 0 || state.panelBox.height <= 0) {
    issues.push(`${label}: profile card panel has no bounding box`);
  }
  if (!state.inViewport) {
    issues.push(
      `${label}: profile card is outside the viewport (box=${JSON.stringify(state.panelBox)} viewport=${state.viewport.width}x${state.viewport.height})`
    );
  }
  if (!state.displayName.includes(EXPECTED_DISPLAY_NAME)) {
    issues.push(`${label}: unexpected display name "${state.displayName}"`);
  }

  if (state.coverMode !== expectCoverMode) {
    issues.push(`${label}: expected cover mode ${expectCoverMode}, got ${state.coverMode || "(none)"}`);
  }
  if (expectCoverMode === "photo") {
    if (!state.coverPhotoClass) issues.push(`${label}: cover photo class missing`);
    if (state.coverGradientClass) issues.push(`${label}: cover gradient class unexpectedly present`);
    if (!state.coverSrc.startsWith("data:image/svg+xml")) {
      issues.push(`${label}: cover src is not the review data URL (${head(state.coverSrc, 40) || "(none)"})`);
    }
    if (!state.coverLoaded) issues.push(`${label}: cover image did not decode`);
  } else {
    if (!state.coverGradientClass) issues.push(`${label}: cover gradient class missing`);
    if (state.coverPhotoClass) issues.push(`${label}: cover photo class unexpectedly present`);
    if (state.coverSrc) issues.push(`${label}: gradient cover unexpectedly has an image (${head(state.coverSrc, 40)})`);
  }

  if (!state.avatarPresent) issues.push(`${label}: avatar image element missing`);
  if (!state.avatarSrc.startsWith("data:image/svg+xml")) {
    issues.push(`${label}: avatar src is not the review data URL (${head(state.avatarSrc, 40) || "(none)"})`);
  }
  if (!state.avatarLoaded) issues.push(`${label}: avatar image did not decode`);

  if (expectHover) {
    if (hoverInfo?.hoverError) issues.push(`${label}: hover failed — ${hoverInfo.hoverError}`);
    if (!state.hoverActionPresent) issues.push(`${label}: hover action element missing`);
    if (!state.hoverActionVisible) issues.push(`${label}: hover action element is not visible`);
    if (!state.hoverActionBox || state.hoverActionBox.width <= 0 || state.hoverActionBox.height <= 0) {
      issues.push(`${label}: hover action has no bounding box`);
    }
    if (!state.hoverActionInsidePanel) {
      issues.push(`${label}: hover action is outside the profile panel`);
    }
    if (state.hoverActionPointerEvents === "none") {
      issues.push(`${label}: hover action has pointer-events:none`);
    }
    // hoverStyleChanged is diagnostic only — focus may already match hover colors.
  }
  return issues;
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

  const expectCoverMode = options.withCover ? "photo" : "gradient";
  const expectHover = Boolean(options.hoverActions);
  const hoverInfo = expectHover ? await applyHoverActions(page) : null;

  const waitFailures = await waitForCardState(page, expectCoverMode, expectHover);
  const state = await readCardState(page);
  logCardState(filename, state, hoverInfo, waitFailures);
  assertionIssues.push(
    ...evaluateShotIssues(filename, state, { expectCoverMode, expectHover, hoverInfo, waitFailures })
  );

  const overflow = await checkOverflow(page, filename);
  await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false });
  return {
    filename,
    viewport: viewport.label,
    overflow,
    coverMode: state.coverMode,
    cardVisible: state.cardVisible,
    cardInViewport: state.inViewport,
    cardBox: state.panelBox,
    avatarLoaded: state.avatarLoaded,
    coverLoaded: state.coverLoaded,
    hoverActionVisible: expectHover ? state.hoverActionVisible : null,
    hoverActionInsidePanel: expectHover ? state.hoverActionInsidePanel : null,
    hoverStyleChanged: expectHover ? Boolean(hoverInfo?.hoverStyleChanged) : null,
  };
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
    assertionOk: assertionIssues.length === 0,
    assertionIssues,
    shots,
  };
  const reportPath = join(OUT_DIR, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\nCaptured:");
  for (const s of shots) {
    const box = s.cardBox ? `${s.cardBox.x},${s.cardBox.y},${s.cardBox.width},${s.cardBox.height}` : "(none)";
    console.log(
      `  ${s.filename} (${s.viewport}) overflow: ${s.overflow.ok ? "OK" : "FAIL"} mode=${s.coverMode || "(none)"} visible=${s.cardVisible} inViewport=${s.cardInViewport} box=${box}`
    );
  }
  console.log(`\nConsole errors: ${uniqueErrors.length}`);
  if (uniqueErrors.length) uniqueErrors.forEach((e) => console.log(`  - ${e}`));
  console.log(`Overflow issues: ${overflowIssues.length}`);
  if (overflowIssues.length) overflowIssues.forEach((e) => console.log(`  - ${e}`));
  console.log(`Assertion issues: ${assertionIssues.length}`);
  if (assertionIssues.length) assertionIssues.forEach((e) => console.log(`  - ${e}`));
  console.log(`Report: ${reportPath}`);

  if (uniqueErrors.length || overflowIssues.length || assertionIssues.length) {
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
