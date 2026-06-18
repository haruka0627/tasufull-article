#!/usr/bin/env node
/** CTAクリック → postMessage → A下遷移 の全チェーン実測 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "bench-notify-cta-chain");
fs.mkdirSync(OUT, { recursive: true });

async function runScenario(viewportMode) {
  const browser = await chromium.launch({ headless: true });
  const trace = { viewportMode, steps: {} };
  try {
    const bench = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    const messages = [];
    bench.on("console", (msg) => {
      if (String(msg.text()).includes("[TasuTalkNotify]")) {
        trace.consoleNotify = trace.consoleNotify || [];
        trace.consoleNotify.push(msg.text());
      }
    });
    bench.on("pageerror", (err) => {
      trace.pageError = String(err);
    });
    bench.exposeFunction("__benchMsgTrace", (payload) => {
      messages.push(payload);
    });
    await bench.addInitScript(() => {
      window.addEventListener("message", (ev) => {
        const d = ev.data || {};
        if (d.type === "tasu-bench-frame-navigate") {
          window.__benchMsgTrace?.({
            at: "parent",
            type: d.type,
            slot: d.slot,
            href: String(d.href || "").slice(0, 200),
            opensSellerManagement: d.opensSellerManagement === true,
          });
        }
      });
    });

    const url = `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=${viewportMode}`;
    await bench.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await bench.waitForTimeout(2500);

    await bench.evaluate(() => {
      const profile = window.TasuPlatformChatDualWindowDemo.getProfile("skill", false);
      const Flow = window.TasuPlatformChatDualWindowFlow;
      const row = Flow.buildInitialNotifyRowForProfile?.(profile);
      if (row && window.TasuTalkNotifications?.saveAll) {
        const all = window.TasuTalkNotifications.getAll() || [];
        const byId = new Map(all.map((n) => [n.id, n]));
        byId.set(row.id, row);
        window.TasuTalkNotifications.saveAll([...byId.values()], { localOnly: true, silent: true });
      }
      const C = window.TasuListingContactRequestsStore;
      const now = new Date().toISOString();
      const cid = "contact-demo-skill-dual-001";
      const list = C.readAll().filter((r) => String(r.contact_id) !== cid);
      list.unshift({
        contact_id: cid,
        listing_id: "demo-skill-001",
        listing_type: "skill",
        requester_id: "u_hiro",
        requester_name: "ひろ",
        contact_kind: "purchase",
        status: "applied",
        thread_id: null,
        created_at: now,
        updated_at: now,
      });
      localStorage.setItem(C.STORAGE_KEY, JSON.stringify(list));
    });
    await bench.waitForTimeout(1500);

    const aNotify = bench.frame({ url: /talk-home/ });
    if (!aNotify) throw new Error("A-notify iframe missing");

    const pre = await aNotify.evaluate(() => {
      const btn = document.querySelector(
        "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
      );
      const bridge = Boolean(window.TasuPlatformChatBenchEmbed);
      const tryFn = typeof window.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate === "function";
      const href = btn?.getAttribute("data-talk-notify-href") || "";
      let slot = "";
      let mgmt = false;
      if (href && window.TasuPlatformChatBenchEmbed) {
        mgmt = window.TasuPlatformChatBenchEmbed.isBenchSellerManagementHref?.(href) === true;
        slot = window.TasuPlatformChatBenchEmbed.resolveBenchNavigateSlot?.(href) || "";
      }
      const rect = btn?.getBoundingClientRect?.();
      return {
        bridgeLoaded: bridge,
        tryFn,
        benchEmbedParam: new URLSearchParams(location.search).get("benchEmbed"),
        benchEmbedDataset: document.body?.dataset?.benchEmbed || "",
        compactClass: document.body.classList.contains("talk-bench-notify-compact"),
        btnFound: Boolean(btn),
        btnAction: btn?.getAttribute("data-talk-notify-action") || "",
        btnHref: href.slice(0, 200),
        resolveSlot: slot,
        isManagement: mgmt,
        wired: document.querySelector("[data-talk-notify-list]")?.dataset?.talkNotifyActionsWired === "1",
        btnRect: rect
          ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height, visible: rect.width > 0 && rect.height > 0 }
          : null,
      };
    });
    trace.steps.preClick = pre;

    const frameWrap = bench.locator('#frame-a-notify').locator('xpath=..');
    const scrollBefore = await frameWrap.evaluate((el) => ({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));
    trace.steps.scroll = scrollBefore;

    const aChatSrcBefore = await bench.locator("#frame-a-chat").getAttribute("src");

    await aNotify.evaluate(() => {
      window.__ctaTrace = [];
      const orig = window.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate;
      if (orig) {
        window.TasuPlatformChatBenchEmbed.tryPostBenchFrameNavigate = function (href) {
          window.__ctaTrace.push({ tryPost: href });
          const ok = orig.call(this, href);
          window.__ctaTrace.push({ tryPostResult: ok });
          return ok;
        };
      }
      window.addEventListener(
        "pointerdown",
        (e) => {
          const btn = e.target?.closest?.("[data-talk-notify-action]");
          if (btn) {
            window.__ctaTrace.push({
              pointerdown: true,
              action: btn.getAttribute("data-talk-notify-action"),
              defaultPrevented: e.defaultPrevented,
            });
          }
        },
        true
      );
    });

    // 再描画レースを再現しつつ実クリック
    const rerenderLoop = aNotify.evaluate(() => {
      window.__rerenderCount = 0;
      window.__rerenderTimer = window.setInterval(() => {
        window.__rerenderCount += 1;
        window.dispatchEvent(new MessageEvent("message", { data: { type: "tasu-bench-notify-refresh" } }));
      }, 80);
    });
    const cta = aNotify.locator(
      "[data-talk-notify-action='navigate'], .talk-notify-card__minimal-action"
    ).first();
    try {
      await cta.click({ timeout: 8000, force: false });
      trace.steps.realClick = "ok";
    } catch (err) {
      trace.steps.realClick = `failed:${String(err.message || err).slice(0, 120)}`;
    }
    await rerenderLoop;
    await aNotify.evaluate(() => window.clearInterval(window.__rerenderTimer));

    await bench.waitForTimeout(2000);

    const post = await aNotify.evaluate(() => window.__ctaTrace || []);
    trace.steps.clickTrace = post;
    trace.steps.parentMessages = messages;
    trace.steps.aChatSrcAfter = await bench.locator("#frame-a-chat").getAttribute("src");
    trace.steps.aChatChanged = trace.steps.aChatSrcAfter !== aChatSrcBefore;
    trace.steps.flowPhase = await bench.evaluate(() => {
      const t = document.getElementById("benchDebugPanel")?.textContent || "";
      return (t.match(/flowPhase:\s*(\S+)/) || [])[1] || "";
    });

    await bench.locator("#frame-a-notify").screenshot({
      path: path.join(OUT, `notify-${viewportMode}.png`),
    });
    await bench.locator("#frame-a-chat").screenshot({
      path: path.join(OUT, `a-chat-${viewportMode}.png`),
    });

    trace.ok =
      pre.bridgeLoaded &&
      pre.tryFn &&
      pre.btnFound &&
      pre.resolveSlot === "a-chat" &&
      messages.length > 0 &&
      messages[0].slot === "a-chat" &&
      /detail-skill\.html/i.test(messages[0].href || "") &&
      /view=contacts|benchManagement=1/i.test(messages[0].href || "") &&
      trace.steps.aChatChanged;

    return trace;
  } finally {
    await browser.close();
  }
}

const r390 = await runScenario("390");
const r1280 = await runScenario("1280");

console.log("\n=== 390 viewport ===");
console.log(JSON.stringify(r390, null, 2));
console.log("\n=== 1280 viewport ===");
console.log(JSON.stringify(r1280, null, 2));

if (!r390.ok || !r1280.ok) {
  console.error("\nCHAIN VERIFY FAILED");
  process.exit(1);
}
console.log("\nCHAIN VERIFY OK");
