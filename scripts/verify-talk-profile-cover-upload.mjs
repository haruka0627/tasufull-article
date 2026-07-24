#!/usr/bin/env node
/**
 * Talk プロフィールカード — カバー画像アップロード → カード反映
 *
 *   npm run dev 起動後:
 *   node scripts/verify-talk-profile-cover-upload.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures/completion-photo-1x1.png");
const PARTNER_ID = "u_hiro";
const VIEWER_ID = "u_sachi";
const THREAD_ID = "talk-cover-upload-verify";

const base = await findDevServerBaseUrl({ probePath: "profile-edit.html" });
const errors = [];

async function checkProfileEditOverflow(page, label) {
  const issues = await page.evaluate(() => {
    const block = document.querySelector("[data-profile-cover-block]");
    if (!block) return ["cover block not found"];
    const out = [];
    if (block.scrollWidth > block.clientWidth + 1) {
      out.push(`cover block horizontal ${block.scrollWidth} > ${block.clientWidth}`);
    }
    return out;
  });
  if (issues.length) errors.push(`${label} overflow: ${issues.join("; ")}`);
}

async function checkProfileCardOverflow(page, label) {
  const issues = await page.evaluate(() => {
    const panel = document.querySelector(".talk-profile-card__panel");
    const cardRoot = document.querySelector("[data-talk-profile-card]:not([hidden])");
    const out = [];
    const probe = (el, name) => {
      if (!el) return;
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`${name} horizontal ${el.scrollWidth} > ${el.clientWidth}`);
      }
    };
    probe(panel, "panel");
    probe(cardRoot, "cardRoot");
    return out;
  });
  if (issues.length) errors.push(`${label} overflow: ${issues.join("; ")}`);
}

await withPlaywrightBrowser(async (browser) => {
  for (const width of [1280, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/Failed to load resource.*401/.test(text)) return;
      consoleErrors.push(`[${width}] ${text}`);
    });

    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(
      ({ partnerId, viewerId, threadId }) => {
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({
            id: partnerId,
            nickname: "ひろ",
            display_name: "ひろ",
          })
        );
        localStorage.setItem("tasful_talk_profiles_v1", JSON.stringify({}));
        localStorage.setItem(
          "tasful_chat_threads",
          JSON.stringify([
            {
              id: threadId,
              chatDomain: "friend",
              threadKind: "direct",
              partnerUserId: partnerId,
              partner: { id: partnerId, displayName: "ひろ" },
              lastMessagePreview: "cover upload test",
              updatedAt: new Date().toISOString(),
            },
          ])
        );
        if (window.TASU_CHAT_SUPABASE_CONFIG) {
          window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = viewerId;
          window.TASU_CHAT_SUPABASE_CONFIG.me = { id: viewerId, displayName: "さちこ" };
        }
      },
      { partnerId: PARTNER_ID, viewerId: VIEWER_ID, threadId: THREAD_ID }
    );

    await page.goto(buildLocalPageUrl(base, "profile-edit.html"), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(600);

    const hasCoverBlock = await page.locator("[data-profile-cover-block]").count();
    if (hasCoverBlock < 1) errors.push(`[${width}] cover upload block missing`);

    const placeholderVisible = await page
      .locator("[data-profile-cover-placeholder]:not([hidden])")
      .isVisible()
      .catch(() => false);
    if (!placeholderVisible) errors.push(`[${width}] expected cover placeholder before upload`);

    await page.locator("[data-profile-cover-input]").setInputFiles(FIXTURE);
    await page.waitForTimeout(1200);

    const previewVisible = await page
      .locator("[data-profile-cover-preview]:not([hidden])")
      .isVisible()
      .catch(() => false);
    if (!previewVisible) errors.push(`[${width}] cover preview not visible after upload`);

    const storedCover = await page.evaluate(
      ({ partnerId }) => {
        const session = JSON.parse(localStorage.getItem("tasu_member_session") || "{}");
        const map = JSON.parse(localStorage.getItem("tasful_talk_profiles_v1") || "{}");
        return {
          sessionCover: session.cover_image || session.coverImage || "",
          profileCover: map[partnerId]?.cover_image || map[partnerId]?.coverImage || "",
        };
      },
      { partnerId: PARTNER_ID }
    );
    if (!storedCover.sessionCover) errors.push(`[${width}] session cover_image empty after upload`);
    if (!storedCover.profileCover) errors.push(`[${width}] talk profile store cover_image empty`);

    await checkProfileEditOverflow(page, `[${width}] profile-edit`);

    await page.goto(
      buildLocalPageUrl(base, `talk-home.html?tab=chat&userId=${VIEWER_ID}&talkDev=1`),
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await page.waitForTimeout(1000);

    const trigger = page.locator(`[data-talk-profile-trigger][data-talk-thread-id="${THREAD_ID}"]`).first();
    if ((await trigger.count()) < 1) {
      errors.push(`[${width}] profile trigger missing on talk-home`);
    } else {
      await trigger.click();
      await page.waitForTimeout(500);
      const coverMode = await page
        .locator("[data-talk-profile-cover]")
        .getAttribute("data-talk-profile-cover-mode");
      if (coverMode !== "photo") errors.push(`[${width}] expected profile card photo mode, got ${coverMode}`);
    }

    await checkProfileCardOverflow(page, `[${width}] profile-card`);

    if (consoleErrors.length) {
      errors.push(...consoleErrors.map((e) => `[${width}] console: ${e}`));
    }

    await page.close();
  }
}, { headless: true });

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL talk-profile-cover-upload\n");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("PASS talk-profile-cover-upload (1280 / 768 / 390)");
