-- Cleanup staging persistence probe rows (disable append-only triggers temporarily)
alter table public.ai_diff_approve_events disable trigger trg_ai_diff_evt_no_delete;
alter table public.ai_diff_approve_idempotency disable trigger trg_ai_diff_idem_no_delete;

delete from public.ai_diff_approve_events
where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

delete from public.ai_diff_approve_idempotency
where idempotency_key like 'stg-test-idem-%'
   or proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

delete from public.ai_diff_approve_records
where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
   or record_id like 'stg-test-rec-%';

delete from public.ai_diff_approve_proposals
where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

alter table public.ai_diff_approve_events enable trigger trg_ai_diff_evt_no_delete;
alter table public.ai_diff_approve_idempotency enable trigger trg_ai_diff_idem_no_delete;

select
  (select count(*) from public.ai_diff_approve_proposals where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee') as left_proposals,
  (select count(*) from public.ai_diff_approve_records where record_id like 'stg-test-rec-%') as left_records,
  (select count(*) from public.ai_diff_approve_events where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee') as left_events,
  (select count(*) from public.ai_diff_approve_idempotency where idempotency_key like 'stg-test-idem-%') as left_idem;
