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
      localStorage.removeItem("tasu_ai_account_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("account");
    });

    const panel = page.locator("[data-ai-settings-panel='account']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (text.includes("GPT ビルダー")) errors.push(`${vp.n}: GPT Builder still shown`);
    if (!text.includes("アカウント情報")) errors.push(`${vp.n}: missing account info section`);
    if (!text.includes("プロフィール情報")) errors.push(`${vp.n}: missing profile section`);
    if (!text.includes("外部サービス連携")) errors.push(`${vp.n}: missing providers section`);
    if (!text.includes("メール設定")) errors.push(`${vp.n}: missing email section`);
    if (!text.includes("アカウント操作")) errors.push(`${vp.n}: missing actions section`);
    if (!text.includes("会員ID")) errors.push(`${vp.n}: missing user id row`);
    if (!text.includes("LinkedIn")) errors.push(`${vp.n}: missing LinkedIn provider`);

    const groups = await panel.locator(".ai-ref-account-group").count();
    if (groups !== 5) errors.push(`${vp.n}: expected 5 groups, got ${groups}`);

    await page.fill("#ai-account-display-name", "テスト表示名");
    await page.fill("#ai-account-username", "testuser");
    await page.fill("#ai-account-bio", "自己紹介テスト");
    await page.click("#ai-account-public-profile");
    await page.click("#ai-account-marketing-email");
    await page.locator(".ai-ref-account-checkbox").click();

    const state = await page.evaluate(() => window.TasuAiWorkspaceAccountSettings.getSnapshot());
    if (state.displayName !== "テスト表示名") errors.push(`${vp.n}: displayName not saved`);
    if (state.username !== "testuser") errors.push(`${vp.n}: username not saved`);
    if (state.bio !== "自己紹介テスト") errors.push(`${vp.n}: bio not saved`);
    if (state.publicProfile !== true) errors.push(`${vp.n}: publicProfile toggle failed`);
    if (state.marketingEmail !== true) errors.push(`${vp.n}: marketingEmail toggle failed`);
    if (state.feedbackEmail !== true) errors.push(`${vp.n}: feedbackEmail checkbox failed`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("account");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceAccountSettings.getSnapshot());
    if (persisted.displayName !== "テスト表示名") errors.push(`${vp.n}: displayName not persisted`);
    if (persisted.publicProfile !== true) errors.push(`${vp.n}: publicProfile not persisted`);

    await page.click("[data-account-action='connect-provider'][data-account-provider='github']");
    const afterConnect = await page.evaluate(() =>
      window.TasuAiWorkspaceAccountSettings.getSnapshot().connectedProviders.github
    );
    if (afterConnect !== true) errors.push(`${vp.n}: github connect failed`);

    await page.click("[data-account-action='delete-account']");
    const confirmVisible = await page.locator("[data-account-confirm-dialog]").isVisible();
    if (!confirmVisible) errors.push(`${vp.n}: delete confirm modal not shown`);
    await page.click("[data-account-confirm-cancel]");

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceAccountSettings.formatForApiRequest());
    if (!apiPayload?.profile || typeof apiPayload.profile.publicProfile !== "boolean") {
      errors.push(`${vp.n}: formatForApiRequest invalid`);
    }

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > vp.w + 2) errors.push(`${vp.n}: horizontal scroll ${scrollW}px`);

    if (severe.length) errors.push(`${vp.n}: console: ${severe.join(" | ")}`);
    await page.close();
  }
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS account settings tab at 1280/768/390");
