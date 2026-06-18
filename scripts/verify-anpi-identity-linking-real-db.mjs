#!/usr/bin/env node
/**
 * 安否 ID 紐付け — 実 Supabase DB 確認（P9-3）
 *
 *   node scripts/verify-anpi-identity-linking-real-db.mjs
 *
 * 前提:
 *   - sql/anpi-user-context.sql
 *   - sql/anpi-notification-logs.sql
 *   - sql/anpi-identity-linking.sql 適用済み
 *   - http://127.0.0.1:8765 で静的配信
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_DEFAULT = "http://127.0.0.1:8765";
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const STORAGE_KEY = "tasu_anpi_user_context_v1";
const IDENTITY_HINT_KEY = "tasu_anpi_identity_hint_v1";
const CONTEXT_TABLE = "anpi_user_contexts";
const LOGS_TABLE = "anpi_notification_logs";

const MEMBER_ID = "u_me";
const ANPI_USER_ID = "anpi_identity_real_db_verify";

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

async function deleteByUserId(cfg, table, userId) {
  const col = table === LOGS_TABLE ? "user_id" : "user_id";
  const q = `${table}?${col}=eq.${encodeURIComponent(userId)}`;
  return supabaseRest(cfg, "DELETE", q);
}

async function deleteContextByAnpiUser(cfg, userId) {
  const q = `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(userId)}`;
  return supabaseRest(cfg, "DELETE", q);
}

async function fetchContext(cfg, userId) {
  const q = `${CONTEXT_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=*`;
  const res = await supabaseRest(cfg, "GET", q);
  if (!res.ok) return { error: `HTTP ${res.status}: ${JSON.stringify(res.data)}` };
  const rows = Array.isArray(res.data) ? res.data : [];
  return { row: rows[0] || null };
}

async function fetchLogsByHolder(cfg, holderId) {
  const q = `${LOGS_TABLE}?contract_holder_id=eq.${encodeURIComponent(holderId)}&select=log_id,member_id,anpi_user_id,user_id&limit=5`;
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
        const body = readFileSync(filePath);
        const ext = path.extname(filePath);
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
        };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const baseUrl = (process.env.BASE_URL || BASE_DEFAULT).replace(/\/$/, "");
  const cfg = loadSupabaseConfig();
  const server = await ensureStaticServer(baseUrl);

  console.log("\n=== 安否 ID 紐付け 実DB確認 ===\n");

  await deleteContextByAnpiUser(cfg, ANPI_USER_ID);
  await deleteByUserId(cfg, LOGS_TABLE, ANPI_USER_ID);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "u_me";
    try {
      localStorage.setItem("tasu_anpi_line_send_mock_v1", "1");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${baseUrl}${REGISTER}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Boolean(window.TasuAnpiUserContext?.saveFromRegisterForm),
    { timeout: 20000 }
  );

  const saveOk = await page.evaluate(
    ({ anpiUserId, payload }) => {
      localStorage.removeItem("tasu_anpi_user_context_v1");
      const prev = {
        user_id: anpiUserId,
        is_anpi_user: true,
        contract_holder_id: "u_me",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notify_channels: ["tasful_chat"],
        notification_level: "call_only",
        line_notification_enabled: false,
        user_phone_masked: "09-***-0001",
        contract_holder_phone_masked: "03-***-0001",
        consent: {
          no_auto_execution: true,
          self_confirm_required: true,
          tasful_no_guarantee: true,
          emergency_contact_required: true,
          agreed_at: new Date().toISOString(),
        },
      };
      localStorage.setItem("tasu_anpi_user_context_v1", JSON.stringify(prev));
      return window.TasuAnpiUserContext.saveFromRegisterForm({
        user_name: payload.user_name,
        user_phone: payload.user_phone,
        contract_holder_name: payload.contract_holder_name,
        contract_holder_relation: payload.contract_holder_relation,
        contract_holder_email: payload.contract_holder_email,
        contract_holder_phone: payload.contract_holder_phone,
        contract_holder_contact_method: "tasful_chat",
        notification_level: "all_ai_actions",
        notify_tasful_chat: true,
        notify_line: false,
        notify_email: false,
        line_notification_enabled: "0",
        consent_no_auto_execution: true,
        consent_self_confirm_required: true,
        consent_tasful_no_guarantee: true,
        consent_emergency_contact_required: true,
      });
    },
    {
      anpiUserId: ANPI_USER_ID,
      payload: {
        user_name: "実DB ID太郎",
        user_phone: "09000001111",
        contract_holder_name: "実DB ID花子",
        contract_holder_relation: "娘",
        contract_holder_email: "real-id@example.com",
        contract_holder_phone: "0300001111",
      },
    }
  );

  if (saveOk?.ok) pass("登録保存");
  else fail("登録保存", JSON.stringify(saveOk?.errors));

  await page.evaluate(async () => {
    await window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase();
  });

  const ctxRow = await fetchContext(cfg, ANPI_USER_ID);
  if (ctxRow.error) {
    if (String(ctxRow.error).includes("PGRST205")) {
      fail("anpi_user_contexts テーブル", "sql/anpi-identity-linking.sql を含むスキーマを適用してください");
    } else {
      fail("anpi_user_contexts 取得", ctxRow.error);
    }
  } else if (
    ctxRow.row?.member_id &&
    ctxRow.row?.anpi_user_id === ANPI_USER_ID &&
    ctxRow.row?.relationship &&
    ctxRow.row?.account_scope
  ) {
    pass("context ID列", `${ctxRow.row.member_id} / ${ctxRow.row.relationship}`);
  } else {
    fail("context ID列", JSON.stringify(ctxRow.row));
  }

  await page.evaluate(async () => {
    await window.TasuAnpiNotifications?.initAnpiNotificationLogs?.();
    window.TasuAnpiNotifications?.recordAiSearch?.({ query: "real db identity verify", source: "test" });
    await window.TasuAnpiNotifications?.syncAnpiNotificationLogsWithSupabase?.();
  });

  await new Promise((r) => setTimeout(r, 1500));

  const logs = await fetchLogsByHolder(cfg, MEMBER_ID);
  if (logs.error) {
    if (String(logs.error).includes("PGRST205")) {
      fail("anpi_notification_logs テーブル", "sql/anpi-notification-logs.sql を適用してください");
    } else {
      fail("通知ログ取得", logs.error);
    }
  } else {
    const hit = (logs.rows || []).find((r) => r.anpi_user_id === ANPI_USER_ID || r.user_id === ANPI_USER_ID);
    if (hit?.member_id) pass("通知ログ ID列", hit.log_id);
    else fail("通知ログ ID列", JSON.stringify(logs.rows));
  }

  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem("tasu_anpi_user_id_hint_v1");
  }, STORAGE_KEY);

  const restored = await page.evaluate(async (userId) => {
    return window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase({ userId });
  }, ANPI_USER_ID);

  if (restored?.source === "restored" && restored?.context?.member_id) {
    pass("identity hint 復元", restored.context.member_id);
  } else {
    fail("identity hint 復元", restored?.source);
  }

  const primary = await page.evaluate(async (memberId) => {
    return window.TasuAnpiUserContext.getPrimaryAnpiUserContext(memberId);
  }, MEMBER_ID);

  if (primary?.anpi_user_id === ANPI_USER_ID || primary?.user_id === ANPI_USER_ID) {
    pass("primary context", primary.anpi_user_id || primary.user_id);
  } else {
    fail("primary context", JSON.stringify(primary));
  }

  await browser.close();
  if (server) server.close();

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n=== ${ok}/${results.length} OK ===\n`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
