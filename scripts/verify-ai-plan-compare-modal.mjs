import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace.html`;
const viewports = [
  { w: 1280, h: 800, n: "1280" },
  { w: 768, h: 1024, n: "768" },
  { w: 390, h: 844, n: "390" },
];
const errors = [];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const severe = [];
    page.on("console", (m) => {
      if (m.type() === "error") severe.push(m.text());
    });
    page.on("pageerror", (e) => severe.push(String(e)));

    const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!res || res.status() !== 200) {
      errors.push(`${vp.n}: HTTP ${res?.status() ?? "fail"}`);
      await page.close();
      continue;
    }

    await page.evaluate(() => {
      localStorage.setItem(
        "tasu_genai_plan",
        JSON.stringify({ plan: "lite", label: "Lite", dailyTextLimit: 30, status: "active" })
      );
      window.TasuAiWorkspacePlanUpgrade?.openPlanUpgrade?.();
    });

    await page.waitForSelector("[data-ai-plan-col-role='current']", { timeout: 10000 });

    const left = await page.locator("[data-ai-plan-col-role='current']").innerText();
    const tabs = await page.locator("[data-ai-plan-upgrade-tab]").allTextContents();
    if (!left.includes("Lite")) errors.push(`${vp.n}: left not Lite`);
    if (!left.includes("Gemini専用")) errors.push(`${vp.n}: left missing Gemini専用 note`);
    if (!left.includes("¥300")) errors.push(`${vp.n}: left missing price`);
    if (tabs.join("") !== "FreeProMax") errors.push(`${vp.n}: tabs=${tabs.join(",")}`);

    for (const tab of ["free", "pro", "max"]) {
      await page.click(`[data-ai-plan-upgrade-tab="${tab}"]`);
      const right = await page.locator("[data-ai-plan-col-role='target']").innerText();
      if (tab === "free") {
        if (!right.includes("ダウングレードは準備中")) errors.push(`${vp.n}/free: missing downgrade CTA`);
        if (!right.includes("1日5回")) errors.push(`${vp.n}/free: missing 5/day`);
      }
      if (tab === "pro") {
        if (!right.includes("マルチAIルーティング")) errors.push(`${vp.n}/pro: missing multi-AI`);
        if (!right.includes("おすすめ")) errors.push(`${vp.n}/pro: missing badge`);
        if (!right.includes("ChatGPT")) errors.push(`${vp.n}/pro: missing routing`);
      }
      if (tab === "max") {
        if (!right.includes("フェアユース")) errors.push(`${vp.n}/max: missing fair use`);
        if (!right.includes("今後追加")) errors.push(`${vp.n}/max: missing future AI note`);
      }
      const box = await page.locator("[data-ai-workspace-plan-upgrade-dialog]").boundingBox();
      if (!box || box.width > vp.w + 2) errors.push(`${vp.n}/${tab}: dialog overflow`);
    }

    if (severe.length) errors.push(`${vp.n}: console errors: ${severe.join(" | ")}`);
    await page.close();
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS all viewports + plan content checks");
