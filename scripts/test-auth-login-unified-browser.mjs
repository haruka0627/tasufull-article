/**
 * login.html / signup.html デザイン統一検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "auth-login-unified";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ログイン / 会員登録 デザイン統一";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500, 5175];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/login.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function fixCssMime(page) {
  return page.route("**/*.css*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), "content-type": "text/css; charset=utf-8" };
    await route.fulfill({ response, headers, body: await response.body() });
  });
}

function collectPageErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(`[${page.url()}] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${page.url()}] ${m.text()}`);
  });
}

function assert(condition, message) {
  return { ok: !!condition, message };
}

async function measureAuthPage(page, base, pageName, viewport) {
  await fixCssMime(page);
  await page.setViewportSize(viewport);
  await page.goto(`${base}/${pageName}?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });

  return page.evaluate(() => {
    const card = document.querySelector(".signup-card");
    const cardCs = card ? getComputedStyle(card) : null;
    const layout = document.querySelector(".signup-layout");
    const layoutCs = layout ? getComputedStyle(layout) : null;
    const feature = document.querySelector(".signup-feature-card");
    const character = document.querySelector(".signup-character-wrap");
    const charCs = character ? getComputedStyle(character) : null;
    const bodyCs = getComputedStyle(document.body);
    const formArea = document.querySelector(".signup-form-area");
    const formRect = formArea?.getBoundingClientRect();
    const docWidth = document.documentElement.scrollWidth;
    const viewWidth = window.innerWidth;

    return {
      hasHeader: !!document.querySelector(".signup-header"),
      hasWaveBg: (document.querySelector(".signup-main")?.style.backgroundImage || getComputedStyle(document.querySelector(".signup-main")).backgroundImage) !== "none",
      featureCount: document.querySelectorAll(".signup-feature-item").length,
      characterVisible: charCs ? charCs.display !== "none" && character.offsetHeight > 0 : false,
      cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
      cardRadius: cardCs ? parseFloat(cardCs.borderRadius) : 0,
      cardPaddingTop: cardCs ? parseFloat(cardCs.paddingTop) : 0,
      layoutCols: layoutCs?.gridTemplateColumns || "",
      overflowX: bodyCs.overflowX,
      horizontalScroll: docWidth > viewWidth + 1,
      formTop: formRect ? Math.round(formRect.top) : 0,
      eyebrow: document.querySelector(".signup-left__eyebrow")?.textContent?.trim(),
      title: document.querySelector(".signup-left__title")?.textContent?.trim(),
      cardTitle: document.querySelector(".signup-card__title")?.textContent?.trim(),
      hasEmail: !!document.querySelector("[data-login-email], [data-signup-email]"),
      hasPassword: !!document.querySelector("[data-login-password], [data-signup-password]"),
      hasSocialGoogle: !!document.querySelector("[data-login-social='google'], [data-signup-social='google']"),
      hasSocialLine: !!document.querySelector("[data-login-social='line'], [data-signup-social='line']"),
    };
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const cases = [];
const allErrors = [];

for (const viewport of [
  { label: "1280", width: 1280, height: 900 },
  { label: "390", width: 390, height: 844 },
]) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  collectPageErrors(page, errors);

  const login = await measureAuthPage(page, base, "login.html", viewport);
  await page.screenshot({ path: path.join(OUT_DIR, `login-${viewport.label}.png`), fullPage: true });

  cases.push({
    id: `login-form-${viewport.label}`,
    ...assert(login.hasEmail && login.hasPassword, `${viewport.label}: login form fields visible`),
  });
  cases.push({
    id: `login-social-${viewport.label}`,
    ...assert(login.hasSocialGoogle && login.hasSocialLine, `${viewport.label}: social buttons`),
  });
  cases.push({
    id: `login-feature-${viewport.label}`,
    ...assert(login.featureCount === 5, `${viewport.label}: feature cards (${login.featureCount})`),
  });
  cases.push({
    id: `login-header-${viewport.label}`,
    ...assert(login.hasHeader, `${viewport.label}: header present`),
  });
  cases.push({
    id: `login-copy-${viewport.label}`,
    ...assert(
      login.eyebrow === "会員ログイン" && login.title === "おかえりなさい" && login.cardTitle === "ログイン",
      `${viewport.label}: copy (${login.eyebrow} / ${login.title})`
    ),
  });

  if (viewport.label === "1280") {
    cases.push({
      id: "login-character-pc",
      ...assert(login.characterVisible, "1280: character visible"),
    });
  } else {
    cases.push({
      id: "login-character-sp-hidden",
      ...assert(!login.characterVisible, "390: character hidden on SP"),
    });
  }

  const signup = await measureAuthPage(page, base, "signup.html", viewport);
  await page.screenshot({ path: path.join(OUT_DIR, `signup-${viewport.label}.png`), fullPage: true });

  cases.push({
    id: `login-no-hscroll-${viewport.label}`,
    ...assert(
      !login.horizontalScroll && !signup.horizontalScroll,
      `${viewport.label}: no horizontal scroll (login sw=${login.horizontalScroll ? "overflow" : "ok"}, signup sw=${signup.horizontalScroll ? "overflow" : "ok"})`
    ),
  });

  cases.push({
    id: `card-width-match-${viewport.label}`,
    ...assert(
      Math.abs(login.cardWidth - signup.cardWidth) <= 2,
      `${viewport.label}: card width login=${login.cardWidth} signup=${signup.cardWidth}`
    ),
  });
  cases.push({
    id: `card-radius-match-${viewport.label}`,
    ...assert(
      Math.abs(login.cardRadius - signup.cardRadius) <= 1,
      `${viewport.label}: card radius login=${login.cardRadius} signup=${signup.cardRadius}`
    ),
  });

  allErrors.push(...errors);
  await browser.close();
}

{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  collectPageErrors(page, errors);
  await fixCssMime(page);
  await page.goto(`${base}/login.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });

  const interaction = await page.evaluate(async () => {
    const toggle = document.querySelector("[data-login-password-toggle]");
    const input = document.querySelector("[data-login-password]");
    if (!toggle || !input) return { toggleOk: false, orderOk: false };
    toggle.click();
    const toggleOk = input.type === "text";
    const formArea = document.querySelector(".signup-form-area");
    const left = document.querySelector(".signup-left");
    const formTop = formArea?.getBoundingClientRect().top ?? 0;
    const leftTop = left?.getBoundingClientRect().top ?? 0;
    return {
      toggleOk,
      orderOk: leftTop <= formTop,
      sections: [...document.querySelectorAll(".signup-left__title, .signup-card__title")].map((el) => el.textContent.trim()),
    };
  });

  cases.push({
    id: "password-toggle",
    ...assert(interaction.toggleOk, "password toggle works"),
  });
  cases.push({
    id: "mobile-order-signup-match",
    ...assert(interaction.orderOk, "390: left column before form (signup order)"),
  });

  await page.click("[data-login-social='google']");
  await page.waitForTimeout(400);
  const toastVisible = await page.locator("[data-login-toast]:not([hidden])").isVisible();
  cases.push({
    id: "google-social-toast",
    ...assert(toastVisible, "Google login shows toast"),
  });

  allErrors.push(...errors);
  await browser.close();
}

const passCount = cases.filter((c) => c.ok).length;
const failCount = cases.length - passCount;

await writeFile(
  path.join(OUT_DIR, "review-report.json"),
  JSON.stringify(
    { title: REVIEW_TITLE, folder: FOLDER_ID, pass: passCount, fail: failCount, consoleErrors: allErrors.length, cases, errors: allErrors },
    null,
    2
  )
);
await writeFile(
  path.join(OUT_DIR, "review-report.md"),
  [
    `# ${REVIEW_TITLE}`,
    "",
    `- PASS: ${passCount}/${cases.length}`,
    `- Console errors: ${allErrors.length}`,
    "",
    "## Cases",
    ...cases.map((c) => `- [${c.ok ? "x" : " "}] ${c.id}: ${c.message}`),
  ].join("\n")
);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: REVIEW_TITLE,
  cases,
  targetPage: "login.html",
  viewports: ["390", "1280"],
  overall: failCount > 0 || allErrors.length > 0 ? "FAIL" : "PASS",
  screenshotCatalog: [
    { file: "login-1280.png", label: "ログイン PC 1280px", url: "login.html", viewport: "1280" },
    { file: "login-390.png", label: "ログイン SP 390px", url: "login.html", viewport: "390" },
    { file: "signup-1280.png", label: "会員登録 PC 1280px", url: "signup.html", viewport: "1280" },
    { file: "signup-390.png", label: "会員登録 SP 390px", url: "signup.html", viewport: "390" },
  ],
});

console.log(`\n${REVIEW_TITLE}`);
console.log(`PASS ${passCount}/${cases.length}, console errors: ${allErrors.length}`);
cases.filter((c) => !c.ok).forEach((c) => console.log(`  FAIL ${c.id}: ${c.message}`));
if (allErrors.length) allErrors.forEach((e) => console.log(`  ERR ${e}`));

process.exit(failCount > 0 || allErrors.length > 0 ? 1 : 0);
