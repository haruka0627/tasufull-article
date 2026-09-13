# DO NOT DEPLOY FROM THIS DIRECTORY

This tree is a **lifecycle policy + apply notes** overlay for the already-deployed
Cloudflare Worker / Container:

- Staging Worker: `tlv-cf-llhls-ingest-staging`
- Staging Container application: `tlv-cf-llhls-ingest-staging-tlvcfllhlsingestcontainer`
- Production Worker: `tlv-cf-llhls-ingest-production` (observe only)

There is **no Dockerfile / image / full ingest Worker** in this repository.
`wrangler deploy` from this directory would be incomplete and could overwrite
the live Staging ingest Worker. Do not deploy it.

Allowed actions:

1. Copy `src/idle-lifecycle.mjs` into the unpublished Worker source (Human).
2. Apply `wrangler.staging.overlay.jsonc` fields onto the existing Staging
   wrangler config only.
3. `wrangler deploy` **Staging Worker only**, after Human review.

Forbidden:

- `wrangler deploy` of Production (`tlv-cf-llhls-ingest-production`)
- `wrangler containers delete`
- Cloudflare Dashboard **Delete Container**
- Billing / payment setting changes
