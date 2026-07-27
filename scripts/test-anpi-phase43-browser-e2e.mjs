/**
 * ANPI Phase 43 — browser E2E with local mock (no staging writes).
 * Requires: npm run dev on http://127.0.0.1:8788
 * Run: node scripts/test-anpi-phase43-browser-e2e.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPathFile = path.join(process.env.TEMP || "/tmp", "anpi43-report-path.txt");
const report =
  (fs.existsSync(reportPathFile) && fs.readFileSync(reportPathFile, "utf8").trim()) ||
  path.join(process.env.HOME || process.env.USERPROFILE || ".", "tasful-dry-run-reports", "anpi-phase43-local");

const BASE = process.env.ANPI_PHASE43_BASE || "http://127.0.0.1:8788";
const results = [];
const consoleErrors = [];

function record(name, ok, detail = {}) {
  results.push({ name, ok, ...detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail.error ? " :: " + detail.error : ""}`);
}

const mockBootstrap = `
window.__ANPI_RPC_MOCK__ = (function () {
  const KEY = "anpi_phase43_mock_state_v1";
  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null") || { settings: null, contacts: [], check: null }; }
    catch { return { settings: null, contacts: [], check: null }; }
  }
  function save(state) {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }
  let state = load();
  return {
    async rpc(name, args) {
      state = load();
      if (name === "anpi_get_my_settings") return { ok: true, data: state.settings };
      if (name === "anpi_upsert_my_settings") {
        state.settings = {
          id: "s-mock",
          owner_user_id: "a",
          subject_user_id: "a",
          enabled: args.p_enabled,
          schedule_type: args.p_schedule_type,
          weekdays: args.p_weekdays,
          initial_notification_time: args.p_initial_notification_time,
          reminder_count: args.p_reminder_count,
          contact_notify_after: args.p_contact_notify_after || "02:00:00",
        };
        save(state);
        return { ok: true, data: state.settings };
      }
      if (name === "anpi_phase5_list_my_emergency_contacts") {
        return { ok: true, data: (state.contacts || []).filter(c => c.status !== "revoked") };
      }
      if (name === "anpi_phase5_upsert_emergency_contact") {
        if ((state.contacts || []).some(c => c.contact_user_id === args.p_contact_user_id && c.status !== "revoked")) {
          return { ok: false, error: { message: "anpi_contact_duplicate", status: 409 } };
        }
        const row = {
          contact_id: "c-" + ((state.contacts || []).length + 1),
          contact_user_id: args.p_contact_user_id,
          relationship: args.p_relationship,
          priority: args.p_priority,
          status: "pending",
          consent_status: "unknown",
          paused_at: null,
        };
        state.contacts = (state.contacts || []).concat([row]);
        save(state);
        return { ok: true, data: row };
      }
      if (name === "anpi_phase5_set_contact_paused") {
        const c = (state.contacts || []).find(x => x.contact_id === args.p_contact_id);
        if (!c) return { ok: false, error: { message: "anpi_contact_not_accessible", status: 403 } };
        c.paused_at = args.p_paused ? new Date().toISOString() : null;
        save(state);
        return { ok: true, data: { contact_id: c.contact_id, paused_at: c.paused_at } };
      }
      if (name === "anpi_revoke_contact") {
        const c = (state.contacts || []).find(x => x.contact_id === args.p_contact_id);
        if (!c) return { ok: false, error: { message: "anpi_contact_not_revokeable", status: 403 } };
        c.status = "revoked";
        save(state);
        return { ok: true, data: true };
      }
      if (name === "anpi_get_my_today_check") return { ok: true, data: state.check };
      if (name === "anpi_ensure_my_today_check") {
        if (!state.settings) return { ok: true, data: { created: false, skipped_reason: "anpi_setting_missing" } };
        if (!state.check) {
          state.check = { id: "chk-1", check_id: "chk-1", status: "scheduled", local_check_date: "2026-07-27", created: true };
          save(state);
          return { ok: true, data: { check_id: "chk-1", status: "scheduled", local_check_date: "2026-07-27", created: true } };
        }
        return { ok: true, data: { check_id: state.check.id, status: state.check.status, local_check_date: state.check.local_check_date, created: false } };
      }
      if (name === "anpi_confirm_check") {
        if (!state.check || state.check.id !== args.p_check_id) {
          return { ok: false, error: { message: "anpi_check_not_accessible", status: 403 } };
        }
        if (state.check.status === "confirmed") {
          return { ok: true, data: { check_id: state.check.id, status: "confirmed", confirmed_at: state.check.confirmed_at, local_check_date: state.check.local_check_date, duplicate: true } };
        }
        state.check.status = "confirmed";
        state.check.confirmed_at = new Date().toISOString();
        save(state);
        return { ok: true, data: { check_id: state.check.id, status: "confirmed", confirmed_at: state.check.confirmed_at, local_check_date: state.check.local_check_date, duplicate: false } };
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
          return { data: { session: { access_token: "mock-token", user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } } }, error: null };
        },
      },
      rpc() { throw new Error("real rpc must not be called when mock is set"); },
    };
  },
};
`;

async function main() {
  fs.mkdirSync(path.join(report, "screenshots", "desktop"), { recursive: true });
  fs.mkdirSync(path.join(report, "screenshots", "mobile"), { recursive: true });

  const health = await fetch(BASE + "/anpi-register.html").then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    record("dev_server", false, { error: `BASE ${BASE} returned ${health}` });
    fs.writeFileSync(path.join(report, "browser-results.json"), JSON.stringify({ results, blocked: "BLOCKED_BROWSER_E2E" }, null, 2));
    process.exit(2);
  }
  record("dev_server", true, { status: health });

  const browser = await chromium.launch({ headless: true });
  const network = [];

  async function withPage(viewport, fn) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(mockBootstrap);
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("request", (req) => {
      const url = req.url();
      if (/supabase\.co|line\.me|googleapis|hooks\.slack/i.test(url)) network.push(url);
    });
    try {
      await fn(page);
    } finally {
      await context.close();
    }
  }

  await withPage({ width: 1440, height: 900 }, async (page) => {
    await page.goto(BASE + "/anpi-register.html", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(report, "screenshots", "desktop", "01-register.png"), fullPage: true });

    const authHidden = await page.locator("[data-anpi-auth-gate]").isHidden();
    record("desktop_auth_pass_gate", authHidden);

    await page.locator("[data-anpi-submit]").click();
    await page.waitForTimeout(300);
    const successVisible = await page.locator("[data-anpi-register-success]").isVisible();
    record("desktop_register_save", successVisible);

    await page.locator("[data-anpi-submit]").click();
    await page.waitForTimeout(300);
    record("desktop_register_idempotent", await page.locator("[data-anpi-register-success]").isVisible());

    await page.fill("#anpiNotifyTime", "09:15");
    await page.locator("[data-anpi-submit]").click();
    await page.waitForTimeout(300);
    record("desktop_settings_update", (await page.inputValue("#anpiNotifyTime")) === "09:15");

    await page.fill("#anpiContactUserId", "11111111-1111-4111-8111-111111111111");
    await page.locator("[data-anpi-contact-add]").click();
    await page.waitForTimeout(300);
    record("desktop_contact_add", (await page.locator(".anpi-contacts-item").count()) >= 1);

    await page.locator("[data-anpi-contact-pause]").first().click();
    await page.waitForTimeout(200);
    record("desktop_contact_edit_pause", /一時停止中|再開/.test((await page.locator(".anpi-contacts-item").innerText()) || ""));

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-anpi-contact-revoke]").first().click();
    await page.waitForTimeout(300);
    record("desktop_contact_delete", (await page.locator(".anpi-contacts-item").count()) === 0);

    record("desktop_no_owner_input", (await page.locator('[name="owner_user_id"]').count()) === 0);

    // Same mock state (same browser context) → dashboard
    await page.goto(BASE + "/anpi-dashboard.html", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(report, "screenshots", "desktop", "02-dashboard.png"), fullPage: true });
    record("desktop_today_panel", await page.locator("[data-anpi-today-panel]").isVisible());

    const confirm = page.locator("[data-anpi-confirm-btn]");
    await confirm.click();
    await page.waitForTimeout(300);
    const feedback1 = await page.locator("[data-anpi-confirm-feedback]").textContent();
    record("desktop_confirm", /受け付け|確認済み/.test(feedback1 || ""));

    const disabledAfter = await confirm.isDisabled();
    record("desktop_confirm_repeat", disabledAfter === true);
    // Force a second RPC path via evaluate to verify idempotent alreadyConfirmed
    const second = await page.evaluate(async () => {
      const id = "chk-1";
      const res = await window.TasuAnpiRpc.confirmCheck(id);
      return { ok: res.ok, already: !!res.alreadyConfirmed, status: res.data?.status };
    });
    record("desktop_confirm_idempotent_rpc", second.ok && (second.already || second.status === "confirmed"));

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    record("desktop_reload_confirmed", /確認済み/.test((await page.locator("[data-anpi-today-badge]").textContent()) || ""));
  });

  await withPage({ width: 390, height: 844 }, async (page) => {
    await page.goto(BASE + "/anpi-register.html", { waitUntil: "networkidle" });
    await page.locator("[data-anpi-submit]").click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(report, "screenshots", "mobile", "01-register.png"), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    record("mobile_no_overflow", !overflow);
    record("mobile_submit_visible", await page.locator("[data-anpi-submit]").isVisible());

    await page.goto(BASE + "/anpi-dashboard.html", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(report, "screenshots", "mobile", "02-dashboard.png"), fullPage: true });
    record("mobile_confirm_visible", await page.locator("[data-anpi-confirm-btn]").isVisible());
  });

  // Unauthenticated page
  await withPage({ width: 1280, height: 800 }, async (page) => {
    await page.addInitScript(() => {
      window.__ANPI_RPC_MOCK__ = {
        unauthenticated: true,
        async rpc() {
          return { ok: false, error: { message: "anpi_auth_required", status: 401 } };
        },
      };
    });
    await page.goto(BASE + "/anpi-register.html", { waitUntil: "networkidle" });
    record("unauthenticated_gate", await page.locator("[data-anpi-auth-gate]").isVisible());
  });

  await browser.close();

  const external = network.filter((u) => !u.includes("127.0.0.1") && !u.includes("cdn.jsdelivr.net") && !u.includes("fonts.googleapis.com") && !u.includes("fonts.gstatic.com") && !u.includes("placehold.co"));
  record("no_supabase_remote_in_mock_flow", !network.some((u) => /supabase\.co/.test(u)));
  record("no_line_external", !network.some((u) => /line\.me/.test(u)));
  record("console_errors_zero", consoleErrors.length === 0, { count: consoleErrors.length, sample: consoleErrors.slice(0, 5) });

  const summary = {
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    results,
    consoleErrors,
    networkSample: network.slice(0, 20),
    externalDenied: external.slice(0, 10),
  };
  fs.writeFileSync(path.join(report, "browser-results.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(report, "console-errors.txt"), consoleErrors.join("\n") || "(none)");
  fs.writeFileSync(
    path.join(report, "network-summary.json"),
    JSON.stringify({ total: network.length, supabase_co: network.filter((u) => /supabase\.co/.test(u)).length, line: 0, sample: network.slice(0, 30) }, null, 2)
  );

  console.log(`\nBROWSER PASS=${summary.pass} FAIL=${summary.fail}`);
  if (summary.fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
