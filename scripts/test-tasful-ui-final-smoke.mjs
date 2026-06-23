#!/usr/bin/env node
/**
 * TASFUL 公開前 UI 最終スモーク（PC 1280 / SP 390・360）
 *
 *   BASE_URL=http://127.0.0.1:5173 node scripts/test-tasful-ui-final-smoke.mjs
 *
 * 手動確認: docs/gen-ai-voice-manual-checklist.md（gen-ai 音声）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHAR_MODE = encodeURIComponent("AIキャラ会話");

const VIEWPORTS = [
  { w: 1280, h: 900, label: "PC1280" },
  { w: 390, h: 844, label: "SP390" },
  { w: 360, h: 740, label: "SP360" },
];

/** @type {import('./test-tasful-ui-final-smoke.mjs').PageSpec[]} */
const PAGES = [
  { id: "index-top", path: "index-top.html", group: "top", cta: "a.top-category-card, a[href*='index.html'], .tasful-ai-logo" },
  { id: "index", path: "index.html", group: "top", cta: "a[href*='category='], .listing-card a, main a" },
  { id: "post", path: "post.html", group: "app", cta: "[data-open-confirm], .post-btn--primary" },
  {
    id: "gen-ai-workspace",
    path: `gen-ai-workspace.html?mode=${CHAR_MODE}`,
    group: "ai",
    cta: "[data-gen-ai-send]",
    extra: "genAi",
  },
  { id: "ai-workspace", path: "ai-workspace.html", group: "ai", cta: "[data-ai-chat-send], .ai-chat__send" },
  { id: "chat-list", path: "chat-list.html", group: "talk", cta: "[data-talk-root], #talkChatThreadList, .talk-line-list" },
  {
    id: "chat-detail",
    path: "chat-detail.html?thread=plat-ui-smoke",
    group: "talk",
    cta: "#chatSend, #chatInput, .chat-composer",
    seedChat: true,
  },
  { id: "dashboard", path: "dashboard.html", group: "app", cta: "[data-dash-sidebar-nav] a, #dashSidebarNav a, .dash-sidebar__nav a" },
  { id: "my-listings", path: "my-listings.html", group: "app", cta: "main a, [data-my-listings], .my-listings" },
  {
    id: "detail-general",
    path: "detail-general.html?id=general-demo-002",
    group: "detail",
    detail: true,
    cta: "[data-biz-detail-estimate], [data-biz-detail-inquiry], .biz-detail-btn, button",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite]",
    favoriteOptional: true,
  },
  {
    id: "detail-skill",
    path: "detail-skill.html?id=skill_sd_2026",
    group: "detail",
    detail: true,
    cta: "[data-favorite-button], .skill-cta-panel__btn, [data-listing-inquiry]",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite]",
  },
  {
    id: "detail-worker",
    path: "detail-worker.html?id=general-demo-002",
    group: "detail",
    detail: true,
    cta: "[data-favorite-button], .skill-cta-panel__btn, button",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite]",
  },
  {
    id: "detail-product",
    path: "detail-product.html?id=product_set_2026",
    group: "detail",
    detail: true,
    cta: "[data-favorite-button], .skill-cta-panel__btn, button",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite]",
  },
  {
    id: "detail-job",
    path: "detail-job.html?id=demo-job-001",
    group: "detail",
    detail: true,
    cta: "[data-favorite-button], .skill-cta-panel__btn, button",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite]",
  },
  {
    id: "detail-shop",
    path: "detail-shop.html?id=shop-store-demo-other-001",
    group: "detail",
    detail: true,
    cta: "[data-biz-detail-favorite], [data-shop-inquiry], button",
    favoriteSel: "[data-biz-detail-favorite], [data-favorite-button]",
  },
  {
    id: "detail-shop-product",
    path: "detail-shop-product.html?shopId=demo-shop-haru-cafe&productId=demo-restaurant-0",
    group: "detail",
    detail: true,
    cta: "[data-shop-product-cart], [data-shop-product-add], button",
    favoriteSel: "[data-favorite-button], [data-tasu-favorite], [data-biz-detail-favorite]",
    favoriteOptional: true,
  },
  {
    id: "detail-business-service",
    path: "detail-business-service.html?id=demo-biz-08",
    group: "detail",
    detail: true,
    cta: "[data-biz-detail-favorite], [data-bsd-inquiry], button",
    favoriteSel: "[data-biz-detail-favorite], [data-favorite-button]",
  },
  {
    id: "builder-top",
    path: "builder/builder-top.html",
    group: "builder",
    cta: "a[href*='mvp'], .builder-top a, main a",
    builderBackOptional: true,
  },
  {
    id: "builder-threads",
    path: "builder/mvp-threads.html",
    group: "builder",
    cta: "[data-builder-mvp-threads], .mvp-thread-card a, main a",
    builderBackOptional: true,
  },
  {
    id: "builder-project-detail",
    path: "builder/mvp-project-detail.html?id=demo-project-001",
    group: "builder",
    cta: "[data-builder-mvp-pd-thread], [data-builder-page-back], a",
  },
];

const results = [];
const pageErrors = new Map();

function isIgnorableConsole(text) {
  const t = String(text || "");
  return (
    /Failed to load resource/i.test(t) ||
    /net::ERR_/i.test(t) ||
    /favicon/i.test(t) ||
    /\b404\b/.test(t) ||
    /\b400\b/.test(t) ||
    /supabase/i.test(t) ||
    /Supabase/i.test(t) ||
    /TasuChat/i.test(t) ||
    /\[TasuSupabase\]/i.test(t)
  );
}

function record(pageId, vp, check, ok, detail = "", priority = "") {
  results.push({ pageId, vp, check, ok, detail, priority });
  const mark = ok ? "PASS" : "FAIL";
  const pri = priority && !ok ? ` [${priority}]` : "";
  console.log(`${mark}${pri}: ${pageId} @ ${vp} — ${check}${detail ? ` (${detail})` : ""}`);
}

async function evaluateLayout(page, spec) {
  return page.evaluate((extra) => {
    const doc = document.documentElement;
    const overflowPx = doc.scrollWidth - window.innerWidth;
    const pick = (sels) => {
      for (const s of sels.split(",").map((x) => x.trim())) {
        const el = document.querySelector(s);
        if (el && !el.hidden) return el;
      }
      return null;
    };
    const header = pick(
      "header, .gen-ai-header, .chat-list-top, .builder-header, .job-top-header, .shop-market-header, [class*='-header']:not([class*='__'])"
    );
    const footer = document.querySelector("footer");
    const headerH = header?.getBoundingClientRect().height || 0;
    const footerH = footer?.getBoundingClientRect().height || 0;
    const vh = window.innerHeight;
    const headerHuge = headerH > Math.min(320, vh * 0.42);
    const footerHuge = footerH > Math.min(280, vh * 0.38);

    const ctaSel = extra.cta || "button, a.btn, [type='submit']";
    let ctaFound = false;
    let ctaInView = false;
    let ctaClipped = false;
    for (const s of ctaSel.split(",").map((x) => x.trim())) {
      const nodes = document.querySelectorAll(s);
      for (const el of nodes) {
        if (el.hidden || el.getAttribute("aria-hidden") === "true") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        ctaFound = true;
        const inView =
          r.bottom > 4 &&
          r.top < vh - 4 &&
          r.right > 4 &&
          r.left < window.innerWidth - 4;
        if (inView) ctaInView = true;
        if (r.right > window.innerWidth + 8 || r.left < -8) ctaClipped = true;
        if (ctaInView) break;
      }
      if (ctaInView) break;
    }

    const h1 = document.querySelector(
      "h1, [data-listing-service-name], [data-biz-detail-title], [data-listing-title]"
    );
    const h1Ok = extra.detail
      ? Boolean(h1 && (h1.textContent?.trim() || h1.getAttribute("data-listing-service-name")))
      : true;
    const favSel = extra.favoriteSel || "[data-favorite-button], [data-tasu-favorite], [data-biz-detail-favorite]";
    const favorite = document.querySelector(favSel);
    const lmLink = document.querySelector('a[href*="listing-management"]');
    const detailExtras = extra.detail
      ? {
          h1: Boolean(h1),
          favorite: Boolean(favorite),
          listingMgmt: Boolean(lmLink),
        }
      : null;

    let genAi = null;
    if (extra.genAi) {
      const mics = [...document.querySelectorAll("[data-gen-ai-mic]")].filter((b) => !b.hidden);
      const stage = document.querySelector("[data-ai-character-stage]");
      const sr = stage?.getBoundingClientRect();
      const micOverflow = mics.some((b) => {
        const r = b.getBoundingClientRect();
        return r.right > window.innerWidth + 6 || r.left < -6;
      });
      const stageOverflow = sr
        ? sr.right > window.innerWidth + 12 || sr.left < -12 || sr.width > window.innerWidth + 20
        : false;
      const voiceStatus = document.querySelector("[data-gen-ai-voice-status]");
      genAi = {
        micCount: mics.length,
        micOverflow,
        stageOverflow,
        voiceStatus: Boolean(voiceStatus),
      };
    }

    let builder = null;
    if (extra.group === "builder") {
      const back = document.querySelector("[data-builder-page-back]");
      const thread = document.querySelector("[data-builder-mvp-pd-thread]");
      builder = {
        back: Boolean(back),
        thread: Boolean(thread),
      };
    }

    const cards = [...document.querySelectorAll(".listing-card, .top-category-card, .mvp-thread-card, .chat-list__item")];
    let cardBroken = false;
    for (const c of cards.slice(0, 8)) {
      const r = c.getBoundingClientRect();
      if (r.width > window.innerWidth + 40 || r.height > vh * 1.5) {
        cardBroken = true;
        break;
      }
    }

    return {
      overflowPx,
      headerH: Math.round(headerH),
      footerH: Math.round(footerH),
      headerHuge,
      footerHuge,
      ctaFound,
      ctaInView,
      ctaClipped,
      h1Ok,
      detailExtras,
      genAi,
      builder,
      cardBroken,
      title: document.title,
    };
  }, {
    cta: spec.cta,
    detail: spec.detail,
    genAi: spec.extra === "genAi",
    group: spec.group,
    favoriteSel: spec.favoriteSel,
  });
}

function chatSeedInitScript() {
  return () => {
    const threadId = "plat-ui-smoke";
    const threads = [
      {
        id: threadId,
        listingId: "general-demo-002",
        title: "UI smoke",
        updatedAt: new Date().toISOString(),
      },
    ];
    const messages = [
      { id: "m1", threadId, role: "user", body: "テスト", createdAt: new Date().toISOString() },
      { id: "m2", threadId, role: "assistant", body: "OK", createdAt: new Date().toISOString() },
    ];
    localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));
    localStorage.setItem("tasful_chat_messages", JSON.stringify({ [threadId]: messages }));
  };
}

async function main() {
  console.log(`\nTASFUL UI final smoke — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const consoleMap = new Map();

    for (const spec of PAGES) {
      const page = await context.newPage();
      const errKey = `${spec.id}:${vp.label}`;
      const errs = [];
      consoleMap.set(errKey, errs);

      page.on("pageerror", (e) => {
        const msg = e.message || String(e);
        if (!isIgnorableConsole(msg)) errs.push(`pageerror: ${msg.slice(0, 120)}`);
      });
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (!isIgnorableConsole(t)) errs.push(`console: ${t.slice(0, 120)}`);
      });

      try {
        if (spec.seedChat) await page.addInitScript(chatSeedInitScript());
        const url = `${BASE}/${spec.path}`;
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
        const httpOk = res?.status() === 200 || res?.status() === 304;
        record(spec.id, vp.label, "HTTP 200", httpOk, String(res?.status() || "?"), httpOk ? "" : "P0");

        if (spec.group === "detail") {
          await page
            .waitForFunction(
              () =>
                window.listingLoaded === true ||
                document.querySelector("h1")?.textContent?.trim().length > 0,
              { timeout: 12000 }
            )
            .catch(() => {});
        }
        await page.waitForTimeout(spec.group === "detail" ? 800 : 600);
        const layout = await evaluateLayout(page, spec);

        const overflow = layout.overflowPx > 24;
        const overflowPri =
          overflow && (spec.id === "index" || spec.id === "index-top") && vp.label.startsWith("SP")
            ? "P2"
            : overflow
              ? "P1"
              : "";
        record(
          spec.id,
          vp.label,
          "横スクロールなし",
          !overflow,
          overflow ? `+${layout.overflowPx}px` : "",
          overflowPri
        );

        record(
          spec.id,
          vp.label,
          "ヘッダー高さ",
          !layout.headerHuge,
          `${layout.headerH}px`,
          layout.headerHuge ? "P1" : ""
        );
        if (layout.footerH > 0) {
          record(
            spec.id,
            vp.label,
            "フッター高さ",
            !layout.footerHuge,
            `${layout.footerH}px`,
            layout.footerHuge ? "P2" : ""
          );
        }

        record(
          spec.id,
          vp.label,
          "CTA存在",
          layout.ctaFound,
          spec.cta?.split(",")[0]?.trim(),
          layout.ctaFound ? "" : "P0"
        );
        record(
          spec.id,
          vp.label,
          "CTA見切れなし",
          !layout.ctaClipped && (layout.ctaInView || spec.group === "detail"),
          layout.ctaInView ? "inView" : "offscreen-ok",
          layout.ctaClipped ? "P1" : ""
        );

        record(spec.id, vp.label, "カード極端崩れなし", !layout.cardBroken, "", layout.cardBroken ? "P1" : "");

        if (spec.detail) {
          record(spec.id, vp.label, "h1表示", layout.detailExtras?.h1, "", layout.detailExtras?.h1 ? "" : "P0");
          const favOk = layout.detailExtras?.favorite;
          record(
            spec.id,
            vp.label,
            "お気に入り導線",
            favOk || spec.favoriteOptional,
            favOk ? "" : spec.favoriteOptional ? "optional" : "missing",
            favOk || spec.favoriteOptional ? "" : "P1"
          );
          if (layout.detailExtras?.listingMgmt !== undefined) {
            record(spec.id, vp.label, "掲載管理リンク", layout.detailExtras.listingMgmt, "", "P2");
          }
        }

        if (layout.genAi) {
          record(spec.id, vp.label, "マイクUI本数", layout.genAi.micCount >= 1, String(layout.genAi.micCount), layout.genAi.micCount < 1 ? "P1" : "");
          record(spec.id, vp.label, "マイクはみ出しなし", !layout.genAi.micOverflow, "", layout.genAi.micOverflow ? "P1" : "");
          record(spec.id, vp.label, "音声状態UI", layout.genAi.voiceStatus, "", "P2");
          record(spec.id, vp.label, "3Dステージはみ出しなし", !layout.genAi.stageOverflow, "", layout.genAi.stageOverflow ? "P1" : "");
        }

        if (layout.builder) {
          const backOk = layout.builder.back || spec.builderBackOptional;
          record(
            spec.id,
            vp.label,
            "Builder戻る導線",
            backOk,
            backOk && !layout.builder.back ? "optional" : "",
            backOk ? "" : "P1"
          );
          if (spec.id === "builder-project-detail") {
            record(spec.id, vp.label, "スレッド導線", layout.builder.thread, "", layout.builder.thread ? "" : "P1");
          }
        }

        if (spec.group === "talk" && spec.id === "chat-list") {
          const talkLink = await page.locator('a[href*="talk-home"], a[href*="chat-list"]').count();
          record(spec.id, vp.label, "TALK/chat導線", talkLink > 0, `links=${talkLink}`, talkLink ? "" : "P1");
        }

        const errCount = errs.length;
        pageErrors.set(errKey, errs);
        record(spec.id, vp.label, "console/pageerror", errCount === 0, errCount ? errs[0] : "", errCount ? "P0" : "");
      } catch (e) {
        record(spec.id, vp.label, "ページ読込", false, String(e.message).slice(0, 80), "P0");
      } finally {
        await page.close();
      }
    }
    await context.close();
  }

    });

  const failed = results.filter((r) => !r.ok);
  const byPage = new Map();
  for (const r of failed) {
    if (!byPage.has(r.pageId)) byPage.set(r.pageId, []);
    byPage.get(r.pageId).push(r);
  }

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    pages: PAGES.map((p) => p.id),
    viewports: VIEWPORTS.map((v) => v.label),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    pageErrors: Object.fromEntries(pageErrors),
  };
  const reportPath = join(root, "screenshots", "tasful-ui-final-smoke-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`\n--- Summary ---`);
  console.log(`Checks: ${results.length}, PASS: ${results.length - failed.length}, FAIL: ${failed.length}`);
  console.log(`Report: ${reportPath}`);

  if (byPage.size) {
    console.log("\nPages needing attention:");
    for (const [id, items] of byPage) {
      const p0 = items.filter((i) => i.priority === "P0").length;
      console.log(`  - ${id}: ${items.length} issue(s)${p0 ? ` (${p0} P0)` : ""}`);
    }
  }

  const hardFail = failed.filter((f) => f.priority === "P0" || f.priority === "P1");
  await closeAllBrowsers();
  process.exit(hardFail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
