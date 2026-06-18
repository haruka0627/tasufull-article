/**
 * 友達 / グループ トーク — 390px UI 確認
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-peer-message-390");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/talk-home.html?tab=chat`, { method: "GET" });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function openRoom(threadId) {
  await page.goto(`${base}/talk-home.html?tab=chat&thread=${encodeURIComponent(threadId)}&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-talk-line-messages]", { timeout: 15000 });
  await page.waitForTimeout(1200);
}

function measurePeerRow() {
  const row = document.querySelector(".message-row.peer");
  const avatar = row?.querySelector(".message-avatar, .message-avatar--initials");
  const bubble = row?.querySelector(".message-bubble");
  const time = row?.querySelector(".message-time");
  const name = row?.querySelector(".chat-bubble__name");
  const ar = avatar?.getBoundingClientRect();
  const br = bubble?.getBoundingClientRect();
  const tr = time?.getBoundingClientRect();
  return {
    avatarLeft: ar ? Math.round(ar.left) : null,
    avatarSize: ar ? Math.round(ar.width) : null,
    avatarToBubble: ar && br ? Math.round(br.left - ar.right) : null,
    bubbleLeft: br ? Math.round(br.left) : null,
    timeLeft: tr ? Math.round(tr.left) : null,
    timeUnderBubble: tr && br ? Math.abs(Math.round(tr.left - br.left)) <= 2 : null,
    hasSenderName: Boolean(name?.textContent?.trim()),
    senderNameText: name?.textContent?.trim() || "",
  };
}

await openRoom("talk-mock-friend-001");
const friendPeer = await page.evaluate(measurePeerRow);
const friendRead = await page.evaluate(() => {
  const read = document.querySelector(".chat-msg--me .chat-msg__read");
  const me = document.querySelector(".chat-msg--me .chat-bubble");
  const mr = me?.getBoundingClientRect();
  const vw = window.innerWidth;
  return {
    hasReadReceipt: read?.textContent?.trim() === "既読",
    meOnRight: mr ? mr.left + mr.width / 2 > vw * 0.55 : null,
    peerNameHidden: ![...document.querySelectorAll(".message-row.peer .chat-bubble__name")].some((el) =>
      el.textContent?.trim()
    ),
  };
});
await page.screenshot({ path: path.join(OUT_DIR, "talk-friend-chat-mobile390.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT_DIR, "talk-friend-read-receipt-mobile390.png"), fullPage: false });

await openRoom("talk-mock-group-001");
const groupPeer = await page.evaluate(measurePeerRow);
const groupNames = await page.evaluate(() =>
  [...document.querySelectorAll(".message-row.peer .chat-bubble__name")].map((el) => el.textContent?.trim())
);
await page.screenshot({ path: path.join(OUT_DIR, "talk-group-chat-mobile390.png"), fullPage: false });

});

const report = {
  friend: { peer: friendPeer, read: friendRead },
  group: { peer: groupPeer, names: groupNames },
};

const pass =
  friendRead.peerNameHidden &&
  friendPeer.avatarSize === 32 &&
  friendPeer.avatarToBubble >= 7 &&
  friendPeer.avatarToBubble <= 10 &&
  friendPeer.timeUnderBubble &&
  friendRead.hasReadReceipt &&
  friendRead.meOnRight &&
  groupNames.length >= 2 &&
  groupNames.includes("佐藤") &&
  groupNames.includes("鈴木");

console.log(JSON.stringify(report, null, 2));
console.log("PASS:", pass);
await closeAllBrowsers();
process.exit(pass ? 0 : 1);
