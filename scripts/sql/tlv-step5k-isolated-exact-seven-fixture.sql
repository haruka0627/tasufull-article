\set ON_ERROR_STOP on

-- Synthetic/pseudonymous reconstruction of the exact STEP 5H/5I economic shape.
-- Apply only to disposable PostgreSQL before the STEP 4 ledger insert guard exists.
insert into tlv.creators (id, user_id, display_name, channel_slug)
values ('a0000000-0000-4000-8000-000000000001', 'isolated-step5k-creator', 'STEP5K QA', 'isolated-step5k');

insert into tlv.streams (id, creator_id, title, status, phase, started_at)
values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','STEP5K 01','ended','ended','2026-07-01T00:00:00Z'),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','STEP5K 02','ended','ended','2026-07-02T00:00:00Z'),
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','STEP5K 03','ended','ended','2026-07-03T00:00:00Z'),
 ('b0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000001','STEP5K 08','ended','ended','2026-07-08T00:00:00Z');

with fixture(case_no, tip_id, stream_id, kind, coins, idem, occurred_at) as (values
 (1,'c0000000-0000-4000-8000-000000000001'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'gift'::tlv.tip_kind,100,'tlv-staging-tip-01','2026-07-01T01:00:00Z'::timestamptz),
 (2,'c0000000-0000-4000-8000-000000000002'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'gift'::tlv.tip_kind,50,'tlv-staging-tip-02','2026-07-02T01:00:00Z'::timestamptz),
 (31,'c0000000-0000-4000-8000-000000000031'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.tip_kind,100,'tlv-staging-tip-03-1','2026-07-03T01:00:00Z'::timestamptz),
 (32,'c0000000-0000-4000-8000-000000000032'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.tip_kind,100,'tlv-staging-tip-03-2','2026-07-03T01:01:00Z'::timestamptz),
 (33,'c0000000-0000-4000-8000-000000000033'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.tip_kind,100,'tlv-staging-tip-03-3','2026-07-03T01:02:00Z'::timestamptz),
 (81,'c0000000-0000-4000-8000-000000000081'::uuid,'b0000000-0000-4000-8000-000000000008'::uuid,'extension'::tlv.tip_kind,500,'tlv-staging-tip-08a','2026-07-08T01:00:00Z'::timestamptz),
 (82,'c0000000-0000-4000-8000-000000000082'::uuid,'b0000000-0000-4000-8000-000000000008'::uuid,'extension'::tlv.tip_kind,500,'tlv-staging-tip-08b','2026-07-08T01:01:00Z'::timestamptz)
)
insert into tlv.tips (
 id, stream_id, creator_id, payer_user_id, payer_user_uuid, tip_kind, coins_amount,
 gross_amount_jpy, net_amount_jpy, web_origin_coins, app_origin_coins,
 web_origin_net_jpy, app_origin_net_jpy, wr_at_tip, idempotency_key, created_at
)
select tip_id, stream_id, 'a0000000-0000-4000-8000-000000000001',
 'tlv-staging-tip-viewer', 'a0000000-0000-4000-8000-000000000101', kind, coins,
 coins::bigint * 100, coins::bigint * 100, coins, 0, coins::bigint * 100, 0, 1, idem, occurred_at
from fixture;

with fixture(ledger_id, tip_id, stream_id, kind, coins, occurred_at) as (values
 ('d0000000-0000-4000-8000-000000000001'::uuid,'c0000000-0000-4000-8000-000000000001'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'gift'::tlv.revenue_event_kind,100,'2026-07-01T01:00:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000002'::uuid,'c0000000-0000-4000-8000-000000000002'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'gift'::tlv.revenue_event_kind,50,'2026-07-02T01:00:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000031'::uuid,'c0000000-0000-4000-8000-000000000031'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.revenue_event_kind,100,'2026-07-03T01:00:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000032'::uuid,'c0000000-0000-4000-8000-000000000032'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.revenue_event_kind,100,'2026-07-03T01:01:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000033'::uuid,'c0000000-0000-4000-8000-000000000033'::uuid,'b0000000-0000-4000-8000-000000000003'::uuid,'gift'::tlv.revenue_event_kind,100,'2026-07-03T01:02:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000081'::uuid,'c0000000-0000-4000-8000-000000000081'::uuid,'b0000000-0000-4000-8000-000000000008'::uuid,'extension'::tlv.revenue_event_kind,500,'2026-07-08T01:00:00Z'::timestamptz),
 ('d0000000-0000-4000-8000-000000000082'::uuid,'c0000000-0000-4000-8000-000000000082'::uuid,'b0000000-0000-4000-8000-000000000008'::uuid,'extension'::tlv.revenue_event_kind,500,'2026-07-08T01:01:00Z'::timestamptz)
)
insert into tlv.revenue_ledger (
 id, stream_id, creator_id, tip_id, event_kind, ledger_month, gross_amount_jpy,
 fee_amount_jpy, net_amount_jpy, infra_cost_jpy, creator_payout_jpy,
 platform_revenue_jpy, self_gift_excluded, created_at
)
select ledger_id, stream_id, 'a0000000-0000-4000-8000-000000000001', tip_id,
 kind, '2026-07', coins::bigint*100, 0, coins::bigint*100, 0, 0, coins::bigint*100, false, occurred_at
from fixture;

insert into tlv.creator_score_events (
 creator_id, axis, delta, score_before, score_after, reason_code, source_table, source_id, payload_json, created_at
)
select 'a0000000-0000-4000-8000-000000000001', 'FS', 0, 0, 0,
 'STEP5K_SYNTHETIC_SHAPE', 'tips', id, '{"synthetic":true}'::jsonb, created_at
from tlv.tips where idempotency_key like 'tlv-staging-tip-%';
