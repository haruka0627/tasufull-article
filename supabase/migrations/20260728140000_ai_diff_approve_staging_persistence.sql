-- Diff & Approve — Staging Persistence Foundation
-- SSOT: A1–A11 contracts · Ownership follows AI Execution Gate B2 (service_role only)
-- Staging-oriented · Production apply No-Go · No real Apply / Provider / Rollback
-- Tables (4): ai_diff_approve_proposals · ai_diff_approve_records
--             ai_diff_approve_events · ai_diff_approve_idempotency
-- Design: event+aggregate (mirrors ai_execution_requests + events + results)

-- ---------------------------------------------------------------------------
-- updated_at helper (domain-scoped)
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ai_diff_approve_set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Append-only forbid (events)
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_forbid_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ai_diff_approve_events is append-only';
end;
$$;

revoke all on function public.ai_diff_approve_forbid_event_mutation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Idempotency overwrite forbid
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_forbid_idempotency_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ai_diff_approve_idempotency is insert-only (no overwrite)';
end;
$$;

revoke all on function public.ai_diff_approve_forbid_idempotency_update()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A. ai_diff_approve_proposals — aggregate SSOT
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_proposals (
  proposal_id uuid primary key,
  request_id uuid null,
  execution_id uuid null,
  capability text not null default 'diff_approve',
  resource_type text not null default 'unknown',
  resource_id text not null default '',
  owner_user_id uuid null references auth.users (id) on delete set null,
  status text not null default 'draft',
  schema_version text not null default 'diff_approve.a7.persistence.v1',
  record_version integer not null default 1,
  environment text not null default 'staging',
  -- Apply-forbidden invariants (static · never flip true via this foundation)
  applied boolean not null default false,
  executed boolean not null default false,
  provider_called boolean not null default false,
  transmit boolean not null default false,
  recorded_api_cost numeric not null default 0,
  network_called boolean not null default false,
  production_written boolean not null default false,
  rollback_executed boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_diff_prop_environment_staging check (environment = 'staging'),
  constraint ai_diff_prop_status_len check (char_length(status) between 1 and 64),
  constraint ai_diff_prop_schema_version_len check (
    char_length(schema_version) between 1 and 128
  ),
  constraint ai_diff_prop_record_version_pos check (record_version >= 1),
  constraint ai_diff_prop_capability_len check (
    char_length(capability) between 1 and 128
  ),
  constraint ai_diff_prop_resource_type_len check (
    char_length(resource_type) between 1 and 128
  ),
  constraint ai_diff_prop_resource_id_len check (char_length(resource_id) <= 256),
  constraint ai_diff_prop_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint ai_diff_prop_applied_false check (applied = false),
  constraint ai_diff_prop_executed_false check (executed = false),
  constraint ai_diff_prop_provider_false check (provider_called = false),
  constraint ai_diff_prop_transmit_false check (transmit = false),
  constraint ai_diff_prop_cost_zero check (recorded_api_cost = 0),
  constraint ai_diff_prop_network_false check (network_called = false),
  constraint ai_diff_prop_production_false check (production_written = false),
  constraint ai_diff_prop_rollback_false check (rollback_executed = false)
);

comment on table public.ai_diff_approve_proposals is
  'Diff & Approve staging aggregate SSOT · service_role only · Production apply No-Go · applied/executed always false';

comment on column public.ai_diff_approve_proposals.owner_user_id is
  'Application ownership hint · RLS deny-all (B2 model) · Edge must enforce isolation';

create index if not exists idx_ai_diff_prop_owner_created
  on public.ai_diff_approve_proposals (owner_user_id, created_at desc)
  where owner_user_id is not null;

create index if not exists idx_ai_diff_prop_request
  on public.ai_diff_approve_proposals (request_id)
  where request_id is not null;

create index if not exists idx_ai_diff_prop_execution
  on public.ai_diff_approve_proposals (execution_id)
  where execution_id is not null;

create index if not exists idx_ai_diff_prop_status_created
  on public.ai_diff_approve_proposals (status, created_at desc);

drop trigger if exists trg_ai_diff_prop_updated_at on public.ai_diff_approve_proposals;
create trigger trg_ai_diff_prop_updated_at
  before update on public.ai_diff_approve_proposals
  for each row
  execute function public.ai_diff_approve_set_updated_at();

alter table public.ai_diff_approve_proposals enable row level security;

drop policy if exists ai_diff_prop_deny_all on public.ai_diff_approve_proposals;
create policy ai_diff_prop_deny_all
  on public.ai_diff_approve_proposals
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_proposals
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.ai_diff_approve_proposals to service_role;

-- ---------------------------------------------------------------------------
-- B. ai_diff_approve_records — versioned typed A7 payloads
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id text not null,
  proposal_id uuid null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  execution_id uuid null,
  owner_user_id uuid null references auth.users (id) on delete set null,
  schema_version text not null default 'diff_approve.a7.persistence.v1',
  record_version integer not null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_diff_rec_type_check check (
    record_type in (
      'proposal',
      'approval',
      'apply_readiness',
      'apply_validation',
      'simulation',
      'final_gate',
      'audit'
    )
  ),
  constraint ai_diff_rec_unique unique (record_type, record_id),
  constraint ai_diff_rec_record_id_len check (char_length(record_id) between 1 and 200),
  constraint ai_diff_rec_schema_version_len check (
    char_length(schema_version) between 1 and 128
  ),
  constraint ai_diff_rec_version_pos check (record_version >= 1),
  constraint ai_diff_rec_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint ai_diff_rec_payload_hash_len check (
    payload_hash is null or char_length(payload_hash) between 8 and 128
  ),
  -- Idempotency lives in dedicated table (not record_type=idempotency)
  constraint ai_diff_rec_no_idempotency_type check (record_type <> 'idempotency')
);

comment on table public.ai_diff_approve_records is
  'Diff & Approve versioned A7 records · optimistic concurrency via record_version · no DELETE grant';

create index if not exists idx_ai_diff_rec_proposal
  on public.ai_diff_approve_records (proposal_id, record_type)
  where proposal_id is not null;

create index if not exists idx_ai_diff_rec_owner
  on public.ai_diff_approve_records (owner_user_id)
  where owner_user_id is not null;

drop trigger if exists trg_ai_diff_rec_updated_at on public.ai_diff_approve_records;
create trigger trg_ai_diff_rec_updated_at
  before update on public.ai_diff_approve_records
  for each row
  execute function public.ai_diff_approve_set_updated_at();

alter table public.ai_diff_approve_records enable row level security;

drop policy if exists ai_diff_rec_deny_all on public.ai_diff_approve_records;
create policy ai_diff_rec_deny_all
  on public.ai_diff_approve_records
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_records
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.ai_diff_approve_records to service_role;

-- ---------------------------------------------------------------------------
-- C. ai_diff_approve_events — append-only audit / timeline + hash chain
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  execution_id uuid null,
  owner_user_id uuid null references auth.users (id) on delete set null,
  sequence_number integer not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  previous_event_hash text not null,
  event_hash text not null,
  created_at timestamptz not null default now(),

  constraint ai_diff_evt_sequence_pos check (sequence_number >= 1),
  constraint ai_diff_evt_sequence_unique unique (proposal_id, sequence_number),
  constraint ai_diff_evt_event_type_len check (
    char_length(event_type) between 1 and 128
  ),
  constraint ai_diff_evt_payload_object check (
    jsonb_typeof(event_payload) = 'object'
  ),
  constraint ai_diff_evt_prev_hash_len check (
    char_length(previous_event_hash) between 1 and 128
  ),
  constraint ai_diff_evt_hash_len check (char_length(event_hash) between 8 and 128),
  constraint ai_diff_evt_hash_unique unique (proposal_id, event_hash)
);

comment on table public.ai_diff_approve_events is
  'Diff & Approve append-only audit · A10 hash fields · no UPDATE/DELETE grants · trigger forbid';

create index if not exists idx_ai_diff_evt_proposal_seq
  on public.ai_diff_approve_events (proposal_id, sequence_number);

create index if not exists idx_ai_diff_evt_created
  on public.ai_diff_approve_events (created_at desc);

drop trigger if exists trg_ai_diff_evt_no_update on public.ai_diff_approve_events;
create trigger trg_ai_diff_evt_no_update
  before update on public.ai_diff_approve_events
  for each row
  execute function public.ai_diff_approve_forbid_event_mutation();

drop trigger if exists trg_ai_diff_evt_no_delete on public.ai_diff_approve_events;
create trigger trg_ai_diff_evt_no_delete
  before delete on public.ai_diff_approve_events
  for each row
  execute function public.ai_diff_approve_forbid_event_mutation();

alter table public.ai_diff_approve_events enable row level security;

drop policy if exists ai_diff_evt_deny_all on public.ai_diff_approve_events;
create policy ai_diff_evt_deny_all
  on public.ai_diff_approve_events
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.ai_diff_approve_events to service_role;

-- ---------------------------------------------------------------------------
-- D. ai_diff_approve_idempotency — insert-only claim map
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_idempotency (
  idempotency_key text primary key,
  token text not null,
  proposal_id uuid null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  execution_id uuid null,
  operation_type text null,
  owner_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint ai_diff_idem_key_len check (
    char_length(idempotency_key) between 8 and 200
  ),
  constraint ai_diff_idem_token_len check (char_length(token) between 1 and 200),
  constraint ai_diff_idem_op_len check (
    operation_type is null or char_length(operation_type) between 1 and 128
  )
);

comment on table public.ai_diff_approve_idempotency is
  'Diff & Approve idempotency claims · UNIQUE key · no UPDATE/DELETE · conflict = duplicate';

-- Optional composite uniqueness for proposal+operation when both set
create unique index if not exists idx_ai_diff_idem_proposal_op
  on public.ai_diff_approve_idempotency (proposal_id, operation_type)
  where proposal_id is not null and operation_type is not null;

create unique index if not exists idx_ai_diff_idem_execution_op
  on public.ai_diff_approve_idempotency (execution_id, operation_type)
  where execution_id is not null and operation_type is not null;

drop trigger if exists trg_ai_diff_idem_no_update on public.ai_diff_approve_idempotency;
create trigger trg_ai_diff_idem_no_update
  before update on public.ai_diff_approve_idempotency
  for each row
  execute function public.ai_diff_approve_forbid_idempotency_update();

drop trigger if exists trg_ai_diff_idem_no_delete on public.ai_diff_approve_idempotency;
create trigger trg_ai_diff_idem_no_delete
  before delete on public.ai_diff_approve_idempotency
  for each row
  execute function public.ai_diff_approve_forbid_idempotency_update();

alter table public.ai_diff_approve_idempotency enable row level security;

drop policy if exists ai_diff_idem_deny_all on public.ai_diff_approve_idempotency;
create policy ai_diff_idem_deny_all
  on public.ai_diff_approve_idempotency
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_idempotency
  from public, anon, authenticated, service_role;
grant select, insert on table public.ai_diff_approve_idempotency to service_role;

-- ---------------------------------------------------------------------------
-- E. Transactional write RPC (service_role · fail-closed)
-- Adapter hashes events (A10 FNV-1a); DB verifies sequence + previous hash chain.
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_write_step(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record jsonb;
  v_event jsonb;
  v_idem_key text;
  v_idem_token text;
  v_record_type text;
  v_record_id text;
  v_proposal_id uuid;
  v_execution_id uuid;
  v_owner uuid;
  v_schema_version text;
  v_record_version integer;
  v_payload jsonb;
  v_payload_hash text;
  v_existing public.ai_diff_approve_records%rowtype;
  v_last_seq integer;
  v_last_hash text;
  v_seq integer;
  v_prev_hash text;
  v_event_hash text;
  v_event_type text;
  v_event_payload jsonb;
  v_op_type text;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_record', 'reason', 'invalid_record');
  end if;

  -- Reject prototype pollution keys at top level
  if p_input ? '__proto__' or p_input ? 'prototype' or p_input ? 'constructor' then
    return jsonb_build_object('ok', false, 'error', 'extra_fields', 'reason', 'extra_fields');
  end if;

  v_record := p_input -> 'record';
  v_event := p_input -> 'event';
  v_idem_key := nullif(trim(p_input ->> 'idempotency_key'), '');
  v_idem_token := nullif(trim(p_input ->> 'idempotency_token'), '');
  v_op_type := nullif(trim(p_input ->> 'operation_type'), '');

  if v_record is null or jsonb_typeof(v_record) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_record', 'reason', 'invalid_record');
  end if;

  if v_record ? '__proto__' or v_record ? 'prototype' or v_record ? 'constructor' then
    return jsonb_build_object('ok', false, 'error', 'extra_fields', 'reason', 'extra_fields');
  end if;

  v_record_type := v_record ->> 'record_type';
  v_record_id := v_record ->> 'record_id';
  v_schema_version := coalesce(v_record ->> 'schema_version', 'diff_approve.a7.persistence.v1');
  v_record_version := (v_record ->> 'record_version')::integer;
  v_payload := coalesce(v_record -> 'payload', '{}'::jsonb);
  v_payload_hash := nullif(trim(v_record ->> 'payload_hash'), '');

  begin
    v_proposal_id := nullif(v_record ->> 'proposal_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_record', 'reason', 'invalid_record');
  end;

  begin
    v_execution_id := nullif(v_record ->> 'execution_id', '')::uuid;
  exception when others then
    v_execution_id := null;
  end;

  begin
    v_owner := nullif(trim(p_input ->> 'owner_user_id'), '')::uuid;
  exception when others then
    v_owner := null;
  end;
  if v_owner is null then
    begin
      v_owner := nullif(trim(v_record ->> 'owner_user_id'), '')::uuid;
    exception when others then
      v_owner := null;
    end;
  end if;

  if v_record_type is null
     or v_record_type not in (
       'proposal', 'approval', 'apply_readiness', 'apply_validation',
       'simulation', 'final_gate', 'audit'
     )
     or v_record_id is null or char_length(v_record_id) = 0
     or v_record_version is null or v_record_version < 1
     or jsonb_typeof(v_payload) <> 'object'
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_record', 'reason', 'invalid_record');
  end if;

  -- Ensure proposal aggregate exists when proposal_id present
  if v_proposal_id is not null then
    insert into public.ai_diff_approve_proposals (
      proposal_id, execution_id, owner_user_id, schema_version, record_version, status, payload
    )
    values (
      v_proposal_id,
      v_execution_id,
      v_owner,
      v_schema_version,
      1,
      coalesce(nullif(v_payload ->> 'status', ''), 'draft'),
      case when v_record_type = 'proposal' then v_payload else '{}'::jsonb end
    )
    on conflict (proposal_id) do nothing;
  end if;

  -- Idempotency claim (before record write)
  if v_idem_key is not null then
    if v_idem_token is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_context', 'reason', 'invalid_context');
    end if;
    begin
      insert into public.ai_diff_approve_idempotency (
        idempotency_key, token, proposal_id, execution_id, operation_type, owner_user_id
      ) values (
        v_idem_key, v_idem_token, v_proposal_id, v_execution_id, v_op_type, v_owner
      );
    exception
      when unique_violation then
        return jsonb_build_object(
          'ok', false,
          'error', 'duplicate_key',
          'reason', 'duplicate_key',
          'existing', (
            select token from public.ai_diff_approve_idempotency
            where idempotency_key = v_idem_key
          )
        );
    end;
  end if;

  select * into v_existing
  from public.ai_diff_approve_records
  where record_type = v_record_type and record_id = v_record_id
  for update;

  if found then
    if v_existing.record_version >= v_record_version then
      return jsonb_build_object('ok', false, 'error', 'duplicate_key', 'reason', 'duplicate_key');
    end if;
    if v_existing.record_version <> (v_record_version - 1) then
      return jsonb_build_object('ok', false, 'error', 'stale_version', 'reason', 'stale_version');
    end if;
    update public.ai_diff_approve_records
    set
      proposal_id = coalesce(v_proposal_id, proposal_id),
      execution_id = coalesce(v_execution_id, execution_id),
      owner_user_id = coalesce(v_owner, owner_user_id),
      schema_version = v_schema_version,
      record_version = v_record_version,
      payload = v_payload,
      payload_hash = coalesce(v_payload_hash, payload_hash),
      updated_at = now()
    where record_type = v_record_type and record_id = v_record_id;
  else
    if v_record_version <> 1 then
      return jsonb_build_object('ok', false, 'error', 'stale_version', 'reason', 'stale_version');
    end if;
    insert into public.ai_diff_approve_records (
      record_type, record_id, proposal_id, execution_id, owner_user_id,
      schema_version, record_version, payload, payload_hash
    ) values (
      v_record_type, v_record_id, v_proposal_id, v_execution_id, v_owner,
      v_schema_version, v_record_version, v_payload, v_payload_hash
    );
  end if;

  -- Sync proposal aggregate when writing proposal record
  if v_record_type = 'proposal' and v_proposal_id is not null then
    update public.ai_diff_approve_proposals
    set
      execution_id = coalesce(v_execution_id, execution_id),
      owner_user_id = coalesce(v_owner, owner_user_id),
      schema_version = v_schema_version,
      record_version = v_record_version,
      status = coalesce(nullif(v_payload ->> 'status', ''), status),
      payload = v_payload,
      updated_at = now()
    where proposal_id = v_proposal_id;
  end if;

  -- Optional audit append with chain checks
  if v_event is not null and jsonb_typeof(v_event) = 'object' then
    if v_proposal_id is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_context', 'reason', 'invalid_context');
    end if;
    v_seq := (v_event ->> 'sequence_number')::integer;
    v_event_type := v_event ->> 'event_type';
    v_prev_hash := v_event ->> 'previous_event_hash';
    v_event_hash := v_event ->> 'event_hash';
    v_event_payload := coalesce(v_event -> 'event_payload', '{}'::jsonb);

    if v_seq is null or v_seq < 1
       or v_event_type is null or char_length(v_event_type) = 0
       or v_prev_hash is null or v_event_hash is null
       or jsonb_typeof(v_event_payload) <> 'object'
    then
      return jsonb_build_object('ok', false, 'error', 'invalid_record', 'reason', 'invalid_record');
    end if;

    select sequence_number, event_hash
      into v_last_seq, v_last_hash
    from public.ai_diff_approve_events
    where proposal_id = v_proposal_id
    order by sequence_number desc
    limit 1;

    if not found then
      if v_seq <> 1 or v_prev_hash <> 'genesis' then
        return jsonb_build_object('ok', false, 'error', 'invalid_context', 'reason', 'out_of_order');
      end if;
    else
      if v_seq <> (v_last_seq + 1) then
        return jsonb_build_object('ok', false, 'error', 'invalid_context', 'reason', 'out_of_order');
      end if;
      if v_prev_hash <> v_last_hash then
        return jsonb_build_object('ok', false, 'error', 'invalid_context', 'reason', 'audit_chain_mismatch');
      end if;
    end if;

    begin
      insert into public.ai_diff_approve_events (
        proposal_id, execution_id, owner_user_id, sequence_number, event_type,
        event_payload, previous_event_hash, event_hash
      ) values (
        v_proposal_id, v_execution_id, v_owner, v_seq, v_event_type,
        v_event_payload, v_prev_hash, v_event_hash
      );
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'duplicate_key', 'reason', 'duplicate_key');
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', 'stored',
    'record_type', v_record_type,
    'record_id', v_record_id,
    'record_version', v_record_version,
    'proposal_id', v_proposal_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'serialize_failed',
      'reason', 'serialize_failed',
      'detail', SQLERRM
    );
end;
$$;

revoke all on function public.ai_diff_approve_write_step(jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_diff_approve_write_step(jsonb) to service_role;

comment on function public.ai_diff_approve_write_step(jsonb) is
  'Diff & Approve transactional put+idempotency+audit · service_role only · no Apply';

-- ---------------------------------------------------------------------------
-- Verification queries (re-runnable · do not mutate)
-- ---------------------------------------------------------------------------
-- select to_regclass('public.ai_diff_approve_proposals') is not null;
-- select to_regclass('public.ai_diff_approve_records') is not null;
-- select to_regclass('public.ai_diff_approve_events') is not null;
-- select to_regclass('public.ai_diff_approve_idempotency') is not null;
-- select relrowsecurity from pg_class where relname = 'ai_diff_approve_proposals';
-- select polname from pg_policy where polrelid = 'public.ai_diff_approve_proposals'::regclass;
-- select has_table_privilege('anon', 'public.ai_diff_approve_proposals', 'select') as anon_select; -- expect false
-- select has_table_privilege('authenticated', 'public.ai_diff_approve_events', 'update') as auth_upd; -- expect false
-- select has_table_privilege('service_role', 'public.ai_diff_approve_events', 'delete') as srv_del; -- expect false

-- End Diff & Approve staging persistence foundation
