# Deploy rules

SSOT: this directory (`worker.js`, `wrangler.toml`, `occupancy-release.mjs`).

Allowed after Human review: `wrangler deploy` using **`wrangler.toml` (Staging)** only.

Forbidden:

- `wrangler deploy -c wrangler.production.toml`
- `wrangler containers delete`
- Dashboard **Delete Container**
- Setting `TLV_CF_LLHLS_ADMIN_STOP_GO=1` on Production
