# TLV CF LL-HLS ingest — Staging idle lifecycle overlay

Not a deployable Worker. The live Container Worker source is **not** in this
monorepo. See `DO_NOT_DEPLOY.md`.

| Piece | Role |
| --- | --- |
| `src/idle-lifecycle.mjs` | Staging-only sleep/stop policy (Production fail-closed) |
| `wrangler.staging.overlay.jsonc` | Fields to merge into existing Staging wrangler config |
| `scripts/lib/tlv-cf-llhls-ingest-cost-guardrail.mjs` | FINDING detector, no deletes |
| `scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs` | Read-only CLI |

Human applies the mixin to the unpublished `TlvCfLlhlsIngestContainer` source,
then deploys **Staging only**.
