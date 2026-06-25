import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "scripts/tmp-channel-content-overflow";
fs.mkdirSync(OUT, { recursive: true });

function overflowScript() {
  return `(() => {
    const vw = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll("*"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return {
          tag: el.tagName,
          className: String(el.className || "").slice(0, 120),
          id: el.id || "",
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
          width: Math.round(r.width * 10) / 10,
          overflowX: getComputedStyle(el).overflowX,
          position: getComputedStyle(el).position,
          rightOver: Math.round((r.right - vw) * 10) / 10,
        };
      })
      .filter(Boolean)
      .filter((x) => x.right > vw + 0.5 || x.left < -0.5)
      .sort((a, b) => b.right - a.right)
      .slice(0, 30);
    return {
      scrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      bodyScrollW: document.body.scrollWidth,
      offenders,
    };
  })()`;
}

const WIDTHS = [390, 768, 1280];
const browser = await chromium.launch();
const consoleErrors = [];

for (const width of WIDTHS) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${width}] ${msg.text()}`);
  });
  await page.setViewportSize({ width, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me", {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(overflowScript());
  await page.screenshot({ path: `${OUT}/channel-content-${width}.png`, fullPage: false });

  console.log(`\n=== ${width}px ===`);
  console.log(`scrollW=${metrics.scrollW} vw=${metrics.vw} match=${metrics.scrollW === metrics.vw}`);
  console.log(`offenders (${metrics.offenders.length}):`);
  for (const o of metrics.offenders.slice(0, 15)) {
    console.log(
      `  ${o.tag}.${o.className.split(" ")[0] || "-"} right=${o.right} (+${o.rightOver}px) w=${o.width} pos=${o.position}`,
    );
  }
  if (metrics.offenders.length > 15) console.log(`  ... and ${metrics.offenders.length - 15} more`);

  fs.writeFileSync(`${OUT}/offenders-${width}.json`, JSON.stringify(metrics, null, 2));
  await page.close();
}

await browser.close();
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
