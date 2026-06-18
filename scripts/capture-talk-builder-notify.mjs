/**
 * TASFUL TALK — Builder通知マスター v1.0 スクリーンショット（390px / talkDev=1）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-builder-notify-v1");
fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

const page = await context.newPage();
await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_platform_notify_master_v2",
    "tasful_builder_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
});

const notifyUrl = buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1&benchEmbed=1&userId=u_me");
await page.goto(notifyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(600);

async function scrollToCard(id) {
  const card = page.locator(`article[data-talk-notify-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
}

const captureIds = [
  { id: "builder-ops-route-001", file: "01-notify-ops-route.png" },
  { id: "builder-board-apply-001", file: "02-builder-board-apply.png" },
  { id: "builder-board-thread-001", file: "03-builder-board-thread.png" },
  { id: "builder-board-completion-001", file: "04-builder-board-completion.png" },
];

for (const shot of captureIds) {
  await scrollToCard(shot.id);
  await page.screenshot({ path: path.join(OUT_DIR, shot.file), fullPage: false });
  console.log("Saved:", shot.file);
}

const navTargets = [
  {
    file: "05-partner-assignment.png",
    url: "/builder/partner-assignment.html?role=partner&partnerId=demo-partner-001&projectId=builder_demo_001&talkDev=1",
  },
  {
    file: "06-board-apply-destination.png",
    url: "/builder/board-project-detail.html?id=demo-project-001&view=applications&role=owner&talkDev=1",
  },
  {
    file: "07-thread-destination.png",
    url: "/builder/mvp-thread.html?id=builder_thread_demo_001&talkDev=1",
  },
  {
    file: "08-board-completion-destination.png",
    url: "/builder/board-thread.html?id=demo-thread-001#completion&talkDev=1",
  },
];

for (const target of navTargets) {
  const p = await context.newPage();
  if (target.url.includes("partner-assignment")) {
    await p.addInitScript(() => {
      const key = "tasful:builder:mvp:v1";
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const state = JSON.parse(raw);
        const idx = (state.projects || []).findIndex((p) => p.project_id === "builder_demo_001");
        if (idx >= 0) {
          state.projects[idx].assignment_status = "pending";
          state.projects[idx].selected_partner_ids = ["demo-partner-001"];
          state.projects[idx].calendar_assigned_partner_id = "demo-partner-001";
          localStorage.setItem(key, JSON.stringify(state));
        }
      } catch {
        /* ignore */
      }
    });
  }
  await p.goto(`${base}${target.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (target.url.includes("partner-assignment")) {
    await p.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 }).catch(() => {});
  }
  await p.waitForTimeout(1200);
  const outPath = path.join(OUT_DIR, target.file);
  await p.screenshot({ path: outPath, fullPage: false });
  console.log("Saved:", target.file);
  await p.close();
}

await browser.close();
console.log("Done.");
