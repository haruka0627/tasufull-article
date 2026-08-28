create schema if not exists tlv;

create table tlv.creators (id bigint primary key generated always as identity);
create table tlv.streams (id bigint primary key generated always as identity);
create table tlv.payments (id bigint primary key generated always as identity);
create table tlv.tips (id bigint primary key generated always as identity);
create table tlv.revenue_ledger (id bigint primary key generated always as identity);
create table tlv.gauge_state (id bigint primary key generated always as identity);
create table tlv.stream_events (id bigint primary key generated always as identity);
create table tlv.creator_score_events (id bigint primary key generated always as identity);
create table tlv.payout_log (id bigint primary key generated always as identity);
create table tlv.viewer_wallets (id bigint primary key generated always as identity);
create table tlv.coin_lots (id bigint primary key generated always as identity);
create table tlv.payment_provider_events (id bigint primary key generated always as identity);
create table tlv.tip_coin_lot_allocations (id bigint primary key generated always as identity);
create table tlv.wallet_ledger (id bigint primary key generated always as identity);
create table tlv.payment_reversals (id bigint primary key generated always as identity);

create table public.live_broadcasts (
  id bigint primary key generated always as identity,
  tip_count integer not null default 0
);
create table public.live_tips (
  id bigint primary key generated always as identity,
  broadcast_id bigint references public.live_broadcasts(id)
);
create table public.live_ad_impression_events (id bigint primary key generated always as identity);
create table public.live_video_view_events (id bigint primary key generated always as identity);
create table public.live_videos (id bigint primary key generated always as identity);
create table public.live_creator_monetization (id bigint primary key generated always as identity);
create table public.live_ad_rpm_settings (id bigint primary key generated always as identity);
create table public.live_monetization_audit_logs (id bigint primary key generated always as identity);
create table public.live_creator_profiles (id bigint primary key generated always as identity);
create table public.live_risk_flags (id bigint primary key generated always as identity);
create table public.gate04_unlocked_probe (id bigint primary key generated always as identity);

create or replace function public.gate04_live_tip_trigger()
returns trigger language plpgsql as $$
begin
  update public.live_broadcasts set tip_count = tip_count + 1 where id = new.broadcast_id;
  return new;
end
$$;

create trigger gate04_live_tip_trigger
after insert on public.live_tips
for each row execute function public.gate04_live_tip_trigger();

create or replace function tlv.gate04_synthetic_tip_rpc()
returns void language plpgsql security definer set search_path = tlv, public as $$
begin
  insert into tlv.tips default values;
  insert into tlv.revenue_ledger default values;
end
$$;

insert into tlv.tips default values;
insert into public.live_broadcasts default values;
