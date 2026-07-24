import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const errors = [];

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem(
      "tasful_chat_threads",
      JSON.stringify([
        {
          id: "talk-mock-friend-001",
          chatDomain: "friend",
          threadKind: "direct",
          partnerUserId: "u_demo_friend_001",
          partnerProfile: {
            user_id: "u_demo_friend_001",
            display_name: "田中 一郎",
            profile_image: "https://placehold.co/96x96/fff6df/7a5710?text=T",
            cover_image: "https://placehold.co/600x400/4a6741/ffffff?text=Cover",
          },
          partner: { id: "u_demo_friend_001", displayName: "田中 一郎" },
          lastMessagePreview: "test",
          updatedAt: new Date().toISOString(),
        },
        {
          id: "verify-admin-partner",
          chatDomain: "builder",
          threadKind: "calendar_request",
          builderThreadType: "admin_partner",
          builderFlow: "ops_partner",
          partner: { displayName: "運営" },
          updatedAt: new Date().toISOString(),
        },
      ])
    );
  });

  await page.goto(buildLocalPageUrl(base, "talk-home.html?tab=chat"), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const hasModule = await page.evaluate(() => Boolean(window.TasuTalkProfileCard));
  if (!hasModule) errors.push("TasuTalkProfileCard missing");

  const trigger = page.locator('[data-talk-profile-trigger][data-talk-thread-id="talk-mock-friend-001"]').first();
  if ((await trigger.count()) < 1) errors.push("friend avatar trigger missing");
  else {
    await trigger.click();
    await page.waitForTimeout(400);
    const open = await page.locator("[data-talk-profile-card]:not([hidden])").count();
    if (open < 1) errors.push("profile card did not open");
    const name = await page.locator("[data-talk-profile-name]").textContent();
    if (!/田中/.test(name || "")) errors.push(`unexpected name: ${name}`);
    const coverMode = await page.locator("[data-talk-profile-cover]").getAttribute("data-talk-profile-cover-mode");
    if (coverMode !== "photo") errors.push(`expected cover photo mode, got ${coverMode}`);
    const hasPhotoClass = await page.locator(".talk-profile-card__cover--photo").count();
    if (hasPhotoClass < 1) errors.push("cover photo class missing");
    await page.locator(".talk-profile-card__close").click();
    await page.waitForTimeout(350);
    const closed = await page.locator("[data-talk-profile-card][hidden]").count();
    if (closed < 1) errors.push("profile card did not close");
  }

  await page.evaluate(() => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const idx = threads.findIndex((t) => t.id === "talk-mock-friend-001");
    if (idx >= 0) {
      const profile = { ...(threads[idx].partnerProfile || {}) };
      delete profile.cover_image;
      delete profile.coverImage;
      threads[idx] = { ...threads[idx], partnerProfile: profile };
      localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await trigger.click();
  await page.waitForTimeout(400);
  const gradientMode = await page.locator("[data-talk-profile-cover]").getAttribute("data-talk-profile-cover-mode");
  if (gradientMode !== "gradient") errors.push(`expected gradient cover mode, got ${gradientMode}`);
  const hasGradientClass = await page.locator(".talk-profile-card__cover--gradient").count();
  if (hasGradientClass < 1) errors.push("cover gradient class missing");
  await page.locator(".talk-profile-card__close").click();

  await page.goto(
    buildLocalPageUrl(
      base,
      "chat-detail.html?thread=verify-admin-partner&from=builder&builderFlow=ops_partner&builderRole=partner"
    ),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(2000);
  const adminTrigger = await page.locator("#chatPeerAvatarLink[data-talk-profile-trigger]").count();
  if (adminTrigger > 0) errors.push("admin should not have profile trigger");
}, { headless: true });

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL", errors);
  process.exit(1);
}
console.log("PASS talk-profile-card smoke");
