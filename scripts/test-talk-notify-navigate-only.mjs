/**
 * TASFUL TALK — 通知は遷移のみ（390px）
 * 通知タブ・公式トークに業務操作ボタンがないことを検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];
const FORBIDDEN_RE = /受ける|受けない|承認する|差し戻す|支払う|完了にする/;

const NAV_EXPECT = [
  {
    id: "builder-board-apply-001",
    label: "応募者を見る",
    hrefIncludes: ["board-project-detail.html", "view=applications"],
  },
  {
    id: "builder-board-thread-001",
    label: "やり取りを見る",
    hrefIncludes: ["board-thread.html"],
  },
  {
    id: "builder-board-completion-001",
    label: "完了を確認",
    hrefIncludes: ["deal-detail.html", "#completion"],
  },
  {
    id: "builder-board-payment-001",
    label: "支払いを確認",
    hrefIncludes: ["deal-detail.html", "#invoice"],
  },
  {
    id: "anpi-check-request-001",
    label: "安否を確認",
    hrefIncludes: ["anpi-dashboard.html", "#check"],
  },
  {
    id: "anpi-setting-updated-001",
    label: "設定を編集する",
    hrefIncludes: ["anpi-register.html"],
  },
  {
    id: "platform-job-apply-001",
    label: "応募を見る",
    hrefIncludes: ["detail-job"],
  },
];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/talk-home.html?tab=notify`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
    "tasful_chat_messages",
    "tasful_official_room_last_seen_v1",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(`${base}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(900);

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

const notifyAudit = await page.evaluate((forbiddenReSource) => {
  const forbiddenRe = new RegExp(forbiddenReSource);
  const cards = [...document.querySelectorAll("article[data-talk-notify-id]")];
  return cards.map((card) => {
    const id = card.getAttribute("data-talk-notify-id");
    const title = card.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
    const body = card.querySelector(".talk-notify-card__text")?.textContent?.trim() || "";
    const actions = [...card.querySelectorAll("[data-talk-notify-action]")].map((a) => ({
      action: a.getAttribute("data-talk-notify-action"),
      label: a.textContent?.trim() || "",
      href: a.getAttribute("href") || "",
    }));
    const forbidden = actions.some((a) => forbiddenRe.test(a.label));
    return { id, title, body, actions, forbidden };
  });
}, FORBIDDEN_RE.source);

for (const row of notifyAudit) {
  if (row.forbidden) fail(`${row.id}: 禁止操作ボタン ${JSON.stringify(row.actions)}`);
}

for (const expect of NAV_EXPECT) {
  const row = notifyAudit.find((r) => r.id === expect.id);
  if (!row) {
    fail(`${expect.id}: カードなし`);
    continue;
  }
  const nav = row.actions.find((a) => a.action === "navigate");
  if (!nav) {
    fail(`${expect.id}: navigate ボタンなし`);
    continue;
  }
  if (nav.label !== expect.label) fail(`${expect.id}: label=${nav.label} expected=${expect.label}`);
  else ok(`${expect.id}: label OK`);
  for (const part of expect.hrefIncludes) {
    if (!nav.href.includes(part)) fail(`${expect.id}: href missing ${part} (${nav.href})`);
  }
  if (expect.hrefIncludes.every((p) => nav.href.includes(p))) ok(`${expect.id}: href OK`);
}

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
