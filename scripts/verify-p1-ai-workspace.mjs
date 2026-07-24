#!/usr/bin/env node
/**
 * P1 再監査: ヘルプリンク · カテゴリ遷移 · 一般/通知 localStorage
 */
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const BASE = "http://127.0.0.1:8788";
const HELP_URLS = [
  "/help/",
  "/help/faq/",
  "/help/beginner/",
  "/help/terms-of-service/",
  "/help/privacy-policy/",
  "/help/contact-support/",
];
const CATEGORIES = ["chat", "image", "video", "music", "document", "history"];

await withPlaywrightBrowser(async (browser) => {
  for (const vp of [
    { tag: "1280", w: 1280, h: 900 },
    { tag: "768", w: 768, h: 900 },
    { tag: "390", w: 390, h: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon/i.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e.message || e)));

    const resp = await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForFunction(
      () => window.TasuAiWorkspaceCategories?.applyCategory && window.TasuAiWorkspaceSettings?.openSettings,
      null,
      { timeout: 30000 },
    );

    const catResults = [];
    if (vp.tag === "1280") {
      for (const id of CATEGORIES) {
        const ok = await page.evaluate((cid) => {
          window.TasuAiWorkspaceCategories.applyCategory(cid);
          const btn = document.querySelector(`[data-ai-workspace-category="${cid}"]`);
          return {
            btnActive: Boolean(btn?.classList.contains("is-active")),
            session: sessionStorage.getItem("tasu_ai_workspace_category"),
          };
        }, id);
        catResults.push({ id, ok: ok.btnActive && ok.session === id });
      }

      await page.evaluate(() => {
        localStorage.removeItem("tasu_ai_general_settings");
        localStorage.removeItem("tasu_ai_notification_settings");
      });
      await page.reload({ waitUntil: "networkidle", timeout: 120000 });
      await page.waitForFunction(
        () => window.TasuAiWorkspaceSettings?.openSettings,
        null,
        { timeout: 30000 },
      );
      await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("general"));
      await page.waitForTimeout(200);
      const fastBefore = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("tasu_ai_general_settings") || "null"),
      );
      await page.click("#ai-settings-fast-response");
      await page.waitForTimeout(120);
      const genStore = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("tasu_ai_general_settings") || "null"),
      );
      await page.click('[data-ai-settings-nav-item="notification"]');
      await page.waitForTimeout(120);
      await page.selectOption("#ai-settings-notify-ai-response", "off");
      await page.waitForTimeout(120);
      const notifyStore = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("tasu_ai_notification_settings") || "null"),
      );

      const helpStatus = [];
      for (const path of HELP_URLS) {
        const r = await page.goto(buildLocalPageUrl(BASE, path.replace(/^\//, "")), {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        helpStatus.push({ path, status: r?.status() ?? 0 });
      }

      console.log(
        `\n[P1 ${vp.tag}] HTTP ${resp?.status()} · Console Error ${errors.length}`,
      );
      console.log("Categories:", catResults.map((c) => `${c.id}:${c.ok ? "OK" : "NG"}`).join(" "));
      console.log(
        "General fastResponse:",
        fastBefore?.fastResponse,
        "→",
        genStore?.fastResponse,
        genStore?.fastResponse !== fastBefore?.fastResponse ? "OK" : "NG",
      );
      console.log("Notification ai-response:", notifyStore?.["ai-response"] === "off" ? "OK" : "NG");
      console.log(
        "Help URLs:",
        helpStatus.map((h) => `${h.path}${h.status}`).join(" "),
      );
    } else {
      console.log(`\n[P1 ${vp.tag}] HTTP ${resp?.status()} · Console Error ${errors.length}`);
    }

    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`  err: ${e.slice(0, 120)}`));
    await page.close();
  }
});
