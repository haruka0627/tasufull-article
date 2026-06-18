import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "worker-detail");
const PATH = "/detail-worker.html?id=worker_hiro_001";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}${PATH}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const SHOTS = [
  { file: "worker-detail-390.png", width: 390, height: 844 },
  { file: "worker-detail-768.png", width: 768, height: 1024 },
  { file: "worker-detail-1280.png", width: 1280, height: 800 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });
  await page.goto(`${base}${PATH}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Saved:", outPath);

  if (shot.width <= 960) {
    const metrics = await page.evaluate(() => {
      const tab = document.querySelector(".tasu-app-tabbar");
      const cta = document.querySelector(".skill-hero-premium__cta");
      const tr = tab?.getBoundingClientRect();
      const cr = cta?.getBoundingClientRect();
      return {
        ctaPosition: cta ? getComputedStyle(cta).position : null,
        ctaBottom: cta ? getComputedStyle(cta).bottom : null,
        gap: tr && cr ? tr.top - cr.bottom : null,
        bodyPadBottom: getComputedStyle(document.body).paddingBottom,
      };
    });
    console.log(`  metrics (${shot.width}px):`, JSON.stringify(metrics));
  }

  await page.close();
}

});
console.log("Done.");

await closeAllBrowsers();
