# ANPI Phase 62 — Staging Scoped Cron Soak Report

**Date:** 2026-07-27  
**Verdict:** **SOAK PASS**  
**Environment:** staging only (`ahlxuyvhzqdqaojiywmu`)  
**Production:** not touched

---

## Summary

Short soak of the **scoped Cron path** (Phase 56 → Phase 48 → Phase 62 allowlisted claim → Phase 61 writer → `talk_notifications`) for test identity `{0411f04d}` only.

| Metric | Result |
|--------|--------|
| Scoped Cron path runs | **3** |
| Claims | **3** (all `0411f04d`) |
| INSERT | **1** |
| Duplicate INSERT | **0** |
| already_seen (reclaim) | **2** |
| Allowlist-out claim/INSERT | **0** (outsider remained `pending`) |
| Final gate | **false** |
| Final Worker flags | **OFF** (`ANPI_P62_SCOPED_CRON_PATH` / `ANPI_P61_SCOPED_WRITER_ENABLED`) |
| Final provider | **`talk_local`** |
| Remaining `source=anpi_phase61_test` | **0** |

Evidence: [`reports/anpi-phase62-scoped-cron-soak-evidence.json`](../reports/anpi-phase62-scoped-cron-soak-evidence.json)

---

## Wiring

| Layer | Behavior |
|-------|----------|
| Flag OFF (default) | Phase 48 → Phase 47 → `anpi_phase6_claim_jobs` → `talk_local*` stubs |
| Flag ON | Phase 48 → `anpi_phase62_claim_jobs_allowlisted` → Phase 61 scoped writer |
| Provider var | Stays `talk_local*` (never `talk_write`) |
| Legacy claim | **Untouched** (`anpi_phase6_claim_jobs` not replaced) |
| Worker vars | `ANPI_P62_SCOPED_CRON_PATH=false`, `ANPI_P61_SCOPED_WRITER_ENABLED=false` |

Code:

- `scripts/lib/anpi-phase62-scoped-cron-path.mjs`
- `scripts/lib/anpi-phase48-scheduled-runtime.mjs` (branch on flag)
- `scripts/lib/anpi-phase56-cloudflare-scheduler-adapter.mjs` (pass-through env)
- `deploy/cloudflare/workers/anpi-staging-scheduler/wrangler.toml`

---

## Soak procedure executed

1. Dry: gate OFF + scoped flag ON → claim **0**
2. Flag OFF routing check (no live legacy stub against soak seeds)
3. Seed allowlisted soak job + non-allowlisted outsider pending job
4. `anpi_phase62_claim_allowlist_enable()`
5. Three scoped path ticks (same handler chain as Cloudflare Cron)
6. Immediate `anpi_phase62_claim_allowlist_emergency_disable()`
7. Cleanup markers + cancel soak/outsider jobs · remaining **0**

Inbox marker retained during soak: `source=anpi_phase61_test`, `type=anpi`, `target_url=#`.

---

## Negatives

| Check | Result |
|-------|--------|
| Gate OFF → claim 0 | PASS |
| Flag OFF → scoped path not selected | PASS |
| Allowlist-out identity INSERT 0 | PASS |
| Production ref refused | PASS |
| Non-`talk_local` provider refused | PASS |
| Non–service_role claim denied (401) | PASS |
| Gate OFF after soak → claim 0 | PASS |

---

## Rollback / stop state (mandatory)

Confirmed after soak:

```text
gate.enabled = false
ANPI_P62_SCOPED_CRON_PATH = false
ANPI_P61_SCOPED_WRITER_ENABLED = false
ANPI_NOTIFICATION_PROVIDER = talk_local
talk_notifications source=anpi_phase61_test → 0 rows
legacy anpi_phase6_claim_jobs → unchanged
```

---

## Human gates remaining (before Production)

1. Explicit approval to run **Worker Cron** with flags ON for a live wall-clock soak window (this soak used the same runtime chain locally / diagnostic-equivalent; Worker defaults stay OFF).
2. Explicit approval for any Production cutover design (separate phase — **not** authorized here).
3. Ops runbook sign-off: enable → observe → emergency_disable checklist under owner supervision.
4. Confirm no expansion of allowlist beyond `{0411f04d}` without new review.

---

## Commands

```bash
node scripts/test-anpi-phase62-scoped-cron-path.mjs
node scripts/verify-anpi-phase62-scoped-cron-soak.mjs
```
