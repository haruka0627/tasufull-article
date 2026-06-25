import { chromium } from "playwright";

const pages = [
  { url: "http://127.0.0.1:8788/live/studio-dashboard.html?talkDev=1&userId=u_me", preview: false },
  { url: "http://127.0.0.1:8788/live/studio-analytics.html?talkDev=1&userId=u_me", preview: true },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

for (const p of pages) {
  await page.goto(p.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const name = document.querySelector("[data-tlv-studio-channel-name]")?.textContent?.trim()
      || document.querySelector(".tlv-studio-sidebar__channel-name")?.textContent?.trim();
    const handle = document.querySelector("[data-tlv-studio-channel-handle]")?.textContent?.trim()
      || document.querySelector(".tlv-studio-sidebar__channel-handle")?.textContent?.trim();
    const subs = document.querySelector("[data-tlv-studio-channel-subs]")?.textContent?.trim()
      || document.querySelector(".tlv-studio-sidebar__channel-subs")?.textContent?.trim();
    const uuidLong = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(name || "");
    return { name, handle, subs, uuidLong };
  });
  console.log(JSON.stringify({ ...p, ...data }, null, 2));
}
console.log("consoleErrors:", errors.length);
await browser.close();
