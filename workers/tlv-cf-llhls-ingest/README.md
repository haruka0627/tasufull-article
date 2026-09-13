# TLV CF LL-HLS ingest — Staging idle lifecycle

Canonical files: `deploy/cloudflare/workers/tlv-cf-llhls-ingest/`

Ops already set `sleepAfter="2m"` and `onActivityExpired → destroy/stop`.
Those hooks never fire while Container.fetch / in-flight WS renews activity.
This patch refuses idle playback forward and adds an ingest-idle watchdog.

SAFE_SHUTDOWN: `POST /v1/stop` with ingest JWT.
Optional: `POST /v1/admin-stop` only if Staging `TLV_CF_LLHLS_ADMIN_STOP_GO=1`.
`/v1/admin-destroy` stays 404.

Do not deploy Production. Do not delete the Container app.
