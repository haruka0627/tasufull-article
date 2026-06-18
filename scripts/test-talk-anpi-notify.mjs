/**
 * TASFUL TALK — 安否通知マスター v1.0 Playwright 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

const EXPECTED = [
  { id: "anpi-check-request-001", label: "安否確認する", href: "anpi-dashboard.html#check" },
  { id: "anpi-family-response-001", label: "確認する", href: "anpi-dashboard.html#family" },
  { id: "anpi-no-response-001", label: "確認する", href: "anpi-dashboard.html#no-response" },
  { id: "anpi-disaster-info-001", label: "確認する", href: "anpi-dashboard.html#disaster" },
  { id: "anpi-drill-001", label: "内容を見る", href: "anpi-dashboard.html#drill" },
  { id: "anpi-setting-updated-001", label: "設定を見る", href: "anpi-dashboard.html#settings" },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}/talk-home.html?tab=notify`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function hrefMatches(actual, expected) {
  const a = String(actual || "");
  const e = String(expected || "");
  return a.includes(e.replace(/^https?:\/\/[^/]+/, ""));
}

const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  localStorage.removeItem("tasful_talk_notifications");
  localStorage.removeItem("tasful_platform_notify_master_v1");
  localStorage.removeItem("tasful_builder_notify_master_v1");
  localStorage.removeItem("tasful_anpi_notify_master_v1");
  localStorage.removeItem("tasful_talk_notifications_seeded_v2");
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="anpi-check-request-001"]', { timeout: 15000 });

const audit = await page.evaluate(() => {
  const anpiCards = [...document.querySelectorAll('article[data-talk-notify-id^="anpi-"]')];
  const platformCards = [...document.querySelectorAll('article[data-talk-notify-id^="platform-"]')];
  const builderCards = [...document.querySelectorAll('article[data-talk-notify-id^="builder-"]')];
  const master = window.TasuTalkData?.ANPI_NOTIFICATION_MASTER_V1 || [];
  const tab = document.querySelector("[data-tasu-app-tabbar]");
  return {
    anpiCount: anpiCards.length,
    platformCount: platformCards.length,
    builderCount: builderCards.length,
    masterCount: master.length,
    subTypes: [...new Set(master.map((n) => n.subType))],
    hasLegacyAnpi: Boolean(document.querySelector('[data-talk-notify-id="talk-n-006"]')),
    chip: anpiCards[0]?.querySelector(".talk-notify-card__category-chip")?.textContent?.trim(),
    tabVisible: Boolean(tab),
    sample: master[0],
  };
});

console.log("Audit:", JSON.stringify(audit, null, 2));

let failed = false;
for (const spec of EXPECTED) {
  const href = await page
    .locator(`article[data-talk-notify-id="${spec.id}"] [data-talk-notify-action]`)
    .getAttribute("href");
  const ok = hrefMatches(href, spec.href);
  console.log(ok ? "OK" : "NG", spec.label, "→", href);
  if (!ok) failed = true;
}

if (audit.anpiCount < 6) failed = true;
if (audit.platformCount < 19) failed = true;
if (audit.builderCount < 22) failed = true;
if (audit.masterCount !== 6) failed = true;
if (audit.chip !== "安否") failed = true;
if (!audit.tabVisible) failed = true;
if (!audit.hasLegacyAnpi) failed = true;

const HASH_DESTINATIONS = [
  { hash: "check", id: "check" },
  { hash: "family", id: "family" },
  { hash: "no-response", id: "no-response" },
  { hash: "disaster", id: "disaster" },
  { hash: "drill", id: "drill" },
  { hash: "settings", id: "settings" },
];

for (const dest of HASH_DESTINATIONS) {
  const destPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await destPage.goto(`${base}/anpi-dashboard.html#${dest.hash}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await destPage.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 15000 });
  await destPage.waitForTimeout(1800);

  const focus = await destPage.evaluate((id) => {
    const target = document.getElementById(id);
    const rect = target?.getBoundingClientRect();
    const header =
      document.querySelector("[data-tasu-mobile-shell-head]") ||
      document.querySelector(".anpi-dash-header") ||
      document.querySelector(".dash-header");
    const headerBottom = header && window.getComputedStyle(header).display !== "none"
      ? header.getBoundingClientRect().bottom
      : 0;
    const topGap = rect ? rect.top - headerBottom : 9999;
    return {
      bodyFocus: document.body.classList.contains("anpi-dashboard-page--notify-focus"),
      targetActive: target?.classList.contains("anpi-notify-anchor--active") === true,
      dimmedHidden:
        [...document.querySelectorAll("[data-anpi-notify-anchor]")].filter(
          (el) => window.getComputedStyle(el).display !== "none"
        ).length === 1,
      bannerRemoved: !document.querySelector("[data-anpi-notify-focus-banner]"),
      headingRemoved: !document.querySelector("[data-anpi-notify-focus-heading]"),
      quickMenuHidden:
        window.getComputedStyle(document.querySelector(".anpi-quick-section")).display === "none",
      topBelowHeader: id === "check" ? topGap >= 12 && topGap <= 48 : topGap < 400,
      highlighted: target?.classList.contains("anpi-notify-anchor--highlight") === true,
    };
  }, dest.id);

  const ok =
    focus.bodyFocus &&
    focus.targetActive &&
    focus.dimmedHidden &&
    focus.bannerRemoved &&
    focus.headingRemoved &&
    focus.quickMenuHidden &&
    focus.topBelowHeader;
  console.log(ok ? "OK" : "NG", `#${dest.hash}`, JSON.stringify(focus));
  if (!ok) failed = true;
  await destPage.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
