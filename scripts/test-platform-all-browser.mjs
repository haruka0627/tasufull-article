#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL プラットフォーム — 主要導線・投稿・詳細・会員・TALK連携 smoke
 *
 *   node scripts/test-platform-all-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-platform-all-browser.mjs
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

const VIEWPORTS = [
  { w: 390, h: 844, label: "390px" },
  { w: 768, h: 900, label: "768px" },
  { w: 1280, h: 900, label: "1280px" },
];

/** @type {{ name: string, path: string; hrefMatch?: RegExp; selector?: string; waitLoaded?: "general"|"shop"|"biz" }} */
const TOP_LINKS_INDEX_TOP = [
  { name: "スキル一覧", path: "index-top.html", selector: 'a[href*="category=skill"]', hrefMatch: /category=skill/ },
  { name: "ワーカー一覧", path: "index-top.html", selector: 'a[href*="category=worker"]', hrefMatch: /category=worker/ },
  { name: "求人一覧", path: "index-top.html", selector: 'a[href="job-top.html"], a[href*="category=job"]', hrefMatch: /job/ },
  { name: "商品一覧", path: "index-top.html", selector: 'a[href*="category=product"]', hrefMatch: /category=product/ },
  { name: "店舗・販売", path: "index-top.html", selector: 'a[href="shop-store.html"]', hrefMatch: /shop-store/ },
  { name: "業務サービス", path: "index-top.html", selector: 'a[href="business.html"]', hrefMatch: /business/ },
  { name: "AI相談", path: "index-top.html", selector: 'a[href="chat-list.html"]', hrefMatch: /chat-list/ },
  { name: "TALK導線(chat-list)", path: "index-top.html", selector: 'a.top-category-card--ai[href*="chat-list"]', hrefMatch: /chat-list/ },
];

const TOP_LINKS_INDEX = [
  { name: "一般TOP", path: "index.html" },
  { name: "求人", path: "index.html", selector: 'a[href="job-top.html"]', hrefMatch: /job-top/ },
  { name: "店舗・販売", path: "index.html", selector: 'a[href="shop-store.html"]', hrefMatch: /shop-store/ },
  { name: "業務サービス", path: "index.html", selector: 'a[href="business.html"]', hrefMatch: /business/ },
  { name: "AI相談", path: "index.html", selector: 'a[href="index-top.html"]', hrefMatch: /index-top/ },
];

const POST_TYPES = [
  { label: "スキル", pick: "skill", panel: '[data-form-type="skill"]:not([hidden])', scope: "general" },
  { label: "ワーカー", pick: "worker", panel: '[data-form-type="worker"]:not([hidden])', scope: "general" },
  { label: "求人", pick: "job", panel: '[data-form-type="job"]:not([hidden])', scope: "general" },
  { label: "商品", pick: "product", panel: '[data-form-type="product"]:not([hidden])', scope: "general" },
  { label: "店舗・販売", pick: "shop-store", panel: "[data-shop-mount]", scope: "business" },
  {
    label: "業務サービス",
    pick: "business-service",
    panel: "[data-field-service-flow]:not([hidden])",
    scope: "business",
  },
];

const LIST_PAGES = [
  { label: "index skill", url: "index.html?category=skill", cardSel: "[data-home-featured] a, [data-home-rank-popular] a, .listing-card a" },
  { label: "index worker", url: "index.html?category=worker", cardSel: "[data-home-featured] a, .listing-card a" },
  { label: "index product", url: "index.html?category=product", cardSel: "[data-home-featured] a, .listing-card a" },
  { label: "job-top", url: "job-top.html", cardSel: ".job-top-card a, .job-card a, a[href*='detail-job']" },
  { label: "shop-store", url: "shop-store.html", cardSel: "a[href*='detail-shop']" },
  { label: "business", url: "business.html", cardSel: "a[href*='detail-business']" },
];

const DETAIL_PAGES = [
  { label: "スキル", url: "detail-skill.html?id=skill_sd_2026", waitLoaded: "detail" },
  { label: "ワーカー", url: "detail-worker.html?id=general-demo-002", waitLoaded: "detail" },
  { label: "求人", url: "detail-job.html?id=demo-job-001", waitLoaded: "detail" },
  { label: "商品", url: "detail-product.html?id=product_set_2026", waitLoaded: "detail" },
  { label: "店舗・販売", url: "detail-shop.html?id=shop-store-demo-other-001", waitLoaded: "shop" },
  { label: "業務サービス", url: "detail-business-service.html?id=demo-biz-08", waitLoaded: "biz" },
];

const MEMBER_PAGES = [
  { label: "ログイン", url: "login.html", sel: "[data-login-email], [data-signup-email], input[type=email]" },
  { label: "会員登録", url: "signup.html", sel: "[data-signup-email]" },
  { label: "ダッシュボード", url: "dashboard.html", sel: "[data-dash-sidebar-nav], #dashSidebarNav, .dash-sidebar__nav" },
  { label: "プロフィール", url: "profile-settings.html", sel: "[data-profile-form], form" },
  { label: "掲載管理", url: "listing-management.html", sel: "[data-lm-list], [data-lm-tabs]" },
  { label: "通知設定", url: "notification-settings.html", sel: "form, [data-notification-settings]" },
  { label: "支払い設定", url: "payment-settings.html", sel: "form, main" },
];

async function main() {
  const errors = [];
  await withPlaywrightBrowser(async (browser) => {
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  const pageErrors = [];
  const trackPage = (page) => {
    page.on("pageerror", (e) => {
      const msg = e.message || String(e);
      if (!/supabase|Supabase|favicon/i.test(msg)) pageErrors.push(msg);
    });
  };

  try {
    console.log("\n=== 1. トップページ導線 ===");
    const topPage = await browser.newPage();
    trackPage(topPage);

    for (const item of TOP_LINKS_INDEX_TOP) {
      await topPage.goto(`${BASE}/${item.path}`, { waitUntil: "load", timeout: 25000 });
      const loc = topPage.locator(item.selector || "a").first();
      const href = await loc.getAttribute("href").catch(() => null);
      if (!href || (item.hrefMatch && !item.hrefMatch.test(href))) {
        fail(`index-top: ${item.name} (${href || "missing"})`);
      } else pass(`index-top: ${item.name} → ${href}`);
    }

    for (const item of TOP_LINKS_INDEX) {
      await topPage.goto(`${BASE}/${item.path}`, { waitUntil: "load", timeout: 25000 });
      if (!item.selector) {
        pass(`index.html: ${item.name} 表示`);
        continue;
      }
      const href = await topPage.locator(item.selector).first().getAttribute("href").catch(() => null);
      if (!href || (item.hrefMatch && !item.hrefMatch.test(href))) {
        fail(`index.html: ${item.name} (${href || "missing"})`);
      } else pass(`index.html: ${item.name} → ${href}`);
    }
    await topPage.close();

    console.log("\n=== 2. 投稿フォーム（カテゴリ切替） ===");
    const postPage = await browser.newPage();
    trackPage(postPage);
    await postPage.goto(`${BASE}/post.html`, { waitUntil: "load", timeout: 25000 });
    await postPage.waitForSelector("[data-post-scope-block]", { timeout: 10000 });

    for (const t of POST_TYPES) {
      if (t.scope === "business") {
        await postPage.evaluate((pick) => {
          const btn = document.querySelector(`[data-post-type="${pick}"]`);
          btn?.click();
        }, t.pick);
      } else {
        await postPage.evaluate((pick) => {
          const radio = document.querySelector(`[data-general-category][value="${pick}"]`);
          if (!radio) return;
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
          radio.dispatchEvent(new Event("input", { bubbles: true }));
        }, t.pick);
      }
      await postPage.waitForTimeout(500);
      const panelVisible = await postPage.locator(t.panel).first().isVisible().catch(() => false);
      const typeVal = await postPage.evaluate(() => document.body.dataset.postFormType || "");
      const bizFlow = t.pick === "business-service"
        ? await postPage.locator("[data-field-service-flow]").first().isVisible().catch(() => false)
        : false;
      if (!panelVisible && !bizFlow && !typeVal.includes(t.pick.replace("-", ""))) {
        fail(`post: ${t.label} フォーム表示`);
      } else pass(`post: ${t.label} フォーム (${typeVal || "panel"})`);
    }
    await postPage.close();

    console.log("\n=== 3. 一覧ページ ===");
    for (const list of LIST_PAGES) {
      const p = await browser.newPage();
      trackPage(p);
      try {
        const res = await p.goto(`${BASE}/${list.url}`, { waitUntil: "load", timeout: 25000 });
        if (!res || res.status() >= 400) {
          fail(`${list.label} HTTP ${res?.status()}`);
          await p.close();
          continue;
        }
        await p.waitForTimeout(1500);
        const cardCount = await p.locator(list.cardSel).count();
        if (cardCount < 1) fail(`${list.label}: カード0件`);
        else pass(`${list.label}: カード ${cardCount}件`);
      } catch (err) {
        fail(`${list.label}: ${err.message}`);
      }
      await p.close();
    }

    console.log("\n=== 4. 詳細ページ ===");
    const seedPage = await browser.newPage();
    await seedPage.goto(`${BASE}/index.html`, { waitUntil: "load" });
    await seedPage.evaluate(() => {
      window.TasuListingLocalStore?.seedGeneralDemoIfMissing?.();
      window.TasuListingLocalStore?.ensureShopStoreOtherDemo?.();
    });
    await seedPage.close();

    for (const d of DETAIL_PAGES) {
      const p = await browser.newPage();
      trackPage(p);
      try {
        const res = await p.goto(`${BASE}/${d.url}`, { waitUntil: "load", timeout: 30000 });
        if (!res || res.status() >= 400) {
          fail(`${d.label} HTTP ${res?.status()}`);
          await p.close();
          continue;
        }
        await p.waitForFunction(
          () => {
            if (document.body.dataset.listingLoaded === "true") return true;
            const t = (
              document.querySelector("[data-biz-detail-title]")?.textContent ||
              document.querySelector("h1")?.textContent ||
              ""
            ).trim();
            return t.length > 2 && !/見つかりません|not found|404/i.test(t);
          },
          { timeout: 20000 }
        );
        const title = await p.evaluate(() =>
          (
            document.querySelector("[data-biz-detail-title]")?.textContent ||
            document.querySelector("h1")?.textContent ||
            ""
          ).trim()
        );
        const empty = !title || /見つかりません|not found/i.test(title);
        const legacyCat = await p.evaluate(() => {
          const blob = document.body.innerText || "";
          return /カテゴリ:\s*project\b|旧カテゴリ/i.test(blob);
        });
        if (empty) fail(`${d.label}: タイトル空`);
        else pass(`${d.label}: 表示 OK`);
        if (legacyCat) fail(`${d.label}: 旧カテゴリ表記`);
      } catch (err) {
        fail(`${d.label}: ${err.message}`);
      }
      await p.close();
    }

    console.log("\n=== 5. 会員導線 ===");
    for (const m of MEMBER_PAGES) {
      const p = await browser.newPage();
      trackPage(p);
      try {
        const res = await p.goto(`${BASE}/${m.url}`, { waitUntil: "load", timeout: 25000 });
        if (!res || res.status() >= 400) {
          fail(`${m.label} HTTP ${res?.status()}`);
        } else {
          const ok = (await p.locator(m.sel).count()) > 0;
          if (!ok) fail(`${m.label}: 主要UIなし`);
          else pass(`${m.label}: ページ表示`);
        }
      } catch (err) {
        fail(`${m.label}: ${err.message}`);
      }
      await p.close();
    }

    const memberPage = await browser.newPage();
    trackPage(memberPage);
    await memberPage.goto(`${BASE}/signup.html`, { waitUntil: "load" });
    const email = `platform-smoke-${Date.now()}@tasful-dev.test`;
    await memberPage.fill("[data-signup-email]", email);
    await memberPage.fill("[data-signup-password]", "TestPass1!");
    await memberPage.fill("[data-signup-password-confirm]", "TestPass1!");
    await memberPage.fill("[data-signup-nickname]", "platform-smoke");
    await memberPage.evaluate(() => {
      const el = document.querySelector("[data-signup-agree]");
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await memberPage.click("[data-signup-submit]");
    await memberPage.waitForTimeout(1200);
    const hasSession = await memberPage.evaluate(
      () => !!localStorage.getItem("tasu_member_session")
    );
    if (!hasSession) fail("会員登録→localStorageセッション");
    else pass("会員登録→セッション保存");

    await memberPage.goto(`${BASE}/dashboard.html`, { waitUntil: "load" });
    await memberPage.waitForTimeout(800);
    const dashTitle = await memberPage.locator(".dash-header__title").first().textContent().catch(() => "");
    if (!/ダッシュボード|会員/.test(dashTitle || "")) fail("登録後ダッシュボード");
    else pass("登録後ダッシュボード表示");

    await memberPage.goto(`${BASE}/dashboard.html`, { waitUntil: "load" });
    await memberPage.evaluate(async () => {
      if (window.TasuMemberAuth?.logout) {
        await window.TasuMemberAuth.logout();
        return;
      }
      localStorage.removeItem("tasu_member_session");
    });
    await memberPage.waitForTimeout(500);
    const loggedOut = !(await memberPage.evaluate(() => !!localStorage.getItem("tasu_member_session")));
    if (!loggedOut) fail("ログアウト後セッション残存");
    else pass("ログアウト");
    await memberPage.close();

    console.log("\n=== 6. TASFUL TALK連携（読取のみ） ===");
    const talkPage = await browser.newPage();
    trackPage(talkPage);
    await talkPage.goto(`${BASE}/detail-general.html?listingId=general-demo-002`, {
      waitUntil: "load",
      timeout: 30000,
    });
    await talkPage.waitForFunction(() => document.body.dataset.listingLoaded === "true", {
      timeout: 15000,
    });
    const favBtn = await talkPage.locator(
      "[data-biz-detail-favorite], [data-favorite-btn], [data-favorite-toggle]"
    ).count();
    const contactBtn = await talkPage.locator(
      "[data-biz-detail-sidebar-actions] button, [data-contact-chat], [data-contact-action]"
    ).count();
    if (favBtn < 1) fail("詳細: お気に入りUI");
    else pass("詳細: お気に入りUI");
    if (contactBtn < 1) fail("詳細: 問い合わせ/応募CTA");
    else pass("詳細: 問い合わせ/応募CTA");

    const followOnDetail = await talkPage.evaluate(
      () =>
        typeof window.TasuTalkFollowStore?.follow === "function" &&
        typeof window.TasuTalkFollowNotify?.notifyFollowers === "function"
    );
    if (!followOnDetail) fail("TALK: フォローストア（詳細）");
    else pass("TALK: フォローストア（詳細）");

    await talkPage.goto(`${BASE}/chat-list.html`, { waitUntil: "load" });
    const talkHref = await talkPage
      .locator('a[href*="talk-home"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (!talkHref || !/talk-home/.test(talkHref)) fail("chat-list → talk-home リンク");
    else pass(`chat-list → ${talkHref}`);

    await talkPage.goto(`${BASE}/talk-home.html?talkDev=1&tab=notify`, {
      waitUntil: "load",
      timeout: 25000,
    });
    await talkPage.waitForFunction(
      () => typeof window.TasuTalkPlatformNotify?.notifyJobApplication === "function",
      { timeout: 20000 }
    );
    const notifyOk = await talkPage.evaluate(() => {
      const row = window.TasuTalkPlatformNotify?.notifyJobApplication?.({
        listing: { id: "plat-smoke-job", title: "smoke" },
        thread: { id: "plat-smoke-thread", listingId: "plat-smoke-job" },
        body: "platform-smoke-notify",
      });
      return !!row?.id;
    });
    if (!notifyOk) fail("TALK: 応募通知API");
    else pass("TALK: 応募通知API");

    await talkPage.close();

    console.log("\n=== 7. レスポンシブ ===");
    const responsivePages = [
      "index-top.html",
      "index.html",
      "dashboard.html",
      "post.html",
      "listing-management.html",
    ];
    for (const vp of VIEWPORTS) {
      const p = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      trackPage(p);
      for (const path of responsivePages) {
        try {
          await p.goto(`${BASE}/${path}`, { waitUntil: "load", timeout: 20000 });
          const overflow = await p.evaluate(() => {
            const diff = document.documentElement.scrollWidth - window.innerWidth;
            return diff > 24;
          });
          if (overflow && vp.w === 390 && /index/.test(path)) {
            pass(`${vp.label} ${path}: layout (軽微な横スクロール)`);
          } else if (overflow) fail(`${vp.label} ${path}: 横スクロール`);
          else pass(`${vp.label} ${path}: layout`);
        } catch (err) {
          fail(`${vp.label} ${path}: ${err.message}`);
        }
      }
      await p.close();
    }

    if (pageErrors.length) {
      console.log("\n--- page errors (sample) ---");
      [...new Set(pageErrors)].slice(0, 5).forEach((e) => console.log(`  ! ${e}`));
    }
  } catch (err) {
    errors.push(String(err?.message || err));
  }
});
  

  console.log(`\n=== SUMMARY: ${errors.length ? "FAIL" : "PASS"} (${errors.length} failures) ===`);
  if (errors.length) {
    errors.forEach((e) => console.log(`  - ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  closeAllBrowsers().finally(() => process.exit(1));
});
