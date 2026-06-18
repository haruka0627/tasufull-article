/**
 * Connect 状態コア（Node テスト用）
 */
export const CONNECT_STEPS = [
  "top",
  "apply",
  "identity",
  "qualification",
  "reviewing",
  "approved",
  "ready",
];

/** @param {Record<string, unknown> | null | undefined} row */
export function snapshotFromDbRow(row) {
  if (!row || typeof row !== "object") return null;
  const fd =
    row.form_data && typeof row.form_data === "object"
      ? /** @type {Record<string, unknown>} */ (row.form_data)
      : {};
  const pick = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };
  const stripeAccountId = pick(row.stripe_account_id, fd.stripe_account_id);
  const payoutStatus = pick(row.payout_account_status, fd.payout_account_status, "not_connected");
  const payoutEnabled = row.payout_enabled === true || fd.payout_enabled === true;
  const active = /^(active|verified|enabled)$/i.test(payoutStatus);

  if (stripeAccountId && (payoutEnabled || active) && active) {
    return { step: "ready", ready: true, stripeAccountId, source: "db_listing" };
  }
  if (stripeAccountId) {
    return { step: "reviewing", ready: false, stripeAccountId, source: "db_listing" };
  }
  return { step: "top", ready: false, stripeAccountId: null, source: "db_listing" };
}

/** @param {string} step */
export function isConnectReadyStep(step) {
  return String(step || "").trim() === "ready";
}

/** @param {{ hostname?: string, config?: Record<string, unknown> }} env */
export function shouldBlockLsConnectReady(env) {
  const cfg = env.config || {};
  if (cfg.talkProductionMode === true) return true;
  const host = String(env.hostname || "").toLowerCase();
  return host === "tasful.jp" || host === "www.tasful.jp";
}
