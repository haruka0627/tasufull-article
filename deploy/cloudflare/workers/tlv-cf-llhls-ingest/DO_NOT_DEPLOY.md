# Do not deploy this directory as-is

This tree holds the Staging lifecycle patch and wrangler **vars** that match
ops (`max_instances=8`, `standard-3`). It does **not** include the ingest
image or the full unpublished `worker.js`.

- `wrangler deploy` from here is forbidden (incomplete Worker).
- Production deploy is forbidden.
- `wrangler containers delete` / Dashboard Delete Container are forbidden.

Human: merge `src/idle-lifecycle.mjs` + `src/fetch-guard.mjs` into the
existing Staging `worker.js`, then deploy **Staging only**.
