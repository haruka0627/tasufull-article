# TLV STEP5L PROD — Gate 04 Production Backup/Restore Checkpoint Runbook

Status: `CANDIDATE_REQUIRES_PRODUCTION_ACCESS_APPROVAL`

Parent release anchor: `959436e8514f0eb22951cc3aa24f1293bf113486`

Scope: fresh Production read-only preflight, reviewed backup evidence, isolated restore proof, and writer-freeze/runbook acceptance. This runbook does not authorize or execute a migration, disposition, ledger correction, settlement, payout, refund, provider call, deploy, or Gate 05.

## Fail-closed prerequisites

Before any Production connection, record all of the following in one approved change ticket:

1. Production project ref `ddojquacsyqesrjhcvmn` and explicit denial of Shared Staging ref `ahlxuyvhzqdqaojiywmu`.
2. Approved read/backup window in JST and UTC.
3. Named operator, independent reviewer, recovery owner, and change-ticket identifier.
4. Approved writer-freeze mechanism and the owner who can prove it active. Repository Evidence does not define a safe universal freeze command; do not invent one.
5. Encrypted backup destination outside the Repository, retention period, access list, and deletion owner.
6. Approved server-only Production credential delivery. Never persist it in Repository files, shell history, command output, or Evidence.
7. Confirm that no migration, financial function, Settlement job, provider transfer/payout, or application deploy is included in this Gate.

Missing any prerequisite is `ABORT_NO_CONNECTION`.

## Phase 1 — fresh Production read-only preflight

Use a disposable Production-only CLI/work directory. Do not relink the Repository's Shared Staging configuration. Before opening the connection, independently compare the intended project ref with the fixed Production and deny refs above.

Execute only:

`reports/sql/tlv-step5l-prod-gate-04-production-readonly-preflight.sql`

The SQL starts a transaction, enforces `SET TRANSACTION READ ONLY`, emits one aggregate JSON result, and rolls back. Retain no raw user/account/provider payload.

Expected continuation conditions:

- `transaction_read_only=on`;
- PostgreSQL `17.6` or a separately reviewed compatible patch level;
- exact target/case/full-signature counts `7/7/7`;
- Gross/Net/platform `145000/145000/145000`, fee and Creator payable `0`;
- exact-source hash `8d8e08d120ac8946e63485764aff5edf3ac3b56cf9a5e29ca1f7a18fe2179fe3`;
- allocation, wallet debit, and provider-event counts `0`;
- `payout_log=0` and `creator_score_monthly=0`;
- legacy Score FK present;
- all four target migration versions absent;
- disposition registry absent and Synthetic QA correction count `0`.

Any drift, partial disposition/correction, nonzero payout/score row, unexpected target migration, missing exact-seven signature, or non-read-only session is `ABORT_REVIEW_REQUIRED`. Do not reinterpret drift as compatibility.

## Phase 2 — writer-freeze checkpoint

The approved operator activates the separately approved TLV payment/payout writer-freeze mechanism. The reviewer records:

- activation timestamp;
- mechanism/change identifier;
- affected writer list;
- proof that new TLV financial writes are not entering the database;
- emergency unfreeze owner and command/runbook reference.

This Gate does not select or implement the freeze mechanism. Database privilege mutation, application deploy, live disable, or secret change needs its own explicit authorization if selected.

Repeat the read-only aggregate immediately after freeze. Counts and hash must match Phase 1 before backup begins.

## Phase 3 — backup package

Create all artifacts from the frozen Production state:

1. custom-format full logical database dump (`pg_dump -Fc --no-owner`);
2. TLV schema-only dump (`pg_dump -s --no-owner`);
3. encrypted exact-seven source snapshot filtered by the seven literal idempotency keys;
4. the minimized preflight JSON;
5. migration catalog, affected object/RLS/policy/grant/function fingerprints;
6. metadata containing environment, server/client versions, start/end timestamps, operator, reviewer, ticket, writer-freeze proof, file sizes, and SHA-256 values.

Requirements:

- restrictive local ACL before data is written;
- encrypted at rest and in transit;
- no Repository path, commit, chat attachment, or shared staging bucket;
- checksums calculated after each file is closed;
- `pg_restore --list` must parse the custom dump;
- backup copy and checksum record reviewed independently.

## Phase 4 — isolated restore verification

Restore into a separate, disposable PostgreSQL 17.6 database. Never restore over Production or Shared Staging.

Verify:

- full restore completes without ignored errors;
- schema/RLS/policy/grant/function and migration fingerprints match the backup checkpoint;
- exact-seven counts, amounts, relation counts, and source hash match;
- `payout_log=0`, `creator_score_monthly=0`, no disposition/correction, and no target migrations remain true;
- the Gate 04 read-only preflight returns the same state except database name/capture time;
- cleanup removes the disposable restore and temporary plaintext material after Evidence is accepted.

The Repository runner `scripts/test-tlv-step5l-prod-gate-04-backup-restore-isolated.ps1` proves these mechanics against synthetic data only. It is not Production backup Evidence.

## Phase 5 — checkpoint acceptance and stop

The operator and independent reviewer sign the artifact manifest and restore result. Record only minimized metadata and hashes in Repository Evidence; never commit a dump, source CSV, credential, or raw Production output.

After acceptance:

- unfreeze only according to the approved operational decision;
- do not apply migrations or invoke `apply_synthetic_qa_disposition_v1`;
- do not run Settlement or provider operations;
- close Gate 04 and stop.

Production schema/data mutation remains Gate 05 or another separately authorized ACTIVE_TASK.

## Rollback and emergency boundary

- Preflight/backup failure: stop, retain no incomplete artifact as valid Evidence, and follow approved secure deletion.
- Restore failure: keep Production unchanged; investigate the backup/checkpoint. Do not proceed.
- Unexpected Production write during capture: invalidate the package, stop, and re-enter from Phase 1 under a new approved window.
- No append-only Production financial row is created in Gate 04, so no financial rollback is expected.
- A database disaster restore and PITR are incident operations, not routine Gate 04 rollback.
