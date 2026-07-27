-- AI Execution Gate — Phase B2 schema (Staging-oriented · Production apply No-Go)
-- Phase: B2 · SSOT: docs/AI/AI_EXECUTION_GATE.md (FREEZE) · PHASE_B_PLAN · B1 constants
-- Tables (3): ai_execution_requests · ai_execution_events · ai_execution_results
-- Feature Flag / Emergency Stop control SSOT = B1 env only (not DB tables).
-- Request columns feature_flag_* / emergency_stop_* are audit snapshots of B1 evaluation.
-- No ai_feature_flags / ai_emergency_controls (dual control plane forbidden in Phase B).
-- Single execution model · No child executions · No capability DB seed
-- No SAFE-06/07 coupling · No Gate API/RPC · No B3 executor
-- Write path: service_role only (browser / anon / authenticated direct access forbidden)

-- ---------------------------------------------------------------------------
-- updated_at helper (domain-scoped · do not reuse other product helpers)
-- ---------------------------------------------------------------------------
create or replace function public.ai_exec_gate_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ai_exec_gate_set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A. ai_execution_requests — single execution SSOT
-- ---------------------------------------------------------------------------
create table if not exists public.ai_execution_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  user_id uuid null references auth.users (id) on delete set null,

  environment text not null,
  target_service text not null,
  action_type text not null,
  capability_key text not null,
  capability_version text not null default '1',

  action_payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  sanitized_metadata jsonb not null default '{}'::jsonb,

  risk_level text not null default 'LOW',
  business_priority text not null default 'NORMAL',
  urgency text null,
  execution_mode text not null default 'AUTO',

  execution_status text not null default 'draft',
  preflight_decision text null,
  blocked_reason text null,

  estimated_api_cost numeric not null default 0,
  recorded_api_cost numeric null,
  budget_limit_snapshot numeric null,
  budget_currency text not null default 'USD',
  budget_day_key text null,

  feature_flag_key text null,
  feature_flag_state text null,
  feature_flag_enabled boolean null,
  emergency_stop_active boolean null,
  emergency_stop_snapshot jsonb not null default '{}'::jsonb,
  policy_version text null,

  idempotency_key text not null,
  correlation_id text null,
  causation_id text null,
  parent_execution_id uuid null,

  actor_type text not null default 'human',
  actor_id text not null,
  actor_instance_id text null,
  initiator_type text not null default 'human',
  initiator_id text not null,
  delegated_by_actor_type text null,
  delegated_by_actor_id text null,

  execution_attempts integer not null default 0,
  max_attempts integer not null default 1,
  timeout_ms integer null,

  executor_name text null,
  executor_version text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  queued_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  blocked_at timestamptz null,
  failed_at timestamptz null,
  cancelled_at timestamptz null,

  constraint ai_exec_req_environment_check check (
    environment in ('staging', 'production', 'unknown')
  ),
  constraint ai_exec_req_target_service_check check (
    target_service = 'ops_secretary'
  ),
  constraint ai_exec_req_action_type_check check (
    action_type = 'ops_secretary.daily_pending.report_pipeline'
  ),
  constraint ai_exec_req_capability_key_check check (
    capability_key in ('collect_daily_ops', 'generate_ops_report')
  ),
  constraint ai_exec_req_capability_version_len check (
    char_length(capability_version) between 1 and 32
  ),
  constraint ai_exec_req_payload_object check (
    jsonb_typeof(action_payload) = 'object'
  ),
  constraint ai_exec_req_sanitized_metadata_object check (
    jsonb_typeof(sanitized_metadata) = 'object'
  ),
  constraint ai_exec_req_payload_hash_len check (
    char_length(payload_hash) between 8 and 128
  ),
  constraint ai_exec_req_risk_level_check check (
    risk_level in ('LOW', 'MEDIUM', 'HIGH')
  ),
  constraint ai_exec_req_business_priority_check check (
    business_priority in ('CRITICAL', 'HIGH', 'NORMAL', 'LOW')
  ),
  constraint ai_exec_req_execution_mode_check check (
    execution_mode in (
      'AUTO',
      'REPORT_ONLY',
      'PROPOSAL_ONLY',
      'APPROVAL_REQUIRED',
      'CONFIRMATION_REQUIRED',
      'MANUAL_ONLY',
      'DENIED'
    )
  ),
  -- FREEZE §8 state machine (Phase B runtime uses subset; CHECKs full FREEZE set)
  constraint ai_exec_req_execution_status_check check (
    execution_status in (
      'draft',
      'policy_checking',
      'blocked',
      'proposed',
      'awaiting_approval',
      'changes_requested',
      'approved',
      'awaiting_confirmation',
      'queued',
      'running',
      'retry_wait',
      'succeeded',
      'partially_succeeded',
      'failed',
      'rejected',
      'deferred',
      'cancelled',
      'expired'
    )
  ),
  constraint ai_exec_req_preflight_decision_check check (
    preflight_decision is null
    or preflight_decision in ('allowed', 'blocked')
  ),
  constraint ai_exec_req_blocked_reason_check check (
    blocked_reason is null
    or blocked_reason in (
      'wrong_environment',
      'emergency_stop',
      'feature_disabled',
      'capability_not_allowed',
      'action_not_allowed',
      'service_not_allowed',
      'port_not_allowed',
      'budget_hard_cap',
      'invalid_configuration'
    )
  ),
  constraint ai_exec_req_blocked_reason_requires_status check (
    blocked_reason is null or execution_status = 'blocked'
  ),
  constraint ai_exec_req_estimated_cost_nonneg check (estimated_api_cost >= 0),
  constraint ai_exec_req_recorded_cost_nonneg check (
    recorded_api_cost is null or recorded_api_cost >= 0
  ),
  -- Snapshot of B1 hard-cap at evaluation · null until evaluated · not a DB-owned hard-cap SSOT
  constraint ai_exec_req_budget_limit_positive check (
    budget_limit_snapshot is null or budget_limit_snapshot > 0
  ),
  constraint ai_exec_req_budget_currency_usd check (
    budget_currency = 'USD'
  ),
  constraint ai_exec_req_budget_day_key_len check (
    budget_day_key is null or char_length(budget_day_key) between 8 and 32
  ),
  constraint ai_exec_req_feature_flag_state_check check (
    feature_flag_state is null
    or feature_flag_state in (
      'disabled',
      'staging_only',
      'internal_only',
      'beta',
      'enabled'
    )
  ),
  constraint ai_exec_req_emergency_snapshot_object check (
    jsonb_typeof(emergency_stop_snapshot) = 'object'
  ),
  constraint ai_exec_req_idempotency_key_len check (
    char_length(idempotency_key) between 8 and 200
  ),
  constraint ai_exec_req_idempotency_key_unique unique (idempotency_key),
  constraint ai_exec_req_actor_type_check check (
    actor_type in ('human', 'system', 'service', 'cron', 'agent', 'mcp')
  ),
  constraint ai_exec_req_initiator_type_check check (
    initiator_type in ('human', 'system', 'service', 'cron', 'agent', 'mcp')
  ),
  constraint ai_exec_req_delegated_by_type_check check (
    delegated_by_actor_type is null
    or delegated_by_actor_type in (
      'human',
      'system',
      'service',
      'cron',
      'agent',
      'mcp'
    )
  ),
  constraint ai_exec_req_actor_id_len check (char_length(actor_id) between 1 and 200),
  constraint ai_exec_req_initiator_id_len check (
    char_length(initiator_id) between 1 and 200
  ),
  constraint ai_exec_req_attempts_nonneg check (execution_attempts >= 0),
  constraint ai_exec_req_max_attempts_pos check (max_attempts >= 1),
  constraint ai_exec_req_executor_name_check check (
    executor_name is null
    or executor_name in (
      'ops_collector',
      'secretary_deepseek',
      'gate_audit_writer'
    )
  ),
  constraint ai_exec_req_parent_no_self check (
    parent_execution_id is null or parent_execution_id <> id
  ),
  -- Phase B: no child-execution trees (parent must remain null)
  constraint ai_exec_req_phase_b_no_parent check (parent_execution_id is null)
);

comment on table public.ai_execution_requests is
  'AI Execution Gate Phase B2 · single request SSOT · Staging apply only · Production No-Go · service_role only';

comment on column public.ai_execution_requests.idempotency_key is
  'Global UNIQUE · B3 must emit fully-qualified keys (env/service/action/day/hash) · short keys rejected';

comment on column public.ai_execution_requests.parent_execution_id is
  'Reserved for future parent/child · Phase B CHECK forces null (no child executions)';

comment on column public.ai_execution_requests.budget_limit_snapshot is
  'Hard-cap snapshot from B1/B3 evaluation · not SAFE-06/07 · not a DB control SSOT · column default remains null';

comment on column public.ai_execution_requests.feature_flag_enabled is
  'Audit snapshot of B1 env Feature Flag evaluation · DB row cannot enable execution';

comment on column public.ai_execution_requests.emergency_stop_active is
  'Audit snapshot of B1 env Emergency Stop evaluation · DB row cannot clear stop';

create index if not exists idx_ai_exec_req_created_at
  on public.ai_execution_requests (created_at desc);

create index if not exists idx_ai_exec_req_status_created
  on public.ai_execution_requests (execution_status, created_at desc);

create index if not exists idx_ai_exec_req_service_action_created
  on public.ai_execution_requests (target_service, action_type, created_at desc);

create index if not exists idx_ai_exec_req_user_created
  on public.ai_execution_requests (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_ai_exec_req_budget_day
  on public.ai_execution_requests (budget_day_key, created_at desc)
  where budget_day_key is not null;

drop trigger if exists trg_ai_exec_req_updated_at on public.ai_execution_requests;
create trigger trg_ai_exec_req_updated_at
  before update on public.ai_execution_requests
  for each row
  execute function public.ai_exec_gate_set_updated_at();

alter table public.ai_execution_requests enable row level security;

drop policy if exists ai_exec_req_deny_all on public.ai_execution_requests;
create policy ai_exec_req_deny_all
  on public.ai_execution_requests
  for all
  using (false)
  with check (false);

revoke all on table public.ai_execution_requests from public, anon, authenticated, service_role;
grant select, insert, update on table public.ai_execution_requests to service_role;
-- DELETE / TRUNCATE intentionally not granted (audit retention)

-- ---------------------------------------------------------------------------
-- B. ai_execution_events — append-only step / transition history
-- ---------------------------------------------------------------------------
create table if not exists public.ai_execution_events (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.ai_execution_requests (id) on delete restrict,
  sequence_number integer not null,
  event_type text not null,
  step_name text null,
  capability_key text null,
  executor_port text null,
  previous_status text null,
  next_status text null,
  decision text null,
  blocked_reason text null,
  reason_code text null,
  sanitized_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ai_exec_evt_sequence_pos check (sequence_number >= 1),
  constraint ai_exec_evt_sequence_unique unique (execution_id, sequence_number),
  constraint ai_exec_evt_event_type_len check (
    char_length(event_type) between 1 and 128
  ),
  constraint ai_exec_evt_step_name_len check (
    step_name is null or char_length(step_name) between 1 and 128
  ),
  constraint ai_exec_evt_capability_key_check check (
    capability_key is null
    or capability_key in ('collect_daily_ops', 'generate_ops_report')
  ),
  constraint ai_exec_evt_executor_port_check check (
    executor_port is null
    or executor_port in (
      'ops_collector',
      'secretary_deepseek',
      'gate_audit_writer'
    )
  ),
  constraint ai_exec_evt_previous_status_check check (
    previous_status is null
    or previous_status in (
      'draft',
      'policy_checking',
      'blocked',
      'proposed',
      'awaiting_approval',
      'changes_requested',
      'approved',
      'awaiting_confirmation',
      'queued',
      'running',
      'retry_wait',
      'succeeded',
      'partially_succeeded',
      'failed',
      'rejected',
      'deferred',
      'cancelled',
      'expired'
    )
  ),
  constraint ai_exec_evt_next_status_check check (
    next_status is null
    or next_status in (
      'draft',
      'policy_checking',
      'blocked',
      'proposed',
      'awaiting_approval',
      'changes_requested',
      'approved',
      'awaiting_confirmation',
      'queued',
      'running',
      'retry_wait',
      'succeeded',
      'partially_succeeded',
      'failed',
      'rejected',
      'deferred',
      'cancelled',
      'expired'
    )
  ),
  constraint ai_exec_evt_decision_check check (
    decision is null or decision in ('allowed', 'blocked')
  ),
  constraint ai_exec_evt_blocked_reason_check check (
    blocked_reason is null
    or blocked_reason in (
      'wrong_environment',
      'emergency_stop',
      'feature_disabled',
      'capability_not_allowed',
      'action_not_allowed',
      'service_not_allowed',
      'port_not_allowed',
      'budget_hard_cap',
      'invalid_configuration'
    )
  ),
  constraint ai_exec_evt_metadata_object check (
    jsonb_typeof(sanitized_metadata) = 'object'
  )
);

comment on table public.ai_execution_events is
  'AI Execution Gate Phase B2 · append-only events · ON DELETE RESTRICT · no UPDATE/DELETE grants';

create index if not exists idx_ai_exec_evt_execution_seq
  on public.ai_execution_events (execution_id, sequence_number);

create index if not exists idx_ai_exec_evt_created_at
  on public.ai_execution_events (created_at desc);

-- Append-only enforcement (even for service_role misuse)
create or replace function public.ai_exec_gate_forbid_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ai_execution_events is append-only';
end;
$$;

revoke all on function public.ai_exec_gate_forbid_event_mutation() from public, anon, authenticated;

drop trigger if exists trg_ai_exec_evt_no_update on public.ai_execution_events;
create trigger trg_ai_exec_evt_no_update
  before update on public.ai_execution_events
  for each row
  execute function public.ai_exec_gate_forbid_event_mutation();

drop trigger if exists trg_ai_exec_evt_no_delete on public.ai_execution_events;
create trigger trg_ai_exec_evt_no_delete
  before delete on public.ai_execution_events
  for each row
  execute function public.ai_exec_gate_forbid_event_mutation();

alter table public.ai_execution_events enable row level security;

drop policy if exists ai_exec_evt_deny_all on public.ai_execution_events;
create policy ai_exec_evt_deny_all
  on public.ai_execution_events
  for all
  using (false)
  with check (false);

revoke all on table public.ai_execution_events from public, anon, authenticated, service_role;
grant select, insert on table public.ai_execution_events to service_role;

-- ---------------------------------------------------------------------------
-- E. ai_execution_results — separated result payload (1:1)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_execution_results (
  execution_id uuid primary key
    references public.ai_execution_requests (id) on delete restrict,
  output_type text null,
  output_reference text null,
  sanitized_summary text null,
  metrics jsonb not null default '{}'::jsonb,
  error_code text null,
  retryable boolean null,
  completed_at timestamptz null,
  retention_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_exec_res_metrics_object check (jsonb_typeof(metrics) = 'object'),
  constraint ai_exec_res_output_type_len check (
    output_type is null or char_length(output_type) between 1 and 64
  ),
  constraint ai_exec_res_error_code_len check (
    error_code is null or char_length(error_code) <= 128
  ),
  constraint ai_exec_res_summary_len check (
    sanitized_summary is null or char_length(sanitized_summary) <= 8000
  )
);

comment on table public.ai_execution_results is
  'AI Execution Gate Phase B2 · sanitized result only · no prompt/response bodies';

drop trigger if exists trg_ai_exec_res_updated_at on public.ai_execution_results;
create trigger trg_ai_exec_res_updated_at
  before update on public.ai_execution_results
  for each row
  execute function public.ai_exec_gate_set_updated_at();

alter table public.ai_execution_results enable row level security;

drop policy if exists ai_exec_res_deny_all on public.ai_execution_results;
create policy ai_exec_res_deny_all
  on public.ai_execution_results
  for all
  using (false)
  with check (false);

revoke all on table public.ai_execution_results from public, anon, authenticated, service_role;
grant select, insert, update on table public.ai_execution_results to service_role;

-- End Phase B2 · 3 audit tables only · flag/stop remain B1 env SSOT
