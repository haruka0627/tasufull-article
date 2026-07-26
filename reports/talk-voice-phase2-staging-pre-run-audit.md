# TALK Voice Phase 2 — Staging Execution Pre-Run Audit

**Date:** 2026-07-26
**Type:** Audit · planning · gap detection only (no execution)
**Baseline commit:** `7e72d0af846525b71a45a8074a1922416a41b365`
**Branch:** `cf-pages-deploy`

This document is the go/stop reference a human operator uses **before** starting the
Staging execution window. It records what to prepare, in what order, which commands
are safe, where to stop, and the PASS/FAIL definition for each gate — without guessing.

---

## 1. Executive verdict

**PASS WITH BLOCKERS.**

The preparation artifacts (commit `7e72d0a`) are internally consistent, enforce
Production rejection and secret redaction, and never auto-apply migrations, mutate
coturn, deploy, or push. Staging execution can be started **safely once a human fills
Staging secrets and provisions coturn/TLS infrastructure** and honors the stop gates
in §11–12.

Execution must **not** begin yet. Blocking items in §13 (secrets unfilled, migration
mechanics, coturn/TLS/infra unknowns, distributed rate limit not implemented) remain
open by design.

One **High** documentation/mechanics gap was found and clarified (§6): the Phase 2 SQL
files are **not** registered Supabase migrations and are **not** applied by
`supabase db push`.

---

## 2. Git baseline

| Field | Value |
| --- | --- |
| HEAD | `7e72d0af846525b71a45a8074a1922416a41b365` |
| Branch | `cf-pages-deploy` |
| `7e72d0a` present in history | Yes (HEAD == `7e72d0a`) |
| Staged | 0 |
| Unstaged (tracked, modified) | 410 |
| Untracked | 414 |
| Total dirty | 824 |

`7e72d0a` `--stat`: 7 files, +1867 (the seven preparation artifacts).

### Pre-existing dirty NOT touched by this audit

The working tree carries a large, unrelated pre-existing dirty set (AI usage, builder,
business-directory, platform-request, OCR, gemini, dist mirrors, dist docs, etc.).
TALK-adjacent examples intentionally left alone:

- `deploy/cloudflare/dist/docs/talk-call-turn-config.md` (M)
- `deploy/cloudflare/dist/docs/talk-call-turn-production-checklist.md` (M)
- `deploy/cloudflare/dist/docs/talk-call-web-push-deploy.md` (M)
- `deploy/cloudflare/dist/scripts/test-talk-voice-browser-smoke.mjs` (??)

None of these are staged, edited, or removed by this audit.

---

## 3. Preparation artifact audit

All seven artifacts read and cross-checked against `reports/talk-voice-phase2-staging-readiness.md`.

| Artifact | Verdict | Notes |
| --- | --- | --- |
| `.env.staging.example` | PASS | REQUIRED/OPTIONAL labeled · all secret fields blank · Staging ref only · no live secret |
| `scripts/lib/talk-voice-staging-env.mjs` | PASS | Central schema + validator + redaction |
| `scripts/lib/create-env-staging.mjs` | PASS | `--dry-run` side-effect free · overwrite needs `--force` · redacted preview |
| `scripts/lib/talk-voice-phase2-e2e-matrix.mjs` | PASS | 4 forced routes + 11 assertion keys · mock-pass forbidden |
| `scripts/preflight-talk-voice-phase2-staging.mjs` | PASS | Read-only · prints migration commands, never runs apply |
| `scripts/test-talk-voice-phase2-staging-prep.mjs` | PASS | 17 checks (15 with `--skip-http`) |
| `reports/talk-voice-phase2-staging-readiness.md` | PASS (clarified) | §6 SQL-vs-migration note added this audit |

### Security property verification (code-level)

| Property | Enforced where | Verdict |
| --- | --- | --- |
| Production ref rejected | `validateTalkVoiceStagingEnv` → `production_ref` / `wrong_project_ref` | PASS |
| Production URL rejected | `wrong_supabase_url` + `containsProductionMarker` | PASS |
| Production origin rejected | `production_origin` per-origin scan | PASS |
| Production issuer rejected | `wrong_issuer` (expects Staging `/auth/v1`) | PASS |
| Production Pages host rejected | `productionHostPatterns()` includes `tasufull-article.pages.dev` | PASS |
| `BD_PRODUCTION_PROJECT_REF` guard exempt | explicit key skip (intended constant) | PASS |
| Secret values never logged | `redactValue` → `set(len=N)` / `(empty)`; secrets never printed raw | PASS |
| Secret values never in report | readiness report contains only key names | PASS |
| No migration auto-run | preflight only `console.log`s commands | PASS |
| No coturn mutation | no turnserver/docker invocation anywhere | PASS |
| No deploy/push | absent from all prep scripts | PASS |
| `--dry-run` side-effect free | returns before `writeFileSync` | PASS |
| TLS port must be 443 | `parsePort(...,443)` → `expected_port_443` | PASS |
| host/realm/issuer/audience/origin coherence | dedicated checks each | PASS |
| client/function/dist parity | preflight + test byte-compare | PASS |
| E2E matrix coverage | 4 transports + auth/lifecycle assertions | PASS |
| Credential API fail-closed | 404 feature-off · 503 on 5xx/config · 403/404/409/410 on access | PASS |

### Severity-classified findings

- **Critical:** none.
- **High:** SQL-vs-migration mechanics (§6) — `sql/*.sql` are not migrations; `db push` will not apply them. Clarified in readiness report + this audit.
- **Medium:**
  - Credential rate limit is per-isolate only (documented; distributed design in §9). Must not reach Production-equivalent exposure without it.
  - Console output uses some non-ASCII glyphs (`—`, `·`, `≥`) that render as mojibake in Windows PowerShell; cosmetic only, exit codes/logic unaffected (partially normalized already).
- **Low:**
  - `preflight` `nlabel`/migration-hint strings still contain `—`/`·` (cosmetic).
  - Real `.env.staging` predates the template and lacks the new `TALK_VOICE_*` keys (expected; operator regenerates — §5).

---

## 4. Environment readiness

- Schema SSOT: `scripts/lib/talk-voice-staging-env.mjs` (`TALK_VOICE_STAGING_ENV_FIELDS`).
- Generator: `node scripts/lib/create-env-staging.mjs` (`--help/--dry-run/--validate-only/--force[/--fetch-keys]`).
- Template: `.env.staging.example` → gitignored `.env.staging`.
- Required = 23, Optional = 6 (see readiness report Environment matrix).
- Production reuse actively rejected by validator.

**Verdict:** tooling ready; the live env file is incomplete (§5).

---

## 5. Secret readiness (values never shown)

`.env.staging` **exists**, is **gitignored**, and is **not git-tracked** (`git check-ignore` hit; `ls-files --error-unmatch` miss).

Per-key status (redacted — no values, no lengths):

```text
SUPABASE_PROJECT_REF: present/staging-safe [required]
SUPABASE_URL: present/staging-safe [required]
SUPABASE_ANON_KEY: present/staging-safe [required][secret]
SUPABASE_SERVICE_ROLE_KEY: present/staging-safe [required][secret]
BD_PRODUCTION_PROJECT_REF: present/staging-safe [required]
TASFUL_SUPABASE_URL: present/staging-safe [required]
TASFUL_SUPABASE_ANON_KEY: present/staging-safe [required][secret]
TALK_VOICE_STAGING_HOSTNAME: missing [required]
TALK_VOICE_STAGING_ALLOWED_ORIGINS: missing [required]
TALK_VOICE_STAGING_JWT_ISSUER: missing [required]
TALK_VOICE_STAGING_JWT_AUDIENCE: missing [required]
TALK_VOICE_SELF_HOSTED_TURN_ENABLED: missing [required]
TALK_VOICE_CONNECTION_TELEMETRY_ENABLED: missing [required]
TALK_VOICE_TURN_HOST: missing [required]
TALK_VOICE_TURN_UDP_PORT: missing [required]
TALK_VOICE_TURN_TCP_PORT: missing [required]
TALK_VOICE_TURN_TLS_PORT: missing [required]
TALK_VOICE_TURN_REALM: missing [required]
TALK_VOICE_TURN_SHARED_SECRET: missing [required][secret]
TALK_VOICE_TURN_TLS_CERT_PATH: missing [required]
TALK_VOICE_TURN_TLS_KEY_PATH: missing [required]
TALK_VOICE_TURN_CREDENTIAL_API_URL: missing [required]
TALK_VOICE_TELEMETRY_SINK: missing [required]
AUTH_HOOK_L2_ALLOWLIST_PASSWORD: present/staging-safe [optional][secret]
TALK_VOICE_TURN_FORCE_RELAY_TEST: missing [optional]
TALK_VOICE_TURN_CREDENTIAL_TTL_SEC: missing [optional]
TALK_VOICE_TURN_EXTERNAL_IP: missing [optional]
TALK_VOICE_TURN_RELAY_IP: missing [optional]
SITE_URL: missing [optional]
overall_ok=false · missing_required=16
```

The existing Supabase block is already Staging-safe; the 16 missing required keys are the
new Phase 2 additions. Classification of missing keys:

| Class | Keys |
| --- | --- |
| Human sets from secret manager | `TALK_VOICE_TURN_SHARED_SECRET` |
| Safe to generate from repo info | `TALK_VOICE_STAGING_JWT_ISSUER`, `TALK_VOICE_STAGING_JWT_AUDIENCE`, `TALK_VOICE_STAGING_ALLOWED_ORIGINS` (127.0.0.1:8788), `TALK_VOICE_TURN_UDP_PORT/TCP_PORT/TLS_PORT`, `TALK_VOICE_TURN_CREDENTIAL_API_URL`, `TALK_VOICE_TELEMETRY_SINK`, feature flags |
| Set after Staging infra decided | `TALK_VOICE_TURN_HOST`, `TALK_VOICE_TURN_REALM`, `TALK_VOICE_STAGING_HOSTNAME`, `TALK_VOICE_TURN_TLS_CERT_PATH`, `TALK_VOICE_TURN_TLS_KEY_PATH` |
| Optional / not required | `TALK_VOICE_TURN_FORCE_RELAY_TEST`, `TALK_VOICE_TURN_CREDENTIAL_TTL_SEC`, `TALK_VOICE_TURN_EXTERNAL_IP`, `TALK_VOICE_TURN_RELAY_IP`, `SITE_URL` |

**Recommended safe fill path:** merge the new template keys into the existing
`.env.staging` (do not blindly `--force` overwrite, which would clear the already-set
Supabase secrets unless `--fetch-keys` is used). Then `--validate-only`.

**Verdict:** BLOCKED until the 16 required keys are filled (values never to be printed/committed).

---

## 6. Migration readiness (no apply)

### Inventory

- `supabase/migrations/`: 49 registered migrations.
- Talk-voice Phase 2 SQL: `sql/talk-voice-phase1-session-usage.sql`, `sql/talk-voice-phase2-security-telemetry.sql` — **located in `sql/`, NOT in `supabase/migrations/`**.
- No `*talk*voice*` file exists under `supabase/migrations/` (only older June `talk_foundation`, `talk_room_contact_bridge`, `talk_helper_functions`).

### High finding — apply mechanics

`supabase db push` operates on the **migrations directory**. It will **not** apply the
talk-voice Phase 2 SQL. Those must be applied **manually** as single-file SQL (Dashboard
SQL editor or `supabase db query`/psql against the Staging-linked project). Treating
`db push` as the Phase 2 apply path would silently skip the intended DDL. Clarified in
`reports/talk-voice-phase2-staging-readiness.md` §DB migration procedure.

### Unrelated pending migration decision

`supabase/migrations/20260705120000_builder_general_jobs_p3_withdraw_staging.sql` has a
timestamp (`2026-07-05`) **earlier** than many already-present later migrations
(`…0719…`, `…0726…`, `…0727…`). If Staging remote history is missing `20260705120000`
while holding later ones, `db push` would be out-of-order and demand `--include-all`.

**Determination (per current information): CANNOT DECIDE from local state alone.** The
remote Staging migration list is required to know whether `20260705…` (and any others)
are already applied. Do **not** assume Phase 2 SQL can leapfrog it — and note Phase 2 SQL
is not a migration anyway (above), so the correct path is:

1. Get remote applied list (command below).
2. Reconcile the unrelated builder pending migration as a **separate** cross-team decision.
3. Apply talk-voice Phase 1 then Phase 2 SQL **manually** (single-file), independent of `db push`.

Options explicitly enumerated (choose after remote list is known):

- [ ] All pending migrations appl_able in order (then `db push` is safe for the builder item; talk-voice still manual)
- [ ] Pre-Phase-2 migration problematic → STOP
- [ ] Isolated staging project required
- [ ] Migration history repair required
- [x] **Undecidable from current local information** (default until remote list obtained)

### Safe commands (NOT executed here)

```bash
# Identify/confirm target (must be Staging)
npx supabase link --project-ref ahlxuyvhzqdqaojiywmu   # NEVER ddojquacsyqesrjhcvmn
cat supabase/.temp/project-ref                          # expect ahlxuyvhzqdqaojiywmu

# Remote applied migration list (read)
npx supabase migration list --linked

# Inspect pending vs local (read; does not apply)
npx supabase db push --dry-run

# Manual single-file apply (ONLY after approval; Staging-linked)
# npx supabase db query --linked --file sql/talk-voice-phase1-session-usage.sql
# npx supabase db query --linked --file sql/talk-voice-phase2-security-telemetry.sql
```

**Prerequisites:** Supabase CLI auth + Staging link; DB password/service access for query.
**Expected output:** migration list distinguishes applied vs pending; dry-run shows the
builder pending item.
**Danger conditions:** linked ref == Production; `--include-all` without decision; running
`db push` expecting it to apply talk-voice SQL.
**Stop conditions:** any Production marker; drift; unresolved pending builder migration;
no backup note.

**Verdict:** BLOCKED (remote list needed; manual apply path; unrelated migration undecided).

---

## 7. coturn readiness (no change)

Reference only: `config/coturn/tasful-talk-turnserver.example.conf`,
`docker-compose.staging.example.yml`, `README.md`.

| Item | Example provides | Needs human input |
| --- | --- | --- |
| coturn version/image | `${COTURN_IMAGE}` digest-pinned (compose) | Pinned reviewed digest |
| OS/runtime | Docker `read_only`, `cap_drop ALL`, `no-new-privileges` | Host/orchestrator choice |
| TURN hostname / DNS | realm placeholder | **Staging DNS A/AAAA** |
| public IP / external-ip | `external-ip` placeholder | **Public IP** |
| relay IP | `relay-ip` placeholder | **Relay IP** |
| UDP listener | `3478/udp` | confirm on host |
| TCP listener | `3478/tcp` | confirm on host |
| TLS listener 443 | `alt-tls-listening-port=443` (+5349) | confirm routing (§8) |
| relay range | `49160-49260` | firewall open |
| firewall / security group | ports enumerated | **Cloud SG rules** |
| certificate path | `/run/secrets/talk_turn_fullchain.pem` | **Real cert** |
| private key path | `/run/secrets/talk_turn_privkey.pem` | **Real key** |
| cert renewal | README rotation notes | Renewal automation |
| realm | placeholder | Matches TURN host |
| shared secret mech | `use-auth-secret` + REST | **32+ byte secret** |
| static-auth-secret | `INJECT_AT_RUNTIME_DO_NOT_COMMIT` | Runtime inject |
| stale-nonce | `600` | ok |
| fingerprint | enabled | ok |
| TLS cipher/protocol | `no-tlsv1/1_1`, `HIGH:!aNULL:!MD5:!3DES` | ok |
| log secret masking | stdout, `simple-log`, no secret/SDP/ICE | ok |
| health check | `turnutils_stunclient`/`uclient` | Run at exec |
| restart/rollback | `restart: unless-stopped`; disable flag | ok |

**Verdict:** config template ready; all infra values are **要人間入力** (host, IPs, DNS,
firewall, cert/key, image digest). BLOCKED until provisioned.

---

## 8. TLS 443 readiness

| Concern | Status |
| --- | --- |
| coturn `alt-tls-listening-port=443` | Present in example |
| Port competition with web/proxy on 443 | **要人間入力** — dedicated TURN node/IP or L4 split required |
| TCP 443 vs TURN-TLS 443 routing | **要人間入力** — no HTTP multiplexer assumed; TURN needs raw TLS/TCP |
| L4 proxy usage | **要人間入力** (if any, must pass TCP transparently, no L7) |
| ALPN/SNI dependency | None required by TURN; document if proxy added |
| certificate hostname match (SAN) | Must equal `TALK_VOICE_TURN_HOST` — verify at exec |
| IPv4/IPv6 differences | `denied-peer-ip` covers private + IPv4-mapped IPv6 |
| client URL | `turns:<host>:443?transport=tcp` from `buildIceServers` |

**Verdict:** design coherent; live 443 routing/cert are infra unknowns. BLOCKED until node + cert exist and E2E `turn_tls_443` passes on real relay stats.

---

## 9. Distributed rate-limit readiness (design only — no implementation)

### Current state

`deploy/cloudflare/functions/api/talk-voice-turn-credentials.js` uses an in-memory `Map`
(`RATE_MAX=6`, `RATE_WINDOW_MS=60_000`) keyed `userId:sessionId`, per isolate — lost on
recycle, not shared across isolates/regions.

### Recommended design — Cloudflare Durable Object `TalkVoiceTurnRateLimiter`

| Item | Decision (config-tunable) | Reason |
| --- | --- | --- |
| DO responsibility | Count + decide for credential issuance only | Single authority per key; strong consistency |
| Key design | Primary `hash(userId):sessionId`; secondary soft `hash(ip)`; global `endpoint` breaker | Per-user+call precision; IP soft signal only |
| Window | Fixed 60s window (config `windowMs`) | Matches current; simple, testable |
| Burst | `maxPerWindow=6` (config); global breaker e.g. 600/min | Preserve current UX; cap abuse |
| TTL | Bucket auto-expires at window end; no history beyond | Privacy; low storage |
| Atomicity | Single-threaded DO `fetch` per key = atomic read-modify-write | No races (KV cannot guarantee) |
| Fail-closed | DO error/unreachable → `503 rate_limit_unavailable` | Never fail-open on authz burst |
| DO outage behavior | Deny (fail-closed) + telemetry counter | Safety over availability |
| Namespace separation | Distinct DO namespace/binding per env (`*_STAGING` vs prod) | No cross-env leakage |
| Retry policy | One short retry on transient DO error, then fail-closed | Bounded latency |
| Clock drift | Server `Date.now()` inside DO only; ignore client time | Single clock |
| Telemetry | Emit allow/deny counts + rid (hashed); never raw IP/secret | Observability + privacy |
| Privacy | Hash user/IP; store no PII, no secret | Enumeration-resistant |
| Secret storage | None in DO | Secrets stay in issuer env |
| User enumeration defense | Uniform `429` + `Retry-After`; no "unknown user" distinction | No oracle |
| Response code | `429` limited (`Retry-After` seconds); `503` DO-unavailable | Standard |
| `Retry-After` | `ceil((resetAt-now)/1000)` | Client backoff |
| Relation to local limit | Keep in-isolate `Map` as cheap pre-filter; DO is authority | Defense-in-depth |
| Migration/deploy | Add DO class + `wrangler.toml` binding + migration tag; ship behind flag | Reversible |
| Rollback | Feature flag → fall back to in-isolate limiter | Fast revert |
| Test plan | Unit (window/burst/expiry/fail-closed), integration (2 isolates share DO), abuse burst, DO-outage deny, no-secret-in-logs | Deterministic |

Candidate comparison (unchanged conclusion): DO recommended; Supabase/PostgreSQL
acceptable fallback (matches OCR IP-limit RPC pattern); KV rejected for authz races;
D1 possible but more glue; Redis avoided (new vendor).

**Verdict:** design complete and Production-safe in intent; implementation intentionally
deferred. Must exist before any Production-equivalent exposure.

---

## 10. Browser E2E readiness

Plan module `scripts/lib/talk-voice-phase2-e2e-matrix.mjs`: 4 forced transports + 11
per-context assertions, `mockPassForbidden=true`. Audited and expanded (plan only) to the
required coverage below.

### Authentication cases

unauthenticated (401) · valid staging user (200) · expired token (401) · wrong issuer
(401) · wrong audience (401) · invalid signature (401) · disabled user (403/401) ·
revoked session (401/403). Auth verified via Supabase `/auth/v1/user` (decode-only
forbidden) — matches `requireSupabaseUser`.

### Credential API cases

issue success · TTL bounds (300–1800, default 1200) · username `expiry:session:user`
format · HMAC-SHA1 base64 password format · realm present · ICE server schema
(stun/turn-udp/turn-tcp/turns-443) · secret never in response/logs · rate limit (429 +
`Retry-After`) · telemetry sink/row.

### TURN transport cases

UDP relay · TCP relay · TLS 443 relay · force-relay (`iceTransportPolicy=relay`) ·
direct fallback (`all`) · blocked-UDP env · blocked-TCP env · certificate failure ·
wrong realm · expired credential · coturn unavailable (graceful fail).

### Browser matrix

Chromium (primary), Firefox, WebKit; desktop + mobile viewport (390); two authenticated
users; same-NAT and different-network assumptions; relay candidate confirmation; connected
state; audio send/receive; mute; hangup; reconnect; tab close; permission denial.

### Evidence per case

browser console · network log · WebRTC `getStats()` · selected candidate pair · relay
protocol · API response status · server telemetry · coturn log · screenshots · report
JSON · secret redaction. **PASS only on real relay stats; mock success is FAIL.**

**Verdict:** plan ready; execution requires real coturn + Staging auth. BLOCKED.

---

## 11. Execution sequence (with gates)

| Step | Preconditions | Command(s) | PASS | FAIL / STOP | Rollback | Evidence | Human approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Secrets prep | Secret manager access | (manual fill of `.env.staging`) | 16 required present | any missing/placeholder | n/a | redacted status | **Yes** |
| B. Env preflight | A | `node scripts/preflight-talk-voice-phase2-staging.mjs` | PREFLIGHT PASS | any FAIL / Production marker | fix env | preflight log | No |
| C. Migration inventory | Staging link | `supabase migration list --linked`; `db push --dry-run` | remote list obtained | Production link / drift | unlink | list output | No |
| D. Migration approval | C | (review) | disposition chosen | unrelated pending undecided | STOP | sign-off | **Yes** |
| E. Migration apply | D + backup | manual single-file `db query --file sql/…` | DDL applied Staging | error / wrong ref | reverse SQL | apply log | **Yes** |
| F. Schema verify | E | SELECT columns/triggers | all present | missing | reverse SQL | query rows | No |
| G. coturn infra verify | Host/DNS/IP/cert | (host checks) | ports+cert+SG ok | any unknown | n/a | infra notes | **Yes** |
| H. coturn config apply | G | (deploy conf on node) | coturn healthy | start fail | stop node | coturn log | **Yes** |
| I. TURN transport smoke | H | `turnutils_stunclient`/`uclient` | UDP/TCP/TLS alloc | any fail | disable flag | tool output | No |
| J. Credential API deploy | E,H, rate-limit decision | (Staging deploy — separate task) | 401 unauth; 200 auth | fail-open / 5xx | flag off | API logs | **Yes** |
| K. Browser E2E | I,J | Playwright matrix (§10) | relay stats per route | mock-only / no relay | disable flag | stats+screens+JSON | No |
| L. Telemetry/rate-limit verify | K | inspect sink + limiter | counts, 429, fail-closed | fail-open / leak | flag off | telemetry | No |
| M. Staging release verdict | A–L | (review) | all gates PASS | any blocker | n/a | this report | **Yes** |

---

## 12. Human approval gates (mandatory STOP)

Stop and require human decision when **any** occurs:

- Production ref detected (`ddojquacsyqesrjhcvmn`)
- Production URL / origin / Pages host detected
- Secret missing or placeholder
- Migration drift
- Unrelated pending migration undecided
- Backup not confirmed
- coturn host unknown
- TLS certificate unknown / SAN mismatch
- Port 443 competition
- Firewall/security group unverified
- Rate limit not implemented but Production-equivalent exposure planned
- Credential API fails open
- E2E cannot confirm a relay candidate
- Any secret appears in a log or report

---

## 13. Blocking issues

1. `.env.staging` missing 16 required `TALK_VOICE_*` keys (secrets + infra).
2. Phase 2 SQL are not registered migrations — manual single-file apply required (High, clarified).
3. Remote Staging migration list unknown → unrelated builder pending migration undecided.
4. coturn node / DNS / public+relay IP / firewall not provisioned.
5. TLS 443 cert/key + routing not established.
6. Distributed rate limiter not implemented (design only).
7. Strict browser E2E not executed (needs real coturn + Staging auth).

## 14. Non-blocking issues

- Console non-ASCII glyphs render as mojibake in PowerShell (cosmetic; logic/exit codes fine).
- Existing `.env.staging` predates template (regenerate/merge, do not blind-overwrite).
- Optional keys (`SITE_URL`, external/relay IP hints, TTL override, force-relay) unset — acceptable.

---

## 15. Exact next action

1. Human fills the 16 required `TALK_VOICE_*` keys into `.env.staging` from the secret
   manager / infra decisions (never echo or commit values), preferring a merge over
   `--force` so existing Supabase secrets survive.
2. `node scripts/lib/create-env-staging.mjs --validate-only`
3. `node scripts/preflight-talk-voice-phase2-staging.mjs`
4. Then proceed to §11 Step C (migration inventory) — still no apply until Gate D approval.

## 16. Commands intentionally NOT executed

- `git push` · deploy · `wrangler … deploy`
- `supabase db push` / `db query` / migration apply / `--include-all`
- `supabase link` (not run in this audit)
- coturn start/restart/config change · `turnutils_*`
- certificate issue/renew · DNS/firewall change
- secret generate/store/print
- Durable Object implement/deploy
- `git commit` (this audit makes no commit)

## 17. Safety confirmation

- Migration: **not executed** (inventory read-only; talk-voice SQL untouched).
- coturn: **not changed / not restarted**.
- Secrets: **never displayed** (redacted status only; no values, no lengths for secrets).
- Push: **not performed**.
- Deploy: **not performed**.
- Commit: **not performed** in this audit.
- Existing dirty tree: **not modified/staged/deleted**.

**Final: PASS WITH BLOCKERS** — the procedure is safe and reproducible for a human to
begin Staging execution once secrets and coturn/TLS infrastructure are prepared and the
§11–12 gates are honored.
