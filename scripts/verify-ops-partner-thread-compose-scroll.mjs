#!/usr/bin/env node
/**
 * ops_partner 現場連絡 — benchEmbed で入力欄・送信・完了モーダルまで到達できること
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(90000);

await page.goto(
  `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`,
  { waitUntil: "domcontentloaded" }
);
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });

await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  await ops.opsAddCalendar();
  await ops.opsPartnerAccept();
});
await page.waitForTimeout(2500);

async function checkSide(side) {
  return page.evaluate((sk) => {
    const frame = document.getElementById(sk === "A" ? "frame-a-thread" : "frame-b-thread");
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win) return { ok: false, error: "no_frame" };

    const body = doc.body;
    const main = doc.querySelector(".mvp-slack-thread");
    const msgs = doc.querySelector(".mvp-slack-thread__msgs");
    const compose = doc.querySelector(".mvp-slack-thread__compose");
    const input = doc.querySelector("[data-builder-mvp-thread-input]");
    const send = doc.querySelector("[data-builder-mvp-thread-send]");
    if (!main || !msgs || !compose || !input || !send) {
      return { ok: false, error: "missing_nodes" };
    }

    const msgsStyle = win.getComputedStyle(msgs);
    const msgsInnerScroll =
      msgsStyle.overflowY === "auto" || msgsStyle.overflowY === "scroll";
    const msgsMaxHeight = msgsStyle.maxHeight;

    const scrollRoots = [body, doc.documentElement, main];
    scrollRoots.forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });

    const composeRect = compose.getBoundingClientRect();
    const sendRect = send.getBoundingClientRect();
    const frameH = win.innerHeight;
    const composeVisible = composeRect.top < frameH - 4 && composeRect.bottom > 0;
    const sendVisible = sendRect.top < frameH - 4 && sendRect.bottom > 0;
    const sendEnabled = !send.disabled && send.offsetParent !== null;

    const completeBtn = doc.querySelector("[data-builder-mvp-thread-complete-open]");
    let modalOk = false;
    let modalDetail = {};
    if (completeBtn && !completeBtn.disabled) {
      completeBtn.click();
      const modal = doc.querySelector("[data-builder-mvp-thread-complete-modal]");
      const submit = modal?.querySelector('[type="submit"]');
      const close = modal?.querySelector("[data-builder-mvp-thread-complete-close]");
      if (modal && submit && close) {
        modal.hidden = false;
        modal.removeAttribute("hidden");
        modal.scrollTop = 0;
        const closeRectTop = close.getBoundingClientRect();
        const closeReachable =
          closeRectTop.top >= 0 && closeRectTop.bottom <= frameH + 2;
        modal.scrollTop = modal.scrollHeight;
        const submitRect = submit.getBoundingClientRect();
        const submitReachable =
          submitRect.top >= 0 && submitRect.bottom <= frameH + 2;
        modalOk = closeReachable && submitReachable;
        modalDetail = {
          submitTop: submitRect.top,
          closeTop: closeRectTop.top,
          modalOverflow: win.getComputedStyle(modal).overflowY,
          closeReachable,
          submitReachable,
        };
        modal.hidden = true;
      }
    }

    return {
      ok:
        !msgsInnerScroll &&
        composeVisible &&
        sendVisible &&
        sendEnabled &&
        modalOk,
      side: sk,
      frameH,
      msgsOverflowY: msgsStyle.overflowY,
      msgsMaxHeight,
      msgsInnerScroll,
      bodyOverflowY: win.getComputedStyle(body).overflowY,
      mainOverflowY: win.getComputedStyle(main).overflowY,
      composePosition: win.getComputedStyle(compose).position,
      composeVisible,
      sendVisible,
      modalOk,
      modalDetail,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
    };
  }, side);
}

const a = await checkSide("A");
const b = await checkSide("B");

console.log(JSON.stringify({ A: a, B: b }, null, 2));

const ok =
  a.ok &&
  b.ok &&
  !a.msgsInnerScroll &&
  !b.msgsInnerScroll &&
  a.bodyOverflowY === "auto" &&
  b.bodyOverflowY === "auto";

console.log(ok ? "PASS thread compose scroll" : "FAIL thread compose scroll");
await browser.close();
process.exit(ok ? 0 : 1);
