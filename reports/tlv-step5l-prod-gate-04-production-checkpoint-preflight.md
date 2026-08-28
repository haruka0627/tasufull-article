# TLV STEP5L PROD — Gate 04 Production Checkpoint Preflight

Date: 2026-08-29 JST

Parent release anchor: `959436e8514f0eb22951cc3aa24f1293bf113486`

Formal scope: `PRODUCTION_BACKUP_RESTORE_CHECKPOINT_AND_WRITER_FREEZE_RUNBOOK_APPROVAL`

GATE_04_STATUS: TECHNICAL_PREFLIGHT_COMPLETE

GATE_04_VERDICT: BLOCKED

## Scope recovery

Gate 04 was not newly invented. `reports/tlv-production-readiness-step5j-final-implementation-plan.md` §15 defines remaining gate 4 as backup/restore checkpoint acceptance and Production writer-freeze/runbook approval. Gate 02 refines it into a fresh Production read-only preflight, full logical/schema/source-seven backup, secure retention/checksums, operator/reviewer identity, and isolated restore verification after Shared Staging parity. Gate 03 closed that prerequisite.

This Gate excludes Production migration/data mutation, invocation of the Synthetic QA disposition function, Settlement, payout, refund, provider operations, deploy, Gate 05, and unrelated local-only migration drift.

GATE_04_SCOPE_RECOVERY: PASS

LOCAL_ONLY_MIGRATION_DRIFT_INCLUDED: NO

## Acceptance criteria

1. Parent anchor and four migration hashes remain fixed.
2. Fresh Production read-only preflight proves exact 7/7/7 signature, zero payout/score/correction/disposition, four target versions absent, and the expected legacy FK before backup.
3. An approved writer-freeze is activated and independently evidenced.
4. Full logical, TLV schema-only, exact-seven minimized, catalog, and metadata artifacts are captured securely with sizes and SHA-256.
5. The custom dump parses and restores into a separate PostgreSQL 17.6 database.
6. Restored schema/RLS/migration state and exact-seven fingerprint match the captured checkpoint.
7. Operator, independent reviewer, recovery owner, approved window, retention, encryption, access list, and cleanup are evidenced.
8. Regression, Red-Team, and Independent Judge pass.
9. Production migration/data mutation, financial execution, deploy, push, and Gate 05 remain zero.

## Repository technical package

- `reports/tlv-step5l-prod-gate-04-scope-recovery.txt`
- `reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql`
- `reports/tlv-step5l-prod-gate-04-production-checkpoint-runbook.md`
- `scripts/test-tlv-step5l-prod-gate-04-backup-restore-isolated.ps1`
- `scripts/test-tlv-step5l-prod-gate-04-preflight.mjs`
- `scripts/judge-tlv-step5l-prod-gate-04.mjs`
- `reports/tlv-step5l-prod-gate-04-sha256.txt`

The Production SQL begins `BEGIN`, enforces `SET TRANSACTION READ ONLY`, emits one aggregate JSON result, and ends with `ROLLBACK`. Static scanning found no mutation keyword in executable SQL.

PRODUCTION_READ_ONLY_PREFLIGHT_PREPARED: YES

PRODUCTION_READ_ONLY_PREFLIGHT_EXECUTED: NO

## Isolated PostgreSQL 17.6 result

The candidate was exercised in official `postgres:17.6-alpine` with `--network none`, `--rm`, and a read-only Repository mount.

Synthetic prestate:

- exact source/case/full-signature: `7/7/7`;
- Gross/Net/platform: `145000/145000/145000`;
- fee/Creator payable: `0/0`;
- allocation/wallet/provider event: `0/0/0`;
- source SHA-256: `8d8e08d120ac8946e63485764aff5edf3ac3b56cf9a5e29ca1f7a18fe2179fe3`;
- target migration history: empty;
- payout/score/correction/disposition: `0/0/0/absent`;
- transaction read-only: `on`.

Ephemeral checkpoint artifacts inside the disposable container:

| Artifact | Mode | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| full custom dump | 600 | 210897 | `450b44ce608e830aacf10f568f6dfd5a4605f18f0a4268dc5e0e97428bf316d6` |
| schema SQL | 600 | 155674 | `9a5196a83d11ae152cb1bd989ae16b59335168797e7b09b4550d63333db700c4` |
| exact-seven CSV | 600 | 1844 | `0fe2e0e57b32d47e17b31cb1f8accb100d7c4acbb5c5b54580b88c7c68bae48c` |

`pg_restore --list` parsed the custom dump. Restore into a separate database passed, and the full read-only preflight plus exact-seven amount/fingerprint assertion passed again. The container was removed; no Gate 04 container remains.

The local schema fixture includes current Repository candidate objects and is not represented as an exact Production catalog clone. Saved STEP 5C provides the last Production catalog shape; only a fresh approved Production preflight can close the environment evidence.

GATE_04_BACKUP_RESTORE_ISOLATED: PASS

ISOLATED_NETWORK: NONE

ISOLATED_CONTAINER_CLEANUP: PASS

PRODUCTION_BACKUP_CREATED: NO

PRODUCTION_RESTORE_REHEARSED: NO

## Regression and Red-Team

Repository/static checks verify:

- project-ref allow/deny markers are present;
- SQL cannot mutate and always rolls back;
- exact-seven matching is not month/amount-only;
- partial/drift states must abort;
- backup destination cannot be the Repository;
- dump parsing and separate-database restore are mandatory;
- writer freeze is not invented from missing Repository policy;
- no destructive rollback of append-only history;
- Production migrations/functions/Settlement/provider/deploy remain prohibited.

Gate 03 and current settlement/OPTION_A/STEP5K suites remain the inherited implementation Regression baseline. Gate 04 changes no financial runtime or migration.

REGRESSION: PASS

RED_TEAM: PASS

INDEPENDENT_JUDGE: PASS

## Remaining Human Gate

The technical package is complete, but Gate 04 cannot receive PASS without real Production checkpoint Evidence. Repository policy prohibits autonomous Production operation and no Production secret access, backup window, secure destination, writer-freeze mechanism, or named operator/reviewer was authorized in this task.

Bundle the following once:

1. authorize the fresh Production read-only preflight and logical backup checkpoint only;
2. identify the approved window, operator, independent reviewer, and recovery owner;
3. approve the existing operational writer-freeze mechanism or supply its authoritative runbook reference;
4. specify the encrypted non-Repository destination, retention, access list, and cleanup owner;
5. authorize approved human/manual access to the Production server-only credential for this checkpoint;
6. return the minimized preflight JSON, artifact sizes/SHA-256, restore-verification result, and writer-freeze evidence.

This approval must not include migration apply, disposition invocation, Settlement, payout/refund/provider operation, deploy, or Gate 05.

HUMAN_GATE_REQUIRED: YES

HUMAN_GATE_REASON: PRODUCTION_ACCESS_BACKUP_DESTINATION_WRITER_FREEZE_AND_OPERATOR_REVIEW_EVIDENCE_REQUIRED

## Safety status

PRODUCTION_READ_ACCESSED: NO

PRODUCTION_WRITE_EXECUTED: NO

PRODUCTION_CHANGED: NO

SHARED_STAGING_ACCESSED: NO

SHARED_STAGING_CHANGED: NO

DB_MUTATION_OUTSIDE_ISOLATED_CONTAINER: NO

MIGRATION_APPLIED: NO

DISPOSITION_INVOKED: NO

SETTLEMENT_EXECUTED: NO

PAYOUT_REFUND_TRANSFER_EXECUTED: NO

STRIPE_PROVIDER_OPERATION: NO

REAL_FINANCIAL_TRANSACTION_EXECUTED: NO

DEPLOYED: NO

PUSHED: NO

GATE_05_STARTED: NO

NEXT_SAFE_STEP: An authorized human operator executes only the Gate 04 checkpoint runbook under the bundled approval, returns minimized Evidence, and stops before any Production mutation.
