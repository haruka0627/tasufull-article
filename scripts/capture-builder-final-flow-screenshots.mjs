/**
 * Builder 最終フロー — PC 1280 / SP 390 スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-final-flow-verify");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const MVP_KEY = "tasful:builder:mvp:v1";
const THREAD_ID = "thread-demo-001";
const PROJECT_ID = "demo-project-001";
const PARTNER_ID = "demo-partner-001";

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(path.join(OUT_DIR, "pc1280"), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, "sp390"), { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);
console.log("Output:", OUT_DIR);

const browser = await chromium.launch({ headless: true });

async function seedForScreenshots(page) {
  await page.evaluate(
    ({ mvpKey, projectId, threadId, partnerId }) => {
      localStorage.setItem(
        mvpKey,
        JSON.stringify({
          version: 1,
          owner_id: "demo-owner-001",
          partners: [{ partner_id: partnerId, display_name: "株式会社オレンジ建装" }],
          projects: [
            {
              project_id: projectId,
              owner_id: "demo-owner-001",
              title: "新宿区 共同住宅 外装改修",
              kind: "builder_board",
              board_type: "project",
              status: "open",
              required_partners: 1,
              selected_partner_ids: [partnerId],
              main_thread_id: threadId,
              created_at: new Date().toISOString(),
            },
          ],
          specs: { [projectId]: { overview: "点検用デモ", budget: { max: 800000 } } },
          threads: {
            [threadId]: {
              thread_id: threadId,
              project_id: projectId,
              thread_kind: "board_match",
              events: [{ type: "selected", ts: new Date().toISOString(), text: "採用" }],
              messages: [
                {
                  msg_id: "m1",
                  from: { type: "owner", name: "TASFUL運営" },
                  ts: new Date().toISOString(),
                  text: "よろしくお願いします。",
                },
              ],
            },
          },
          applications: [
            {
              application_id: "app-1",
              project_id: projectId,
              partner_id: partnerId,
              status: "selected",
              ts: new Date().toISOString(),
            },
          ],
        })
      );
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      localStorage.removeItem("tasful_builder_notify_master_v1");
      localStorage.removeItem("tasful_platform_notify_master_v1");
    },
    { mvpKey: MVP_KEY, projectId: PROJECT_ID, threadId: THREAD_ID, partnerId: PARTNER_ID }
  );
}

async function captureSet(viewport, tag) {
  const outSub = path.join(OUT_DIR, tag);
  const page = await browser.newPage({ viewport });

  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outSub, "01-notify-list.png") });

  await page.goto(`${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=partner`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await seedForScreenshots(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-thread-completion-submit]", { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outSub, "02-thread-completion-submit.png") });

  await page.locator("[data-thread-completion-comment]").fill("足場工事が完了しました。写真・請求書を添付します。");
  await page.locator("[data-thread-completion-submit]").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outSub, "03-thread-completion-submitted.png") });

  await page.evaluate(() => localStorage.setItem("tasful:builder:mvp:role", "owner"));
  await page.goto(`${base}/builder/board-thread.html?thread_id=${THREAD_ID}&role=owner`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("[data-thread-completion-approve]", { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outSub, "04-thread-completion-review.png") });

  await page.locator("[data-thread-completion-approve]").click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outSub, "05-thread-completed.png") });

  await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outSub, "06-notify-after-completion.png") });

  await page.close();
  console.log(`[${tag}] screenshots saved`);
}

await captureSet({ width: 1280, height: 900 }, "pc1280");
await captureSet({ width: 390, height: 844 }, "sp390");

await browser.close();
console.log("OK: screenshots captured at", OUT_DIR);
