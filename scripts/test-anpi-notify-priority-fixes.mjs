#!/usr/bin/env node
/**
 * 安否通知 優先不整合修正の検証
 *   node scripts/test-anpi-notify-priority-fixes.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTS = [5173, 8765, 5176, 5199];
const outDir = join(root, "screenshots/anpi-notify-priority-fixes");
mkdirSync(outDir, { recursive: true });

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/anpi-notifications.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const BASE = (process.env.BASE_URL || (await findBaseUrl())).replace(/\/$/, "");
let fails = 0;
function ok(name, cond, detail = "") {
  if (!cond) {
    console.log("FAIL:", name, detail);
    fails++;
  } else {
    console.log("OK:", name, detail ? `(${detail})` : "");
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1–2. TALK動的安否: targetUrl 優先
await page.goto(`${BASE}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.TasuTalkNotifyActions?.resolveNotificationOpenHref), {
  timeout: 15000,
});

const hrefChecks = await page.evaluate(() => {
  const resolve = window.TasuTalkNotifyActions.resolveNotificationOpenHref;
  const dynamic = {
    id: "anpi-dynamic-test-001",
    type: "anpi",
    source: "anpi",
    targetUrl: "anpi-notifications.html",
    title: "動的安否テスト",
  };
  const withHash = {
    id: "talk-n-006",
    type: "anpi",
    source: "anpi-dashboard",
    href: "anpi-dashboard.html#check",
    targetUrl: "anpi-dashboard.html#check",
  };
  const setting = {
    id: "anpi-setting-updated-001",
    type: "anpi",
    source: "anpi_master_v1",
    subType: "setting",
    href: "anpi-register.html",
    targetUrl: "anpi-register.html",
  };
  return {
    dynamic: resolve(dynamic),
    withHash: resolve(withHash),
    setting: resolve(setting),
  };
});

ok("talk dynamic uses targetUrl", hrefChecks.dynamic.includes("anpi-notifications.html"), hrefChecks.dynamic);
ok("talk dynamic not dashboard fixed", !hrefChecks.dynamic.endsWith("anpi-dashboard.html"), hrefChecks.dynamic);
ok("talk legacy href keeps hash", hrefChecks.withHash.includes("#check"), hrefChecks.withHash);
ok("setting master goes register", hrefChecks.setting.includes("anpi-register.html"), hrefChecks.setting);

await page.evaluate(() => {
  const store = window.TasuTalkNotifications || window.TasuTalkData;
  const row = {
    id: "anpi-dynamic-nav-test",
    type: "anpi",
    source: "anpi",
    category: "安否",
    title: "動的安否ナビテスト",
    body: "targetUrl検証用",
    targetUrl: "anpi-notifications.html",
    actionLabel: "開く",
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  if (store?.add) store.add(row);
  else if (window.TasuTalkData?.addNotification) window.TasuTalkData.addNotification(row);
});

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-talk-notify-id="anpi-dynamic-nav-test"]', { timeout: 15000 });
const dynamicLinkHref = await page.locator('[data-talk-notify-id="anpi-dynamic-nav-test"] [data-talk-notify-action]').first().getAttribute("href");
ok("talk card href has notifications", (dynamicLinkHref || "").includes("anpi-notifications.html"), dynamicLinkHref || "");
await page.screenshot({ path: join(outDir, "01-talk-dynamic-anpi-target.png"), fullPage: false });

// 3. 安否通知センター: 緊急キーワード → #check 導線
await page.goto(`${BASE}/anpi-notifications.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.TasuAnpiNotificationsPage), { timeout: 10000 });
await page.evaluate(() => {
  const logs = [
    {
      id: "anpi_fix_urgent",
      event_type: "urgent_keyword_detected",
      user_name: "山田太郎",
      contract_holder_name: "山田花子",
      contract_holder_relation: "娘",
      title: "【TASFUL安否通知】緊急キーワード",
      message: "息苦しいとの相談がありました。",
      status: "local_only",
      is_read: false,
      priority: "urgent",
      created_at: new Date().toISOString(),
    },
    {
      id: "anpi_fix_unlink",
      event_type: "line_oauth_unlinked",
      user_name: "山田太郎",
      contract_holder_name: "山田花子",
      contract_holder_relation: "娘",
      title: "TASFUL TALK連携を解除しました",
      message: "TASFUL TALK通知の連携が解除されました。",
      status: "local_only",
      is_read: false,
      priority: "normal",
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  ];
  localStorage.setItem("tasu_anpi_notification_logs_v1", JSON.stringify(logs));
  window.TasuAnpiNotificationsPage?.renderList?.();
});
const urgentCard = page.locator('[data-anpi-notification-list] [data-log-id="anpi_fix_urgent"]').first();
await urgentCard.locator("[data-anpi-toggle]").click();
const urgentActionHref = await urgentCard.locator(".anpi-notification-action__btn").getAttribute("href");
ok("urgent action link", urgentActionHref === "anpi-dashboard.html#check", urgentActionHref || "");
const unlinkCard = page.locator('[data-anpi-notification-list] [data-log-id="anpi_fix_unlink"]').first();
await unlinkCard.locator("[data-anpi-toggle]").click();
const unlinkHref = await unlinkCard.locator(".anpi-notification-action__btn").getAttribute("href");
ok("unlink action link", unlinkHref === "anpi-register.html", unlinkHref || "");
await urgentCard.screenshot({ path: join(outDir, "02-notifications-urgent-action.png") });

// 4. LINE表記なし / TASFUL TALK表記
const notifText = await page.locator("[data-anpi-notifications-root]").innerText();
ok("notifications no standalone LINE label", !/\bLINE\b/.test(notifText), "");
ok("notifications has TASFUL TALK", /TASFUL TALK/.test(notifText), "");

await page.goto(`${BASE}/anpi-register.html`, { waitUntil: "domcontentloaded" });
const registerText = await page.locator("main").innerText();
ok("register no standalone LINE label", !/\bLINE\b/.test(registerText), "");
ok("register has TASFUL TALK", /TASFUL TALK/.test(registerText), "");
await page.screenshot({ path: join(outDir, "03-register-tasful-talk-labels.png"), fullPage: false });

// 5. 登録完了後リンク（DOM存在）
const successLinks = await page.evaluate(() => {
  const section = document.querySelector("[data-anpi-register-success]");
  if (!section) return { hidden: true, links: [] };
  return {
    hidden: section.hidden,
    links: [...section.querySelectorAll("a.anpi-register-success__link")].map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute("href"),
    })),
  };
});
ok("register success section exists", successLinks.hidden === true && successLinks.links.length === 3, JSON.stringify(successLinks.links));
const hrefs = successLinks.links.map((l) => l.href);
ok("success link notifications", hrefs.includes("anpi-notifications.html"));
ok("success link ai workspace", hrefs.includes("ai-workspace.html"));
ok("success link dashboard", hrefs.includes("dashboard.html"));

await browser.close();
console.log(fails ? `FAILED ${fails}` : "ALL PASSED");
process.exit(fails ? 1 : 0);
