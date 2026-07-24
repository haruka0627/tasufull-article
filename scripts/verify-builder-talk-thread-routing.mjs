#!/usr/bin/env node
/**
 * Builder → TASFUL Talk チャット統合 — 受諾・threadId・Talk遷移
 *
 *   node scripts/verify-builder-talk-thread-routing.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";

const BUILDER_DEMO_PROJECT_ID = "builder_demo_001";
const MVP_KEY = "tasful:builder:mvp:v1";
const CHAT_THREADS_KEY = "tasful_chat_threads";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const partnerUrl = buildLocalPageUrl(base, "builder/project-calendar.html?role=partner");
const adminUrl = buildLocalPageUrl(base, "builder/admin-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

function currentMonthDay10() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-10`;
}

async function resetBuilderDemoPending(page) {
  await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(
    ({ mvpKey, projectId }) => {
      localStorage.removeItem("tasful_chat_threads");
      localStorage.removeItem("tasful_chat_messages");
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const idx = (mvp.projects || []).findIndex((p) => p.project_id === projectId);
      if (idx >= 0) {
        mvp.projects[idx] = {
          ...mvp.projects[idx],
          assignment_status: "pending",
          main_thread_id: null,
        };
        localStorage.setItem(mvpKey, JSON.stringify(mvp));
      }
    },
    { mvpKey: MVP_KEY, projectId: BUILDER_DEMO_PROJECT_ID }
  );
}

console.log("Partner URL:", partnerUrl);

for (const vp of BUILDER_QA_VIEWPORTS) {
  console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await resetBuilderDemoPending(page);
    await page.locator('[data-builder-pc-source="partner"]').click();
    const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
    await embed.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 10000 });

    const day10 = currentMonthDay10();
    await embed.locator(`[data-admin-cal-date="${day10}"]`).click();
    await embed.locator('[data-admin-cal-view="day"]').click();
    await page.waitForTimeout(300);

    const acceptBtn = embed.locator("[data-partner-cal-accept]");
    if ((await acceptBtn.count()) >= 1) pass("受ける button visible");
    else fail("受ける button missing");

    await acceptBtn.click();
    await page.waitForTimeout(400);

    const threadMeta = await page.evaluate(
      ({ mvpKey, projectId, chatKey }) => {
        const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
        const project = (mvp.projects || []).find((p) => p.project_id === projectId);
        const threadId = project?.main_thread_id || null;
        const chatThreads = JSON.parse(localStorage.getItem(chatKey) || "[]");
        const inTalk = (chatThreads || []).some((t) => String(t.id) === String(threadId));
        return {
          assignment_status: project?.assignment_status || "",
          threadId,
          inTalk,
        };
      },
      { mvpKey: MVP_KEY, projectId: BUILDER_DEMO_PROJECT_ID, chatKey: CHAT_THREADS_KEY }
    );

    if (threadMeta.assignment_status === "accepted") pass("assignment_status accepted");
    else fail(`assignment_status expected accepted, got ${threadMeta.assignment_status}`);

    if (threadMeta.threadId) pass(`main_thread_id saved: ${threadMeta.threadId}`);
    else fail("main_thread_id not saved after accept");

    if (threadMeta.inTalk) pass("thread synced to tasful_chat_threads");
    else fail("thread missing from tasful_chat_threads");

    const openLink = embed.locator('a:has-text("スレッド/チャットを開く"), a:has-text("Talkで開く")').first();
    if ((await openLink.count()) >= 1) pass("Talk open link visible");
    else fail("Talk open link missing after accept");

    const href = (await openLink.getAttribute("href")) || "";
    if (/chat-detail\.html|talk-thread-open\.html/i.test(href)) pass(`open link targets Talk: ${href}`);
    else fail(`open link should target Talk, got: ${href}`);
    if (!/mvp-thread\.html/i.test(href)) pass("open link does not use mvp-thread.html");
    else fail("open link still uses mvp-thread.html");

    const chatForm = embed.locator("[data-builder-mvp-thread-form], [data-builder-mvp-thread-input]");
    if ((await chatForm.count()) === 0) pass("no Builder chat compose in calendar embed");
    else fail("Builder chat UI should not appear in calendar embed");

    if (consoleErrors.length === 0) pass("console errors: 0");
    else fail(`console errors: ${consoleErrors.join(" | ")}`);
  });
}

await closeAllBrowsers();

console.log("\n--- Summary ---");
if (errors.length) {
  console.error(`FAIL (${errors.length})`);
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("PASS — Builder → Talk thread routing");
