/**
 * ANPI Phase 45 — unit tests for notification history mappers / RPC client.
 * Run: node scripts/test-anpi-phase45-rpc-client.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "anpi-rpc-client.js"), "utf8");

const sandbox = { window: {}, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const Api = sandbox.window.TasuAnpiRpc;
assert.ok(Api, "TasuAnpiRpc exported");

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

check("CHECK_STATUS_LABELS covers backend enum", () => {
  const expected = [
    "scheduled",
    "notified",
    "reminded",
    "overdue",
    "contact_notified",
    "confirmed",
    "confirmed_late",
    "paused",
    "cancelled",
  ];
  for (const s of expected) {
    assert.ok(Api.CHECK_STATUS_LABELS[s], `missing label for ${s}`);
  }
  assert.equal(Object.keys(Api.CHECK_STATUS_LABELS).length, expected.length);
});

check("mapCheckStatus full set", () => {
  assert.equal(Api.mapCheckStatus(null).key, "none");
  assert.equal(Api.mapCheckStatus({ status: "scheduled" }).key, "pending");
  assert.equal(Api.mapCheckStatus({ status: "notified" }).key, "pending");
  assert.equal(Api.mapCheckStatus({ status: "reminded" }).key, "pending");
  assert.equal(Api.mapCheckStatus({ status: "overdue" }).key, "attention");
  assert.equal(Api.mapCheckStatus({ status: "contact_notified" }).key, "attention");
  assert.equal(Api.mapCheckStatus({ status: "confirmed" }).key, "confirmed");
  assert.equal(Api.mapCheckStatus({ status: "confirmed_late" }).key, "confirmed");
  assert.equal(Api.mapCheckStatus({ status: "paused" }).key, "inactive");
  assert.equal(Api.mapCheckStatus({ status: "cancelled" }).key, "inactive");
  assert.equal(Api.mapCheckStatus({ status: "weird" }).key, "other");
  assert.equal(Api.mapCheckStatus({ status: "confirmed" }).label, "確認済み");
});

check("normalizeHistoryRow", () => {
  const row = Api.normalizeHistoryRow({
    check_id: "c1",
    local_check_date: "2026-07-27",
    status: "confirmed",
    scheduled_at: "2026-07-27T00:00:00Z",
    confirmed_at: "2026-07-27T01:00:00Z",
    confirmation_source: "anpi_ui",
  });
  assert.equal(row.status, "confirmed");
  assert.equal(row.status_label, "確認済み");
  assert.equal(row.check_id, "c1");
  assert.equal(Api.normalizeHistoryRow(null), null);
  assert.equal(Api.normalizeHistoryRow({ status: "xyz" }).status_label, "不明な状態");
});

check("formatTokyoDate / DateTime", () => {
  assert.equal(Api.formatTokyoDate(null), "—");
  assert.equal(Api.formatTokyoDate(""), "—");
  assert.equal(Api.formatTokyoDate("2026-07-27"), "2026/07/27");
  assert.equal(Api.formatTokyoDateTime(null), "—");
  assert.equal(Api.formatTokyoDateTime("not-a-date"), "—");
  const formatted = Api.formatTokyoDateTime("2026-07-27T00:00:00.000Z");
  assert.ok(formatted.includes("2026"));
  assert.notEqual(formatted, "—");
});

check("error kinds include NOT_FOUND / UNAUTHENTICATED", () => {
  assert.equal(Api.normalizeError({ message: "anpi_auth_required", status: 401 }).kind, "UNAUTHENTICATED");
  assert.equal(Api.normalizeError({ message: "not_found", status: 404 }).kind, "NOT_FOUND");
  assert.equal(Api.normalizeError({ message: "Failed to fetch" }).kind, "NETWORK");
  assert.ok(!String(Api.normalizeError({ message: "SQLSTATE 42501" }).userMessage).includes("SQLSTATE"));
});

check("no service_role / owner UUID args in list history source", () => {
  const text = fs.readFileSync(path.join(root, "anpi-rpc-client.js"), "utf8");
  assert.doesNotMatch(text, /SUPABASE_SERVICE/i);
  assert.match(text, /anpi_list_my_check_history/);
  assert.match(text, /anpi_get_my_today_check/);
  const histFn = text.slice(text.indexOf("async function listCheckHistory"), text.indexOf("const CHECK_STATUS_LABELS"));
  assert.doesNotMatch(histFn, /p_owner|owner_user_id|p_user_id/);
});

{
  sandbox.window.__ANPI_RPC_MOCK__ = {
    async rpc(name, args) {
      if (name === "anpi_list_my_check_history") {
        assert.equal(args.p_limit, 30);
        return {
          ok: true,
          data: [
            {
              check_id: "h1",
              local_check_date: "2026-07-27",
              status: "scheduled",
              scheduled_at: "2026-07-27T00:00:00Z",
              confirmed_at: null,
              confirmation_source: null,
            },
          ],
        };
      }
      if (name === "anpi_get_my_today_check") {
        return { ok: true, data: null };
      }
      return { ok: false, error: { message: "unexpected " + name, status: 500 } };
    },
  };
  const hist = await Api.listCheckHistory(30);
  assert.equal(hist.ok, true);
  assert.equal(hist.data.length, 1);
  assert.equal(hist.data[0].status_label, "確認予定");
  const today = await Api.getTodayCheck();
  assert.equal(today.ok, true);
  assert.equal(today.data, null);
  pass += 1;
  console.log("PASS listCheckHistory + empty today");
}

{
  sandbox.window.__ANPI_RPC_MOCK__ = {
    async rpc(name, args) {
      assert.ok(args.p_limit <= 90);
      assert.equal(name, "anpi_list_my_check_history");
      return { ok: true, data: [] };
    },
  };
  const hist = await Api.listCheckHistory(999);
  assert.equal(hist.ok, true);
  assert.equal(hist.data.length, 0);
  pass += 1;
  console.log("PASS history limit clamp + empty");
}

{
  sandbox.window.__ANPI_RPC_MOCK__ = { unauthenticated: true, async rpc() { return { ok: true, data: [] }; } };
  const res = await Api.listCheckHistory(10);
  assert.equal(res.ok, false);
  assert.equal(res.error.kind, "UNAUTHENTICATED");
  pass += 1;
  console.log("PASS history auth error");
}

{
  sandbox.window.__ANPI_RPC_MOCK__ = {
    async rpc() {
      return { ok: false, error: { message: "Failed to fetch" } };
    },
  };
  const res = await Api.listCheckHistory(10);
  assert.equal(res.ok, false);
  assert.equal(res.error.kind, "NETWORK");
  pass += 1;
  console.log("PASS history network error");
}

{
  const notifJs = fs.readFileSync(path.join(root, "anpi-notifications.js"), "utf8");
  assert.doesNotMatch(notifJs, /ensureTodayCheck|anpi_ensure_my_today_check/);
  assert.doesNotMatch(notifJs, /anpi_user_contexts|line_user_id|service_role/i);
  assert.match(notifJs, /getTodayCheck/);
  assert.match(notifJs, /listCheckHistory/);
  const notifHtml = fs.readFileSync(path.join(root, "anpi-notifications.html"), "utf8");
  assert.doesNotMatch(notifHtml, /anpi-notification-log|anpi-line|line_user_id/i);
  assert.match(notifHtml, /anpi-rpc-client\.js/);
  assert.match(notifHtml, /外部への通知は送信されません/);
  pass += 1;
  console.log("PASS notifications page read-only + no legacy scripts");
}

console.log(`\nPASS ${pass} checks`);
