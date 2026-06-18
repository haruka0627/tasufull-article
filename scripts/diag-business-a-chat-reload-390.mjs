#!/usr/bin/env node
/**
 * business-1 Connectあり — A側チャット iframe 再読込ループ診断
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();

const BENCH_URL = new URL(`${BASE}/chat-dual-window-demo.html`);
BENCH_URL.searchParams.set("benchPattern", "business-1");
BENCH_URL.searchParams.set("demoProfile", "business");
BENCH_URL.searchParams.set("demoConnect", "1");
BENCH_URL.searchParams.set("benchViewport", "390");
BENCH_URL.searchParams.set("talkDev", "1");
BENCH_URL.searchParams.set("review", "chat-demo");
BENCH_URL.searchParams.set("liveFlow", "1");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readBenchMetrics(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("benchDebugPanel")?.textContent || "";
    const pickNum = (re) => {
      const m = panel.match(re);
      return m ? Number(m[1]) : 0;
    };
    const pickStr = (re) => {
      const m = panel.match(re);
      return m ? m[1] : "";
    };
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("business", true);
    const Live = window.TasuPlatformChatLiveFlow;
    const chatUrlA = Live?.chatUrl?.(profile, profile?.partnerAId);
    const chatUrlA2 = Live?.chatUrl?.(profile, profile?.partnerAId);
    const frame = document.getElementById("frame-a-chat");
    const aChatSrc = frame?.src || "";
    const ngText = document.getElementById("benchRootCausePanel")?.textContent || "";
    const ngMatch = ngText.match(/NG count:\s*(\d+)/i);
    return {
      openBenchFrameNavigateCount: pickNum(/openBenchFrameNavigate:\s*(\d+)/),
      chatDetailInitCount: pickNum(/chat-detail init:\s*(\d+)/),
      softSyncCount: pickNum(/soft sync:\s*(\d+)/),
      iframeReloadAChat: pickNum(/iframe reload A-chat:\s*(\d+)/),
      lastChatDetailInitThreadId: pickStr(/chat-detail init:\s*\d+\s*\(thread:\s*([^)]+)\)/),
      aChatSrc: aChatSrc.slice(0, 300),
      chatUrlA: String(chatUrlA || "").slice(0, 300),
      chatUrlStable: String(chatUrlA || "") === String(chatUrlA2 || ""),
      ngCount: ngMatch ? Number(ngMatch[1]) : null,
      lastReconcile: pickStr(/reconcile:\s*([^|]+)/),
      panelSnippet: panel.slice(0, 500),
    };
  });
}

async function readChatDetailInits(page) {
  return page.evaluate(() => window.__chatDetailInitLog || []);
}

async function main() {
  const browser = await launchHeadlessBrowser();
  const report = { url: BENCH_URL.toString(), phases: {}, errors: [] };

  try {
    const page = await browser.newPage();
    const srcChanges = [];
    let lastSrc = "";

    page.on("console", (msg) => {
      const t = msg.text();
      if (/chat-detail|init:start|repair_a_chat|setFrameSrc|openBenchFrameNavigate/i.test(t)) {
        report.console = report.console || [];
        report.console.push(t.slice(0, 200));
      }
    });

    await page.goto(BENCH_URL.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#frame-a-chat", { timeout: 20000 });
    await sleep(3000);

    report.phases.boot = await readBenchMetrics(page);
    report.phases.boot.notifyCta = await page.evaluate(() => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("business", true);
      const Flow = window.TasuPlatformChatDualWindowFlow;
      const row = Flow?.buildInitialNotifyRowForProfile?.(profile);
      return {
        cta: row?.actionLabel || "",
        href: String(row?.href || "").slice(0, 300),
        isChatDetail: /chat-detail\.html/i.test(row?.href || ""),
        isContacts: /view=contacts|benchManagement/i.test(row?.href || ""),
      };
    });

    const pollSrc = setInterval(async () => {
      try {
        const src = await page.locator("#frame-a-chat").getAttribute("src");
        if (src && src !== lastSrc) {
          srcChanges.push({ at: Date.now(), src: src.slice(0, 300) });
          lastSrc = src;
        }
      } catch {
        /* ignore */
      }
    }, 150);

    await page.exposeFunction("__recordChatDetailInit", (payload) => {
      report.chatDetailInits = report.chatDetailInits || [];
      report.chatDetailInits.push(payload);
    });

    await page.evaluate(() => {
      window.__chatDetailInitLog = [];
      window.addEventListener("message", (ev) => {
        if (ev?.data?.type === "tasu-chat-detail-init") {
          window.__chatDetailInitLog.push({
            at: Date.now(),
            step: ev.data.step,
            threadId: ev.data.threadId || "",
          });
        }
      });
    });

    const aNotify = page.frame({ url: /talk-home/ });
    if (!aNotify) {
      report.errors.push("A-notify iframe not found");
    } else {
      const preClick = await aNotify.evaluate(() => {
        const btn = document.querySelector(
          "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
        );
        return {
          found: Boolean(btn),
          action: btn?.getAttribute("data-talk-notify-action") || "",
          href: (btn?.getAttribute("data-talk-notify-href") || "").slice(0, 300),
          label: (btn?.textContent || "").trim().slice(0, 80),
        };
      });
      report.phases.preClick = preClick;

      if (preClick.found) {
        const cta = aNotify
          .locator("[data-talk-notify-action], .talk-notify-card__minimal-action")
          .first();
        try {
          await cta.click({ timeout: 10000 });
          report.phases.click = "ok";
        } catch (err) {
          report.phases.click = `failed: ${String(err.message || err).slice(0, 120)}`;
          await aNotify.evaluate(() => {
            const btn = document.querySelector(
              "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
            );
            btn?.click();
          });
          report.phases.click = "fallback_evaluate";
        }
      }
    }

    await sleep(5000);
    clearInterval(pollSrc);

    report.phases.afterClick = await readBenchMetrics(page);
    report.phases.afterClick.chatDetailInits = await readChatDetailInits(page);
    report.srcChanges = srcChanges;
    report.srcChangeCount = srcChanges.length;

    const m = report.phases.afterClick;
    const bootReload = report.phases.boot?.iframeReloadAChat || 0;
    const afterReload = m.iframeReloadAChat || 0;
    const reloadAfterCta = Math.max(0, afterReload - bootReload);

    report.summary = {
      ngCount: m.ngCount,
      openBenchFrameNavigateAfterCta:
        (m.openBenchFrameNavigateCount || 0) - (report.phases.boot?.openBenchFrameNavigateCount || 0),
      chatDetailInitAfterCta:
        (m.chatDetailInitCount || 0) - (report.phases.boot?.chatDetailInitCount || 0),
      iframeReloadAfterCta: reloadAfterCta,
      srcChangeAfterCta: Math.max(0, srcChanges.length - (report.bootSrcChanges || 0)),
      chatUrlStable: m.chatUrlStable,
      ctaPointsToChatDetail: /chat-detail\.html/i.test(report.phases.preClick?.href || ""),
    };

    const bootChatDetailInits = (report.console || []).filter((l) => /init:start/.test(l)).length;
    report.summary.bootChatDetailInits = bootChatDetailInits;

    report.pass =
      (m.ngCount === 0 || m.ngCount === null) &&
      bootChatDetailInits <= 1 &&
      reloadAfterCta <= 1 &&
      report.summary.chatDetailInitAfterCta <= 1;

    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) {
      console.error("\nDIAG FAILED");
      process.exit(1);
    }
    console.log("\nDIAG OK");
  } finally {
    await browser.close();
  }
}

await main();
