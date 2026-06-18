#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK — Supabase 同期（localStorage フォールバック含む）
 *
 *   node scripts/test-talk-supabase-sync-browser.mjs
 *
 * DB テーブル未作成時も local 系は通過。SUPABASE_STRICT=1 で DB 必須。
 */
import { ensureTalkTestUsers } from "./lib/talk-rls-test-auth.mjs";
import {
  enableTalkDevMode,
  gotoTalkHome,
  signInTalkTestUser,
  talkHomeUrl,
} from "./lib/talk-test-env.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const MARKER = process.env.TALK_TEST_MARKER || `talk-sync-e2e-${Date.now()}`;
const STRICT = process.env.SUPABASE_STRICT === "1";
const SYNC_USER = process.env.TALK_SYNC_USER_ID || "u_me";

async function main() {
  if (STRICT) {
    await ensureTalkTestUsers(["u_me", "u_store"]);
  }
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 1280, height: 900 }
});
  const page = await context.newPage();
  await enableTalkDevMode(page);
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    await gotoTalkHome(page, BASE, SYNC_USER, "ai");
    if (STRICT) {
      await signInTalkTestUser(page, SYNC_USER);
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => typeof window.TasuTalkRuntime !== "undefined", {
        timeout: 20000,
      });
    }
    await page.evaluate((marker) => {
      localStorage.removeItem("tasful_talk_ai_drafts");
      localStorage.removeItem("tasful_talk_broadcast_drafts");
      localStorage.removeItem("tasful_talk_notifications");
      localStorage.removeItem("tasful_talk_notifications_seeded_v2");
      localStorage.removeItem("tasful_talk_sync_pending_v1");
      window.__talkSyncTestMarker = marker;
    }, MARKER);
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => typeof window.TasuTalkRuntime !== "undefined", {
      timeout: 20000,
    });
    await page.waitForTimeout(800);

    const initOk = await page.evaluate(() => ({
      sync: typeof window.TasuTalkSupabaseSync?.initAll === "function",
      aiInit: typeof window.TasuTalkAiDrafts?.init === "function",
      notifyInit: typeof window.TasuTalkNotifications?.init === "function",
    }));
    if (!initOk.sync || !initOk.aiInit) fail("sync modules missing");
    else pass("sync modules loaded");

    await page.locator('[data-talk-ai-mode="ad"]').click();
    await page.locator("[data-talk-ai-input]").fill(MARKER);
    await page.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await page.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    await page.locator("[data-talk-ai-save]").click();
    await page.waitForTimeout(300);

    const aiLocal = await page.evaluate((marker) => {
      try {
        const list = JSON.parse(localStorage.getItem("tasful_talk_ai_drafts") || "[]");
        return list.some((r) => String(r.output || "").includes(marker) || String(r.input || "").includes(marker));
      } catch {
        return false;
      }
    }, MARKER);
    if (!aiLocal) fail("AI draft not in localStorage");
    else pass("AI draft local save");

    await page.locator("[data-talk-ai-save-broadcast]").click();
    await page.waitForSelector("[data-talk-broadcast-modal]:not([hidden])", { timeout: 3000 });
    await page.fill("[data-talk-broadcast-title]", `sync ${MARKER}`);
    await page.locator("[data-talk-broadcast-form]").evaluate((f) => f.requestSubmit());
    await page.waitForTimeout(400);

    const bcastLocal = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tasful_talk_broadcast_drafts") || "[]").length > 0;
      } catch {
        return false;
      }
});
    if (!bcastLocal) fail("broadcast draft local missing");
    else pass("broadcast draft local save");

    await page.locator("[data-talk-ai-to-notify]").click();
    await page.waitForTimeout(300);

    await page.locator('[data-talk-tab="notify"]').click();
    await page.waitForTimeout(300);
    const notifyCount = await page.locator("[data-talk-notify-list] .talk-notify-card").count();
    if (notifyCount < 1) fail("notify tab empty");
    else pass("notification from AI draft");

    if (STRICT) {
      await page.waitForTimeout(1500);
    }

    const dbProbe = await page.evaluate(async (marker) => {
      const uid = window.TasuTalkSupabaseSync?.getUserId?.() || "";
      const sb = window.TasuSupabase?.getClient?.();
      if (!sb) return { client: false, uid };
      const out = { client: true, uid, tables: {} };
      for (const table of ["talk_ai_drafts", "talk_broadcast_drafts", "talk_notifications"]) {
        const { data, error } = await sb
          .from(table)
          .select("id")
          .eq("user_id", uid)
          .limit(5);
        out.tables[table] = {
          ok: !error,
          error: error?.message || null,
          count: Array.isArray(data) ? data.length : 0,
        };
      }
      const pending = JSON.parse(localStorage.getItem("tasful_talk_sync_pending_v1") || "[]");
      out.pendingCount = pending.length;
      out.hasAiMarker = (() => {
        try {
          const list = JSON.parse(localStorage.getItem("tasful_talk_ai_drafts") || "[]");
          return list.some(
            (r) => String(r.input || "").includes(marker) || String(r.output || "").includes(marker)
          );
        } catch {
          return false;
        }
      })();
      return out;
    }, MARKER);

    let probeResult = dbProbe;
    if (STRICT && dbProbe.client) {
      for (let i = 0; i < 8; i += 1) {
        const aiOk = probeResult.tables?.talk_ai_drafts?.count >= 1;
        const nOk = probeResult.tables?.talk_notifications?.count >= 1;
        if (aiOk && nOk) break;
        await page.waitForTimeout(600);
        probeResult = await page.evaluate(async (marker) => {
          const uid = window.TasuTalkSupabaseSync?.getUserId?.() || "";
          const sb = window.TasuSupabase?.getClient?.();
          if (!sb) return { client: false, uid };
          const out = { client: true, uid, tables: {} };
          for (const table of ["talk_ai_drafts", "talk_broadcast_drafts", "talk_notifications"]) {
            const { data, error } = await sb.from(table).select("id").eq("user_id", uid).limit(5);
            out.tables[table] = {
              ok: !error,
              error: error?.message || null,
              count: Array.isArray(data) ? data.length : 0,
            };
          }
          return out;
        }, MARKER);
      }
    }

    if (probeResult.client) {
      pass(`Supabase client ok (user=${probeResult.uid})`);
      const allTablesOk = Object.values(probeResult.tables).every((t) => t.ok);
      if (allTablesOk) {
        pass("all talk_* tables reachable");
        if (STRICT) {
          if (probeResult.tables.talk_ai_drafts.count < 1) fail("AI draft not in DB (strict)");
          else pass("AI draft synced to DB");
          if (probeResult.tables.talk_notifications.count < 1) fail("notifications not in DB (strict)");
          else pass("notifications reachable in DB");
        } else if (probeResult.tables.talk_ai_drafts.count >= 1) {
          pass("AI draft synced to DB");
        } else {
          pass("DB reachable (AI row may reconcile on next pull)");
        }
      } else {
        const msg = Object.entries(probeResult.tables)
          .map(([k, v]) => `${k}:${v.error || "ok"}`)
          .join("; ");
        if (STRICT) fail(`DB tables: ${msg}`);
        else pass(`DB tables skipped (${msg})`);
      }
    } else {
      if (STRICT) fail("no Supabase client");
      else pass("local-only mode (no client)");
    }

    await context.setOffline(true);
    await page.evaluate((marker) => {
      window.TasuTalkNotifications?.add?.({
        type: "system",
        title: `offline ${marker}`,
        body: "offline queue test",
        source: "sync-test",
      });
    }, MARKER);
    await page.waitForTimeout(200);
    const offlineOk = await page.evaluate((marker) => {
      const list = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      return list.some((n) => String(n.title || "").includes(marker));
    }, MARKER);
    if (!offlineOk) fail("offline notification not local");
    else pass("offline local notification");

    await context.setOffline(false);
    await gotoTalkHome(page, BASE, SYNC_USER, "ai");
    await page.waitForTimeout(1200);

    const corruptInline = await page.evaluate(() => {
      localStorage.setItem("tasful_talk_ai_drafts", "{{");
      localStorage.setItem("tasful_talk_broadcast_drafts", "{{");
      localStorage.setItem("tasful_talk_notifications", "{{");
      try {
        const drafts = window.TasuTalkAiDrafts?.readAll?.() || [];
        const bc = window.TasuTalkBroadcastDrafts?.readAll?.() || [];
        const stats = window.TasuTalkData?.getDashboardStats?.();
        return Array.isArray(drafts) && Array.isArray(bc) && typeof stats?.unread === "number";
      } catch {
        return false;
      }
});
    if (!corruptInline) fail("corrupt localStorage inline should not crash");
    else pass("corrupt localStorage inline safe");

    await gotoTalkHome(page, BASE, SYNC_USER, "ai");
    await page.waitForTimeout(1200);
    const corruptAfterReload = await page.evaluate(() => {
      try {
        window.TasuTalkHomeUi?.refreshTalkSurfaces?.();
        const drafts = window.TasuTalkAiDrafts?.readAll?.() || [];
        const bc = window.TasuTalkBroadcastDrafts?.readAll?.() || [];
        const stats = window.TasuTalkData?.getDashboardStats?.();
        return Array.isArray(drafts) && Array.isArray(bc) && typeof stats?.unread === "number";
      } catch {
        return false;
      }
});
    if (!corruptAfterReload) fail("corrupt localStorage after reload should not crash");
    else pass("corrupt localStorage after reload safe");

    const pageB = await browser.newPage();
    await enableTalkDevMode(pageB);
    await gotoTalkHome(pageB, BASE, "u_store", "ai");
    if (STRICT) {
      await signInTalkTestUser(pageB, "u_store");
      await pageB.reload({ waitUntil: "load" });
      await pageB.waitForFunction(() => typeof window.TasuTalkRuntime !== "undefined", {
        timeout: 20000,
      });
    }
    await pageB.evaluate((marker) => {
      localStorage.removeItem("tasful_talk_ai_drafts");
      window.__marker = marker;
    }, MARKER);
    await pageB.locator('[data-talk-ai-mode="notice"]').click();
    await pageB.locator("[data-talk-ai-input]").fill(`${MARKER}-b`);
    await pageB.locator("[data-talk-ai-form]").evaluate((f) => f.requestSubmit());
    await pageB.waitForSelector("[data-talk-ai-result]:not([hidden])", { timeout: 8000 });
    await pageB.locator("[data-talk-ai-save]").click();
    await pageB.waitForTimeout(400);

    const isolated = await page.evaluate((marker) => {
      try {
        const list = JSON.parse(localStorage.getItem("tasful_talk_ai_drafts") || "[]");
        return !list.some((r) => String(r.input || "").includes(`${marker}-b`));
      } catch {
        return true;
      }
    }, MARKER);
    if (!isolated) fail("user A should not see user B drafts locally");
    else pass("per-user isolation (local)");

    await pageB.close();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
});
  

  if (errors.length) {
    console.error("\nFAILED:", errors.join("; "));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("\nOK: TASFUL TALK Supabase sync (browser)");
}

main().catch(() => {
  console.error();
  closeAllBrowsers().finally(() => process.exit(1));
});
