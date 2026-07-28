-- Staging probe for Diff & Approve persistence (isolated namespace + cleanup)
-- proposal_id: aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee

select public.ai_diff_approve_write_step(jsonb_build_object(
  'idempotency_key', 'stg-test-idem-0001',
  'idempotency_token', 'tok-a',
  'operation_type', 'create_proposal',
  'record', jsonb_build_object(
    'schema_version', 'diff_approve.a7.persistence.v1',
    'record_type', 'proposal',
    'record_id', 'stg-test-rec-proposal',
    'proposal_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'payload', jsonb_build_object('status', 'draft', 'ns', 'staging_persistence_probe'),
    'record_version', 1,
    'payload_hash', 'fnv1a32:deadbeef'
  ),
  'event', jsonb_build_object(
    'sequence_number', 1,
    'event_type', 'proposal_created',
    'event_payload', jsonb_build_object('ns', 'staging_persistence_probe'),
    'previous_event_hash', 'genesis',
    'event_hash', 'fnv1a32:cafebabe'
  )
)) as step1;

-- duplicate idempotency
select public.ai_diff_approve_write_step(jsonb_build_object(
  'idempotency_key', 'stg-test-idem-0001',
  'idempotency_token', 'tok-b',
  'record', jsonb_build_object(
    'schema_version', 'diff_approve.a7.persistence.v1',
    'record_type', 'proposal',
    'record_id', 'stg-test-rec-proposal',
    'proposal_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'payload', jsonb_build_object('status', 'draft'),
    'record_version', 2
  )
)) as dup_idem;

-- stale version
select public.ai_diff_approve_write_step(jsonb_build_object(
  'record', jsonb_build_object(
    'schema_version', 'diff_approve.a7.persistence.v1',
    'record_type', 'proposal',
    'record_id', 'stg-test-rec-proposal',
    'proposal_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'payload', jsonb_build_object('status', 'draft'),
    'record_version', 5
  )
)) as stale;

-- optimistic v2 + audit seq2
select public.ai_diff_approve_write_step(jsonb_build_object(
  'record', jsonb_build_object(
    'schema_version', 'diff_approve.a7.persistence.v1',
    'record_type', 'proposal',
    'record_id', 'stg-test-rec-proposal',
    'proposal_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'payload', jsonb_build_object('status', 'pending_approval', 'ns', 'staging_persistence_probe'),
    'record_version', 2,
    'payload_hash', 'fnv1a32:beefcafe'
  ),
  'event', jsonb_build_object(
    'sequence_number', 2,
    'event_type', 'proposal_submitted',
    'event_payload', jsonb_build_object('ns', 'staging_persistence_probe'),
    'previous_event_hash', 'fnv1a32:cafebabe',
    'event_hash', 'fnv1a32:11112222'
  )
)) as step2;

-- chain mismatch should fail
select public.ai_diff_approve_write_step(jsonb_build_object(
  'record', jsonb_build_object(
    'schema_version', 'diff_approve.a7.persistence.v1',
    'record_type', 'approval',
    'record_id', 'stg-test-rec-approval',
    'proposal_id', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'payload', jsonb_build_object('decision', 'approved'),
    'record_version', 1
  ),
  'event', jsonb_build_object(
    'sequence_number', 3,
    'event_type', 'approval_granted',
    'event_payload', jsonb_build_object('ns', 'staging_persistence_probe'),
    'previous_event_hash', 'WRONG_HASH',
    'event_hash', 'fnv1a32:33334444'
  )
)) as chain_fail;

select count(*) as event_count
from public.ai_diff_approve_events
where proposal_id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

select record_version, payload->>'status' as status
from public.ai_diff_approve_records
where record_id = 'stg-test-rec-proposal';
