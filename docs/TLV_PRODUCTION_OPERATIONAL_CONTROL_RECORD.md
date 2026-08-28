# TLV Gate 04 Production Operational Control Record

Status: `CONTROL_CONTRACT_COMPLETE_EXECUTION_BINDING_REQUIRED`

Control ID: `TLV-STEP5L-PROD-GATE04-CHECKPOINT-V1`

Parent release anchor: `959436e8514f0eb22951cc3aa24f1293bf113486`

Scope: Gate 04 only. This record controls a temporary, reversible freeze of TLV financial database writers, a logical backup checkpoint, an isolated PostgreSQL 17.6 restore, verification, unfreeze, and cleanup. It does not authorize a migration, disposition, Settlement, payout, refund, transfer, provider mutation, deploy, PITR enablement, Gate 05, or Production schema/data mutation.

## Authority and fail-closed state

This file is the Repository SSOT for the Gate 04 operational control contract. It supersedes the earlier statement that no freeze mechanism had been selected, but it does not instantiate an execution ticket by itself.

Before the first Production connection, an execution record must bind all fields marked `HUMAN_BINDING_REQUIRED`. Missing or conflicting binding is `ABORT_NO_CONNECTION`. Existing Gate 04 Human approval remains valid and is not requested again.

PITR is disabled for Production according to `docs/supabase-environments.md`. This control does not enable PITR and does not treat a logical dump as PITR.

## Writer freeze control

### Selected mechanism

`POSTGRESQL_TRANSACTIONAL_SHARE_LOCK_V1` uses PostgreSQL table-level `SHARE` locks in one dedicated transaction:

- `SHARE` conflicts with the `ROW EXCLUSIVE` lock acquired by `INSERT`, `UPDATE`, and `DELETE`.
- `SHARE` is compatible with the `ACCESS SHARE` lock used by `pg_dump`, so the logical dump can run while writers are blocked.
- no GRANT, RLS, schema, application, secret, or data change is made;
- normal unfreeze is `ROLLBACK` in the lock-owning session;
- session loss automatically releases all locks;
- emergency unfreeze is termination of only the recorded lock-owning backend by the Recovery Owner, followed by proof that its locks are gone.

The executable candidate is `reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql`. It must be loaded in an interactive, dedicated `psql` session. Running it with a noninteractive client that exits immediately is invalid because the transaction would be rolled back and the freeze would disappear.

The lock acquisition may wait for already-running transactions. A successful lock Evidence row therefore proves pre-existing conflicting DML completed before the checkpoint. New financial DML waits behind the locks and is released after unfreeze. Provider/API requests may time out and retry; existing webhook idempotency remains mandatory. The freeze window must be kept short.

### Target writer inventory

The detailed source-to-table inventory is in `reports/tlv-step5l-prod-gate-04-writer-inventory.md`. The freeze SQL fails closed if any required core table is absent and locks every discovered auxiliary attribution/config table.

| Writer identifier | Write path and trigger/source | Freeze mechanism | Stopped proof | Normal / emergency unfreeze | Post-unfreeze health |
| --- | --- | --- | --- | --- | --- |
| `TLV_TIP_RPC` | Browser `live/live-tips.js` -> `tlv-create-tip` -> `tlv.create_tip_transaction` | lock all RPC mutation targets, beginning with `tlv.coin_lots`/`tlv.tips` | all required locks granted; stable financial fingerprint; no target DML in `pg_stat_activity` | `ROLLBACK` / terminate recorded freeze PID | lock count zero; read-only health query; no failed/partial ledger transaction |
| `TLV_PAYMENT_WEBHOOK` | Stripe webhook -> success/refund/dispute RPCs and provider-event fallback writes | lock `payment_provider_events`, payments, wallet, lots, ledgers, creators, payout/reversal targets | same lock and activity Evidence; provider-event fingerprint stable | same | idempotent retry can resume; read-only provider-event status check |
| `TLV_COIN_PURCHASE_INITIATION` | verified viewer -> Stripe PaymentIntent; future webhook writes TLV DB | database-side webhook targets locked; external initiation is not a DB write and is not mutated by Gate 04 | no committed DB financial change during window; in-flight provider event count captured read-only | same | queued/retried webhook health reviewed without provider mutation |
| `LEGACY_PUBLIC_LIVE_TIP` | authenticated direct insert to `public.live_tips`; insert trigger updates `live_broadcasts` | lock both tables | both locks granted and fingerprint stable | same | lock count zero; read-only row/count health |
| `TLV_AD_ATTRIBUTION` | `live-security-events` impression/view ingestion | lock impression/view tables | discovered table locks granted; no target DML | same | read-only ingestion-table health; no test impression is written |
| `TLV_MONETIZATION_ADMIN` | admin eligibility/RPM/risk action | lock monetization/RPM/audit and affected video/profile tables | discovered table locks granted; no target DML | same | read-only config fingerprint; no admin mutation test |
| `MANUAL_SERVICE_ROLE_SQL` | privileged SQL/RPC outside normal UI | change ticket prohibits financial DML; database locks are the technical backstop | lock Evidence plus activity review | same | reviewer confirms ticket/window closed |
| `SETTLEMENT_PAYOUT_DISPOSITION_CANDIDATE` | four Gate 02 candidate migrations/functions | not deployed to Production per Gate 04 preflight; invocation is denied | target migrations/functions remain absent | not applicable | preflight absence remains true |

### Freeze sequence

1. Operator and Reviewer confirm the execution binding, target Production ref, deny Shared Staging, and record the ticket/window.
2. Operator opens one dedicated Production DB session through the approved credential-delivery path and loads the freeze SQL interactively.
3. The SQL acquires required locks in deterministic relation-OID order and emits only non-secret lock metadata, including `freeze_backend_pid` and `freeze_tx_started_at`.
4. Reviewer confirms every expected freeze lock is granted, no freeze lock is ungranted, no other session owns a granted conflicting lock on a target relation, any queued writer lock is ungranted and blocked by the recorded freeze PID, and the preflight fingerprint is unchanged.
5. Operator keeps the freeze session open while the backup runs in a separate read-only connection.
6. On backup/checkpoint completion, Operator runs `ROLLBACK` in the freeze session. Reviewer proves the recorded PID no longer owns target locks.
7. If the session is unavailable or normal rollback fails, Recovery Owner terminates only the recorded PID using the approved database operational console, then proves its locks are absent.
8. Post-unfreeze checks are read-only. No canary `INSERT`, `UPDATE`, or `DELETE` is permitted in Production.

## Operational roles

Role-based assignment is authoritative; actual authorized identities are bound in the execution ticket.

| Control role | Existing role alignment | Responsibility | Separation rule | Binding |
| --- | --- | --- | --- | --- |
| Operator | Eng Production DB Operator | validate endpoint, acquire/hold/release locks, run dump, perform temporary cleanup | cannot approve own Evidence | `HUMAN_BINDING_REQUIRED` authorized identity |
| Independent Reviewer | FinOps Independent Reviewer | verify environment, lock/fingerprint/hash/restore/cleanup Evidence | must be a different identity from Operator | `HUMAN_BINDING_REQUIRED` authorized identity |
| Recovery Owner | Eng/DBA Production Recovery role | own emergency unfreeze and restore escalation; never perform routine financial disposition | may not be the only reviewer | `HUMAN_BINDING_REQUIRED` authorized identity |
| Cleanup Owner | Eng Production DB Operator | remove temporary plaintext and enforce approved object expiry/deletion | Reviewer attests completion | may equal Operator; identity bound in ticket |

No person name is stored in the Repository. The execution ticket records role, authorized identity, ticket ID, and timestamps without credential values.

## Freeze Evidence contract

Evidence must contain no credential, token, connection string, raw provider payload, or user data.

| Evidence | Required minimized fields | Acceptance |
| --- | --- | --- |
| freeze started | control ID, ticket ID, UTC/JST timestamp, Production ref, freeze PID, transaction start, expected/locked relation counts | all required locks granted; environment is Production and not Shared Staging |
| writers stopped | granted `SHARE` locks by schema/table, zero ungranted freeze locks, zero other granted conflicting locks, queued writer locks only as ungranted/blocked by freeze PID, stable preflight JSON/hash at T0/T1 | no writer can pass the relation-lock boundary and no committed financial fingerprint drift |
| window maintained | start/end timestamps, periodic lock count and fingerprint hashes | continuous locks; any gap invalidates checkpoint |
| emergency capability | isolated-test result plus Recovery Owner role binding and exact recorded PID procedure | no Production termination test is required or permitted merely for Evidence |
| normal unfreeze | `ROLLBACK` timestamp and zero locks for recorded PID | all locks removed |
| post-unfreeze health | read-only preflight/status summary and queued webhook/error review | no partial transaction, unexpected drift, or persistent lock |

## Backup storage control

No approved encrypted external backup destination or retention period is identified in the Repository. Therefore backup execution remains fail-closed until the execution ticket binds an organization-approved destination.

The selected destination must satisfy all of the following:

- outside the Repository and never under a Git worktree;
- encrypted in transit and at rest using organization-controlled encryption;
- private by default with least-privilege, auditable access;
- Operator may create the object, Recovery Owner may restore it, Reviewer receives metadata/hash only unless restore access is explicitly required;
- explicit retention duration and automatic expiry/deletion procedure;
- Cleanup Owner and deletion/expiry verification timestamp;
- SHA-256 and byte size calculated after each artifact closes and independently checked after retrieval;
- no backup body, plaintext exact-seven export, credential, secret, or connection string in Git/Evidence;
- temporary plaintext is avoided; if tooling necessarily creates it, it must be on an approved encrypted ephemeral volume with restrictive ACL and securely removed immediately after verification.

`HUMAN_BINDING_REQUIRED`: approved destination identifier (not credential), retention period, authorized access roles/identities, Cleanup Owner identity, and deletion/expiry policy reference. Creating an external service, bucket, KMS key, or credential is outside Gate 04.

## Credential delivery control

No approved Gate 04 Production DB credential route is identified in the Repository or current process. The Repository's Supabase MCP configuration is Shared Staging-only and must never be repointed to Production.

The execution contract is:

1. an authorized secret administrator makes an existing server-only, least-privilege Production backup credential available to the bound Operator through the organization's approved secret store or process-scoped injection;
2. the value is injected only into the Operator process (for example a non-echoed process environment variable or file descriptor), never typed into a recorded command, chat, report, repository file, shell history, or command output;
3. the client requires TLS and verifies the exact Production endpoint/project ref before connection; Shared Staging ref is an explicit deny;
4. preflight and dump connections are read-only where supported; the dedicated freeze session has only the lock capability required by this contract and executes no DML/DDL;
5. the value is removed from the process environment after cleanup; Evidence records only route ID, role, and presence/absence.

`HUMAN_BINDING_REQUIRED`: approved secret-route identifier and authorized credential-holder/Operator identity. Do not generate, retrieve, rotate, print, or store a credential as part of this record.

## Static and isolated validation

The following are mandatory before Production execution:

- `node scripts/test-tlv-step5l-prod-gate-04-operational-control.mjs`
- `powershell -ExecutionPolicy Bypass -File scripts/test-tlv-step5l-prod-gate-04-operational-control-isolated.ps1`
- `node scripts/red-team-tlv-step5l-prod-gate-04-operational-control.mjs`
- `node scripts/judge-tlv-step5l-prod-gate-04-operational-control.mjs`

The isolated test proves DML blocking, `pg_dump` compatibility, normal rollback, emergency session termination, and post-unfreeze DML recovery using synthetic data under `--network none`. It is not Production Evidence.

## Human execution binding

One bundled Human/operations action remains before any Production connection:

- bind the four authorized identities in the existing change ticket;
- bind the approved encrypted external destination, retention, access list, Cleanup Owner, and deletion policy reference;
- bind the approved server-only credential delivery route to the Operator;
- bind the approved JST/UTC window and ticket identifier.

No new financial/business policy decision is required. After these bindings exist, the already-approved Gate 04 execution can proceed under the existing approval; this record does not ask for that approval again.
