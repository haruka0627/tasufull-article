# TLV Gate 04 Writer Inventory

Date: 2026-08-29 JST

Status: `COMPLETE_REPOSITORY_EVIDENCE`

Scope: Repository/SSOT audit only. Production and Shared Staging were not accessed.

## Active financial writers

| Identifier | Trigger/source | Runtime path | Direct mutation targets | Classification | Freeze entry target |
| --- | --- | --- | --- | --- | --- |
| `TLV_TIP_RPC` | authenticated viewer gift/extension | `live/live-tips.js` -> `supabase/functions/tlv-create-tip` -> `_shared/tlv-create-tip.ts` -> `tlv.create_tip_transaction` | `coin_lots`, `tips`, `tip_coin_lot_allocations`, `viewer_wallets`, `wallet_ledger`, `revenue_ledger`, `creator_score_events`, `gauge_state`, `streams`, `stream_events` | PRODUCTION_CAPABLE_DB_WRITER | required core lock set |
| `TLV_PAYMENT_WEBHOOK_SUCCESS` | Stripe `payment_intent.succeeded` | `tlv-payment-webhook` -> `handle_payment_webhook_success` | `payment_provider_events`, `payments`, `viewer_wallets`, `coin_lots`, `wallet_ledger` | PRODUCTION_CAPABLE_DB_WRITER | required core lock set |
| `TLV_PAYMENT_WEBHOOK_TERMINAL` | failed/canceled/unsupported Stripe event | webhook fallback helper | `payment_provider_events` | PRODUCTION_CAPABLE_DB_WRITER | `tlv.payment_provider_events` |
| `TLV_PAYMENT_REFUND` | Stripe refund event | webhook -> `handle_payment_refund` | provider events, revenue ledger corrections, wallet/lots/ledger, payments, creators, score events, payout log, reversals | PRODUCTION_CAPABLE_DB_WRITER | required core lock set |
| `TLV_PAYMENT_DISPUTE` | Stripe dispute event | webhook -> `handle_payment_dispute` | same financial family as refund/chargeback | PRODUCTION_CAPABLE_DB_WRITER | required core lock set |
| `TLV_COIN_PURCHASE_INITIATION` | authenticated viewer | `tlv-create-coin-purchase` -> Stripe PaymentIntent | no immediate DB DML; causes later webhook writer | EXTERNAL_INITIATOR_WITH_DB_FOLLOWUP | webhook targets; no provider mutation in Gate 04 |
| `LEGACY_PUBLIC_LIVE_TIP` | authenticated direct PostgREST insert remains granted by legacy migration | `public.live_tips` insert and trigger | `public.live_tips`, `public.live_broadcasts` | LEGACY_COMPATIBILITY_WRITER | both public tables |

## Revenue attribution and monetization-input writers

These do not currently create canonical `tlv.revenue_ledger` money rows, but they can change attribution/eligibility inputs during a logical checkpoint. Gate 04 freezes their discovered tables conservatively.

| Identifier | Runtime path | Mutation targets | Classification |
| --- | --- | --- | --- |
| `TLV_AD_ATTRIBUTION` | `supabase/functions/live-security-events` `record_ad_impression` / `record_view_event` | `public.live_ad_impression_events`, `public.live_video_view_events`, related `public.live_videos` counters/status | ACTIVE_ATTRIBUTION_WRITER |
| `TLV_MONETIZATION_ADMIN` | `supabase/functions/live-monetization-admin` | `public.live_creator_monetization`, `public.live_ad_rpm_settings`, `public.live_monetization_audit_logs`, `public.live_videos`, `public.live_creator_profiles` | ACTIVE_CONFIG_WRITER |
| `TLV_SECURITY_MONETIZATION_SUSPEND` | `live-security-events` admin action | `public.live_creator_monetization`, `public.live_videos`, `public.live_risk_flags` | ACTIVE_CONFIG_WRITER |

Current deployment/activity was not re-read in this Production-disconnected task. `PRODUCTION_CAPABLE_DB_WRITER` means the Repository and earlier Production Evidence establish a deployable/historically deployed write path, not that a fresh Production invocation was observed.

## Full control detail by writer

### `TLV_TIP_RPC`

- ENTRY_POINT: `live/live-tips.js` calls `TasuLiveConfig.createGiftTip` in `live/live-config.js`.
- CALL_CHAIN: browser -> `functions/v1/tlv-create-tip` -> verified-user handler -> service-role client -> `tlv.create_tip_transaction` SECURITY DEFINER RPC -> transaction-scoped DML.
- AUTH / ROLE: browser Supabase JWT; `requireVerifiedUser`; server derives wallet UUID and uses service role; RPC execution is restricted to service role by the production-ready RLS migration.
- CREDENTIAL CONTRACT: browser receives no service credential; Edge obtains the existing Supabase service-role secret from server environment. No value is read or recorded by Gate 04.
- RPC / DIRECT SQL: `tlv.create_tip_transaction`; no browser direct TLV table DML in the current gift path.
- DB TRIGGER: ordinary table updated-at/immutability triggers apply; stream/gauge event side effects are explicit inside the RPC, not separate client transactions.
- AFFECTED TABLES: `coin_lots`, `tips`, `tip_coin_lot_allocations`, `viewer_wallets`, `wallet_ledger`, `revenue_ledger`, `creator_score_events`, `gauge_state`, `streams`, `stream_events`.
- STORAGE SIDE EFFECT: none.
- IDEMPOTENCY / DEDUPE: partial unique index on `tips.idempotency_key`; duplicate RPC returns the existing tip without a second debit.
- RETRY BEHAVIOR: client may retry using the same idempotency key; a lock timeout/failure must not be retried with a new key.
- EXISTING STOP CONTROL: no app-side circuit breaker is wired. Transactional SHARE locks cover every explicit mutation target.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE`; the RPC is one PostgreSQL transaction. Blocking any mutation does not expose partial committed side effects; all targets are locked to prevent ordering assumptions.
- UNFREEZE METHOD: normal `ROLLBACK`; emergency recorded-backend termination/session loss.
- FAILURE MODE: request blocks or returns an error/timeout; transaction rolls back; retry may resume after unfreeze.
- HUMAN REQUIRED CONTROL: none for the DB writer beyond the bound Operator/Reviewer/window.
- EVIDENCE: runtime and migration paths in the Evidence map below; isolated DML/transaction lock proof.

### `TLV_PAYMENT_WEBHOOK_SUCCESS`, `TLV_PAYMENT_REFUND`, and `TLV_PAYMENT_DISPUTE`

- ENTRY_POINT: Stripe-signed POST to `supabase/functions/tlv-payment-webhook/index.ts`.
- CALL_CHAIN: signature verification -> service-role client -> success/refund/dispute SECURITY DEFINER RPC -> transactional ledger/wallet/provider-event mutations.
- AUTH / ROLE: no browser JWT; authenticity is Stripe webhook signature. Edge holds Stripe webhook secret, Stripe secret key, and Supabase service-role credential. RPCs run as their SECURITY DEFINER owner and are granted to service role.
- CREDENTIAL CONTRACT: all secrets remain Edge/server-side; Gate 04 neither retrieves nor records them.
- RPC / DIRECT SQL: `handle_payment_webhook_success`, `handle_payment_refund`, `handle_payment_dispute`; terminal-event helper may directly insert/update `payment_provider_events` if its RPC is unavailable.
- DB TRIGGER: updated-at/immutability/context triggers may run on affected rows. All trigger writes occur within the originating PostgreSQL statement/transaction.
- AFFECTED TABLES: provider events, payments, wallets, lots, wallet ledger, revenue ledger adjustments, creators, creator score events, payout log, payment reversals.
- STORAGE SIDE EFFECT: none in Supabase Storage; Stripe retains the provider event externally.
- IDEMPOTENCY / DEDUPE: unique provider + provider event ID; payment reversal provider-event unique index; RPC status transitions make replay duplicate-safe.
- RETRY BEHAVIOR: non-2xx/timeout causes Stripe retries. Events blocked during freeze are expected to retry or complete after unfreeze; unknown provider outcome is not reissued manually.
- EXISTING STOP CONTROL: no TLV-wired app circuit breaker. Required core locks cover both RPC and direct fallback writes.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE` for DB commits. Each RPC is atomic; the fallback writes first touch the locked provider-event table.
- UNFREEZE METHOD: normal `ROLLBACK`; emergency recorded-backend termination/session loss.
- FAILURE MODE: webhook blocks/times out, then provider retry/idempotency handles replay. A fingerprint gap or ungranted lock invalidates the checkpoint.
- HUMAN REQUIRED CONTROL: none for DB writer freeze; Reviewer must review queued/error status read-only after unfreeze.
- EVIDENCE: webhook/shared runtime, payment/refund/dispute migrations, provider-event unique constraints.

### `TLV_PAYMENT_WEBHOOK_TERMINAL`

- ENTRY_POINT: failed/canceled/unsupported Stripe webhook event.
- CALL_CHAIN: signed webhook -> `recordTerminalProviderEvent` RPC -> on RPC error, service-role PostgREST select then insert/update.
- AUTH / ROLE: Stripe signature and Edge service role.
- CREDENTIAL CONTRACT: same server-only contract as other webhook paths.
- RPC / DIRECT SQL: `record_payment_provider_event_terminal`; direct `payment_provider_events` fallback.
- DB TRIGGER: provider-event context/updated metadata triggers if deployed; same statement transaction.
- AFFECTED TABLES: `tlv.payment_provider_events`.
- STORAGE SIDE EFFECT: none; provider retains source event.
- IDEMPOTENCY / DEDUPE: provider/event unique identity; existing processed event returns duplicate success.
- RETRY BEHAVIOR: provider retry on failure; dedupe on replay.
- EXISTING STOP CONTROL / FREEZE EFFECTIVENESS: `tlv.payment_provider_events` SHARE lock covers both RPC and fallback; `REVERSIBLY_FREEZABLE`.
- UNFREEZE METHOD: transaction rollback or recorded backend termination/session loss.
- FAILURE MODE: fallback also blocks; no unlocked escape path remains.
- HUMAN REQUIRED CONTROL: none beyond Gate 04 role/window binding.
- EVIDENCE: `_shared/tlv-payment-webhook.ts` direct fallback and schema unique constraint.

### `TLV_COIN_PURCHASE_INITIATION`

- ENTRY_POINT: authenticated direct invocation of `tlv-create-coin-purchase`; current `live/` UI has no purchase call site, but earlier Evidence records the Edge function as deployed/active.
- CALL_CHAIN: caller -> verified-user Edge -> service-role read of `tlv.fee_config` -> Stripe `paymentIntents.create` -> later signed webhook -> TLV DB writer.
- AUTH / ROLE: Supabase verified-user JWT; Edge owns Stripe secret and service role.
- CREDENTIAL CONTRACT: browser never receives server secrets; PaymentIntent client secret is returned as the provider client contract.
- RPC / DIRECT SQL: no immediate DB mutation; fee config is read-only. The later webhook uses the RPCs above.
- DB TRIGGER: none during initiation.
- AFFECTED TABLES: none synchronously; later webhook targets are locked.
- STORAGE SIDE EFFECT: creates a Stripe PaymentIntent outside PostgreSQL.
- IDEMPOTENCY / DEDUPE: caller-supplied key is mandatory and passed to Stripe.
- RETRY BEHAVIOR: same key returns/reuses the provider operation; webhook may arrive during or after freeze.
- EXISTING STOP CONTROL: no current UI entry, but no authoritative deployed kill switch blocks direct authenticated function invocation. The generic circuit breaker is not wired.
- FREEZE EFFECTIVENESS: `DB_FOLLOWUP_FREEZABLE_EXTERNAL_INITIATION_NOT_FREEZABLE`. The database checkpoint remains transactionally coherent, but Gate 04 cannot truthfully claim all end-to-end financial initiation stopped.
- UNFREEZE METHOD: database follow-up uses the lock rollback. There is no selected reversible Production control for Stripe initiation.
- FAILURE MODE: a PaymentIntent may be created during the checkpoint and its webhook may queue behind locks; it will not be represented in the DB snapshot until after unfreeze.
- HUMAN REQUIRED CONTROL: bind an already-approved, already-deployed operational control that denies this Edge invocation during the window, or provide authoritative Evidence that the function is not invocable in Production. Creating/deploying a new kill switch is prohibited.
- EVIDENCE: `tlv-create-coin-purchase/index.ts`; `docs/architecture/payment-engine-architecture.md`; historical Production release/preflight reports; current Live UI grep.

### `LEGACY_PUBLIC_LIVE_TIP`

- ENTRY_POINT: any legacy authenticated PostgREST client with the retained INSERT grant/RLS policy.
- CALL_CHAIN: authenticated client -> PostgREST INSERT `public.live_tips` -> `live_tips_refresh_broadcast_total` trigger -> update `public.live_broadcasts`.
- AUTH / ROLE: authenticated role; admin policy also exists. No service-role secret is required for the client path.
- CREDENTIAL CONTRACT: browser anon key + user JWT only.
- RPC / DIRECT SQL: direct INSERT.
- DB TRIGGER: after-insert broadcast-total refresh.
- AFFECTED TABLES: `public.live_tips`, `public.live_broadcasts`.
- STORAGE SIDE EFFECT: none.
- IDEMPOTENCY / DEDUPE: unique `idempotency_key` constraint.
- RETRY BEHAVIOR: duplicate key fails/dedupes; no canonical retry wrapper found.
- EXISTING STOP CONTROL: both relations are locked.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE`; trigger is in the same transaction, so no partial committed broadcast total is possible.
- UNFREEZE METHOD: rollback/session termination.
- FAILURE MODE: insert blocks/times out and transaction aborts.
- HUMAN REQUIRED CONTROL: none beyond Gate 04 role/window binding.
- EVIDENCE: live P0 schema grants/RLS and count trigger migration.

### `TLV_AD_ATTRIBUTION`

- ENTRY_POINT: `live/live-watch-video.js` -> `TasuLiveConfig.recordAdImpressionEvent`; view events use the same Edge family.
- CALL_CHAIN: browser -> `live-security-events` public action -> service-role PostgREST insert/update.
- AUTH / ROLE: optional verified viewer for impression/view; server service role performs DB writes.
- CREDENTIAL CONTRACT: browser user/anon context only; service credential remains Edge-side.
- RPC / DIRECT SQL: direct PostgREST DML.
- DB TRIGGER: any table-local updated/count trigger; no separate financial RPC.
- AFFECTED TABLES: `live_ad_impression_events`, `live_video_view_events`, `live_videos` where present.
- STORAGE SIDE EFFECT: none.
- IDEMPOTENCY / DEDUPE: code performs existing-event/device/window checks before insert; it is attribution dedupe, not payment idempotency.
- RETRY BEHAVIOR: caller handles errors; duplicate event logic may suppress recount.
- EXISTING STOP CONTROL: discovered relations are locked; their absence is recorded rather than fabricated.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE_WHEN_RELATIONS_PRESENT`; first DML is locked and multi-step changes are not committed before the locked statement.
- UNFREEZE METHOD: rollback/session termination.
- FAILURE MODE: ingestion blocks/times out; attribution event may be omitted and must not be regenerated by Gate 04.
- HUMAN REQUIRED CONTROL: if the Production preflight finds a deployed attribution writer whose target is outside the discovered set, stop and extend the inventory before connection proceeds.
- EVIDENCE: `live-config.js`, `live-watch-video.js`, `live-security-events/index.ts`.

### `TLV_MONETIZATION_ADMIN` and `TLV_SECURITY_MONETIZATION_SUSPEND`

- ENTRY_POINT: admin UI/service -> `live-monetization-admin`, or verified admin action in `live-security-events`.
- CALL_CHAIN: admin JWT -> `requireVerifiedAdmin` -> service-role PostgREST update/insert -> audit write.
- AUTH / ROLE: verified admin JWT; service-role DB access.
- CREDENTIAL CONTRACT: admin JWT in browser; service credential only in Edge.
- RPC / DIRECT SQL: direct PostgREST DML.
- DB TRIGGER: table updated-at triggers where defined.
- AFFECTED TABLES: monetization, RPM, audit, videos, creator profiles, and risk flags.
- STORAGE SIDE EFFECT: none.
- IDEMPOTENCY / DEDUPE: state-transition validation exists; audit insert is not globally idempotent.
- RETRY BEHAVIOR: a retry can repeat an audit/action unless the state transition rejects it.
- EXISTING STOP CONTROL: all discovered target relations are locked when present.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE_WHEN_RELATIONS_PRESENT`; the first state mutation is locked, preventing later audit mutation. Read-only list/detail operations continue.
- UNFREEZE METHOD: rollback/session termination.
- FAILURE MODE: admin mutation fails/times out; no Production canary mutation is permitted.
- HUMAN REQUIRED CONTROL: any newly discovered deployed target outside the set is fail-closed.
- EVIDENCE: `live-monetization-service.js`, monetization/security Edge functions.

### `MANUAL_SERVICE_ROLE_SQL`

- ENTRY_POINT / CALL_CHAIN: authorized operator SQL, Dashboard SQL, or service-role RPC outside browser routes.
- AUTH / ROLE / CREDENTIAL CONTRACT: privileged Production operator/service role delivered only through the approved server-side route; values never enter Evidence.
- RPC / DIRECT SQL / DB TRIGGER / AFFECTED TABLES: potentially any TLV relation; Gate 04 ticket explicitly prohibits financial DML and the required table locks are the database backstop for inventoried relations.
- STORAGE SIDE EFFECT: unknown for arbitrary operator actions; such actions are outside Gate 04 and prohibited.
- IDEMPOTENCY / RETRY: operation-specific; no blanket assumption.
- EXISTING STOP CONTROL: procedural change-ticket deny plus relation locks.
- FREEZE EFFECTIVENESS: `REVERSIBLY_FREEZABLE_FOR_INVENTORIED_RELATIONS`; superuser lock bypass is not assumed. A conflicting privileged action waits like other DML.
- UNFREEZE METHOD: rollback/session termination.
- FAILURE MODE: an out-of-scope privileged operation against an unlisted object is a control violation and invalidates the checkpoint.
- HUMAN REQUIRED CONTROL: authorized identity binding and confirmation that no concurrent financial change ticket overlaps the window.
- EVIDENCE: RLS/service-role grants and Gate 04 runbook.

## Privileged and inactive paths

| Identifier | Evidence | Classification | Gate 04 handling |
| --- | --- | --- | --- |
| `MANUAL_SERVICE_ROLE_SQL` | service-role owns RPC/table privileges | PRIVILEGED_POSSIBLE_WRITER | change-ticket prohibition plus database locks; no manual DML allowed |
| `SECURITY_CIRCUIT_BREAKER_FINANCIAL` | `20260813093000_security_circuit_breaker_v1.sql` and `_shared/security-circuit-breaker.ts` define `financial_mutations` | NOT_WIRED_TO_TLV_PAYMENT_PATH | not selected; relying on it would leave TLV writers active and may require undeployed migration/config |
| `MONTHLY_SETTLEMENT_V1` | `20260827210000_tlv_deterministic_monthly_settlement_v1.sql` | CANDIDATE_NOT_PRODUCTION | must remain absent; no invocation |
| `OPTION_A_PAYOUT_V1` | `20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql` | CANDIDATE_NOT_PRODUCTION | must remain absent; no invocation |
| `SYNTHETIC_DISPOSITION_V1` | `20260828210000_tlv_synthetic_qa_disposition_v1.sql` | CANDIDATE_NOT_PRODUCTION | must remain absent; no invocation |

## Required core lock set

The freeze candidate fails if any of these relations is absent:

`tlv.creators`, `tlv.streams`, `tlv.payments`, `tlv.tips`, `tlv.revenue_ledger`, `tlv.gauge_state`, `tlv.stream_events`, `tlv.creator_score_events`, `tlv.payout_log`, `tlv.viewer_wallets`, `tlv.coin_lots`, `tlv.payment_provider_events`, `tlv.tip_coin_lot_allocations`, `tlv.wallet_ledger`, `tlv.payment_reversals`, `public.live_tips`, `public.live_broadcasts`.

The following auxiliary tables are locked when present and their discovered/locked set is recorded: `public.live_ad_impression_events`, `public.live_video_view_events`, `public.live_videos`, `public.live_creator_monetization`, `public.live_ad_rpm_settings`, `public.live_monetization_audit_logs`, `public.live_creator_profiles`, `public.live_risk_flags`.

## Evidence map

- Canonical money path and supersession: `docs/TLV_PAYMENT_ENGINE.md`
- TLV schema: `db/tlv_schema.sql`, `supabase/migrations/20260627190000_tlv_schema.sql`
- Purchase/webhook writers: `supabase/functions/tlv-create-coin-purchase/index.ts`, `supabase/functions/tlv-payment-webhook/index.ts`, `supabase/functions/_shared/tlv-payment-webhook.ts`
- Tip writer: `supabase/functions/tlv-create-tip/index.ts`, `supabase/functions/_shared/tlv-create-tip.ts`, `supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql`
- Payment/refund/dispute RPCs: `supabase/migrations/20260628130000_tlv_payer_user_uuid.sql`, `supabase/migrations/20260628160000_tlv_payment_chargeback_clawback.sql`
- Legacy tip grants/trigger: `supabase/migrations/20260628100000_live_p0_schema.sql`, `supabase/migrations/20260629100000_live_p0_counts.sql`
- Ads/monetization: `supabase/functions/live-security-events/index.ts`, `supabase/functions/live-monetization-admin/index.ts`
- Circuit breaker not wired: no import/use of `_shared/security-circuit-breaker.ts` in TLV tip, purchase, or webhook functions.

WRITER_INVENTORY_STATUS: COMPLETE

SECOND_FINANCIAL_SSOT_CREATED: NO
