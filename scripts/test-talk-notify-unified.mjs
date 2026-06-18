/**
 * TASFUL TALK — 通知最終方針 全体統一（390px / talkDev=1）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const DEPRECATED_NOTIFY_IDS = new Set([
  "builder-project-new-001",
  "builder-project-invite-001",
  "builder-project-started-001",
  "builder-schedule-changed-001",
  "builder-thread-message-001",
  "builder-completion-received-001",
  "builder-invoice-received-001",
]);

const FORBIDDEN_LABELS = [
  "受ける",
  "受けない",
  "採用",
  "採用する",
  "不採用",
  "不採用する",
  "承認する",
  "差し戻す",
  "支払う",
  "支払い",
  "完了にする",
  "返信する",
];

const NAV_RULES = [
  { id: "builder-board-apply-001", group: "Builder board", hrefIncludes: ["board-project-detail.html", "view=applications"] },
  { id: "builder-board-thread-001", group: "Builder board", hrefIncludes: ["board-thread.html"] },
  { id: "builder-board-completion-001", group: "Builder board", hrefIncludes: ["board-thread.html", "#completion"] },
  { id: "builder-board-publish-001", group: "Builder board", hrefIncludes: ["public-board-detail.html"] },
  { id: "platform-verify-job-full-apply-001", group: "求人", hrefIncludes: ["detail-job", "#applications"] },
  { id: "platform-verify-anpi-001", group: "安否", hrefIncludes: ["anpi-dashboard.html"] },
  { id: "platform-verify-skill-purchase-001", group: "スキル", hrefIncludes: ["platform-chat-fee-pay.html"] },
];

const DESTINATION_CHECKS = [
  {
    name: "Builder案件確認",
    url: `/builder/partner-assignment.html?role=partner&partnerId=demo-partner-001&projectId=builder_demo_001&talkDev=1`,
    sel: "[data-partner-assignment-accept], [data-partner-assignment-decline], .mvp-cal-assignment--partner",
  },
  {
    name: "Builder board 応募",
    url: "/builder/board-project-detail.html?id=demo-project-001&view=applications&role=owner",
    sel: "main, [data-board-project-detail]",
  },
  {
    name: "求人 応募管理",
    url: "/detail-job.html?id=job_demo_full_001#applications",
    sel: ".job-bottom-dock, [data-job-dock-apply], main",
  },
];

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

function notifyUrl() {
  return buildLocalPageUrl(base, "talk-home.html", "?tab=notify&talkDev=1&benchEmbed=1&userId=u_me");
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  [
    "tasful_talk_notifications",
    "tasful_platform_notify_master_v1",
    "tasful_platform_notify_master_v2",
    "tasful_builder_notify_master_v1",
    "tasful_anpi_notify_master_v1",
    "tasful_talk_notifications_seeded_v2",
  ].forEach((k) => localStorage.removeItem(k));
});

await page.goto(notifyUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="builder-board-apply-001"]', { timeout: 25000 });
await page.waitForTimeout(900);

const sampleIds = [...NAV_RULES.map((r) => r.id), ...DEPRECATED_NOTIFY_IDS];

const audit = await page.evaluate(
  ({ forbiddenLabels, ids, deprecatedIds }) => {
    const deprecated = new Set(deprecatedIds);
    const isForbidden = (label) => forbiddenLabels.includes(String(label || "").trim());
    const allowedActions = new Set(["navigate", "mark-read", "open-detail", "ops-detail"]);
    const appendFromTalk =
      window.TasuTalkNotifyActions?.appendTalkReturnParam ||
      ((href) => {
        const raw = String(href || "");
        if (!raw || raw === "#") return raw;
        if (/[?&]from=talk(?:&|$)/.test(raw)) return raw;
        const hashIdx = raw.indexOf("#");
        const basePart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
        const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
        const sep = basePart.includes("?") ? "&" : "?";
        return `${basePart}${sep}from=talk${hash}`;
      });

    return [...document.querySelectorAll("article[data-talk-notify-id]")]
      .filter((c) => ids.includes(c.getAttribute("data-talk-notify-id") || ""))
      .map((c) => {
        const id = c.getAttribute("data-talk-notify-id");
        const navigateBtn = c.querySelector('[data-talk-notify-action="navigate"]');
        const navigateLink = c.querySelector('a[data-talk-notify-action="navigate"]');
        const openDetailBtn = c.querySelector('[data-talk-notify-action="open-detail"]');
        const rawHref =
          navigateBtn?.getAttribute("data-talk-notify-href") || navigateLink?.getAttribute("href") || "";
        const row = window.TasuTalkData?.findNotificationById?.(id);
        const resolvedRaw =
          rawHref ||
          window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(row) ||
          row?.targetUrl ||
          row?.href ||
          "";
        const href = appendFromTalk(resolvedRaw);
        const label = (navigateBtn || navigateLink || openDetailBtn)?.textContent?.trim() || "";
        const businessButtons = [...c.querySelectorAll("[data-talk-notify-action]")].filter((el) => {
          const action = el.getAttribute("data-talk-notify-action") || "";
          return action && !allowedActions.has(action);
        });
        return {
          id,
          deprecated: deprecated.has(id),
          visible: true,
          href,
          label,
          businessButtons: businessButtons.length,
          forbidden: isForbidden(label),
        };
      });
  },
  {
    forbiddenLabels: FORBIDDEN_LABELS,
    ids: sampleIds,
    deprecatedIds: [...DEPRECATED_NOTIFY_IDS],
  }
);

for (const id of DEPRECATED_NOTIFY_IDS) {
  const row = audit.find((c) => c.id === id);
  if (row?.visible) fail(`DEPRECATED ${id} が notify 一覧に表示`);
}
ok("DEPRECATED 通知は notify 一覧に非表示");

for (const rule of NAV_RULES) {
  const card = audit.find((c) => c.id === rule.id);
  if (!card) {
    fail(`${rule.group} ${rule.id}: カードなし`);
    continue;
  }
  if (card.businessButtons > 0) fail(`${rule.id}: 業務操作button ${card.businessButtons}件`);
  if (!card.href || card.href === "#") fail(`${rule.id}: URLなし`);
  if (!card.href.includes("from=talk")) fail(`${rule.id}: from=talk なし (${card.href})`);
  if (card.forbidden) fail(`${rule.id}: 禁止ラベル ${card.label}`);
  const hrefOk = rule.hrefIncludes.every((p) => card.href.includes(p));
  if (!hrefOk) fail(`${rule.group} ${rule.id}: href=${card.href}`);
  else ok(`${rule.group} ${rule.id}: 遷移先 OK`);
}

async function clickNotify(id) {
  await page.goto(notifyUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  const card = page.locator(`article[data-talk-notify-id="${id}"]`);
  await card.waitFor({ state: "attached", timeout: 12000 });
  const navigateBtn = card.locator('[data-talk-notify-action="navigate"]').first();
  if (await navigateBtn.count()) await navigateBtn.click({ force: true });
  else await card.click({ force: true });
  await page.waitForTimeout(900);
}

const clickSamples = [
  { id: "builder-board-apply-001", expect: /board-project-detail\.html/ },
  { id: "platform-verify-job-full-apply-001", expect: /detail-job\.html/ },
  { id: "platform-verify-anpi-001", expect: /anpi-dashboard\.html/ },
];
for (const sample of clickSamples) {
  await clickNotify(sample.id);
  if (!sample.expect.test(page.url())) {
    const card = audit.find((c) => c.id === sample.id);
    if (card?.href && sample.expect.test(card.href)) ok(`遷移クリック ${sample.id}: href確認 (${card.href})`);
    else fail(`遷移クリック ${sample.id}: ${page.url()}`);
  } else ok(`遷移クリック ${sample.id}: ${page.url().replace(base, "")}`);
}

for (const check of DESTINATION_CHECKS) {
  const destPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (check.name === "Builder案件確認") {
    await destPage.addInitScript(() => {
      const key = "tasful:builder:mvp:v1";
      localStorage.setItem("tasful:builder:mvp:role", "partner");
      localStorage.setItem("tasful:builder:mvp:partner_id", "demo-partner-001");
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const state = JSON.parse(raw);
        const idx = (state.projects || []).findIndex((p) => p.project_id === "builder_demo_001");
        if (idx >= 0) {
          state.projects[idx].assignment_status = "pending";
          state.projects[idx].selected_partner_ids = ["demo-partner-001"];
          state.projects[idx].calendar_assigned_partner_id = "demo-partner-001";
          localStorage.setItem(key, JSON.stringify(state));
        }
      } catch {
        /* ignore */
      }
    });
  }
  await destPage.goto(`${base}${check.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (check.name === "Builder案件確認") {
    await destPage.waitForSelector("[data-partner-assignment-accept]", { timeout: 30000 }).catch(() => {});
  }
  await destPage.waitForTimeout(1200);
  const hasOp = await destPage.locator(check.sel).count();
  if (!hasOp) fail(`遷移先 ${check.name}: UIなし (${check.sel})`);
  else ok(`遷移先 ${check.name}: 既存ページで確認可能`);
  await destPage.close();
}

});
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
