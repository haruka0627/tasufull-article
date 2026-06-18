#!/usr/bin/env node
/**
 * 安否通知ログ — 実 Supabase DB 保存・復元確認（P9-2）
 *
 *   node scripts/verify-anpi-notification-logs-real-db.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_DEFAULT = "http://127.0.0.1:8765";
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const CTX_KEY = "tasu_anpi_user_context_v1";
const LOGS_KEY = "tasu_anpi_notification_logs_v1";
const TABLE = "anpi_notification_logs";

const USER_ID = "anpi_real_db_logs_verify";
const HOLDER_ID = "holder_real_db_logs_verify";

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

function loadSupabaseConfig() {
  const text = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
  const urlMatch = text.match(/url:\s*"(https:[^"]+)"/);
  const keyMatch = text.match(/anonKey:\s*"(eyJ[^"]+)"/);
  if (!urlMatch?.[1] || !keyMatch?.[1]) {
    throw new Error("chat-supabase-config.js から url / anonKey を読み取れません");
  }
  return { url: urlMatch[1].replace(/\/$/, ""), anonKey: keyMatch[1] };
}

async function supabaseRest(cfg, method, queryPath, body) {
  const res = await fetch(`${cfg.url}/rest/v1/${queryPath}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function deleteLogsForHolder(cfg, holderId) {
  const q = `${TABLE}?contract_holder_id=eq.${encodeURIComponent(holderId)}`;
  return supabaseRest(cfg, "DELETE", q);
}

async function fetchLogsForHolder(cfg, holderId) {
  const q = `${TABLE}?contract_holder_id=eq.${encodeURIComponent(holderId)}&select=*&order=created_at.desc`;
  const res = await supabaseRest(cfg, "GET", q);
  if (!res.ok) return { error: `HTTP ${res.status}: ${JSON.stringify(res.data)}` };
  return { rows: Array.isArray(res.data) ? res.data : [] };
}

async function ensureStaticServer(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/anpi-register.html`, { method: "HEAD" });
    if (res.ok) return null;
  } catch {
    /* start */
  }
  const port = Number(new URL(baseUrl).port || 8765);
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const rel = (req.url || "/").split("?")[0];
      const filePath = path.join(ROOT, rel === "/" ? "index.html" : rel.replace(/^\//, ""));
      try {
        const buf = readFileSync(filePath);
        const ext = path.extname(filePath);
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
        };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`  (静的サーバーを起動: ${baseUrl})\n`);
      resolve(server);
    });
  });
}

async function main() {
  const base = (process.env.BASE_URL || BASE_DEFAULT).replace(/\/$/, "");
  const cfg = loadSupabaseConfig();

  console.log("\n=== 安否通知ログ 実DB確認 ===\n");
  console.log(`  Supabase: ${cfg.url}`);
  console.log(`  holder:   ${HOLDER_ID}\n`);

  const server = await ensureStaticServer(base);
  await deleteLogsForHolder(cfg, HOLDER_ID);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.addInitScript(({ userId }) => {
      delete window.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__;
      try {
        localStorage.removeItem("tasu_anpi_notification_logs_supabase_mock_v1");
        localStorage.setItem("tasu_anpi_line_send_mock_v1", "1");
      } catch {
        /* ignore */
      }
      window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
      window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = userId;
    }, { userId: USER_ID });

    await page.goto(`${base}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        Boolean(
          window.TasuSupabase?.isConfigured?.() &&
            window.TasuAnpiNotifications?.recordUrgentKeyword
        ),
      { timeout: 20000 }
    );

    pass("Supabase クライアント構成");

    await page.evaluate(
      ({ userId, holderId, ctxKey }) => {
        const ctx = {
          user_id: userId,
          is_anpi_user: true,
          user_name: "実DBログ太郎",
          user_phone_masked: "09-***-9999",
          contract_holder_id: holderId,
          contract_holder_name: "実DBログ花子",
          contract_holder_relation: "妻",
          contract_holder_email: "logs-real@example.com",
          contract_holder_phone_masked: "03-***-1111",
          contract_holder_contact_method: "tasful_chat",
          notify_channels: ["tasful_chat", "line"],
          notification_level: "all_ai_actions",
          line_notification_enabled: true,
          line_user_id: "line_real_db_logs_user",
          line_linked_at: new Date().toISOString(),
          line_user_id_enc: "enc_logs_real",
          line_oauth_access_token_enc: "enc_token_logs_real",
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(ctxKey, JSON.stringify(ctx));
        return window.TasuAnpiUserContext.setAnpiUserContext(ctx);
      },
      { userId: USER_ID, holderId: HOLDER_ID, ctxKey: CTX_KEY }
    );

    const created = await page.evaluate(async () => {
      const log = await Promise.resolve(
        window.TasuAnpiNotifications.recordUrgentKeyword("実DB確認で救急車", "救急車")
      );
      return {
        id: log?.id,
        line_user_id: log?.line_user_id,
        line_status: log?.line_status,
        event_type: log?.event_type,
      };
    });

    if (created?.id && created?.event_type === "urgent_keyword_detected") {
      pass("ブラウザで通知ログ作成", created.id);
    } else fail("ブラウザで通知ログ作成", JSON.stringify(created));

    await page.waitForTimeout(2500);

    const { rows, error: fetchErr } = await fetchLogsForHolder(cfg, HOLDER_ID);
    if (fetchErr?.includes("PGRST205") || fetchErr?.includes("anpi_notification_logs")) {
      fail(
        "Supabase 行の取得",
        "テーブル未作成 — sql/anpi-notification-logs.sql を SQL Editor で実行してください"
      );
      console.log("\n  (以降の手順はテーブル作成後に再実行してください)\n");
      return;
    }
    if (fetchErr) fail("Supabase 行の取得", fetchErr);
    else if (rows?.length >= 1 && rows[0]?.log_id === created.id) {
      pass("anpi_notification_logs に保存", `log_id=${rows[0].log_id}`);
    } else {
      fail("anpi_notification_logs に保存", `rows=${rows?.length}`);
    }

    const row = rows?.find((r) => r.log_id === created.id) || rows?.[0];
    if (row?.line_user_id === "line_real_db_logs_user") {
      pass("Supabase に LINE 列保存");
    } else {
      fail("Supabase に LINE 列保存", row?.line_user_id);
    }

    await page.evaluate((key) => localStorage.removeItem(key), LOGS_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => {
        const logs = window.TasuAnpiNotifications?.getRawLogsFromStorage?.() || [];
        const info = window.TasuAnpiNotifications?.getLogsStorageInfo?.();
        return logs.length >= 1 && info?.restored === true;
      },
      { timeout: 20000 }
    );

    const restored = await page.evaluate(() => {
      const log = window.TasuAnpiNotifications.getRawLogsFromStorage()[0];
      const info = window.TasuAnpiNotifications.getLogsStorageInfo();
      return {
        id: log?.id,
        event_type: log?.event_type,
        line_user_id: log?.line_user_id,
        line_status: log?.line_status,
        restored: info?.restored,
        status: info?.last_sync_status,
      };
    });

    if (restored.id === created.id && restored.restored) {
      pass("localStorage 削除後に Supabase から復元", restored.event_type);
    } else {
      fail("localStorage 削除後に Supabase から復元", JSON.stringify(restored));
    }

    if (restored.line_user_id === "line_real_db_logs_user") {
      pass("LINE 連携情報も復元");
    } else {
      fail("LINE 連携情報も復元", restored.line_user_id);
    }

    await page.evaluate((id) => {
      window.TasuAnpiNotifications.markNotificationRead(id);
    }, created.id);

    await page.waitForTimeout(1500);

    const { rows: afterRead } = await fetchLogsForHolder(cfg, HOLDER_ID);
    const readRow = afterRead?.find((r) => r.log_id === created.id);
    if (readRow?.is_read === true && readRow?.read_at) {
      pass("既読化が Supabase に反映", readRow.read_at);
    } else {
      fail("既読化が Supabase に反映", JSON.stringify({ is_read: readRow?.is_read }));
    }
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  process.exitCode = ng.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
