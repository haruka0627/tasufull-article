#!/usr/bin/env node
/**
 * 統合公開ページ（public-board）の最小検証
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const MVP_KEY = "tasful:builder:mvp:v1";
const results = [];

function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

const browser = await chromium.launch();

// --- 統合一覧 ---
const listPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await listPage.goto(`${BASE}/public-board.html`, { waitUntil: "domcontentloaded" });
await listPage.waitForSelector("[data-job-list-body] .job-table-row", { timeout: 20000 });
await listPage.waitForTimeout(600);

const listAll = await listPage.evaluate(() => {
  const rows = [...document.querySelectorAll("[data-job-list-body] .job-table-row")];
  const badges = rows.map((r) => r.querySelector(".job-board-type-badge")?.textContent?.trim() || "");
  const totalCount = Number(document.querySelector("[data-job-top-count]")?.textContent || "0");
  const hasProject = badges.some((b) => b === "案件");
  const hasJob = badges.some((b) => b === "求人");
  const tabs = [...document.querySelectorAll("[data-job-top-tabs] [data-job-tab]")].map((b) => b.textContent?.trim());
  const firstProjectLink =
    rows.find((r) => r.querySelector(".job-board-type-badge")?.textContent?.trim() === "案件")
      ?.querySelector("a[href*='public-board-detail']")
      ?.getAttribute("href") || "";
  const firstJobLink =
    rows.find((r) => r.querySelector(".job-board-type-badge")?.textContent?.trim() === "求人")
      ?.querySelector("a[href*='public-board-detail']")
      ?.getAttribute("href") || "";
  return {
    page: document.body.dataset.page,
    count: rows.length,
    hasProject,
    hasJob,
    tabs,
    totalCount,
    firstProjectLink,
    firstJobLink,
  };
});

push("public-board: data-page", listAll.page === "public-board", listAll.page);
push(
  "public-board: 一覧件数",
  listAll.totalCount >= listAll.count,
  `total=${listAll.totalCount},page=${listAll.count}`
);
push(
  "public-board: 種別タブ",
  listAll.tabs.join(",") === "すべて,案件,求人",
  listAll.tabs.join("|")
);

// フィルター: 案件のみ
await listPage.click('[data-job-tab="project"]');
await listPage.waitForTimeout(400);
const projectOnly = await listPage.evaluate(() => {
  const badges = [...document.querySelectorAll("[data-job-list-body] .job-board-type-badge")].map((b) =>
    b.textContent?.trim()
  );
  return { count: badges.length, onlyProject: badges.length > 0 && badges.every((b) => b === "案件") };
});
push("public-board: 案件フィルター", projectOnly.onlyProject && projectOnly.count > 0, `count=${projectOnly.count}`);

// フィルター: 求人のみ
await listPage.click('[data-job-tab="job"]');
await listPage.waitForTimeout(400);
const jobOnly = await listPage.evaluate(() => {
  const badges = [...document.querySelectorAll("[data-job-list-body] .job-board-type-badge")].map((b) =>
    b.textContent?.trim()
  );
  return { count: badges.length, onlyJob: badges.length > 0 && badges.every((b) => b === "求人") };
});
push("public-board: 求人フィルター", jobOnly.onlyJob && jobOnly.count > 0, `count=${jobOnly.count}`);
push(
  "public-board: 案件+求人混在",
  projectOnly.count > 0 && jobOnly.count > 0,
  `project=${projectOnly.count},job=${jobOnly.count}`
);

// tasful_managed 非表示
await listPage.evaluate((key) => {
  const state = JSON.parse(localStorage.getItem(key) || "{}");
  state.projects = [
    ...(state.projects || []),
    {
      project_id: "pub-managed-hidden",
      title: "運営管理（非表示テスト）",
      kind: "tasful_managed",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      created_at: new Date().toISOString(),
    },
  ];
  localStorage.setItem(key, JSON.stringify(state));
}, MVP_KEY);
await listPage.click('[data-job-tab="all"]');
await listPage.reload({ waitUntil: "domcontentloaded" });
await listPage.waitForTimeout(500);
const managedHidden = await listPage.evaluate(() => ({
  shows: (document.body.innerText || "").includes("運営管理（非表示テスト）"),
}));
push("public-board: tasful_managed 非表示", !managedHidden.shows, "");

// --- 案件詳細 ---
const projectId = listAll.firstProjectLink.match(/id=([^&]+)/)?.[1] || "demo-project-001";
const projectDetail = await browser.newPage({ viewport: { width: 390, height: 844 } });
await projectDetail.goto(`${BASE}/public-board-detail.html?id=${encodeURIComponent(projectId)}&type=project`, {
  waitUntil: "domcontentloaded",
});
await projectDetail.waitForSelector('[data-board-detail-root="project"]:not([hidden])', { timeout: 20000 });
const projectDetailData = await projectDetail.evaluate(() => ({
  title: document.querySelector("[data-public-project-title]")?.textContent?.trim() || "",
  overviewLabel: document.querySelector("#projectOverviewTitle")?.textContent?.trim() || "",
  rewardLabel: document.querySelector("[data-public-project-cta] .skill-cta-panel__label")?.textContent?.trim() || "",
  backHref: document.querySelector("[data-board-detail-back]")?.getAttribute("href") || "",
  jobRootHidden: document.querySelector('[data-board-detail-root="job"]')?.hidden,
  projectRootHidden: document.querySelector('[data-board-detail-root="project"]')?.hidden,
}));
push("public-board-detail: 案件タイトル", projectDetailData.title.length > 0, projectDetailData.title);
push(
  "public-board-detail: 案件文言",
  projectDetailData.overviewLabel === "案件概要" && /報酬/.test(projectDetailData.rewardLabel),
  `${projectDetailData.overviewLabel}/${projectDetailData.rewardLabel}`
);
push("public-board-detail: 案件ルート表示", !projectDetailData.projectRootHidden && projectDetailData.jobRootHidden, "");
push("public-board-detail: 戻りリンク", projectDetailData.backHref.includes("public-board"), projectDetailData.backHref);

await projectDetail.evaluate(
  ({ key, id }) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    state.applications = (state.applications || []).filter((a) => a.project_id !== id);
    localStorage.setItem(key, JSON.stringify(state));
  },
  { key: MVP_KEY, id: projectId }
);
await projectDetail.reload({ waitUntil: "domcontentloaded" });
await projectDetail.waitForSelector('[data-board-detail-root="project"]:not([hidden])', { timeout: 20000 });
await projectDetail.evaluate(() => {
  document.querySelector("[data-public-project-apply]")?.scrollIntoView({ block: "center" });
});
await projectDetail.evaluate(() => document.querySelector("[data-public-project-apply]")?.click());
await projectDetail.waitForTimeout(300);
const afterApply = await projectDetail.evaluate(
  ({ key, id }) => {
    const apps = (JSON.parse(localStorage.getItem(key) || "{}").applications || []).filter(
      (a) => a.project_id === id
    );
    return { appCount: apps.length };
  },
  { key: MVP_KEY, id: projectId }
);
push("public-board-detail: 案件応募", afterApply.appCount > 0, `apps=${afterApply.appCount}`);

// --- 求人詳細 ---
if (listAll.firstJobLink) {
  const jobUrl = listAll.firstJobLink.startsWith("http")
    ? listAll.firstJobLink
    : `${BASE}/${listAll.firstJobLink.replace(/^\//, "")}`;
  const jobDetail = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await jobDetail.goto(jobUrl, { waitUntil: "domcontentloaded" });
  await jobDetail.waitForTimeout(2500);
  const jobDetailData = await jobDetail.evaluate(() => ({
    page: document.body.dataset.page,
    boardType: document.body.dataset.boardDetailType,
    jobRootHidden: document.querySelector('[data-board-detail-root="job"]')?.hidden,
    projectRootHidden: document.querySelector('[data-board-detail-root="project"]')?.hidden,
    contentTitle: document.querySelector("#jobContentTitle")?.textContent?.trim() || "",
    salaryTitle: document.querySelector("#jobSalaryTitle")?.textContent?.trim() || "",
    backHref: document.querySelector("[data-job-back-link]")?.getAttribute("href") || "",
    hasApply: Boolean(document.querySelector("[data-listing-primary-cta], [data-job-dock-apply]")),
  }));
  push("public-board-detail: 求人ルート表示", !jobDetailData.jobRootHidden && jobDetailData.projectRootHidden, "");
  push(
    "public-board-detail: 求人文言",
    jobDetailData.contentTitle === "求人内容" && jobDetailData.salaryTitle === "給与",
    `${jobDetailData.contentTitle}/${jobDetailData.salaryTitle}`
  );
  push("public-board-detail: 求人戻り", jobDetailData.backHref.includes("public-board"), jobDetailData.backHref);
  push("public-board-detail: 求人応募CTA", jobDetailData.hasApply, "");
}

// --- スマホ一覧 ---
const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobilePage.goto(`${BASE}/public-board.html`, { waitUntil: "domcontentloaded" });
await mobilePage.waitForTimeout(800);
const mobileData = await mobilePage.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job-list-mobile] article")];
  const badge = cards[0]?.querySelector(".job-board-type-badge")?.textContent?.trim() || "";
  return { cardCount: cards.length, hasBadge: Boolean(badge) };
});
push("public-board: スマホカード", mobileData.cardCount > 0 && mobileData.hasBadge, `cards=${mobileData.cardCount}`);

// --- index-top 導線 ---
const topPage = await browser.newPage();
await topPage.goto(`${BASE}/index-top.html`, { waitUntil: "domcontentloaded" });
const topLinks = await topPage.evaluate(() => ({
  board: [...document.querySelectorAll('a[href*="public-board.html"]')].length,
}));
push("index-top: 統合導線", topLinks.board > 0, `links=${topLinks.board}`);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n=== public-board unified test ===\n");
results.forEach((r) => {
  console.log(`${r.ok ? "OK" : "NG"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
});
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
