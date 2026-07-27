# ANPI Phase 61 — Staging Scoped Job Writer Report

**Date:** 2026-07-27  
**Production ops:** NOT PERFORMED  
**Cron provider flip:** NOT PERFORMED

---

## Verdict

```text
ANPI_STAGING_SCOPED_JOB_WRITER: PASS
ANPI_PHASE62_CRON_SOAK: NO-GO (needs claim allowlist SQL + Cron wiring)
ANPI_PRODUCTION_REAL_INBOX_SEND: NOT READY
```

---

## Job-writer構成

| Piece | Choice |
|-------|--------|
| Path | JS scoped writer → `talk_notifications` |
| Contract | `anpi.talk.contract.v1` (Phase 10 catalog titles) |
| Row | `type=anpi` · `target_url=#` · `source=anpi_phase61_test` |
| Presentation | `official_anpi` (documented; Phase 59 RLS reused) |
| Why not `create_internal` | Phase 8 key is `anpi:{job_id}:{attempt}` — violates stable idempotency |

---

## Claim allowlist方式

Writer直前: auth user sha8 allowlist `{0411f04d}` (Phase 17/59 test bind).  
Non-allowlisted → skip, **0 INSERT**.  
DB `anpi_phase6_claim_jobs` unchanged (Cron still stub).

---

## Stable idempotency key仕様

`anpi:p61:v1:{kind}:{check_id}:{subject_sha8}:{YYYY-MM-DD}`

Retry with `attempt_count=5` and reclaim with later same-day due → **already_seen**, same notification id.

---

## Results

| Item | Result |
|------|--------|
| INSERT件数 | **1** |
| duplicate件数 | **0** |
| retry / reclaim | `anpi_p61_already_seen` ×2 |
| owner可視性 | Phase 59 PASS 再利用 |
| cleanup | deleted=1 · remaining=0 |
| rollback | flag OFF → `anpi_p61_flag_off` · Cron still `talk_local*` |

### Negatives

| Test | Result |
|------|--------|
| flag OFF | PASS |
| Production ref | PASS |
| non-allowlisted identity | PASS |
| anon INSERT | 401 PASS |
| malformed due | PASS |

Evidence: [`reports/anpi-phase61-scoped-job-writer-evidence.json`](./anpi-phase61-scoped-job-writer-evidence.json)

---

## Phase 62 へ進めるか

**NO-GO for Cron soak** until:

1. Staging SQL: claim-time allowlist (or equivalent) so Cron cannot process non-test subjects  
2. Wire scoped writer into job process path **behind** staging flag + allowlist  
3. Attempt-stable key adopted in SQL contract builder (or keep JS key at Cron boundary)  
4. Explicit human approval for limited Cron soak (1–3 ticks · test identity only)

Proposed (not applied) direction: `sql/anpi-phase61-claim-allowlist-proposal.sql` (proposal only).

---

## Production human gates

1. Production migrations / RLS  
2. Phase 10 real writer enablement (not `p_local_test` abuse)  
3. Production Worker / secrets / cron  
4. Identity-scoped claim + stable SQL idempotency before any Production send  

---

## Changes

| Path | Role |
|------|------|
| `scripts/lib/anpi-phase61-scoped-job-writer.mjs` | Scoped writer |
| `scripts/test-anpi-phase61-scoped-job-writer.mjs` | Unit |
| `scripts/verify-anpi-phase61-scoped-job-writer.mjs` | Staging verify |
| `docs/anpi-phase61-scoped-job-writer.md` | Ops |
| `sql/anpi-phase61-claim-allowlist-proposal.sql` | Phase 62 proposal (not applied) |
| `package.json` | npm scripts |
