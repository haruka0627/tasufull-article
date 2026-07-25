import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace`;
const errors = [];

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const severe = [];
  page.on("console", (m) => {
    if (m.type() === "error") severe.push(m.text());
  });
  page.on("pageerror", (e) => severe.push(String(e)));

  const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!res || res.status() !== 200) {
    errors.push(`HTTP ${res?.status() ?? "fail"}`);
  } else {
    const check = await page.evaluate(() => {
      const P = window.TasuAiPlanPolicy;
      const M = window.TasuAiPlanModels;
      const R = window.TasuAiWorkspaceModelRouterSettings;
      if (!P || !M || !R) return { err: "missing_apis" };

      const free = P.getPlanPolicy("free");
      const pro = P.getPlanPolicy("pro");
      if (P.normalizePlanId("evil") !== "free") return { err: "unknown_not_free" };
      if (P.isModelAllowedForPolicy(free, "gpt")) return { err: "free_allows_gpt" };
      if (!P.isModelAllowedForPolicy(pro, "claude")) return { err: "pro_blocks_claude" };

      // localStorage plan override must not elevate
      localStorage.setItem("tasu_ai_user_plan", "premium");
      localStorage.setItem("tasu_genai_plan", JSON.stringify({ plan: "free", label: "無料枠", dailyTextLimit: 5 }));
      window.TasuAiWorkspaceUsage?.applyServerStatusToCache?.({
        ok: true,
        planCode: "free",
        planLabel: "無料枠",
        dailyLimit: 5,
        used: 0,
        remaining: 5,
        allowed: true,
        plan: P.buildPublicPlanSummary(free, { used: 0, remaining: 5 }),
        authMode: "jwt",
      });
      const resolved = M.resolveUserPlan();
      if (resolved !== "free") return { err: `override_leaked:${resolved}` };
      if (M.isModelAllowed("gpt")) return { err: "client_allows_gpt_on_free" };

      R.setAutoRoutingEnabled(false);
      const setClaude = M.setSelectedModelId("claude");
      if (setClaude) return { err: "free_should_not_select_claude" };
      if (M.isModelAllowed("claude")) return { err: "free_allows_claude" };

      R.setAutoRoutingEnabled(true);
      const auto = R.resolveTurnDecision({ userText: "hello chat" });
      if (!auto.ok || auto.resolvedWorkspaceId !== "gemini-flash") {
        return { err: `auto_not_gemini:${auto.resolvedWorkspaceId}` };
      }

      // Pro plan allows Claude selection
      window.TasuAiWorkspaceUsage.applyServerStatusToCache({
        ok: true,
        planCode: "pro",
        planLabel: "Pro",
        dailyLimit: 100,
        used: 0,
        remaining: 100,
        allowed: true,
        plan: P.buildPublicPlanSummary(pro, { used: 0, remaining: 100 }),
        authMode: "jwt",
      });
      if (M.resolveUserPlan() !== "pro") return { err: "pro_not_applied" };
      if (!M.setSelectedModelId("claude")) return { err: "pro_cannot_select_claude" };
      R.setAutoRoutingEnabled(false);
      const manualPro = R.resolveTurnDecision({ userText: "hi" });
      if (!manualPro.ok || manualPro.resolvedWorkspaceId !== "claude") {
        return { err: `manual_pro_claude:${manualPro.resolvedWorkspaceId}` };
      }

      const welcome = document.getElementById("welcome-screen");
      if (welcome) welcome.hidden = true;
      window.TasuAiWorkspaceUsage.updateUsageUi();
      window.TasuAiWorkspaceSettings?.openSettings?.("billing");
      return { err: null, planId: M.resolveUserPlan() };
    });

    if (check.err) errors.push(check.err);

    const panel = page.locator("[data-ai-settings-panel='billing']");
    await panel.waitFor({ state: "visible", timeout: 10000 }).catch(() => {
      errors.push("billing panel missing");
    });
    const text = await panel.innerText().catch(() => "");
    if (text && !/利用区分|無料|Lite|Pro|本日/.test(text)) {
      errors.push(`billing plan text unexpected: ${text.slice(0, 120)}`);
    }
  }

  if (severe.length) errors.push(`console: ${severe.slice(0, 3).join(" | ")}`);
  await page.close();
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS plan policy Playwright");
