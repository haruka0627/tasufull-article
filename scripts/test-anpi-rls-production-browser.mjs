#!/usr/bin/env node
/**
 * 安否 本番 RLS 前提 — ブラウザガード E2E（P9-5）
 *
 *   node scripts/test-anpi-rls-production-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const ADMIN_PAGE = "/anpi-line-admin.html?anpi_admin=1";

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function gotoRegister(page) {
  await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiRls?.getProductionReadiness &&
          window.TasuAnpiIdentity?.resolveCurrentMemberId
      ),
    { timeout: 15000 }
  );
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} (${vp.width}) ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      window.__ANPI_PRODUCTION_RLS__ = true;
      localStorage.removeItem("tasu_anpi_context_supabase_mock_v1");
      localStorage.removeItem("tasu_anpi_notification_logs_supabase_mock_v1");
      localStorage.removeItem("tasu_anpi_rls_mock_enforce_v1");
      localStorage.setItem("tasu_anpi_production_rls_v1", "1");
    });

    await gotoRegister(page);

    const memberResolved = await page.evaluate(() => {
      const mid =
        window.TasuAnpiIdentity?.resolveCurrentMemberId?.() ||
        window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
        "";
      return { member_id: mid, production: window.TasuAnpiRls?.isProductionRlsMode?.() };
    });
    if (memberResolved.member_id) {
      pass(`${vp.name}: member_id 解決`, memberResolved.member_id);
    } else fail(`${vp.name}: member_id 解決`);
    if (memberResolved.production) pass(`${vp.name}: 本番RLSモード`);
    else fail(`${vp.name}: 本番RLSモード`);

    const unauth = await page.evaluate(async () => {
      localStorage.removeItem("tasu_member_session");
      for (const k of Object.keys(localStorage)) {
        if (k.includes("supabase") && k.includes("auth")) localStorage.removeItem(k);
      }
      const readiness = window.TasuAnpiRls.getProductionReadiness();
      const skip = window.TasuAnpiRls.shouldSkipSupabaseWrite("test.unauth");
      const upsert = await window.TasuAnpiUserContextSupabase.upsertAnpiUserContext({
        user_id: "anpi_prod_guard_test",
        is_anpi_user: true,
        user_name: "未ログイン",
        contract_holder_id: "x",
        contract_holder_name: "x",
        contract_holder_relation: "本人",
        contract_holder_email: "x@example.com",
        contract_holder_phone_masked: "03-***-1111",
        user_phone_masked: "09-***-1111",
        notify_channels: ["tasful_chat"],
        notification_level: "call_only",
        contract_holder_contact_method: "tasful_chat",
        line_notification_enabled: false,
        consent: {
          no_auto_execution: true,
          self_confirm_required: true,
          tasful_no_guarantee: true,
          emergency_contact_required: true,
          agreed_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const local = JSON.parse(
        localStorage.getItem("tasu_anpi_user_context_v1") || "null"
      );
      return { readiness, skip, upsert, hasLocal: Boolean(local) };
    });

    if (unauth.skip && unauth.upsert?.skipped) {
      pass(`${vp.name}: 未ログイン Supabase skip`);
    } else fail(`${vp.name}: 未ログイン Supabase skip`, JSON.stringify(unauth.upsert));

    if (unauth.readiness?.context_save_mode === "localStorage") {
      pass(`${vp.name}: context save mode localStorage`);
    } else fail(`${vp.name}: context save mode localStorage`, unauth.readiness?.context_save_mode);

    if (unauth.readiness?.supabase_sync_paused) {
      pass(`${vp.name}: DB同期停止表示データ`);
    } else fail(`${vp.name}: DB同期停止表示データ`);

    await page.evaluate(() => {
      window.TasuAnpiRls.notifyUnauthorized("e2e.test", { reason: "browser" });
    });
    const alertVisible = await page.locator("[data-anpi-rls-error]").isVisible();
    if (alertVisible) pass(`${vp.name}: unauthorized 赤アラート`);
    else fail(`${vp.name}: unauthorized 赤アラート`);

    await page.goto(`${BASE}${ADMIN_PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.TasuMemberAuth?.establishLocalSession), {
      timeout: 15000,
    });
    await page.evaluate(() => {
      localStorage.setItem("tasu_anpi_line_admin_v1", "1");
      window.TasuMemberAuth.establishLocalSession({
        id: "u_me",
        email: "prod-test@example.com",
        signedInAt: new Date().toISOString(),
      });
    });
    await page.waitForFunction(() => Boolean(window.TasuAnpiLineAdmin?.renderAdminPage), {
      timeout: 15000,
    });
    await page.evaluate(() => {
      localStorage.setItem("tasu_anpi_line_admin_v1", "1");
      return window.TasuAnpiLineAdmin.renderAdminPage("[data-anpi-line-admin-root]");
    });

    const adminHtml = await page.content();
    if (adminHtml.includes("Supabase Production Readiness")) {
      pass(`${vp.name}: Production Readiness セクション`);
    } else fail(`${vp.name}: Production Readiness セクション`);

    if (
      adminHtml.includes("admin UI flag") &&
      adminHtml.includes("admin DB role") &&
      adminHtml.includes("UIのみ")
    ) {
      pass(`${vp.name}: 管理者 UI / DB 別表示`);
    } else fail(`${vp.name}: 管理者 UI / DB 別表示`);

    if (adminHtml.includes("本番移行チェックリスト")) {
      pass(`${vp.name}: チェックリストリンク`);
    } else fail(`${vp.name}: チェックリストリンク`);

    const loggedIn = await page.evaluate(() => {
      const r = window.TasuAnpiRls.getProductionReadiness();
      return {
        authenticated: r.authenticated,
        context_save_mode: r.context_save_mode,
        member_id: r.current_member_id,
      };
    });
    if (loggedIn.authenticated && loggedIn.member_id) {
      pass(`${vp.name}: ログイン後 member_id / authenticated`, loggedIn.member_id);
    } else fail(`${vp.name}: ログイン後 member_id / authenticated`, JSON.stringify(loggedIn));

    if (loggedIn.authenticated && loggedIn.context_save_mode === "supabase") {
      pass(`${vp.name}: ログイン後 context save mode supabase`);
    } else if (loggedIn.authenticated) {
      pass(`${vp.name}: ログイン後 save mode`, loggedIn.context_save_mode);
    } else {
      fail(`${vp.name}: ログイン後 save mode`, loggedIn.context_save_mode);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`\n安否 本番RLS ブラウザ E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {await runViewport(browser, { name: "PC", width: 1280, height: 900 });
  await runViewport(browser, { name: "SP", width: 390, height: 844 });
    });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

await closeAllBrowsers();
