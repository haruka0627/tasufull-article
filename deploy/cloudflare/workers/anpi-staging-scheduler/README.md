# ANPI Staging Scheduler (Cloudflare Cron) — Phase 56

Dedicated Worker for **staging-only** ANPI notification runtime ticks.

GitHub Actions `schedule` was marked `GITHUB_SCHEDULE_NOT_VIABLE` (Phases 49–55).
Periodic execution moves here. GitHub Actions remains for manual diagnostic / tests.

## Worker

| Item | Value |
|------|--------|
| Name | `anpi-staging-scheduler` |
| Cron (UTC) | `*/5 * * * *` |
| Environment | staging |
| Project ref | `ahlxuyvhzqdqaojiywmu` |
| Provider | `talk_local*` only (Phase 48 validation) |

## Runtime chain

```text
Cloudflare Cron / diagnostic POST
  → anpi-phase56 adapter
  → Phase 48 scheduled runtime (lease + guards)
  → Phase 47 notification runtime core
```

## Secrets (never commit)

```bash
cd deploy/cloudflare/workers/anpi-staging-scheduler
npx wrangler secret put ANPI_STAGING_SUPABASE_URL
npx wrangler secret put ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ANPI_DIAGNOSTIC_TOKEN
```

## Deploy (staging Worker only)

```bash
cd deploy/cloudflare/workers/anpi-staging-scheduler
npx wrangler deploy
```

Do **not** point this Worker at Production Supabase (`ddojquacsyqesrjhcvmn`).

## Manual diagnostic

```bash
curl -X POST "https://anpi-staging-scheduler.<account>.workers.dev/internal/anpi-scheduler/run" \
  -H "x-anpi-diagnostic-token: $ANPI_DIAGNOSTIC_TOKEN"
```

Unauthenticated calls return 401. Same lease path as Cron.

## Logs

Each run emits one JSON line (`service=anpi-scheduler`). Lease rows also land in `anpi_scheduler_runs`.

## Rollback

1. Set var `ANPI_STAGING_RUNTIME_ENABLED=false` and redeploy, **or** clear `[triggers].crons`
2. `npx wrangler rollback` to prior version
3. Confirm no Production Worker / route changes
4. Leave GitHub Actions workflow as diagnostic-only (do not re-enable schedule reliance)

## Tests

```bash
node scripts/test-anpi-phase56-cloudflare-scheduler.mjs
```
