# DO NOT DEPLOY FROM THIS DIRECTORY

Canonical overlay: `deploy/cloudflare/workers/tlv-cf-llhls-ingest/`.

Forbidden: Production deploy, `wrangler containers delete`, Dashboard Delete Container.
Allowed: merge lifecycle helpers into unpublished Staging `worker.js`, then Staging-only deploy after Human review.
