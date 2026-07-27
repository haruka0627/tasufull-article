# ANPI Production Scheduler — Configuration Draft (Phase 65)

**STATUS:** DRAFT · **DO NOT DEPLOY** without Phase 64 Go checklist + explicit approval  
**Separation:** Completely separate from `anpi-staging-scheduler`

## Identity

| Item | Value |
|------|--------|
| Worker name | `anpi-production-scheduler` |
| Environment | `production` |
| Project ref | `ddojquacsyqesrjhcvmn` |
| Provider | `talk_local` (always during canary; never `talk_write` as switch) |
| Legacy claim | `ANPI_ALLOW_LEGACY_CLAIM=false` (**required**) |
| Runtime default | `ANPI_PRODUCTION_RUNTIME_ENABLED=false` |
| Scoped flags default | `false` |

## Secrets (names only — prepare in Cloudflare; never paste values into git)

| Secret name | Purpose |
|-------------|---------|
| `ANPI_PRODUCTION_SUPABASE_URL` | Production Supabase URL |
| `ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | Production service_role key |
| `ANPI_DIAGNOSTIC_TOKEN` | Token for authenticated diagnostic POST |

Do **not** reuse Staging `ANPI_STAGING_*` values.

## Health / diagnostic (future wired Worker)

- `GET /health` → environment + ok
- `POST /internal/anpi-scheduler/run` + `x-anpi-diagnostic-token`
- Cron: `*/5 * * * *` UTC

## Rollback

1. `ANPI_PRODUCTION_RUNTIME_ENABLED=false` + deploy (pause)
2. Gate emergency_disable
3. Scoped flags OFF
4. Clear crons if needed
5. `npx wrangler rollback`

## Code gap (remaining blocker)

Current `anpi-phase56-cloudflare-scheduler-adapter.mjs` **rejects** non-staging environments.  
Production Worker requires a Production adapter (or guarded dual-env) before real wiring.  
This draft ships a fail-closed stub `src/index.mjs` so accidental deploy cannot claim jobs.
