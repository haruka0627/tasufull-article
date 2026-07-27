# ANPI Cloudflare Staging Scheduler — Operations

**Worker:** `anpi-staging-scheduler`  
**Environment:** staging only (`ahlxuyvhzqdqaojiywmu`)  
**Periodic trigger:** Cloudflare Cron `*/5 * * * *` (UTC)  
**GitHub Actions schedule:** retired (Phases 49–55 · `GITHUB_SCHEDULE_NOT_VIABLE`)

## Runtime chain

```text
Cloudflare Cron / diagnostic POST
  → scripts/lib/anpi-phase56-cloudflare-scheduler-adapter.mjs
  → Phase 48 scheduled runtime (guards + lease + provider check)
  → Phase 47 notification runtime core
```

## Secrets (never commit)

```bash
cd deploy/cloudflare/workers/anpi-staging-scheduler
npx wrangler secret put ANPI_STAGING_SUPABASE_URL
npx wrangler secret put ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ANPI_DIAGNOSTIC_TOKEN
```

Vars (in `wrangler.toml`): `ANPI_ENVIRONMENT=staging`, project ref, enabled flag, `talk_local` provider.

## Deploy / rollback

```bash
cd deploy/cloudflare/workers/anpi-staging-scheduler
npx wrangler deploy
npx wrangler deployments list
npx wrangler rollback   # pick prior version when needed
```

Emergency stop without full rollback:

1. Set `ANPI_STAGING_RUNTIME_ENABLED=false` in `[vars]` and redeploy, **or**
2. Clear `[triggers].crons` and redeploy

## Manual diagnostic

```bash
curl -X POST "https://anpi-staging-scheduler.<account>.workers.dev/internal/anpi-scheduler/run" \
  -H "x-anpi-diagnostic-token: $ANPI_DIAGNOSTIC_TOKEN"
```

Unauthenticated → 401. Same lease path as Cron.

GitHub Actions emergency path: workflow `anpi-phase48-staging-runtime` → **Run workflow** (`workflow_dispatch` only).

## Evidence

- Cloudflare logs: JSON lines with `service=anpi-scheduler`
- DB: `anpi_scheduler_runs` lease rows (`worker_id` like `anpi-p48-lease:cf-staging-*`)
- Continuity check:

```bash
node scripts/verify-anpi-phase57-cf-cron-continuity.mjs
```

## Safety

- Refuse Production Supabase ref `ddojquacsyqesrjhcvmn`
- Provider must start with `talk_local`
- Do not log secrets / PII / notification bodies
- Production Worker / Cron / Secrets: **human gate only**
