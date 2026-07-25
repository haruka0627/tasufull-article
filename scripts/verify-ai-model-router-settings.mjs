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
  if (!/Claude/i.test(chatChip)) errors.push(`auto mode chat routing: ${chatChip}`);

  await page.click("[data-ai-model-mode='speed']");
  chatChip = await panel.locator("[data-ai-model-routing-chip='chat'] .ai-ref-model-routing-chip__value").innerText();
  if (!/Gemini|最速|gemini/i.test(chatChip)) errors.push(`speed mode chat routing: ${chatChip}`);

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

  // Chat send path must pass routed modelId + routingDecision into Gateway (Phase 3).
  const chatWired = await page.evaluate(async () => {
    const srcOk =
      typeof window.TasuAiChat?.sendMessage === "function" &&
      Boolean(window.TasuAiWorkspaceRoutingSettings?.resolveModelId) &&
      Boolean(window.TasuAiModelIdentity?.toProviderModelId);
    window.TasuAiWorkspaceModelRouterSettings.setState({
      modelMode: "auto",
      modelAutoRouting: true,
      useCaseModels: {
        chat: "auto",
        image: "auto",
        video: "auto",
        search: "auto",
        code: "gpt-5",
        translation: "auto",
        analysis: "auto",
      },
    });
    const userText = "def hello():\n  pass";
    const expected = window.TasuAiWorkspaceRoutingSettings.resolveModelId({
      userText,
      modeId: "skill-search",
    });
    const expectedDecision = window.TasuAiWorkspaceRoutingSettings.resolveTurnDecision({
      userText,
      modeId: "skill-search",
    });
    let captured = null;
    let capturedRouting = null;
    const gw = window.TasuAiModelGateway;
    const orig = gw?.completeTurn;
    if (!gw || !orig) return { srcOk, expected, captured: null, err: "no_gateway" };
    // Site search short-circuits Gateway — stub so Chat path reaches completeTurn.
    const cross = window.TasuAiCrossSearch;
    const origCross = cross?.tryHandle;
    if (cross) {
      cross.tryHandle = async () => null;
    }
    gw.completeTurn = async (params) => {
      captured = params?.modelId || null;
      capturedRouting = params?.routingDecision || null;
      return {
        reply: "router-wire-ok",
        modelId: params?.modelId || "",
        search_used: false,
        search_query: "",
        search_provider: "",
        search_result_count: 0,
        uiBadgeHtml: "",
        routingDecision: params?.routingDecision || null,
      };
    };
    try {
      const root = document.querySelector("[data-ai-workspace-chat]");
      if (root) root.setAttribute("data-mode", "skill-search");
      const input = root?.querySelector("[data-ai-chat-input]");
      if (input) input.value = userText;
      await window.TasuAiChat.sendMessage(root, { searchTarget: "tasful" });
    } catch (e) {
      return { srcOk, expected, captured, capturedRouting, err: String(e) };
    } finally {
      gw.completeTurn = orig;
      if (cross && origCross) cross.tryHandle = origCross;
    }
    return {
      srcOk,
      expected,
      captured,
      capturedRouting,
      expectedMode: expectedDecision?.requestedMode || null,
      err: null,
    };
  });
  if (!chatWired.srcOk) errors.push("chat/router APIs missing for wiring check");
  if (chatWired.err) errors.push(`chat send wire error: ${chatWired.err}`);
  if (chatWired.expected && chatWired.captured !== chatWired.expected) {
    errors.push(
      `chat send modelId not routed: expected ${chatWired.expected}, got ${chatWired.captured}`
    );
  }
  if (chatWired.expectedMode === "auto" && chatWired.capturedRouting?.requestedMode !== "auto") {
    errors.push(
      `routingDecision.requestedMode expected auto, got ${chatWired.capturedRouting?.requestedMode}`
    );
  }
  if (chatWired.captured && !chatWired.capturedRouting) {
    errors.push("routingDecision missing on completeTurn payload");
  }

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
