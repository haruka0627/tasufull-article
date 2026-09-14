/**
 * Generated-asset Materials resale License Gate (CANDIDATE).
 *
 * Original memo §20: commercial-use ≠ embed-in-work ≠ sell-output
 * ≠ stock-asset-sale ≠ standalone-redistribution.
 * Fail-closed. Empty Human allowlist. Not wired to publish / Stripe / UI.
 */
export const GENERATED_ASSET_RESALE_LICENSE_GATE = Object.freeze({
  id: "GENERATED_ASSET_RESALE_LICENSE_GATE_CANDIDATE_V1",
  status: "CANDIDATE",
  runtime_applied: false,
  auto_unlock: false,
  marketplace_publish_wired: false,
  default_decision: "DENY",
  formal_ssot: "NONE",
  note: "Do not treat 'commercial use permitted' as Materials stock resale permission.",
});

export const RIGHTS_AXES = Object.freeze([
  "COMMERCIAL_USE",
  "EMBED_IN_WORK",
  "SELL_OUTPUT",
  "STOCK_ASSET_SALE",
  "STANDALONE_REDISTRIBUTION",
]);

const UNKNOWN_AXES = Object.freeze(
  Object.fromEntries(RIGHTS_AXES.map((axis) => [axis, "UNKNOWN"])),
);

/**
 * Investigation pins only. STOCK_ASSET_SALE is never PERMITTED here.
 * Human allowlist is the only path to ALLOW, and it is empty.
 */
export const SOURCE_PINS = Object.freeze({
  "ace-step-1.5": Object.freeze({
    sourceId: "ace-step-1.5",
    evidence: "scripts/lib/materials-ingest/bgm-license/ssot.mjs",
    axes: Object.freeze({
      COMMERCIAL_USE: "CLAIMED_PERMITTED",
      EMBED_IN_WORK: "CLAIMED_PERMITTED",
      SELL_OUTPUT: "UNKNOWN",
      STOCK_ASSET_SALE: "NOT_EXPLICIT",
      STANDALONE_REDISTRIBUTION: "NOT_EXPLICIT",
    }),
  }),
  "stable-audio-3": Object.freeze({
    sourceId: "stable-audio-3",
    evidence: "docs/STABLE_AUDIO_3_ADOPTION_CANDIDATE.md",
    axes: Object.freeze({
      COMMERCIAL_USE: "BLOCKED_LICENSE",
      EMBED_IN_WORK: "BLOCKED_LICENSE",
      SELL_OUTPUT: "BLOCKED_LICENSE",
      STOCK_ASSET_SALE: "BLOCKED_LICENSE",
      STANDALONE_REDISTRIBUTION: "BLOCKED_LICENSE",
    }),
  }),
  "comfyui-unspecified-checkpoint": Object.freeze({
    sourceId: "comfyui-unspecified-checkpoint",
    evidence: "fail-closed unspecified weights",
    axes: UNKNOWN_AXES,
  }),
  "unspecified-external-api": Object.freeze({
    sourceId: "unspecified-external-api",
    evidence: "fail-closed unspecified provider terms",
    axes: UNKNOWN_AXES,
  }),
  "user-original-upload": Object.freeze({
    sourceId: "user-original-upload",
    evidence: "ownership ≠ Materials listing grant",
    axes: Object.freeze({
      COMMERCIAL_USE: "USER_CLAIM_UNVERIFIED",
      EMBED_IN_WORK: "USER_CLAIM_UNVERIFIED",
      SELL_OUTPUT: "UNKNOWN",
      STOCK_ASSET_SALE: "UNKNOWN",
      STANDALONE_REDISTRIBUTION: "UNKNOWN",
    }),
  }),
});

/** Human-approved STOCK_ASSET_SALE rows. Empty until Legal / Human Gate. */
export const HUMAN_STOCK_SALE_ALLOWLIST = Object.freeze([]);

function normalizeSourceId(value) {
  const id = String(value || "").trim().toLowerCase();
  return id;
}

export function getSourcePin(sourceId) {
  const id = normalizeSourceId(sourceId);
  if (Object.prototype.hasOwnProperty.call(SOURCE_PINS, id)) {
    return SOURCE_PINS[id];
  }
  return {
    sourceId: id || "unknown",
    evidence: "unlisted source",
    axes: UNKNOWN_AXES,
  };
}

export function evaluateGeneratedAssetResale(input = {}) {
  const sourceId = normalizeSourceId(input.sourceId);
  const pin = getSourcePin(sourceId);
  const humanRow = HUMAN_STOCK_SALE_ALLOWLIST.find(
    (row) => row && normalizeSourceId(row.sourceId) === pin.sourceId && row.stock_asset_sale === "PERMITTED",
  );

  const axes = { ...UNKNOWN_AXES, ...pin.axes };
  const commercialOnly = axes.COMMERCIAL_USE === "CLAIMED_PERMITTED" || axes.COMMERCIAL_USE === "PERMITTED";
  const stockPermitted = Boolean(humanRow) && axes.STOCK_ASSET_SALE === "PERMITTED";

  if (stockPermitted) {
    return Object.freeze({
      ok: true,
      decision: "ALLOW",
      sourceId: pin.sourceId,
      axes,
      reason: "human_allowlist_stock_asset_sale",
      runtime_applied: false,
      commercial_use_is_not_stock_sale: true,
    });
  }

  return Object.freeze({
    ok: false,
    decision: "DENY",
    sourceId: pin.sourceId || sourceId || "unknown",
    axes,
    reason: humanRow
      ? "human_row_present_but_stock_axis_not_permitted"
      : commercialOnly
        ? "commercial_use_is_not_stock_sale"
        : "fail_closed_missing_stock_asset_sale_permission",
    runtime_applied: false,
    commercial_use_is_not_stock_sale: true,
  });
}
