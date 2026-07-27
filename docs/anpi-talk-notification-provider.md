# ANPI Talk Notification Provider — Design & Ops

**Environment scope:** staging / local design verification only  
**Production write enablement:** human gate (this doc does not authorize it)

## Adopted path (locked)

```text
ANPI scheduler job (Phase 6 claim/process)
  → Phase 8/10 notification contract (ids only · no HTML/URL/PII)
  → Phase 10 talk_notifications writer
       type = anpi
       target_url = '#'
       source = anpi_phase10 (production marker when enabled)
  → existing TALK inbox / official_anpi card presentation
```

**Do not** add SMS, phone, email, or a new chat room as the core path.

| Concern | Decision |
|---------|----------|
| Provider | Reuse existing `public.talk_notifications` (+ TALK UI) |
| New paid providers | Forbidden for core path |
| Dedicated ANPI chat | Forbidden — use `official_anpi` |
| `target_url` | Always `#` (`fixed_hash_no_url`) |
| Periodic staging runtime today | `talk_local*` via Cloudflare Cron (Phase 56/57) |
| Real inbox write today | **HARD-DISABLED** on Phase 10 job writer (`anpi_talk_real_write_disabled`) |
| Staging controlled INSERT proof | **Phase 59 PASS** via existing Phase 17 gate (manual probe only · Cron unchanged) |
| Staging Cron → real write cutover | **Phase 60 NOT READY (NO-GO)** — see [`docs/anpi-phase60-scheduled-real-write-cutover.md`](./anpi-phase60-scheduled-real-write-cutover.md) |
| Staging scoped job-writer (manual) | **Phase 61 PASS** — see [`docs/anpi-phase61-scoped-job-writer.md`](./anpi-phase61-scoped-job-writer.md) · Cron still `talk_local*` |
| Staging claim allowlist SQL | **Phase 62 APPLIED** · gate **OFF** — soak complete |
| Staging scoped Cron soak | **Phase 62 SOAK PASS** · [`docs/anpi-phase62-scoped-cron-soak.md`](./anpi-phase62-scoped-cron-soak.md) |
| Staging wall-clock Cron soak | **Phase 63 WALL_CLOCK_SOAK PASS** · [`docs/anpi-phase63-wall-clock-scoped-cron-soak.md`](./anpi-phase63-wall-clock-scoped-cron-soak.md) |
| Production cutover plan | **Phase 64 PLAN READY · CUTOVER NO-GO** · [`docs/anpi-phase64-production-cutover-plan.md`](./anpi-phase64-production-cutover-plan.md) |
| Production blocker resolution | **Phase 65 PARTIAL · CUTOVER still NO-GO** · [`docs/anpi-phase65-production-readiness-blockers.md`](./anpi-phase65-production-readiness-blockers.md) |
| Production canary | **Phase 66 HOLD · CANARY NO-GO** · [`docs/anpi-phase66-production-canary.md`](./anpi-phase66-production-canary.md) |
| Production migration hold | **ON HOLD (Free plan · backup gate)** · [`docs/anpi-production-migration-hold.md`](./anpi-production-migration-hold.md) |

## Roles of `talk_local*`

| Provider | Role |
|----------|------|
| `talk_local_stub` / `talk_local_adapter` | Staging/local delivery stub · ledger / receipts · **no** user inbox write |
| Phase 48 provider validation | Rejects any non-`talk_local*` provider on periodic staging ticks |
| `talk_write` / Phase 10 path | Canonical Production design path · gated until human enablement |

## Notify kinds → templates

| Kind | Template | Title (catalog) |
|------|----------|-----------------|
| `initial` | `anpi.initial` | 安否確認のお願い |
| `reminder` | `anpi.reminder` | 安否確認リマインド |
| `contact_unconfirmed` | `anpi.contact_unconfirmed` | 安否未確認のお知らせ |
| `late_confirmation` | `anpi.late_confirmation` | 安否確認の完了（遅延） |

Payloads are contract JSON (schema `anpi.talk.contract.v1`): template key, id parameters, actions, idempotency key. No free-form URL/phone/email/HTML.

## Safety / security boundary

| Boundary | Rule |
|----------|------|
| RLS | Authenticated users read own `talk_notifications` only; writers are service_role RPCs |
| `anpi_talk_notification_create_internal` | `service_role` only · real path disabled unless explicit local-test / future flag |
| Identity | `anpi_resolve_talk_user_id` · fail-closed if unresolved |
| Idempotency | Stable notification id from idempotency key + `anpi_talk_notification_links` ledger |
| Dedup | `ON CONFLICT DO NOTHING` on notification id |
| Cancel / confirm race | `anpi_phase6_job_deliverable` before write |
| Production project | Probe/scripts refuse `ddojquacsyqesrjhcvmn` |
| External SMS/phone/email | Not on core path |

## Client presentation

Existing TALK stack:

- `talk-official-notify-card.js` — room `official_anpi`
- `talk-platform-notify.js` / masters — category 安否 → `official_anpi`
- `talk-notify-actions.js` — `type === "anpi"` fallback

No new dedicated ANPI chat.

## Verification commands

```bash
npm run test:anpi-talk-provider
npm run verify:anpi-talk-provider   # staging health + real-mode disable probe
npm run test:anpi-controlled-write
npm run verify:anpi-controlled-write  # staging controlled INSERT (Phase 59)
npm run test:anpi-cron-cutover
npm run verify:anpi-cron-cutover      # Phase 60 cutover readiness (expect NOT READY)
npm run test:anpi-scoped-writer
npm run verify:anpi-scoped-writer     # Phase 61 scoped job-writer (manual)
```

See also: [`docs/anpi-phase59-staging-controlled-write.md`](./anpi-phase59-staging-controlled-write.md) · [`docs/anpi-phase60-scheduled-real-write-cutover.md`](./anpi-phase60-scheduled-real-write-cutover.md) · [`docs/anpi-phase61-scoped-job-writer.md`](./anpi-phase61-scoped-job-writer.md) · [`docs/anpi-phase64-production-cutover-plan.md`](./anpi-phase64-production-cutover-plan.md).

## Production human steps (when authorized)

Follow **Phase 64** runbook only ([`docs/anpi-phase64-production-cutover-plan.md`](./anpi-phase64-production-cutover-plan.md)):

1. Confirm Production migrations / RLS / parallel allowlisted claim package applied (separate checklist).
2. **Runtime pause first** (legacy + scoped both stopped) · confirm in-flight = 0.
3. Deploy Production Worker / secrets / cron (never reuse Staging secrets).
4. Canary allowlist (sha8 only · not Staging `{0411f04d}`) · gate enable · limited resume · wall-clock observe.
5. Do **not** use `ANPI_NOTIFICATION_PROVIDER=talk_write` as the cutover switch.
6. Do **not** register SMS/phone/email paid providers for core ANPI notify.

Until Phase 64 Go checklist passes and a human records explicit approval: **Production real notification = NO-GO**.
