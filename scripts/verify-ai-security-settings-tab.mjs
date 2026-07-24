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
      localStorage.removeItem("tasu_ai_security_settings");
      window.TasuAiWorkspaceSettings?.openSettings?.("security");
    });

    const panel = page.locator("[data-ai-settings-panel='security']");
    await panel.waitFor({ state: "visible", timeout: 10000 });

    const text = await panel.innerText();
    if (text.includes("準備中")) errors.push(`${vp.n}: still placeholder`);
    if (!text.includes("ログイン")) errors.push(`${vp.n}: missing login section`);
    if (!text.includes("多要素認証")) errors.push(`${vp.n}: missing MFA section`);
    if (!text.includes("セッション")) errors.push(`${vp.n}: missing session section`);
    if (!text.includes("高度なセキュリティ")) errors.push(`${vp.n}: missing advanced section`);
    if (!text.includes("プライバシー")) errors.push(`${vp.n}: missing privacy section`);
    if (!text.includes("危険操作")) errors.push(`${vp.n}: missing danger section`);
    if (!text.includes("Google")) errors.push(`${vp.n}: missing provider meta`);
    if (!text.includes("他端末からログアウト")) errors.push(`${vp.n}: missing logout other devices`);

    const groups = await panel.locator(".ai-ref-security-group").count();
    if (groups !== 5) errors.push(`${vp.n}: expected 5 groups, got ${groups}`);

    const toggles = await panel.locator("[data-security-setting-key]").count();
    if (toggles !== 7) errors.push(`${vp.n}: expected 7 security toggles, got ${toggles}`);

    await page.click("#ai-security-login-alerts");
    await page.evaluate(() => {
      window.TasuAiWorkspaceSecuritySettings.setSetting("authenticatorEnabled", true);
      window.TasuAiWorkspaceSecuritySettings.setSetting("anonymousTraining", true);
    });

    await page.evaluate(() => window.TasuAiWorkspaceSettings.syncSecuritySettingsUi());

    const state = await page.evaluate(() => window.TasuAiWorkspaceSecuritySettings.getSnapshot());
    if (state.loginAlerts !== false) errors.push(`${vp.n}: loginAlerts toggle failed`);
    if (state.authenticatorEnabled !== true) errors.push(`${vp.n}: authenticatorEnabled not saved`);
    if (state.anonymousTraining !== true) errors.push(`${vp.n}: anonymousTraining not saved`);

    await page.evaluate(() => {
      window.TasuAiWorkspaceSettings.closeSettings();
      window.TasuAiWorkspaceSettings.openSettings("security");
    });

    const persisted = await page.evaluate(() => window.TasuAiWorkspaceSecuritySettings.getSnapshot());
    if (persisted.authenticatorEnabled !== true) errors.push(`${vp.n}: authenticator not persisted`);
    if (persisted.loginAlerts !== false) errors.push(`${vp.n}: loginAlerts not persisted`);

    const apiPayload = await page.evaluate(() => window.TasuAiWorkspaceSecuritySettings.formatForApiRequest());
    if (!apiPayload?.mfa || typeof apiPayload.mfa.authenticatorEnabled !== "boolean") {
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
console.log("PASS security settings tab at 1280/768/390");
