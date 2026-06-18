#!/usr/bin/env node
/**
 * 安否ユーザーコンテキスト — 実 Supabase DB 保存・復元確認
 *
 *   node scripts/verify-anpi-context-real-db.mjs
 *
 * 前提: sql/anpi-user-context.sql 適用済み、http://127.0.0.1:8765 で静的配信
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
const HINT_KEY = "tasu_anpi_user_id_hint_v1";
const TABLE = "anpi_user_contexts";

const TEST_USER_ID = "anpi_real_db_verify_u_me";
const TEST_USER_NAME = "実DB確認太郎";
const LINE_USER_ID = "line_real_db_verify_user";
const LINE_USER_ID_ENC = "enc_real_db_verify_stub";
const LINE_TOKEN_ENC = "enc_token_real_db_stub";

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
      Prefer: method === "GET" ? "return=representation" : "return=representation",
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

async function fetchRowByUserId(cfg, userId) {
  const q = `${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=*`;
  const res = await supabaseRest(cfg, "GET", q);
  if (!res.ok) {
    return { error: `HTTP ${res.status}: ${JSON.stringify(res.data)}` };
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  return { row: rows[0] || null };
}

async function deleteRowByUserId(cfg, userId) {
  const q = `${TABLE}?user_id=eq.${encodeURIComponent(userId)}`;
  return supabaseRest(cfg, "DELETE", q);
}

async function ensureStaticServer(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/anpi-register.html`, { method: "HEAD" });
    if (res.ok) return null;
  } catch {
    /* start server */
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

async function fillAndSave(page) {
  await page.fill('[name="contract_holder_name"]', "実DB花子");
  await page.fill('[name="contract_holder_relation"]', "娘");
  await page.fill('[name="contract_holder_phone"]', "0312345678");
  await page.fill('[name="contract_holder_email"]', "realdb@example.com");
  await page.selectOption('[name="contract_holder_contact_method"]', "tasful_chat");
  await page.fill('[name="user_name"]', TEST_USER_NAME);
  await page.fill('[name="user_phone"]', "09087654321");
  await page.fill('[name="user_relation_note"]', "実DB確認メモ");
  await page.check('[name="notify_tasful_chat"]');
  await page.check('[name="notification_level"][value="important_only"]');
  await page.check('[name="consent_no_auto_execution"]');
  await page.check('[name="consent_self_confirm_required"]');
  await page.check('[name="consent_tasful_no_guarantee"]');
  await page.check('[name="consent_emergency_contact_required"]');
  await page.click("[data-anpi-submit]");
  await page.waitForSelector("[data-anpi-register-success]:not([hidden])", { timeout: 15000 });
}

async function main() {
  const base = (process.env.BASE_URL || BASE_DEFAULT).replace(/\/$/, "");
  const cfg = loadSupabaseConfig();

  console.log("\n=== 安否 Context 実DB確認 ===\n");
  console.log(`  Supabase: ${cfg.url}`);
  console.log(`  user_id:  ${TEST_USER_ID}\n`);

  const server = await ensureStaticServer(base);

  const pre = await fetchRowByUserId(cfg, TEST_USER_ID);
  if (pre.row) {
    console.log("  既存行を削除してから再テストします…");
    await deleteRowByUserId(cfg, TEST_USER_ID);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[AnpiContext]")) logs.push(t);
  });

  try {
    await page.addInitScript(
      ({ userId }) => {
        delete window.__ANPI_CONTEXT_SUPABASE_MOCK__;
        try {
          localStorage.removeItem("tasu_anpi_context_supabase_mock_v1");
        } catch {
          /* ignore */
        }
        window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
        window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = userId;
      },
      { userId: TEST_USER_ID }
    );

    await page.goto(`${base}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        Boolean(
          window.TasuSupabase?.isConfigured?.() &&
            window.TasuAnpiUserContext?.saveFromRegisterForm
        ),
      { timeout: 20000 }
    );

    if (await page.evaluate(() => window.TasuSupabase?.isConfigured?.())) {
      pass("Supabase クライアント構成");
    } else {
      fail("Supabase クライアント構成");
    }

    await page.evaluate(
      ({ userId, storageKey, hintKey }) => {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(hintKey);
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            user_id: userId,
            is_anpi_user: true,
            contract_holder_id: "holder_real_db",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      },
      { userId: TEST_USER_ID, storageKey: STORAGE_KEY, hintKey: HINT_KEY }
    );

    await page.goto(`${base}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-register-form]", { timeout: 15000 });

    await fillAndSave(page);

    const linePatch = await page.evaluate(
      ({ lineUserId, encUser, encToken }) => {
        const prev = window.TasuAnpiUserContext.getAnpiUserContext();
        if (!prev) return { ok: false, error: "no context" };
        const saved = window.TasuAnpiUserContext.setAnpiUserContext({
          line_user_id: lineUserId,
          line_linked_at: new Date().toISOString(),
          line_user_id_enc: encUser,
          line_oauth_access_token_enc: encToken,
          line_oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          line_notification_enabled: true,
          notify_channels: [...new Set([...(prev.notify_channels || []), "line"])],
        });
        return { ok: Boolean(saved), user_id: saved?.user_id };
      },
      {
        lineUserId: LINE_USER_ID,
        encUser: LINE_USER_ID_ENC,
        encToken: LINE_TOKEN_ENC,
      }
    );

    if (linePatch.ok) pass("安否登録 + LINE情報を localStorage 保存");
    else fail("安否登録 + LINE情報を localStorage 保存", linePatch.error || "");

    await page.waitForTimeout(2500);

    const { row, error: fetchErr } = await fetchRowByUserId(cfg, TEST_USER_ID);
    if (fetchErr) {
      fail("Supabase 行の取得", fetchErr);
    } else if (row?.user_id === TEST_USER_ID && row?.user_name === TEST_USER_NAME) {
      pass("Supabase anpi_user_contexts に1行保存", `id=${row.id}`);
    } else {
      fail(
        "Supabase anpi_user_contexts に1行保存",
        row ? `user_name=${row.user_name}` : "行なし"
      );
    }

    if (row?.line_user_id === LINE_USER_ID && row?.line_user_id_enc === LINE_USER_ID_ENC) {
      pass("Supabase に LINE 列が保存されている");
    } else {
      fail(
        "Supabase に LINE 列が保存されている",
        JSON.stringify({
          line_user_id: row?.line_user_id,
          line_user_id_enc: row?.line_user_id_enc,
        })
      );
    }

    await page.evaluate((storageKey) => {
      localStorage.removeItem(storageKey);
    }, STORAGE_KEY);

    const hadHint = await page.evaluate((hintKey) => {
      return Boolean(localStorage.getItem(hintKey));
    }, HINT_KEY);
    if (hadHint) pass("user_id ヒントは残存（復元用）");
    else fail("user_id ヒントは残存（復元用）");

    await page.goto(`${base}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => {
        const ctx = window.TasuAnpiUserContext?.getAnpiUserContext?.();
        const info = window.TasuAnpiUserContext?.getStorageInfo?.();
        return Boolean(ctx?.user_name && info?.source === "restored");
      },
      { timeout: 20000 }
    );

    const restored = await page.evaluate(() => {
      const ctx = window.TasuAnpiUserContext.getAnpiUserContext();
      const info = window.TasuAnpiUserContext.getStorageInfo();
      return {
        user_name: ctx?.user_name || "",
        source: info?.source || "",
        restored: info?.restored === true,
        line_user_id: ctx?.line_user_id || "",
        line_user_id_enc: ctx?.line_user_id_enc || "",
        line_oauth_access_token_enc: ctx?.line_oauth_access_token_enc || "",
        line_linked_at: ctx?.line_linked_at || "",
      };
    });

    if (restored.user_name === TEST_USER_NAME && restored.source === "restored") {
      pass("localStorage 削除後に Supabase から復元", restored.user_name);
    } else {
      fail(
        "localStorage 削除後に Supabase から復元",
        `name=${restored.user_name} source=${restored.source}`
      );
    }

    if (restored.restored) pass("getStorageInfo().restored === true");
    else fail("getStorageInfo().restored === true");

    if (
      restored.line_user_id === LINE_USER_ID &&
      restored.line_user_id_enc === LINE_USER_ID_ENC &&
      restored.line_oauth_access_token_enc === LINE_TOKEN_ENC &&
      restored.line_linked_at
    ) {
      pass("LINE 連携情報も復元");
    } else {
      fail("LINE 連携情報も復元", JSON.stringify(restored));
    }

    const formName = await page.inputValue('[name="user_name"]').catch(() => "");
    if (formName === TEST_USER_NAME) pass("登録フォームへ復元反映", formName);
    else fail("登録フォームへ復元反映", formName || "(empty)");

    if (logs.length) {
      console.log("\n  [AnpiContext] ログ:");
      logs.forEach((l) => console.log(`    ${l}`));
    }
  } finally {
    await browser.close();
    if (server) {
      await new Promise((r) => server.close(r));
    }
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  process.exitCode = ng.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
