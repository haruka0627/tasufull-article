#!/usr/bin/env node
/**
 * 通知URLから public-board-detail（案件）が描画されることを検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

async function findBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  const hosts = ["http://127.0.0.1", "http://localhost"];
  const ports = [5173, 5176, 5174];
  for (const host of hosts) {
    for (const port of ports) {
      try {
        const res = await fetch(`${host}:${port}/public-board-detail.html`, { method: "HEAD" });
        if (res.ok) return `${host}:${port}`;
      } catch {
        /* next */
      }
    }
  }
  throw new Error("No dev server found (run: npm run dev)");
}

const BASE = await findBaseUrl();
const NOTIFY_URL =
  "/public-board-detail.html?id=pub-board-project-001&type=project&from=talk";
const results = [];

function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

async function collectDetail(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-board-detail-root="project"]');
    const main = root?.querySelector(".detail-page-main");
    const title = document.querySelector("[data-public-project-title]")?.textContent?.trim() || "";
    const summary = document.querySelector("[data-public-project-summary]")?.textContent?.trim() || "";
    const overview = document.querySelector("[data-public-project-overview]")?.textContent?.trim() || "";
    const reward = document.querySelector("[data-public-project-reward]")?.textContent?.trim() || "";
    const metrics = document.querySelector("[data-public-project-metrics]")?.textContent?.trim() || "";
    const dockApply = document.querySelector("[data-public-project-dock-apply]");
    const heroApply = document.querySelector("[data-public-project-apply]");
    const ctaPanel = document.querySelector("[data-public-project-cta]");
    const heroCard = document.querySelector(".job-top-card.job-hero-section");
    const talkBack =
      document.querySelector("[data-tasu-talk-back]")?.textContent?.trim() ||
      document.querySelector("[data-board-detail-back]")?.textContent?.trim() ||
      "";
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    const offset = (shellHead?.getBoundingClientRect().height || 0) + 10;
    const inViewport = (el) => {
      if (!el || el.hidden) return false;
      const r = el.getBoundingClientRect();
      return r.top >= offset - 8 && r.top < window.innerHeight * 0.72 && r.height > 0;
    };
    const mainStyle = main ? getComputedStyle(main).visibility : "";
    const grid = document.querySelector(".skill-hero-premium__grid");
    return {
      boardPdView: document.body.dataset.boardPdView || "",
      publicBoardFromTalk: document.body.dataset.publicBoardFromTalk || "",
      boardDetailLoaded: document.body.dataset.boardDetailLoaded || "",
      listingLoaded: document.body.dataset.listingLoaded || "",
      boardDetailType: document.body.dataset.boardDetailType || "",
      rootHidden: Boolean(root?.hidden),
      mainVisible: mainStyle === "visible",
      title,
      mobileTitle: document.querySelector(".tasu-mobile-page-head__title")?.textContent?.trim() || "",
      summary,
      overview,
      reward,
      metrics,
      hasDockApply: Boolean(dockApply && !dockApply.hidden),
      hasHeroApply: Boolean(heroApply && !heroApply.hidden),
      heroApplyInViewport: inViewport(heroApply) || inViewport(ctaPanel),
      dockApplyInViewport: inViewport(dockApply),
      heroFocused: Boolean(heroCard?.classList.contains("is-view-focus") || ctaPanel?.classList.contains("is-view-focus")),
      gridDisplay: grid ? getComputedStyle(grid).display : "",
      ctaOrder: ctaPanel ? getComputedStyle(ctaPanel).order : "",
      talkBack,
      rootHasContent: Boolean(main && main.textContent && main.textContent.replace(/\s/g, "").length > 40),
      isDefaultShellOnly:
        title === "案件詳細" &&
        (overview === "—" || overview === "") &&
        (summary === "—" || summary === ""),
      idAliasOk: title.includes("世田谷") || title.includes("マンション"),
    };
  });
}

await withPlaywrightBrowser(async (browser) => {for (const viewport of [
  { label: "PC1280", width: 1280, height: 800 },
  { label: "SP390", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${BASE}${NOTIFY_URL}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      document.body.dataset.boardDetailLoaded === "true" ||
      document.body.dataset.boardDetailLoaded === "error",
    { timeout: 20000 }
  );
  await page.waitForTimeout(viewport.width < 500 ? 1500 : 500);

  const data = await collectDetail(page);
  const prefix = `notify/${viewport.label}`;

  push(`${prefix}: boardDetailLoaded`, data.boardDetailLoaded === "true", data.boardDetailLoaded);
  push(`${prefix}: main visible`, data.mainVisible, `visibility=${data.mainVisible}`);
  push(`${prefix}: 案件タイトル`, data.title.length > 0 && data.title !== "案件詳細", data.title);
  push(
    `${prefix}: 案件概要`,
    data.overview.length > 2 && data.overview !== "—",
    data.overview.slice(0, 60)
  );
  push(
    `${prefix}: 条件/報酬/場所`,
    /報酬|万円|¥|世田谷|東京/.test(`${data.summary} ${data.reward} ${data.metrics}`),
    `${data.summary} / ${data.reward}`
  );
  push(`${prefix}: root中身あり`, data.rootHasContent && !data.isDefaultShellOnly, `shellOnly=${data.isDefaultShellOnly}`);
  push(`${prefix}: IDエイリアス`, data.idAliasOk, data.title);
  push(`${prefix}: builder boardPdView 未使用`, data.boardPdView === "", `boardPdView=${data.boardPdView || "(empty)"}`);
  push(`${prefix}: from=talk フラグ`, data.publicBoardFromTalk === "true", data.publicBoardFromTalk);
  push(`${prefix}: 応募ドック`, data.hasDockApply, "");
  push(`${prefix}: ヒーロー応募ボタン`, data.hasHeroApply, "");
  push(
    `${prefix}: 応募CTA画面内`,
    data.heroApplyInViewport || data.dockApplyInViewport,
    `hero=${data.heroApplyInViewport},dock=${data.dockApplyInViewport}`
  );
  if (viewport.width < 500) {
    push(
      `${prefix}: モバイルタイトル同期`,
      data.mobileTitle.length > 0 && data.mobileTitle !== "案件・求人詳細",
      data.mobileTitle
    );
    push(`${prefix}: is-view-focus`, data.heroFocused, "");
    push(
      `${prefix}: TALK戻り`,
      /TALK/.test(data.talkBack) || /talk-home/.test(await page.evaluate(() => location.search)),
      data.talkBack
    );
  }
  push(`${prefix}: console error なし`, consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 120));

  await page.close();
}

});

const failed = results.filter((r) => !r.ok);
console.log("\n=== public-board-detail render test ===\n");
results.forEach((r) => {
  console.log(`${r.ok ? "OK" : "NG"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
});
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
