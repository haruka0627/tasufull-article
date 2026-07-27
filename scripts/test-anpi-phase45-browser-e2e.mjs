/**
 * ANPI Phase 45 — notifications browser E2E with local mock (no staging writes).
 * Requires: npm run dev on http://127.0.0.1:8788
 * Run: node scripts/test-anpi-phase45-browser-e2e.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPathFile = path.join(process.env.TEMP || "/tmp", "anpi45-report-path.txt");
const report =
  (fs.existsSync(reportPathFile) && fs.readFileSync(reportPathFile, "utf8").trim()) ||
  path.join(process.env.HOME || process.env.USERPROFILE || ".", "tasful-dry-run-reports", "anpi-phase45-local");

const BASE = process.env.ANPI_PHASE45_BASE || "http://127.0.0.1:8788";
const results = [];
const consoleErrors = [];
const networkLog = [];

function record(name, ok, detail = {}) {
  results.push({ name, ok, ...detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail.error ? " :: " + detail.error : ""}`);
}

function historyMockBootstrap(options = {}) {
  const mode = options.mode || "multi";
  const unauth = options.unauthenticated === true;
  const networkFail = options.networkFail === true;
  const userId = options.userId || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return `
window.__ANPI_PHASE45_MODE = ${JSON.stringify(mode)};
window.__ANPI_RPC_MOCK__ = (function () {
  const unauth = ${unauth ? "true" : "false"};
  const networkFail = ${networkFail ? "true" : "false"};
  const mode = ${JSON.stringify(mode)};
  const userId = ${JSON.stringify(userId)};
  const rowsByMode = {
    empty: [],
    multi: [
      { check_id: "h1", local_check_date: "2026-07-27", status: "confirmed_late", scheduled_at: "2026-07-27T00:00:00Z", confirmed_at: "2026-07-27T05:00:00Z", confirmation_source: "anpi_ui" },
      { check_id: "h2", local_check_date: "2026-07-26", status: "confirmed", scheduled_at: "2026-07-26T00:00:00Z", confirmed_at: "2026-07-26T01:00:00Z", confirmation_source: "talk" },
      { check_id: "h3", local_check_date: "2026-07-25", status: "contact_notified", scheduled_at: "2026-07-25T00:00:00Z", confirmed_at: null, confirmation_source: null },
      { check_id: "h4", local_check_date: "2026-07-24", status: "overdue", scheduled_at: "2026-07-24T00:00:00Z", confirmed_at: null, confirmation_source: null },
      { check_id: "h5", local_check_date: "2026-07-23", status: "reminded", scheduled_at: "2026-07-23T00:00:00Z", confirmed_at: null, confirmation_source: null },
      { check_id: "h6", local_check_date: "2026-07-22", status: "scheduled", scheduled_at: "2026-07-22T00:00:00Z", confirmed_at: null, confirmation_source: null }
    ],
    scheduled: [
      { check_id: "s1", local_check_date: "2026-07-27", status: "scheduled", scheduled_at: "2026-07-27T00:00:00Z", confirmed_at: null, confirmation_source: null }
    ]
  };
  const todayByMode = {
    empty: null,
    multi: { id: "today-1", local_check_date: "2026-07-27", status: "confirmed_late", scheduled_at: "2026-07-27T00:00:00Z", confirmed_at: "2026-07-27T05:00:00Z" },
    scheduled: { id: "today-s", local_check_date: "2026-07-27", status: "scheduled", scheduled_at: "2026-07-27T00:00:00Z", confirmed_at: null }
  };
  return {
    unauthenticated: unauth,
    async rpc(name) {
      if (unauth) return { ok: false, error: { message: "anpi_auth_required", status: 401 } };
      if (networkFail) return { ok: false, error: { message: "Failed to fetch" } };
      if (name === "anpi_get_my_today_check") return { ok: true, data: todayByMode[mode] || null };
      if (name === "anpi_list_my_check_history") return { ok: true, data: rowsByMode[mode] || [] };
      if (name === "anpi_ensure_my_today_check") {
        return { ok: false, error: { message: "ensure must not be called from notifications", status: 500 } };
      }
      return { ok: false, error: { message: "unknown rpc " + name, status: 404 } };
    }
  };
})();
window.TasuSupabase = {
  getClient() {
    return {
      auth: {
        async getSession() {
          if (${unauth ? "true" : "false"}) return { data: { session: null }, error: null };
          return { data: { session: { access_token: "mock-token", user: { id: ${JSON.stringify(userId)} } } }, error: null };
        },
      },
      rpc() { throw new Error("real rpc must not be called when mock is set"); },
      from() { throw new Error("legacy from() must not be called"); },
    };
  },
};
`;
}

async function main() {
  fs.mkdirSync(path.join(report, "screenshots", "desktop"), { recursive: true });
  fs.mkdirSync(path.join(report, "screenshots", "mobile"), { recursive: true });

  const assets = [
    "/anpi-notifications.html",
    "/anpi-notifications.js",
    "/anpi-notifications.css",
    "/anpi-rpc-client.js",
  ];
  for (const a of assets) {
    const st = await fetch(BASE + a).then((r) => r.status).catch(() => 0);
    record(`http_${a.replace(/^\//, "").replace(/\./g, "_")}`, st === 200, { status: st });
  }
  if (results.some((r) => !r.ok)) {
    fs.writeFileSync(
      path.join(report, "browser-results.json"),
      JSON.stringify({ results, blocked: "BLOCKED_BROWSER_E2E" }, null, 2)
    );
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });

  async function withPage(viewport, init, fn) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(init);
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("request", (req) => {
      const url = req.url();
      networkLog.push({ url, method: req.method() });
    });
    try {
      await fn(page);
    } finally {
      await context.close();
    }
  }

  // Unauthenticated
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ unauthenticated: true }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const gate = await page.locator("[data-anpi-auth-gate]").isVisible();
    const listHidden = await page.locator("[data-anpi-history-section]").isHidden();
    record("unauthenticated_gate", gate && listHidden);
    await page.screenshot({ path: path.join(report, "screenshots", "desktop", "unauth.png"), fullPage: true });
  });

  // Empty history
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ mode: "empty" }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const empty = await page.locator("[data-anpi-empty]").isVisible();
    const items = await page.locator(".anpi-history-item").count();
    record("empty_history", empty && items === 0);
  });

  // Multi history + status labels
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ mode: "multi" }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const items = await page.locator(".anpi-history-item").count();
    const body = await page.locator("[data-anpi-history-list]").innerText();
    const today = await page.locator("[data-anpi-today-badge]").innerText();
    const ok =
      items === 6 &&
      body.includes("確認予定") &&
      body.includes("再通知済み") &&
      body.includes("確認待ち期限超過") &&
      body.includes("緊急連絡先へ未確認通知済み") &&
      body.includes("確認済み") &&
      body.includes("遅れて確認済み") &&
      today.includes("遅れて確認済み");
    record("multi_history_statuses", ok, { items, today });
    await page.screenshot({ path: path.join(report, "screenshots", "desktop", "multi.png"), fullPage: true });

    // Navigation: verify CTA hrefs + target pages resolve (avoid flaky full navigation under mock)
    const dashHref = await page.locator('[data-anpi-today-card] a[href="anpi-dashboard.html"]').count();
    const settingsHref = await page.locator('[data-anpi-today-card] a[href="anpi-register.html"]').count();
    record("nav_links_present", dashHref > 0 && settingsHref > 0, { dashHref, settingsHref });
    const dashStatus = await fetch(BASE + "/anpi-dashboard.html").then((r) => r.status).catch(() => 0);
    const regStatus = await fetch(BASE + "/anpi-register.html").then((r) => r.status).catch(() => 0);
    record("nav_to_dashboard", dashStatus === 200, { status: dashStatus });
    record("nav_to_settings", regStatus === 200, { status: regStatus });
  });

  // Network error
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ networkFail: true }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const errVisible = await page.locator("[data-anpi-page-errors]").isVisible();
    const errText = await page.locator("[data-anpi-page-errors]").innerText();
    record("network_error", errVisible && errText.includes("通信"));
  });

  // Expired / unauth mid-load style (unauthenticated flag)
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ unauthenticated: true }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const login = await page.locator('a[href="login.html"]').count();
    record("expired_session_login_cta", login > 0);
  });

  // User B isolation (mock only shows B data; no A rows)
  await withPage(
    { width: 1440, height: 900 },
    historyMockBootstrap({
      mode: "scheduled",
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }),
    async (page) => {
      await page.goto(BASE + "/anpi-notifications.html?owner=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(500);
      const text = await page.locator("[data-anpi-notifications-root]").innerText();
      record(
        "user_b_no_owner_override",
        text.includes("確認予定") && !text.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      );
    }
  );

  // Mobile viewport
  await withPage({ width: 390, height: 844 }, historyMockBootstrap({ mode: "multi" }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    const items = await page.locator(".anpi-history-item").count();
    record("mobile_layout", items === 6 && !overflow, { overflow, items });
    await page.screenshot({ path: path.join(report, "screenshots", "mobile", "multi.png"), fullPage: true });
  });

  // Desktop scheduled-only
  await withPage({ width: 1440, height: 900 }, historyMockBootstrap({ mode: "scheduled" }), async (page) => {
    await page.goto(BASE + "/anpi-notifications.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const badge = await page.locator("[data-anpi-today-badge]").innerText();
    record("scheduled_today", badge.includes("確認予定"));
  });

  // Legacy / LINE / ensure / production request checks
  const legacyHits = networkLog.filter(
    (n) =>
      /anpi_user_contexts|line\.me|api\.line|notification.?log|service_role/i.test(n.url) ||
      /ddojquacsyqesrjhcvmn/.test(n.url)
  );
  record("legacy_line_prod_network_0", legacyHits.length === 0, { hits: legacyHits.slice(0, 5) });

  const pageErrors = consoleErrors.filter((e) => !/favicon|fonts\.googleapis/i.test(e));
  record("uncaught_exception_0", pageErrors.length === 0, { errors: pageErrors.slice(0, 5) });

  // Static security scan of source files used by page
  const notifJs = fs.readFileSync(path.join(root, "anpi-notifications.js"), "utf8");
  record("no_ensure_on_notifications", !/ensureTodayCheck|anpi_ensure_my_today_check/.test(notifJs));
  record("no_legacy_table_in_notifications_js", !/anpi_user_contexts|line_user_id/.test(notifJs));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  const out = {
    total: results.length,
    pass: results.filter((r) => r.ok).length,
    fail: failed.length,
    results,
    consoleErrors: pageErrors,
    networkSample: networkLog.slice(0, 30),
  };
  fs.writeFileSync(path.join(report, "browser-results.json"), JSON.stringify(out, null, 2));
  console.log(`\n${out.pass}/${out.total} PASS`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
