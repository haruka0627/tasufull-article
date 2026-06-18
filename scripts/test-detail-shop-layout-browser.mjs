#!/usr/bin/env node
/**
 * detail-shop レイアウト E2E（空セクション非表示・ヒーローこだわり位置）
 *
 *   BASE_URL=http://127.0.0.1:5174 node scripts/test-detail-shop-layout-browser.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "..", "screenshots", "detail-shop-layout");

const CASES = [
  { id: "demo-shop-haru-cafe", label: "飲食", expectPoints: true },
  { id: "demo-shop-reworks", label: "工具" },
  { id: "demo-shop-bloom", label: "bloom" },
  { id: "demo-shop-marche-vert", label: "雑貨" },
  { id: "demo-shop-flower-atelier", label: "花屋", expectPoints: true },
  {
    id: "shop-store-demo-other-001",
    label: "その他",
    expectOverview: true,
    skipProducts: true,
  },
];

const SECTION_IDS = [
  "section-shop-overview",
  "section-shop-handling-info",
  "section-products",
  "section-shop-cases",
  "section-shop-highlights",
  "section-shop-bottom",
  "section-reviews",
  "section-faq",
];

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function waitShopLoaded(page) {
  await page.waitForFunction(
    () =>
      document.body.dataset.listingLoaded === "true" ||
      document.body.dataset.listingLoaded === "error",
    { timeout: 20000 }
  );
}

async function inspectPage(page, spec, viewport) {
  const vpLabel = viewport.width >= 1000 ? "pc" : "sp";
  console.log(`\n=== ${spec.label} (${spec.id}) [${vpLabel}] ===\n`);
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/detail-shop.html?id=${spec.id}`, { waitUntil: "domcontentloaded" });
  await waitShopLoaded(page);
  await page.waitForTimeout(150);

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const data = await page.evaluate((ids) => {
    const sections = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, missing: true };
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = (el.textContent || "").replace(/\s+/g, "").trim();
      const hasImg = Boolean(el.querySelector("img[src], img[data-src]"));
      const hasCard = Boolean(
        el.querySelector(
          "article, .food-menu-card, .shop-prod-card, details.shop-faq-item, .food-info-row, .retail-news__item, .food-review-pickup"
        )
      );
      return {
        id,
        hidden: el.hidden,
        isHidden: el.classList.contains("is-hidden"),
        display: style.display,
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        emptyClass: el.classList.contains("shop-section--empty"),
        textLen: text.length,
        hasImg,
        hasCard,
      };
    });
    const points = document.querySelector("[data-shop-restaurant-points]");
    const main = document.querySelector(".shop-hero-main, .biz-detail-fv__main");
    const anchor =
      main?.querySelector("[data-biz-detail-hero-genre-tags]:not([hidden])") ||
      main?.querySelector("[data-biz-detail-title]");
    const pointsRect = points?.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect();
    return {
      sections,
      pointsTop: pointsRect && !points.hidden ? Math.round(pointsRect.top) : null,
      titleTop: anchorRect ? Math.round(anchorRect.top) : null,
      pointsHidden: points?.hidden,
      pointsDisplay: points ? window.getComputedStyle(points).display : null,
      loaded: document.body.dataset.listingLoaded,
    };
  }, SECTION_IDS);

  try {
    await mkdir(SHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(SHOT_DIR, `${spec.id}-${vpLabel}.png`),
      fullPage: false,
    });
  } catch {
    /* optional */
  }

  if (data.loaded !== "true") {
    fail(`${vpLabel}/${spec.label}: 読み込み`);
    return;
  }

  for (const s of data.sections) {
    if (s.missing) continue;
    const visible = !s.hidden && s.display !== "none" && s.height > 8;
    const shouldHide =
      (s.id === "section-shop-overview" && !spec.expectOverview) ||
      (s.id === "section-shop-handling-info" && !spec.expectOverview) ||
      (s.id === "section-faq" && !spec.expectOverview && spec.label !== "飲食") ||
      (s.id === "section-products" && spec.skipProducts);

    const hasBody = s.hasImg || s.hasCard || s.textLen > 24;

    if (shouldHide) {
      if (visible) {
        fail(`${vpLabel}/${spec.label}: ${s.id} 非表示`, `h=${s.height} display=${s.display}`);
      } else {
        pass(`${vpLabel}/${spec.label}: ${s.id} 非表示`);
      }
      if (shouldHide && visible && !s.isHidden && !s.hidden) {
        fail(`${vpLabel}/${spec.label}: ${s.id} is-hidden`, "class missing");
      }
    } else if (!shouldHide && visible && hasBody) {
      pass(`${vpLabel}/${spec.label}: ${s.id} 表示`, `h=${s.height}`);
    } else if (!visible || s.height <= 8) {
      pass(`${vpLabel}/${spec.label}: ${s.id} 空枠なし`);
    } else if (visible && !hasBody) {
      fail(`${vpLabel}/${spec.label}: ${s.id} 空枠`, `h=${s.height} text=${s.textLen}`);
    }
  }

  if (
    spec.expectPoints &&
    viewport.width >= 1000 &&
    data.pointsTop != null &&
    data.titleTop != null &&
    !data.pointsHidden
  ) {
    const delta = data.pointsTop - data.titleTop;
    if (delta >= -8 && delta <= 16) {
      pass(`${vpLabel}/${spec.label}: こだわり位置`, `Δtop=${delta}px`);
    } else {
      fail(
        `${vpLabel}/${spec.label}: こだわり位置`,
        `points=${data.pointsTop} anchor=${data.titleTop} Δ=${delta}`
      );
    }
  }

  const severe = consoleErrors.filter((t) => !/favicon|404.*\.map/i.test(t));
  if (severe.length) {
    fail(`${vpLabel}/${spec.label}: console`, severe.slice(0, 2).join(" | "));
  } else {
    pass(`${vpLabel}/${spec.label}: console`);
  }
}

async function main() {
  console.log(`\ndetail-shop レイアウト E2E — ${BASE}\n`);
  await mkdir(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const spec of CASES) {
    await inspectPage(page, spec, { width: 1280, height: 900 });
    await inspectPage(page, spec, { width: 390, height: 844 });
  }

  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  const summary = { ok, total: results.length, results };
  await writeFile(
    path.join(SHOT_DIR, "last-run.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.log(`\n--- 結果: ${ok}/${results.length} OK ---`);
  console.log(`スクショ: ${SHOT_DIR}\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
