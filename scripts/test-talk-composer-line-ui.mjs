#!/usr/bin/env node
/**
 * TALK composer 最終QA — 390 / 430 / 768 / PC
 *   node scripts/test-talk-composer-line-ui.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "reports", "screenshots", "talk-composer-line");
const ATTACH_FIXTURE = path.join(__dirname, "..", "images", "tasful-ai-circle-icon.png");
const THREAD_ID = "talk-mock-friend-001";
const CHAT_DETAIL_THREAD = "chat-demo-skill-deal-001";

const VIEWPORTS = [
  { label: "390", width: 390, height: 844, isMobile: true },
  { label: "430", width: 430, height: 932, isMobile: true },
  { label: "768", width: 768, height: 1024, isMobile: false },
  { label: "pc", width: 1280, height: 800, isMobile: false },
];

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
fs.mkdirSync(OUT, { recursive: true });

function talkThreadUrl() {
  return buildLocalPageUrl(base, "talk-home.html", `?tab=chat&thread=${THREAD_ID}&talkDev=1`);
}

function chatDetailUrl() {
  return buildLocalPageUrl(
    base,
    "chat-detail.html",
    `?thread=${CHAT_DETAIL_THREAD}&userId=u_me&talkDev=1&review=chat-demo`
  );
}

async function seedChatDetailDemo(page) {
  await page.evaluate(() => {
    const thread = {
      id: "chat-demo-skill-deal-001",
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId: "demo-skill-001",
      listing: { id: "demo-skill-001", type: "skill", title: "Web制作・LP改修" },
      buyerId: "u_me",
      sellerId: "u_store",
      partnerUserId: "u_store",
      partner: { id: "u_store", displayName: "プレミアムホーム" },
      status: "open",
    };
    const store = window.TasuChatThreadStore;
    if (store?.readAll && store?.writeAll) {
      const threads = store.readAll().filter((t) => String(t.id) !== thread.id);
      threads.unshift(thread);
      store.writeAll(threads);
    }
  });
}

async function prepareChatDetail(page) {
  await page.goto(chatDetailUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await seedChatDetailDemo(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chatInput:not([disabled])", { timeout: 20000 });
  await page.waitForSelector('body[data-chat-detail-ready="true"]', { timeout: 20000 }).catch(() => {});
}

function composerSelector(surface) {
  return surface === "talk-home" ? "[data-talk-line-composer]" : ".chat-composer--line";
}

function inputSelector(surface) {
  return surface === "talk-home" ? "[data-talk-line-composer-input]" : "#chatInput";
}

function fileInputSelector(surface) {
  return surface === "talk-home" ? "[data-talk-line-file-input]" : "#chatFileInput";
}

async function measureComposer(page, surface) {
  return page.evaluate((sel) => {
    const composer = document.querySelector(sel);
    const line = composer?.querySelector(".chat-composer__line");
    const left = composer?.querySelector(".chat-composer__side--left");
    const field = composer?.querySelector(".chat-composer__field-wrap");
    const input = composer?.querySelector(".chat-composer__input");
    const emoji = composer?.querySelector(".chat-composer__icon--inline-emoji");
    const voice = composer?.querySelector(".chat-composer__icon--voice");
    const send = composer?.querySelector(".chat-composer__send, [data-talk-line-composer-send]");
    const leftIcons = [...(left?.querySelectorAll(".chat-composer__icon") || [])];
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const rect = (el) => el?.getBoundingClientRect();
    const cx = (el) => {
      const r = rect(el);
      return r ? r.left + r.width / 2 : null;
    };
    const composerRect = rect(composer);
    const fieldRect = rect(field);
    return {
      composerHeight: composerRect?.height ?? 0,
      composerBottom: composerRect?.bottom ?? 0,
      composerPaddingLeft: cs(composer)?.paddingLeft ?? "",
      composerPaddingBottom: cs(composer)?.paddingBottom ?? "",
      placeholder: input?.placeholder ?? "",
      iconCountLeft: leftIcons.length,
      order: {
        plus: cx(leftIcons[0]),
        camera: cx(leftIcons[1]),
        gallery: cx(leftIcons[2]),
        field: cx(field),
        emoji: cx(emoji),
        voice: cx(voice),
        send: cx(send),
      },
      fieldHeight: fieldRect?.height ?? 0,
      fieldRadius: cs(field)?.borderRadius ?? "",
      hasInlineEmoji: Boolean(emoji),
      sendHidden: send?.hidden ?? true,
      voiceDisplay: cs(voice)?.display ?? "",
      sendDisplay: cs(send)?.display ?? "",
    };
  }, composerSelector(surface));
}

async function measureScrollClearance(page, surface) {
  return page.evaluate((surfaceName) => {
    const messages =
      surfaceName === "talk-home"
        ? document.querySelector("[data-talk-line-messages]")
        : document.getElementById("chatMessages");
    const composer =
      surfaceName === "talk-home"
        ? document.querySelector("[data-talk-line-composer]")
        : document.querySelector(".chat-composer--line");
    if (!messages || !composer) return { ok: false, reason: "missing elements" };
    messages.scrollTop = messages.scrollHeight;
    const last =
      messages.querySelector(".chat-msg--me:last-of-type") ||
      messages.querySelector(".message-row.peer:last-of-type") ||
      messages.querySelector(".chat-msg:last-of-type");
    if (!last) return { ok: true, reason: "no messages" };
    const composerTop = composer.getBoundingClientRect().top;
    const lastBottom = last.getBoundingClientRect().bottom;
    const gap = composerTop - lastBottom;
    return { ok: gap >= 4, gap, composerTop, lastBottom };
  }, surface);
}

async function shotComposer(page, surface, vp, state) {
  const file = `${surface}-${vp}-${state}.png`;
  await page.locator(composerSelector(surface)).screenshot({ path: path.join(OUT, file) });
  return file;
}

async function checkEmojiSmileIcon(page, surface, vp, fail, pass) {
  const r = await page.evaluate((sel) => {
    const composer = document.querySelector(sel);
    const btn = composer?.querySelector(".chat-composer__icon--inline-emoji");
    const field = composer?.querySelector(".chat-composer__field-wrap");
    const svg = btn?.querySelector("svg");
    if (!btn || !svg || !field) return { ok: false, reason: "missing elements" };
    const fieldR = field.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    const insideField =
      btnR.right <= fieldR.right + 2 &&
      btnR.left >= fieldR.left &&
      btnR.top >= fieldR.top - 2 &&
      btnR.bottom <= fieldR.bottom + 2;
    const eyes = [...svg.querySelectorAll("circle")].filter((c) => {
      const fill = c.getAttribute("fill");
      return fill && fill !== "none";
    });
    const smile = [...svg.querySelectorAll("path")].some((p) => {
      const d = p.getAttribute("d") || "";
      return /a[\d.]+\s[\d.]+\s0\s0\s1/.test(d) || /Q[\d.]+\s[\d.]+/.test(d);
    });
    const outerCircle = svg.querySelector("circle[stroke]");
    const strokeOk = Number(outerCircle?.getAttribute("stroke-width") || 0) >= 1.7;
    const eyesBlack = eyes.every((c) => /^#222/i.test(c.getAttribute("fill") || ""));
    const sizeOk = btnR.width >= 24 && btnR.width <= 28;
    return {
      ok: insideField && eyes.length === 2 && eyesBlack && smile && strokeOk && sizeOk,
      insideField,
      eyeCount: eyes.length,
      smile,
      size: Math.round(btnR.width),
    };
  }, composerSelector(surface));
  if (!r.ok) fail(`${vp} ${surface} emoji smile: ${JSON.stringify(r)}`);
  else pass(`${vp} ${surface} emoji: smile SVG (dot eyes, ${r.size}px)`);
}

async function checkSendPaperPlaneIcon(page, surface, vp, fail, pass) {
  const r = await page.evaluate((sel) => {
    const send = document.querySelector(sel)?.querySelector(".chat-composer__send, [data-talk-line-composer-send]");
    if (!send || send.hidden) return { ok: false, reason: "send hidden or missing" };
    const svg = send.querySelector("svg");
    if (!svg) return { ok: false, reason: "no svg" };
    const html = svg.innerHTML;
    const isUpArrow = /M12 19V6|M12 19v6|l5-5 5 5/.test(html);
    const paths = [...svg.querySelectorAll("path")];
    const hasFilledPlane = paths.some((p) => {
      const fill = p.getAttribute("fill");
      const d = p.getAttribute("d") || "";
      return fill && fill !== "none" && d.length > 12 && /L23 12|2\.01 21/.test(d);
    });
    const bg = getComputedStyle(send).backgroundColor;
    const greenOk = bg === "rgb(6, 199, 85)";
    const sendR = send.getBoundingClientRect();
    const roundOk = Math.abs(sendR.width - sendR.height) < 4;
    return { ok: !isUpArrow && hasFilledPlane && greenOk && roundOk, isUpArrow, hasFilledPlane, greenOk, roundOk, bg };
  }, composerSelector(surface));
  if (!r.ok) fail(`${vp} ${surface} send icon: ${JSON.stringify(r)}`);
  else pass(`${vp} ${surface} send: green circle + white paper plane`);
}

async function testEmpty(page, surface, vp, fail, pass) {
  const m = await measureComposer(page, surface);
  await shotComposer(page, surface, vp, "empty");

  if (m.placeholder !== "Aa") fail(`${vp} ${surface} empty: placeholder (${m.placeholder})`);
  else pass(`${vp} ${surface} empty: placeholder Aa`);

  if (m.iconCountLeft !== 3) fail(`${vp} ${surface} empty: left icons (${m.iconCountLeft})`);
  else pass(`${vp} ${surface} empty: +/camera/gallery`);

  const o = m.order;
  if (!(o.plus < o.camera && o.camera < o.gallery && o.gallery < o.field && o.field < o.emoji)) {
    fail(`${vp} ${surface} empty: icon order ${JSON.stringify(o)}`);
  } else pass(`${vp} ${surface} empty: icon order OK`);

  if (!m.sendHidden) fail(`${vp} ${surface} empty: send visible`);
  else pass(`${vp} ${surface} empty: send hidden`);

  if (m.voiceDisplay === "none") fail(`${vp} ${surface} empty: voice hidden`);
  else pass(`${vp} ${surface} empty: voice visible`);

  if (m.composerHeight < 68 || m.composerHeight > 110) {
    fail(`${vp} ${surface} empty: composer height ${m.composerHeight}`);
  } else pass(`${vp} ${surface} empty: composer height ${Math.round(m.composerHeight)}px`);

  await checkEmojiSmileIcon(page, surface, vp, fail, pass);

  return m.fieldHeight;
}

async function testFilled(page, surface, vp, baseFieldHeight, fail, pass) {
  await page.fill(inputSelector(surface), "テスト送信");
  await page.waitForTimeout(120);
  const m = await measureComposer(page, surface);
  await shotComposer(page, surface, vp, "filled");

  if (m.sendHidden) fail(`${vp} ${surface} filled: send hidden`);
  else pass(`${vp} ${surface} filled: send visible`);

  if (m.voiceDisplay !== "none") fail(`${vp} ${surface} filled: voice still visible`);
  else pass(`${vp} ${surface} filled: voice hidden`);

  await checkSendPaperPlaneIcon(page, surface, vp, fail, pass);
  await checkEmojiSmileIcon(page, surface, vp, fail, pass);

  if (baseFieldHeight > 0 && Math.abs(m.fieldHeight - baseFieldHeight) > 8) {
    fail(`${vp} ${surface} filled: field height drift ${baseFieldHeight}→${m.fieldHeight}`);
  } else pass(`${vp} ${surface} filled: field height stable`);

  await page.fill(inputSelector(surface), "");
  await page.waitForTimeout(80);
}

async function testAttachment(page, surface, vp, fail, pass) {
  await page.setInputFiles(fileInputSelector(surface), ATTACH_FIXTURE);
  await page.waitForTimeout(300);
  const m = await measureComposer(page, surface);
  await shotComposer(page, surface, vp, "attachment");

  if (m.sendHidden) fail(`${vp} ${surface} attachment: send hidden`);
  else pass(`${vp} ${surface} attachment: send visible without text`);

  await checkSendPaperPlaneIcon(page, surface, vp, fail, pass);

  const previewVisible = await page.evaluate((surfaceName) => {
    const el =
      surfaceName === "talk-home"
        ? document.querySelector("[data-talk-line-attach-preview]")
        : document.getElementById("chatAttachPreview");
    return Boolean(el && !el.hidden && el.querySelector("img"));
  }, surface);
  if (!previewVisible) fail(`${vp} ${surface} attachment: preview missing`);
  else pass(`${vp} ${surface} attachment: preview visible`);

  await page.evaluate((surfaceName) => {
    if (surfaceName === "talk-home") {
      document.querySelector("[data-talk-line-attach-remove]")?.click();
    } else {
      document.getElementById("chatAttachRemove")?.click();
    }
  }, surface);
  await page.waitForTimeout(80);
}

async function testPlusMenu(page, surface, vp, fail, pass) {
  if (vp === "pc") {
    const hidden = await page.evaluate((sel) => {
      const menu =
        document.querySelector(sel === "talk-home" ? "[data-talk-line-composer-plus-menu]" : "#chatComposerPlusMenu");
      return menu ? getComputedStyle(menu).display === "none" : true;
    }, surface);
    if (!hidden) fail(`${vp} ${surface} plus-menu: should be hidden on PC`);
    else pass(`${vp} ${surface} plus-menu: PC hidden (expected)`);
    return;
  }

  const plusSel =
    surface === "talk-home"
      ? '[data-talk-line-action="plus"]'
      : "#chatComposerPlus";
  await page.evaluate((sel) => document.querySelector(sel)?.click(), plusSel);
  await page.waitForTimeout(150);

  const menu = await page.evaluate((surfaceName) => {
    const menuEl =
      surfaceName === "talk-home"
        ? document.querySelector("[data-talk-line-composer-plus-menu]")
        : document.getElementById("chatComposerPlusMenu");
    const aiBtn =
      surfaceName === "talk-home"
        ? menuEl?.querySelector("[data-talk-tasful-ai-open]")
        : document.getElementById("chatAiBtn");
    if (!menuEl || menuEl.hidden) return { ok: false, reason: "menu hidden" };
    const r = menuEl.getBoundingClientRect();
    const composer = document.querySelector(
      surfaceName === "talk-home" ? "[data-talk-line-composer]" : ".chat-composer--line"
    );
    const cr = composer?.getBoundingClientRect();
    const line = composer?.querySelector(".chat-composer__line");
    const lineTop = line?.getBoundingClientRect().top ?? 0;
    const inViewport = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    const aboveLine = r.bottom <= lineTop + 2;
    const insideComposer = cr ? r.top >= cr.top - 2 && r.bottom <= cr.bottom + 2 : true;
    return {
      ok: Boolean(aiBtn?.textContent?.includes("TASFUL AI")) && inViewport && aboveLine && insideComposer,
      hasAi: Boolean(aiBtn?.textContent?.includes("TASFUL AI")),
      inViewport,
      aboveLine,
      menuTop: r.top,
      composerTop: cr?.top,
    };
  }, surface);

  await shotComposer(page, surface, vp, "plus-menu");

  if (!menu.ok) fail(`${vp} ${surface} plus-menu: ${JSON.stringify(menu)}`);
  else pass(`${vp} ${surface} plus-menu: TASFUL AI in composer`);

  await page.evaluate((surfaceName) => {
    const menuEl =
      surfaceName === "talk-home"
        ? document.querySelector("[data-talk-line-composer-plus-menu]")
        : document.getElementById("chatComposerPlusMenu");
    if (menuEl) menuEl.hidden = true;
  }, surface);
}

async function testScroll(page, surface, vp, fail, pass) {
  const scroll = await measureScrollClearance(page, surface);
  if (!scroll.ok) fail(`${vp} ${surface} scroll: gap=${scroll.gap ?? scroll.reason}`);
  else pass(`${vp} ${surface} scroll: last message not hidden (gap=${scroll.gap ?? "n/a"})`);
}

async function testSurface(page, surface, vp, fail, pass) {
  if (surface === "talk-home") {
    await page.goto(talkThreadUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("[data-talk-line-composer]", { timeout: 15000 });
    await page.waitForSelector(".talk-line-split--room-open", { timeout: 15000 }).catch(() => {});
  } else {
    await prepareChatDetail(page);
  }

  const baseFieldHeight = await testEmpty(page, surface, vp, fail, pass);
  await testFilled(page, surface, vp, baseFieldHeight, fail, pass);
  await testAttachment(page, surface, vp, fail, pass);
  await testPlusMenu(page, surface, vp, fail, pass);
  await testScroll(page, surface, vp, fail, pass);

  if (vp === "pc") {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) fail(`${vp} ${surface}: horizontal overflow`);
    else pass(`${vp} ${surface}: no horizontal overflow`);
  }
}

async function testVisualParity(page, vp, fail, pass) {
  await page.goto(talkThreadUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForSelector("[data-talk-line-composer]", { timeout: 15000 });
  const talk = await measureComposer(page, "talk-home");

  await prepareChatDetail(page);
  const detail = await measureComposer(page, "chat-detail");

  const diff = Math.abs(talk.composerHeight - detail.composerHeight);
  if (diff > 8) fail(`${vp} parity: composer height talk=${talk.composerHeight} detail=${detail.composerHeight}`);
  else pass(`${vp} parity: composer height match (${Math.round(talk.composerHeight)}px)`);

  if (talk.placeholder !== detail.placeholder) fail(`${vp} parity: placeholder mismatch`);
  else pass(`${vp} parity: placeholder match`);
}

async function main() {
  let failures = [];
await withPlaywrightBrowser(async (browser) => {
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    failures.push(m);
    console.log(`  ✗ ${m}`);
  };
  const consoleErrors = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.label} ===`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile });
    page.on("pageerror", (e) => consoleErrors.push(`${vp.label}: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/429|Failed to load resource|favicon/.test(text)) return;
      consoleErrors.push(`${vp.label}: ${text}`);
    });

    await testSurface(page, "talk-home", vp.label, fail, pass);
    await testSurface(page, "chat-detail", vp.label, fail, pass);
    await testVisualParity(page, vp.label, fail, pass);
    await page.close();
  }

    });

  if (consoleErrors.length) consoleErrors.forEach((e) => fail(`console: ${e}`));
  else pass("console errors: 0");

  console.log(`\nScreenshots: ${OUT}`);
  if (failures.length) {
    console.error(`\nFAIL (${failures.length})`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("\nPASS talk composer final QA");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
