/**
 * 市場 identity コア（Node テスト用）
 */
export function listingOwnerId(row) {
  if (!row || typeof row !== "object") return "";
  const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
  const pick = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };
  return pick(row.user_id, row.seller_user_id, row.owner_id, row.partner_id, fd.user_id, fd.owner_id);
}

/** @param {{ hostname?: string, config?: Record<string, unknown> }} env */
export function shouldBlockMarketLsIdentity(env) {
  const cfg = env.config || {};
  if (cfg.talkProductionMode === true) return true;
  const host = String(env.hostname || "").toLowerCase();
  return host === "tasful.jp" || host === "www.tasful.jp";
}

export function isOwnerMatch(currentUserId, listing) {
  const uid = String(currentUserId || "").trim();
  if (!uid) return false;
  return listingOwnerId(listing) === uid;
}
