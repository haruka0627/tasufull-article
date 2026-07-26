# ANPI Phase 19 — Commit Plan

**Status:** READY for selective stage (human-approved `git add` only)  
**Scope:** ANPI Phase 12–18 formal artifacts + Phase 19 isolation docs  
**Forbidden in this plan:** Production · Push · Realtime enable · staging writes · `git add -A`

## Current operational status (SSOT after Phase 18)

```text
Phase 18: PASS
Staging DB notification path: VERIFIED
Polling path: VERIFIED
Realtime: KEEP_DISABLED
Push: NO-GO
Production: NO-GO
Final inbox / markers: 0
Feature flag: OFF
```

Older Phase 12–17 docs/reports are **historical**. Look for:

> Historical phase result. Superseded by Phase 18 for current operational status.

## Commit boundaries

### Commit A — Security and identity foundation (Phase 12–15)

**Purpose:** privilege hardening, identity mapping, canonical TALK identity, reader/writer parity.

**Includes (19 files):**

- `sql/anpi-phase12-*` (sync + rollback)
- `sql/anpi-phase14-*` (hardening + rollback)
- `sql/anpi-phase15-*` (foundation + seed + rollback)
- Phase 12/15 docs · Phase 12–15 formal reports
- Phase 12/14/15 static + local verifiers

**Excludes:** `_anpi-phase13-apply/` · `_anpi-phase14-hardening/` · `_anpi-phase15-identity/`

### Commit B — Retention and readiness controls (Phase 16–17)

**Purpose:** retention purge (dry-run default), scheduler-disabled note, first-insert gate, cleanup, emergency disable.

**Includes (17 files):**

- `sql/anpi-phase16-*` · `sql/anpi-phase17-*`
- Phase 16 checklist/runbook · Phase 17 readiness doc
- Phase 16–17 formal reports · static/local/staging-RO verifiers

**Warning:** Phase 17 SQL is **STAGING TEST ONLY / DO NOT APPLY TO PRODUCTION**.

**Excludes:** `_anpi-phase16-enablement/` · `_anpi-phase17-readiness/`

### Commit C — First staging verification evidence (Phase 18)

**Purpose:** first INSERT evidence (masked), polling/idempotency/cleanup/disable, post-state verifier.

**Includes (3 files):**

- `docs/anpi-phase18-first-staging-notification-insert-runbook.md`
- `reports/anpi-phase18-first-staging-notification-insert.md`
- `scripts/verify-anpi-phase18-first-insert.mjs`

**Excludes:** `reports/_anpi-phase18-insert/` (local raw evidence)

### Commit D — Commit isolation audit (Phase 19)

**Purpose:** inventory, classification, scan results, stage plan.

**Includes (3 files):**

- `docs/anpi-phase19-commit-plan.md` (this file)
- `reports/anpi-phase19-commit-isolation-audit.md`
- `reports/anpi-phase19-commit-files.tsv`

## Explicitly out of scope (do not stage)

| Path pattern | Reason |
| --- | --- |
| `reports/_anpi-phase*/` | Regenerable step SQL/JSON; formal reports summarize |
| `reports/_anpi-phase11-audit/` | Phase 11 · outside 12–18 |
| `scripts/_anpi-phase19-*.mjs` | Local scan helpers |
| Non-ANPI dirty | Unrelated products / dist / UI |

## Suggested stage commands (human only · selective)

```bash
# Commit A example (explicit paths only — never git add -A)
git add \
  sql/anpi-phase12-talk-staging-schema-sync.sql \
  sql/anpi-phase12-talk-staging-schema-sync-rollback.sql \
  sql/anpi-phase14-talk-staging-privilege-hardening.sql \
  sql/anpi-phase14-talk-staging-privilege-hardening-rollback.sql \
  sql/anpi-phase15-talk-identity-mapping-foundation.sql \
  sql/anpi-phase15-talk-identity-mapping-seed.sql \
  sql/anpi-phase15-talk-identity-mapping-rollback.sql \
  docs/anpi-phase12-talk-staging-schema-apply.md \
  docs/anpi-phase15-talk-identity-mapping-apply.md \
  reports/anpi-phase12-talk-staging-schema-sync.md \
  reports/anpi-phase13-talk-staging-manual-apply.md \
  reports/anpi-phase14-talk-staging-privilege-hardening.md \
  reports/anpi-phase15-talk-identity-mapping-foundation.md \
  scripts/test-anpi-phase12-talk-staging-schema-sync.mjs \
  scripts/test-anpi-phase14-talk-staging-privilege-hardening.mjs \
  scripts/test-anpi-phase15-talk-identity-mapping.mjs \
  scripts/verify-anpi-phase12-talk-staging-schema-local.mjs \
  scripts/verify-anpi-phase14-talk-staging-privilege-hardening-local.mjs \
  scripts/verify-anpi-phase15-talk-identity-mapping-local.mjs

git diff --cached --name-status
# human review → commit message → only if approved
```

Repeat similarly for B / C / D using `reports/anpi-phase19-commit-files.tsv` (`include=YES` · `commit_group`).

## Pre-stage checklist

1. `git diff --cached --name-only` shows **only** ANPI paths from one commit group
2. Final secret scan on staged set: **0 BLOCKER**
3. Phase 18 post-state still clean (optional read-only re-check)
4. No production apply commands staged as runnable runbooks without DENY

## Not performed in Phase 19

```text
git add / commit / push / deploy — not executed
staging INSERT/UPDATE/DELETE/schema apply — not executed
feature flag ON — not executed
```

## Post-audit execution status

Phase 19 plan above is the historical pre-commit record. After selective commits:

```text
Commit A completed: 2287fd011b829c2442802473d121ebb3e5ed3296
Commit B completed: 5d560abfc61fee49405011bb9eac8b880480234f
Commit C completed: 063481c56f066bc5a302781365cb9f9684b56623
Commit D pending at time of this note
```

Push / deploy remain out of scope until explicit human authorization.
