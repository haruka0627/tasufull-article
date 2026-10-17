#!/usr/bin/env node
/**
 * Credential recontamination prevention (F-SP-14/F-SP-15) — offline tests: fetch is stubbed, nothing contacts any server, no real credential is used.
 *  A. scripts/lib/test-auth-guard-v1.mjs   (target, test-account-only, no public/weak password, no role assignment, scoped + expiring Staging writes)
 *  B. scripts/lib/talk-rls-test-auth.mjs   (no implicit reset, scoped reset only, Production blocked before any request, public password never used)
 *  C. static: guarded legacy writers, no implicit Production default, no new unguarded Auth writer, no published value anywhere (tracked + new files)
 *  D. scanner self-tests, and the "E2E runner must not use ensureTalkJwt / service role" rule
 * A mock PASS is evidence about the code paths only; it says nothing about the real Staging/Production state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(path.join(root, p)).href;
let pass = 0, fail = 0;
const add = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : " — " + d}`); };
const code = (fn) => { try { fn(); return "OK"; } catch (e) { return e.code || String(e.message).split(":")[0]; } };

const G = await import(url("scripts/lib/test-auth-guard-v1.mjs"));
const H = await import(url("scripts/lib/talk-rls-test-auth.mjs"));
const STAGING = "https://ahlxuyvhzqdqaojiywmu.supabase.co", PROD = "https://ddojquacsyqesrjhcvmn.supabase.co", LOCAL = "http://127.0.0.1:54321";
const GOOD_PW = "Zx9-test-value-not-public-0123456789";
// the gate reads the scope only from process.env and the real clock, so the tests set process.env (restored after each call) and use times relative to now
const rel = (min) => new Date(Date.now() + min * 60000).toISOString();
const relJst = (min) => new Date(Date.now() + min * 60000 + 9 * 3600000).toISOString().slice(0, 19) + "+09:00";
const SCOPE_KEYS = ["TALK_ALLOW_AUTH_ADMIN_WRITE", "TALK_AUTH_WRITE_ACCOUNTS", "TALK_AUTH_WRITE_OPS", "TALK_AUTH_WRITE_EXPIRES"];
const scope = (o = {}) => ({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1", TALK_AUTH_WRITE_ACCOUNTS: "talk-rls-a@tasful-dev.test", TALK_AUTH_WRITE_OPS: "update_password", TALK_AUTH_WRITE_EXPIRES: rel(30), ...o });
const withScopeEnv = (env, fn) => {
  const prev = Object.fromEntries(SCOPE_KEYS.map((k) => [k, process.env[k]]));
  for (const k of SCOPE_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env || {})) process.env[k] = v;
  try { return fn(); } finally { for (const k of SCOPE_KEYS) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
};
const gate = (o = {}, env = scope()) => withScopeEnv(env, () => G.authAdminWriteGate({ url: STAGING, op: "update_password", email: "talk-rls-a@tasful-dev.test", password: GOOD_PW, ...o }));

// a real published value, taken from git objects at run time (in memory only; never printed)
const published = (() => {
  const t = spawnSync("git", ["show", "fd23dba3a:scripts/lib/talk-rls-test-auth.mjs"], { cwd: root, encoding: "utf8", maxBuffer: 1e8 }).stdout || "";
  return /password:\s*"([^"]{8,})"/.exec(t)?.[1] || null;
})();

// ---------------- A. guard
add("A01_production_target_rejected", code(() => G.assertTestAuthTarget(PROD)) === "BLOCKED_PRODUCTION_TARGET");
add("A02_unknown_and_lookalike_hosts_rejected", ["https://zzzzzzzzzzzzzzzzzzzz.supabase.co", "https://evil.example/ahlxuyvhzqdqaojiywmu", "https://ahlxuyvhzqdqaojiywmu.supabase.co.evil.example", ""].every((u) => code(() => G.assertTestAuthTarget(u)) === "BLOCKED_UNKNOWN_TARGET"));
add("A03_staging_and_loopback_accepted", code(() => G.assertTestAuthTarget(STAGING)) === "OK" && code(() => G.assertTestAuthTarget(LOCAL)) === "OK");
add("A04_published_value_deny_list_present", G.PUBLIC_PASSWORD_SHA256.size >= 12 && published !== null && G.isPublicPassword(published));
add("A05_published_value_refused", code(() => G.assertAcceptablePassword(published)) === "PUBLIC_PASSWORD_REFUSED");
add("A06_weak_password_refused", code(() => G.assertAcceptablePassword("short")) === "WEAK_TEST_PASSWORD" && code(() => G.assertAcceptablePassword(undefined)) === "WEAK_TEST_PASSWORD");
add("A07_scoped_staging_write_allowed_with_all_four_conditions", code(() => gate()) === "OK");
add("A08_flag_alone_is_not_enough", code(() => gate({}, { TALK_ALLOW_AUTH_ADMIN_WRITE: "1" })) === "ACCOUNT_NOT_IN_SCOPE");
add("A09_missing_flag_blocks", code(() => gate({}, scope({ TALK_ALLOW_AUTH_ADMIN_WRITE: "" }))) === "AUTH_WRITE_NOT_ENABLED");
add("A10_other_account_not_in_scope", code(() => gate({ email: "talk-rls-b@tasful-dev.test" })) === "ACCOUNT_NOT_IN_SCOPE");
add("A11_other_operation_not_in_scope", code(() => gate({ op: "delete_user" })) === "OPERATION_NOT_IN_SCOPE" && code(() => gate({ op: "create_user" })) === "OPERATION_NOT_IN_SCOPE");
add("A12_expired_missing_or_too_long_scope_blocks", code(() => gate({}, scope({ TALK_AUTH_WRITE_EXPIRES: rel(-60) }))) === "SCOPE_EXPIRED_OR_MISSING" && code(() => gate({}, scope({ TALK_AUTH_WRITE_EXPIRES: "" }))) === "SCOPE_EXPIRED_OR_MISSING" && code(() => gate({}, scope({ TALK_AUTH_WRITE_EXPIRES: rel(120) }))) === "SCOPE_TOO_LONG");
add("A13_non_test_account_refused_even_with_scope", code(() => gate({ email: "someone@example.com" }, scope({ TALK_AUTH_WRITE_ACCOUNTS: "someone@example.com" }))) === "NOT_A_TEST_ACCOUNT");
add("A14_role_assignment_never_allowed", code(() => gate({ role: "tasu_admin" })) === "ROLE_ASSIGNMENT_NOT_ALLOWED");
add("A15_published_password_refused_even_with_full_scope", code(() => gate({ password: published })) === "PUBLIC_PASSWORD_REFUSED");
add("A16_production_write_refused_even_with_full_scope", code(() => gate({ url: PROD })) === "BLOCKED_PRODUCTION_TARGET");
add("A17_loopback_needs_no_scope_but_keeps_other_rules", code(() => gate({ url: LOCAL }, {})) === "OK" && code(() => gate({ url: LOCAL, password: published }, {})) === "PUBLIC_PASSWORD_REFUSED");

// ---------------- B. helper with stubbed fetch
const realFetch = globalThis.fetch;
const calls = [];
function stub({ users = [], loginOk = true } = {}) {
  calls.length = 0;
  globalThis.fetch = async (u, init = {}) => {
    const x = String(u), m = init.method || "GET";
    calls.push({ m, p: x.replace(/^https?:\/\/[^/]+/, ""), body: init.body ? String(init.body) : "" });
    const j = (s, b) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b) });
    if (x.includes("/auth/v1/admin/users") && m === "GET") return j(200, { users });
    if (x.includes("/auth/v1/admin/users") && m === "POST") return j(200, { user: { id: "new" } });
    if (x.includes("/auth/v1/admin/users/") && m === "PUT") return j(200, { user: { id: "u1" } });
    if (x.includes("/token")) return loginOk ? j(200, { access_token: "stub-token" }) : j(400, { error: "invalid_credentials" });
    return j(404, {});
  };
}
const writes = () => calls.filter((c) => c.m !== "GET" && !c.p.includes("/token"));
const spec = H.TALK_TEST_USERS.u_me, specAdmin = H.TALK_TEST_USERS.u_admin;
const cfg = (u) => ({ url: u, anonKey: "anon-stub", serviceKey: ["e30", Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase-demo" })).toString("base64url"), "sig"].join(".") });
const saved = { ...process.env };
const setEnv = (o) => { for (const k of ["TALK_ALLOW_AUTH_ADMIN_WRITE", "TALK_AUTH_WRITE_ACCOUNTS", "TALK_AUTH_WRITE_OPS", "TALK_AUTH_WRITE_EXPIRES"]) delete process.env[k]; Object.assign(process.env, o || {}); };
const inFuture = (min) => new Date(Date.now() + min * 60000).toISOString();
try {
  process.env.TALK_RLS_USER_A_PASSWORD = GOOD_PW; process.env.TALK_RLS_USER_ADMIN_PASSWORD = GOOD_PW + "-admin";
  setEnv({});

  stub(); let err = ""; try { await H.ensureTalkJwt(cfg(PROD), spec); } catch (e) { err = e.message; }
  add("B01_production_blocked_before_any_request", /BLOCKED_PRODUCTION_TARGET/.test(err) && calls.length === 0, err);

  stub({ users: [{ id: "u1", email: spec.email }] });
  add("B02_existing_account_never_reset_by_default", (await H.ensureTalkJwt(cfg(STAGING), spec)) === "stub-token" && writes().length === 0, JSON.stringify(calls));

  setEnv({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1" });
  stub({ users: [{ id: "u1", email: spec.email }] });
  await H.ensureTalkJwt(cfg(STAGING), spec);
  add("B03_flag_alone_does_not_reset_an_existing_account", writes().length === 0, JSON.stringify(calls));

  setEnv({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1", TALK_AUTH_WRITE_OPS: "update_password", TALK_AUTH_WRITE_ACCOUNTS: spec.email, TALK_AUTH_WRITE_EXPIRES: inFuture(30) });
  stub({ users: [{ id: "u1", email: spec.email }] });
  await H.ensureTalkJwt(cfg(STAGING), spec);
  const w = writes();
  add("B04_scoped_reset_updates_only_the_password_of_the_listed_account", w.length === 1 && w[0].m === "PUT" && JSON.stringify(Object.keys(JSON.parse(w[0].body))) === '["password"]', JSON.stringify(w));

  setEnv({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1", TALK_AUTH_WRITE_OPS: "update_password", TALK_AUTH_WRITE_ACCOUNTS: "talk-rls-b@tasful-dev.test", TALK_AUTH_WRITE_EXPIRES: inFuture(30) });
  stub({ users: [{ id: "u1", email: spec.email }] });
  await H.ensureTalkJwt(cfg(STAGING), spec);
  add("B05_scope_for_another_account_does_not_touch_this_one", writes().length === 0);

  setEnv({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1", TALK_AUTH_WRITE_OPS: "update_password", TALK_AUTH_WRITE_ACCOUNTS: spec.email, TALK_AUTH_WRITE_EXPIRES: "2020-01-01T00:00:00Z" });
  stub({ users: [{ id: "u1", email: spec.email }] }); err = ""; try { await H.ensureTalkJwt(cfg(STAGING), spec); } catch (e) { err = e.message; }
  add("B06_expired_scope_fails_closed_without_write", /SCOPE_EXPIRED_OR_MISSING/.test(err) && writes().length === 0, err);

  setEnv({});
  stub({ users: [] }); err = ""; try { await H.ensureTalkJwt(cfg(STAGING), spec); } catch (e) { err = e.message; }
  add("B07_creating_a_missing_staging_account_needs_scope", /AUTH_WRITE_NOT_ENABLED/.test(err) && writes().length === 0, err);

  stub({ users: [] });
  await H.ensureTalkJwt(cfg(LOCAL), spec);
  add("B08_loopback_may_create_missing_accounts", writes().length === 1 && writes()[0].m === "POST");

  setEnv({ TALK_ALLOW_AUTH_ADMIN_WRITE: "1", TALK_AUTH_WRITE_OPS: "create_user", TALK_AUTH_WRITE_ACCOUNTS: specAdmin.email, TALK_AUTH_WRITE_EXPIRES: inFuture(30) });
  stub({ users: [] });
  await H.ensureTalkJwt(cfg(STAGING), specAdmin);
  const created = JSON.parse(writes()[0].body);
  add("B09_creation_never_assigns_an_admin_role", !JSON.stringify(created).includes("tasu_admin") && !("role" in (created.app_metadata || {})), JSON.stringify(created.app_metadata));
  setEnv({});

  if (published) {
    process.env.TALK_RLS_USER_A_PASSWORD = published;
    stub({ users: [{ id: "u1", email: spec.email }] }); err = ""; try { await H.ensureTalkJwt(cfg(STAGING), spec); } catch (e) { err = e.message; }
    add("B10_a_published_password_is_never_used_to_sign_in_or_reset", /PUBLIC_PASSWORD_REFUSED/.test(err) && calls.filter((c) => c.p.includes("/token")).length === 0 && writes().length === 0, err);
    process.env.TALK_RLS_USER_A_PASSWORD = GOOD_PW;
  } else add("B10_a_published_password_is_never_used_to_sign_in_or_reset", false, "no published value available from git objects (cannot test)");

  process.env.TALK_RLS_USER_A_PASSWORD = " "; // blank (not deleted: the helper would reload the real value from the untracked .env)
  stub({ users: [{ id: "u1", email: spec.email }] }); err = ""; try { await H.ensureTalkJwt(cfg(STAGING), spec); } catch (e) { err = e.message; }
  add("B11_missing_env_password_fails_closed", /MISSING_TALK_RLS_USER_A_PASSWORD/.test(err) && writes().length === 0 && calls.length === 0, err);
  process.env.TALK_RLS_USER_A_PASSWORD = GOOD_PW;
  stub({ users: [{ id: "u1", email: spec.email }], loginOk: false }); err = ""; try { await H.ensureTalkJwt(cfg(STAGING), spec); } catch (e) { err = e.message; }
  add("B12_failed_login_message_does_not_leak_the_password", !err.includes(GOOD_PW) && /TALK_AUTH_WRITE_/.test(err));
} finally {
  globalThis.fetch = realFetch;
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
}

// ---------------- C. static
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const guarded = ["scripts/lib/talk-rls-test-auth.mjs", "scripts/issue-anpi-rls-jwt.mjs", "scripts/test-tlv-payment-rls-staging.mjs", "scripts/verify-talk-rls-staging.mjs", "scripts/verify-partner-mgmt-real-login.mjs", "scripts/verify-partner-api-auth-live200.mjs"];
add("C01_all_scripts_that_write_the_exposed_accounts_use_the_guard", guarded.every((f) => /test-auth-guard-v1/.test(read(f))), guarded.filter((f) => !/test-auth-guard-v1/.test(read(f))).join(","));
add("C02_no_implicit_production_default_url_in_those_scripts", guarded.every((f) => !/SUPABASE_URL\s*\|\|\s*["']https:\/\/ddojquacsyqesrjhcvmn/.test(read(f))));
add("C03_those_scripts_never_assign_an_admin_role", guarded.every((f) => !/appMetadata\.role\s*=\s*(spec\.role|adminRole)/.test(read(f).replace(/const adminRole = ""[^\n]*/, ""))));
const mut = spawnSync("node", [path.join(root, "scripts/check-auth-mutation-sites-v1.mjs")], { cwd: root, encoding: "utf8" });
add("C04_no_new_unguarded_auth_writer_in_the_repository", mut.status === 0 && /"NEW_unguarded": \[\]/.test(mut.stdout), mut.stdout.slice(-200));
const { scanRepo, scanText } = await import(url("scripts/check-no-credential-literals-v1.mjs"));
const tracked = scanRepo({ root });
add(`C05_no_published_password_in_tracked_files (${tracked.scanned} files)`, tracked.bad.length === 0, JSON.stringify(tracked.bad.map((b) => b.file)));
const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 1e9 }).stdout.split("\n").filter(Boolean).filter((f) => !/^(node_modules|dist|\.next)\//.test(f));
const un = scanRepo({ root, paths: untracked });
add(`C06_no_published_password_in_new_untracked_files (${un.scanned} files)`, un.bad.length === 0, JSON.stringify(un.bad.map((b) => b.file)));

// ---------------- D. scanner self-tests + E2E rule
add("D01_scanner_flags_a_published_value", published !== null && scanText(`const x = "${published}";`).some((h) => h.kind === "PUBLISHED_PASSWORD_VALUE"));
add("D02_scanner_flags_a_new_password_literal_next_to_a_test_email", scanText(['{ email: "a@tasful-dev.test", ', 'password: "', 'N3w-Literal-Value-', '123456"', ' }'].join("")).some((h) => h.kind === "PASSWORD_LITERAL"));
add("D03_scanner_accepts_env_based_code", scanText('password: process.env.TALK_RLS_USER_A_PASSWORD || ""').length === 0);
export function findForbidden(text) {
  const t = String(text), hits = [];
  if (/ensureTalkJwt|ensureTalkTestUsers/.test(t)) hits.push("ensureTalkJwt/ensureTalkTestUsers");
  if (/talk-rls-test-auth/.test(t)) hits.push("talk-rls-test-auth import");
  if (/SUPABASE_SERVICE_ROLE_KEY|serviceKey|service_role/i.test(t)) hits.push("service-role key");
  if (/\/auth\/v1\/admin\/|admin\/users/.test(t)) hits.push("Auth admin endpoint");
  return hits;
}
add("D04_runner_rule_detector_works", findForbidden("import { ensureTalkJwt } from './lib/talk-rls-test-auth.mjs'").length === 2 && findForbidden("fetch(u + '/auth/v1/token?grant_type=password')").length === 0);
const candidates = [];
for (const dir of ["scripts", "scripts/lib"]) { const abs = path.join(root, dir); if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) if (/behavioural.*e2e|e2e.*behavioural/i.test(f) && /\.(mjs|js)$/.test(f) && !/^test-talk-test-auth-hardening/.test(f)) candidates.push(path.join(dir, f)); }
const bad = candidates.map((f) => [f, findForbidden(read(f))]).filter(([, h]) => h.length);
add(`D05_no_E2E_runner_file_uses_ensureTalkJwt_or_service_role (checked ${candidates.length})`, bad.length === 0, JSON.stringify(bad));

// ---------------- E. findings of the independent review (2026-10-17)
const fakeJwt = (o) => ["e30", Buffer.from(JSON.stringify(o)).toString("base64url"), "sig"].join(".");
add("E01_lookalike_loopback_and_trailing_dot_hosts_rejected", ["http://localhost.evil.com", "http://127.0.0.1.evil.com", "https://ahlxuyvhzqdqaojiywmu.supabase.co.", "http://127.0.0.2:54321", "http://0.0.0.0:54321"].every((u) => code(() => G.assertTestAuthTarget(u)) === "BLOCKED_UNKNOWN_TARGET"));
add("E02_admin_equivalent_role_write_refused_on_staging_even_with_scope", code(() => gate({ op: "update_metadata", role: "partner_role" }, scope({ TALK_AUTH_WRITE_OPS: "update_metadata" }))) === "ROLE_ASSIGNMENT_NOT_ALLOWED");
add("E03_role_write_allowed_only_on_a_real_local_stack", code(() => gate({ url: LOCAL, op: "update_metadata", role: "partner_role" }, {})) === "OK");
add("E04_loopback_with_a_hosted_service_key_refused (tunnel/proxy to a hosted project)", code(() => gate({ url: LOCAL, serviceKey: fakeJwt({ ref: "ddojquacsyqesrjhcvmn", role: "service_role" }) }, {})) === "LOOPBACK_WITH_HOSTED_KEY" && code(() => gate({ url: LOCAL, serviceKey: fakeJwt({ iss: "supabase-demo", role: "service_role" }) }, {})) === "OK");
add("E05_derived_password_containing_a_published_value_refused", published !== null && ["Zz1-" + published, published + "-Zz1-extra", "pre" + published + "post-0123456789"].every((p) => code(() => G.assertAcceptablePassword(p)) === "PUBLIC_PASSWORD_REFUSED"));
add("E06_strict_expiry_format_required", ["Oct 17 2026 10:30", "2026-10-17 10:30", "2026-10-17T10:30:00"].every((x) => code(() => gate({}, scope({ TALK_AUTH_WRITE_EXPIRES: x }))) === "SCOPE_EXPIRED_OR_MISSING") && code(() => gate({}, scope({ TALK_AUTH_WRITE_EXPIRES: relJst(30) }))) === "OK");
add("E07_scope_matching_uses_unicode_normalisation_on_both_sides", code(() => gate({}, scope({ TALK_AUTH_WRITE_ACCOUNTS: "ｔalk-rls-a@tasful-dev.test" }))) === "OK" && G.scopedWriteRequested(scope(), "TALK-RLS-A@tasful-dev.test", "update_password") === true && G.scopedWriteRequested(scope(), "talk-rls-b@tasful-dev.test", "update_password") === false);
// scanner: embedded values, per-value allowlist
{
  const os = await import("node:os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test-"));
  const mk = (n, c) => fs.writeFileSync(path.join(tmp, n), c);
  if (published) {
    mk("embedded.js", `const a = "E2E_${published}";\n// note: ${published}.\n`);
    mk("allowed.js", `const x = "${published}";\n`);
    mk("allowed-plus-new.js", `const x = "${published}";\nconst y = { email: "a@tasful-dev.test", ${["pass", "word"].join("")}: "${["Another", "New", "Literal", "9"].join("-")}" };\n`);
    fs.writeFileSync(path.join(tmp, "allow.json"), JSON.stringify({ files: { "allowed.js": { values: [crypto.createHash("sha256").update(published).digest("hex")] }, "allowed-plus-new.js": { values: [crypto.createHash("sha256").update(published).digest("hex")] } } }));
    const r = scanRepo({ root: tmp, paths: ["embedded.js", "allowed.js", "allowed-plus-new.js"], allowlistPath: path.join(tmp, "allow.json") });
    const by = Object.fromEntries(r.bad.map((b) => [b.file, b.hits.map((h) => h.kind)]));
    add("E08_scanner_finds_a_published_value_embedded_in_a_longer_token_or_comment", (by["embedded.js"] || []).filter((k) => k === "PUBLISHED_PASSWORD_VALUE").length >= 2, JSON.stringify(by));
    add("E09_allowlist_is_per_value_not_per_file", !by["allowed.js"] && (by["allowed-plus-new.js"] || []).includes("PASSWORD_LITERAL"), JSON.stringify(by));
  } else { add("E08_scanner_finds_embedded", false, "no published value from git"); add("E09_allowlist_per_value", false, "no published value from git"); }
  fs.rmSync(tmp, { recursive: true, force: true });
}
// mutation-site classifier
{
  const { classify } = await import(url("scripts/check-auth-mutation-sites-v1.mjs"));
  const unguardedWithComment = `// uses test-auth-guard-v1 (not really)\nawait fetch(base + "/auth/v1/admin/users/" + id, {\n  method: "put",\n  body });\n`;
  const guardedReal = `import { authAdminWriteGate } from "./lib/test-auth-guard-v1.mjs";\nauthAdminWriteGate({ url, op: "update_password", email, password });\nawait fetch(base + "/auth/v1/admin/users/" + id, { method: "PUT", body });\n`;
  add("E10_comment_or_unused_import_does_not_count_as_guarded", classify(unguardedWithComment, "x.mjs")?.guarded === false && classify(guardedReal, "y.mjs")?.guarded === true);
  add("E11_multiline_lowercase_methods_axios_curl_and_sql_are_detected", !!classify('await fetch(u + "/admin/users",\n { method: "post" })', "a.mjs") && !!classify("axios.put(base + '/auth/v1/admin/users/1', b)", "b.mjs") && !!classify("curl -X DELETE $URL/auth/v1/admin/users/$ID", "c.sh") && !!classify("update auth.users set encrypted_password = 'x'", "d.sql"));
  add("E12_read_only_admin_listing_is_not_a_writer", classify('fetch(u + "/auth/v1/admin/users?per_page=200", { headers })', "e.mjs") === null);
  const hostOnly = `import { assertTestAuthTarget } from "./lib/test-auth-guard-v1.mjs";\nassertTestAuthTarget(url);\nawait fetch(base + "/auth/v1/admin/users", { method: "POST", body });\n`;
  add("E13_host_check_alone_is_not_a_guarded_writer (authAdminWriteGate required)", classify(hostOnly, "h.mjs")?.guarded === false);
  add("E14_commented_out_gate_call_does_not_count", classify(`import { authAdminWriteGate } from "./lib/test-auth-guard-v1.mjs";\n// authAdminWriteGate(x);\n/* authAdminWriteGate(y) */\nawait fetch(b + "/auth/v1/admin/users", { method: "POST", body });\n`, "c.mjs")?.guarded === false);
}

// FND-SH-07/08/11 regressions: scanner case-sensitivity / key coverage and loopback key shape
{
  const lit = (k, v) => scanText(`const o = { ${k}: "${v}" };`).some((h) => h.kind === "PASSWORD_LITERAL");
  add("F01_letter_led_alphanumeric_value_is_reported_not_treated_as_placeholder", lit("password", "TalkRlsA1xyz") && lit("password", "Passw0rdAbcd"));
  add("F02_env_prefix_lookalike_value_is_reported", lit("password", "EnvAdmin1234!") && lit("password", "ExampleReal9999"));
  add("F03_env_var_name_and_lowercase_placeholders_stay_exempt", !lit("password", "TALK_RLS_USER_A_PASSWORD") && !lit("password", "changeme-placeholder") && !lit("password", "<your-password>"));
  add("F04_secret_and_pw_keys_are_covered", lit("secret", "Zq8!vK2mPq9x") && lit("pw", "Zq8!vK2mPq9x") && lit("clientSecret", "Zq8!vK2mPq9x"));
  const jwt = (o) => ["e30", Buffer.from(JSON.stringify(o)).toString("base64url"), "sig"].join(".");
  const prevOpt = process.env.TALK_ALLOW_LOOPBACK_OPAQUE_KEY; delete process.env.TALK_ALLOW_LOOPBACK_OPAQUE_KEY;
  add("F05_loopback_opaque_non_jwt_key_refused_without_opt_in", code(() => G.assertLoopbackIsLocal("sb_secret_abcdef")) === "LOOPBACK_OPAQUE_KEY");
  process.env.TALK_ALLOW_LOOPBACK_OPAQUE_KEY = "1";
  add("F06_loopback_opaque_key_allowed_only_with_explicit_opt_in", code(() => G.assertLoopbackIsLocal("sb_secret_abcdef")) === "OK");
  if (prevOpt === undefined) delete process.env.TALK_ALLOW_LOOPBACK_OPAQUE_KEY; else process.env.TALK_ALLOW_LOOPBACK_OPAQUE_KEY = prevOpt;
  add("F07_loopback_local_jwt_accepted_hosted_jwt_refused", code(() => G.assertLoopbackIsLocal(jwt({ role: "service_role", iss: "supabase-demo" }))) === "OK" && code(() => G.assertLoopbackIsLocal(jwt({ ref: "ahlxuyvhzqdqaojiywmu" }))) === "LOOPBACK_WITH_HOSTED_KEY");
}

// G. caller-injected scope (Gemini finding): the gate must take its Staging scope only from the operator's process environment and the real clock
{
  const base = { url: STAGING, op: "update_password", email: "talk-rls-a@tasful-dev.test", password: GOOD_PW };
  const farExpiry = "2099-01-01T00:00:00Z";
  add("G01_injected_env_refused_even_when_it_is_a_valid_30_minute_scope", withScopeEnv({}, () => code(() => G.authAdminWriteGate({ ...base, env: scope() }))) === "INJECTED_SCOPE_REFUSED");
  add("G02_injected_env_plus_injected_clock_refused (2099 expiry variant)", withScopeEnv({}, () => code(() => G.authAdminWriteGate({ ...base, env: scope({ TALK_AUTH_WRITE_EXPIRES: farExpiry }), now: Date.parse(farExpiry) - 60000 }))) === "INJECTED_SCOPE_REFUSED");
  add("G03_injected_clock_alone_refused_and_undefined_values_still_count", withScopeEnv(scope(), () => code(() => G.authAdminWriteGate({ ...base, now: Date.now() })) === "INJECTED_SCOPE_REFUSED" && code(() => G.authAdminWriteGate({ ...base, env: undefined })) === "INJECTED_SCOPE_REFUSED"));
  add("G04_injection_refused_before_any_target_decision (also for loopback and Production)", withScopeEnv({}, () => code(() => G.authAdminWriteGate({ ...base, url: LOCAL, env: {} })) === "INJECTED_SCOPE_REFUSED" && code(() => G.authAdminWriteGate({ ...base, url: PROD, env: scope() })) === "INJECTED_SCOPE_REFUSED"));
  add("G05_no_operator_scope_means_no_staging_write", withScopeEnv({}, () => code(() => G.authAdminWriteGate(base))) === "AUTH_WRITE_NOT_ENABLED");
  add("G06_operator_scope_in_process_env_is_honoured_and_limited_to_60_minutes", withScopeEnv(scope(), () => code(() => G.authAdminWriteGate(base))) === "OK" && withScopeEnv(scope({ TALK_AUTH_WRITE_EXPIRES: farExpiry }), () => code(() => G.authAdminWriteGate(base))) === "SCOPE_TOO_LONG" && withScopeEnv(scope({ TALK_AUTH_WRITE_EXPIRES: rel(-1) }), () => code(() => G.authAdminWriteGate(base))) === "SCOPE_EXPIRED_OR_MISSING");
  add("G07_production_still_refused_with_a_full_operator_scope", withScopeEnv(scope(), () => code(() => G.authAdminWriteGate({ ...base, url: PROD }))) === "BLOCKED_PRODUCTION_TARGET");
  const { classify } = await import(url("scripts/check-auth-mutation-sites-v1.mjs"));
  const imp = `import { authAdminWriteGate } from "./lib/test-auth-guard-v1.mjs";\n`;
  const write = `await fetch(b + "/auth/v1/admin/users", { method: "POST", body });\n`;
  const selfApproving = [
    `${imp}authAdminWriteGate({ url, op, email, password, env: { TALK_ALLOW_AUTH_ADMIN_WRITE: "1" } });\n${write}`,
    `${imp}authAdminWriteGate({ url, op, email, password, now: 0 });\n${write}`,
    `${imp}process.env.TALK_ALLOW_AUTH_ADMIN_WRITE = "1";\nauthAdminWriteGate({ url, op, email, password });\n${write}`,
    `${imp}process.env["TALK_AUTH_WRITE_EXPIRES"] = x;\nauthAdminWriteGate({ url, op, email, password });\n${write}`,
    `${imp}Object.assign(process.env, scope);\nauthAdminWriteGate({ url, op, email, password });\n${write}`,
  ];
  add("G08_scanner_does_not_count_self_approving_writers_as_guarded", selfApproving.every((t) => classify(t, "s.mjs")?.guarded === false));
  add("G09_scanner_still_counts_a_plain_gate_call_that_only_reads_the_scope_as_guarded", classify(`${imp}if (process.env.TALK_ALLOW_AUTH_ADMIN_WRITE === "1") authAdminWriteGate({ url, op, email, password });\n${write}`, "r.mjs")?.guarded === true);
}

console.log(`\n=== Summary: TEST_CASES=${pass + fail} PASS=${pass} FAIL=${fail} SKIP=0 ===`);
process.exit(fail ? 1 : 0);
