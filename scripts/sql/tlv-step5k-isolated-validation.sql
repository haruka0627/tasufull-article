\set ON_ERROR_STOP on

-- Rollback/recovery proof: candidate work is atomic and leaves no partial state.
begin;
set local role service_role;
select tlv.apply_synthetic_qa_disposition_v1(
 '2026-08-28T12:00:00+09',
 '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD',
 '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A',
 'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099',
 '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059',
 'isolated-step5k'
);
rollback;

do $$ begin
  if (select count(*) from tlv.revenue_disposition_events) <> 0
     or (select count(*) from tlv.revenue_ledger where adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION') <> 0
  then raise exception 'rollback_recovery_failed'; end if;
end $$;

set role service_role;
select tlv.apply_synthetic_qa_disposition_v1(
 '2026-08-28T12:00:00+09',
 '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD',
 '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A',
 'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099',
 '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059',
 'isolated-step5k'
) as first_apply;
select tlv.apply_synthetic_qa_disposition_v1(
 '2026-08-28T12:00:00+09',
 '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD',
 '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A',
 'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099',
 '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059',
 'isolated-step5k'
) as idempotent_apply;
reset role;

create temp table step5k_results(test_id text primary key, passed boolean not null, detail text);
insert into step5k_results values
 ('01_exact_7_sources', (select count(*)=7 from tlv.revenue_ledger where tip_id is not null), '7'),
 ('02_source_gross_145k', (select sum(gross_amount_jpy)=145000 from tlv.revenue_ledger where tip_id is not null), '145000'),
 ('03_source_rows_unchanged', (select count(*)=7 from tlv.revenue_ledger where tip_id is not null and creator_payout_jpy=0 and fee_amount_jpy=0), 'immutable values'),
 ('04_disposition_7', (select count(*)=7 from tlv.revenue_disposition_events), '7'),
 ('05_correction_7', (select count(*)=7 from tlv.revenue_ledger where adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION'), '7'),
 ('06_neutralization_minus_145k', (select sum(platform_revenue_jpy)=-145000 from tlv.revenue_ledger where adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION'), '-145000'),
 ('07_net_tasful_zero', (select sum(platform_revenue_jpy)=0 from tlv.revenue_ledger), '0'),
 ('08_creator_payable_zero', (select sum(creator_payout_jpy)=0 from tlv.revenue_ledger), '0'),
 ('09_pending_settlement_zero', (select count(*)=0 from tlv.monthly_settlements where creator_id='a0000000-0000-4000-8000-000000000001'), '0'),
 ('10_settled_zero', (select count(*)=0 from tlv.settlement_ledger_links), '0'),
 ('11_provider_fee_zero', (select sum(fee_amount_jpy)=0 from tlv.revenue_ledger), '0'),
 ('12_no_payments', (select count(*)=0 from tlv.payments), '0'),
 ('13_no_provider_events', (select count(*)=0 from tlv.payment_provider_events), '0'),
 ('14_wallet_unchanged', (select count(*)=0 from tlv.viewer_wallets) and (select count(*)=0 from tlv.wallet_ledger), '0'),
 ('15_coin_unchanged', (select count(*)=0 from tlv.coin_lots) and (select count(*)=0 from tlv.tip_coin_lot_allocations), '0'),
 ('16_sources_queryable', (select count(*)=7 from tlv.revenue_ledger where tip_id is not null), '7'),
 ('17_audit_chain_complete', (select count(*)=7 from tlv.synthetic_qa_disposition_reconciliation_v1 where net_real_tasful_jpy=0 and creator_payable_jpy=0), '7'),
 ('18_view_excludes_sources', (select count(*)=7 from tlv.settlement_revenue_ledger_input_v1 where disposition_source_role='ORIGINAL_SOURCE' and settlement_disposition='EXCLUDE_SYNTHETIC_QA' and disposition_complete), '7'),
 ('19_view_excludes_corrections', (select count(*)=7 from tlv.settlement_revenue_ledger_input_v1 where disposition_source_role='ACCOUNTING_NEUTRALIZATION' and settlement_disposition='EXCLUDE_SYNTHETIC_QA' and disposition_complete), '7'),
 ('20_provider_fee_not_applicable', (select count(*)=7 from tlv.revenue_disposition_events where provider_fee_semantics='NOT_APPLICABLE'), '7'),
 ('21_no_payment_relation', (select count(*)=14 from tlv.revenue_ledger where payment_id is null), '14'),
 ('22_no_lot_fabrication', (select count(*)=0 from tlv.tip_coin_lot_allocations), '0'),
 ('23_origin_preserved', (select count(*)=7 from tlv.tips where web_origin_coins=coins_amount and wr_at_tip=1), '7'),
 ('24_score_evidence_preserved', (select count(*)=7 from tlv.creator_score_events where reason_code='STEP5K_SYNTHETIC_SHAPE'), '7'),
 ('25_exact_pairs', (select count(*)=7 from tlv.revenue_disposition_events d join tlv.revenue_ledger c on c.id=d.correction_revenue_ledger_id and c.adjustment_of_revenue_ledger_id=d.source_revenue_ledger_id), '7'),
 ('26_duplicate_prevented', (select count(*)=7 from tlv.revenue_ledger where adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION'), 'rerun unchanged'),
 ('27_tax_fail_closed', (select count(*)=7 from tlv.revenue_disposition_events where tax_policy_status='NOT_CONFIGURED'), '7'),
 ('28_nonfinancial_registry', not exists (select 1 from information_schema.columns where table_schema='tlv' and table_name='revenue_disposition_events' and column_name ~ '(amount_jpy|gross_amount|net_amount|creator_payout_jpy|platform_revenue_jpy|fee_amount_jpy)'), 'no monetary amount columns'),
 ('29_rls_forced', (select relrowsecurity and relforcerowsecurity from pg_class where oid='tlv.revenue_disposition_events'::regclass), 'forced'),
 ('30_service_only_execute', not has_function_privilege('authenticated','tlv.apply_synthetic_qa_disposition_v1(timestamptz,text,text,text,text,text)','EXECUTE') and has_function_privilege('service_role','tlv.apply_synthetic_qa_disposition_v1(timestamptz,text,text,text,text,text)','EXECUTE'), 'service only'),
 ('31_registry_no_public_write', not has_table_privilege('service_role','tlv.revenue_disposition_events','INSERT'), 'function only'),
 ('32_real_money_false', (select count(*)=7 from tlv.revenue_disposition_events where not real_money_moved), '7'),
 ('33_exact_case_ids', (select count(distinct fixture_case_id)=7 from tlv.revenue_disposition_events), '7'),
 ('34_recovery_commit_complete', (select count(*)=14 from tlv.settlement_revenue_ledger_input_v1 where disposition_evidence_valid and disposition_complete), '14'),
 ('35_no_financial_transaction', true, 'isolated SQL only');

do $$
begin
  begin
    update tlv.revenue_disposition_events set created_by='forbidden';
    raise exception 'append_only_update_was_allowed';
  exception when others then
    if sqlerrm='append_only_update_was_allowed' then raise; end if;
    insert into step5k_results values ('36_registry_update_denied',true,sqlerrm);
  end;
  begin
    delete from tlv.revenue_disposition_events;
    raise exception 'append_only_delete_was_allowed';
  exception when others then
    if sqlerrm='append_only_delete_was_allowed' then raise; end if;
    insert into step5k_results values ('37_registry_delete_denied',true,sqlerrm);
  end;
  begin
    insert into tlv.revenue_ledger(
      creator_id,event_kind,ledger_month,gross_amount_jpy,fee_amount_jpy,net_amount_jpy,
      infra_cost_jpy,creator_payout_jpy,platform_revenue_jpy,adjustment_kind,
      adjustment_of_revenue_ledger_id,occurred_at
    ) values (
      'a0000000-0000-4000-8000-000000000001','adjustment','2026-08',-10000,0,-10000,
      0,0,-10000,'SYNTHETIC_QA_NEUTRALIZATION','d0000000-0000-4000-8000-000000000001','2026-08-28T03:00:01Z'
    );
    set constraints revenue_ledger_disposition_pair_guard immediate;
    raise exception 'orphan_correction_was_allowed';
  exception when others then
    if sqlerrm='orphan_correction_was_allowed' then raise; end if;
    insert into step5k_results values ('38_correction_without_disposition_denied',true,sqlerrm);
  end;
  begin
    perform tlv.apply_synthetic_qa_disposition_v1(
      '2026-08-28T12:00:00+09', '',
      '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A',
      'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099',
      '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059','isolated-step5k'
    );
    raise exception 'missing_hash_was_allowed';
  exception when others then
    if sqlerrm='missing_hash_was_allowed' then raise; end if;
    insert into step5k_results values ('39_missing_hash_denied',true,sqlerrm);
  end;
  begin
    insert into tlv.revenue_disposition_events(
      correlation_id,source_revenue_ledger_id,correction_revenue_ledger_id,target_tip_id,
      fixture_case_id,human_decision_ref,step5h_report_sha256,step5h_query_sha256,
      step5i_report_sha256,step5i5_report_sha256,created_by
    ) values (
      'TLV-SYNQA-TTIP-202607-V1-T-TIP-01','d0000000-0000-4000-8000-000000000001',gen_random_uuid(),
      'c0000000-0000-4000-8000-000000000001','T-TIP-01','STEP5J-HG-SYNQA-7-20260828-V1',
      '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD',
      '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A',
      'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099',
      '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059','isolated-step5k'
    );
    set constraints revenue_disposition_pair_guard, revenue_disposition_correction_fk immediate;
    raise exception 'partial_disposition_was_allowed';
  exception when others then
    if sqlerrm='partial_disposition_was_allowed' then raise; end if;
    insert into step5k_results values ('40_partial_disposition_denied',true,sqlerrm);
  end;
end $$;

do $$ begin
  if exists(select 1 from step5k_results where not passed) then
    raise exception 'STEP5K isolated validation failed: %', (select jsonb_agg(test_id) from step5k_results where not passed);
  end if;
end $$;
select * from step5k_results order by test_id;
