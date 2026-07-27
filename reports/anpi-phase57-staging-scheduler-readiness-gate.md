# ANPI Phase 57 — Staging Scheduler Production-Readiness Gate

**Date:** 2026-07-27  
**Scope:** Button-check ANPI **notification scheduler** (Phases 47–56)  
**Production deploy / Production DB / Production Cron:** **NOT PERFORMED**

---

## Verdict

```text
ANPI_STAGING_SCHEDULER_READINESS: PASS
ANPI_PRODUCTION_SCHEDULER: NO-GO (human gate required)
GITHUB_ACTIONS_SCHEDULE: RETIRED (workflow_dispatch diagnostic only)
CLOUDFLARE_CRON_STAGING: PASS (Phase 56)
```

---

## What is ready (staging)

| Area | Status | Evidence |
|------|--------|----------|
| Runtime core (Phase 47) | PASS | Unit + live staging |
| Scheduled wrapper + lease (Phase 48) | PASS | Unit + live + CF ticks |
| GitHub Actions schedule | NOT VIABLE | Phases 49–55 |
| Cloudflare Workers Cron | PASS | Worker `anpi-staging-scheduler` · cron `*/5 * * * *` UTC |
| Staging guards | PASS | env / project_ref / talk_local* |
| DB lease acquire/release | PASS | `anpi_scheduler_runs` rows · `error_safe=null` |
| Provider validation | PASS | `talk_local*` only |
| Diagnostic endpoint | PASS | token-gated POST · unauth 401 |
| Continuity (≥2 cron ticks) | PASS | 11:40 / 11:45 / 11:50 UTC (2026-07-27) |

### Cloudflare Worker (staging)

| Item | Value |
|------|--------|
| Name | `anpi-staging-scheduler` |
| Cron | `*/5 * * * *` (UTC) |
| Project ref | `ahlxuyvhzqdqaojiywmu` |
| Provider | `talk_local` |
| Version (Phase 56 deploy) | `fa324255-4ff1-4605-b7bb-400df23884a5` |
| Ops doc | [`docs/anpi-cloudflare-scheduler-ops.md`](../docs/anpi-cloudflare-scheduler-ops.md) |

---

## Production NO-GO (requires human)

Do **not** proceed without explicit approval + new credentials:

1. Separate Production Worker (or env) — never reuse staging secrets  
2. Production Supabase URL / service-role (human-provided)  
3. Production Cron registration  
4. Real TALK / external notification provider cutover (beyond `talk_local`)  
5. Production RLS / migration apply already gated elsewhere  

Until then: **staging-only** Cloudflare Cron remains the periodic executor.

---

## Role split (locked)

| Surface | Role |
|---------|------|
| Cloudflare Cron | Periodic ANPI staging ticks · lease · due pickup |
| GitHub Actions | `workflow_dispatch` diagnostic · tests · CI |
| GitHub `schedule` | **Retired** |

---

## Phase 57 hardening in this gate

- Remove GHA `on.schedule` (keep `workflow_dispatch`)
- `preview_urls = false` on staging Worker
- Ops runbook + continuity verify script
- npm script `test:anpi-cf-scheduler`

---

## Human next steps (when ready for Production)

1. Approve Production Worker naming + account  
2. Provide Production secrets via wrangler (do not commit)  
3. Apply Production schema/RLS checklists already in `docs/anpi-supabase-production-checklist.md`  
4. Register Production Cron only after staging soak  
5. Keep `talk_local` until real provider Go is approved  
