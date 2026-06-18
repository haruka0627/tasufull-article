#!/usr/bin/env node
/**
 * TASFUL TALK — AI業者検索原型 E2E 検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(120000);

await page.goto(`${BASE}/talk-home.html?tab=ai`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-talk-panel='ai']", { timeout: 60000 });

record("AI tab panel", (await page.locator("[data-talk-panel='ai']").count()) > 0);

await page.click("[data-talk-ai-pick='vendor_search']");
await page.waitForSelector("[data-talk-ai-vendor-search]:not([hidden])", { timeout: 15000 });

record("vendor search panel open", (await page.locator("[data-talk-ai-vendor-search]:not([hidden])").count()) > 0);

await page.fill("[data-talk-vendor-area]", "東京");
await page.click("[data-talk-ai-vendor-form] button[type='submit']");
await page.waitForSelector(".talk-ai-vendor-card", { timeout: 15000 });

const cardCount = await page.locator(".talk-ai-vendor-card").count();
record("vendor cards rendered", cardCount > 0, String(cardCount));

const flow = await page.evaluate(async () => {
  const mod = window.TasuTalkAiVendorSearch;
  if (!mod?.startVendorConsult) return { ok: false, error: "no_module" };
  const vendors = mod.listSubscribedVendors?.() || [];
  const target = vendors[0];
  if (!target) return { ok: false, error: "no_vendor" };
  const result = mod.startVendorConsult(target.vendorId, { area: "東京", trade: "外壁" });
  if (!result.ok) return result;

  const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
  const thread = mvp.threads?.[result.threadId];
  const project = (mvp.projects || []).find((p) => p.project_id === result.project_id);
  const mvpNotifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const talkNotifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");

  const posterNotifs = mvpNotifs.filter((n) => n.type === "application");
  const applicantNotifs = mvpNotifs.filter((n) => n.type === "application_submitted");
  const talkBuilderNotifs = talkNotifs.filter((n) => {
    const src = String(n.source || "");
    const href = String(n.href || n.targetUrl || "");
    return (
      src === "builder-mvp" ||
      (String(n.type || "") === "builder" &&
        (href.includes(result.threadId) || String(n.title || "").includes("相談") || String(n.title || "").includes("やりとり")))
    );
  });

  return {
    ok: true,
    threadId: result.threadId,
    href: result.href,
    threadType: thread?.thread_type || thread?.threadType,
    projectSource: project?.source,
    vendorId: project?.talk_ai_vendor_id,
    hasThread: Boolean(thread),
    posterNotifCount: posterNotifs.length,
    applicantNotifCount: applicantNotifs.length,
    talkNotifCount: talkBuilderNotifs.length,
    msgCount: (thread?.messages || []).length,
    eventCount: (thread?.events || []).length,
  };
});

record("consult started", flow?.ok === true, flow?.error || "");
record("project source talk_ai", flow?.projectSource === "talk_ai_vendor_search");
record("thread type vendor_user", flow?.threadType === "vendor_user");
record("no thread before chat start", flow?.hasThread === false);
record("poster application notification", (flow?.posterNotifCount || 0) >= 1, String(flow?.posterNotifCount));
record("applicant application_submitted notification", (flow?.applicantNotifCount || 0) >= 1, String(flow?.applicantNotifCount));
record("talk builder notifications", (flow?.talkNotifCount || 0) >= 2, String(flow?.talkNotifCount));

if (flow?.href) {
  await page.goto(`${BASE}/${flow.href}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-builder-mvp-pd], .mvp-project-detail, body", { timeout: 60000 });
  const projectReady = await page.evaluate(() => {
    const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const params = new URLSearchParams(location.search);
    const pid = params.get("id");
    const project = (mvp.projects || []).find((p) => p.project_id === pid);
    return Boolean(project && !project.main_thread_id);
  });
  record("mvp-project-detail reachable pre-chat", projectReady === true);
}

});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("AI vendor search prototype checks passed");
