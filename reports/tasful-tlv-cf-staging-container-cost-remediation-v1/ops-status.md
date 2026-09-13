# Ops status (collected; do not re-guess)

Incorporated 2026-09-13 from operator wrangler/dashboard collection.
No secrets.

## Staging wrangler

Path (operator box / intended repo path):

`deploy/cloudflare/workers/tlv-cf-llhls-ingest/wrangler.toml`

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

`sleepAfter` is **not** clearing these DOs. Instances remain live days after
creation (`2m` timeout). Cause class: **stuck / activity renew** — not a
missing `sleepAfter` field, not a missing `onActivityExpired` hook, not
`min_instances`.

This agent did not re-query Cloudflare and did not deploy.
