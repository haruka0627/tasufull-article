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
    localStorage.removeItem("tasu_ai_routing_settings");
    window.TasuAiWorkspaceRoutingSettings?.setState?.({
      operationMode: "balance",
      syncWithMode: true,
      ...window.TasuAiWorkspaceRoutingSettings.MODE_PRESETS.balance,
    });
    window.TasuAiWorkspaceSettings?.openSettings?.("ai");
  });

  const getSelect = (key) =>
    page.locator(`[data-ai-settings-panel='ai'] [data-setting-key="${key}"]`);

  let length = await getSelect("responseLength").inputValue();
  if (length !== "standard") errors.push(`balance preset: expected standard, got ${length}`);

  await page.click("[data-ai-mode-card='speed']");
  length = await getSelect("responseLength").inputValue();
  if (length !== "short") errors.push(`speed preset: expected short, got ${length}`);

  const web = await getSelect("webSearch").inputValue();
  if (web !== "when_needed") errors.push(`speed webSearch: expected when_needed, got ${web}`);

  await page.click("[data-setting-key='syncWithMode']");
  const disabled = await getSelect("responseLength").isDisabled();
  if (disabled) errors.push("responseLength should be enabled when sync off");

  await getSelect("responseLength").selectOption("long");
  length = await getSelect("responseLength").inputValue();
  if (length !== "long") errors.push(`manual change failed: ${length}`);

  const apiShape = await page.evaluate(() =>
    window.TasuAiWorkspaceRoutingSettings.formatForApiRequest({ userText: "hello", modeId: "tasful-guide" })
  );
  if (!apiShape?.capabilities?.autoRouting === undefined && apiShape?.capabilities == null) {
    errors.push("formatForApiRequest missing capabilities");
  }
  if (!apiShape.resolvedModelId) errors.push("formatForApiRequest missing resolvedModelId");
  if (apiShape.response.length !== "long") errors.push(`api payload length mismatch: ${apiShape.response.length}`);

  const searchOff = await page.evaluate(() => {
    window.TasuAiWorkspaceRoutingSettings.setSetting("webSearch", "off");
    return window.TasuAiWorkspaceRoutingSettings.getSearchFlags();
  });
  if (!searchOff.skipSearch) errors.push("webSearch off should skip search");

  const searchAlways = await page.evaluate(() => {
    window.TasuAiWorkspaceRoutingSettings.setSetting("webSearch", "always");
    return window.TasuAiWorkspaceRoutingSettings.getSearchFlags();
  });
  if (!searchAlways.forceSearch) errors.push("webSearch always should force search");

  if (severe.length) errors.push(`console: ${severe.join(" | ")}`);
  await page.close();
});

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS AI routing settings integration");
