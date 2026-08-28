# TLV STEP5L PROD Gate 04 Operational Control Record Closeout

Date: 2026-08-29 JST

ACTIVE_TASK: `TLV STEP 5L Production Gate 04`

Parent release anchor: `959436e8514f0eb22951cc3aa24f1293bf113486`

Scope: Production-disconnected recovery audit, writer inventory, reversible freeze control design, static safety proof, isolated PostgreSQL 17.6 proof, Regression, Red-Team, and Independent Judge. Production execution and Gate 05 are excluded.

## Recovery audit

The interrupted working tree was preserved. No reset, revert, or unrelated cleanup was performed. The prior Gate 04 anchors remained:

- candidate checkpoint anchor `5298e7135eafe4dcec910ac4089961329fc2f8de`;
- fail-closed pre-execution anchor `95ee326670b10ab4057e4fbd90334d769bc30d35`;
- Gate 03 parent release anchor `959436e8514f0eb22951cc3aa24f1293bf113486`.

The three required interrupted artifacts were present only as incomplete working-tree work and were completed without duplicating them:

- `docs/TLV_PRODUCTION_OPERATIONAL_CONTROL_RECORD.md`
- `reports/tlv-step5l-prod-gate-04-writer-inventory.md`
- `reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql`

RECOVERY_AUDIT: PASS

## Writer inventory result

The inventory traces browser/API/Edge, auth/credential role, RPC/direct SQL, trigger, table/storage effects, idempotency, retry, stop control, failure, unfreeze, Human control, and Evidence.

- DB commit writer identifiers covered: `10/10`.
- End-to-end financial/attribution writer identifiers covered: `11/11`.
- Reversibly freezable DB commit writers: `10/10`.
- End-to-end writers fully stopped by the DB freeze alone: `10/11`.
- Remaining path: authenticated `tlv-create-coin-purchase` can create a Stripe PaymentIntent before any DB write. Its later webhook commit is frozen, but the provider initiation itself is not stopped by PostgreSQL locks.
- Current Live UI has no coin-purchase call site, but the Edge endpoint has historical Production deployment Evidence. Production was not re-read, so absence/invocation cannot be asserted from Repository alone.

WRITER_INVENTORY_STATUS: COMPLETE_WITH_ONE_EXTERNAL_CONTROL_BINDING

## Selected freeze control

`POSTGRESQL_TRANSACTIONAL_SHARE_LOCK_V1` is a reversible operational use of an existing PostgreSQL primitive, not a deployed kill switch or permanent Production control.

The candidate:

- opens one explicit transaction;
- fails if any required core relation is absent;
- locks 17 required core relations and every present relation in the eight-item auxiliary attribution/config set in deterministic OID order;
- uses `SHARE`, which conflicts with DML's `ROW EXCLUSIVE` but remains compatible with `pg_dump`/SELECT `ACCESS SHARE`;
- emits only relation lock metadata;
- remains active only while the dedicated interactive session and transaction remain open;
- normally unfreezes by `ROLLBACK`;
- emergency-unfreezes by terminating only the recorded backend; session loss also releases locks;
- performs no INSERT, UPDATE, DELETE, DDL, privilege, RLS, secret, or configuration mutation.

No Production canary write is permitted. Production proof is all expected freeze locks granted, zero other granted conflicting locks on target relations, queued writers visible only as ungranted locks blocked by the freeze PID, plus stable T0/T1 read-only fingerprints.

WRITER_FREEZE_CONTROL_STATUS: STATIC_AND_ISOLATED_VALIDATED

PERMANENT_PRODUCTION_CONTROL_ADDED: NO

## Isolated PostgreSQL 17.6 proof

Runner: `scripts/test-tlv-step5l-prod-gate-04-operational-control-isolated.ps1`

Environment: official `postgres:17.6-alpine`, `--network none`, `--rm`, Repository mounted read-only.

Assertions:

- baseline synthetic write: PASS;
- required + auxiliary relation locks: PASS (`25/25`);
- concurrent INSERT blocked/fail-closed: PASS;
- concurrent UPDATE blocked/fail-closed: PASS;
- concurrent DELETE blocked/fail-closed: PASS;
- SELECT during freeze: PASS;
- SECURITY DEFINER RPC-equivalent multi-table transaction blocked: PASS;
- trigger-induced write covered: PASS;
- unlocked-first/locked-second transaction exposes no partial commit: PASS;
- `pg_dump -Fc` succeeds while freeze is held: PASS;
- `pg_restore --list` parses dump: PASS;
- normal `ROLLBACK` unfreeze: PASS;
- emergency backend termination/session-loss equivalent: PASS;
- zero residual locks: PASS;
- post-unfreeze RPC/trigger/write health: PASS;
- container cleanup: PASS.

ISOLATED_FREEZE_TEST: PASS

NORMAL_UNFREEZE: PASS

EMERGENCY_UNFREEZE: PASS

BACKUP_COMPATIBILITY: PASS

PARTIAL_WRITE_RISK: NONE_WITHIN_LOCKED_POSTGRESQL_TRANSACTIONS

The Stripe PaymentIntent initiation gap is not a partial PostgreSQL commit; it is a separate external-writer control requirement.

## Static QA and Red-Team

- operational control static contract: PASS (`12/12`);
- Red-Team: PASS (`15/15`);
- bypasses checked: legacy direct live tip, terminal webhook fallback, refund/dispute side tables, ads/admin attribution, missing core table, noninteractive session misuse, session loss, Production canary write, provider race, checkpoint gap, self-review, invented storage/retention, credential exfiltration, Staging/candidate-migration scope escape.

RED_TEAM_STATUS: PASS (15/15)

## Inherited Gate 02/03 Regression

One FIXABLE verification defect was found: the untracked STEP 5E historical verifier still expected only the older STEP 5K single-file drift. Gate 02's Human-approved progressive release anchor legitimately changed five pinned SSOT/runtime files. The historical STEP 5E package hash remains unchanged. The verifier was updated to allow exactly those five current hashes and no others.

Detect -> Fix -> Re-run result:

- settlement core/security and STEP 4 Judge;
- OPTION_A test and 9/9 Judge;
- STEP5K test and Judge;
- economics core 28/28;
- economics contribution 18/18;
- TLV payment logic;
- chargeback 13/13;
- RLS cross-user 45/45;
- STEP 5E historical/current split;
- Gate 02 progressive Judge 13/13;
- Gate 03 Judge 8/8.

REGRESSION_STATUS: PASS (15/15 suites)

FIXES_EXECUTED: 2 (`isolated expected-error handling`, `STEP5E verifier Gate02 progressive baseline`)

## Operational role, storage, and credential controls

AI-resolved role contract:

- Operator: Eng Production DB Operator;
- Independent Reviewer: FinOps Independent Reviewer, different identity from Operator;
- Recovery Owner: Eng/DBA Production Recovery role;
- Cleanup Owner: Eng Production DB Operator with Reviewer attestation.

Role responsibilities and separation are complete. Actual authorized identities, ticket, and window are runtime bindings and are not fabricated in the Repository.

No approved encrypted external backup destination, retention period, access list, or Gate 04 Production DB credential route was found. The control record defines the mandatory properties and fail-closed delivery contract, but does not create a bucket/service/KMS key/credential or choose a retention period.

PITR_STATUS: DISABLED

PITR_ENABLED_BY_GATE04: NO

OPERATIONAL_ROLE_STATUS: CONTRACT_COMPLETE_IDENTITY_BINDING_REQUIRED

BACKUP_STORAGE_CONTROL_STATUS: REQUIREMENTS_COMPLETE_APPROVED_DESTINATION_BINDING_REQUIRED

CREDENTIAL_DELIVERY_CONTROL_STATUS: CONTRACT_COMPLETE_APPROVED_ROUTE_BINDING_REQUIRED

ROLE_CREDENTIAL_CONTRACT: PASS_WITH_RUNTIME_BINDINGS_REQUIRED

## AI resolved controls

1. complete Repository writer inventory and transaction boundaries;
2. rejection of the unwired app circuit breaker;
3. reversible PostgreSQL SHARE-lock mechanism for all DB commit writers;
4. required/auxiliary relation sets and fail-closed missing-table behavior;
5. normal/emergency unfreeze and secret-free Evidence contract;
6. role responsibilities and separation of duties;
7. backup encryption/access/hash/cleanup requirements;
8. credential non-disclosure and Shared-Staging-MCP deny contract;
9. PITR-disabled boundary;
10. isolated lock/read/dump/RPC/trigger/partial-write validation;
11. Regression, Red-Team, and independent static acceptance criteria.

AI_RESOLVED_CONTROLS: 11

## Human required controls

One bundled execution binding is still required before any Production connection. Existing Gate 04 approval does not need to be repeated.

1. `EXTERNAL_INITIATION_CONTROL`: identify an already-approved/already-deployed control that denies `tlv-create-coin-purchase` invocation during the checkpoint, or provide authoritative current Evidence that it is not invocable. Do not deploy a new kill switch.
2. `EXECUTION_BINDING`: authorized Operator, separate Independent Reviewer, Recovery Owner, Cleanup Owner, existing change-ticket ID, and JST/UTC window.
3. `BACKUP_STORAGE_BINDING`: approved encrypted non-Repository destination identifier, retention period, least-privilege access list, Cleanup Owner identity, and deletion/expiry policy reference.
4. `CREDENTIAL_ROUTE_BINDING`: approved server-only secret-route identifier and authorized credential-holder/Operator identity; no credential value.

HUMAN_REQUIRED_CONTROLS: 4

These are operational bindings, not requests for new financial policy or technical Repository investigation.

## Independent Judge and safety

INDEPENDENT_JUDGE: PASS

PRODUCTION_OPERATIONAL_CONTROL_RECORD_STATUS: TECHNICAL_CONTRACT_COMPLETE_EXECUTION_BINDING_REQUIRED

GATE_04_STATUS: BLOCKED

GATE_04_BLOCKER: SINGLE_BUNDLED_OPERATIONAL_EXECUTION_BINDING

PRODUCTION_CONNECTED: NO

PRODUCTION_READ_ACCESSED: NO

PRODUCTION_SQL_EXECUTED: NO

PRODUCTION_SECRET_READ: NO

PRODUCTION_WRITE_EXECUTED: NO

PRODUCTION_CHANGED: NO

PRODUCTION_LOCK_ACQUIRED: NO

PRODUCTION_BACKUP_EXECUTED: NO

SHARED_STAGING_ACCESSED: NO

SHARED_STAGING_CHANGED: NO

MIGRATION_APPLIED: NO

SETTLEMENT_EXECUTED: NO

PAYOUT_REFUND_TRANSFER_EXECUTED: NO

REAL_FINANCIAL_TRANSACTION_EXECUTED: NO

DEPLOYED: NO

PUSHED: NO

GATE_05_STARTED: NO

HUMAN_GATE_REQUIRED: YES

NEXT_HUMAN_GATE: Supply the four non-secret runtime bindings above in one control record. Production execution remains stopped.

## Evidence paths

- `docs/TLV_PRODUCTION_OPERATIONAL_CONTROL_RECORD.md`
- `reports/tlv-step5l-prod-gate-04-writer-inventory.md`
- `reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql`
- `scripts/sql/tlv-step5l-gate04-freeze-fixture.sql`
- `scripts/test-tlv-step5l-prod-gate-04-operational-control-isolated.ps1`
- `scripts/test-tlv-step5l-prod-gate-04-operational-control.mjs`
- `scripts/red-team-tlv-step5l-prod-gate-04-operational-control.mjs`
- `scripts/judge-tlv-step5l-prod-gate-04-operational-control.mjs`
- `reports/tlv-step5l-prod-gate-04-operational-control-sha256.txt`
