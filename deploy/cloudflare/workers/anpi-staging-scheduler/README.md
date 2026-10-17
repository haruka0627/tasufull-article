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
  → default: Phase 47 → anpi_phase6_claim_jobs → talk_local* stubs
  → when ANPI_P62_SCOPED_CRON_PATH=true (staging soak only):
       anpi_phase62_claim_jobs_allowlisted → Phase 61 scoped writer
```

Scoped soak flags default **false** in `wrangler.toml`. Keep `ANPI_NOTIFICATION_PROVIDER=talk_local`.
Do not leave gate enabled or scoped flags ON outside an approved soak window.
See [`docs/anpi-phase62-scoped-cron-soak.md`](../../../../docs/anpi-phase62-scoped-cron-soak.md).

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
npm run test:anpi-cf-scheduler
npm run verify:anpi-cf-cron
```

## Ops / readiness

- Ops: [`docs/anpi-cloudflare-scheduler-ops.md`](../../../../docs/anpi-cloudflare-scheduler-ops.md)
- Gate: [`reports/anpi-phase57-staging-scheduler-readiness-gate.md`](../../../../reports/anpi-phase57-staging-scheduler-readiness-gate.md)
- `preview_urls = false` in `wrangler.toml`
