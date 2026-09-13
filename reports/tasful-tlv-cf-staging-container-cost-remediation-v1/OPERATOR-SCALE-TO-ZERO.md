# Staging scale-to-zero (do not delete the Container definition)

## Forbidden

- Cloudflare Dashboard → **Delete Container**
- `wrangler containers delete <CONTAINER_ID>`
- Any Production deploy / stop / wrangler mutation
- Enabling `TLV_CF_LLHLS_ADMIN_STOP_GO` on Production

Wrangler has **no** instance stop command (`containers list` / `instances` only).

## SAFE_SHUTDOWN (existing, preferred)

`POST /v1/stop` on the Staging Worker, **ingest JWT** required.

This is already implemented in unpublished `worker.js`. It calls
`destroy`/`stop` on that Durable Object / Container instance. The Container
**application** (`a03deec3-…` / `tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer`)
stays defined.

1. `wrangler containers list` — Staging app only (`a03deec3-…`).
2. `wrangler containers instances <STAGING_APPLICATION_ID> --json`
3. For each stale DO / stream id (including dummy `aaaa…`):
   `POST https://<staging-worker>/v1/stop` with ingest JWT for that stream.
4. Re-list instances. Definition remains. Production is not touched.

## After this PR is merged into Staging worker.js

Idle playlist GETs and dummy ids are **not** forwarded to `Container.fetch`
(so they no longer renew `sleepAfter`). An ingest-idle watchdog stops the
instance after 2 minutes without publisher activity, even if platform
`inflightRequests` would have blocked `onActivityExpired`.

Active ingest is uninterrupted.

## Optional Staging admin-stop (Human GO)

`/v1/admin-destroy` stays **hard 404** (ops).

`POST /v1/admin-stop` is **404** unless Staging var `TLV_CF_LLHLS_ADMIN_STOP_GO=1`.
Default in `wrangler.toml` is `"0"`. Operator may set `"1"` on Staging only
after an explicit GO, then POST with token, then set it back to `"0"`.

## Production

Ops listed Production **LIVE=7**. Observe only. Do not deploy, stop, or
change `tlv-cf-llhls-ingest-production`.
