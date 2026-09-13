# Superseded overlay

`workers/tlv-cf-llhls-ingest/` is **not** the Worker SSOT.

Canonical path:

`deploy/cloudflare/workers/tlv-cf-llhls-ingest/`

(`worker.js`, `wrangler.toml`, `wrangler.production.toml`, `occupancy-release.mjs`)

The files left here only re-export the deploy-path lifecycle module. Do not
deploy from `workers/tlv-cf-llhls-ingest/`.
