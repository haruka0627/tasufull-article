/**
 * Builder 運営⇔パートナー 7フロー通知 — 通知タブキャプチャ + JSON出力
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-ops-flow-notify");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

const FLOW_IDS = [
  "builder-ops-flow-001",
  "builder-ops-flow-002",
  "builder-ops-flow-003",
  "builder-ops-flow-004",
  "builder-ops-flow-005",
  "builder-ops-flow-006",
  "builder-ops-flow-007",
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/talk-home.html?tab=notify`, { method: "GET" });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_builder_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-ops-flow-001"]', { timeout: 20000 });
await page.waitForTimeout(1200);

const audit = await page.evaluate((ids) => {
  const rows = (window.TasuTalkData?.getNotifications?.({ applySettings: false }) || []).filter((n) =>
    ids.includes(String(n.id))
  );
  const cards = ids.map((id) => {
    const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
    const tags = [...(card?.querySelectorAll(".talk-notify-card__tag") || [])].map((el) =>
      el.textContent?.trim()
    );
    return {
      id,
      exists: Boolean(card),
      title: card?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
      tags,
      scope: card?.querySelector(".talk-notify-card__scope-chip")?.textContent?.trim() || "",
    };
  });
  return { rows, cards, flowCases: window.TasuTalkBuilderNotifyMaster?.BUILDER_OPS_FLOW_CASES || [] };
}, FLOW_IDS);

const jsonPath = path.join(OUT_DIR, "builder-ops-flow-notifications.json");
fs.writeFileSync(jsonPath, JSON.stringify(audit.rows, null, 2), "utf8");
console.log("Saved JSON:", jsonPath);

let failed = false;
for (const card of audit.cards) {
  const ok = card.exists && card.tags.length >= 3;
  console.log(ok ? "OK" : "NG", card.id, card.title, card.tags.join(" / "));
  if (!ok) failed = true;
}

async function captureCardShot(id, file) {
  await page.evaluate((notifyId) => {
    const card = document.querySelector(`article[data-talk-notify-id="${notifyId}"]`);
    card?.scrollIntoView({ block: "center" });
  }, id);
  await page.waitForTimeout(500);
  const box = await page.evaluate((notifyId) => {
    const card = document.querySelector(`article[data-talk-notify-id="${notifyId}"]`);
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, id);
  if (!box) throw new Error(`bounding box not found: ${id}`);
  await page.screenshot({
    path: path.join(OUT_DIR, file),
    clip: {
      x: Math.max(0, box.x - 4),
      y: Math.max(0, box.y - 4),
      width: Math.min(390, box.width + 8),
      height: box.height + 8,
    },
  });
  console.log("Saved:", file);
}

await captureCardShot("builder-ops-flow-001", "notify-tags-flow-001-390.png");
await captureCardShot("builder-ops-flow-005", "notify-tags-flow-005-390.png");

await page.screenshot({ path: path.join(OUT_DIR, "notify-tab-390.png"), fullPage: true });
console.log("Saved: notify-tab-390.png");

await browser.close();
process.exit(failed ? 1 : 0);
