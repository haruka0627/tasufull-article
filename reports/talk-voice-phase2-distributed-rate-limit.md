# TALK Voice Phase 2 — Distributed Rate Limit (Durable Objects)

**Date:** 2026-07-26  
**Start HEAD:** `32ff99c75cac3bd8f65af0aa24cd632981668ff0`  
**End HEAD:** `32ff99c75cac3bd8f65af0aa24cd632981668ff0` (no commit in this task)  
**Branch:** `cf-pages-deploy`  
**Verdict:** **PASS WITH BLOCKERS** — local Durable Object implementation, endpoint integration, tests, and dist mirrors are complete; Staging/Production DO binding deploy and real multi-isolate verification remain.

## 1. Executive verdict

Distributed rate limiting for `POST /api/talk-voice-turn-credentials` is implemented with:

- Cloudflare Durable Object class `TalkVoiceTurnRateLimiter`
- Pages Function client + config validation (fail-closed)
- Local isolate pre-filter retained (authority = DO)
- Unit tests with an explicit mock binding (`TALK_VOICE_RATE_LIMIT_USE_MOCK`)
- Dist parity for credential API + rate-limit shared module

**Not done (by design this session):** push, deploy, DO remote migration apply, coturn/secret changes, Browser E2E, commit.

## 2. Git baseline

| Field | Value |
| --- | --- |
| Start HEAD | `32ff99c` |
| End HEAD | `32ff99c` (uncommitted work only) |
| Branch | `cf-pages-deploy` |
| Pre-existing dirty | ~824 paths · not touched |

## 3. Existing rate-limit analysis

Prior behavior: in-memory `Map` in the credential Function (`6 / user:session / 60s`) per isolate.

Limits:

- Lost on isolate recycle
- Not shared across isolates/regions
- Insufficient for controlled Staging/Production exposure

This remains as a **local pre-filter** only. Durable Object is authoritative.

## 4. Architecture

```text
Client
  → Pages Function /api/talk-voice-turn-credentials
      → config validate (Production: enabled+fail-closed required)
      → auth-failure IP peek (DO)
      → Supabase JWT verify
      → on auth fail: auth-failure IP consume (DO) · uniform 401/429
      → local isolate pre-filter (userId:sessionId, max 6/60s)
      → DO consume: user · IP · session(UUID) · global
      → TURN REST credential issue
```

Worker (separate from Production `gemini-live-proxy`):

- `deploy/cloudflare/workers/talk-voice-rate-limiter.js`
- `deploy/cloudflare/workers/talk-voice-rate-limiter.wrangler.toml`

Pages binding example (not applied):

- `deploy/cloudflare/wrangler.pages.talk-voice-rate-limit.example.toml`

## 5. Request flow

1. Method / OPTIONS
2. Rate-limit config load (invalid → 503)
3. Client IP extract (`CF-Connecting-IP`; local/staging fallback `127.0.0.1`)
4. Auth-failure IP **peek**
5. Authentication (`requireSupabaseUser`)
6. Auth failure → **consume** auth-failure axis → 401 or 429 (no axis leakage)
7. Body parse (`sessionId`)
8. Local pre-filter
9. DO consume user / IP / session / global
10. TURN config + session access + credential

## 6. Durable Object design

| Item | Design |
| --- | --- |
| Class | `TalkVoiceTurnRateLimiter` |
| Binding name | `TALK_VOICE_RATE_LIMITER` |
| Actions | `consume`, `peek` |
| Storage | single key `bucket` → `{ count, windowStart, burstCount, burstStart }` |
| Alarm | optional cleanup after window |
| Atomicity | single-threaded DO per `idFromName` |
| DO name | `tvrl:<namespace>:<axis>:<hmac-hex>` |

DO never receives or stores JWT, TURN secrets, raw user IDs, or raw IPs.

## 7. Key and privacy design

```text
HMAC-SHA256(TALK_VOICE_RATE_LIMIT_HASH_KEY, namespace|endpoint|axis|identifier)
```

- Staging / production / development namespaces never share DO names
- Hash key from secret manager (≥32 chars when enabled without mock)
- Hash failure → fail-closed 503
- Telemetry records decision/reason/status/retry bucket only — no raw IDs, tokens, or full DO keys

## 8. Configuration

Defaults (overridable via env):

| Axis | Max | Burst | Window |
| --- | ---: | ---: | ---: |
| user | 10 | 6 | 60s |
| IP | 30 | 10 | 60s |
| session | 12 | 6 | 60s |
| global | 300 | 60 | 60s |
| auth-failure/IP | 10 | 5 | 300s |

Burst window (short interval inside the main window): **10s**.

Env keys (placeholders in `.env.staging.example`):

- `TALK_VOICE_RATE_LIMIT_ENABLED`
- `TALK_VOICE_RATE_LIMIT_FAIL_CLOSED`
- `TALK_VOICE_RATE_LIMIT_NAMESPACE`
- `TALK_VOICE_RATE_LIMIT_HASH_KEY` (secret · empty in example)
- `TALK_VOICE_RATE_LIMIT_*_MAX` / `*_BURST`
- `TALK_VOICE_RATE_LIMIT_WINDOW_SECONDS`
- `TALK_VOICE_RATE_LIMIT_AUTH_WINDOW_SECONDS`
- `TALK_VOICE_RATE_LIMIT_USE_MOCK` (tests/local only · Production rejected)

Rules:

- Production / unknown env: enabled required, fail-closed required, mock forbidden
- Staging env file must not use `namespace=production`
- NaN / negative / extreme numerics → `config_invalid` → 503

## 9. Fail-closed behavior

| Condition | HTTP | Body error |
| --- | ---: | --- |
| DO binding missing | 503 | `service_unavailable` |
| DO fetch/timeout/invalid JSON | 503 | `service_unavailable` |
| Config invalid / Production disabled / fail-open | 503 | `service_unavailable` |
| Hash key missing / hash failure | 503 | `service_unavailable` |
| IP unavailable in production-like | 503 | `service_unavailable` |

Always sets `Retry-After`. Never issues TURN credentials on these paths.

Local unit tests may set `TALK_VOICE_RATE_LIMIT_USE_MOCK=true` for an in-process namespace that speaks the same protocol.

## 10. Response contract

```http
HTTP/1.1 429
Retry-After: <seconds>
Content-Type: application/json

{"ok":false,"error":"rate_limited","retry_after_seconds":42}
```

```http
HTTP/1.1 503
Retry-After: <seconds>

{"ok":false,"error":"service_unavailable","retry_after_seconds":5}
```

**Never returned to clients:** axis name, remaining quota, hash, DO id, auth-failure counts, internal reason codes.

Internal telemetry may distinguish `user_limited` / `ip_limited` / `session_limited` / `global_limited` / `auth_failure_throttled` / `do_*`.

## 11. Telemetry

Safe fields: `kind`, `endpoint`, `ts`, `decision`, `reason`, `environment`, `status`, `retryAfterBucket`.

Forbidden: user id, IP, JWT, Authorization, TURN credential/shared secret, full DO storage key.

## 12. Cloudflare bindings

| File | Role |
| --- | --- |
| `workers/talk-voice-rate-limiter.wrangler.toml` | DO Worker + migration tag `talk-voice-rl-v1` |
| `wrangler.pages.talk-voice-rate-limit.example.toml` | Example Pages binding (commented · Staging only) |

**Production Pages bindings were not changed.** Deploy was not executed.

## 13. Staging / Production separation

- Prefer `CF_PAGES_ENV=production` (not branch alone) for Production detection — local `wrangler pages dev` on `cf-pages-deploy` must not look like Production for rate-limit defaults
- Staging runtime cannot use `production` namespace
- Production runtime cannot use non-`production` namespace
- Hash material includes namespace → cross-env counters cannot collide intentionally

## 14. Test coverage

```bash
node scripts/test-talk-voice-distributed-rate-limit.mjs
# 26 PASS — allow/deny/burst/window/config/fail-closed/privacy/auth-failure/DO-missing

node scripts/test-talk-voice-turn-credentials.mjs
# PASS — JWT/participant/TTL/HMAC/local+distributed limit/secret

node scripts/test-talk-voice-phase2-staging-prep.mjs --skip-http
# expects dist parity including talk-voice-rate-limit.mjs
```

## 15. Dist parity

Mirrored:

- `deploy/cloudflare/dist/functions/api/talk-voice-turn-credentials.js`
- `deploy/cloudflare/dist/functions/_shared/talk-voice-rate-limit.mjs`

Byte-equal to source after selective copy (no full `build:pages`).

## 16. Security findings

| Severity | Finding |
| --- | --- |
| Critical | None |
| High | None in code path; **deploy without DO binding remains fail-closed 503** (safe, but Staging credential issuance needs binding) |
| Medium | Local pre-filter still isolate-local (expected); CF-Connecting-IP spoofing outside CF edge is out of scope |
| Low | Auth-failure counters are not reset on success (intentional anti-reset) |

## 17. Remaining blockers

1. Staging Pages DO binding + Worker deploy not applied
2. Real multi-isolate / multi-region DO verification not run
3. `.env.staging` still missing Phase 2 + rate-limit secrets (human fill)
4. Staging SQL / coturn / TLS 443 / Browser E2E still pending (separate gates)
5. Production exposure forbidden until DO live + fail-closed proven

## 18. Deployment prerequisites

1. Fill `TALK_VOICE_RATE_LIMIT_HASH_KEY` (≥32) in Staging secret manager
2. Deploy DO Worker with `talk-voice-rate-limiter.wrangler.toml` (Staging account only)
3. Bind `TALK_VOICE_RATE_LIMITER` on Staging/Preview Pages (example toml)
4. Set `TALK_VOICE_RATE_LIMIT_ENABLED=true`, `FAIL_CLOSED=true`, `NAMESPACE=staging`
5. Confirm unauth → 401; over-limit → 429 + Retry-After; missing binding → 503
6. Do **not** enable on Production until release gate

## 19. Rollback plan

1. Set `TALK_VOICE_RATE_LIMIT_ENABLED=false` **only on non-Production**
2. Or remove Pages DO binding (credential API fails closed → safe outage, not fail-open)
3. Feature-flag Staging TURN off (`TALK_VOICE_SELF_HOSTED_TURN_ENABLED=false`)
4. Keep Worker class for later re-enable; do not delete migration tag casually

## 20. Commands not executed

- `git push` / deploy / `wrangler deploy`
- Supabase migration apply / `db push`
- coturn change/restart
- secret generate/display / `.env.staging` real-value edit
- Browser E2E
- `git commit` / `git add -A`

## Safety confirmation

- push 未実施
- deploy 未実施
- migration 未実行
- coturn 未変更
- `.env.staging` 実値未変更
- secrets 非表示・非コミット
- commit 未実施
