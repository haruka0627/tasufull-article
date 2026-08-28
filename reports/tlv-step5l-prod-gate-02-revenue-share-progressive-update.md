# TLV STEP5L PROD GATE 02 — Progressive Revenue Share Update

Date: 2026-08-28 JST  
Scope: local Repository candidate + disposable isolated PostgreSQL only  
Branch / start HEAD: `cf-pages-deploy` / `87157ec591b41043692da19affe17569fc1141a1`

TLV_STEP5L_PROD_GATE_02_REVENUE_SHARE_UPDATE_STATUS: TECHNICAL_CLOSEOUT_COMPLETE
VERDICT: PASS_WITH_FINDINGS
REVENUE_SHARE_MODEL: TLV_PROGRESSIVE_V1

## Contract

AD-040 §6.1 is the financial policy SSOT. One creator's monthly Eligible Net is divided into marginal brackets:

| Eligible Net portion | Creator | TASFUL |
| --- | ---: | ---: |
| first JPY 5,000,000 | 80% | 20% |
| next JPY 5,000,000 | 90% | 10% |
| next JPY 20,000,000 | 95% | 5% |
| above JPY 30,000,000 | 99% | 1% |

The monetary SSOT is the cumulative `revenue_share_brackets` amount. Marginal and effective rates are audit/display values only. Neither may be multiplied by the whole Eligible Net. The existing creator-month single final floor and conservation rule remain unchanged.

SSOT: `docs/adr/ADR-040-tasful-product-option-benefit-policy.md` §6.1; `scripts/lib/economics/tlv-tip.mjs`; persisted `tlv.monthly_settlements` snapshot.

## Required assertions

BOUNDARY_TESTS: PASS (12/12)

| Eligible Net | Creator JPY | TASFUL JPY | Result |
| ---: | ---: | ---: | --- |
| 0 | 0 | 0 | PASS |
| 1 | 0 | 1 | PASS; monthly final floor residual 0.8 |
| 4,999,999 | 3,999,999 | 1,000,000 | PASS |
| 5,000,000 | 4,000,000 | 1,000,000 | PASS |
| 5,000,001 | 4,000,000 | 1,000,001 | PASS |
| 9,999,999 | 8,499,999 | 1,500,000 | PASS |
| 10,000,000 | 8,500,000 | 1,500,000 | PASS |
| 10,000,001 | 8,500,000 | 1,500,001 | PASS |
| 29,999,999 | 27,499,999 | 2,500,000 | PASS |
| 30,000,000 | 27,500,000 | 2,500,000 | PASS |
| 30,000,001 | 27,500,000 | 2,500,001 | PASS |
| 100,000,000 | 96,800,000 | 3,200,000 | PASS |

- Progressive boundary cases: PASS
- 30M example: PASS (`TASFUL=2,500,000`, `Creator=27,500,000`)
- 100M example: PASS (`TASFUL=3,200,000`, `Creator=96,800,000`)
- Creator amount equals progressive bracket cumulative sum: PASS
- TASFUL retained equals Eligible Net minus Creator amount: PASS
- Creator + TASFUL equals Eligible Net: PASS
- negative, fractional, NaN, infinite, and unsafe integer inputs rejected: PASS
- marginal/effective rate never used as whole-amount calculation rate: PASS

## Isolated full chain

FULL_CHAIN: PASS

Command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-tlv-step5l-prod-gate-02-isolated.ps1`

Environment: disposable `postgres:16-alpine`, `--network none`, `--rm`, repository mounted read-only.

Validated in a clean chain:

1. existing TLV schema and Payment migrations
2. Payment RLS and cross-user denial fixtures
3. deterministic progressive Settlement candidate
4. 12 DB boundary snapshots and invalid-input rejection
5. settlement transitions, holds, audit, idempotency, and immutable snapshot guard
6. OPTION_A zero-legacy cutover
7. persisted 100M snapshot to canonical payout (`96,800,000` JPY)
8. snapshot bracket tamper rejection and payout financial-identity tamper rejection
9. seven synthetic QA rows disposition and correction
10. STEP5K assertions 40/40
11. full-chain reconciliation validation
12. OPTION_A and disposition migration rerun
13. pre-migration backup restore and source fingerprint equality
14. cleanup

PAYOUT_CONSISTENCY: PASS — canonical payout copies the persisted progressive `payout_amount_jpy`; no marginal/effective-rate recomputation.
TAMPER_PROTECTION: PASS — `same_status_snapshot_update_forbidden` and `canonical_payout_financial_identity_immutable`.
CORRECTION_DISPOSITION_CONSISTENCY: PASS — exact seven sources preserved; seven append-only corrections; net TASFUL JPY 0; payout rows 0.
STEP5K_REGRESSION: PASS (40/40)
MIGRATION_RERUN: PASS
BACKUP_RESTORE: PASS
CLEANUP: PASS — `docker ps -a --filter name=tlv-step5l-gate02-` returned no matching containers.

Backup evidence hashes from the successful run:

- full custom dump: `a461fea1dd049f20cae3349caa1137b0fc81fbecb200ed57ad91564a2ccf3c91`
- schema SQL: `b0d15bd56d9b7871e5bfbad2497611fa9affc803fab13deb755452a27be44877`
- exact-seven source CSV: `0fe2e0e57b32d47e17b31cb1f8accb100d7c4acbb5c5b54580b88c7c68bae48c`
- source fingerprint before/after restore: `a44ca185394ff13dbd04a8b478eb48b7`

## Regression

REGRESSION: PASS

- deterministic Settlement engine: PASS
- independent Step 4 oracle: PASS (12 cases)
- STEP5K test / judge: PASS / PASS
- Economics Core Phase 1–4: PASS (28/28)
- Economics Core user contribution: PASS (18/18)
- Benefit candidate: PASS (16/16)
- OPTION_A contract / independent judge: PASS / PASS (9/9)
- Payment RLS cross-user contract: PASS (45/45)
- Settlement security contract: PASS
- Payment logic and chargeback logic: PASS
- public progressive policy validator: PASS
- browser JavaScript syntax and legacy-output fail-closed guards: PASS

The frozen STEP5E history-integrity verifier correctly reports source drift because it pins the pre-change byte count/hash of a Financial SSOT now intentionally superseded by this Human-approved update. That historical Evidence/report was not rewritten and is excluded from the current-policy regression verdict.

## Legacy reference audit

OLD_SPEC_REMAINS: HISTORICAL_SUPERSEDED_ONLY
LEGACY_EFFECTIVE_REFERENCES: 0

- Core calculation, Settlement migration, snapshot schema, payout validation, public policy candidate, and current AD-040 contain no effective one-shot tier calculation.
- `creator_score_monthly` and legacy payout rate columns remain only for analytics/historical compatibility and are prohibited from Revenue Share, settlement eligibility, amount, and payout decisions.
- Old Business Simulator Rank/guarantee/payout-pool outputs are marked `HISTORICAL_SUPERSEDED`; current creator/admin consumers reject them unless the input declares `TLV_PROGRESSIVE_V1` and `financial_authority=tlv.monthly_settlements`.
- Historical ADR passages and prior reports remain intact with supersession notices. Reports were not rewritten.
- Unrelated uses of “one-shot” (voice, workers, media probes) are not financial references.

## Read-only preflight impact

READ_ONLY_PREFLIGHT_IMPACT: QUERY_SCOPE_UNCHANGED_DEFINITION_HASH_EXPECTED_TO_CHANGE

The Production preflight SQL remains `BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;`. The seven-row inventory logic is unaffected. Candidate migration/object definition SHA values will necessarily change after a future approved apply. No Production read was performed in this update.

## Fixes executed

FIXES_EXECUTED:

- replaced one-shot tier calculation with common progressive bracket calculation
- expanded immutable snapshot fields and DB constraints
- updated the tamper test to the actual progressive JSON breakdown field
- synchronized missing base-schema constraints discovered by isolated migration-chain testing
- aligned the payout tamper expected error with the earlier financial-identity immutability guard
- added persisted progressive snapshot-to-OPTION_A payout proof
- updated public policy candidate and fixed 90% contract display
- made old Business Simulator output non-authoritative and fail closed in live consumers
- added current-policy independent Judge and SHA-256 manifest

## Candidate files

IMPLEMENTATION_FILES:

- Core: `scripts/lib/economics/tlv-tip.mjs`, `scripts/lib/economics/tlv-settlement.mjs`, `scripts/lib/economics/index.mjs`, `scripts/lib/economics/benefit-candidate-design.mjs`
- Schema/migrations: `db/tlv_schema.sql`, `supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql`, existing OPTION_A and synthetic disposition candidates
- Isolated QA: `scripts/test-tlv-step5l-prod-gate-02-isolated.ps1`, `scripts/sql/tlv-step5-isolated-db-verify.sql`, `scripts/sql/tlv-step5d-zero-legacy-baseline.sql`, `scripts/sql/tlv-step5l-isolated-prestate-validation.sql`, `scripts/sql/tlv-step5l-progressive-option-a-payout-validation.sql`
- Tests/Judges: deterministic settlement, STEP4, STEP5K, OPTION_A, economics regressions, and `scripts/judge-tlv-step5l-prod-gate-02-progressive-update.mjs`
- UI/reporting guards: `live/payout-policy.html`, `live/live-channel-content.js`, `live/tlv-creator-payout-display.js`, `live/live-admin-payouts.js`, `scripts/tlv-payout-policy-content.mjs`
- Legacy classification: `scripts/tlv-payout-engine.mjs`, `scripts/tlv-payout-financial.mjs`, three generator files, and three `live/data` simulator JSON files
- SSOT/docs: AD-040/041, TLV Settlement/Financial Scope docs, Decisions, Creator Program, Pricing, Financial Model, DB Schema, Monetization, Live Concept, Admin System, and explicitly superseded historical ADR/PRD material

## Findings and gates

UNRESOLVED_FINDINGS:

- Candidate migrations and several evidence/support files remain untracked; no selective release anchor exists.
- Tax policy remains fail-closed `NOT_CONFIGURED`; Production transfer remains ineligible.
- The public phrase “Creator還元 最大99%” remains a marketing/legal approval gate before publication. The candidate page already includes the required progressive explanation.
- Static Pages build/dist mirroring was not run because the shared working tree contains extensive unrelated pre-existing dist changes; source-only validation was used to preserve them.

HUMAN_GATE_REQUIRED: YES — Production/Shared Staging apply, public pricing claim approval, and tax/accounting configuration remain outside this authorization.
SOURCE_CONTROL_RELEASE_ANCHOR: CREATED_BY_THIS_COMMIT — resolve the immutable anchor with `git rev-parse HEAD`.
INDEPENDENT_JUDGE: PASS
SHA256_VERIFICATION: PASS

PRODUCTION_READ_ACCESSED: NO
PRODUCTION_WRITE_EXECUTED: NO
PRODUCTION_CHANGED: NO
SHARED_STAGING_CHANGED: NO
REAL_FINANCIAL_TRANSACTION_EXECUTED: NO
COMMIT_CREATED: NO
DEPLOYED: NO
TLV_STEP5L_PROD_GATE_03_STARTED: NO

NEXT_SAFE_STEP: STOP after the approved Gate 02 release anchor; Gate 03 was not started.
