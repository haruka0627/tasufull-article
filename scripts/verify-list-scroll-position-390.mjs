/**
 * 一覧画面は scrollTop=0、チャット画面は最下部で開始することを検証（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { requireDevServer, logScreenshotUrl } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/list-scroll-position";

async function resolveDevBase() {
  for (const port of [5174, 5173]) {
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/`, { method: "HEAD" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  return requireDevServer();
}

const BASE = await resolveDevBase();
console.log(`[verify] using ${BASE}`);

const VIEWPORT = { width: 390, height: 844 };

const SCENARIOS = [
  {
    id: "01-applications-top",
    label: "応募状況 — 先頭表示",
    url: "/detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&view=applications&from=notify#applications",
    presetScroll: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 800));
    },
    measure: async (page) => {
      return page.evaluate(() => ({
        scrollY: window.scrollY,
        panelTop: document.querySelector("[data-job-applications-section]")?.getBoundingClientRect().top ?? null,
      }));
    },
    assert: (m) => m.scrollY <= 24,
  },
  {
    id: "02-notify-list-top",
    label: "通知一覧 — 先頭表示",
    url: "/talk-home.html?tab=notify&review=job&talkDev=1",
    presetScroll: async (page) => {
      await page.evaluate(() => {
        const panel =
          document.querySelector('[data-talk-panel="notify"]') ||
          document.querySelector(".talk-home-main") ||
          document.scrollingElement;
        if (panel) panel.scrollTop = 420;
        window.scrollTo(0, 420);
      });
      await page.evaluate(() => {
        sessionStorage.setItem("talkRestoreOnLoad", "1");
        sessionStorage.setItem("talkScrollPosition", "420");
        sessionStorage.setItem("talkActiveTab", "notify");
      });
    },
    measure: async (page) => {
      return page.evaluate(() => {
        const panel =
          document.querySelector('[data-talk-panel="notify"]') ||
          document.querySelector(".talk-home-main") ||
          document.scrollingElement;
        return {
          panelScroll: panel?.scrollTop || 0,
          scrollY: window.scrollY,
          firstId: document.querySelector("[data-talk-notify-id]")?.getAttribute("data-talk-notify-id") || "",
        };
      });
    },
    assert: (m) => m.panelScroll <= 24 && m.scrollY <= 24,
  },
  {
    id: "03-job-list-top",
    label: "求人一覧 — 先頭表示",
    url: "/listings.html?category=job&talkDev=1",
    presetScroll: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 600));
    },
    measure: async (page) => page.evaluate(() => ({ scrollY: window.scrollY })),
    assert: (m) => m.scrollY <= 24,
  },
  {
    id: "04-chat-bottom",
    label: "やりとりチャット — 最下部表示",
    url: "/chat-detail.html?thread=chat-demo-job-hired-001&userId=u_hiro&talkDev=1&from=talk",
    presetScroll: async () => {},
    measure: async (page) => {
      return page.evaluate(() => {
        const wrap = document.getElementById("chatMessages");
        if (!wrap) return { ok: false, reason: "no chatMessages" };
        const gap = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
        return {
          ok: true,
          scrollTop: wrap.scrollTop,
          scrollHeight: wrap.scrollHeight,
          clientHeight: wrap.clientHeight,
          gap,
        };
      });
    },
    assert: (m) => m.ok && m.gap <= 48,
  },
  {
    id: "05-talk-room-bottom",
    label: "TASFUL TALKルーム — 最下部表示",
    url: "/talk-home.html?tab=chat&thread=official_tasful&review=job&talkDev=1",
    presetScroll: async () => {},
    measure: async (page) => {
      return page.evaluate(() => {
        const wrap =
          document.querySelector("[data-talk-line-messages]") ||
          document.querySelector(".talk-line-room__messages");
        if (!wrap) return { ok: false, reason: "no talk line messages" };
        const gap = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
        return { ok: true, gap, scrollTop: wrap.scrollTop, scrollHeight: wrap.scrollHeight };
      });
    },
    assert: (m) => m.ok && m.gap <= 48,
  },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

const results = [];

for (const scenario of SCENARIOS) {
  const fullUrl = `${BASE}${scenario.url}`;
  logScreenshotUrl(scenario.label, scenario.url);
  await page.goto(fullUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await scenario.presetScroll(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  const measured = await scenario.measure(page);
  const pass = scenario.assert(measured);
  const shotPath = path.join(OUT_DIR, `${scenario.id}-390.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  results.push({ ...scenario, measured, pass, shotPath, fullUrl });
}

await browser.close();

console.log("\n=== list scroll position (390px) ===\n");
let failed = 0;
for (const r of results) {
  const mark = r.pass ? "OK" : "NG";
  if (!r.pass) failed += 1;
  console.log(`${mark} ${r.label}`);
  console.log(`  URL: ${r.fullUrl}`);
  console.log(`  measure: ${JSON.stringify(r.measured)}`);
  console.log(`  screenshot: ${r.shotPath}\n`);
}

process.exit(failed ? 1 : 0);
