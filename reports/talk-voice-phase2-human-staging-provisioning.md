# TALK Voice Phase 2 — Human Staging Provisioning Packet

**Type:** Operator checklist · static procedure only  
**Baseline HEAD:** `400e0aa681971fd9829d64d14592fce2a700e9ae`  
**Commit message:** `security(talk): add distributed TURN credential rate limiting`  
**Branch:** `cf-pages-deploy`  
**Document date:** 2026-07-26  

**This document does not execute anything.** It is the single packet a human operator uses to provision Staging safely. Real secret values must never appear in this file, chat, logs, or git.

| Constraint honored in this packet session | Status |
| --- | --- |
| push / deploy / Wrangler deploy | **NOT EXECUTED** |
| Pages binding change | **NOT EXECUTED** |
| secret generation / display / manager write | **NOT EXECUTED** |
| `.env.staging` edit | **NOT EXECUTED** |
| Supabase link / migration / Phase 2 SQL apply | **NOT EXECUTED** |
| coturn / DNS / firewall / certificate change | **NOT EXECUTED** |
| Browser E2E | **NOT EXECUTED** |
| stage / commit | **NOT EXECUTED** |

**Production release allowed: NO** (fixed for this packet; Staging verdict ≠ Production go).

---

## 1. Current blockers (SSOT)

### Cloudflare

| Blocker | Status |
| --- | --- |
| Staging Rate Limit HMAC key not loaded into secret store | Open |
| Durable Object Worker not deployed | Open |
| Staging Pages `TALK_VOICE_RATE_LIMITER` binding not set | Open |
| multi-isolate real-environment verification not run | Open |

### Environment

| Blocker | Status |
| --- | --- |
| `.env.staging` missing required `TALK_VOICE_*` values | Open |
| TURN host / realm undecided | Open — 要人間入力 |
| TLS certificate / key path undecided | Open — 要人間入力 |
| Staging hostname undecided (beyond local `127.0.0.1` template) | Open — 要人間入力 |

### Supabase

| Blocker | Status |
| --- | --- |
| Remote migration inventory not fetched | Open |
| Unrelated pending migration disposition undecided | Open |
| Phase 2 SQL (`sql/talk-voice-*.sql`) not applied | Open |

### coturn

| Blocker | Status |
| --- | --- |
| host / DNS / IP undecided | Open — 要人間入力 |
| firewall not verified | Open |
| TLS 443 routing not verified | Open |
| config not applied | Open |
| transport smoke test not run | Open |

### E2E

| Blocker | Status |
| --- | --- |
| Real credential API not deployed to Staging | Open |
| TURN UDP / TCP / TLS 443 not verified | Open |
| relay candidate not confirmed | Open |
| browser E2E not executed | Open |

**Cross-refs:** `reports/talk-voice-phase2-staging-pre-run-audit.md`, `reports/talk-voice-phase2-staging-readiness.md`, `reports/talk-voice-phase2-distributed-rate-limit.md`.

---

## 2. Document purpose

Using **only this packet**, an operator must be able to:

1. Confirm accounts and permissions  
2. Prepare secrets (without pasting values here)  
3. Merge keys into `.env.staging` without overwrite wipe  
4. Run validate-only  
5. Run preflight  
6. Inventory remote Supabase migrations (no apply)  
7. Deploy Durable Object Worker to **Staging** Cloudflare  
8. Bind `TALK_VOICE_RATE_LIMITER` on **Staging** Pages only  
9. Prepare coturn infrastructure  
10. Deploy credential API to Staging  
11. Run TURN transport smoke tests  
12. Run browser E2E  
13. Record Staging verdict (**Production release remains NO**)

---

## 3. Accounts and permissions (Phase A prerequisites)

| Item | Expected / how to confirm | STOP if |
| --- | --- | --- |
| Cloudflare account | Staging / Preview account only — Cloudflare Dashboardで人間が実施 | Production account selected |
| Staging Pages project | Project name ≠ Production `tasufull-article` production deployment target — Dashboardで人間が実施 | Production Pages project opened for edit |
| Wrangler login | `npx wrangler whoami` (identity only; confirm account name) | Account is Production |
| Account ID | Dashboard / `wrangler whoami` — record **masked** ID in evidence | Unknown or Production |
| Supabase Staging ref | `ahlxuyvhzqdqaojiywmu` (`docs/supabase-environments.md`) | Linked to `ddojquacsyqesrjhcvmn` |
| Operator roles | Cloudflare Workers/Pages edit · Supabase Staging SQL · coturn host admin · secret manager write | Missing role for next phase |

**Production Pages host pattern rejected by tooling:** `tasufull-article.pages.dev` in Staging env fields.

---

## 4. Secret inventory

### 4.1 Secret manager → inject (never commit / never echo)

| Key | Owner | Source | Destination | Req? | Format / constraint | Prod separation | Verify without showing value |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `TALK_VOICE_TURN_SHARED_SECRET` | Infra + Voice | Secret manager | `.env.staging` + coturn `static-auth-secret` (runtime inject) | Required | ≥32 chars · cryptographically random | Staging-only value · never reuse Production | `node scripts/lib/create-env-staging.mjs --validate-only` (prints `set(len=N)` via redaction) |
| `TALK_VOICE_RATE_LIMIT_HASH_KEY` | Voice / Cloudflare | Secret manager | Cloudflare secret + `.env.staging` (local validate) | Required before credential exposure | ≥32 chars · HMAC key | Staging ≠ Production key | Validate-only length class; Dashboard secret exists checkbox |
| `SUPABASE_ANON_KEY` | Backend | Staging Dashboard / `supabase projects api-keys` | `.env.staging` | Required | JWT-shaped Staging anon | Staging project only | Redacted validate-only |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Staging Dashboard / CLI | `.env.staging` | Required | Staging service_role | Staging project only | Redacted validate-only · never browser |
| `TASFUL_SUPABASE_ANON_KEY` | Frontend / Pages | Same as Staging anon | `.env.staging` | Required | Staging anon | Staging URL pair | Redacted validate-only |
| JWT verification material | Platform | Supabase Auth (issuer URL + JWKS via Staging project) | Credential Function env / Supabase URL | Required | Issuer must be Staging `/auth/v1` | Issuer must **not** be Production | Validator `wrong_issuer` / `production_origin` |
| `AUTH_HOOK_L2_ALLOWLIST_PASSWORD` | Auth QA | Staging Auth test user store | `.env.staging` | Optional | Staging-only password | Different from Production | Present/absent redacted |
| Telemetry auth secret | Ops | If sink requires auth | Secret manager → Staging Function env | Optional | Sink-specific | Staging sink only | Dashboard binding present · value not logged |

### 4.2 After infrastructure is decided → inject

| Key | Owner | Source | Destination | Req? | Format / constraint | Prod separation | Verify without showing value |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `TALK_VOICE_TURN_HOST` | Infra | DNS decision | `.env.staging` + coturn realm/host | Required | Staging FQDN · not Production host | Staging DNS zone | dig/nslookup hostname exists · no secret |
| `TALK_VOICE_TURN_REALM` | Infra | Usually = TURN host | `.env.staging` + coturn `realm=` | Required | Non-empty · Staging | Staging realm | Config grep realm string (not secret) |
| `TALK_VOICE_STAGING_HOSTNAME` | Voice | Staging preview / local | `.env.staging` | Required | Not Production Pages host | Reject `tasufull-article.pages.dev` | Validator hostname checks |
| `TALK_VOICE_TURN_TLS_CERT_PATH` | Infra | Host filesystem | `.env.staging` + coturn `cert=` | Required | Absolute path string | Staging host paths | `Test-Path` / `test -f` on path only |
| `TALK_VOICE_TURN_TLS_KEY_PATH` | Infra | Host filesystem | `.env.staging` + coturn `pkey=` | Required | Absolute path string · key file never copied to repo | Staging host only | Path exists · never `type`/`cat` key |
| `TALK_VOICE_TURN_EXTERNAL_IP` | Infra | Public IP | `.env.staging` optional + coturn | Optional | IPv4/IPv6 | Staging node | Compare to DNS A (no secret) |
| `TALK_VOICE_TURN_RELAY_IP` | Infra | Relay interface | `.env.staging` optional + coturn | Optional | IP | Staging node | Interface list (no secret) |
| Staging hostname / Preview URL | Cloudflare | Pages Preview | Evidence + `SITE_URL` optional | Required for remote E2E | HTTPS Staging Preview | ≠ Production | Browser open · HTTP 200 |

### 4.3 Settable from repository / known Staging constants

| Key | Owner | Source | Destination | Req? | Notes |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_PROJECT_REF` | Backend | `ahlxuyvhzqdqaojiywmu` | `.env.staging` | Required | Must match Staging |
| `SUPABASE_URL` / `TASFUL_SUPABASE_URL` | Backend | Staging URL | `.env.staging` | Required | `https://ahlxuyvhzqdqaojiywmu.supabase.co` |
| `BD_PRODUCTION_PROJECT_REF` | Guard | `ddojquacsyqesrjhcvmn` | `.env.staging` | Required | Guard constant only |
| `TALK_VOICE_STAGING_JWT_ISSUER` | Voice | Staging Auth | `.env.staging` | Required | `https://ahlxuyvhzqdqaojiywmu.supabase.co/auth/v1` |
| `TALK_VOICE_STAGING_JWT_AUDIENCE` | Voice | Auth | `.env.staging` | Required | `authenticated` |
| `TALK_VOICE_STAGING_ALLOWED_ORIGINS` | Voice | Local + Preview | `.env.staging` | Required | Must include `http://127.0.0.1:8788` |
| `TALK_VOICE_TURN_UDP_PORT` / `TCP_PORT` / `TLS_PORT` | Infra | Spec | `.env.staging` | Required | `3478` / `3478` / `443` |
| `TALK_VOICE_TURN_CREDENTIAL_API_URL` | Voice | Local or Staging API path | `.env.staging` | Required | Local template: `http://127.0.0.1:8788/api/talk-voice-turn-credentials` |
| `TALK_VOICE_SELF_HOSTED_TURN_ENABLED` | Voice | Feature flag | `.env.staging` + Pages vars | Required | Staging execution: set `true` only when ready |
| `TALK_VOICE_CONNECTION_TELEMETRY_ENABLED` | Voice | Feature flag | `.env.staging` + Pages vars | Required | Staging execution: set `true` when telemetry ready |
| `TALK_VOICE_TELEMETRY_SINK` | Voice | Spec | `.env.staging` | Required | `session_columns` \| `noop` (non-secret) |
| `TALK_VOICE_RATE_LIMIT_ENABLED` | Voice | Spec | `.env.staging` + Pages | Required | Must be `true` before credential exposure |
| `TALK_VOICE_RATE_LIMIT_FAIL_CLOSED` | Voice | Spec | `.env.staging` + Pages | Required | Must be `true` |
| `TALK_VOICE_RATE_LIMIT_NAMESPACE` | Voice | Spec | `.env.staging` + Pages | Required | Must be `staging` (never `production` in Staging env) |

---

## 5. Secret creation rules (do not generate here)

### 5.1 Rate Limit HMAC key (`TALK_VOICE_RATE_LIMIT_HASH_KEY`)

- Generate **≥32 bytes** of cryptographically secure random data (encode as hex or base64url as your secret store requires; resulting string length **≥32 characters**).
- Staging and Production **must** use different keys.
- Never store in the repository, `.env.staging.example`, chat, reports, CI logs, or shell history.
- Prefer Cloudflare secret manager / org secret store; inject into Pages/Worker secrets UI.
- **Rotation:** (1) create new Staging key in secret manager, (2) update Pages secret + local `.env.staging`, (3) redeploy/restart Functions so all isolates see the new key, (4) retire old key after TTL of in-flight sessions. Old and new keys do **not** dual-read — hashed DO names change → counters reset (expected brief “empty windows”; not a security fail-open).
- Switching keys mid-window does **not** unlock prior rate-limit state (hashes diverge). Brief allow-burst after rotation is expected; do not rotate during load tests without noting reset.

### 5.2 TURN shared secret (`TALK_VOICE_TURN_SHARED_SECRET`)

- Must match coturn `static-auth-secret` and credential API env **byte-for-byte**.
- Staging-only; never Production coturn secret.
- Never commit; never log; never paste into reports.
- **Rotation:** respect credential TTL (`TALK_VOICE_TURN_CREDENTIAL_TTL_SEC`, typically 300–1800). Change coturn and API in the same maintenance window; wait ≥ TTL before deleting the old secret from the manager.
- Preflight / validate-only check **presence and length class only** (redacted).

---

## 6. `.env.staging` merge procedure (do not wipe existing secrets)

**Goal:** add missing Phase 2 keys without destroying already-filled Supabase Staging secrets.

### 6.1 Preconditions

- [ ] `.env.staging` exists and is **gitignored**  
- [ ] Operator will **not** run `--force` unless a full controlled rewrite with `--fetch-keys` is explicitly approved  
- [ ] Values will **not** be passed on the command line  
- [ ] Shell history scrubbing / non-logging editor used for secrets  

### 6.2 Exact repository commands

```bash
# Git safety
git rev-parse HEAD
git branch --show-current
git check-ignore -v .env.staging
git status --short -- .env.staging
git ls-files --error-unmatch .env.staging
# Expect: check-ignore hit; ls-files error (untracked); status shows ?? or nothing tracked
```

```bash
# Help / matrix (no write)
node scripts/lib/create-env-staging.mjs --help
node scripts/lib/create-env-staging.mjs --dry-run
node scripts/lib/create-env-staging.mjs --dry-run --allow-placeholders
```

### 6.3 Safe merge (missing keys only)

PowerShell (Windows operator machine — **do not echo secret values**):

```powershell
# 1) Backup (local only · never commit)
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item .env.staging ".env.staging.bak-$ts"

# 2) Diff key names only (example vs current) — values not printed
$ex = Get-Content .env.staging.example | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=',2)[0] }
$cur = Get-Content .env.staging | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=',2)[0] }
Compare-Object $ex $cur | Format-Table

# 3) Append missing KEY= lines from example with EMPTY values only
#    (operator fills from secret manager / infra in a secure editor afterward)
foreach ($k in $ex) {
  if ($cur -notcontains $k) {
    Add-Content -Path .env.staging -Value "`n# merged from example $ts`n$k="
  }
}

# 4) Permission / ACL awareness (record that file is user-restricted)
icacls .env.staging

# 5) Confirm still untracked
git check-ignore -v .env.staging
git status --short -- .env.staging
```

Then fill blank required secrets **in an editor that does not sync to chat**, from the secret manager. Do **not**:

- `type .env.staging` / `Get-Content .env.staging` into shared logs  
- `echo $env:TALK_VOICE_TURN_SHARED_SECRET`  
- pass secrets as `KEY=value` CLI args  

### 6.4 Validate and preflight

```bash
node scripts/lib/create-env-staging.mjs --validate-only
node scripts/preflight-talk-voice-phase2-staging.mjs --env-file .env.staging
# optional local-only:
node scripts/preflight-talk-voice-phase2-staging.mjs --skip-http
```

**PASS:** validate-only exit 0 · preflight exit 0 · secrets redacted in output.  
**FAIL / STOP:** production markers · missing required · placeholder secrets · HMAC key &lt; 32 chars · `.env.staging` tracked by git.

---

## 7. Cloudflare Staging preparation

### 7.1 Identity checklist (fill 要人間入力 where unknown)

| Item | Value / confirmation |
| --- | --- |
| Cloudflare account | 要人間入力 (Staging) |
| Staging Pages project name | 要人間入力 |
| Production Pages project name | Confirm separately · **do not edit** |
| Wrangler login | `npx wrangler whoami` |
| Account ID | 要人間入力 (mask in evidence) |
| Worker name | `talk-voice-rate-limiter` (from wrangler.toml) |
| DO class | `TalkVoiceTurnRateLimiter` |
| Migration tag | `talk-voice-rl-v1` |
| Binding name | `TALK_VOICE_RATE_LIMITER` |
| Rate-limit namespace | `staging` |
| compatibility_date | `2026-07-02` |
| Environment name | Staging / Preview only |

**Canonical Worker files:**

```text
deploy/cloudflare/workers/talk-voice-rate-limiter.js
deploy/cloudflare/workers/talk-voice-rate-limiter.wrangler.toml
```

**Pages binding example (not applied by agents):**

```text
deploy/cloudflare/wrangler.pages.talk-voice-rate-limit.example.toml
```

### 7.2 Durable Object Worker — planned procedure

**Config validation / dry awareness (no deploy in this packet session):**

```bash
# Confirm files exist
# deploy/cloudflare/workers/talk-voice-rate-limiter.js
# deploy/cloudflare/workers/talk-voice-rate-limiter.wrangler.toml

npx wrangler whoami
# STOP if account is Production

# Optional: validate Worker config parses (human runs against Staging account)
# From deploy/cloudflare/workers:
#   npx wrangler deploy -c talk-voice-rate-limiter.wrangler.toml --dry-run
# If --dry-run unsupported in your Wrangler version:
#   Cloudflare Dashboardで人間が実施 — review Worker settings before deploy
```

**Secret registration (HMAC):** Cloudflare Dashboardで人間が実施 — Worker/Pages secrets UI · name `TALK_VOICE_RATE_LIMIT_HASH_KEY` · Staging only.

**Planned deploy command (execute only in Phase I after human approval):**

```bash
cd deploy/cloudflare/workers
npx wrangler deploy -c talk-voice-rate-limiter.wrangler.toml
```

| Expected | Detail |
| --- | --- |
| Output | Worker `talk-voice-rate-limiter` uploaded · DO class `TalkVoiceTurnRateLimiter` · migration `talk-voice-rl-v1` applied on **that** Worker |
| Post-check | Dashboard → Workers → Staging Worker present · DO namespace listed · binding name matches |
| DO migration | Tag `talk-voice-rl-v1` / `new_classes = ["TalkVoiceTurnRateLimiter"]` — first deploy creates class; do not invent a second tag without review |
| Rollback | Cloudflare Dashboardで人間が実施 — revert Worker version / disable Pages binding · set `TALK_VOICE_RATE_LIMIT_ENABLED` only after fail-closed path verified (do **not** fail-open) |
| STOP | Production account · wrong project · deploy without hash key · namespace `production` on Staging |

### 7.3 Pages binding — planned procedure

Binding: **`TALK_VOICE_RATE_LIMITER`** → class `TalkVoiceTurnRateLimiter` · `script_name = "talk-voice-rate-limiter"`.

| Step | Action |
| --- | --- |
| Scope | **Staging Pages project only** |
| How | Cloudflare Dashboardで人間が実施 (preferred) **or** copy from `wrangler.pages.talk-voice-rate-limit.example.toml` into Staging Pages wrangler — never Production |
| Vars | `TALK_VOICE_RATE_LIMIT_ENABLED=true` · `TALK_VOICE_RATE_LIMIT_FAIL_CLOSED=true` · `TALK_VOICE_RATE_LIMIT_NAMESPACE=staging` |
| Secret | `TALK_VOICE_RATE_LIMIT_HASH_KEY` (secret store) |
| Confirm Production untouched | Open Production project bindings UI · screenshot/record **no** new DO binding · **no** Staging namespace |
| Redeploy need | After binding/vars change, trigger Staging/Preview redeploy so Functions see binding — Cloudflare Dashboardで人間が実施 |
| Rollback | Remove Staging binding · redeploy · confirm credential API returns fail-closed `503` when enabled without binding (never silently issue credentials) |

---

## 8. Supabase remote migration inventory (no apply in packet session)

### 8.1 Rules

- Phase 2 talk-voice SQL lives under **`sql/`**, **not** `supabase/migrations/`.
- Therefore **`supabase db push` does not apply** `sql/talk-voice-phase1-session-usage.sql` or `sql/talk-voice-phase2-security-telemetry.sql`.
- Use `db push --dry-run` only to inventory **registered** migrations and detect unrelated pending work.
- Manual SQL apply requires **human approval** (Phase G → H).

### 8.2 Planned commands (do not run until Phase F)

```bash
# Confirm Staging ref (SSOT)
# Staging: ahlxuyvhzqdqaojiywmu
# Production (REJECT): ddojquacsyqesrjhcvmn

npx supabase link --project-ref ahlxuyvhzqdqaojiywmu
# STOP if link equals Production

npx supabase db push --dry-run
# Compare output to local supabase/migrations/ listing
# Classify unrelated pending (known concern):
#   20260705120000_builder_general_jobs_p3_withdraw_staging.sql
```

### 8.3 Classification worksheet

| Item | Disposition | Approver |
| --- | --- | --- |
| Unrelated pending migration(s) | apply / defer / exclude — 要人間入力 | Cross-team |
| Phase 2 SQL files | Manual apply after Gate G | Voice + DB owner |
| Backup / snapshot | Confirmed before Gate H | DB owner |
| Schema verification | SELECT-only post-apply queries from readiness report | Voice |

### 8.4 Apply path (Phase H — after approval)

- Prefer Supabase Dashboard SQL editor on **Staging** project, one file at a time.  
- Or Staging-linked single-file query tooling — Cloudflare/Supabase Dashboardで人間が実施.  
- **Do not** `--include-all` without written approval.  
- Prefer **forward-fix** when additive columns/triggers are already relied on by Staging clients; choose rollback SQL only if prepared **before** apply and no dependent rows exist.

### 8.5 STOP conditions (Supabase)

- Linked project ≠ Staging ref  
- Production ref detected  
- Migration drift unexplained  
- Unrelated pending migration undecided  
- Backup not confirmed  
- Attempt to treat `db push` as Phase 2 talk-voice apply  

---

## 9. coturn infrastructure checklist

| Item | Value |
| --- | --- |
| provider | 要人間入力 |
| region | 要人間入力 |
| OS | 要人間入力 |
| coturn version | 要人間入力 |
| container image digest | 要人間入力 (pin digest if using compose) |
| hostname | 要人間入力 |
| DNS A/AAAA | 要人間入力 |
| public IP | 要人間入力 |
| external IP | 要人間入力 |
| relay IP | 要人間入力 |
| UDP 3478 | 要人間入力 (open?) |
| TCP 3478 | 要人間入力 (open?) |
| TLS 443 | 要人間入力 (open? owner?) |
| relay port range | Example conf `49160–49260` — confirm live |
| firewall | 要人間入力 |
| security group | 要人間入力 |
| certificate | Path only — 要人間入力 |
| private key | Path only — never paste — 要人間入力 |
| certificate renewal | 要人間入力 |
| realm | 要人間入力 |
| static-auth-secret | Inject at runtime — never commit |
| logs | Redacted only |
| metrics | 要人間入力 |
| health check | 要人間入力 |
| restart | Planned maintenance only |
| rollback | Disable flag / previous compose digest — 要人間入力 |

**Repo examples (not live):**

```text
config/coturn/tasful-talk-turnserver.example.conf
config/coturn/docker-compose.staging.example.yml
```

Do **not** apply coturn until Phase K **and** TLS 443 gate (Phase L) is green.

---

## 10. TLS 443 exclusive gate (Phase L)

Independent gate — **do not proceed to coturn apply / TURN TLS E2E if any row fails.**

| Check | PASS | FAIL / STOP |
| --- | --- | --- |
| 443 port owner | Documented process owns 443 | Unknown / shared without SNI plan |
| Web server / proxy conflict | No unintended HTTP service steals TURN TLS | Conflict unresolved |
| L4 proxy present? | Documented | Undocumented middlebox |
| SNI routing | Works for TURN hostname | Broken SNI |
| ALPN dependency | Documented if any | Surprise ALPN drop |
| Certificate SAN | Matches TURN hostname | SAN mismatch |
| TLS protocol | TLS1.2+ (example conf disables TLS1.0/1.1) | Weak only |
| Cipher policy | Meets org policy | Weak ciphers only |
| IPv4 reachability | External probe OK | Closed |
| IPv6 reachability | Pass or explicitly N/A | Broken dual-stack surprise |
| Firewall | 443/tcp allowed from test clients | Blocked |
| External network test | From outside VPC | Only localhost |
| `turns:` URI | Matches credential API iceServers | Wrong host/port |
| TCP relay under TLS | Allocation succeeds | Fail |
| Browser selected candidate pair | `relay` + TLS evidence | No relay |

**Rule:** 443 conflict unresolved → **STOP** before coturn apply.

---

## 11. Execution phases (checkbox)

Legend: **H** = human approval required before leaving the phase.

### Phase A — Access and account verification

- [ ] **Owner:** Operator + Cloudflare admin  
- [ ] **Prereq:** Packet read; HEAD `400e0aa` known  
- [ ] **Do:** Confirm Cloudflare Staging account, Pages project, Supabase Staging ref, secret-manager access  
- [ ] **Commands:** `npx wrangler whoami`; Dashboard identity checks  
- [ ] **PASS:** Staging identities confirmed; Production projects identified and left untouched  
- [ ] **FAIL/STOP:** Production account/project selected  
- [ ] **Rollback:** N/A  
- [ ] **Evidence:** whoami account name (no tokens)  
- [ ] **Human approval (H):** Yes — sign before Phase B  

### Phase B — Secret preparation

- [ ] **Owner:** Security / Voice  
- [ ] **Prereq:** Phase A  
- [ ] **Do:** Create/store TURN shared secret + Rate Limit HMAC key in secret manager (Staging-only)  
- [ ] **Commands:** Secret manager UI — Cloudflare/org Dashboardで人間が実施 (no CLI secret print)  
- [ ] **PASS:** Both secrets exist · length ≥32 · Staging ≠ Production  
- [ ] **FAIL/STOP:** Placeholder · short key · shared with Production  
- [ ] **Rollback:** Revoke unused keys in manager  
- [ ] **Evidence:** secret **names** + created date (no values)  
- [ ] **Human approval (H):** Yes  

### Phase C — `.env.staging` merge

- [ ] **Owner:** Operator  
- [ ] **Prereq:** Phase B; backup taken  
- [ ] **Do:** §6 merge — missing keys only; fill from manager in secure editor  
- [ ] **Commands:** §6.2–6.3  
- [ ] **PASS:** Required keys present; file untracked  
- [ ] **FAIL/STOP:** Tracked by git · Production markers · wipe via careless `--force`  
- [ ] **Rollback:** Restore `.env.staging.bak-*`  
- [ ] **Evidence:** key-name diff only  
- [ ] **Human approval (H):** Yes if `--force` rewrite used  

### Phase D — validate-only

- [ ] **Owner:** Operator  
- [ ] **Prereq:** Phase C  
- [ ] **Commands:** `node scripts/lib/create-env-staging.mjs --validate-only`  
- [ ] **PASS:** exit 0  
- [ ] **FAIL/STOP:** exit ≠ 0  
- [ ] **Rollback:** Fix env; re-validate  
- [ ] **Evidence:** exit code + redacted summary  
- [ ] **Human approval:** No if PASS  

### Phase E — preflight

- [ ] **Owner:** Operator  
- [ ] **Prereq:** Phase D  
- [ ] **Commands:** `node scripts/preflight-talk-voice-phase2-staging.mjs --env-file .env.staging`  
- [ ] **PASS:** exit 0 · artifacts present · production abort guard PASS  
- [ ] **FAIL/STOP:** any FAIL line  
- [ ] **Rollback:** Fix env/artifacts  
- [ ] **Evidence:** PASS/FAIL counts  
- [ ] **Human approval:** No if PASS  

### Phase F — Supabase inventory

- [ ] **Owner:** DB owner  
- [ ] **Prereq:** Phase E  
- [ ] **Commands:** `npx supabase link --project-ref ahlxuyvhzqdqaojiywmu` then `npx supabase db push --dry-run`  
- [ ] **PASS:** Inventory captured; Staging link confirmed  
- [ ] **FAIL/STOP:** Production link · unexplained drift  
- [ ] **Rollback:** Unlink / relink Staging  
- [ ] **Evidence:** dry-run text (no secrets)  
- [ ] **Human approval (H):** Yes before Phase G  

### Phase G — Migration approval

- [ ] **Owner:** DB + Voice + Builder (if unrelated pending)  
- [ ] **Prereq:** Phase F  
- [ ] **Do:** Decide unrelated pending disposition; confirm Phase 2 SQL is manual `sql/` apply  
- [ ] **Commands:** Review only  
- [ ] **PASS:** Written disposition  
- [ ] **FAIL/STOP:** Undecided unrelated pending  
- [ ] **Rollback:** N/A  
- [ ] **Evidence:** Approval note  
- [ ] **Human approval (H):** **Mandatory**  

### Phase H — Phase 2 SQL apply

- [ ] **Owner:** DB owner  
- [ ] **Prereq:** Phase G + backup  
- [ ] **Do:** Apply `sql/talk-voice-phase1-session-usage.sql` then `sql/talk-voice-phase2-security-telemetry.sql` on Staging only  
- [ ] **Commands:** Dashboard SQL editor — 人間が実施 (not `db push` for these files)  
- [ ] **PASS:** Verification SELECTs OK  
- [ ] **FAIL/STOP:** Wrong project · apply error  
- [ ] **Rollback:** Prefer forward-fix if prepared reverse SQL absent; else run pre-written reverse  
- [ ] **Evidence:** column/trigger names only  
- [ ] **Human approval (H):** Yes immediately before apply  

### Phase I — Cloudflare DO deploy

- [ ] **Owner:** Cloudflare admin  
- [ ] **Prereq:** Phases A–B; Staging account verified  
- [ ] **Commands:** §7.2 deploy  
- [ ] **PASS:** Worker live · migration tag present  
- [ ] **FAIL/STOP:** Production account · deploy error  
- [ ] **Rollback:** Previous Worker version  
- [ ] **Evidence:** deploy timestamp · Worker name  
- [ ] **Human approval (H):** Yes  

### Phase J — Pages binding

- [ ] **Owner:** Cloudflare admin  
- [ ] **Prereq:** Phase I  
- [ ] **Do:** Bind `TALK_VOICE_RATE_LIMITER` + vars/secrets on **Staging Pages only** · redeploy Staging  
- [ ] **Commands:** Cloudflare Dashboardで人間が実施  
- [ ] **PASS:** Binding visible · Production unchanged  
- [ ] **FAIL/STOP:** Production edited · binding missing · fail-open  
- [ ] **Rollback:** Remove Staging binding · redeploy  
- [ ] **Evidence:** Binding screenshot (no secret values)  
- [ ] **Human approval (H):** Yes  

### Phase K — coturn infrastructure

- [ ] **Owner:** Infra  
- [ ] **Prereq:** Phase L PASS **or** run L checks first and stop if conflict  
- [ ] **Do:** Provision host/DNS/firewall/certs using §9 (apply example conf with runtime secrets)  
- [ ] **Commands:** Host tooling — 人間が実施; use `config/coturn/*example*` as template only  
- [ ] **PASS:** Process healthy · ports listening as designed  
- [ ] **FAIL/STOP:** Port conflict · DNS missing · secret in repo  
- [ ] **Rollback:** Prior compose digest / disable service  
- [ ] **Evidence:** hostname · port listen (no secrets)  
- [ ] **Human approval (H):** Yes  

### Phase L — TLS 443 verification

- [ ] **Owner:** Infra + Voice  
- [ ] **Prereq:** Cert issued · §10 checklist  
- [ ] **Do:** Complete §10 table  
- [ ] **PASS:** All §10 rows PASS or explicit N/A  
- [ ] **FAIL/STOP:** Any conflict / SAN mismatch  
- [ ] **Rollback:** Do not enable `turns:` in client  
- [ ] **Evidence:** External TLS probe status codes (no key material)  
- [ ] **Human approval (H):** Yes before TLS E2E  

### Phase M — credential API deploy

- [ ] **Owner:** Cloudflare / Release  
- [ ] **Prereq:** Phases I–J; env vars on Staging Pages  
- [ ] **Do:** Deploy Staging/Preview Pages build that includes TURN credential Function + rate-limit module  
- [ ] **Commands:** Org Staging deploy runbook — Cloudflare Dashboard / approved CI で人間が実施 (**not** Production promote)  
- [ ] **PASS:** Staging URL serves Function; unauthenticated → `401 auth_required`  
- [ ] **FAIL/STOP:** Production deploy · 200 with credentials unauthenticated  
- [ ] **Rollback:** Prior Staging deployment  
- [ ] **Evidence:** HTTP status + error code only  
- [ ] **Human approval (H):** Yes  

### Phase N — transport smoke test

- [ ] **Owner:** Infra + Voice  
- [ ] **Prereq:** Phase M + K + L  
- [ ] **Do:** UDP 3478 · TCP 3478 · TLS 443 allocation smoke (tooling chosen by infra; record protocol only)  
- [ ] **PASS:** Each transport allocates  
- [ ] **FAIL/STOP:** Any transport fail  
- [ ] **Rollback:** Disable feature flags  
- [ ] **Evidence:** protocol · success boolean · masked host  
- [ ] **Human approval:** Yes if first Staging expose  

### Phase O — browser E2E

- [ ] **Owner:** QA + Voice  
- [ ] **Prereq:** Phase N  
- [ ] **Do:** Execute matrix in `scripts/lib/talk-voice-phase2-e2e-matrix.mjs` — 4 routes × ≥2 BrowserContexts · real `getStats()` · no mock PASS  
- [ ] **Routes:** `direct_p2p` · `turn_udp` · `turn_tcp` · `turn_tls_443`  
- [ ] **Assertions:** `E2E_ASSERTION_KEYS` (candidate types, relay protocol, lifecycle, telemetry, hangup cleanup, audio)  
- [ ] **PASS:** All four routes + assertions  
- [ ] **FAIL/STOP:** Missing relay · mock-only · assertion miss  
- [ ] **Rollback:** Disable `TALK_VOICE_SELF_HOSTED_TURN_ENABLED`  
- [ ] **Evidence:** screenshots · redacted stats · browser name  
- [ ] **Human approval (H):** Yes for Staging go  

### Phase P — telemetry and rate-limit verification

- [ ] **Owner:** Voice  
- [ ] **Prereq:** Phase O (or parallel after M for HTTP checks)  
- [ ] **Do:** Confirm telemetry sink rows (no PII) · force `429` with `Retry-After` · confirm DO missing/`fail-closed` → `503` and **no** credential body  
- [ ] **PASS:** 429 + Retry-After · 503 without credentials · telemetry redacted  
- [ ] **FAIL/STOP:** 503 still issues credentials · 429 without Retry-After · secrets in logs  
- [ ] **Rollback:** Disable credential exposure flags  
- [ ] **Evidence:** status · reason code · retry-after integer  
- [ ] **Human approval (H):** Yes  

### Phase Q — Staging release verdict

- [ ] **Owner:** Voice lead  
- [ ] **Prereq:** Phases A–P complete or explicitly waived with written risk  
- [ ] **Do:** Fill §15 template  
- [ ] **PASS:** Staging execution PASS WITH NOTES or PASS  
- [ ] **FAIL/STOP:** Any open Critical STOP  
- [ ] **Rollback:** Keep flags off  
- [ ] **Evidence:** Completed template  
- [ ] **Human approval (H):** Yes  
- [ ] **Production release allowed:** **NO** (always for this packet)

---

## 12. Mandatory STOP conditions

Stop immediately if any of the following is true:

- Production Cloudflare account  
- Production Pages project edited  
- Production Supabase ref `ddojquacsyqesrjhcvmn` linked or targeted  
- Production origin / issuer / Pages host in Staging env  
- Secret missing or still placeholder  
- HMAC key shorter than 32 characters  
- Staging and Production share rate-limit **namespace**  
- Staging and Production share TURN or HMAC **secret**  
- `.env.staging` is git-tracked  
- Migration drift unexplained  
- Unrelated pending migration undecided  
- Backup not confirmed before SQL apply  
- coturn host unknown  
- DNS not reflected  
- Port conflict (especially 443)  
- Firewall unverified  
- TLS SAN mismatch  
- DO binding missing while rate-limit enabled  
- Rate-limit disabled for Staging credential exposure  
- Fail-open (`TALK_VOICE_RATE_LIMIT_FAIL_CLOSED` ≠ true)  
- `503` path still issues credentials  
- `429` lacks `Retry-After`  
- Relay candidate not confirmed when route expects relay  
- Secret appears in log / report / console  
- Browser E2E failure  

---

## 13. Verification command catalog

| Category | Command / action | Exists in repo? |
| --- | --- | --- |
| Git safety | `git rev-parse HEAD` · `git branch --show-current` · `git status --short` · `git check-ignore -v .env.staging` · `git ls-files --error-unmatch .env.staging` | Yes |
| Env validation | `node scripts/lib/create-env-staging.mjs --help` · `--dry-run` · `--validate-only` | Yes |
| Preflight | `node scripts/preflight-talk-voice-phase2-staging.mjs` · `--env-file .env.staging` · `--skip-http` | Yes |
| Rate-limit unit tests | `node scripts/test-talk-voice-distributed-rate-limit.mjs` | Yes |
| Credential unit tests | `node scripts/test-talk-voice-turn-credentials.mjs` | Yes |
| Staging prep tests | `node scripts/test-talk-voice-phase2-staging-prep.mjs` | Yes |
| Pre-run audit tests | `node scripts/test-talk-voice-phase2-pre-run-audit.mjs` | Yes |
| E2E matrix (plan module) | `scripts/lib/talk-voice-phase2-e2e-matrix.mjs` (import/describe; not a live runner) | Yes (plan-only) |
| Supabase inventory | `npx supabase link --project-ref ahlxuyvhzqdqaojiywmu` · `npx supabase db push --dry-run` | CLI (operator) |
| Cloudflare identity | `npx wrangler whoami` | CLI |
| Wrangler config / dry-run | `npx wrangler deploy -c talk-voice-rate-limiter.wrangler.toml --dry-run` if supported; else **Cloudflare Dashboardで人間が実施** | Partial |
| Worker deploy | `npx wrangler deploy -c talk-voice-rate-limiter.wrangler.toml` (Phase I only) | Documented in wrangler.toml comment |
| Pages binding verification | **Cloudflare Dashboardで人間が実施** | No repo automation |
| HTTP 401 | `curl`/`Invoke-WebRequest` POST Staging or `http://127.0.0.1:8788/api/talk-voice-turn-credentials` without auth → `auth_required` | Manual + prep test |
| HTTP 429 | Authenticated burst against Staging after limits lowered for test · expect `rate_limited` + `Retry-After` | Manual |
| HTTP 503 | Temporarily unbind DO or break hash key on Staging Preview · expect `service_unavailable` · **no** iceServers | Manual |
| TURN UDP/TCP/TLS | Infra smoke tools — **Cloudflare/host Dashboardで人間が実施** / host CLI | No single repo script for live coturn |
| Browser WebRTC stats | Manual Playwright/Chrome · matrix assertions | Plan in e2e-matrix; live run is human |
| Telemetry | Staging SELECT on allowlisted columns / sink — no raw PII | Manual SQL |
| Secret leak scan | Grep reports for `eyJ`, `sk_live_`, `whsec_`, PEM headers · `node scripts/test-talk-voice-phase2-pre-run-audit.mjs` | Yes (audit/prep tests) |

---

## 14. Evidence retention policy

### May store

- Command names  
- Exit codes  
- Timestamps  
- HTTP status  
- Reason / error codes (`auth_required`, `rate_limited`, `service_unavailable`)  
- `retry-after` integers  
- Masked hostnames  
- Candidate type (`host` / `srflx` / `relay`)  
- Relay protocol (`udp` / `tcp` / `tls`)  
- Browser name  
- Screenshots (no on-screen secrets)  
- Redacted logs  
- Report JSON without secrets  

### Must not store

- Secrets (TURN, HMAC, service_role, passwords)  
- JWT / access tokens  
- `Authorization` headers  
- TURN passwords / temporary credentials  
- Private keys / certificate bodies  
- Raw user IDs  
- Raw client IPs  
- Full Durable Object storage key material  

---

## 15. Final verdict template (fill at end of Staging window)

```text
Final verdict:
Execution date:
Operator:
Cloudflare account verified:
Pages project verified:
Supabase ref verified:
Secrets configured:
Env validation:
Preflight:
Migration inventory:
Phase 2 SQL:
DO deploy:
Pages binding:
coturn:
UDP:
TCP:
TLS 443:
Rate limit 429:
Fail-closed 503:
Browser E2E:
Secret leak scan:
Remaining blockers:
Production release allowed: NO
```

---

## 16. Packet session confirmation (this document only)

| Item | Status |
| --- | --- |
| Document created | `reports/talk-voice-phase2-human-staging-provisioning.md` |
| push | Not executed |
| deploy / wrangler deploy | Not executed |
| Pages binding | Not changed |
| migration / Phase 2 SQL | Not executed |
| coturn | Unchanged |
| `.env.staging` | Unchanged by this session |
| secrets | Not generated · not displayed |
| stage / commit | Not executed |
| Production release allowed | **NO** |

### Exact next action for humans

1. Complete **Phase A** (account verification).  
2. Create Staging-only TURN shared secret + Rate Limit HMAC key in the secret manager (**Phase B**).  
3. Merge missing keys into `.env.staging` per §6 (**Phase C**) → validate-only → preflight.  
4. Do **not** deploy DO / bind Pages / apply SQL / touch coturn until Gates F–H and I–L approvals are recorded.

### Commands intentionally not executed while authoring this packet

`git push` · `wrangler deploy` · Pages binding mutations · secret manager writes · secret generation · `.env.staging` edits · `supabase link` · `supabase db push` (including dry-run) · Phase 2 SQL apply · coturn apply/restart · DNS/firewall/certificate changes · Browser E2E · Production operations · `git add` / `git commit`.
