# Staging verification plan

## Constraints

- No Production Cloudflare mutation / deploy.
- No `wrangler containers delete` / Dashboard Delete Container.
- Browser Automation isolated; use unit tests + Human Dashboard / wrangler list.

## Automated (this PR)

```bash
node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs
node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=staging --fixture=reports/tasful-tlv-cf-staging-container-cost-remediation-v1/evidence/guardrail-fixture-stale-staging.json
node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=production --fixture=reports/tasful-tlv-cf-staging-container-cost-remediation-v1/evidence/guardrail-fixture-production-observe.json --no-wrangler
```

Expect:

- Lifecycle tests PASS.
- Staging fixture FINDING live=7 / streams=0 / HIGH / `autoDelete=false`.
- Production fixture FINDING live=7 CRITICAL **observe-only** / `productionMutation=NO`.

## Human Staging (`wrangler.toml` + `worker.js` in repo)

1. Record Staging LIVE before (ops: 7).
2. Confirm Production LIVE (ops: 7) — do not change it.
3. SAFE_SHUTDOWN: `POST /v1/stop` + ingest JWT per stale DO (incl. `aaaa…`).
4. Deploy **Staging Worker only** with fetch-guard + watchdog.
5. Leftover playlist GET must 410 and must not renew the DO.
6. One real ingest stays up past 2 minutes.
7. After publisher+players stop, watchdog stops the instance; app remains.
8. Optional: Human GO `TLV_CF_LLHLS_ADMIN_STOP_GO=1` then `/v1/admin-stop`; revert to `0`.
9. `/v1/admin-destroy` still 404.

## TLV regression

No `live/**` UI or Pages Function changes.
