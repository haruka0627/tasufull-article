# ANPI Phase 63 — Staging Wall-Clock Scoped Cron Soak

**Date:** 2026-07-27  
**Verdict:** **WALL_CLOCK_SOAK PASS**  
**Environment:** staging only (`ahlxuyvhzqdqaojiywmu`)  
**Production:** not touched

---

## Summary

Real Cloudflare Cron Trigger (`*/5 * * * *` UTC) soak of the scoped path:

`cloudflare_cron` → Phase 56 → Phase 48 → `anpi_phase62_claim_jobs_allowlisted` → Phase 61 writer → `talk_notifications`

| Metric | Result |
|--------|--------|
| Real Cron ticks counted | **6** (max window) |
| UTC scheduled times | 14:10, 14:15, 14:20, 14:25, 14:30, 14:35 |
| Worker version (soak ON) | `2625c98b-cece-4727-99e6-b0a53b936925` |
| claim | **6** (all subject sha8 `0411f04d`) |
| INSERT | **1** |
| already_seen | **5** |
| duplicate | **0** |
| outsider via scoped path | **not claimed** |
| Final gate | **false** |
| Final scoped flags | **OFF** |
| Final provider | **`talk_local`** |
| Markers remaining | **0** |

Evidence:
- [`reports/anpi-phase63-wall-clock-cron-soak-evidence.json`](../reports/anpi-phase63-wall-clock-cron-soak-evidence.json)
- [`reports/anpi-phase63-wrangler-tail.jsonl`](../reports/anpi-phase63-wrangler-tail.jsonl)

Manual / diagnostic invocations were **not** counted.

---

## Enable order used

1. Preflight: gate=false · flags OFF · provider=`talk_local` · allowlist=`{0411f04d}`
2. Seed test soak job + outsider pending (test identity only)
3. Deploy Worker: `ANPI_P62_SCOPED_CRON_PATH=true`, `ANPI_P61_SCOPED_WRITER_ENABLED=true` (gate still OFF)
4. Pre-gate scoped claim check → 0 rows
5. `anpi_phase62_claim_allowlist_enable()`
6. Observe real `cloudflare_cron` events via `wrangler tail`

---

## Per-tick (scoped)

All ticks: `trigger=cloudflare_cron`, `mode=scoped_cron`, `provider=talk_local`, subject=`0411f04d`.

| UTC | write_reason | lease |
|-----|--------------|-------|
| 14:10:26 | `anpi_p61_inserted` | acquired → released (`error_safe=null`) |
| 14:15:26 | `anpi_p61_already_seen` | released |
| 14:20:26 | `anpi_p61_already_seen` | released |
| 14:25:26 | `anpi_p61_already_seen` | released |
| 14:30:26 | `anpi_p61_already_seen` | released |
| 14:35:26 | `anpi_p61_already_seen` | released |

Additional authentic scoped tick at **14:40:26** also PASS / already_seen (beyond the counted max-6 window).

---

## Failure simulation

**Omitted** — minimize gate-ON window / avoid flag thrash.  
Lease release on error remains covered by Phase 48 `catch` → `releasePhase48Lease`.

---

## Shutdown race (documented · fixed)

At **14:45:26**, while flags were flipping OFF, version `43822fa6` ran **`legacy_stub`** and claimed pending jobs (including outsider).  
Scoped path never claimed outsider (subjects always `0411f04d`).

**Harness fix:** pause `ANPI_STAGING_RUNTIME_ENABLED` **before** clearing scoped flags, then resume stub path.

---

## Final verification

| Check | State |
|-------|--------|
| gate | false |
| `ANPI_P62_SCOPED_CRON_PATH` | false |
| `ANPI_P61_SCOPED_WRITER_ENABLED` | false |
| provider | talk_local |
| allowlist | `{0411f04d}` unchanged |
| legacy claim | `anpi_phase6_claim_jobs` untouched |
| markers | 0 |
| Cron path | stub / legacy default |
| Production | untouched |

---

## Human gates before Production cutover

1. Explicit approval for Production design / cutover (separate phase)
2. Ops runbook: enable → wall-clock observe → runtime-pause → disable (updated order)
3. No allowlist expansion without review
4. Confirm PR #20 (Phase 62) merge baseline as needed

---

## Commands

```bash
node scripts/verify-anpi-phase63-wall-clock-cron-soak.mjs
```
