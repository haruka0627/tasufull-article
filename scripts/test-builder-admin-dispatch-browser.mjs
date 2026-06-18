/**
 * Builder Admin dispatch smoke test (Playwright)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const builderAdmin = path.join(root, "builder-admin");
const MVP_KEY = "tasful:builder:mvp:v1";
const DISPATCH_KEY = "tasful:builder:admin:dispatchCandidates:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`file://${path.join(builderAdmin, "admin-index.html")}`);
  const dispatchLink = page.locator('[data-builder-stat-action="dispatch"]');
  if ((await dispatchLink.getAttribute("href")) !== "../builder/admin-dispatch.html") {
    throw new Error("Admin dashboard missing dispatch link");
  }

  await page.goto(`file://${path.join(builder, "admin-dispatch.html")}`);
  await page.waitForSelector("[data-builder-admin-dispatch-project-list]");

  const projectCards = await page.locator("[data-builder-admin-dispatch-project]").count();
  if (projectCards < 1) throw new Error("Expected at least 1 project card");

  await page.waitForFunction(() => document.querySelectorAll("[data-builder-admin-dispatch-candidate]").length >= 1);

  const partnerId = await page.locator("[data-builder-admin-dispatch-candidate]").first().getAttribute("data-partner-id");
  let projectId = await page.locator("[data-builder-admin-dispatch-project]").first().getAttribute("data-project-id");
  if (!partnerId || !projectId) throw new Error("Missing partner or project id");

  if (projectId !== "demo-project-001") {
    await page.locator(`[data-builder-admin-dispatch-project][data-project-id="demo-project-001"]`).click();
    projectId = "demo-project-001";
  }

  await page.locator(`[data-builder-admin-dispatch-candidate][data-partner-id="${partnerId}"]`).click();
  await page.locator(`[data-builder-admin-dispatch-assign][data-project-id="${projectId}"][data-partner-id="${partnerId}"]`).click();

  await page.waitForFunction(
    ({ mvpKey, pid, ppid }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const project = (state.projects || []).find((p) => p.project_id === pid);
      return project?.assignedPartners?.some((a) => a.partnerId === ppid);
    },
    { mvpKey: MVP_KEY, pid: projectId, ppid: partnerId }
  );

  const assignDisabled = await page.locator(`button[data-builder-admin-dispatch-assign][data-partner-id="${partnerId}"]`).count();
  if (assignDisabled > 0) throw new Error("Assign button should be disabled after dispatch");

  const candidateText = await page.locator("[data-builder-admin-dispatch-partner-list]").textContent();
  if (!candidateText?.includes("手配済")) throw new Error("Candidate list should show assigned badge");

  const notifs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifs.some((n) => n.type === "dispatch" && n.label === "案件手配完了")) {
    throw new Error("Dispatch notification missing");
  }

  await page.goto(`file://${path.join(builder, "mvp-project-detail.html")}?id=${projectId}`);
  await page.waitForSelector("[data-builder-mvp-pd-stats]");
  const detailText = await page.locator("[data-builder-mvp-pd-app-meta]").textContent();
  if (!detailText?.includes("運営手配")) throw new Error("Project detail missing dispatch info");

  await page.goto(`file://${path.join(builder, "mvp-thread.html")}?thread_id=thread-demo-001`);
  await page.waitForFunction(() => document.querySelector("[data-builder-mvp-thread-msgs]")?.textContent?.includes("案件手配"));
  const threadText = await page.locator("[data-builder-mvp-thread-msgs]").textContent();
  if (!threadText?.includes("案件手配")) throw new Error("Thread missing dispatch message");

  const candidates = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), DISPATCH_KEY);
  if (!candidates.length) throw new Error("Dispatch candidates should exist");

  console.log("OK: builder admin dispatch smoke test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
