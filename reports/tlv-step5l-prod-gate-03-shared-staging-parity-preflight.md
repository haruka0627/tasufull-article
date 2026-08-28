# TLV STEP5L PROD — Gate 03 Shared Staging Parity Preflight

Date: 2026-08-28 JST

GATE_02_BASELINE: 70eee88b3ec88107de4e7727a0808162db3d080c
FORMAL_SCOPE: SHARED_STAGING_FOUR_MIGRATION_APPLY_AND_HOSTED_JWT_POSTGREST_RLS_PARITY
TECHNICAL_PREFLIGHT_STATUS: COMPLETE
GATE_03_VERDICT: BLOCKED

## Scope recovery

Gate 03 is not a new settlement design phase. Repository Evidence fixes its scope as the separate Shared Staging parity phase that follows the Gate 02 source-control anchor:

- `reports/tlv-step5l-prod-gate-02-technical-preflight-closeout.md` section 8 requires Shared Staging authorization for the four migrations in order and hosted JWT/PostgREST/RLS parity.
- The same report records Production PostgreSQL 17.6 and makes hosted Staging parity mandatory before Production consideration.
- `reports/tlv-production-readiness-step5j-final-implementation-plan.md` section 15 independently lists Shared Staging mutation/apply approval and hosted RLS/JWT parity as the next environment gate.
- `docs/TLV_FINANCIAL_CONTRACT_SCOPE_FREEZE.md` and `docs/TLV_SETTLEMENT_ENGINE.md` keep Production settlement, provider execution and tax-dependent transfer paths fail closed.

The exact source paths, normalized SHA-256 values and recovered statements are preserved in `reports/tlv-step5l-prod-gate-03-scope-recovery.txt`; the older untracked reports themselves are not pulled into this release anchor.

The Gate therefore requires all of the following:

1. start from the immutable Gate 02 anchor;
2. prove the exact four migration bytes and order;
3. confirm the target is Shared Staging project `ahlxuyvhzqdqaojiywmu`, never Production `ddojquacsyqesrjhcvmn`;
4. capture a fresh read-only prestate including PostgreSQL version, migration state, zero-legacy payout precondition and current RLS/policy/grant state;
5. apply the four migrations in order to Shared Staging without invoking the Synthetic QA disposition function;
6. verify hosted PostgreSQL compatibility plus JWT/PostgREST owner, cross-user, anonymous, Ops and service-only boundaries;
7. rerun settlement, OPTION_A, STEP5K and progressive regressions against the applied hosted shape;
8. capture hashes, migration versions, cleanup and an independent Judge result.

Production apply, Production read/write, provider operations, settlement execution, payout, transfer, refund, deploy and Gate 04 are outside this scope.

## Candidate identity

| Order | Migration | SHA-256 |
| ---: | --- | --- |
| 1 | `20260813090000_tlv_payment_rls_production_ready_gate.sql` | `6FE77B4A7941EA973A1771B80FBAD6D060D9BFA74DB8D55FB7A578B66DC7B92F` |
| 2 | `20260827210000_tlv_deterministic_monthly_settlement_v1.sql` | `2099978EB9B584674A854789B6B5F5C1F628FEF978457B3768D4E8D5CE93F883` |
| 3 | `20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql` | `55F3E844FD09F6593F9589E438B73289201204BE1D98AC2413B4FE8BDE23858F` |
| 4 | `20260828210000_tlv_synthetic_qa_disposition_v1.sql` | `502B2CE3553FBD414370C3BE4D7E3AAA9B713EE04415154E0367C1BBDA52C320` |

MIGRATION_HASHES: PASS (4/4)
MIGRATION_ORDER: FROZEN
SECOND_FINANCIAL_SSOT: NO
TLV_PROGRESSIVE_V1_PRESERVED: YES

The older Gate 02 Windows worktree manifest recorded `2E231D...E093` for migration 1 because that checkout contained CRLF bytes. The immutable Gate 02 Git blob is `6FE77B...B92F`; normalizing the worktree file to LF produces the same digest. Gate 03 pins the release-anchor blob, not platform-specific checkout line endings. The SQL content was not changed.

## Repository and isolated verification

The Gate 02 anchor was exported through the Git index into a disposable directory and exercised with:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-tlv-step5l-prod-gate-02-isolated.ps1 -Image postgres:17.6-alpine
```

The container used the official `postgres:17.6-alpine` image, `--network none`, `--rm`, and a read-only Repository mount. Image digest observed during the run was `sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94`.

POSTGRES_17_6_ISOLATED_FULL_CHAIN: PASS
GATE_03_READONLY_PREFLIGHT_SQL: PASS
PROGRESSIVE_BOUNDARIES: PASS (12/12)
OPTION_A_PAYOUT: PASS
STEP5K_REGRESSION: PASS (40/40)
MIGRATION_RERUN: PASS
BACKUP_RESTORE: PASS
ISOLATED_NETWORK: NONE
ISOLATED_CONTAINER_CLEANUP: PASS

This closes the local PostgreSQL major/minor version gap. It does not substitute for hosted Supabase JWT/PostgREST behavior.

## Read-only Shared Staging candidate

`reports/sql/tlv-step5l-prod-gate-03-shared-staging-readonly-preflight.sql`:

- begins a transaction;
- enforces `SET TRANSACTION READ ONLY`;
- records environment, migration, zero-legacy, schema, RLS, policy and routine-grant facts;
- contains no data/schema/privilege mutation statement;
- ends with `ROLLBACK`.

The SQL was validated locally but was not run against Shared Staging.

Its PostgreSQL syntax and pre-apply result shape were executed independently in a second disposable PostgreSQL 17.6 container through `scripts/test-tlv-step5l-prod-gate-03-isolated.ps1`.

SHARED_STAGING_READ_ONLY_PREFLIGHT: PREPARED_NOT_EXECUTED
SHARED_STAGING_APPLY: NOT_EXECUTED
HOSTED_JWT_POSTGREST_RLS_PARITY: NOT_EXECUTED

## Acceptance result

| Acceptance criterion | Result |
| --- | --- |
| Gate 02 release anchor fixed | PASS |
| Four migration hashes/order fixed | PASS |
| PostgreSQL 17.6 isolated full-chain | PASS |
| Progressive/OPTION_A/STEP5K regression | PASS |
| Shared Staging project/ref guard | PREPARED |
| Fresh hosted read-only prestate | NOT EXECUTED |
| Four migrations applied to Shared Staging | NOT EXECUTED |
| Hosted JWT/PostgREST/RLS parity | NOT EXECUTED |
| Hosted post-apply regression and cleanup | NOT EXECUTED |

Gate 03 cannot honestly receive PASS while its defining hosted parity evidence is absent. The current instruction explicitly prohibits Shared Staging changes, so the environment mutation boundary was not crossed.

## Closeout

INDEPENDENT_JUDGE: PASS
SOURCE_CONTROL_RELEASE_ANCHOR: CREATED_BY_THIS_COMMIT
HUMAN_GATE_REQUIRED: YES — explicit Shared Staging apply authorization and authorized Staging server/JWT credentials are required to complete the already-frozen Gate 03 acceptance criteria.
NEXT_SAFE_STEP: With explicit Shared Staging mutation authorization, run the read-only preflight, verify project ref and zero-legacy precondition, apply the four pinned migrations in order, and execute hosted JWT/PostgREST/RLS parity. Do not start Gate 04.

PRODUCTION_READ_ACCESSED: NO
PRODUCTION_WRITE_EXECUTED: NO
PRODUCTION_CHANGED: NO
SHARED_STAGING_ACCESSED: NO
SHARED_STAGING_CHANGED: NO
DB_MUTATION: NO
SETTLEMENT_EXECUTED: NO
STRIPE_PROVIDER_OPERATION: NO
REAL_FINANCIAL_TRANSACTION_EXECUTED: NO
DEPLOYED: NO
PUSHED: NO
GATE_04_STARTED: NO
