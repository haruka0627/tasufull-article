import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateTlvMonthlySettlement } from "./lib/economics/tlv-settlement.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260828210000_tlv_synthetic_qa_disposition_v1.sql", import.meta.url), "utf8");
const core = readFileSync(new URL("./lib/economics/tlv-settlement.mjs", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./sql/tlv-staging-create-tip-integration.sql", import.meta.url), "utf8");

const table = migration.match(/create table if not exists tlv\.revenue_disposition_events \(([\s\S]*?)\n\);/i)?.[1];
assert.ok(table, "registry absent");
assert.doesNotMatch(table, /\b(gross_amount_jpy|net_amount_jpy|fee_amount_jpy|creator_payout_jpy|platform_revenue_jpy)\b/i, "second monetary SSOT");
assert.match(migration, /before update or delete on tlv\.revenue_disposition_events/i);
assert.match(migration, /force row level security/i);
assert.match(migration, /grant execute on function tlv\.apply_synthetic_qa_disposition_v1[\s\S]*to service_role/i);
assert.match(migration, /v_target_count <> 7[\s\S]*v_full_signature_count <> 7[\s\S]*v_unexpected_count <> 0/i);
assert.match(migration, /v_created <> 7 or v_neutralized <> -145000/i);
assert.match(migration, /revenue_ledger_synthetic_qa_neutralization_source_uniq/i);
assert.match(migration, /deferrable initially deferred/i);
assert.match(migration, /provider_fee_semantics\s+text not null default 'NOT_APPLICABLE'/i);
assert.match(migration, /payment_id is null and tip_payment_id is null/i);
assert.match(migration, /allocation_count=0 and wallet_debit_count=0/i);
assert.match(migration, /not bot_suspect_flag and not fraud_excluded/i);
for (const hash of [
  "2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD",
  "7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A",
  "DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099",
  "7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059",
]) assert.ok(migration.includes(hash), `unpinned evidence ${hash}`);

const excludeAt = core.indexOf("if (row.excluded_financial_disposition)");
const accumulateAt = core.indexOf("for (const key of Object.keys(totals))", excludeAt);
assert.ok(excludeAt >= 0 && excludeAt < accumulateAt, "exclusion is not before progressive-share accumulation");

const base = { source_table:"tlv.revenue_ledger", creator_id:"judge", recognition_period:"2026-08", occurred_at:"2026-08-10T00:00:00Z", settlement_input_reconciled:true };
const real = { ...base, id:"real", event_kind:"gift", gross_amount_jpy:4_999_999, provider_payment_fee_jpy:0, net_amount_jpy:4_999_999 };
const evidence = { settlement_disposition:"EXCLUDE_SYNTHETIC_QA", disposition_event_id:"judge-event", disposition_classification:"SYNTHETIC_QA", disposition_source_role:"ORIGINAL_SOURCE", disposition_evidence_valid:true, disposition_complete:true };
const synthetic = { ...base, ...evidence, id:"synthetic", event_kind:"gift", gross_amount_jpy:145_000, provider_payment_fee_jpy:0, net_amount_jpy:145_000 };
const judged = calculateTlvMonthlySettlement({ creator_id:"judge", settlement_period:"2026-08", calculated_at:"2026-08-28T00:00:00Z", ledger_rows:[real,synthetic] });
assert.equal(judged.ok, true);
assert.equal(judged.snapshot.eligible_net_basis_jpy, 4_999_999);
assert.equal(judged.snapshot.applied_marginal_bracket, "JPY_0_TO_5M");
assert.equal(calculateTlvMonthlySettlement({ creator_id:"judge", settlement_period:"2026-08", calculated_at:"2026-08-28T00:00:00Z", ledger_rows:[{...synthetic,disposition_complete:false}] }).ok, false);

assert.match(fixture, /fixture_environment/);
assert.match(fixture, /fixture_run_id/);
assert.match(fixture, /gen_random_uuid\(\)/);
assert.match(fixture.trim(), /ROLLBACK;$/);
assert.doesNotMatch(fixture, /a0000000-0000-4000-8000-000000000103/);

console.log("STEP5K INDEPENDENT JUDGE: PASS");
console.log("No second monetary SSOT; exact-7/evidence binding; pre-share exclusion; fail-closed; append-only/RLS; fixture root cause guard verified.");
