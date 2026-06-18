#!/usr/bin/env node
/**
 * Builder 2窓ベンチ — 起動・送信・診断の最小検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const FLOWS = ["ops_partner", "partner_user", "user_user", "vendor_user", "board_project"];
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

for (const flow of FLOWS) {
  const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${flow}&benchViewport=390`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const title = await page.title();
  record(`${flow} boot`, title.includes("Builder 2窓"), title);

  const iframeCount = await page.locator("iframe").count();
  record(`${flow} iframes`, iframeCount >= 6, `${iframeCount} frames`);

  await page.click("#builderBenchSendABtn");
  await page.waitForTimeout(600);
  await page.click("#builderBenchSendBBtn");
  await page.waitForTimeout(800);

  const diag = await page.evaluate(() => {
    const bench = window.TasuBuilderDualWindowBench;
    const d = bench?.runDiagnostics?.() || {};
    return {
      notification_created: d.notification_created,
      reply_visible_on_peer: d.reply_visible_on_peer,
      no_board_mvp_mix: d.no_board_mvp_mix,
    };
  });
  record(`${flow} notification_created`, diag.notification_created === true);
  record(`${flow} reply_visible`, diag.reply_visible_on_peer === true);
  if (flow === "board_project") {
    record(`${flow} board only`, diag.no_board_mvp_mix === true);
  } else {
    record(`${flow} mvp only`, diag.no_board_mvp_mix !== false);
  }
}

});
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("All builder dual-window checks passed");
