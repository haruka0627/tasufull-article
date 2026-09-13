# Staging verification plan

## Constraints

- No Production Cloudflare mutation.
- No `wrangler containers delete` / Dashboard Delete Container.
- Browser Automation is isolated for this workspace; verify with unit tests +
  optional Human Dashboard / wrangler list.

## Automated (this PR)

```bash
node scripts/test-tlv-cf-llhls-ingest-idle-lifecycle.mjs
node scripts/check-tlv-cf-llhls-ingest-idle-cost.mjs --env=staging --fixture=reports/tasful-tlv-cf-staging-container-cost-remediation-v1/evidence/guardrail-fixture-stale-staging.json
```

Expect:

- Lifecycle tests PASS (Staging stop/sleep, Production fail-closed, no delete).
- Guardrail CLI prints `FINDING NO_ACTIVE_STREAMS_AND_LIVE_INSTANCES` for the
  fixture (5 live / 0 streams / idle past timeout).
- `autoDelete=false productionMutation=NO STAGING_CONTAINER_DELETED=NO`.

## Human Staging (after mixin is copied into unpublished Worker source)

1. Record Dashboard: Staging live instances **before**.
2. Confirm Production live instances remain **0** (do not open Production deploy).
3. Deploy Staging Worker only.
4. With **no** publisher: leftover playlist GETs must not renew activity.
5. After 2 minutes: Staging live instances → 0. Definition still listed.
6. Start one test ingest: instance becomes 1; keep publishing > 2 minutes;
   instance stays up.
7. Stop publisher and players; after 2 minutes instance returns to 0.
8. Re-run the guardrail (with wrangler creds if available). Expect `OK` when
   live=0.
9. Confirm Production still 0.

## TLV regression

This PR does not change `live/**` UI, Pages Functions, or Production Workers.
Optional freeze check: `node scripts/test-tlv-tasful-ai-entry.mjs` (unchanged).

## After (may remain operator-documented)

If Cloudflare API credentials are absent in CI / this agent:

- `STAGING_LIVE_INSTANCES_AFTER=operator step documented`
- `HUMAN_GATE_REQUIRED=YES`
