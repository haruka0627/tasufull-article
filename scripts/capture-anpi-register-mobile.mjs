/**
 * 安否サービス登録 — スマホプレビュー中央寄せ確認
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "anpi-register-mobile");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-register.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();

async function capture(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}/anpi-register.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth;
    const app = document.querySelector(".dash-app");
    const tab = document.querySelector("[data-tasu-app-tabbar-injected]");
    const section = document.querySelector(".register-card-container");
    const input = document.querySelector('input[name="contract_holder_name"]');
    const ar = (el) => el?.getBoundingClientRect();
    const appR = ar(app);
    const tabR = ar(tab);
    const sectionR = ar(section);
    const inputR = ar(input);
    return {
      vw,
      hasMobileClass: document.body.classList.contains("tasu-app-mobile-page"),
      app: appR
        ? { left: appR.left, right: appR.right, width: appR.width, marginL: appR.left, marginR: vw - appR.right }
        : null,
      tab: tabR
        ? { left: tabR.left, right: tabR.right, width: tabR.width, marginL: tabR.left, marginR: vw - tabR.right }
        : null,
      section: sectionR
        ? { left: sectionR.left, right: sectionR.right, width: sectionR.width, marginL: sectionR.left, marginR: vw - sectionR.right }
        : null,
      inputWidth: inputR?.width ?? null,
    };
  });

  const outPath = path.join(OUT_DIR, name);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();
  return metrics;
}

const m390 = await capture("01-register-390.png", { width: 390, height: 844 });
const m800 = await capture("02-register-800-centered.png", { width: 800, height: 844 });

console.log("Base:", base);
console.log("390px:", JSON.stringify(m390, null, 2));
console.log("800px:", JSON.stringify(m800, null, 2));

const centered =
  m800.app &&
  Math.abs(m800.app.marginL - m800.app.marginR) < 2 &&
  m800.app.width <= 390.5;
if (!centered) {
  console.error("FAIL: 800px viewport — dash-app not centered");
  process.exit(1);
}
console.log("OK: 800px viewport — dash-app centered within 390px");

const card390 =
  m390.section &&
  Math.abs(m390.section.marginL - m390.section.marginR) < 2 &&
  m390.section.width >= 360;
if (!card390) {
  console.error("FAIL: 390px — card container not centered or too narrow");
  process.exit(1);
}
console.log("OK: 390px — card container centered with usable width");
