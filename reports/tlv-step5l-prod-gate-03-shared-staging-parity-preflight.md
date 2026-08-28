# TLV STEP5L PROD — Gate 03 Shared Staging Closeout

Date: 2026-08-29 JST

Start release anchor: `6be64d38c8325e44f9369ae902bc78daef297ab4`

Gate 02 implementation anchor: `70eee88b3ec88107de4e7727a0808162db3d080c`

Formal scope: `SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY`

GATE_03_VERDICT: PASS
GATE_03_READONLY_PREFLIGHT_SQL: PASS

## Scope and safety boundary

Repository Evidence fixed Gate 03 as the Shared Staging parity phase following Gate 02. The only authorized environment mutation was sequential application of the four pinned migrations to project `ahlxuyvhzqdqaojiywmu`. Production project `ddojquacsyqesrjhcvmn`, deploy, provider operations, real settlement, transfer, payout, refund, and Gate 04 remained prohibited.

The linked ref, configured project ref, and Supabase URL were checked against the Shared Staging ref before every CLI phase. Credential values were never emitted or persisted in Evidence.

## Candidate identity

| Order | Migration | normalized SHA-256 |
| ---: | --- | --- |
| 1 | `20260813090000_tlv_payment_rls_production_ready_gate.sql` | `6fe77b4a7941ea973a1771b80fbad6d060d9bfa74db8d55fb7a578b66dc7b92f` |
| 2 | `20260827210000_tlv_deterministic_monthly_settlement_v1.sql` | `2099978eb9b584674a854789b6b5f5c1f628fef978457b3768d4e8d5ce93f883` |
| 3 | `20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql` | `55f3e844fd09f6593f9589e438b73289201204be1d98ac2413b4fe8bde23858f` |
| 4 | `20260828210000_tlv_synthetic_qa_disposition_v1.sql` | `502b2ce3553fbd414370c3be4d7e3aaa9b713ee04415154e0367c1bbda52c320` |

MIGRATION_HASHES: PASS (4/4)

MIGRATION_ORDER: PASS

TLV_PROGRESSIVE_V1_PRESERVED: YES

SECOND_FINANCIAL_SSOT_CREATED: NO

## Shared Staging preflight

The read-only preflight ran inside `BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;` at `2026-08-29 02:38:39 JST`.

- PostgreSQL: `17.6`
- target migration versions present: `0/4`
- `payout_log`: `0` rows
- `creator_score_monthly`: `0` rows
- legacy `payout_log_score_monthly_fk`: present
- existing target policy count: `1`
- transaction read-only: `on`

The zero-payout precondition made OPTION_A safe without rewriting historical payout rows. No settlement or financial disposition function was invoked.

SHARED_STAGING_READ_ONLY_PREFLIGHT: PASS

## Sequential migration apply

An ordinary bulk `db push` was not used because the dirty monorepo contains unrelated local-only migrations. Each pinned SQL file was applied individually in the frozen order and its exact version was then recorded as applied. Every SQL apply and every matching migration-history registration returned success before the next file began.

| Version | SQL apply | history registration |
| --- | --- | --- |
| `20260813090000` | PASS | PASS |
| `20260827210000` | PASS | PASS |
| `20260827230000` | PASS | PASS |
| `20260828210000` | PASS | PASS |

SHARED_STAGING_APPLY: PASS (4/4)

SYNTHETIC_QA_DISPOSITION_FUNCTION_INVOKED: NO

SETTLEMENT_EXECUTED: NO

## Hosted postflight

The same read-only SQL was rerun at `2026-08-29 02:41:15 JST`.

- all four target versions present in `supabase_migrations.schema_migrations`;
- `payout_log=0` and `creator_score_monthly=0` remained unchanged;
- legacy Score FK absent;
- seven target tables present;
- all seven target tables have both RLS enabled and FORCE RLS;
- target policy count `9`;
- target routine-grant count `7`;
- transaction read-only `on`.

The final linked migration-list check again showed all four local/remote versions aligned. Unrelated pre-existing local-only migrations remain outside Gate 03 and were neither applied nor repaired.

HOSTED_SCHEMA_POSTFLIGHT: PASS

OPTION_A_ZERO_LEGACY_POSTFLIGHT: PASS

MIGRATION_HISTORY_PARITY: PASS (4/4)

## Hosted JWT / PostgREST / RLS parity

`scripts/test-tlv-step5l-prod-gate-03-hosted-parity.mjs` used two distinct existing QA users and fresh signed Staging JWTs. It performed no fixture creation and persisted only pseudonymous subject hashes and HTTP status/code/count evidence.

- signed authenticated JWTs: PASS (2 distinct subjects);
- anonymous reads of `monthly_settlements` and `payout_log`: denied;
- both authenticated JWTs can reach the SELECT boundary;
- service boundary can reach both tables;
- authenticated access to Ops-only settlement evidence tables returns zero rows;
- authenticated settlement INSERT: denied;
- authenticated canonical payout RPC: denied;
- successful writes: `0`.

The hosted tables contain zero source rows. Therefore this report does not falsely claim a positive owner-row visibility observation. Owner/cross-user row semantics are established by the exact hosted policy definitions plus the isolated PostgreSQL fixture suite; the real JWT/PostgREST run establishes hosted gateway role propagation and privilege boundaries on the deployed shape.

Initial run: `17/18`; one probe selected nonexistent `settlement_ledger_links.id` and returned PostgreSQL `42703`. The test was corrected to its real key `settlement_id`; rerun: `18/18 PASS`. No migration or policy change was required.

HOSTED_JWT_POSTGREST_RLS_PARITY: PASS (18/18)

HOSTED_OWNER_CROSS_USER_EVIDENCE: POLICY_PARITY_PLUS_ISOLATED_FIXTURE

HOSTED_SUCCESSFUL_PROBE_WRITES: 0

FIXABLE_FINDINGS_CLOSED: 1

## Regression and isolation

PostgreSQL `17.6-alpine` was used with `--network none`, `--rm`, and a read-only Repository mount.

- Gate 03 read-only SQL syntax/result-shape: PASS;
- Gate 02 complete migration chain: PASS;
- progressive boundary DB cases: PASS (12/12);
- 30M / 100M progressive oracles: PASS;
- OPTION_A canonical payout: PASS;
- STEP5K disposition regression: PASS (40/40);
- migration rerun: PASS;
- backup/restore prestate fingerprint: PASS;
- Docker cleanup: PASS; no Gate container remained running;
- JS/static/current-policy Regression: PASS (13/13 suites).

The isolated Synthetic QA function execution was disposable QA only and reported `financial_transaction_executed=false`; the hosted function was never invoked.

POSTGRES_17_6_ISOLATED_FULL_CHAIN: PASS

ISOLATED_NETWORK: NONE

ISOLATED_CONTAINER_CLEANUP: PASS

PROGRESSIVE_BOUNDARIES: PASS (12/12)

OPTION_A_PAYOUT: PASS

STEP5K_REGRESSION: PASS (40/40)

MIGRATION_RERUN: PASS

BACKUP_RESTORE: PASS

CLEANUP: PASS

REGRESSION: PASS (13/13 suites)

## Acceptance and closeout

| Acceptance criterion | Result |
| --- | --- |
| Start anchor fixed | PASS |
| Four migration bytes/order fixed | PASS |
| Fresh hosted zero-legacy preflight | PASS |
| Four sequential Shared Staging migrations | PASS (4/4) |
| Hosted PostgreSQL 17.6 schema/RLS parity | PASS |
| Signed JWT/PostgREST privilege parity | PASS (18/18) |
| Progressive/OPTION_A/STEP5K Regression | PASS |
| Migration rerun and backup/restore | PASS |
| Cleanup | PASS |
| Independent Judge | PASS |

INDEPENDENT_JUDGE: PASS

HUMAN_GATE_REQUIRED: NO

NEXT_SAFE_STEP: STOP. Gate 03 is technically closed. Gate 04 requires a separate instruction and was not started.

PRODUCTION_READ_ACCESSED: NO

PRODUCTION_WRITE_EXECUTED: NO

PRODUCTION_CHANGED: NO

SHARED_STAGING_ACCESSED: YES

SHARED_STAGING_CHANGED: YES — four authorized schema migrations and their history rows only

DB_MUTATION: YES — Shared Staging authorized Gate 03 scope only

SETTLEMENT_EXECUTED: NO

STRIPE_PROVIDER_OPERATION: NO

REAL_FINANCIAL_TRANSACTION_EXECUTED: NO

DEPLOYED: NO

PUSHED: NO

GATE_04_STARTED: NO
