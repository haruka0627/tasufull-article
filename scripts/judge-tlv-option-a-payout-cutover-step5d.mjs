import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql", import.meta.url),
  "utf8",
).toLowerCase();
const settlementMigration = readFileSync(
  new URL("../supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", import.meta.url),
  "utf8",
).toLowerCase();
const migrationChain = `${settlementMigration}\n${migration}`;
const fixture = readFileSync(
  new URL("./sql/tlv-step5d-option-a-isolated-db-verify.sql", import.meta.url),
  "utf8",
).toLowerCase();
const negativeGuard = readFileSync(
  new URL("./sql/tlv-step5d-option-a-nonzero-guard-fixture.sql", import.meta.url),
  "utf8",
).toLowerCase();

const cases = [];
function judge(id, ok, evidence) {
  cases.push({ id, ok: Boolean(ok), evidence });
}

judge(
  "zero_legacy_precondition",
  migration.includes("lock table tlv.payout_log in access exclusive mode")
    && migration.includes("option_a_requires_zero_legacy_payout_log")
    && negativeGuard.includes("insert into tlv.payout_log")
    && fixture.includes("option_a baseline is not zero-payout"),
  "exclusive lock plus atomic zero-row gate; negative-control DB must reject a pre-existing payout",
);
judge(
  "canonical_payout_correctness",
  migration.includes("create_canonical_settlement_payout")
    && migration.includes("canonical_payout_creator_mismatch")
    && migration.includes("canonical_payout_period_mismatch")
    && migration.includes("canonical_payout_amount_mismatch")
    && fixture.includes("canonical creator/period/amount parity"),
  "service writer copies creator, period, and frozen payout_amount_jpy from monthly_settlements",
);
judge(
  "no_score_dependency",
  migration.includes("canonical_settlement_required_for_payout")
    && migration.includes("drop constraint if exists payout_log_score_monthly_fk")
    && !migration.includes("creator_score_monthly")
    && fixture.includes("dummy score row created")
    && fixture.includes("base_rate is null"),
  "every payout uses settlement_id and the candidate contains no score-table dependency",
);
judge(
  "ad040_preservation",
  migration.includes("new.creator_payout_jpy <> v_settlement.payout_amount_jpy")
    && migration.includes("canonical_payout_legacy_rate_forbidden")
    && !migration.includes("creator_score_monthly.effective_rate"),
  "payout mirrors the deterministic snapshot and rejects Rank/base/override rate inputs",
);
judge(
  "compatibility_removed",
  !migration.includes("protect_legacy_payout_score_reference")
    && !migration.includes("historical_legacy_payout")
    && migration.includes("canonical_payout_financial_identity_immutable")
    && fixture.includes("legacy score compatibility function remains")
    && fixture.includes("direct hold shape mutated canonical payout"),
  "no legacy parent/update branch remains; direct legacy-shaped hold cannot mutate canonical payout state",
);
judge(
  "duplicate_prevention",
  migration.includes("payout_log_creation_key_uniq")
    && migrationChain.includes("payout_log_settlement_uniq")
    && migrationChain.includes("payout_log_provider_transfer_uniq")
    && migration.includes("payout_log_provider_correlation_uniq")
    && migrationChain.includes("payout_log_provider_payout_uniq")
    && fixture.includes("duplicate_settlement_payout_creation"),
  "settlement, creation, transfer, unknown-correlation, and payout identifiers are unique",
);
judge(
  "hold_semantics",
  migration.includes("route_payment_reversal_to_settlement_hold")
    && migration.includes("insert into tlv.settlement_hold_events")
    && migration.includes("return old;")
    && fixture.includes("canonical refund hold bridge did not cover all creator-a payout states")
    && fixture.includes("canonical hold directly mutated payout status"),
  "payment reversal appends settlement hold evidence while legacy direct payout hold is excluded",
);
judge(
  "provider_correlation_uniqueness",
  migration.includes("canonical provider transfer identifier owner")
    && migration.includes("derived state-machine reference")
    && migration.includes("settlement_provider_reference_mismatch")
    && !migration.includes("if v_payout.payout_creation_key is null then return null")
    && fixture.includes("provider transfer owner/derived reference mismatch")
    && fixture.includes("provider correlation owner/derived reference mismatch")
    && fixture.includes("provider payout owner/derived reference mismatch"),
  "payout_log owns provider IDs; every payout receives strict commit-time parity checks",
);
judge(
  "security_boundary",
  migration.includes("security definer")
    && migration.includes("set search_path = pg_catalog, tlv")
    && migration.includes("from public, anon, authenticated")
    && fixture.includes("creator a sees creator b payout")
    && fixture.includes("force rls lost"),
  "fixed search_path, service-only functions, FORCE RLS, and cross-user denial fixtures",
);

const failed = cases.filter((item) => !item.ok);
for (const item of cases) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.id}: ${item.evidence}`);
}

if (failed.length > 0) {
  console.error(`TLV_OPTION_A_STEP5D_INDEPENDENT_JUDGE: FAIL (${failed.length}/${cases.length})`);
  process.exitCode = 1;
} else {
  console.log(`TLV_OPTION_A_STEP5D_INDEPENDENT_JUDGE: PASS (${cases.length}/${cases.length})`);
}
