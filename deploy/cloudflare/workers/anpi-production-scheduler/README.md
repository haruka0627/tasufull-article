# ANPI Production Scheduler — Phase 66 prep

**STATUS:** Code wired · **DO NOT DEPLOY** until Phase 66 human unlocks (audit + Secrets + canary sha8 + explicit approval)  
**Separation:** Completely separate from `anpi-staging-scheduler`

## Identity

| Item | Value |
|------|--------|
| Worker name | `anpi-production-scheduler` |
| Environment | `production` |
| Project ref | `ddojquacsyqesrjhcvmn` |
| Provider | `talk_local` (canary; never `talk_write` as switch) |
| Legacy claim | `ANPI_ALLOW_LEGACY_CLAIM=false` (**required**) |
| Runtime default | `ANPI_PRODUCTION_RUNTIME_ENABLED=false` |
| Scoped flags default | `false` |
| Adapter | `scripts/lib/anpi-phase66-production-cloudflare-scheduler-adapter.mjs` |

## Secrets (names only — never paste values into git)

| Secret name | Purpose |
|-------------|---------|
| `ANPI_PRODUCTION_SUPABASE_URL` | Production Supabase URL |
| `ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | Production service_role key |
| `ANPI_DIAGNOSTIC_TOKEN` | Token for authenticated diagnostic POST |

Do **not** reuse Staging `ANPI_STAGING_*` values.

## Health / diagnostic

- `GET /health` → paused-by-default metadata
- `POST /internal/anpi-scheduler/run` + `x-anpi-diagnostic-token`
- Cron: `*/5 * * * *` UTC (register only after pause runbook)

## Rollback

1. `ANPI_PRODUCTION_RUNTIME_ENABLED=false` + deploy (pause)
2. Gate emergency_disable
3. Scoped flags OFF
4. Clear crons if needed
5. `npx wrangler rollback`

## Deploy (WHEN AUTHORIZED)

```bash
cd deploy/cloudflare/workers/anpi-production-scheduler
npx wrangler secret put ANPI_PRODUCTION_SUPABASE_URL
npx wrangler secret put ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ANPI_DIAGNOSTIC_TOKEN
npx wrangler deploy
```

Follow `docs/anpi-phase66-production-canary.md` forced order.
