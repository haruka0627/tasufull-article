-- TLV Payment Engine — Row Level Security (TODO-07)
-- Design: reports/tlv-payment-rls-design.md
-- Staging apply only; production manual gate after TODO-06 + RLS PASS.

-- ---------------------------------------------------------------------------
-- Prerequisite: talk_is_admin (existing TALK RLS pattern — idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.talk_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('tasu_admin', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'tasu_admin', '') = 'true';
$$;

-- ---------------------------------------------------------------------------
-- RLS helper functions (tlv schema)
-- ---------------------------------------------------------------------------
create or replace function tlv.jwt_talk_user_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
    auth.jwt() ->> 'talk_user_id',
    auth.jwt() ->> 'sub'
  );
$$;

create or replace function tlv.is_creator_of(p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = tlv
as $$
  select exists (
    select 1
    from tlv.creators c
    where c.id = p_creator_id
      and c.user_id = tlv.jwt_talk_user_id()
  );
$$;

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

-- Performance: stream_events live SELECT
create index if not exists streams_live_id_idx
  on tlv.streams (id)
  where status = 'live';

-- ---------------------------------------------------------------------------
-- viewer_wallets
-- ---------------------------------------------------------------------------
alter table tlv.viewer_wallets enable row level security;
alter table tlv.viewer_wallets force row level security;

drop policy if exists vw_owner_select on tlv.viewer_wallets;
drop policy if exists vw_admin_select on tlv.viewer_wallets;

create policy vw_owner_select on tlv.viewer_wallets
  for select to authenticated
  using (user_id = auth.uid());

create policy vw_admin_select on tlv.viewer_wallets
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- wallet_ledger
-- ---------------------------------------------------------------------------
alter table tlv.wallet_ledger enable row level security;
alter table tlv.wallet_ledger force row level security;

drop policy if exists wl_owner_select on tlv.wallet_ledger;
drop policy if exists wl_admin_select on tlv.wallet_ledger;

create policy wl_owner_select on tlv.wallet_ledger
  for select to authenticated
  using (user_id = auth.uid());

create policy wl_admin_select on tlv.wallet_ledger
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- coin_lots
-- ---------------------------------------------------------------------------
alter table tlv.coin_lots enable row level security;
alter table tlv.coin_lots force row level security;

drop policy if exists cl_owner_select on tlv.coin_lots;
drop policy if exists cl_admin_select on tlv.coin_lots;

create policy cl_owner_select on tlv.coin_lots
  for select to authenticated
  using (user_id = auth.uid());

create policy cl_admin_select on tlv.coin_lots
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
alter table tlv.payments enable row level security;
alter table tlv.payments force row level security;

drop policy if exists pay_payer_select on tlv.payments;
drop policy if exists pay_admin_select on tlv.payments;

create policy pay_payer_select on tlv.payments
  for select to authenticated
  using (payer_user_uuid = auth.uid());

create policy pay_admin_select on tlv.payments
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- tips
-- ---------------------------------------------------------------------------
alter table tlv.tips enable row level security;
alter table tlv.tips force row level security;

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

-- ---------------------------------------------------------------------------
-- tip_coin_lot_allocations
-- ---------------------------------------------------------------------------
alter table tlv.tip_coin_lot_allocations enable row level security;
alter table tlv.tip_coin_lot_allocations force row level security;

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

-- ---------------------------------------------------------------------------
-- revenue_ledger — admin / service_role only (Creator direct SELECT deny)
-- ---------------------------------------------------------------------------
alter table tlv.revenue_ledger enable row level security;
alter table tlv.revenue_ledger force row level security;

drop policy if exists rl_admin_select on tlv.revenue_ledger;

create policy rl_admin_select on tlv.revenue_ledger
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- payment_provider_events
-- ---------------------------------------------------------------------------
alter table tlv.payment_provider_events enable row level security;
alter table tlv.payment_provider_events force row level security;

drop policy if exists ppe_admin_select on tlv.payment_provider_events;

create policy ppe_admin_select on tlv.payment_provider_events
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- stream_events
-- ---------------------------------------------------------------------------
alter table tlv.stream_events enable row level security;
alter table tlv.stream_events force row level security;

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

-- ---------------------------------------------------------------------------
-- creator_score_events — plan B: admin only (no Creator direct SELECT)
-- ---------------------------------------------------------------------------
alter table tlv.creator_score_events enable row level security;
alter table tlv.creator_score_events force row level security;

drop policy if exists cse_admin_select on tlv.creator_score_events;

create policy cse_admin_select on tlv.creator_score_events
  for select to authenticated
  using (tlv.is_tlv_ops_admin());

-- ---------------------------------------------------------------------------
-- Table privileges — deny-by-default + RLS
-- ---------------------------------------------------------------------------
revoke all on all tables in schema tlv from anon, authenticated;

grant usage on schema tlv to authenticated;
grant select on all tables in schema tlv to authenticated;

grant usage on schema tlv to service_role;
grant all on all tables in schema tlv to service_role;

-- anon: no tlv schema usage (PostgREST path blocked)
revoke usage on schema tlv from anon;

-- ---------------------------------------------------------------------------
-- Function privileges — payment RPC service_role only
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema tlv from public, anon, authenticated;

grant execute on function tlv.jwt_talk_user_id() to authenticated;
grant execute on function tlv.is_creator_of(uuid) to authenticated;
grant execute on function tlv.is_tlv_ops_admin() to authenticated;

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

grant execute on function tlv.compute_gauge_pct(integer, numeric, integer, integer)
  to service_role;

grant execute on all functions in schema tlv to service_role;
