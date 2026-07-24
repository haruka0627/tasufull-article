import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const URL = `${STANDARD_LOCAL_BASE}/ai-workspace.html`;
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
    await page.close();
    return;
  }

  await page.evaluate(() => {
    localStorage.removeItem("tasu_ai_model_router_settings");
    window.TasuAiWorkspaceModelRouterSettings?.setState?.({
      modelMode: "auto",
      modelAutoRouting: true,
      useCaseModels: {
        chat: "auto",
        image: "auto",
        video: "auto",
        search: "auto",
        code: "auto",
        translation: "auto",
        analysis: "auto",
      },
    });
    window.TasuAiWorkspaceSettings?.openSettings?.("model");
  });

  const panel = page.locator("[data-ai-settings-panel='model']");
  await panel.waitFor({ state: "visible", timeout: 10000 });

  let chatChip = await panel.locator("[data-ai-model-routing-chip='chat'] .ai-ref-model-routing-chip__value").innerText();
  if (!chatChip.includes("Claude")) errors.push(`auto mode chat routing: ${chatChip}`);

  await page.click("[data-ai-model-mode='speed']");
  chatChip = await panel.locator("[data-ai-model-routing-chip='chat'] .ai-ref-model-routing-chip__value").innerText();
  if (!chatChip.includes("Mistral")) errors.push(`speed mode chat routing: ${chatChip}`);

  await page.evaluate(() => {
    window.TasuAiWorkspaceModelRouterSettings.setUseCaseModel("chat", "claude-sonnet");
    window.TasuAiWorkspaceSettings.syncModelSettingsUi?.();
  });

  chatChip = await panel.locator("[data-ai-model-routing-chip='chat'] .ai-ref-model-routing-chip__value").innerText();
  if (!chatChip.includes("Claude Sonnet")) errors.push(`manual chat routing: ${chatChip}`);

  const gatewayId = await page.evaluate(() =>
    window.TasuAiWorkspaceModelRouterSettings.resolveGatewayModelId({
      userText: "Python code help",
      useCase: "code",
    })
  );
  if (gatewayId !== "gpt" && gatewayId !== "claude" && gatewayId !== "gemini-flash") {
    errors.push(`unexpected gateway id for code: ${gatewayId}`);
  }

  await page.evaluate(() => {
    window.TasuAiWorkspaceModelRouterSettings.setUseCaseModel("code", "gpt-5");
  });
  const fixedCode = await page.evaluate(() =>
    window.TasuAiWorkspaceModelRouterSettings.resolveGatewayModelId({ useCase: "code", userText: "hello" })
  );
  if (fixedCode !== "gpt") errors.push(`manual code model should be gpt, got ${fixedCode}`);

  const chipCount = await panel.locator("[data-ai-model-routing-chip]").count();
  if (chipCount !== 7) errors.push(`expected 7 routing chips, got ${chipCount}`);

  if (severe.length) errors.push(`console: ${severe.join(" | ")}`);
  await page.close();
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS model router settings integration");
