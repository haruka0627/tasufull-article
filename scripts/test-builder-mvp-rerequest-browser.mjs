/**
 * Builder MVP re-request → post smoke test (Playwright)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const RE_REQUESTS_KEY = "tasful:builder:mvp:reRequests:v1";
const TEMPLATES_KEY = "tasful:builder:mvp:projectTemplates:v1";

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(`file://${path.join(builder, "re-request.html")}?project_id=demo-project-001`);
  await page.waitForSelector("[data-builder-re-summary]");

  const summary = await page.locator(".builder-rerequest-summary-grid").textContent();
  if (!summary || summary.includes("元案件が指定されていません")) {
    throw new Error(`Summary not rendered: ${summary}`);
  }
  if (!summary.includes("添付数")) throw new Error("Summary missing attachment count");

  const createBtn = page.locator("[data-builder-re-create-project]");
  if (!(await createBtn.isEnabled())) throw new Error("Create button should be enabled");

  await createBtn.click();
  await page.waitForURL(/mvp-post\.html\?re_request_id=re-request-/);

  const reRequestId = new URL(page.url()).searchParams.get("re_request_id");
  if (!reRequestId) throw new Error("Missing re_request_id in URL");

  const notice = await page.locator("[data-builder-mvp-post-rerequest-notice]").isVisible();
  if (!notice) throw new Error("Re-request notice not visible");

  const templateNoticeHidden = await page.locator("[data-builder-mvp-post-template-notice]").isHidden();
  if (!templateNoticeHidden) throw new Error("Template notice should be hidden for re-request flow");

  const attachText = await page.locator("[data-builder-mvp-post-rerequest-notice]").textContent();
  if (!attachText?.includes("平面図.pdf")) throw new Error(`Attachments not shown in notice: ${attachText}`);

  const titleVal = await page.locator("[data-builder-mvp-project-title]").inputValue();
  if (!titleVal.trim()) throw new Error("Title not applied from re-request");

  const stored = await page.evaluate(
    ({ key, id }) => {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      return list.find((r) => r.id === id) || null;
    },
    { key: RE_REQUESTS_KEY, id: reRequestId }
  );
  if (!stored?.sourceProjectId) throw new Error("Re-request record not saved in localStorage");

  // Template flow must still work
  const demoTemplate = {
    id: "tpl_20260603_rrtest",
    title: "テンプレ連携確認",
    sourceProjectId: "demo-project-001",
    projectTitle: "テンプレ案件",
    category: "外装",
    area: "東京",
    budget: "50万円",
    schedule: "2024-07-01〜2024-07-31",
    description: "テンプレ詳細",
    attachments: [],
    createdAt: "2026-06-03T10:00:00.000Z",
    updatedAt: "2026-06-03T10:00:00.000Z",
  };
  await page.evaluate(
    ({ key, tpl }) => localStorage.setItem(key, JSON.stringify([tpl])),
    { key: TEMPLATES_KEY, tpl: demoTemplate }
  );
  await page.goto(`file://${path.join(builder, "mvp-post.html")}?template_id=tpl_20260603_rrtest`);
  await page.waitForSelector("[data-builder-mvp-post-template-notice]:not([hidden])");
  const tplTitle = await page.locator("[data-builder-mvp-project-title]").inputValue();
  if (tplTitle !== "テンプレ案件") throw new Error(`Template apply broken: ${tplTitle}`);

  console.log("OK: builder MVP re-request smoke test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
