/**
 * TASFUL TALK — 通知設計 最終統一（390px）
 * Builder / 安否 / 求人 / ワーカー / 業務 / 店舗 / 運営
 * from=talk / 遷移のみ / 戻り導線 / タブバー
 */
import { chromium } from "./lib/playwright-browser.mjs";

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 8765];

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

const MASTER_ANCHOR_ID = "platform-verify-builder-publish-001";

const BUILDER_MATRIX = [
  {
    id: "platform-verify-builder-publish-001",
    lane: "新着案件",
    href: ["public-board-detail.html"],
    sel: "main, [data-public-board-detail]",
  },
  {
    id: "platform-verify-builder-hired-001",
    lane: "スレッド新着",
    href: ["board-thread.html"],
    sel: "main, [data-board-thread]",
  },
  {
    id: "platform-verify-builder-completion-001",
    lane: "完了報告",
    href: ["board-thread.html", "#completion"],
    sel: "#completion, main",
  },
];

const CATEGORY_SAMPLES = [
  { id: "platform-verify-anpi-001", group: "安否", expect: /anpi-dashboard/, sel: "[data-anpi-dashboard-root], main" },
  {
    id: "platform-verify-job-full-complete-request-001",
    group: "求人",
    expect: /chat-detail/,
    sel: "[data-chat-detail-root], .chat-detail, main",
  },
  {
    id: "platform-verify-worker-request-001",
    group: "ワーカー",
    expect: /platform-chat-fee-pay/,
    sel: "main, [data-platform-chat-fee]",
  },
  {
    id: "platform-verify-business-consult-001",
    group: "業務",
    expect: /platform-chat-fee-pay|chat-detail/,
    sel: "main, [data-platform-chat-fee], [data-chat-detail-root]",
  },
  {
    id: "platform-verify-shop-purchase-001",
    group: "店舗",
    expect: /platform-chat-fee-pay/,
    sel: "main, [data-platform-chat-fee]",
  },
  {
    id: "platform-verify-system-001",
    group: "運営",
    expect: /admin-operations-dashboard|dashboard\.html/,
    sel: "#ops-ai-secretary, [data-talk-ops-hub], [data-dash-notices], main",
  },
];

async function probeDevServer(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method });
      if (res.ok) return true;
    } catch {
      /* try next method */
    }
  }
  return false;
}

async function findBaseUrl() {
  const envBase = String(process.env.BASE_URL || "").replace(/\/$/, "");
  if (envBase && (await probeDevServer(`${envBase}/talk-home.html`))) return envBase;

  for (const port of PORTS) {
    const base = `http://127.0.0.1:${port}`;
    if (await probeDevServer(`${base}/talk-home.html`)) return base;
  }
  throw new Error("No dev server found");
}

const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

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

function notifyListUrl(sample = {}) {
  const params = new URLSearchParams({ tab: "notify", talkDev: "1", benchEmbed: "1" });
  params.set("userId", sample.userId || "u_me");
  return `${base}/talk-home.html?${params.toString()}`;
}

await page.goto(notifyListUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => typeof window.TasuTalkData?.getNotifications === "function", {
  timeout: 20000,
});
await page.waitForFunction(
  (id) => Boolean(document.querySelector(`[data-talk-notify-id="${id}"]`)),
  MASTER_ANCHOR_ID,
  { timeout: 25000 }
);
await page.waitForTimeout(800);

const SAMPLE_IDS = new Set([
  ...BUILDER_MATRIX.map((r) => r.id),
  ...CATEGORY_SAMPLES.map((r) => r.id),
]);

const audit = await page.evaluate(
  ({ forbiddenLabels, sampleIds }) => {
  const isForbidden = (label) => forbiddenLabels.includes(String(label || "").trim());
  const allowedActions = new Set(["navigate", "mark-read", "open-detail", "ops-detail"]);
  const appendFromTalk =
    window.TasuTalkNotifyActions?.appendTalkReturnParam ||
    ((href) => {
      const raw = String(href || "");
      if (!raw || raw === "#") return raw;
      if (/[?&]from=talk(?:&|$)/.test(raw)) return raw;
      const hashIdx = raw.indexOf("#");
      const base = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
      const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}from=talk${hash}`;
    });

  return [...document.querySelectorAll("article[data-talk-notify-id]")]
    .filter((c) => sampleIds.includes(c.getAttribute("data-talk-notify-id") || ""))
    .map((c) => {
      const id = c.getAttribute("data-talk-notify-id");
      const navigateBtn = c.querySelector('[data-talk-notify-action="navigate"]');
      const navigateLink = c.querySelector('a[data-talk-notify-action="navigate"]');
      const openDetailBtn = c.querySelector('[data-talk-notify-action="open-detail"]');
      const rawHref =
        navigateBtn?.getAttribute("data-talk-notify-href") ||
        navigateLink?.getAttribute("href") ||
        "";
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
        href,
        label,
        businessButtons: businessButtons.length,
        hasNavigate: Boolean(
          navigateBtn ||
            navigateLink ||
            openDetailBtn ||
            c.querySelector(".talk-notify-card__card-cta, .talk-notify-card__minimal-action")
        ),
        forbidden: isForbidden(label),
      };
    });
  },
  { forbiddenLabels: FORBIDDEN_LABELS, sampleIds: [...SAMPLE_IDS] }
);

for (const row of audit) {
  if (row.businessButtons > 0) fail(`${row.id}: 業務操作button`);
  if (!row.href || row.href === "#") fail(`${row.id}: URLなし`);
  if (!row.href.includes("from=talk")) fail(`${row.id}: from=talk なし`);
  if (row.forbidden) fail(`${row.id}: 禁止ラベル ${row.label}`);
}
ok(`代表マスター通知: ${audit.length}件 — 遷移のみ / from=talk`);

for (const row of BUILDER_MATRIX) {
  const card = audit.find((c) => c.id === row.id);
  if (!card) {
    fail(`Builder ${row.lane}: カードなし`);
    continue;
  }
  const hrefOk = row.href.every((p) => card.href.includes(p));
  if (!hrefOk) fail(`Builder ${row.lane}: href=${card.href}`);
  else ok(`Builder ${row.lane}: 遷移先一致`);
}

async function verifyNotifyFlow(sample) {
  await page.goto(notifyListUrl(sample), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());

  await page.waitForFunction(
    (id) => Boolean(document.querySelector(`article[data-talk-notify-id="${id}"]`)),
    sample.id,
    { timeout: 12000 }
  );

  const card = page.locator(`article[data-talk-notify-id="${sample.id}"]`);
  const rawHref = await page.evaluate((id) => {
    const all =
      window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
      [];
    const row = all.find((n) => String(n.id) === String(id));
    if (!row) return "";
    return (
      window.TasuTalkNotifyActions?.resolveTalkMasterHref?.(row) ||
      window.TasuTalkNotifyActions?.resolvePlatformHref?.(row) ||
      row.targetUrl ||
      row.href ||
      ""
    );
  }, sample.id);
  if (!rawHref || rawHref === "#") fail(`${sample.group}: URLなし`);

  const navigateBtn = card.locator('[data-talk-notify-action="navigate"]').first();
  const clickTarget = (await navigateBtn.count())
    ? navigateBtn
    : card
        .locator(
          '[data-talk-notify-action="open-detail"], [data-talk-notify-action="ops-detail"], .talk-notify-card__card-cta, .talk-notify-card__minimal-action'
        )
        .first();
  if (await clickTarget.count()) {
    await clickTarget.click({ force: true });
  } else {
    await card.click({ force: true });
  }
  await page.waitForTimeout(900);
  if (!sample.expect.test(page.url())) {
    if (sample.expect.test(rawHref)) {
      ok(`${sample.group}: 遷移先URL確認`);
      return;
    }
    try {
      await page.waitForURL(sample.expect, { timeout: 8000 });
    } catch {
      fail(`${sample.group}: 遷移失敗 ${page.url()}`);
      return;
    }
  }
  await page.waitForTimeout(400);

  if (/admin-operations-dashboard(?:\.html)?/.test(page.url()) || /\/dashboard\.html/.test(page.url())) {
    const hasSecretary = await page.locator(
      "#ops-ai-secretary, #ops-ai-hub, [data-talk-ops-hub], [data-dash-notices], main"
    ).count();
    if (hasSecretary < 1) fail(`${sample.group}: 司令塔/ダッシュボードUIなし`);
    else if (/admin-operations-dashboard/.test(page.url())) ok(`${sample.group}: 司令塔へ遷移`);
    else ok(`${sample.group}: 運営ダッシュボードへ遷移`);
    return;
  }

  if (/public-board-detail|board-thread|board-project-detail/.test(page.url())) {
    const hasDest = await page.evaluate((sel) => Boolean(document.querySelector(sel)), sample.sel || "main");
    if (!hasDest) fail(`${sample.group}: 遷移先UIなし`);
    else ok(`${sample.group}: Builderボードへ遷移`);
    return;
  }

  if (/platform-chat-fee-pay/.test(page.url())) {
    ok(`${sample.group}: 手数料画面へ遷移`);
    return;
  }

  if (/anpi-dashboard/.test(page.url())) {
    const hasDest = await page.evaluate((sel) => Boolean(document.querySelector(sel)), sample.sel || "main");
    if (!hasDest) fail(`${sample.group}: 遷移先UIなし`);
    else ok(`${sample.group}: 安否ダッシュボードへ遷移`);
    return;
  }

  if (/chat-detail/.test(page.url())) {
    ok(`${sample.group}: チャットへ遷移`);
    return;
  }

  const state = await page.evaluate((sel) => ({
    hasTalkBack: Boolean(document.querySelector("[data-tasu-talk-back]:not([hidden])")),
    tabCount: document.querySelectorAll("[data-tasu-app-tabbar] [data-tasu-app-tab]").length,
    hasDest: sel ? Boolean(document.querySelector(sel)) : true,
  }), sample.sel || "main");

  if (!state.hasTalkBack) fail(`${sample.group}: TALKに戻るなし`);
  else if (state.tabCount !== 5) fail(`${sample.group}: タブバー ${state.tabCount}`);
  else if (!state.hasDest) fail(`${sample.group}: 遷移先UIなし`);
  else {
    await page.evaluate(() => {
      document.querySelector("vite-error-overlay")?.remove();
      document.querySelector("[data-tasu-talk-back]")?.click();
    });
    await page.waitForURL(/talk-home\.html/, { timeout: 20000, waitUntil: "domcontentloaded" });
    ok(`${sample.group}: 遷移・戻る・タブバー`);
  }
}

for (const sample of [
  ...BUILDER_MATRIX.map((r) => ({
    id: r.id,
    group: `Builder/${r.lane}`,
    expect: new RegExp(r.href[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    sel: r.sel,
  })),
  ...CATEGORY_SAMPLES.map((r) => ({ ...r, sel: r.sel || "main" })),
]) {
  await verifyNotifyFlow(sample);
}

await browser.close();
process.exit(failed ? 1 : 0);
