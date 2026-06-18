/**
 * プロフィール設定 — PC/SP レイアウト確認（1280 / 1024 / 390）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "profile-settings-pc-layout");
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/profile-settings.html`, { method: "HEAD" });
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
  await page.goto(`${base}/profile-settings.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth;
    const ar = (el) => el?.getBoundingClientRect();
    const form = document.querySelector("[data-profile-form]");
    const pcForm = document.querySelector(".tasu-pc-profile-form");
    const mobileSettings = document.querySelector(".tasu-mobile-settings");
    const nickname = document.querySelector("[data-profile-nickname]");
    const submit = document.querySelector("[data-profile-submit]");
    const pcR = ar(pcForm);
    const formR = ar(form);
    const mobileR = ar(mobileSettings);
    const style = (el) => (el ? getComputedStyle(el) : null);
    const pcStyle = style(pcForm);
    const mobileStyle = style(mobileSettings);
    return {
      vw,
      page: document.body.dataset.page,
      hasMobileClass: document.body.classList.contains("tasu-app-mobile-page"),
      pcFormVisible: pcStyle?.display !== "none",
      mobileSettingsVisible: mobileStyle?.display !== "none",
      hasProfileForm: Boolean(form),
      hasNicknameInput: Boolean(nickname),
      hasSubmitBtn: Boolean(submit),
      pcForm: pcR
        ? {
            left: pcR.left,
            right: pcR.right,
            width: pcR.width,
            marginL: pcR.left,
            marginR: vw - pcR.right,
          }
        : null,
      formWidth: formR?.width ?? null,
      mobileWidth: mobileR?.width ?? null,
      stubGone: !document.body.textContent.includes("スマホでは"),
    };
  });

  const outPath = path.join(OUT_DIR, name);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();
  return metrics;
}

const m1280 = await capture("profile-settings-1280.png", { width: 1280, height: 800 });
const m1024 = await capture("profile-settings-1024.png", { width: 1024, height: 800 });
const m390 = await capture("profile-settings-390.png", { width: 390, height: 844 });

const report = {
  base,
  capturedAt: new Date().toISOString(),
  viewports: { m1280, m1024, m390 },
  checks: {
    stubRemoved: m1280.stubGone && m1024.stubGone && m390.stubGone,
    pcFormAt1280: m1280.hasProfileForm && m1280.pcFormVisible && m1280.hasSubmitBtn && !m1280.mobileSettingsVisible,
    pcFormAt1024: m1024.hasProfileForm && m1024.pcFormVisible && m1024.hasSubmitBtn && !m1024.mobileSettingsVisible,
    mobileListAt390: m390.mobileSettingsVisible && !m390.pcFormVisible,
    pcCentered1280:
      m1280.pcForm &&
      Math.abs(m1280.pcForm.marginL - m1280.pcForm.marginR) < 40 &&
      m1280.pcForm.width >= 700 &&
      m1280.pcForm.width <= 820,
    pcCentered1024:
      m1024.pcForm &&
      Math.abs(m1024.pcForm.marginL - m1024.pcForm.marginR) < 40 &&
      m1024.pcForm.width >= 700 &&
      m1024.pcForm.width <= 820,
  },
};

fs.writeFileSync(path.join(OUT_DIR, "layout-report.json"), JSON.stringify(report, null, 2));

console.log("Base:", base);
console.log(JSON.stringify(report, null, 2));

const failed = Object.entries(report.checks).filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL:", failed.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("PASS: profile-settings PC layout");
