/**
 * Shared smoke helpers — Cloudflare Access login detection & ops auth classification.
 * Product code must not import this module.
 */

/** Ops pages checked without admin JWT in prod pre-smoke. */
export const OPS_GUARDED_CATEGORIES = new Set(["inbox", "deep_link", "support", "report"]);

/** Verdicts that are not product failures in default pre-smoke. */
export const NON_FAIL_VERDICTS = new Set(["PASS", "EXPECTED_AUTH", "EXPECTED_LEGACY"]);

/**
 * True only when the document is the Cloudflare Access login wall — not in-app banner text.
 * @param {{ url?: string, title?: string, body?: string }} ctx
 */
export function isCloudflareAccessLoginPage(ctx) {
  const url = String(ctx.url || "");
  const title = String(ctx.title || "");
  const body = String(ctx.body || "");

  if (/cloudflareaccess\.com/i.test(url)) return true;
  if (/cdn-cgi\/access\/login/i.test(url)) return true;

  const accessTitle = /^Sign in\b/i.test(title) && /Cloudflare Access/i.test(title);
  const otpForm =
    /Get a login code|One-time PIN|Enter your email to receive a login code/i.test(body) &&
    (/cloudflareaccess\.com/i.test(body) || /cdn-cgi\/access\/login/i.test(body) || accessTitle);

  if (accessTitle && /name=["']email["']|type=["']email["']/i.test(body)) return true;
  if (otpForm) return true;

  return false;
}

/** @deprecated use isCloudflareAccessLoginPage */
export function isAccessLogin(url, body, title = "") {
  return isCloudflareAccessLoginPage({ url, body, title });
}

/** TASFUL auth-ops-guard 403 without admin JWT. */
export function isOpsAuthDenied(title, body) {
  return /403\s*\|\s*TASFUL/i.test(title) && /tasu-ops-forbidden|アクセス権限がありません/i.test(body);
}

export function isSmokeOkVerdict(verdict) {
  return NON_FAIL_VERDICTS.has(verdict);
}

export function isSmokeProductFail(verdict) {
  return verdict === "FAIL";
}
