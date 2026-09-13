# Staging scale-to-zero (do not delete the Container definition)

## Forbidden

These destroy the Container **application** (definition), not just live instances:

- Cloudflare Dashboard → **Delete Container**
- `wrangler containers delete <CONTAINER_ID>`

Do not use them. This task requires `STAGING_CONTAINER_DELETED=NO`.

## Why Dashboard has no “scale to 0”

Cloudflare Containers are Durable-Object-backed. Live instances are started by
Worker code (`getContainer` / `getRandom` / `fetch` / `containerFetch`) and
stopped by `Container.stop()` or the `sleepAfter` → `onActivityExpired()` path.
Wrangler can **list** instances (`wrangler containers instances`) but has no
instance stop command. There is no supported “set capacity = 0” API that leaves
the application in place.

## Safe shutdown methods (Staging only)

### A. Preferred after this PR is applied to the unpublished Worker source

1. Merge `workers/tlv-cf-llhls-ingest/src/idle-lifecycle.mjs` into
   `TlvCfLlhlsIngestContainer` (see `applyNotes()`).
2. Set `TLV_CF_LLHLS_ENV=staging` on the Staging Worker only.
3. `wrangler deploy` **Staging Worker name `tlv-cf-llhls-ingest-staging` only**.
4. Confirm no publisher / no leftover playlist clients.
5. Wait `sleepAfter` (`2m`). Instances should go to 0 without deleting the app.

Active ingest is uninterrupted: `hasActiveIngest=true` renews the timer.

### B. Immediate operator stop (Human + Staging token)

After the Staging Worker exposes `POST /internal/lifecycle/stop`:

1. `wrangler containers list` — copy the **Staging** application id only.
2. `wrangler containers instances <STAGING_APPLICATION_ID> --json`
3. For each stale Durable Object / stream id, `POST` the lifecycle path with
   `TLV_CF_LLHLS_LIFECYCLE_TOKEN`.
4. Handler calls `container.stop()` (SIGTERM). Definition remains.

If the unpublished source is not available, Human must add the stop route
before this path works. This environment cannot deploy it.

### C. Read-only confirmation

```bash
wrangler containers list
wrangler containers instances <STAGING_APPLICATION_ID> --json
node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=staging --no-wrangler
```

Production observe-only (no mutate flags):

```bash
node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=production --no-wrangler
```

## Production

Do not deploy, stop, or change `tlv-cf-llhls-ingest-production`.
Dashboard already showed Production **Ready / Live Instances = 0**.
