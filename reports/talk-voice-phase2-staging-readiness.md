# TALK Voice Phase 2 — Staging Execution Readiness

**Date:** 2026-07-26  
**Scope:** Staging execution preparation only (env · preflight · runbooks · E2E plan · rate-limit decision)  
**Constraints honored:** no push · no deploy · no Production change · no Staging DB migration apply · no coturn mutate/restart · no secrets committed

## Executive verdict

**PASS (preparation)** — Staging execution can be reproduced safely from docs + scripts.  
**No-Go (execution)** — Do **not** run Staging migration, real coturn cutover, TLS-443 live E2E, or distributed rate-limit implementation until remaining blockers below are cleared by a human operator.

Local Phase 2 implementation + dist mirrors remain complete (`653f3cd`, `201e6a6`, `f366ba5` and prior foundation commits). This document prepares the *next* human-operated Staging window.

## Completed local scope

| Item | Status |
| --- | --- |
| Authenticated TURN credential API | Done (local + dist mirror) |
| ICE fallback / feature flags | Done |
| Telemetry module + talk-home wiring | Done |
| Phase 1/2 SQL drafts | Present · **unapplied** |
| coturn example conf / compose | Present · **not deployed** |
| Security harden (IPv6-mapped deny, talkDev gate, ICE cache, session expiry) | Done |
| Dist mirrors (client + TURN functions) | Done |
| Staging env template + generator | Done (this prep) |
| Staging preflight (read-only) | Done (this prep) |
| Strict browser E2E **plan** | Done (this prep · not executed) |
| Distributed rate-limit **decision** | Done (this prep · not implemented) |

## Remaining blockers

1. Staging `.env.staging` secrets not filled on operator machine (anon / service_role / TURN shared secret / TURN host).
2. Staging DB migrations **not applied** (Phase 1 + Phase 2 SQL). `supabase db push` may be blocked by unrelated pending migration `20260705120000_builder_general_jobs_p3_withdraw_staging.sql` requiring an explicit `--include-all` decision.
3. No approved Staging coturn node (UDP/TCP/TLS 443 · cert · firewall · shared secret rotation).
4. Strict product E2E (2 BrowserContexts × P2P / TURN UDP / TCP / TLS 443) not run on real network.
5. Credential rate limit is still **per-isolate** — distributed limiter required before controlled release.
6. Safari/WebKit · network-switch reconnect · multi-tab — out of this prep scope.

## Environment matrix

Generator: `node scripts/lib/create-env-staging.mjs`  
Schema: `scripts/lib/talk-voice-staging-env.mjs`  
Template: `.env.staging.example` → gitignored `.env.staging`

| Variable | Required | Secret | Notes |
| --- | --- | --- | --- |
| `SUPABASE_PROJECT_REF` | yes | no | Must be `ahlxuyvhzqdqaojiywmu` |
| `SUPABASE_URL` | yes | no | Staging URL only |
| `SUPABASE_ANON_KEY` | yes | yes | Staging Dashboard/CLI |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | yes | Never commit |
| `BD_PRODUCTION_PROJECT_REF` | yes | no | Guard constant `ddojquacsyqesrjhcvmn` |
| `TASFUL_SUPABASE_URL` | yes | no | Staging URL for 8788/Functions |
| `TASFUL_SUPABASE_ANON_KEY` | yes | yes | Staging anon |
| `TALK_VOICE_STAGING_HOSTNAME` | yes | no | Not Production Pages host |
| `TALK_VOICE_STAGING_ALLOWED_ORIGINS` | yes | no | Must include `http://127.0.0.1:8788` |
| `TALK_VOICE_STAGING_JWT_ISSUER` | yes | no | `https://ahlxuyvhzqdqaojiywmu.supabase.co/auth/v1` |
| `TALK_VOICE_STAGING_JWT_AUDIENCE` | yes | no | `authenticated` |
| `TALK_VOICE_SELF_HOSTED_TURN_ENABLED` | yes | no | Staging flag |
| `TALK_VOICE_CONNECTION_TELEMETRY_ENABLED` | yes | no | Staging flag |
| `TALK_VOICE_TURN_HOST` | yes | no | Staging TURN DNS |
| `TALK_VOICE_TURN_UDP_PORT` | yes | no | `3478` |
| `TALK_VOICE_TURN_TCP_PORT` | yes | no | `3478` |
| `TALK_VOICE_TURN_TLS_PORT` | yes | no | `443` |
| `TALK_VOICE_TURN_REALM` | yes | no | Usually = TURN host |
| `TALK_VOICE_TURN_SHARED_SECRET` | yes | yes | ≥32 chars · **never logged** |
| `TALK_VOICE_TURN_TLS_CERT_PATH` | yes | no | Absolute path string |
| `TALK_VOICE_TURN_TLS_KEY_PATH` | yes | no | Absolute path string |
| `TALK_VOICE_TURN_CREDENTIAL_API_URL` | yes | no | Local/Staging API path |
| `TALK_VOICE_TELEMETRY_SINK` | yes | no | `session_columns` \| `noop` |
| `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` | no | yes | Staging Auth test user |
| `TALK_VOICE_TURN_FORCE_RELAY_TEST` | no | no | Internal relay force |
| `TALK_VOICE_TURN_CREDENTIAL_TTL_SEC` | no | no | 300–1800 |
| `TALK_VOICE_TURN_EXTERNAL_IP` | no | no | coturn mapping hint |
| `TALK_VOICE_TURN_RELAY_IP` | no | no | coturn mapping hint |
| `SITE_URL` | no | no | 8788 / Preview only |

**Production reuse is forbidden.** Validator aborts on Production ref `ddojquacsyqesrjhcvmn` or host `tasufull-article.pages.dev` in Staging fields.

### Exact env commands

```bash
node scripts/lib/create-env-staging.mjs --help
node scripts/lib/create-env-staging.mjs --dry-run
node scripts/lib/create-env-staging.mjs --force
# fill secrets in .env.staging from Staging Dashboard / secret manager (do not echo TURN secret)
node scripts/lib/create-env-staging.mjs --validate-only
node scripts/lib/create-env-staging.mjs --force --fetch-keys   # optional Staging CLI anon/service_role only
```

## DB migration procedure

**Status this session: NOT EXECUTED.**

### Target migrations (allowlist)

1. `sql/talk-voice-phase1-session-usage.sql`
2. `sql/talk-voice-phase2-security-telemetry.sql`

### Dry-run / status (Staging only)

```bash
# Confirm target is Staging ref ahlxuyvhzqdqaojiywmu — NEVER ddojquacsyqesrjhcvmn
npx supabase link --project-ref ahlxuyvhzqdqaojiywmu
npx supabase db push --dry-run
```

If dry-run lists unrelated pending migration `20260705120000_builder_general_jobs_p3_withdraw_staging.sql`, **STOP**. Do not `--include-all` without an explicit cross-team decision.

### Apply前バックアップ確認

| Check | Owner sign-off |
| --- | --- |
| Linked project ref == `ahlxuyvhzqdqaojiywmu` | [ ] |
| Production ref not linked | [ ] |
| Dashboard backup / snapshot note recorded (Free plan: export critical tables if PITR absent) | [ ] |
| Allowlisted SQL reviewed | [ ] |
| Unrelated pending migrations disposition decided | [ ] |

### Apply command (Staging only · do not run in this prep)

Prefer Dashboard SQL editor or a **single-file** Staging-linked apply of the allowlisted files only. Avoid broad `db push --include-all` unless approved.

```bash
# EXAMPLE ONLY — not executed in this preparation
# npx supabase db push   # only after dry-run is clean for allowlisted set
```

### Rollback

| Migration | Rollback |
| --- | --- |
| Phase 1 additive columns | Column drop possible · discards new usage values |
| Phase 2 triggers / checks / telemetry columns | Reverse SQL required · draft reverse not auto-generated — write before apply |

### Post-apply verification queries (Staging only · SELECT)

```sql
-- columns present
select column_name from information_schema.columns
 where table_schema='public' and table_name='talk_call_sessions'
   and column_name in ('provider','connection_route','relay_protocol','reconnect_count');

-- triggers present (names per phase2 SQL)
select tgname from pg_trigger
 where tgrelid = 'public.talk_call_sessions'::regclass;
```

### 本番DB誤接続防止

- Abort if `supabase/.temp/project-ref` == `ddojquacsyqesrjhcvmn`
- Preflight: `node scripts/preflight-talk-voice-phase2-staging.mjs`
- Never register Production in Supabase MCP

### 実行担当者チェック欄

| Step | Operator | Date | Result |
| --- | --- | --- | --- |
| Link Staging | | | [ ] |
| Dry-run | | | [ ] |
| Backup note | | | [ ] |
| Apply Phase 1 | | | [ ] **NOT DONE in prep** |
| Apply Phase 2 | | | [ ] **NOT DONE in prep** |
| Verify SELECT | | | [ ] |

## coturn procedure

**Status this session: NOT CHANGED / NOT RESTARTED.**

Reference examples only:

- `config/coturn/tasful-talk-turnserver.example.conf`
- `config/coturn/docker-compose.staging.example.yml`
- `config/coturn/README.md`

| Topic | Staging requirement |
| --- | --- |
| UDP | `3478/udp` listening + relay range |
| TCP | `3478/tcp` |
| TLS 443 | `alt-tls-listening-port=443` (and/or `5349`) with public CA cert |
| realm | Matches `TALK_VOICE_TURN_REALM` / host |
| external-ip | Public/private mapping for NAT |
| relay-ip | Dedicated relay address |
| fingerprint | Enabled |
| stale-nonce | Enabled (example `600`) |
| no-multicast-peers | Enabled |
| denied-peer-ip | Private/loopback/link-local/multicast + IPv4-mapped IPv6 mirrors |
| TLS certificates | SAN includes TURN DNS · TLS1.2+ · auto-renew · paths from env |
| log policy | No shared secret · no SDP · no full ICE · no long-lived creds |
| secret rotation | Overlap window > credential TTL · issuer switches first |
| firewall | 3478 UDP/TCP · 443 TCP · relay range only as needed |
| health check | `turnutils_stunclient` / authenticated `uclient` · browser relay force |
| rollback | Disable `TALK_VOICE_SELF_HOSTED_TURN_ENABLED` · keep P2P/STUN |

## TLS 443 procedure

1. Issue/renew cert whose SAN == Staging TURN hostname.
2. Place fullchain + privkey at paths referenced by env (not in git).
3. Confirm coturn `alt-tls-listening-port=443` and `turns:<host>:443?transport=tcp` in issuer ICE list.
4. Browser E2E case `turn_tls_443` with `iceTransportPolicy=relay` and turns-only URL filter.
5. PASS only on `getStats()` selected relay + TLS/tcp evidence — config review alone is **not** PASS.

**Not executed in this preparation.**

## Browser E2E matrix

Plan module: `scripts/lib/talk-voice-phase2-e2e-matrix.mjs`  
**Mock success must not be marked PASS.**

| Case ID | Policy | Expect route | Candidate | Relay proto |
| --- | --- | --- | --- | --- |
| `direct_p2p` | `all` | `p2p_host` or `p2p_srflx` | host/srflx | n/a |
| `turn_udp` | `relay` | `turn_udp` | relay | udp |
| `turn_tcp` | `relay` | `turn_tcp` | relay | tcp |
| `turn_tls_443` | `relay` | `turn_tls` | relay | tls |

### Required evidence (both independent BrowserContexts)

- selected candidate type (local / remote)
- relay protocol
- TURN server host
- session lifecycle active → ended
- heartbeat observed
- entitlement checked
- telemetry sink/row
- hangup cleanup (ICE closed)
- bidirectional audio tracks

### Design notes

- ≥2 Playwright BrowserContexts (separate storage).
- Staging JWT only · credential API auth required.
- Filter `iceServers` to the transport under test before offer/answer.
- Do not PASS from fixture-only host/host without product auth + Staging session.

**Not executed in this preparation.**

## Distributed rate-limit decision

### Current limit

`deploy/cloudflare/functions/api/talk-voice-turn-credentials.js` — in-memory `Map` per isolate:

- 6 credentials / user:session / 60s
- Lost on isolate recycle · not shared across regions/isolates
- Insufficient for controlled release

### Candidate comparison

| Option | Consistency | Ops fit | Latency | Cost | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Cloudflare Durable Objects** | Strong per-key | Native to Pages Functions | Low-ms | Low–medium | **Recommended** |
| KV | Eventual | Simple | Low | Low | Reject for authz bursts (race windows) |
| D1 | SQL transactional | Extra schema | Medium | Low | Possible fallback · more glue |
| Supabase / PostgreSQL | Strong | Already used (OCR IP limit pattern) | Medium + DB load | Medium | Acceptable alternative if DO unavailable |
| Redis-compatible | Strong | New vendor/ops | Low | Medium–high | Avoid unless already standardized |

### Decision (implement later — **not in this prep**)

**Recommended:** Cloudflare Durable Object `TalkVoiceTurnRateLimiter`.

| Dimension | Decision |
| --- | --- |
| Scope | Credential issuance only (`POST /api/talk-voice-turn-credentials`) |
| User key | Supabase auth user id |
| Thread/session key | `sessionId` (UUID) |
| Composite primary bucket | `userId:sessionId` |
| IP key | Secondary soft signal only (hashed) — not sole allow |
| Burst | 6 / 60s per composite bucket (match current) |
| TTL | Bucket window 60s · no durable history beyond window |
| Fail mode | **Fail-closed** (503 `rate_limit_unavailable`) on DO errors |
| Multi-region | Single DO id per bucket (CF handles primary) |
| Cost | Negligible vs TURN egress · prefer correctness |
| Implementation boundary | New `_shared/talk-voice-turn-rate-limit.mjs` + DO binding · keep HMAC/TURN logic unchanged |

Signal-path SQL rate limits remain separate (Phase 2 SQL draft) and do not replace credential DO limits.

## Security gates

- [x] No Production DB/MCP target in prep scripts
- [x] Production hostname/ref rejection in env validator
- [x] Secrets redacted in generator/preflight output
- [x] `.env.staging` gitignored
- [x] Overwrite requires `--force`
- [x] Credential API unauth → 401
- [ ] Distributed rate limit implemented
- [ ] Staging migration applied
- [ ] Real coturn / TLS 443 verified

## Rollback

| Layer | Action |
| --- | --- |
| Feature flags | Set `TALK_VOICE_SELF_HOSTED_TURN_ENABLED=false` (and rebuild Staging preview if needed) |
| coturn | Stop Staging node · DNS leave or remove · no Production impact |
| DB | Reverse SQL only on Staging · never “fix” Production |
| Credentials | Rotate shared secret after disable · wait > TTL |

## Exact commands (prep verification)

```bash
node scripts/lib/create-env-staging.mjs --dry-run
node scripts/lib/create-env-staging.mjs --help
node scripts/test-talk-voice-phase2-staging-prep.mjs
node scripts/preflight-talk-voice-phase2-staging.mjs
# optional when .env.staging incomplete:
node scripts/preflight-talk-voice-phase2-staging.mjs --skip-http
```

## Evidence

| Check | Result |
| --- | --- |
| Env dry-run | See test script |
| Negative: production host | Rejected |
| Negative: missing TURN secret | Rejected |
| Negative: wrong issuer | Rejected |
| 8788 `/talk-home` | Expect HTTP 200 + script tags |
| Credential unauth | Expect HTTP 401 `auth_required` |
| Dist parity TURN functions | Byte-equal source/dist |
| Migration apply | **Not run** |
| coturn change | **Not run** |
| push / deploy | **Not run** |

## Go / No-Go checklist

| Gate | Verdict |
| --- | --- |
| Staging prep reproducible | **Go** |
| Production mis-op prevention | **Go** |
| Secrets absent from git | **Go** |
| Migration unapplied (this session) | Confirmed |
| coturn unchanged (this session) | Confirmed |
| push/deploy absent | Confirmed |
| Staging execution (migrate + coturn + E2E) | **No-Go** until blockers cleared |

**Final prep verdict: PASS (preparation complete · execution blocked).**
