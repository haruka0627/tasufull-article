import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "scripts/tmp-channel-content-overflow";
fs.mkdirSync(OUT, { recursive: true });

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [390, 768, 1280];

function measureScript() {
  return `(() => {
    const vw = window.innerWidth;
    const docScrollW = document.documentElement.scrollWidth;

    function cssPath(el) {
      if (!el || el === document.documentElement) return "html";
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && node !== document.body) {
        let part = node.tagName.toLowerCase();
        if (node.id) part += "#" + node.id;
        else if (node.className && typeof node.className === "string") {
          const cls = node.className.trim().split(/\\s+/).slice(0, 2).join(".");
          if (cls) part += "." + cls;
        }
        parts.unshift(part);
        node = node.parentElement;
      }
      return parts.join(" > ");
    }

    const offenders = Array.from(document.querySelectorAll("*"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return {
          path: cssPath(el),
          tag: el.tagName,
          className: String(el.className || "").slice(0, 120),
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          width: Math.round(r.width * 10) / 10,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: getComputedStyle(el).overflowX,
          position: getComputedStyle(el).position,
          rightOver: Math.round((r.right - vw) * 10) / 10,
        };
      })
      .filter(Boolean)
      .filter((x) => x.right > vw + 0.5 || x.left < -0.5)
      .sort((a, b) => b.right - a.right);

    const scrollDrivers = Array.from(document.querySelectorAll("*"))
      .map((el) => ({
        path: cssPath(el),
        tag: el.tagName,
        className: String(el.className || "").slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      }))
      .filter((x) => x.scrollWidth > vw + 0.5)
      .sort((a, b) => b.scrollWidth - a.scrollWidth)
      .slice(0, 15);

    const picks = [
      ".tlv-studio-mobile-shell",
      ".tlv-studio-mobile-content",
      ".tlv-studio-page",
      ".tlv-studio-page__tabs",
      ".tlv-studio-table-wrap",
      ".tlv-studio-table",
      "table.tlv-studio-table",
    ].map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sel,
        rect: {
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          width: Math.round(r.width * 10) / 10,
        },
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: cs.overflowX,
        maxWidth: cs.maxWidth,
        minWidth: cs.minWidth,
      };
    });

    return {
      innerWidth: vw,
      documentScrollWidth: docScrollW,
      bodyScrollWidth: document.body.scrollWidth,
      match: docScrollW === vw,
      hasHorizontalScroll: docScrollW > vw,
      overflowDelta: docScrollW - vw,
      scrollDrivers,
      topOffenders: offenders.slice(0, 20),
      picks,
    };
  })()`;
}

const browser = await chromium.launch();
const consoleErrors = [];
const summary = [];

for (const width of WIDTHS) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${width}px] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${width}px][pageerror] ${err.message}`);
  });

  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(measureScript());
  const shotPath = `${OUT}/channel-content-${width}-measure.png`;
  await page.screenshot({ path: shotPath, fullPage: false });

  const hasScrollbar = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  summary.push({ width, ...metrics, hasScrollbar, screenshot: shotPath });
  fs.writeFileSync(`${OUT}/measure-${width}.json`, JSON.stringify(metrics, null, 2));
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ summary: summary.map((s) => ({
  width: s.width,
  innerWidth: s.innerWidth,
  documentScrollWidth: s.documentScrollWidth,
  match: s.match,
  overflowDelta: s.overflowDelta,
  hasScrollbar: s.hasScrollbar,
  topOffender: s.topOffenders[0] || null,
  scrollDriver: s.scrollDrivers[0] || null,
  screenshot: s.screenshot,
})), consoleErrors: consoleErrors.length, errors: consoleErrors }, null, 2));
