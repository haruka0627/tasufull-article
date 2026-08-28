\set ON_ERROR_STOP on

create schema if not exists step5d_test;

create or replace function step5d_test.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_value is not true then
    raise exception 'STEP5D_ASSERTION_FAILED:%', p_message;
  end if;
end
$$;

create or replace function step5d_test.expect_error(p_sql text, p_pattern text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    set constraints all immediate;
  exception when others then
    if position(lower(p_pattern) in lower(sqlerrm)) = 0 then
      raise exception 'STEP5D_UNEXPECTED_ERROR expected=% actual=%', p_pattern, sqlerrm;
    end if;
    set constraints all deferred;
    return;
  end;
  raise exception 'STEP5D_EXPECTED_ERROR_NOT_RAISED:%', p_pattern;
end
$$;

grant usage on schema step5d_test to anon, authenticated, service_role;
grant execute on function step5d_test.assert_true(boolean, text) to anon, authenticated, service_role;
grant execute on function step5d_test.expect_error(text, text) to anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- Forward migration / privilege / trigger contract.
-- -------------------------------------------------------------------------
select step5d_test.assert_true(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'tlv.payout_log'::regclass
      and conname = 'payout_log_score_monthly_fk'
  ),
  'legacy unconditional FK still present'
);
select step5d_test.assert_true(to_regclass('tlv.payout_log_creation_key_uniq') is not null, 'creation-key uniqueness missing');
select step5d_test.assert_true(to_regclass('tlv.payout_log_provider_correlation_uniq') is not null, 'provider correlation uniqueness missing');
select step5d_test.assert_true(to_regclass('tlv.payout_log_provider_transfer_uniq') is not null, 'provider transfer uniqueness missing');
select step5d_test.assert_true(to_regclass('tlv.payout_log_provider_payout_uniq') is not null, 'provider payout uniqueness missing');
select step5d_test.assert_true(to_regclass('tlv.revenue_ledger_adjustment_provider_tip_uniq') is not null, 'provider adjustment/tip uniqueness missing');
select step5d_test.assert_true(
  not has_function_privilege('service_role', 'tlv.transition_monthly_settlement(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)', 'EXECUTE'),
  'legacy settlement transition remains service callable'
);
select step5d_test.assert_true(
  has_function_privilege('service_role', 'tlv.create_canonical_settlement_payout(uuid,text,timestamptz)', 'EXECUTE'),
  'canonical payout writer unavailable'
);
select step5d_test.assert_true(
  has_function_privilege('service_role', 'tlv.transition_canonical_settlement_payout(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)', 'EXECUTE'),
  'canonical transition wrapper unavailable'
);
select step5d_test.assert_true(
  not has_function_privilege('authenticated', 'tlv.create_canonical_settlement_payout(uuid,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'tlv.transition_canonical_settlement_payout(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)', 'EXECUTE'),
  'authenticated canonical function execute'
);
select step5d_test.assert_true(
  (select prosecdef and proconfig @> array['search_path=pg_catalog, tlv']
   from pg_proc
   where oid = 'tlv.create_canonical_settlement_payout(uuid,text,timestamptz)'::regprocedure),
  'canonical writer SECURITY DEFINER/search_path'
);
select step5d_test.assert_true(
  (select prosecdef and proconfig @> array['search_path=pg_catalog, tlv']
   from pg_proc
   where oid = 'tlv.transition_canonical_settlement_payout(uuid,integer,tlv.settlement_status,text,text,timestamptz,jsonb,jsonb)'::regprocedure),
  'canonical transition SECURITY DEFINER/search_path'
);

-- -------------------------------------------------------------------------
-- Production-shaped zero-legacy baseline and removal of compatibility code.
-- -------------------------------------------------------------------------
select step5d_test.assert_true(
  (select count(*) = 0 from tlv.payout_log),
  'OPTION_A baseline is not zero-payout'
);
select step5d_test.assert_true(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='tlv' and p.proname='protect_legacy_payout_score_reference'
  ),
  'legacy score compatibility function remains'
);
select step5d_test.assert_true(
  not exists (
    select 1 from pg_trigger
    where tgrelid='tlv.creator_score_monthly'::regclass
      and tgname='creator_score_monthly_legacy_payout_guard'
  ),
  'legacy score compatibility trigger remains'
);

-- -------------------------------------------------------------------------
-- New deterministic fixtures. These months deliberately have no
-- creator_score_monthly rows.
-- -------------------------------------------------------------------------
select step5_test.insert_settlement('51000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-09',1,2000);
select step5_test.insert_settlement('52000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-10',1,3000);
select step5_test.insert_settlement('53000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11',1,4000);
select step5_test.insert_settlement('54000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-12',1,5000);
select step5_test.insert_settlement('55000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-01',1,6000);
select step5_test.insert_settlement('56000000-0000-4000-8000-000000000006','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-08',1,7000);

set role service_role;
select tlv.transition_canonical_settlement_payout('51000000-0000-4000-8000-000000000001',1,'REVIEWABLE','5d-01-review','step5d-service','2026-08-28 00:01:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('51000000-0000-4000-8000-000000000001',1,'FINALIZED','5d-01-final','step5d-service','2026-08-28 00:02:00+00','{"final":true}','{"finalized_snapshot_hash":"1111111111111111111111111111111111111111111111111111111111111111"}');
select tlv.transition_canonical_settlement_payout('52000000-0000-4000-8000-000000000002',1,'REVIEWABLE','5d-02-review','step5d-service','2026-08-28 00:03:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('52000000-0000-4000-8000-000000000002',1,'FINALIZED','5d-02-final','step5d-service','2026-08-28 00:04:00+00','{"final":true}','{"finalized_snapshot_hash":"2222222222222222222222222222222222222222222222222222222222222222"}');
select tlv.transition_canonical_settlement_payout('53000000-0000-4000-8000-000000000003',1,'REVIEWABLE','5d-03-review','step5d-service','2026-08-28 00:05:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('53000000-0000-4000-8000-000000000003',1,'FINALIZED','5d-03-final','step5d-service','2026-08-28 00:06:00+00','{"final":true}','{"finalized_snapshot_hash":"3333333333333333333333333333333333333333333333333333333333333333"}');
select tlv.transition_canonical_settlement_payout('54000000-0000-4000-8000-000000000004',1,'REVIEWABLE','5d-04-review','step5d-service','2026-08-28 00:07:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('54000000-0000-4000-8000-000000000004',1,'FINALIZED','5d-04-final','step5d-service','2026-08-28 00:08:00+00','{"final":true}','{"finalized_snapshot_hash":"4444444444444444444444444444444444444444444444444444444444444444"}');
select tlv.transition_canonical_settlement_payout('55000000-0000-4000-8000-000000000005',1,'REVIEWABLE','5d-05-review','step5d-service','2026-08-28 00:09:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('55000000-0000-4000-8000-000000000005',1,'FINALIZED','5d-05-final','step5d-service','2026-08-28 00:10:00+00','{"final":true}','{"finalized_snapshot_hash":"5555555555555555555555555555555555555555555555555555555555555555"}');
select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'REVIEWABLE','5d-06-review','step5d-service','2026-08-28 00:11:00+00','{"review":true}','{}');
select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'FINALIZED','5d-06-final','step5d-service','2026-08-28 00:12:00+00','{"final":true}','{"finalized_snapshot_hash":"6666666666666666666666666666666666666666666666666666666666666666"}');

select tlv.create_canonical_settlement_payout('51000000-0000-4000-8000-000000000001','payout-create-01','2026-08-28 01:01:00+00');
select tlv.create_canonical_settlement_payout('52000000-0000-4000-8000-000000000002','payout-create-02','2026-08-28 01:02:00+00');
select tlv.create_canonical_settlement_payout('53000000-0000-4000-8000-000000000003','payout-create-03','2026-08-28 01:03:00+00');
select tlv.create_canonical_settlement_payout('54000000-0000-4000-8000-000000000004','payout-create-04','2026-08-28 01:04:00+00');
select tlv.create_canonical_settlement_payout('55000000-0000-4000-8000-000000000005','payout-create-05','2026-08-28 01:05:00+00');
select tlv.create_canonical_settlement_payout('56000000-0000-4000-8000-000000000006','payout-create-06','2026-08-28 01:06:00+00');
reset role;

select step5d_test.assert_true(
  (select count(*) = 0 from tlv.creator_score_monthly where month_id in ('2026-09','2026-10','2026-11','2026-12','2027-01')),
  'dummy score row created'
);
select step5d_test.assert_true(
  (select count(*) = 6 from tlv.payout_log where payout_creation_key like 'payout-create-%'
    and settlement_id is not null and base_rate is null and effective_rate is null and override_tier is null),
  'new canonical payouts missing or retain score rates'
);
select step5d_test.assert_true(
  (select count(*) = 6 from tlv.payout_log pl join tlv.monthly_settlements ms on ms.id=pl.settlement_id
   where pl.payout_creation_key like 'payout-create-%'
     and pl.creator_id=ms.creator_id and pl.month_id=ms.settlement_period
     and pl.total_payout_jpy=ms.payout_amount_jpy and pl.creator_payout_jpy=ms.payout_amount_jpy),
  'canonical creator/period/amount parity'
);

-- Direct/legacy-shaped rows fail closed even when a caller imitates a writer.
select step5d_test.expect_error(
  $q$insert into tlv.payout_log(creator_id,month_id,base_rate,override_tier,effective_rate,status) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-02',0.5,'none',0.5,'pending')$q$,
  'canonical_settlement_required_for_payout'
);
select set_config('tlv.canonical_payout_writer','on',false);
select set_config('tlv.canonical_settlement_target_status','FINALIZED',false);
select step5d_test.expect_error(
  $q$insert into tlv.payout_log(creator_id,month_id,creator_payout_jpy,total_payout_jpy,status,settlement_id,correlation_id,payout_creation_key) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-09',1600,1600,'approved','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','bad-creator')$q$,
  'canonical_payout_creator_mismatch'
);
select step5d_test.expect_error(
  $q$insert into tlv.payout_log(creator_id,month_id,creator_payout_jpy,total_payout_jpy,status,settlement_id,correlation_id,payout_creation_key) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-02',1600,1600,'approved','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','bad-period')$q$,
  'canonical_payout_period_mismatch'
);
select step5d_test.expect_error(
  $q$insert into tlv.payout_log(creator_id,month_id,creator_payout_jpy,total_payout_jpy,status,settlement_id,correlation_id,payout_creation_key) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-09',1599,1599,'approved','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','bad-amount')$q$,
  'canonical_payout_amount_mismatch'
);
select set_config('tlv.canonical_payout_writer','off',false);
select set_config('tlv.canonical_settlement_target_status','',false);

set role service_role;
select step5d_test.assert_true(
  ((tlv.create_canonical_settlement_payout('51000000-0000-4000-8000-000000000001','payout-create-01','2026-08-28 01:01:00+00'))->>'idempotent')::boolean,
  'canonical payout creation idempotency'
);
select step5d_test.expect_error(
  $q$select tlv.create_canonical_settlement_payout('51000000-0000-4000-8000-000000000001','payout-create-collision','2026-08-28 01:01:00+00')$q$,
  'duplicate_settlement_payout_creation'
);

-- State fixtures: approved(before), TRANSFER_PENDING, TRANSFERRED,
-- TRANSFER_UNKNOWN, PAID, plus a Creator-B pending payout for RLS.
select tlv.transition_canonical_settlement_payout('52000000-0000-4000-8000-000000000002',1,'TRANSFER_PENDING','5d-02-pending','step5d-service','2026-08-28 02:01:00+00','{"transfer":true}','{"transfer_instruction":{"settlement_id":"52000000-0000-4000-8000-000000000002","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":2400,"currency":"JPY","policy_version":"AD-040-step3b-v1","provider_account_binding":"acct-synthetic-a","idempotency_key":"transfer-02","environment":"test","provider_execution_performed":false}}');
select tlv.transition_canonical_settlement_payout('53000000-0000-4000-8000-000000000003',1,'TRANSFER_PENDING','5d-03-pending','step5d-service','2026-08-28 02:02:00+00','{"transfer":true}','{"transfer_instruction":{"settlement_id":"53000000-0000-4000-8000-000000000003","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":3200,"currency":"JPY","policy_version":"AD-040-step3b-v1","provider_account_binding":"acct-synthetic-a","idempotency_key":"transfer-03","environment":"test","provider_execution_performed":false}}');
select tlv.transition_canonical_settlement_payout('53000000-0000-4000-8000-000000000003',1,'TRANSFERRED','5d-03-transferred','step5d-service','2026-08-28 02:03:00+00','{"provider":"synthetic"}','{"provider_transfer_id":"tr_step5d_03"}');
select tlv.transition_canonical_settlement_payout('54000000-0000-4000-8000-000000000004',1,'TRANSFER_PENDING','5d-04-pending','step5d-service','2026-08-28 02:04:00+00','{"transfer":true}','{"transfer_instruction":{"settlement_id":"54000000-0000-4000-8000-000000000004","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":4000,"currency":"JPY","policy_version":"AD-040-step3b-v1","provider_account_binding":"acct-synthetic-a","idempotency_key":"transfer-04","environment":"test","provider_execution_performed":false}}');
select tlv.transition_canonical_settlement_payout('54000000-0000-4000-8000-000000000004',1,'TRANSFER_UNKNOWN','5d-04-unknown','step5d-service','2026-08-28 02:05:00+00','{"timeout":"synthetic"}','{"provider_correlation_id":"corr_step5d_04"}');
select tlv.transition_canonical_settlement_payout('55000000-0000-4000-8000-000000000005',1,'TRANSFER_PENDING','5d-05-pending','step5d-service','2026-08-28 02:06:00+00','{"transfer":true}','{"transfer_instruction":{"settlement_id":"55000000-0000-4000-8000-000000000005","creator_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","amount_jpy":4800,"currency":"JPY","policy_version":"AD-040-step3b-v1","provider_account_binding":"acct-synthetic-a","idempotency_key":"transfer-05","environment":"test","provider_execution_performed":false}}');
select tlv.transition_canonical_settlement_payout('55000000-0000-4000-8000-000000000005',1,'TRANSFERRED','5d-05-transferred','step5d-service','2026-08-28 02:07:00+00','{"provider":"synthetic"}','{"provider_transfer_id":"tr_step5d_05"}');
select tlv.transition_canonical_settlement_payout('55000000-0000-4000-8000-000000000005',1,'PAID','5d-05-paid','step5d-service','2026-08-28 02:08:00+00','{"external_payout_confirmed":true}','{"provider_payout_id":"po_step5d_05"}');
select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'TRANSFER_PENDING','5d-06-pending','step5d-service','2026-08-28 02:09:00+00','{"transfer":true}','{"transfer_instruction":{"settlement_id":"56000000-0000-4000-8000-000000000006","creator_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","amount_jpy":5600,"currency":"JPY","policy_version":"AD-040-step3b-v1","provider_account_binding":"acct-synthetic-b","idempotency_key":"transfer-06","environment":"test","provider_execution_performed":false}}');

-- Duplicate provider IDs across another settlement fail immediately.
select step5d_test.expect_error(
  $q$select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'TRANSFERRED','5d-06-transfer-dup','step5d-service','2026-08-28 02:10:00+00','{"provider":"synthetic"}','{"provider_transfer_id":"tr_step5d_03"}')$q$,
  'duplicate key'
);
select step5d_test.expect_error(
  $q$select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'TRANSFER_UNKNOWN','5d-06-correlation-dup','step5d-service','2026-08-28 02:11:00+00','{"timeout":"synthetic"}','{"provider_correlation_id":"corr_step5d_04"}')$q$,
  'duplicate key'
);
select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'TRANSFERRED','5d-06-transferred','step5d-service','2026-08-28 02:12:00+00','{"provider":"synthetic"}','{"provider_transfer_id":"tr_step5d_06"}');
select step5d_test.expect_error(
  $q$select tlv.transition_canonical_settlement_payout('56000000-0000-4000-8000-000000000006',1,'PAID','5d-06-payout-dup','step5d-service','2026-08-28 02:13:00+00','{"external_payout_confirmed":true}','{"provider_payout_id":"po_step5d_05"}')$q$,
  'duplicate key'
);
reset role;

select step5d_test.assert_true(
  (select provider_transfer_id='tr_step5d_03' from tlv.payout_log where settlement_id='53000000-0000-4000-8000-000000000003')
  and (select provider_transfer_id='tr_step5d_03' from tlv.monthly_settlements where id='53000000-0000-4000-8000-000000000003'),
  'provider transfer owner/derived reference mismatch'
);
select step5d_test.assert_true(
  (select provider_correlation_id='corr_step5d_04' from tlv.payout_log where settlement_id='54000000-0000-4000-8000-000000000004')
  and (select provider_correlation_id='corr_step5d_04' from tlv.monthly_settlements where id='54000000-0000-4000-8000-000000000004'),
  'provider correlation owner/derived reference mismatch'
);
select step5d_test.assert_true(
  (select provider_payout_id='po_step5d_05' from tlv.payout_log where settlement_id='55000000-0000-4000-8000-000000000005')
  and (select provider_payout_id='po_step5d_05' from tlv.monthly_settlements where id='55000000-0000-4000-8000-000000000005'),
  'provider payout owner/derived reference mismatch'
);

-- -------------------------------------------------------------------------
-- Synthetic refund/chargeback bridge: append-only ledger adjustment and
-- payment reversal place canonical holds without mutating canonical payout.
-- -------------------------------------------------------------------------
insert into tlv.viewer_wallets(id,user_id,coin_balance,locked_coin_balance,lifetime_purchased_coins,lifetime_spent_coins,status)
values('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002',500,0,500,200,'active');
insert into tlv.payments(id,payer_user_id,payer_user_uuid,payment_kind,channel,status,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,fee_rate_applied,coins_granted,is_web_payment,external_ref,stripe_payment_intent,stripe_charge_id,paid_at)
values('57000000-0000-4000-8000-000000000003','step5d-synthetic-payer','57000000-0000-4000-8000-000000000002','coin_purchase','web_stripe','succeeded',550,20,530,0.036,500,true,'step5d-synthetic-payment','pi_step5d_synthetic','ch_step5d_synthetic','2026-08-28 03:00:00+00');
insert into tlv.coin_lots(id,wallet_id,user_id,payment_id,lot_source,is_web_payment,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,coins_original,coins_remaining,extension_allowed,expires_at)
values('57000000-0000-4000-8000-000000000004','57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000003','web_stripe',true,550,20,530,500,300,true,'2027-02-28 00:00:00+00');
insert into tlv.streams(id,creator_id,title,status,phase,started_at)
values('57000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','STEP5D synthetic stream','ended','ended','2026-08-28 03:00:00+00');
insert into tlv.tips(id,stream_id,creator_id,payer_user_id,payer_user_uuid,tip_kind,coins_amount,gross_amount_jpy,net_amount_jpy,idempotency_key)
values('57000000-0000-4000-8000-000000000006','57000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','step5d-synthetic-payer','57000000-0000-4000-8000-000000000002','gift',200,212,200,'step5d-synthetic-tip');
insert into tlv.tip_coin_lot_allocations(tip_id,coin_lot_id,coins_allocated,gross_allocated_jpy,net_allocated_jpy,is_web_origin,lot_source)
values('57000000-0000-4000-8000-000000000006','57000000-0000-4000-8000-000000000004',200,212,200,true,'web_stripe');
insert into tlv.payment_provider_events(id,provider,provider_event_id,event_type,status,payment_id,payload_hash,received_at,processed_at)
values('57000000-0000-4000-8000-000000000007','stripe','evt_step5d_refund','charge.refunded','processed','57000000-0000-4000-8000-000000000003',repeat('7',64),'2026-08-28 03:01:00+00','2026-08-28 03:02:00+00');
insert into tlv.revenue_ledger(id,stream_id,creator_id,payment_id,tip_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,notes,occurred_at,payment_provider_event_id,adjustment_kind)
values('57000000-0000-4000-8000-000000000008','57000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000006','adjustment','2026-08',-100,0,-100,0,0,-100,'refund:evt_step5d_refund','2026-08-28 03:01:00+00','57000000-0000-4000-8000-000000000007','REFUND');
insert into tlv.payment_reversals(id,payment_id,provider_event_id,reversal_kind,status,amount_jpy,coins,reason,metadata,created_at)
values('57000000-0000-4000-8000-000000000009','57000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000007','refund','applied',100,100,'step5d synthetic refund','{"synthetic":true}','2026-08-28 03:03:00+00');

select step5d_test.assert_true(
  (select count(*)=5 from tlv.settlement_hold_events
   where idempotency_key like 'payment-reversal:57000000-0000-4000-8000-000000000009:%'
     and settlement_id in (
       '51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
       '53000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004',
       '55000000-0000-4000-8000-000000000005'
     )
     and action='PLACED' and reason_code='REFUND'),
  'canonical refund hold bridge did not cover all Creator-A payout states'
);
select step5d_test.assert_true(
  (select count(*)=5 from tlv.current_settlement_hold_v1
   where settlement_id in (
     '51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
     '53000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004',
     '55000000-0000-4000-8000-000000000005'
   ) and active),
  'canonical hold view not active for all state fixtures'
);
select step5d_test.assert_true(
  (select array_agg(status::text order by month_id) = array['approved','processing','transferred','transfer_unknown','paid']::text[]
   from tlv.payout_log
   where settlement_id in (
     '51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002',
     '53000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004',
     '55000000-0000-4000-8000-000000000005'
   )),
  'canonical hold directly mutated payout status'
);

-- The old direct payout hold shape affects no row because every payout is canonical.
update tlv.payout_log
set status='hold', hold_reason='chargeback', hold_until='2026-09-28 00:00:00+00'
where creator_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and status in ('pending','approved','paid');
select step5d_test.assert_true(
  (select status='approved' from tlv.payout_log where settlement_id='51000000-0000-4000-8000-000000000001')
  and (select status='paid' from tlv.payout_log where settlement_id='55000000-0000-4000-8000-000000000005'),
  'direct hold shape mutated canonical payout'
);

-- -------------------------------------------------------------------------
-- RLS / cross-user / direct mutation denial.
-- -------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{}}',false);
set role authenticated;
select step5d_test.assert_true((select count(*)=0 from tlv.payout_log where creator_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Creator A sees Creator B payout');
select step5d_test.assert_true((select count(*)=0 from tlv.monthly_settlements where creator_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Creator A sees Creator B settlement');
select step5d_test.expect_error($q$update tlv.payout_log set hold_reason='attacker' where creator_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'permission denied');
select step5d_test.expect_error($q$select tlv.create_canonical_settlement_payout('51000000-0000-4000-8000-000000000001','attacker',now())$q$, 'permission denied');
select step5d_test.expect_error($q$select tlv.transition_canonical_settlement_payout('51000000-0000-4000-8000-000000000001',1,'TRANSFER_PENDING','attacker','attacker',now(),'{"x":1}','{}')$q$, 'permission denied');
reset role;
set role anon;
select step5d_test.expect_error($q$select * from tlv.payout_log$q$, 'permission denied');
select step5d_test.expect_error($q$select * from tlv.monthly_settlements$q$, 'permission denied');
reset role;

select step5d_test.assert_true(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='tlv.payout_log'::regclass)
  and (select relrowsecurity and relforcerowsecurity from pg_class where oid='tlv.monthly_settlements'::regclass),
  'FORCE RLS lost'
);

select 'STEP5D_DB_VERIFY_PASS' as result;
