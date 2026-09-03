/**
 * TASFUL Benefit / Premium Option access — pure core (Phase 8E).
 * No I/O. Safe for Node tests and Edge shared import.
 *
 * Access:
 *   hasOptionAccess = hasPaidOptionAccess OR hasActiveBenefitAccess
 * Benefit truth: ACTIVE + starts_at <= now < expires_at (exclusive end).
 * APPROVED never authorizes.
 */

export const BENEFIT_OPTION_IDS = Object.freeze({
  BEAUTY_PREMIUM: "beauty_premium",
  VTUBER_PREMIUM: "vtuber_premium",
});

/**
 * @param {unknown} value
 * @returns {number|null} epoch ms
 */
export function toEpochMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Exclusive upper-bound Benefit window check (status ignored here).
 * @param {{ starts_at?: unknown, expires_at?: unknown }} grant
 * @param {number|Date|string} [now]
 */
export function isBenefitTimeWindowOpen(grant, now = Date.now()) {
  const nowMs = toEpochMs(now);
  const startMs = toEpochMs(grant?.starts_at);
  const endMs = toEpochMs(grant?.expires_at);
  if (nowMs == null || startMs == null || endMs == null) return false;
  return startMs <= nowMs && nowMs < endMs;
}

/**
 * Runtime Benefit access from a grant row. Fail-closed.
 * @param {object|null|undefined} grant
 * @param {{ userId: string, optionId: string, now?: number|Date|string }} ctx
 */
export function evaluateActiveBenefitGrant(grant, ctx) {
  const deny = (reason) => ({
    allowed: false,
    source: "none",
    reason,
    grantId: grant?.id ? String(grant.id) : null,
    expiresAt: null,
    status: grant?.status != null ? String(grant.status) : null,
  });

  if (!grant || typeof grant !== "object") return deny("no_grant");
  const userId = String(ctx?.userId || "").trim();
  const optionId = String(ctx?.optionId || "").trim();
  if (!userId || !optionId) return deny("invalid_context");

  if (String(grant.user_id || "") !== userId) return deny("wrong_user");
  if (String(grant.option_id || "") !== optionId) return deny("wrong_option");

  const status = String(grant.status || "");
  if (status === "REVOKED") return deny("revoked");
  if (status === "EXPIRED") return deny("expired_status");
  if (status === "APPROVED") return deny("approved_not_active");
  if (status === "CANDIDATE") return deny("candidate_not_entitlement");
  if (status !== "ACTIVE") return deny("not_active");

  if (!isBenefitTimeWindowOpen(grant, ctx.now)) {
    const nowMs = toEpochMs(ctx.now ?? Date.now());
    const endMs = toEpochMs(grant.expires_at);
    if (endMs != null && nowMs != null && nowMs >= endMs) {
      return deny("expired_time_bound");
    }
    return deny("outside_window");
  }

  return {
    allowed: true,
    source: "benefit",
    reason: "active_benefit",
    grantId: String(grant.id),
    expiresAt: grant.expires_at ? String(grant.expires_at) : null,
    status: "ACTIVE",
  };
}

/**
 * Merge paid + benefit. Benefit failure must not clear paid.
 * @param {{ allowed?: boolean, expiresAt?: string|null, error?: string|null }} paid
 * @param {{ allowed?: boolean, expiresAt?: string|null, reason?: string, error?: string|null, grantId?: string|null }} benefit
 */
export function mergeOptionAccess(paid, benefit) {
  const paidAllowed = Boolean(paid?.allowed);
  const benefitAllowed = Boolean(benefit?.allowed);

  if (paidAllowed) {
    return {
      allowed: true,
      source: "paid",
      expiresAt: paid?.expiresAt ?? null,
      benefit: {
        allowed: benefitAllowed,
        reason: benefit?.reason || null,
        error: benefit?.error || null,
        grantId: benefit?.grantId || null,
      },
      paidError: null,
      benefitError: benefit?.error || null,
    };
  }

  if (benefitAllowed) {
    return {
      allowed: true,
      source: "benefit",
      expiresAt: benefit?.expiresAt ?? null,
      benefit: {
        allowed: true,
        reason: benefit?.reason || "active_benefit",
        error: null,
        grantId: benefit?.grantId || null,
      },
      paidError: paid?.error || null,
      benefitError: null,
    };
  }

  return {
    allowed: false,
    source: "none",
    expiresAt: null,
    benefit: {
      allowed: false,
      reason: benefit?.reason || "denied",
      error: benefit?.error || null,
      grantId: benefit?.grantId || null,
    },
    paidError: paid?.error || null,
    benefitError: benefit?.error || null,
  };
}

/**
 * Default paid adapter for Premium Options without a paid SSOT yet.
 * Does NOT call GenAI/BD/Platform Request systems (preserve those unchanged).
 * Replace later per optionId without changing Benefit semantics.
 */
export function hasPaidOptionAccessStub({ optionId }) {
  const id = String(optionId || "").trim();
  if (!id) {
    return { allowed: false, expiresAt: null, error: "invalid_option" };
  }
  // beauty_premium / vtuber_premium / unknown → no paid implementation yet
  return { allowed: false, expiresAt: null, error: null, adapter: "stub_false" };
}

/**
 * Whether an APPROVED grant is eligible for activator transition.
 */
export function isApprovedGrantActivatable(grant, now = Date.now()) {
  if (!grant || String(grant.status) !== "APPROVED") return false;
  if (grant.revoked_at) return false;
  return isBenefitTimeWindowOpen(grant, now);
}

/**
 * Whether a grant should be expired by time (state may still be ACTIVE/APPROVED).
 */
export function isGrantPastExpiry(grant, now = Date.now()) {
  const nowMs = toEpochMs(now);
  const endMs = toEpochMs(grant?.expires_at);
  if (nowMs == null || endMs == null) return false;
  const status = String(grant?.status || "");
  if (status !== "ACTIVE" && status !== "APPROVED") return false;
  return nowMs >= endMs;
}
