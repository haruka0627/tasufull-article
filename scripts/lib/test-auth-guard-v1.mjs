/**
 * Shared guard for every test helper that signs in with, creates, updates or deletes AUTH users (F-SP-14/F-SP-15 recontamination prevention).
 *
 * Rules (fail closed; every violation throws an Error whose message starts with a stable code):
 *  1. TARGET: only the Staging project host (exact match) or a loopback (local stack). Production and every other host are rejected.
 *  2. TEST ACCOUNTS ONLY: admin writes may only touch emails ending in @tasful-dev.test.
 *  3. NO PUBLIC PASSWORDS: a password whose SHA-256 is in PUBLIC_PASSWORD_SHA256 (values that were committed to the public repository) is never
 *     accepted; passwords must be at least 16 characters.
 *  4. NO ROLE ASSIGNMENT: admin roles (app_metadata.role) are never set through test code.
 *  5. STAGING WRITES ARE SCOPED, not switched on by one flag. Creating or updating an account on Staging requires ALL of:
 *       TALK_ALLOW_AUTH_ADMIN_WRITE=1
 *       TALK_AUTH_WRITE_ACCOUNTS=<comma separated exact emails>   (the target email must be listed)
 *       TALK_AUTH_WRITE_OPS=<comma separated ops>                  (create_user | update_password | update_metadata | delete_user; the operation must be listed)
 *       TALK_AUTH_WRITE_EXPIRES=<ISO-8601 time, at most 60 minutes in the future>
 *     Loopback targets (a throw-away local stack) need none of these.
 */
import crypto from "node:crypto";

export const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
export const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
export const STAGING_HOST = STAGING_REF + ".supabase.co";
export const TEST_EMAIL_SUFFIX = "@tasful-dev.test";
export const ALLOWED_OPS = Object.freeze(["create_user", "update_password", "update_metadata", "delete_user"]);
/** SHA-256 of every password value that has ever been committed to the (public) repository. Hashes only. */
export const PUBLIC_PASSWORD_SHA256 = new Set(["08d5a1d159842284cdd6aea63d110b0b0e3c11ca03ecd485d8f1ed3cf5b91480","2877cd59478b4bbc62e23a4119c0cbb02d07d830bcf2eb05b124288819b47364","52a009b76e6d0ac8823f1a5e620523ab0af2b97bd00d252cf11aa6ad1a7c7c60","55fb395b976867488c653e07173892ad95f9946efdfd3a374437c07d9a3d03ee","587bd42d76fe6dd9cc83261b814257140588ec34d19076d2ef00d058e39baa7d","5f6118636be1bfcfe5c05d24c81fbdc08d79a52a2926aef2c859f346bd58fcf8","79fbc2ac4ff36756906b7ae09c572ca526b7f0c53b520c6d4475253fc3655d9e","7e97a729ba04c38650e2d703b6d7f8af70a853acdb11909dd62ef813bcd90599","862bd91e00469cc2986de132429880f6445c979f23505fc7fe1839f4ab9afac3","876a9294205cf292d781b22116160363164ff54c622209907dfbc587479e76db","d6b3c05798fde5505970390866e36dc6b364a924621d3c41662fd7fcb19b7173","db815468b4a10f47abe36672bc2f63c01cc2576e7b1c2a761b2e0bd864496a81"]);

/** Lengths of those values (lets repository scanners hash only candidate tokens of these lengths). */
export const PUBLIC_PASSWORD_LENGTHS = new Set([10,14,15]);

const fail = (code, msg) => { const e = new Error(code + ": " + msg); e.code = code; throw e; };

export function targetKind(url) {
  const u = String(url || "");
  if (u.includes(PRODUCTION_REF)) return "production";
  let host = "";
  try { host = new URL(u).hostname; } catch { return "unknown"; }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return "loopback";
  if (host === STAGING_HOST) return "staging";
  return "unknown";
}

/** Throws unless the URL is the Staging host (exact) or a loopback. */
export function assertTestAuthTarget(url) {
  const k = targetKind(url);
  if (k === "production") fail("BLOCKED_PRODUCTION_TARGET", "test-account auth helpers must never run against Production");
  if (k === "unknown") fail("BLOCKED_UNKNOWN_TARGET", "expected the Staging project (" + STAGING_REF + ") or a local stack");
  return k;
}

export function isPublicPassword(p) {
  const v = String(p ?? "");
  const h = (x) => crypto.createHash("sha256").update(x).digest("hex");
  if (PUBLIC_PASSWORD_SHA256.has(h(v))) return true;
  // derived values: any window of a published length (prefix/suffix/embedding)
  for (const len of PUBLIC_PASSWORD_LENGTHS) for (let i = 0; i + len <= v.length; i++) if (PUBLIC_PASSWORD_SHA256.has(h(v.slice(i, i + len)))) return true;
  return false;
}
export function assertAcceptablePassword(p) {
  if (isPublicPassword(p)) fail("PUBLIC_PASSWORD_REFUSED", "this password value was published in the repository and must never be set or used again");
  if (typeof p !== "string" || p.length < 16) fail("WEAK_TEST_PASSWORD", "test passwords must be at least 16 characters");
}

/** Email/scope comparison form: Unicode NFKC + lower case (Kelvin sign, full-width forms etc. collapse to the same text on both sides). */
export const normEmail = (v) => String(v ?? "").normalize("NFKC").trim().toLowerCase();
const list = (v) => String(v || "").split(",").map(normEmail).filter(Boolean);

/**
 * Decision gate to call BEFORE any Auth admin write (service role). Returns { allowed: true, scope } or throws.
 * op: create_user | update_password | update_metadata | delete_user
 */
/** Decodes a JWT payload without verifying it (only to refuse hosted keys); returns {} on anything unexpected. */
function jwtClaims(t) { try { return JSON.parse(Buffer.from(String(t).split(".")[1], "base64url").toString("utf8")); } catch { return {}; } }
/** A loopback URL may be a tunnel/proxy to a hosted project: refuse if the service key says it belongs to a hosted project. */
export function assertLoopbackIsLocal(serviceKey) {
  if (!serviceKey) return;
  const c = jwtClaims(serviceKey);
  const ref = String(c.ref || "");
  if (ref === PRODUCTION_REF || ref === STAGING_REF || (ref && ref !== "local")) fail("LOOPBACK_WITH_HOSTED_KEY", "a hosted project's service key was supplied for a loopback URL (tunnel/proxy?)");
  if (c.iss && !/supabase(-demo|-local)?$/i.test(String(c.iss))) fail("LOOPBACK_WITH_HOSTED_KEY", "unexpected token issuer for a local stack");
}

/** One place that decides whether the caller asked for a scoped Staging write of this operation on this account (used by every script). */
export function scopedWriteRequested(env, email, op) {
  return String(env?.TALK_ALLOW_AUTH_ADMIN_WRITE || "") === "1" && list(env?.TALK_AUTH_WRITE_OPS).includes(String(op).toLowerCase()) && list(env?.TALK_AUTH_WRITE_ACCOUNTS).includes(normEmail(email));
}

export function authAdminWriteGate({ url, op, email, password, role, serviceKey, env = process.env, now = Date.now() }) {
  const kind = assertTestAuthTarget(url);
  if (!ALLOWED_OPS.includes(op)) fail("UNKNOWN_OPERATION", "operation not recognised: " + op);
  const mail = normEmail(email);
  if (!mail.endsWith(TEST_EMAIL_SUFFIX)) fail("NOT_A_TEST_ACCOUNT", "refusing to write to a non-test account");
  if (role && kind !== "loopback") fail("ROLE_ASSIGNMENT_NOT_ALLOWED", "admin-equivalent roles (app_metadata.role / partner_role ...) are never assigned on Staging by test code");
  if (password !== undefined && password !== null) assertAcceptablePassword(password);
  if (kind === "loopback") { assertLoopbackIsLocal(serviceKey); return { allowed: true, scope: "loopback" }; }
  // staging: scoped permission, all four conditions
  if (String(env.TALK_ALLOW_AUTH_ADMIN_WRITE || "") !== "1") fail("AUTH_WRITE_NOT_ENABLED", "set TALK_ALLOW_AUTH_ADMIN_WRITE=1 together with the account, operation and expiry scope");
  if (!list(env.TALK_AUTH_WRITE_ACCOUNTS).includes(mail)) fail("ACCOUNT_NOT_IN_SCOPE", "the target account is not listed in TALK_AUTH_WRITE_ACCOUNTS");
  if (!list(env.TALK_AUTH_WRITE_OPS).includes(op)) fail("OPERATION_NOT_IN_SCOPE", "the operation is not listed in TALK_AUTH_WRITE_OPS");
  const expText = String(env.TALK_AUTH_WRITE_EXPIRES || "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(expText)) fail("SCOPE_EXPIRED_OR_MISSING", "TALK_AUTH_WRITE_EXPIRES must be an ISO-8601 time with an explicit zone (e.g. 2026-10-17T10:30:00Z)");
  const exp = Date.parse(expText);
  if (!Number.isFinite(exp) || exp <= now) fail("SCOPE_EXPIRED_OR_MISSING", "TALK_AUTH_WRITE_EXPIRES must be a future ISO time");
  if (exp - now > 60 * 60 * 1000) fail("SCOPE_TOO_LONG", "TALK_AUTH_WRITE_EXPIRES may be at most 60 minutes ahead");
  return { allowed: true, scope: "staging-scoped" };
}
