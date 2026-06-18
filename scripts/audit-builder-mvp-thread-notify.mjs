#!/usr/bin/env node
/**
 * Builder MVP スレッド / 通知 — 一覧・詳細・導線・リダイレクト監査
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
const page = await context.newPage();

const MVP_KEYS = ["tasful:builder:mvp:v1", "tasful:builder:mvp:notifications:v1"];

async function resetStorage() {
  await page.goto(`${BASE}/builder/mvp-threads.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), MVP_KEYS);
}

async function setRole(role) {
  await page.evaluate((r) => {
    sessionStorage.setItem("tasful:builder:mvp:session:role", r);
    localStorage.setItem("tasful:builder:mvp:role", r);
  }, role);
}

const THREAD_CASES = [
  {
    type: "ops_partner",
    role: "partner",
    listTitle: "運営とのやりとり",
    threadId: "demo-thread-001",
    cardText: "現場指示について",
    detailChecks: ["現場指示", "駐車場案内", "指示書_0618.pdf", "案件カレンダー", "完了報告"],
    hidePanels: [],
    showPanels: [".mvp-sitePhotosPanel", ".mvp-threadReportsPanel", ".mvp-thread-completionPanel"],
  },
  {
    type: "partner_user",
    role: "user",
    listTitle: "パートナーとのやりとり",
    threadId: "demo-thread-002",
    cardText: "世田谷区",
    detailChecks: ["概算見積", "日程", "相談"],
    hidePanels: [".mvp-sitePhotosPanel", ".mvp-thread-completionPanel"],
  },
  {
    type: "user_user",
    role: "user",
    listTitle: "一般ユーザーとのやりとり",
    threadId: "demo-thread-007",
    cardText: "外壁塗装",
    detailChecks: ["外壁塗装", "紹介"],
    hidePanels: [".mvp-sitePhotosPanel", ".mvp-thread-completionPanel"],
  },
  {
    type: "vendor_user",
    role: "vendor",
    listTitle: "一般ユーザーとのやりとり",
    threadId: "demo-thread-008",
    cardText: "港区",
    detailChecks: ["設備修理", "見積"],
    hidePanels: [".mvp-sitePhotosPanel", ".mvp-thread-completionPanel"],
  },
];

const ROLE_LIST_CASES = [
  { role: "partner", title: "やりとり", excludeIds: ["thread-demo-007", "thread-demo-008"] },
  { role: "user", title: "やりとり", excludeIds: ["thread-demo-001"] },
  { role: "vendor", title: "やりとり", excludeIds: ["thread-demo-001", "thread-demo-002", "thread-demo-007"] },
];

const NOTIF_CASES = [
  { id: "notif-demo-001", role: "partner", threadType: "ops_partner", threadId: "thread-demo-001" },
  { id: "notif-demo-008", role: "user", threadType: "partner_user", threadId: "thread-demo-002" },
  { id: "notif-demo-009", role: "user", threadType: "user_user", threadId: "thread-demo-007" },
  { id: "notif-demo-010", role: "user", threadType: "vendor_user", threadId: "thread-demo-008" },
];

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await resetStorage();

for (const c of THREAD_CASES) {
  await setRole(c.role);
  const listUrl = `${BASE}/builder/mvp-threads.html?threadType=${c.type}&role=${c.role}`;
  await page.goto(listUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const title = await page.locator("[data-builder-mvp-threads-title]").textContent();
  record(`${c.type} list title`, (title || "").includes(c.listTitle), title || "");

  const html = await page.content();
  record(`${c.type} list has card`, html.includes(c.cardText), c.cardText);

  const wrongRoleCard =
    c.role === "partner"
      ? html.includes("thread-demo-007") || html.includes("thread-demo-008")
      : c.role === "user" && html.includes("thread-demo-001");
  record(`${c.type} list role filter`, !wrongRoleCard, wrongRoleCard ? "wrong thread visible" : "");

  const unread = await page.locator(".mvp-thread-card__unread:not(.mvp-thread-card__unread--zero)").count();
  record(`${c.type} list unread badge`, unread > 0, `${unread} unread`);

  const detailUrl = `${BASE}/builder/mvp-thread.html?threadType=${c.type}&role=${c.role}&id=${c.threadId}`;
  await page.goto(detailUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const compose = await page.locator("[data-builder-mvp-thread-form]").count();
  record(`${c.type} detail compose`, compose > 0);

  const attach = await page.locator(".mvp-slack-msg__attach, .mvp-threadReports, .mvp-slack-msg attachment").count();
  const attachAlt = await page.locator("text=.pdf").count();
  record(`${c.type} detail attachments`, attach > 0 || attachAlt > 0);

  const contextCard = await page.locator("[data-builder-mvp-thread-context]:not([hidden])").count();
  record(`${c.type} detail context card`, contextCard > 0);

  for (const text of c.detailChecks || []) {
    const n = await page.locator(`text=${text}`).count();
    record(`${c.type} detail: ${text}`, n > 0);
  }

  for (const sel of c.hidePanels || []) {
    const hidden = await page.locator(sel).first().evaluate((el) => el.hidden).catch(() => true);
    record(`${c.type} hidden ${sel}`, hidden);
  }

  for (const sel of c.showPanels || []) {
    const hidden = await page.locator(sel).first().evaluate((el) => el.hidden).catch(() => true);
    record(`${c.type} visible ${sel}`, !hidden);
  }

  const url = new URL(page.url());
  record(`${c.type} detail URL threadType`, url.searchParams.get("threadType") === c.type);
  record(`${c.type} detail URL role`, url.searchParams.get("role") === c.role);
  const idParam = url.searchParams.get("id") || url.searchParams.get("thread_id") || "";
  record(
    `${c.type} detail URL id`,
    idParam === c.threadId || idParam === c.threadId.replace("demo-", "thread-demo-")
  );
}

await resetStorage();
for (const n of NOTIF_CASES) {
  await setRole(n.role);
  await page.goto(`${BASE}/builder/mvp-notifications.html?role=${n.role}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const link = page.locator(`[data-notification-id="${n.id}"]`);
  const href = await link.getAttribute("href");
  record(`notif ${n.id} href`, Boolean(href?.includes("mvp-thread.html")), href || "");
  if (!href) continue;
  await link.click();
  await page.waitForURL(/mvp-thread\.html/, { timeout: 10000 });
  const url = new URL(page.url());
  record(`notif ${n.id} threadType`, url.searchParams.get("threadType") === n.threadType, url.searchParams.get("threadType") || "");
  record(`notif ${n.id} role`, url.searchParams.get("role") === n.role, url.searchParams.get("role") || "");
  record(
    `notif ${n.id} thread id`,
    url.searchParams.get("thread_id") === n.threadId || url.searchParams.get("id") === n.threadId.replace("thread-", "demo-"),
    url.searchParams.get("thread_id") || url.searchParams.get("id") || ""
  );
  record(`notif ${n.id} not board-thread`, !page.url().includes("board-thread"));
  await resetStorage();
}

await setRole("partner");
await page.goto(`${BASE}/builder/threads.html?threadType=ops_partner&role=partner`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
record(
  "threads.html redirect",
  page.url().includes("mvp-threads.html") && !page.url().includes("/threads.html")
);
await page.goto(`${BASE}/builder/thread.html?threadType=ops_partner&role=partner&id=demo-thread-001`, {
  waitUntil: "networkidle",
});
record("thread.html redirect", page.url().includes("mvp-thread.html") && !page.url().includes("/thread.html?"));

await setRole("partner");
await page.goto(`${BASE}/builder/index.html`, { waitUntil: "networkidle" });
const partnerChatHref = await page.locator('a[href*="mvp-threads"]').first().getAttribute("href");
record("partner dashboard chat link", partnerChatHref?.includes("role=partner"), partnerChatHref || "");

await setRole("user");
await page.goto(`${BASE}/builder/user-dashboard.html`, { waitUntil: "networkidle" });
const userChatHref = await page.locator('a[href*="mvp-threads"]').first().getAttribute("href");
record("user dashboard chat link", userChatHref?.includes("role=user"), userChatHref || "");

await setRole("user");
await page.goto(`${BASE}/builder/board-projects.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const boardChatHref = await page.locator("[data-builder-board-threads-link]").getAttribute("href");
record("board-projects user chat → mvp", boardChatHref?.includes("mvp-threads.html"), boardChatHref || "");
record("board-projects not board-thread shortcut", !boardChatHref?.includes("board-thread"), boardChatHref || "");

await setRole("partner");
await page.goto(`${BASE}/builder/index.html?view=calendar`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const calThread = await page.locator(".builder-partner-cal__threadBtn").count();
record("calendar ops_partner link", calThread > 0);

for (const c of ROLE_LIST_CASES) {
  await setRole(c.role);
  const listUrl = `${BASE}/builder/mvp-threads.html?role=${c.role}`;
  await page.goto(listUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const title = await page.locator("[data-builder-mvp-threads-title]").textContent();
  record(`${c.role} all-list title`, (title || "").includes(c.title), title || "");
  const html = await page.content();
  const leaked = c.excludeIds.some((id) => html.includes(id));
  record(`${c.role} all-list role filter`, !leaked, leaked ? "wrong thread visible" : "");
}

const MOBILE_PAGES = [
  { name: "mvp-threads partner", url: "/builder/mvp-threads.html?role=partner", role: "partner" },
  { name: "mvp-threads user", url: "/builder/mvp-threads.html?role=user", role: "user" },
  { name: "mvp-threads vendor", url: "/builder/mvp-threads.html?role=vendor", role: "vendor" },
  { name: "mvp-thread ops_partner", url: "/builder/mvp-thread.html?threadType=ops_partner&role=partner&id=demo-thread-001", role: "partner" },
  { name: "mvp-thread partner_user", url: "/builder/mvp-thread.html?threadType=partner_user&role=user&id=demo-thread-002", role: "user" },
  { name: "mvp-notifications", url: "/builder/mvp-notifications.html?role=user", role: "user" },
  { name: "board-threads", url: "/builder/board-threads.html?role=user", role: "user" },
  { name: "board-thread", url: "/builder/board-thread.html?role=user&id=demo-thread-003", role: "user" },
];

await page.setViewportSize({ width: 390, height: 844 });
for (const p of MOBILE_PAGES) {
  await setRole(p.role);
  await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  record(`390px ${p.name} no overflow`, !overflow, overflow ? "horizontal scroll" : "");
  if (p.url.includes("mvp-thread.html") || p.url.includes("board-thread.html")) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const compose = await page.locator("[data-builder-mvp-thread-form]").boundingBox();
    const vp = page.viewportSize();
    record(
      `390px ${p.name} compose visible`,
      Boolean(compose && compose.height >= 36 && compose.y + compose.height <= vp.height + 8),
      compose ? `bottom=${compose.y + compose.height}` : "no compose"
    );
  }
}

await setRole("user");
await page.goto(`${BASE}/builder/board-threads.html?role=user`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const boardCardIds = await page
  .locator("[data-builder-board-thread-list] [data-thread-id]")
  .evaluateAll((els) => els.map((el) => el.getAttribute("data-thread-id") || ""));
const boardHrefs = await page
  .locator("[data-builder-board-thread-list] .mvp-thread-card[href]")
  .evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
record(
  "board-threads independent",
  !boardCardIds.includes("thread-demo-001") && boardHrefs.every((h) => h.includes("board-thread.html"))
);
record("board-threads not mvp-thread links", boardHrefs.every((h) => !h.includes("mvp-thread.html")));

});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failures:", failed.map((f) => f.name).join(", "));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("All audits passed");
