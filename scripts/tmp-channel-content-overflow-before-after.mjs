import { chromium } from "playwright";

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 900 });
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);

await page.addStyleTag({
  content:
    ".tlv-studio-table-wrap{max-width:none!important;overflow-x:visible!important}" +
    ".tlv-studio-page__tabs{max-width:none!important;min-width:auto!important}",
});
await page.waitForTimeout(150);

const before = await page.evaluate(() => {
  const vw = window.innerWidth;
  const table = document.querySelector("table.tlv-studio-table");
  const tr = table?.getBoundingClientRect();
  return {
    innerWidth: vw,
    documentScrollWidth: document.documentElement.scrollWidth,
    delta: document.documentElement.scrollWidth - vw,
    table: tr
      ? { left: tr.left, right: tr.right, width: tr.width, rightOver: tr.right - vw }
      : null,
    top: [...document.querySelectorAll("*")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return {
          tag: el.tagName,
          cls: String(el.className || "").split(" ")[0],
          right: Math.round(r.right * 10) / 10,
          rightOver: Math.round((r.right - vw) * 10) / 10,
        };
      })
      .filter(Boolean)
      .filter((x) => x.right > vw + 0.5)
      .sort((a, b) => b.right - a.right)
      .slice(0, 5),
  };
});

await page.evaluate(() => {
  for (const s of [...document.querySelectorAll("style")]) {
    if (s.textContent?.includes("max-width:none!important")) s.remove();
  }
});
await page.waitForTimeout(150);

const after = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  documentScrollWidth: document.documentElement.scrollWidth,
  delta: document.documentElement.scrollWidth - window.innerWidth,
}));

console.log(JSON.stringify({ before, after }, null, 2));
await browser.close();
