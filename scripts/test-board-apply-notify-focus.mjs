#!/usr/bin/env node
/**
 * 「応募がありました」通知 → board-project-detail?view=applications のフォーカス検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const NOTIFY_PATH =
  "/builder/board-project-detail.html?id=demo-project-001&view=applications&from=talk";
const MVP_KEY = "tasful:builder:mvp:v1";
const results = [];

function push(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

async function findBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  const hosts = ["http://127.0.0.1", "http://localhost"];
  const ports = [5173, 5176, 5174];
  for (const host of hosts) {
    for (const port of ports) {
      try {
        const res = await fetch(`${host}:${port}/builder/board-project-detail.html`, {
          method: "HEAD",
        });
        if (res.ok) return `${host}:${port}`;
      } catch {
        /* next */
      }
    }
  }
  throw new Error("No dev server found (run: npm run dev)");
}

async function collectFocusState(page) {
  return page.evaluate(() => {
    const appsSection = document.querySelector("[data-builder-board-pd-apps-section]");
    const firstCard = appsSection?.querySelector(".mvp-pd-appItem:not(.mvp-pd-appItem--empty)");
    const overviewSection = document.querySelector(".mvp-pd-panel--overview");
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    const offset = shellHead ? shellHead.getBoundingClientRect().height + 10 : 64;

    const inViewport = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= offset - 4 && r.top <= window.innerHeight * 0.55 && r.bottom > offset;
    };

    return {
      view: new URL(window.location.href).searchParams.get("view"),
      from: new URL(window.location.href).searchParams.get("from"),
      boardPdView: document.body.dataset.boardPdView || "",
      pageTitle: document.querySelector("[data-builder-mvp-pd-title]")?.textContent?.trim() || "",
      mobileTitle: document.querySelector(".tasu-mobile-page-head__title")?.textContent?.trim() || "",
      talkBack:
        document.querySelector("[data-tasu-talk-back]")?.textContent?.trim() ||
        document.querySelector("[data-tasu-mobile-back]")?.textContent?.trim() ||
        "",
      appsSectionVisible: Boolean(appsSection && !appsSection.hidden),
      appsSectionFocused: appsSection?.classList.contains("is-view-focus") || false,
      firstCardName: firstCard?.querySelector(".mvp-pd-appItem__name")?.textContent?.trim() || "",
      firstCardStatus: firstCard?.querySelector(".builder-chip")?.textContent?.trim() || "",
      hireBtn: firstCard?.querySelector("[data-builder-board-pd-select]")?.textContent?.trim() || "",
      rejectBtn: firstCard?.querySelector("[data-builder-board-pd-reject]")?.textContent?.trim() || "",
      cardInViewport: inViewport(firstCard),
      appsSectionInViewport: inViewport(appsSection),
      overviewDominates: inViewport(overviewSection) && !inViewport(firstCard),
      scrollY: window.scrollY,
    };
  });
}

const BASE = await findBaseUrl();
await withPlaywrightBrowser(async (browser) => {for (const viewport of [
  { label: "PC1280", width: 1280, height: 900 },
  { label: "SP390", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.addInitScript((mvpKey) => {
    localStorage.setItem("tasful:builder:mvp:role", "owner");
    const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
    if (!(state.applications || []).some((a) => a.project_id === "demo-project-001")) {
      state.applications = [
        ...(state.applications || []),
        {
          project_id: "demo-project-001",
          partner_id: "demo-partner-001",
          status: "applied",
          ts: new Date().toISOString(),
        },
      ];
      localStorage.setItem(mvpKey, JSON.stringify(state));
    }
  }, MVP_KEY);

  await page.goto(`${BASE}${NOTIFY_PATH}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-builder-mvp-pd-app-list] .mvp-pd-appItem:not(.mvp-pd-appItem--empty)", {
    timeout: 20000,
  });
  await page.waitForTimeout(viewport.width < 500 ? 1400 : 900);

  const data = await collectFocusState(page);
  const p = `notify/${viewport.label}`;

  push(`${p}: view=applications`, data.view === "applications", data.view);
  push(`${p}: boardPdView`, data.boardPdView === "applications", data.boardPdView);
  push(
    `${p}: タイトル`,
    /応募者確認|応募状況/.test(`${data.pageTitle} ${data.mobileTitle}`),
    `${data.pageTitle} / ${data.mobileTitle}`
  );
  push(`${p}: 応募状況セクション`, data.appsSectionVisible, "");
  push(`${p}: 応募者名`, data.firstCardName.length > 0, data.firstCardName);
  push(`${p}: 状態`, data.firstCardStatus.length > 0, data.firstCardStatus);
  push(`${p}: 採用する`, data.hireBtn === "採用する", data.hireBtn);
  push(`${p}: 断る`, data.rejectBtn === "断る", data.rejectBtn);
  push(
    `${p}: 応募者カードが画面内`,
    data.cardInViewport || data.appsSectionInViewport,
    `card=${data.cardInViewport},section=${data.appsSectionInViewport},scrollY=${data.scrollY}`
  );
  push(`${p}: 概要トップで止まらない`, !data.overviewDominates, `overviewDominates=${data.overviewDominates}`);
  if (viewport.width < 500) {
    push(`${p}: TALKに戻る`, /TALK/.test(data.talkBack), data.talkBack);
  }

  await page.close();
}

});

const failed = results.filter((r) => !r.ok);
console.log("\n=== board apply notify focus test ===\n");
results.forEach((r) => {
  console.log(`${r.ok ? "OK" : "NG"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
});
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
