# Cloudflare Containers — docs notes (no secrets)

Retrieved 2026-09-13 via web search / Cloudflare public docs.

## How an instance is created

- A Worker class extends `Container` from `@cloudflare/containers`.
- `Container` extends Durable Object. Binding + `new_sqlite_classes` migration
  are required.
- `getContainer(env.BINDING, id)` addresses one instance identity (typical
  per-stream-key pattern for ingest).
- `getRandom(env.BINDING, N)` addresses N interchangeable identities.
- `fetch()` / `containerFetch()` start the container if it is not running.
- Getting a container does not by itself start it; traffic / start APIs do.

Dashboard names:

- `tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer`
  → Worker `tlv-cf-llhls-ingest-staging`, class `TlvCfLlhlsIngestContainer`
- `tlv-cf-llhls-ingest-production-tlvcfllhlsingestcontainer`
  → Worker `tlv-cf-llhls-ingest-production`, same class name

## Idle / sleep

- `sleepAfter` default `"10m"`. Ops Staging worker already sets `"2m"`.
- Incoming **proxied** requests reset the timer (`renewActivityTimeout()`).
- Each WebSocket message also renews (container.ts).
- `isActivityExpired()`: if `inflightRequests > 0`, renew and return false.
  A hung WHIP/WS/containerFetch means `onActivityExpired` never runs.
- Default / ops `onActivityExpired()` calls `stop()`/`destroy()`. Does **not**
  delete the Container application.
- HLS playlist polling that is forwarded to `Container.fetch` renews activity.

## This incident

Ops: sleepAfter already 2m + onActivityExpired destroy/stop, but LIVE
instances created ~2026-09-11 never cleared (“stuck/activity renew”).
Fix: do not forward idle playback; ingest-idle watchdog ignores inflight.

## Scale to zero without deleting the definition

- Supported: `stop()` / `destroy()` on the DO, or sleepAfter expiry.
- Wrangler: `containers list`, `containers instances <id>` (read).
- Wrangler: `containers delete` deletes the **application** — do not use.
- Dashboard “Delete Container” is the same class of action — do not use.

## Limits

- `max_instances` caps concurrent running instances (default 20). Stopped
  instances do not count.
- No `min_instances` keep-warm field in current wrangler Container config.

## Pricing relevance

- Billable while instances are **running**. Memory dominates observed spend.
- 5 × 8 GiB = 40 GiB matches the Dashboard memory total.
