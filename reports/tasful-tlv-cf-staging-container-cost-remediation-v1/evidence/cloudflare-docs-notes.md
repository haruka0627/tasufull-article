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

- `sleepAfter` default `"10m"`.
- Incoming requests reset the timer (`renewActivityTimeout()`).
- Default `onActivityExpired()` calls `stop()` (SIGTERM, then SIGKILL after
  up to 15 minutes). This does **not** delete the Container application.
- If `onActivityExpired()` is overridden and does not `stop()` / `destroy()`,
  the instance stays up and the hook repeats.
- HLS playlist polling is an incoming request: it renews activity unless the
  Worker ignores playback-only GETs when ingest is down.

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
