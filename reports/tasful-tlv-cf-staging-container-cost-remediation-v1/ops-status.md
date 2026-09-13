# Ops status (collected; do not re-guess)

Incorporated 2026-09-13. No secrets.

## SSOT (in repo)

`deploy/cloudflare/workers/tlv-cf-llhls-ingest/`

| File | Role |
| --- | --- |
| `worker.js` | Staging/Production Worker source |
| `wrangler.toml` | Staging (`tlv-cf-llhls-ingest-staging`) |
| `wrangler.production.toml` | Production observe / fail-closed — **do not deploy** |
| `occupancy-release.mjs` | Occupancy hold/release |

Do **not** describe this Worker as absent from the repo.
`workers/tlv-cf-llhls-ingest/` is a superseded overlay (`MIGRATION.md`).

## Staging wrangler / worker.js (ops)

| Field | Value |
| --- | --- |
| Worker | `tlv-cf-llhls-ingest-staging` |
| Container app | `tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer` |
| Application id | `a03deec3-…` |
| `max_instances` | **8** |
| `instance_type` | **standard-3** (8 GiB / 2 vCPU / 16 GB disk) |
| `sleepAfter` (worker.js) | **"2m"** (already set) |
| `onActivityExpired` | **destroy/stop** (already set) |
| `POST /v1/stop` | ingest JWT — **SAFE_SHUTDOWN** |
| `/v1/admin-destroy` | **hard 404** |
| Wrangler instance stop | **none** |
| `wrangler containers delete` | **forbidden** |

## Live counts (observed)

| Env | LIVE | Notes |
| --- | --- | --- |
| Staging | **7** | 5 running DO names including dummy `aaaa…`; created ~2026-09-11 |
| Production | **7** | **Observed only. Do not mutate. Do not deploy.** |

## Operator conclusion

`sleepAfter` is **not** clearing these DOs. Cause class: **stuck / activity
renew** (Container inflight/WS + occupancy keep-alive / unreleased occupancy),
not a missing `sleepAfter` field.
