/**
 * ANPI Phase 46 — UI polish / legacy label regression.
 * Run: node scripts/test-anpi-phase46-ui-polish.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

const product = [
  "anpi-dashboard.html",
  "anpi-dashboard.js",
  "anpi-register.html",
  "anpi-notifications.html",
  "anpi-notifications.js",
  "anpi-notifications.css",
];

check("no 安否通知センター on product UI", () => {
  for (const f of product) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(t, /安否通知センター/);
  }
});

check("canonical nav labels present", () => {
  for (const f of ["anpi-dashboard.html", "anpi-register.html", "anpi-notifications.html"]) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    assert.match(t, /安否ダッシュボード/);
    assert.match(t, /安否サービス設定/);
    assert.match(t, /安否確認履歴/);
  }
});

check("dashboard has no legacy line-admin / fail / notify-anchor / badge scripts", () => {
  const html = fs.readFileSync(path.join(root, "anpi-dashboard.html"), "utf8");
  assert.doesNotMatch(html, /anpi-line-admin\.css/);
  assert.doesNotMatch(html, /anpi-line-admin\.js/);
  assert.doesNotMatch(html, /anpi-notification-badge/);
  assert.doesNotMatch(html, /anpi-notification-panel/);
  assert.doesNotMatch(html, /data-anpi-line-fail-panel/);
  assert.doesNotMatch(html, /data-anpi-line-admin/);
  assert.doesNotMatch(html, /data-anpi-notify-anchor/);
  assert.doesNotMatch(html, /NOTIFY_HASH_IDS/);
  assert.match(html, /anpi-rpc-client\.js/);
  assert.match(html, /data-anpi-today-panel/);
});

check("dashboard.js has no legacy panel hide / lineFail", () => {
  const js = fs.readFileSync(path.join(root, "anpi-dashboard.js"), "utf8");
  assert.doesNotMatch(js, /hideLegacyPanels|lineFail|data-anpi-line/);
  assert.match(js, /ensureTodayCheck|getTodayCheck|confirmCheck/);
});

check("notifications.css has no LINE retry / line-status styles", () => {
  const css = fs.readFileSync(path.join(root, "anpi-notifications.css"), "utf8");
  assert.doesNotMatch(css, /\.anpi-line-status|\.anpi-line-retry/);
  assert.match(css, /\.anpi-history-item/);
});

check("shared badge/panel wording updated", () => {
  const badge = fs.readFileSync(path.join(root, "anpi-notification-badge.js"), "utf8");
  const panel = fs.readFileSync(path.join(root, "anpi-notification-panel.js"), "utf8");
  assert.doesNotMatch(badge, /安否通知センター/);
  assert.doesNotMatch(panel, /安否通知センター/);
  assert.match(badge, /安否確認履歴/);
  assert.match(panel, /安否確認履歴/);
});

check("source/dist synced for allowlist", () => {
  const files = [
    "anpi-dashboard.html",
    "anpi-dashboard.js",
    "anpi-dashboard.css",
    "anpi-register.html",
    "anpi-notifications.css",
    "anpi-notification-badge.js",
    "anpi-notification-panel.js",
    "anpi-line-admin.html",
    "anpi-line-admin.js",
  ];
  for (const f of files) {
    const a = fs.readFileSync(path.join(root, f));
    const b = fs.readFileSync(path.join(root, "deploy/cloudflare/dist", f));
    assert.equal(a.equals(b), true, `drift ${f}`);
  }
});

check("no service_role / owner query in polished product JS", () => {
  for (const f of ["anpi-dashboard.js", "anpi-notifications.js", "anpi-register.js"]) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(t, /service_role|SUPABASE_SERVICE/i);
    assert.doesNotMatch(t, /p_owner_user_id|owner_user_id\s*=/);
  }
});

console.log(`\nPASS ${pass} checks`);
