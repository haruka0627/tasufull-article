/**
 * Builder MVP template list / apply smoke test (Playwright)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const TEMPLATES_KEY = "tasful:builder:mvp:projectTemplates:v1";

const demoTemplate = {
  id: "tpl_20260603_test",
  title: "外壁補修工事テンプレ",
  sourceProjectId: "demo-project-001",
  projectTitle: "外壁補修工事",
  category: "外装, 防水",
  area: "東京, 新宿区",
  budget: "80万円〜120万円",
  schedule: "2024-07-01〜2024-07-31",
  description: "テンプレから反映される詳細内容です。",
  attachments: [{ name: "平面図.pdf", type: "pdf" }, { name: "立面図.pdf", type: "pdf" }],
  createdAt: "2026-06-03T10:00:00.000Z",
  updatedAt: "2026-06-03T10:00:00.000Z",
};

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(`file://${path.join(builder, "index.html")}`);
  const templatesLink = page.locator('[data-builder-quick="templates"]');
  const href = await templatesLink.getAttribute("href");
  if (href !== "mvp-templates.html") throw new Error(`Expected mvp-templates.html link, got ${href}`);

  await page.evaluate(
    ({ key, tpl }) => localStorage.setItem(key, JSON.stringify([tpl])),
    { key: TEMPLATES_KEY, tpl: demoTemplate }
  );

  await page.goto(`file://${path.join(builder, "mvp-templates.html")}`);
  await page.waitForSelector("[data-builder-mvp-template-list]");
  const count = await page.locator("[data-builder-mvp-template-count]").textContent();
  if (!count?.includes("1")) throw new Error(`Expected 1 template, got ${count}`);

  const cardTitle = await page.locator(".builder-template-card__title").textContent();
  if (!cardTitle?.includes("外壁補修工事テンプレ")) throw new Error(`Unexpected card title: ${cardTitle}`);

  await page.locator('[data-builder-mvp-template-use="tpl_20260603_test"]').click();
  await page.waitForURL(/mvp-post\.html\?template_id=tpl_20260603_test/);

  const titleVal = await page.locator("[data-builder-mvp-project-title]").inputValue();
  if (titleVal !== "外壁補修工事") throw new Error(`Title not applied: ${titleVal}`);

  const tradesVal = await page.locator("[data-builder-mvp-project-trades]").inputValue();
  if (!tradesVal.includes("外装")) throw new Error(`Trades not applied: ${tradesVal}`);

  const notice = await page.locator("[data-builder-mvp-post-template-notice]").isVisible();
  if (!notice) throw new Error("Template notice not visible");

  const attachText = await page.locator(".builder-post-template-attachments").textContent();
  if (!attachText?.includes("平面図.pdf")) throw new Error(`Attachments not shown: ${attachText}`);

  await page.locator("[data-builder-mvp-project-title]").fill("編集後タイトル");
  const edited = await page.locator("[data-builder-mvp-project-title]").inputValue();
  if (edited !== "編集後タイトル") throw new Error("Form not editable after template apply");

  page.once("dialog", (d) => d.accept());
  await page.goto(`file://${path.join(builder, "mvp-templates.html")}`);
  await page.locator('[data-builder-mvp-template-delete="tpl_20260603_test"]').click();
  await page.waitForFunction(
    ({ key }) => JSON.parse(localStorage.getItem(key) || "[]").length === 0,
    { key: TEMPLATES_KEY }
  );
  const countAfterDelete = await page.locator("[data-builder-mvp-template-count]").textContent();
  if (!countAfterDelete?.includes("0")) throw new Error(`Expected 0 templates after delete, got ${countAfterDelete}`);

  console.log("OK: builder MVP templates smoke test passed");
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
