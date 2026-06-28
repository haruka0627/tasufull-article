-- TLV Platform — DB Schema v1.2.4 (Payer UUID alignment · Wallet/Ledger)
-- 正本: docs/TLV_PRD.md §5 · docs/TLV_DB_SCHEMA.md
-- 責務: payments + revenue_ledger = 金の正本
--        creator_score_monthly = Rank / 還元の正本
--        stream_events = UX / ゲージ / 演出ログ（金額正本ではない）
--
-- Apply: Supabase SQL Editor or psql after review
-- Prerequisite: gen_random_uuid() · pgcrypto (Supabase default)

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create schema if not exists tlv;

comment on schema tlv is
  'TLV v2 Platform Vision — Score OS · survival live · Profit First (AD-014)';

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

create type tlv.rank_tier as enum (
  'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'
);

create type tlv.override_tier as enum (
  'none', 'tier_90', 'tier_95'
);

create type tlv.score_axis as enum (
  'FS', 'ES', 'GS', 'TS'
);

create type tlv.payment_channel as enum (
  'web_stripe', 'ios_iap', 'android_iap', 'adsense'
);

create type tlv.payment_kind as enum (
  'coin_purchase', 'subscription_viewer', 'subscription_creator',
  'membership', 'ppv', 'ad_settlement'
);

create type tlv.payment_status as enum (
  'pending', 'succeeded', 'failed', 'refunded', 'disputed'
);

create type tlv.tip_kind as enum (
  'gift', 'extension', 'cheer', 'membership_tip'
);

create type tlv.stream_status as enum (
  'scheduled', 'live', 'ended', 'cancelled'
);

create type tlv.stream_phase as enum (
  'free_30', 'extension_30', 'overgauge', 'rostime', 'grace', 'ended'
);

create type tlv.gauge_phase as enum (
  'accumulating', 'threshold_met', 'rostime', 'grace', 'extended', 'ended'
);

create type tlv.revenue_event_kind as enum (
  'gift', 'extension', 'membership', 'ppv', 'ad_share', 'infra_allocation', 'adjustment'
);

create type tlv.payout_status as enum (
  'pending', 'hold', 'approved', 'processing', 'paid', 'failed', 'cancelled'
);

create type tlv.rank_change_reason as enum (
  'monthly_eval', 'score_ma30_promotion', 'maintain_demotion',
  'legend_ppr_selection', 'legend_ppr_replacement', 'ops_override',
  'trust_instant_demotion', 'channel_created'
);

create type tlv.stream_event_kind as enum (
  'viewer_join', 'viewer_leave', 'chat_message', 'cheer_display',
  'gauge_tick', 'extension_coin', 'extension_unlock', 'overgauge_start',
  'overgauge_end', 'rostime_start', 'rostime_tick', 'grace_start',
  'stream_end', 'raid_offer', 'raid_execute', 'bitrate_change', 'afk_warning'
);

-- ---------------------------------------------------------------------------
-- Trigger helper
-- ---------------------------------------------------------------------------

create or replace function tlv.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- fee_config — 決済手数料 · 価格係数（正本 · 月次 FinOps 更新可）
-- ---------------------------------------------------------------------------

create table if not exists tlv.fee_config (
  id                  uuid primary key default gen_random_uuid(),
  channel             tlv.payment_channel not null,
  fee_rate            numeric(6, 5) not null,
  price_multiplier    numeric(8, 5) not null default 1.0,
  coin_unit_jpy       integer not null default 100,
  effective_from      date not null,
  effective_to        date,
  version_label       text not null default 'v1',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fee_config_fee_rate_chk
    check (fee_rate >= 0 and fee_rate < 1),
  constraint fee_config_price_multiplier_chk
    check (price_multiplier > 0),
  constraint fee_config_effective_range_chk
    check (effective_to is null or effective_to > effective_from),
  constraint fee_config_channel_effective_uniq
    unique (channel, effective_from)
);

comment on table tlv.fee_config is
  '決済チャネル手数料率 · App 価格係数 — PRICING.md §1.2';

create index if not exists fee_config_channel_active_idx
  on tlv.fee_config (channel, effective_from desc)
  where effective_to is null;

create trigger fee_config_updated_at
  before update on tlv.fee_config
  for each row execute function tlv.set_updated_at();

-- Seed defaults (PRICING.md · FINANCIAL_MODEL.md)
insert into tlv.fee_config (channel, fee_rate, price_multiplier, effective_from, version_label, notes)
values
  ('web_stripe',  0.03600, 1.00000, '2026-01-01', 'v1', 'Stripe JPY 3.6%'),
  ('ios_iap',     0.30000, 1.42860, '2026-01-01', 'v1', 'IAP 30% · Net parity'),
  ('android_iap', 0.30000, 1.42860, '2026-01-01', 'v1', 'IAP 30% · Net parity'),
  ('adsense',     0.00000, 1.00000, '2026-01-01', 'v1', 'Gross = Net')
on conflict (channel, effective_from) do nothing;

-- ---------------------------------------------------------------------------
-- creators — Creator マスタ · ライブ Score キャッシュ
-- ---------------------------------------------------------------------------

create table if not exists tlv.creators (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 text not null,
  display_name            text,
  channel_slug            text,
  rank_tier               tlv.rank_tier not null default 'bronze',
  -- Live score cache (FS/ES realtime · GS from last daily · TS event-driven)
  fs_live                 smallint not null default 0,
  es_live                 smallint not null default 0,
  gs_daily                smallint not null default 0,
  ts_live                 smallint not null default 100,
  total_live              smallint not null default 100,
  score_ma30              numeric(6, 2) not null default 0,
  base_payout_rate        numeric(5, 4) not null default 0.5000,
  override_tier_preview   tlv.override_tier not null default 'none',
  effective_rate_preview  numeric(5, 4),
  payout_hold             boolean not null default false,
  payout_hold_reason      text,
  payout_hold_until       timestamptz,
  legend_since_month      char(7),
  legend_waitlist_position integer,
  extension_month_count   smallint not null default 0,
  extension_month_reset   char(7),
  kyc_verified            boolean not null default false,
  instant_demotion_flag   boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint creators_user_id_uniq unique (user_id),
  constraint creators_fs_live_chk check (fs_live between 0 and 400),
  constraint creators_es_live_chk check (es_live between 0 and 300),
  constraint creators_gs_daily_chk check (gs_daily between 0 and 200),
  constraint creators_ts_live_chk check (ts_live between 0 and 100),
  constraint creators_total_live_chk check (total_live between 0 and 1000),
  constraint creators_total_live_sum_chk
    check (total_live = fs_live + es_live + gs_daily + ts_live),
  constraint creators_score_ma30_chk check (score_ma30 between 0 and 1000),
  constraint creators_base_rate_chk check (base_payout_rate between 0 and 1),
  constraint creators_effective_rate_preview_chk
    check (effective_rate_preview is null or effective_rate_preview between 0 and 0.95),
  constraint creators_extension_month_count_chk check (extension_month_count >= 0),
  constraint creators_legend_waitlist_position_chk
    check (legend_waitlist_position is null or legend_waitlist_position > 0)
);

comment on table tlv.creators is
  'TLV Creator · live score cache · rank_tier は monthly 確定後に同期';
comment on column tlv.creators.total_live is
  'FS+ES+GS_daily+TS — UI リアルタイム表示用';
comment on column tlv.creators.score_ma30 is
  '30日移動平均 — Rank/還元 preview · 正本は creator_score_monthly';

create index if not exists creators_rank_tier_idx on tlv.creators (rank_tier);
create index if not exists creators_score_ma30_idx on tlv.creators (score_ma30 desc);
create index if not exists creators_payout_hold_idx on tlv.creators (payout_hold) where payout_hold = true;

create trigger creators_updated_at
  before update on tlv.creators
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- streams — ライブセッション
-- ---------------------------------------------------------------------------

create table if not exists tlv.streams (
  id                          uuid primary key default gen_random_uuid(),
  creator_id                  uuid not null references tlv.creators (id) on delete restrict,
  title                       text not null,
  status                      tlv.stream_status not null default 'scheduled',
  phase                       tlv.stream_phase not null default 'free_30',
  scheduled_at                timestamptz,
  started_at                  timestamptz,
  ended_at                    timestamptz,
  free_phase_ends_at          timestamptz,
  extension_blocks_completed  smallint not null default 0,
  effective_ccu_peak          integer not null default 0,
  effective_ccu_current       integer not null default 0,
  playback_url                text,
  ingest_url                  text,
  stream_key_hash             text,
  bitrate_kbps                integer not null default 640,
  resolution                  text not null default '720p',
  infra_cost_jpy              bigint not null default 0,
  platform_profit_jpy         bigint not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint streams_title_len_chk check (char_length(title) between 1 and 120),
  constraint streams_extension_blocks_chk check (extension_blocks_completed >= 0),
  constraint streams_effective_ccu_chk check (effective_ccu_peak >= 0 and effective_ccu_current >= 0),
  constraint streams_infra_cost_chk check (infra_cost_jpy >= 0)
);

comment on table tlv.streams is
  'ライブ配信セッション — 集計キャッシュ · 金額正本は revenue_ledger';

create index if not exists streams_creator_started_idx
  on tlv.streams (creator_id, started_at desc);
create index if not exists streams_status_live_idx
  on tlv.streams (status, started_at desc)
  where status = 'live';

create trigger streams_updated_at
  before update on tlv.streams
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments — 金の正本（Gross / Fee / Net 分離）
-- ---------------------------------------------------------------------------

create table if not exists tlv.payments (
  id                    uuid primary key default gen_random_uuid(),
  payer_user_id         text not null,
  payer_user_uuid       uuid,
  creator_id            uuid references tlv.creators (id) on delete set null,
  stream_id             uuid references tlv.streams (id) on delete set null,
  payment_kind          tlv.payment_kind not null,
  channel               tlv.payment_channel not null,
  status                tlv.payment_status not null default 'pending',
  gross_amount_jpy      bigint not null,
  fee_amount_jpy        bigint not null default 0,
  refund_amount_jpy     bigint not null default 0,
  chargeback_amount_jpy bigint not null default 0,
  net_amount_jpy        bigint not null,
  fee_rate_applied      numeric(6, 5) not null,
  coins_granted         integer not null default 0,
  is_web_payment        boolean not null,
  external_ref          text,
  stripe_payment_intent text,
  stripe_charge_id      text,
  metadata_json         jsonb not null default '{}'::jsonb,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payments_gross_chk check (gross_amount_jpy >= 0),
  constraint payments_fee_chk check (fee_amount_jpy >= 0),
  constraint payments_refund_chk check (refund_amount_jpy >= 0),
  constraint payments_chargeback_chk check (chargeback_amount_jpy >= 0),
  constraint payments_net_chk check (net_amount_jpy >= 0),
  constraint payments_net_formula_chk
    check (net_amount_jpy = gross_amount_jpy - fee_amount_jpy - refund_amount_jpy - chargeback_amount_jpy),
  constraint payments_coins_chk check (coins_granted >= 0),
  constraint payments_fee_rate_chk check (fee_rate_applied >= 0 and fee_rate_applied < 1)
);

comment on table tlv.payments is
  '決済正本 — Gross/Fee/Net 分離 · Score FS PPC 入力源';
comment on column tlv.payments.payer_user_id is
  '互換用 text ID（talk_user_id 等）— wallet JOIN には使わない';
comment on column tlv.payments.payer_user_uuid is
  'Viewer 正本 UUID — viewer_wallets.user_id と JOIN · Payment Engine 必須書込';

create index if not exists payments_creator_paid_idx
  on tlv.payments (creator_id, paid_at desc)
  where status = 'succeeded';
create index if not exists payments_payer_idx on tlv.payments (payer_user_id, created_at desc);
create index if not exists payments_payer_uuid_idx on tlv.payments (payer_user_uuid, created_at desc)
  where payer_user_uuid is not null;
create index if not exists payments_stripe_pi_idx on tlv.payments (stripe_payment_intent)
  where stripe_payment_intent is not null;

create trigger payments_updated_at
  before update on tlv.payments
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- tips — 投げ銭 · 延長コイン（不正 · 自己投げフラグ）
-- ---------------------------------------------------------------------------

create table if not exists tlv.tips (
  id                    uuid primary key default gen_random_uuid(),
  stream_id             uuid not null references tlv.streams (id) on delete restrict,
  creator_id            uuid not null references tlv.creators (id) on delete restrict,
  payer_user_id         text not null,
  payer_user_uuid       uuid,
  payment_id            uuid references tlv.payments (id) on delete set null,
  tip_kind              tlv.tip_kind not null,
  coins_amount          integer not null,
  gross_amount_jpy      bigint not null default 0,
  net_amount_jpy        bigint not null default 0,
  message               text,
  tier_label            text,
  self_gift_flag        boolean not null default false,
  self_gift_confirmed   boolean not null default false,
  bot_suspect_flag      boolean not null default false,
  fraud_excluded        boolean not null default false,
  device_id             text,
  ip_hash               text,
  created_at            timestamptz not null default now(),
  constraint tips_coins_chk check (coins_amount > 0 and coins_amount <= 10000),
  constraint tips_gross_chk check (gross_amount_jpy >= 0),
  constraint tips_net_chk check (net_amount_jpy >= 0),
  constraint tips_message_len_chk check (message is null or char_length(message) <= 200),
  constraint tips_fraud_excluded_logic_chk
    check (not fraud_excluded or self_gift_confirmed or bot_suspect_flag)
);

comment on table tlv.tips is
  'ギフト/延長/cheer — 自己投げ・BOT フラグ · PPC 除外は fraud_excluded=true';
comment on column tlv.tips.fraud_excluded is
  'true = revenue_ledger / PPC / Override 判定から除外';
comment on column tlv.tips.payer_user_id is
  '互換用 text ID — wallet JOIN には使わない';
comment on column tlv.tips.payer_user_uuid is
  'Viewer 正本 UUID — viewer_wallets.user_id と JOIN · Payment Engine 必須書込';

create index if not exists tips_stream_created_idx
  on tlv.tips (stream_id, created_at desc);
create index if not exists tips_creator_created_idx
  on tlv.tips (creator_id, created_at desc);
create index if not exists tips_payer_uuid_idx
  on tlv.tips (payer_user_uuid, created_at desc)
  where payer_user_uuid is not null;
create index if not exists tips_fraud_review_idx
  on tlv.tips (creator_id, created_at desc)
  where self_gift_flag = true or bot_suspect_flag = true;
create index if not exists tips_extension_idx
  on tlv.tips (stream_id, created_at desc)
  where tip_kind = 'extension';

-- ---------------------------------------------------------------------------
-- revenue_ledger — stream 単位 PL 正本
-- ---------------------------------------------------------------------------

create table if not exists tlv.revenue_ledger (
  id                    uuid primary key default gen_random_uuid(),
  stream_id             uuid references tlv.streams (id) on delete set null,
  creator_id            uuid not null references tlv.creators (id) on delete restrict,
  payment_id            uuid references tlv.payments (id) on delete set null,
  tip_id                uuid references tlv.tips (id) on delete set null,
  event_kind            tlv.revenue_event_kind not null,
  ledger_month          char(7) not null,
  gross_amount_jpy      bigint not null default 0,
  fee_amount_jpy        bigint not null default 0,
  net_amount_jpy        bigint not null default 0,
  infra_cost_jpy        bigint not null default 0,
  creator_payout_jpy    bigint not null default 0,
  platform_revenue_jpy  bigint not null default 0,
  base_rate             numeric(5, 4),
  effective_rate        numeric(5, 4),
  self_gift_excluded    boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  constraint revenue_ledger_month_format_chk check (ledger_month ~ '^\d{4}-\d{2}$'),
  constraint revenue_ledger_amounts_nonneg_chk
    check (
      gross_amount_jpy >= 0 and fee_amount_jpy >= 0 and net_amount_jpy >= 0
      and infra_cost_jpy >= 0 and creator_payout_jpy >= 0
    ),
  constraint revenue_ledger_net_formula_chk
    check (net_amount_jpy = gross_amount_jpy - fee_amount_jpy),
  constraint revenue_ledger_platform_formula_chk
    check (platform_revenue_jpy = net_amount_jpy - infra_cost_jpy - creator_payout_jpy),
  constraint revenue_ledger_rate_chk
    check (
      (base_rate is null or base_rate between 0 and 1)
      and (effective_rate is null or effective_rate between 0 and 0.95)
    )
);

comment on table tlv.revenue_ledger is
  '金額 PL 正本 — stream/creator 単位 Gross/Net/payout/platform/infra';

create index if not exists revenue_ledger_creator_month_idx
  on tlv.revenue_ledger (creator_id, ledger_month, created_at desc);
create index if not exists revenue_ledger_stream_idx
  on tlv.revenue_ledger (stream_id, created_at desc)
  where stream_id is not null;
create index if not exists revenue_ledger_ppc_idx
  on tlv.revenue_ledger (creator_id, created_at desc)
  where self_gift_excluded = false and event_kind != 'infra_allocation';

-- ---------------------------------------------------------------------------
-- gauge_state — 500 coin 基準 · stock · フェーズ
-- ---------------------------------------------------------------------------

create table if not exists tlv.gauge_state (
  stream_id                   uuid primary key references tlv.streams (id) on delete cascade,
  gauge_phase                 tlv.gauge_phase not null default 'accumulating',
  extension_unit_coins        integer not null default 500,
  paid_extension_coins        integer not null default 0,
  extension_stock_coins       integer not null default 0,
  completed_extension_blocks  integer not null default 0,
  next_block_cost_coins       integer not null default 500,
  gauge_pct                   numeric(6, 3) not null default 0,
  adjusted_gauge_pct          numeric(6, 3) not null default 0,
  gauge_difficulty            numeric(4, 3) not null default 1.000,
  effective_ccu               integer not null default 0,
  avg_watch_minutes           numeric(8, 2) not null default 0,
  cheer_count                 integer not null default 0,
  unique_viewers              integer not null default 0,
  extension_contributors      integer not null default 0,
  overgauge_bonus_seconds     integer not null default 0,
  free_phase_ends_at          timestamptz,
  grace_ends_at               timestamptz,
  threshold_met_at            timestamptz,
  updated_at                  timestamptz not null default now(),
  constraint gauge_state_extension_unit_chk check (extension_unit_coins = 500),
  constraint gauge_state_paid_coins_chk check (paid_extension_coins >= 0),
  constraint gauge_state_stock_chk check (extension_stock_coins >= 0),
  constraint gauge_state_blocks_chk check (completed_extension_blocks >= 0),
  constraint gauge_state_next_block_chk check (next_block_cost_coins between 0 and 500),
  constraint gauge_state_gauge_pct_chk check (gauge_pct between 0 and 100),
  constraint gauge_state_adjusted_pct_chk check (adjusted_gauge_pct between 0 and 100),
  constraint gauge_state_difficulty_chk check (gauge_difficulty between 0.8 and 1.2),
  constraint gauge_state_ccu_chk check (effective_ccu >= 0)
);

comment on table tlv.gauge_state is
  '延長ゲージ状態 — 500coin/block · stock · rostime/grace · 金額は tips/revenue_ledger';

create trigger gauge_state_updated_at
  before update on tlv.gauge_state
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- stream_events — UX / ゲージ / 演出ログ（金額正本ではない）
-- ---------------------------------------------------------------------------

create table if not exists tlv.stream_events (
  id              bigserial primary key,
  stream_id       uuid not null references tlv.streams (id) on delete cascade,
  event_kind      tlv.stream_event_kind not null,
  viewer_user_id  text,
  payload_json    jsonb not null default '{}'::jsonb,
  tip_id          uuid references tlv.tips (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table tlv.stream_events is
  'リアルタイム UX/監査ログ — 金額の正本にしない · 参照は tip_id のみ';

create index if not exists stream_events_stream_time_idx
  on tlv.stream_events (stream_id, created_at desc);
create index if not exists stream_events_kind_idx
  on tlv.stream_events (event_kind, created_at desc);

-- ---------------------------------------------------------------------------
-- creator_score_events — Score 軸イベント履歴（トレース必須）
-- ---------------------------------------------------------------------------

create table if not exists tlv.creator_score_events (
  id              bigserial primary key,
  creator_id      uuid not null references tlv.creators (id) on delete cascade,
  axis            tlv.score_axis not null,
  delta           smallint not null,
  score_before    smallint not null,
  score_after     smallint not null,
  reason_code     text not null,
  source_table    text,
  source_id       uuid,
  payload_json    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint creator_score_events_reason_len_chk
    check (char_length(reason_code) between 1 and 64),
  constraint creator_score_events_score_before_chk
    check (score_before between 0 and 1000),
  constraint creator_score_events_score_after_chk
    check (score_after between 0 and 1000)
);

comment on table tlv.creator_score_events is
  'Score 変動イベント — TS イベント駆動 · FS/ES リアルタイム trace';

create index if not exists creator_score_events_creator_time_idx
  on tlv.creator_score_events (creator_id, created_at desc);
create index if not exists creator_score_events_axis_idx
  on tlv.creator_score_events (creator_id, axis, created_at desc);
create index if not exists creator_score_events_reason_idx
  on tlv.creator_score_events (reason_code, created_at desc);

-- ---------------------------------------------------------------------------
-- creator_score_daily — 日次 Score 確定（GS 03:00 JST 反映）
-- ---------------------------------------------------------------------------

create table if not exists tlv.creator_score_daily (
  creator_id        uuid not null references tlv.creators (id) on delete cascade,
  score_date        date not null,
  fs                smallint not null,
  es                smallint not null,
  gs                smallint not null,
  ts                smallint not null,
  total             smallint not null,
  fs_ppc_pts        smallint not null default 0,
  fs_wr_pts         smallint not null default 0,
  es_watch_pts      smallint not null default 0,
  es_chat_pts       smallint not null default 0,
  es_ext_pts        smallint not null default 0,
  gs_rev_pts        smallint not null default 0,
  gs_new_pts        smallint not null default 0,
  ppc_30d_jpy       bigint not null default 0,
  wr_30d            numeric(6, 4) not null default 0,
  score_ma30        numeric(6, 2),
  inputs_json       jsonb not null default '{}'::jsonb,
  computed_at       timestamptz not null default now(),
  primary key (creator_id, score_date),
  constraint creator_score_daily_fs_chk check (fs between 0 and 400),
  constraint creator_score_daily_es_chk check (es between 0 and 300),
  constraint creator_score_daily_gs_chk check (gs between 0 and 200),
  constraint creator_score_daily_ts_chk check (ts between 0 and 100),
  constraint creator_score_daily_total_chk check (total between 0 and 1000),
  constraint creator_score_daily_total_sum_chk check (total = fs + es + gs + ts),
  constraint creator_score_daily_fs_sub_chk
    check (fs_ppc_pts between 0 and 250 and fs_wr_pts between 0 and 150 and fs = fs_ppc_pts + fs_wr_pts),
  constraint creator_score_daily_es_sub_chk
    check (es_watch_pts between 0 and 100 and es_chat_pts between 0 and 100 and es_ext_pts between 0 and 100
           and es = es_watch_pts + es_chat_pts + es_ext_pts),
  constraint creator_score_daily_gs_sub_chk
    check (gs_rev_pts between 0 and 120 and gs_new_pts between 0 and 80 and gs = gs_rev_pts + gs_new_pts)
);

comment on table tlv.creator_score_daily is
  '日次 Score 確定 — GS 日次 · MA30 入力 · Rank 判定の中間';

create index if not exists creator_score_daily_date_idx
  on tlv.creator_score_daily (score_date desc);

-- ---------------------------------------------------------------------------
-- creator_score_monthly — Rank / 還元の正本
-- ---------------------------------------------------------------------------

create table if not exists tlv.creator_score_monthly (
  creator_id            uuid not null references tlv.creators (id) on delete cascade,
  month_id              char(7) not null,
  fs                    smallint not null,
  es                    smallint not null,
  gs                    smallint not null,
  ts                    smallint not null,
  total                 smallint not null,
  score_ma30            numeric(6, 2) not null,
  rank_tier             tlv.rank_tier not null,
  override_tier         tlv.override_tier not null default 'none',
  base_rate             numeric(5, 4) not null,
  effective_rate        numeric(5, 4) not null,
  ppr_30d               numeric(8, 4),
  ppc_month_jpy         bigint not null default 0,
  wr_30d                numeric(6, 4) not null default 0,
  wr_month              numeric(6, 4) not null default 0,
  net_attributed_jpy    bigint not null default 0,
  net_attributed_clean  bigint not null default 0,
  infra_allocated_jpy   bigint not null default 0,
  creator_payout_jpy    bigint not null default 0,
  platform_profit_jpy   bigint not null default 0,
  tier_90_pass          boolean not null default false,
  tier_95_pass          boolean not null default false,
  fraud_event_count     smallint not null default 0,
  inputs_json           jsonb not null default '{}'::jsonb,
  locked_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (creator_id, month_id),
  constraint creator_score_monthly_month_format_chk check (month_id ~ '^\d{4}-\d{2}$'),
  constraint creator_score_monthly_fs_chk check (fs between 0 and 400),
  constraint creator_score_monthly_es_chk check (es between 0 and 300),
  constraint creator_score_monthly_gs_chk check (gs between 0 and 200),
  constraint creator_score_monthly_ts_chk check (ts between 0 and 100),
  constraint creator_score_monthly_total_chk check (total between 0 and 1000),
  constraint creator_score_monthly_total_sum_chk check (total = fs + es + gs + ts),
  constraint creator_score_monthly_score_ma30_chk check (score_ma30 between 0 and 1000),
  constraint creator_score_monthly_base_rate_chk check (base_rate between 0 and 1),
  constraint creator_score_monthly_effective_rate_chk check (effective_rate between 0 and 0.95),
  constraint creator_score_monthly_override_consistency_chk
    check (
      (override_tier = 'none' and effective_rate = base_rate)
      or (override_tier = 'tier_90' and effective_rate >= 0.90)
      or (override_tier = 'tier_95' and effective_rate >= 0.95)
      or locked_at is null
    )
);

comment on table tlv.creator_score_monthly is
  'Rank / 還元の正本 — score_ma30 · override_tier · ppr_30d · wr · ts 月次確定';

create index if not exists creator_score_monthly_rank_idx
  on tlv.creator_score_monthly (month_id, rank_tier);
create index if not exists creator_score_monthly_legend_idx
  on tlv.creator_score_monthly (month_id, score_ma30 desc, ppr_30d desc nulls last)
  where rank_tier = 'legend';
create index if not exists creator_score_monthly_locked_idx
  on tlv.creator_score_monthly (month_id, locked_at)
  where locked_at is not null;

create trigger creator_score_monthly_updated_at
  before update on tlv.creator_score_monthly
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- creator_rank_history — Rank 変遷
-- ---------------------------------------------------------------------------

create table if not exists tlv.creator_rank_history (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references tlv.creators (id) on delete cascade,
  month_id        char(7),
  rank_tier       tlv.rank_tier not null,
  score_ma30      numeric(6, 2) not null,
  override_tier   tlv.override_tier not null default 'none',
  effective_rate  numeric(5, 4) not null,
  change_reason   tlv.rank_change_reason not null,
  note            text,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  created_at      timestamptz not null default now(),
  constraint creator_rank_history_month_format_chk
    check (month_id is null or month_id ~ '^\d{4}-\d{2}$'),
  constraint creator_rank_history_score_ma30_chk check (score_ma30 between 0 and 1000),
  constraint creator_rank_history_effective_rate_chk check (effective_rate between 0 and 0.95),
  constraint creator_rank_history_range_chk
    check (effective_to is null or effective_to > effective_from)
);

comment on table tlv.creator_rank_history is
  'Rank 昇降格 · Legend 入替 · Ops override 履歴';

create index if not exists creator_rank_history_creator_idx
  on tlv.creator_rank_history (creator_id, effective_from desc);
create index if not exists creator_rank_history_month_idx
  on tlv.creator_rank_history (month_id, rank_tier);

-- ---------------------------------------------------------------------------
-- payout_log — 月次還元実行
-- ---------------------------------------------------------------------------

create table if not exists tlv.payout_log (
  id                      uuid primary key default gen_random_uuid(),
  creator_id              uuid not null references tlv.creators (id) on delete restrict,
  month_id                char(7) not null,
  net_attributed_clean_jpy bigint not null default 0,
  infra_allocated_jpy     bigint not null default 0,
  base_rate               numeric(5, 4) not null,
  override_tier           tlv.override_tier not null default 'none',
  effective_rate          numeric(5, 4) not null,
  creator_payout_jpy      bigint not null default 0,
  pool_bonus_jpy          bigint not null default 0,
  total_payout_jpy        bigint not null default 0,
  status                  tlv.payout_status not null default 'pending',
  hold_reason             text,
  hold_until              timestamptz,
  stripe_connect_account  text,
  stripe_transfer_id      text,
  approved_by             text,
  approved_at             timestamptz,
  paid_at                 timestamptz,
  failure_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint payout_log_month_format_chk check (month_id ~ '^\d{4}-\d{2}$'),
  constraint payout_log_amounts_chk check (
    net_attributed_clean_jpy >= 0 and infra_allocated_jpy >= 0
    and creator_payout_jpy >= 0 and pool_bonus_jpy >= 0 and total_payout_jpy >= 0
  ),
  constraint payout_log_total_chk
    check (total_payout_jpy = creator_payout_jpy + pool_bonus_jpy),
  constraint payout_log_rates_chk
    check (base_rate between 0 and 1 and effective_rate between 0 and 0.95),
  constraint payout_log_creator_month_uniq unique (creator_id, month_id)
);

comment on table tlv.payout_log is
  '月次還元実行 — creator_score_monthly 確定後 · 30日 hold 対応';

create index if not exists payout_log_status_idx
  on tlv.payout_log (status, hold_until);
create index if not exists payout_log_month_idx
  on tlv.payout_log (month_id, status);

create trigger payout_log_updated_at
  before update on tlv.payout_log
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- legend_waitlist — Legend 定員 100 · PPR 降順
-- ---------------------------------------------------------------------------

create table if not exists tlv.legend_waitlist (
  month_id              char(7) not null,
  creator_id            uuid not null references tlv.creators (id) on delete cascade,
  waitlist_position     integer not null,
  ppr_month             numeric(8, 4) not null,
  score_ma30            numeric(6, 2) not null,
  ts_snapshot           smallint not null,
  is_legend_seat        boolean not null default false,
  eligible              boolean not null default true,
  snapshot_at           timestamptz not null default now(),
  primary key (month_id, creator_id),
  constraint legend_waitlist_month_format_chk check (month_id ~ '^\d{4}-\d{2}$'),
  constraint legend_waitlist_position_chk check (waitlist_position > 0),
  constraint legend_waitlist_score_ma30_chk
    check (score_ma30 >= 930),
  constraint legend_waitlist_ts_chk check (ts_snapshot between 0 and 100),
  constraint legend_waitlist_month_position_uniq unique (month_id, waitlist_position),
  constraint legend_waitlist_legend_cap_chk
    check (not is_legend_seat or waitlist_position <= 100)
);

comment on table tlv.legend_waitlist is
  'Legend 定員100 · PPR 降順 · 動的入替スナップショット';

create index if not exists legend_waitlist_month_ppr_idx
  on tlv.legend_waitlist (month_id, ppr_month desc, score_ma30 desc);
create index if not exists legend_waitlist_legend_seats_idx
  on tlv.legend_waitlist (month_id, waitlist_position)
  where is_legend_seat = true;

-- ---------------------------------------------------------------------------
-- Optional FK: payout_log → creator_score_monthly composite
-- ---------------------------------------------------------------------------

alter table tlv.payout_log
  drop constraint if exists payout_log_score_monthly_fk;

alter table tlv.payout_log
  add constraint payout_log_score_monthly_fk
  foreign key (creator_id, month_id)
  references tlv.creator_score_monthly (creator_id, month_id)
  on delete restrict;

-- ===========================================================================
-- Phase 1.2.3 — viewer_wallets · coin_lots · WR trace · webhook idempotency
-- Ref: docs/TLV_PAYMENT_ENGINE.md · reports/tlv-payment-engine-todo-phase1.md
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ENUM additions (Phase 1)
-- ---------------------------------------------------------------------------

create type tlv.coin_lot_source as enum (
  'web_stripe',
  'ios_iap',
  'android_iap',
  'welcome_grant',
  'ops_adjustment'
);

create type tlv.payment_provider as enum (
  'stripe',
  'apple_iap',
  'google_iap'
);

create type tlv.provider_event_status as enum (
  'received',
  'processing',
  'processed',
  'failed',
  'ignored'
);

create type tlv.wallet_status as enum (
  'active',
  'frozen',
  'closed'
);

create type tlv.wallet_ledger_entry_type as enum (
  'purchase_credit',
  'tip_debit',
  'refund_credit',
  'chargeback_debit',
  'adjustment_credit',
  'adjustment_debit',
  'lock',
  'unlock'
);

-- ---------------------------------------------------------------------------
-- viewer_wallets — Viewer コイン残高正本
-- ---------------------------------------------------------------------------

create table if not exists tlv.viewer_wallets (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  coin_balance              integer not null default 0,
  locked_coin_balance       integer not null default 0,
  lifetime_purchased_coins  integer not null default 0,
  lifetime_spent_coins      integer not null default 0,
  status                    tlv.wallet_status not null default 'active',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint viewer_wallets_user_id_uniq unique (user_id),
  constraint viewer_wallets_coin_balance_chk check (coin_balance >= 0),
  constraint viewer_wallets_locked_balance_chk check (locked_coin_balance >= 0),
  constraint viewer_wallets_locked_lte_balance_chk
    check (locked_coin_balance <= coin_balance),
  constraint viewer_wallets_lifetime_purchased_chk check (lifetime_purchased_coins >= 0),
  constraint viewer_wallets_lifetime_spent_chk check (lifetime_spent_coins >= 0)
);

comment on table tlv.viewer_wallets is
  'Viewer コイン残高正本 — coin_balance / locked_coin_balance · JPY 正本ではない';
comment on column tlv.viewer_wallets.coin_balance is
  '利用可能 + ロック含む総残高（tip 可否: coin_balance - locked_coin_balance）';
comment on column tlv.viewer_wallets.locked_coin_balance is
  '保留・チャージバック調査等で spend 不可にした coin';
comment on column tlv.viewer_wallets.user_id is
  'Platform ユーザー UUID — auth.users(id) 参照（Supabase 前提 · 別 migration で FK 追加可）';

create index if not exists viewer_wallets_user_id_idx
  on tlv.viewer_wallets (user_id);

create index if not exists viewer_wallets_status_idx
  on tlv.viewer_wallets (status)
  where status != 'active';

create trigger viewer_wallets_updated_at
  before update on tlv.viewer_wallets
  for each row execute function tlv.set_updated_at();

-- Optional FK (Supabase): alter table tlv.viewer_wallets
--   add constraint viewer_wallets_user_id_fk
--   foreign key (user_id) references auth.users (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- coin_lots — 購入単位ロット（Web/App 由来 · FIFO 消費）
-- ---------------------------------------------------------------------------

create table if not exists tlv.coin_lots (
  id                  uuid primary key default gen_random_uuid(),
  wallet_id           uuid not null references tlv.viewer_wallets (id) on delete restrict,
  user_id             uuid not null,
  payment_id          uuid references tlv.payments (id) on delete set null,
  lot_source          tlv.coin_lot_source not null,
  is_web_payment      boolean not null,
  gross_amount_jpy    bigint not null default 0,
  fee_amount_jpy      bigint not null default 0,
  net_amount_jpy      bigint not null default 0,
  coins_original      integer not null,
  coins_remaining     integer not null,
  extension_allowed   boolean not null default true,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint coin_lots_coins_original_chk check (coins_original > 0),
  constraint coin_lots_coins_remaining_chk
    check (coins_remaining >= 0 and coins_remaining <= coins_original),
  constraint coin_lots_amounts_nonneg_chk
    check (gross_amount_jpy >= 0 and fee_amount_jpy >= 0 and net_amount_jpy >= 0),
  constraint coin_lots_net_formula_chk
    check (net_amount_jpy = gross_amount_jpy - fee_amount_jpy),
  constraint coin_lots_source_payment_chk check (
    (lot_source in ('web_stripe', 'ios_iap', 'android_iap') and payment_id is not null)
    or (lot_source = 'welcome_grant' and payment_id is null)
    or lot_source = 'ops_adjustment'
  ),
  constraint coin_lots_welcome_extension_chk
    check (lot_source != 'welcome_grant' or extension_allowed = false)
);

comment on table tlv.coin_lots is
  'コインロット — 購入チャネル・Net 按分 · tip FIFO 消費 · FS_WR origin 正本';
comment on column tlv.coin_lots.is_web_payment is
  'lot_source = web_stripe のとき true — tip 消費 WR 按分用';
comment on column tlv.coin_lots.extension_allowed is
  'welcome_grant は false（PRICING §3）';

create index if not exists coin_lots_wallet_fifo_idx
  on tlv.coin_lots (wallet_id, expires_at nulls last, created_at asc)
  where coins_remaining > 0;

create index if not exists coin_lots_user_fifo_idx
  on tlv.coin_lots (user_id, expires_at nulls last, created_at asc)
  where coins_remaining > 0;

create index if not exists coin_lots_payment_idx
  on tlv.coin_lots (payment_id)
  where payment_id is not null;

create trigger coin_lots_updated_at
  before update on tlv.coin_lots
  for each row execute function tlv.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_provider_events — Webhook 冪等（二重 coin / 二重 ledger 防止）
-- ---------------------------------------------------------------------------

create table if not exists tlv.payment_provider_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            tlv.payment_provider not null,
  provider_event_id   text not null,
  event_type          text not null,
  status              tlv.provider_event_status not null default 'received',
  payment_id          uuid references tlv.payments (id) on delete set null,
  payload_hash        text not null,
  error_message       text,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  constraint payment_provider_events_event_id_uniq
    unique (provider, provider_event_id),
  constraint payment_provider_events_event_type_len_chk
    check (char_length(event_type) between 1 and 128),
  constraint payment_provider_events_payload_hash_len_chk
    check (char_length(payload_hash) between 32 and 128)
);

comment on table tlv.payment_provider_events is
  '決済プロバイダ Webhook 冪等 — provider_event_id 重複は processed なら no-op';

create index if not exists payment_provider_events_status_idx
  on tlv.payment_provider_events (status, received_at desc);

create index if not exists payment_provider_events_payment_idx
  on tlv.payment_provider_events (payment_id)
  where payment_id is not null;

-- ---------------------------------------------------------------------------
-- tip_coin_lot_allocations — tip 消費ロット按分（WR origin 正本）
-- ---------------------------------------------------------------------------

create table if not exists tlv.tip_coin_lot_allocations (
  id                    uuid primary key default gen_random_uuid(),
  tip_id                uuid not null references tlv.tips (id) on delete restrict,
  coin_lot_id           uuid not null references tlv.coin_lots (id) on delete restrict,
  coins_allocated       integer not null,
  gross_allocated_jpy   bigint not null default 0,
  net_allocated_jpy     bigint not null default 0,
  is_web_origin         boolean not null,
  lot_source            tlv.coin_lot_source not null,
  created_at            timestamptz not null default now(),
  constraint tip_coin_lot_alloc_coins_chk check (coins_allocated > 0),
  constraint tip_coin_lot_alloc_amounts_chk
    check (gross_allocated_jpy >= 0 and net_allocated_jpy >= 0),
  constraint tip_coin_lot_alloc_uniq unique (tip_id, coin_lot_id)
);

comment on table tlv.tip_coin_lot_allocations is
  'tip が消費した lot 内訳 — FS_WR は tip 消費 origin の net 按分を集計';

create index if not exists tip_coin_lot_alloc_tip_idx
  on tlv.tip_coin_lot_allocations (tip_id);

create index if not exists tip_coin_lot_alloc_lot_idx
  on tlv.tip_coin_lot_allocations (coin_lot_id);

create index if not exists tip_coin_lot_alloc_web_origin_idx
  on tlv.tip_coin_lot_allocations (tip_id, is_web_origin);

-- ---------------------------------------------------------------------------
-- tips — WR origin スナップショット（tip 確定時 denormalize）
-- ---------------------------------------------------------------------------

alter table tlv.tips
  add column if not exists web_origin_coins integer not null default 0,
  add column if not exists app_origin_coins integer not null default 0,
  add column if not exists web_origin_net_jpy bigint not null default 0,
  add column if not exists app_origin_net_jpy bigint not null default 0,
  add column if not exists wr_at_tip numeric(6, 4);

comment on column tlv.tips.web_origin_net_jpy is
  'tip 消費時 lot 按分 Web 由来 Net — FS_WR 集計入力（購入時ではなく消費 origin）';
comment on column tlv.tips.wr_at_tip is
  'web_origin_net_jpy / (web+app origin net) · fraud_excluded tip は NULL 可';

alter table tlv.tips
  drop constraint if exists tips_origin_coins_chk;

alter table tlv.tips
  add constraint tips_origin_coins_chk
  check (web_origin_coins >= 0 and app_origin_coins >= 0);

alter table tlv.tips
  drop constraint if exists tips_origin_net_chk;

alter table tlv.tips
  add constraint tips_origin_net_chk
  check (web_origin_net_jpy >= 0 and app_origin_net_jpy >= 0);

-- ---------------------------------------------------------------------------
-- wallet_ledger — コイン残高変動監査（INSERT-only · JPY 正本ではない）
-- ---------------------------------------------------------------------------

create table if not exists tlv.wallet_ledger (
  id                  uuid primary key default gen_random_uuid(),
  wallet_id           uuid not null references tlv.viewer_wallets (id) on delete restrict,
  user_id             uuid not null,
  entry_type          tlv.wallet_ledger_entry_type not null,
  coins_delta         integer not null,
  balance_after       integer not null,
  payment_id          uuid references tlv.payments (id) on delete set null,
  tip_id              uuid references tlv.tips (id) on delete set null,
  provider_event_id   uuid references tlv.payment_provider_events (id) on delete set null,
  reason_code         text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  constraint wallet_ledger_balance_after_chk check (balance_after >= 0),
  constraint wallet_ledger_adjustment_reason_chk check (
    entry_type not in ('adjustment_credit', 'adjustment_debit')
    or (reason_code is not null and char_length(reason_code) >= 1)
  ),
  constraint wallet_ledger_reason_code_len_chk check (
    reason_code is null or char_length(reason_code) between 1 and 128
  )
);

comment on table tlv.wallet_ledger is
  'コイン残高監査ログ — INSERT-only · 更新禁止 · JPY 金額正本は payments/revenue_ledger';
comment on column tlv.wallet_ledger.balance_after is
  'エントリ直後の viewer_wallets.coin_balance と一致必須（アプリ層 invariant）';
comment on column tlv.wallet_ledger.metadata is
  'Ops ticket · idempotency_key · coin_lot_id 等（任意）';

create index if not exists wallet_ledger_wallet_time_idx
  on tlv.wallet_ledger (wallet_id, created_at desc);

create index if not exists wallet_ledger_user_time_idx
  on tlv.wallet_ledger (user_id, created_at desc);

create index if not exists wallet_ledger_entry_type_idx
  on tlv.wallet_ledger (entry_type, created_at desc);

create index if not exists wallet_ledger_payment_idx
  on tlv.wallet_ledger (payment_id)
  where payment_id is not null;

create index if not exists wallet_ledger_tip_idx
  on tlv.wallet_ledger (tip_id)
  where tip_id is not null;

-- Optional FK (Supabase): alter table tlv.wallet_ledger
--   add constraint wallet_ledger_user_id_fk
--   foreign key (user_id) references auth.users (id) on delete restrict;

-- ===========================================================================
-- Phase 1.2.4 — payer_user_uuid alignment (CAND-W1 解消)
-- Ref: reports/tlv-payment-user-uuid-alignment.md
-- ===========================================================================

alter table tlv.payments
  add column if not exists payer_user_uuid uuid;

alter table tlv.tips
  add column if not exists payer_user_uuid uuid;

comment on column tlv.payments.payer_user_uuid is
  'Viewer 正本 UUID — viewer_wallets.user_id と JOIN · Payment Engine 必須書込';
comment on column tlv.tips.payer_user_uuid is
  'Viewer 正本 UUID — viewer_wallets.user_id と JOIN · Payment Engine 必須書込';

create index if not exists payments_payer_uuid_idx
  on tlv.payments (payer_user_uuid, created_at desc)
  where payer_user_uuid is not null;

create index if not exists tips_payer_uuid_idx
  on tlv.tips (payer_user_uuid, created_at desc)
  where payer_user_uuid is not null;

-- Optional FK (Supabase):
-- alter table tlv.payments
--   add constraint payments_payer_user_uuid_fk
--   foreign key (payer_user_uuid) references auth.users (id) on delete restrict;
-- alter table tlv.tips
--   add constraint tips_payer_user_uuid_fk
--   foreign key (payer_user_uuid) references auth.users (id) on delete restrict;

-- ===========================================================================
-- Phase 1.2.5 — createTip single-TX RPC (CAND-P2-01)
-- Ref: supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql
-- ===========================================================================

alter table tlv.tips
  add column if not exists idempotency_key text;

comment on column tlv.tips.idempotency_key is
  'Client idempotency key — duplicate RPC returns existing tip without double debit';

create unique index if not exists tips_idempotency_key_uniq
  on tlv.tips (idempotency_key)
  where idempotency_key is not null;

-- Full RPC body: supabase/migrations/20260628140000_tlv_create_tip_transaction_rpc.sql
-- Functions: tlv.compute_gauge_pct · tlv.create_tip_transaction
