import { chromium } from "./lib/playwright-browser.mjs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const TARGETS = [
  { chip: "anomaly", id: "ops-ai-watch" },
  { chip: "approval", id: "ops-ai-hsg" },
  { chip: "inquiries", id: "ops-ai-kpi" },
  { chip: "autofix", id: "ops-ai-autofix" },
  { chip: "unresolved", id: "ops-ai-hub" },
];

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

async function main() {
  const browser = await chromium.launch();
  let fail = 0;

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${BASE}/admin-operations-dashboard.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-ops-morning-summary]");
    await page.waitForSelector("[data-ops-morning-chip]");

    const fold = await page.evaluate(() => {
      const ms = document.querySelector("[data-ops-morning-summary]");
      const r = ms?.getBoundingClientRect();
      return {
        aboveFold: r ? r.top < window.innerHeight && r.bottom > 0 : false,
        chipCount: document.querySelectorAll("[data-ops-morning-chip]").length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });

    if (!fold.aboveFold || fold.chipCount < 6 || fold.overflow) {
      console.error(`FAIL: [${vp.name}] fold=${fold.aboveFold} chips=${fold.chipCount} overflow=${fold.overflow}`);
      fail += 1;
    } else {
      console.log(`PASS: [${vp.name}] Morning Summary above fold (${fold.chipCount} chips, no horizontal overflow)`);
    }

    for (const t of TARGETS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      await page.click(`[data-ops-morning-chip="${t.chip}"]`);
      await page.waitForTimeout(500);
      const jump = await page.evaluate((id) => {
        const el = document.getElementById(id);
        const r = el?.getBoundingClientRect();
        return {
          hash: location.hash,
          visible: r ? r.top < window.innerHeight * 0.35 && r.bottom > 0 : false,
          top: r?.top,
        };
      }, t.id);

      if (jump.hash !== `#${t.id}` || !jump.visible) {
        console.error(`FAIL: [${vp.name}] ${t.chip} → #${t.id} hash=${jump.hash} visible=${jump.visible} top=${jump.top}`);
        fail += 1;
      } else {
        console.log(`PASS: [${vp.name}] chip ${t.chip} → #${t.id}`);
      }
    }

    await page.close();
  }

  await browser.close();
  if (fail) {
    console.error(`\n${fail} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log("\nAll morning summary jump tests passed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
