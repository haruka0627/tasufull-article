#!/usr/bin/env node
/**
 * rows=1 + 空DOM + notifyRenderSig 一致 — 強制再描画の回帰テスト
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
await withPlaywrightBrowser(async (browser) => {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);

  const bDetail = page.frames().find((f) => /detail-job/i.test(f.url()));
  if (bDetail) {
    await bDetail.evaluate(() => document.querySelector("[data-listing-primary-cta], [data-job-apply]")?.click());
    await page.waitForTimeout(4000);
  }

  let mgmt = page.frames().find((f) => /detail-job/i.test(f.url()) && /applications|benchManagement/i.test(f.url()));
  if (!mgmt) {
    const aNotify = page.frame({ url: /talk-home.*tab=notify/ });
    await aNotify?.evaluate(() => document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click());
    await page.waitForTimeout(4000);
    mgmt = page.frames().find((f) => /detail-job/i.test(f.url()) && /applications|benchManagement/i.test(f.url()));
  }
  if (mgmt) {
    await mgmt.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click());
    await page.waitForTimeout(3500);
  }

  const aFee = page.frames().find((f) => /platform-chat-fee-pay/i.test(f.url()));
  if (aFee) {
    await aFee.evaluate(() => document.querySelector("[data-platform-fee-pay]")?.click());
    await page.waitForTimeout(5000);
  }

  const before = await page.evaluate(() => {
    const win = document.getElementById("frame-b-notify")?.contentWindow;
    const host = win?.document.querySelector("[data-talk-notify-list]");
    const diag = win?.__tasuBenchNotifyRenderDiag || null;
    return {
      rowsLength: diag?.rowsLength ?? null,
      domCardCount: diag?.domCardCount ?? null,
      renderSig: host?.dataset?.notifyRenderSig || "",
    };
  });

  const injected = await page.evaluate(() => {
    const win = document.getElementById("frame-b-notify")?.contentWindow;
    const host = win?.document.querySelector("[data-talk-notify-list]");
    if (!host) return { ok: false, reason: "no_host" };
    const sig = host.dataset.notifyRenderSig || "stale-card-sig";
    host.dataset.notifyRenderSig = sig;
    host.classList.add("talk-notify-list--empty", "talk-notify-list--empty-pure");
    host.innerHTML =
      '<div class="talk-notify-empty-state talk-notify-empty-state--bench" role="status">' +
      '<p class="talk-notify-empty-state__title">該当する通知はありません</p></div>';
    return { ok: true, sig };
  });

  await page.evaluate(() => {
    document.getElementById("frame-b-notify")?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => {
    const win = document.getElementById("frame-b-notify")?.contentWindow;
    const diag = win?.__tasuBenchNotifyRenderDiag || null;
    return {
      rowsLength: diag?.rowsLength ?? null,
      domCardCount: diag?.domCardCount ?? null,
      domEmpty: diag?.domEmpty ?? null,
      domNeedsRender: diag?.domNeedsRender ?? null,
      domTitle: diag?.domVisibleCardTitle || diag?.domEmptyText || "",
    };
  });

  const ok =
    injected.ok &&
    Number(after.rowsLength) >= 1 &&
    Number(after.domCardCount) >= 1 &&
    after.domEmpty !== true &&
    String(after.domTitle).includes("応募が承諾");

  console.log(JSON.stringify({ before, injected, after, ok }, null, 2));
  await closeAllBrowsers();
  process.exit(ok ? 0 : 1);
});

await closeAllBrowsers();
