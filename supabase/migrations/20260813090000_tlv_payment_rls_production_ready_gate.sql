-- TLV Payment RLS — production-ready gate (idempotent hardening)
-- Companion to: 20260628150000_tlv_payment_rls.sql
--
-- PRODUCTION APPLY IS HUMAN GATE — do not auto-apply.
-- Staging may apply via approved migration workflow; Production requires
-- explicit human approval after TODO-06 + RLS PASS evidence.
-- Do not invent new tables; financial tables only (same set as original).

-- ---------------------------------------------------------------------------
-- Ops admin helper (includes app_metadata.is_ops)
-- ---------------------------------------------------------------------------
create or replace function tlv.is_tlv_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.talk_is_admin()
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_ops')::boolean, false);
$$;

-- ---------------------------------------------------------------------------
-- ENABLE + FORCE RLS on financial / event tables
-- ---------------------------------------------------------------------------
alter table tlv.viewer_wallets enable row level security;
alter table tlv.viewer_wallets force row level security;

alter table tlv.wallet_ledger enable row level security;
alter table tlv.wallet_ledger force row level security;

alter table tlv.coin_lots enable row level security;
alter table tlv.coin_lots force row level security;

alter table tlv.payments enable row level security;
alter table tlv.payments force row level security;

alter table tlv.tips enable row level security;
alter table tlv.tips force row level security;

alter table tlv.tip_coin_lot_allocations enable row level security;
alter table tlv.tip_coin_lot_allocations force row level security;

alter table tlv.revenue_ledger enable row level security;
alter table tlv.revenue_ledger force row level security;

alter table tlv.payment_provider_events enable row level security;
alter table tlv.payment_provider_events force row level security;

alter table tlv.stream_events enable row level security;
alter table tlv.stream_events force row level security;

alter table tlv.creator_score_events enable row level security;
alter table tlv.creator_score_events force row level security;

-- ---------------------------------------------------------------------------
-- Re-assert owner / payer / admin SELECT policies (no authenticated writes)
-- ---------------------------------------------------------------------------
drop policy if exists vw_owner_select on tlv.viewer_wallets;
drop policy if exists vw_admin_select on tlv.viewer_wallets;
create policy vw_owner_select on tlv.viewer_wallets
  for select to authenticated
  using (user_id = auth.uid());
create policy vw_admin_select on tlv.viewer_wallets
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists wl_owner_select on tlv.wallet_ledger;
drop policy if exists wl_admin_select on tlv.wallet_ledger;
create policy wl_owner_select on tlv.wallet_ledger
  for select to authenticated
  using (user_id = auth.uid());
create policy wl_admin_select on tlv.wallet_ledger
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists cl_owner_select on tlv.coin_lots;
drop policy if exists cl_admin_select on tlv.coin_lots;
create policy cl_owner_select on tlv.coin_lots
  for select to authenticated
  using (user_id = auth.uid());
create policy cl_admin_select on tlv.coin_lots
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists pay_payer_select on tlv.payments;
drop policy if exists pay_admin_select on tlv.payments;
create policy pay_payer_select on tlv.payments
  for select to authenticated
  using (payer_user_uuid = auth.uid());
create policy pay_admin_select on tlv.payments
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists tips_payer_select on tlv.tips;
drop policy if exists tips_creator_select on tlv.tips;
drop policy if exists tips_admin_select on tlv.tips;
create policy tips_payer_select on tlv.tips
  for select to authenticated
  using (payer_user_uuid = auth.uid());
create policy tips_creator_select on tlv.tips
  for select to authenticated
  using (tlv.is_creator_of(creator_id));
create policy tips_admin_select on tlv.tips
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists tcla_payer_select on tlv.tip_coin_lot_allocations;
drop policy if exists tcla_admin_select on tlv.tip_coin_lot_allocations;
create policy tcla_payer_select on tlv.tip_coin_lot_allocations
  for select to authenticated
  using (
    exists (
      select 1
      from tlv.tips t
      where t.id = tip_id
        and t.payer_user_uuid = auth.uid()
    )
  );
create policy tcla_admin_select on tlv.tip_coin_lot_allocations
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists rl_admin_select on tlv.revenue_ledger;
create policy rl_admin_select on tlv.revenue_ledger
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists ppe_admin_select on tlv.payment_provider_events;
create policy ppe_admin_select on tlv.payment_provider_events
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists se_live_select on tlv.stream_events;
drop policy if exists se_creator_select on tlv.stream_events;
drop policy if exists se_admin_select on tlv.stream_events;
create policy se_live_select on tlv.stream_events
  for select to authenticated
  using (
    exists (
      select 1
      from tlv.streams s
      where s.id = stream_id
        and s.status = 'live'
    )
  );
create policy se_creator_select on tlv.stream_events
  for select to authenticated
  using (
    exists (
      select 1
      from tlv.streams s
      where s.id = stream_id
        and tlv.is_creator_of(s.creator_id)
    )
  );
create policy se_admin_select on tlv.stream_events
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

drop policy if exists cse_admin_select on tlv.creator_score_events;
create policy cse_admin_select on tlv.creator_score_events
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- Table privileges — deny-by-default + SELECT for authenticated
-- ---------------------------------------------------------------------------
revoke all on table tlv.viewer_wallets from anon, authenticated;
revoke all on table tlv.wallet_ledger from anon, authenticated;
revoke all on table tlv.coin_lots from anon, authenticated;
revoke all on table tlv.payments from anon, authenticated;
revoke all on table tlv.tips from anon, authenticated;
revoke all on table tlv.tip_coin_lot_allocations from anon, authenticated;
revoke all on table tlv.revenue_ledger from anon, authenticated;
revoke all on table tlv.payment_provider_events from anon, authenticated;
revoke all on table tlv.stream_events from anon, authenticated;
revoke all on table tlv.creator_score_events from anon, authenticated;

grant select on table tlv.viewer_wallets to authenticated;
grant select on table tlv.wallet_ledger to authenticated;
grant select on table tlv.coin_lots to authenticated;
grant select on table tlv.payments to authenticated;
grant select on table tlv.tips to authenticated;
grant select on table tlv.tip_coin_lot_allocations to authenticated;
grant select on table tlv.revenue_ledger to authenticated;
grant select on table tlv.payment_provider_events to authenticated;
grant select on table tlv.stream_events to authenticated;
grant select on table tlv.creator_score_events to authenticated;

grant all on table tlv.viewer_wallets to service_role;
grant all on table tlv.wallet_ledger to service_role;
grant all on table tlv.coin_lots to service_role;
grant all on table tlv.payments to service_role;
grant all on table tlv.tips to service_role;
grant all on table tlv.tip_coin_lot_allocations to service_role;
grant all on table tlv.revenue_ledger to service_role;
grant all on table tlv.payment_provider_events to service_role;
grant all on table tlv.stream_events to service_role;
grant all on table tlv.creator_score_events to service_role;

-- ---------------------------------------------------------------------------
-- Payment mutation RPCs — service_role only (same signatures as original)
-- ---------------------------------------------------------------------------
revoke execute on function tlv.create_tip_transaction(
  uuid, uuid, uuid, text, tlv.tip_kind, integer,
  text, jsonb, uuid, uuid, text, text,
  boolean, boolean, boolean
) from public, anon, authenticated;

revoke execute on function tlv.handle_payment_webhook_success(
  tlv.payment_provider, text, text, text, text, uuid, uuid,
  tlv.payment_channel, bigint, bigint, bigint, numeric, integer, boolean,
  text, text, jsonb, uuid
) from public, anon, authenticated;

revoke execute on function tlv.record_payment_provider_event_terminal(
  tlv.payment_provider, text, text, text, tlv.provider_event_status, text
) from public, anon, authenticated;

grant execute on function tlv.create_tip_transaction(
  uuid, uuid, uuid, text, tlv.tip_kind, integer,
  text, jsonb, uuid, uuid, text, text,
  boolean, boolean, boolean
) to service_role;

grant execute on function tlv.handle_payment_webhook_success(
  tlv.payment_provider, text, text, text, text, uuid, uuid,
  tlv.payment_channel, bigint, bigint, bigint, numeric, integer, boolean,
  text, text, jsonb, uuid
) to service_role;

grant execute on function tlv.record_payment_provider_event_terminal(
  tlv.payment_provider, text, text, text, tlv.provider_event_status, text
) to service_role;

grant execute on function tlv.is_tlv_ops_admin() to authenticated;
grant execute on function tlv.is_tlv_ops_admin() to service_role;
