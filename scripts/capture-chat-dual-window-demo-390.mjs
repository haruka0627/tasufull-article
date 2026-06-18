#!/usr/bin/env node
/**
 * プラット全カテゴリ — 390px A/B 通知一覧スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "chat-dual-window-demo");
const REVIEW = "chat-demo";
const VIEWPORT = { width: 390, height: 844 };

const qs = (pathname, params) => {
  const u = new URL(pathname, BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, String(v));
  });
  return u.pathname + u.search;
};

fs.mkdirSync(OUT, { recursive: true });

const CATEGORIES = ["job", "skill", "worker", "product", "shop", "business"];

/** partnerA / partnerB — A=掲載側, B=依頼/購入側 */
const SIDE_USER = Object.freeze({
  job: { A: "u_job_demo_full", B: "u_hiro" },
  skill: { A: "u_sachi", B: "u_hiro" },
  worker: { A: "demo-worker-001", B: "u_hiro" },
  product: { A: "u_product", B: "u_hiro" },
  shop: { A: "u_shop_demo", B: "u_hiro" },
  business: { A: "u_business_demo", B: "u_hiro" },
});

const shots = [
  {
    name: "00-launcher-390.png",
    url: qs("/chat-dual-window-demo.html", { talkDev: 1, review: REVIEW, demoProfile: "job" }),
  },
];

CATEGORIES.forEach((id) => {
  ["A", "B"].forEach((side) => {
    shots.push({
      name: `01-${id}-notify-${side.toLowerCase()}-390.png`,
      url: qs("/talk-home.html", {
        tab: "notify",
        talkDev: 1,
        review: REVIEW,
        demoProfile: id,
        demoConnect: 0,
        userId: SIDE_USER[id][side],
      }),
    });
  });
});

["skill", "product", "shop", "business"].forEach((id) => {
  ["A", "B"].forEach((side) => {
    shots.push({
      name: `02-${id}-notify-connect-${side.toLowerCase()}-390.png`,
      url: qs("/talk-home.html", {
        tab: "notify",
        talkDev: 1,
        review: REVIEW,
        demoProfile: id,
        demoConnect: 1,
        platform_connect: 1,
        userId: SIDE_USER[id][side],
      }),
    });
  });
});

shots.forEach((s) => logScreenshotUrl(s.name, s.url.replace(/^\//, "")));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

try {
  for (const shot of shots) {
    await page.goto(`${BASE}${shot.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (shot.url.includes("tab=notify")) {
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, shot.name) });
  }
} finally {
  await browser.close();
}

console.log(`capture-chat-dual-window-demo-390 OK → ${OUT} (${shots.length} files)`);
