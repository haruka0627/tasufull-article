-- ANPI Phase 10 — Real TALK Write Path Foundation (local-only, user-invisible)
-- Audit verdict: B — reuse public.talk_notifications as the canonical inbox;
--   add service_role-only write path + additive sidecar ledger + identity mapping.
-- Depends on Phase 2–9. Does NOT edit prior migrations or TALK sql/* files.
--
-- Allowed modes this phase: local · shadow · real_dry.
-- HARD-DISABLED this phase: real (production/staging user-facing send).
-- Out of scope: user inbox display · unread increment · Realtime · Push ·
--   LINE/SMS/email · production/staging apply · cron.
--
-- talk_notifications facts honored (sql/talk-sync-schema.sql):
--   id text pk · user_id text not null · type · title · body ·
--   target_url text NOT NULL default '#'  (=> ANPI never sets a real URL; uses '#')
--   source · priority · created_at · read_at · updated_at.
-- Dedup mirrors live-notify: stable id primary key + ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- 1. Canonical identity mapping: auth.users uuid -> talk_notifications.user_id
--    Mirrors production public.talk_current_user_id() coalesce order server-side:
--    member_id (anpi_user_contexts) -> auth uid text (== sub / auth.uid fallback).
--    Fail-closed on null. Never trusts client input. Never logs raw uuid.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_resolve_talk_user_id(p_auth_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_member text;
  v_uid text;
begin
  if p_auth_user_id is null then
    raise exception using errcode = '22023', message = 'anpi_talk_identity_unresolved';
  end if;

  v_uid := p_auth_user_id::text;

  -- Prefer an explicit TASFUL member mapping when the context table exists.
  if to_regclass('public.anpi_user_contexts') is not null then
    begin
      execute
        'select nullif(trim(member_id), '''') '
        || 'from public.anpi_user_contexts '
        || 'where anpi_user_id = $1 and coalesce(nullif(trim(member_id), ''''), '''') <> '''' '
        || 'order by updated_at desc nulls last limit 1'
      into v_member
      using v_uid;
    exception when others then
      v_member := null; -- schema variance tolerated; fall back to uid text
    end;
  end if;

  return coalesce(v_member, v_uid);
end;
$$;

comment on function public.anpi_resolve_talk_user_id(uuid) is
  'Service-only ANPI->TALK identity mapping. member_id (if mapped) else auth uid text. Fail-closed on null. No raw uuid logging.';

revoke all on function public.anpi_resolve_talk_user_id(uuid) from public, anon, authenticated;
grant execute on function public.anpi_resolve_talk_user_id(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Adapter mode normalize (local | shadow | real_dry ; real hard-disabled)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_normalize_mode(p_mode text)
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v text := lower(nullif(trim(coalesce(p_mode, '')), ''));
begin
  if v is null then
    return 'local';
  end if;
  if v = 'real' then
    raise exception using errcode = '22023', message = 'anpi_talk_real_write_disabled';
  end if;
  if v not in ('local', 'shadow', 'real_dry') then
    raise exception using errcode = '22023', message = 'anpi_talk_invalid_mode';
  end if;
  return v;
end;
$$;

revoke all on function public.anpi_phase10_normalize_mode(text) from public, anon, authenticated;
grant execute on function public.anpi_phase10_normalize_mode(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Sidecar ledger: link ANPI job/delivery -> talk_notifications.id.
--    PII-free · no title/body/url · service_role only · unique idempotency_key.
--    Retention: rows pruned when their idempotency_key is older than 30 days
--    (anpi_phase10_purge_links); one-to-one with talk_notification_id.
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_notification_links (
  id uuid primary key default gen_random_uuid(),
  scheduler_job_id uuid,
  delivery_id uuid,
  idempotency_key text not null,
  talk_notification_id text,
  talk_user_id text,
  state text not null default 'pending',
  cancel_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_talk_links_state_check check (
    state in ('pending', 'dry', 'written', 'cancelled', 'failed')
  ),
  constraint anpi_talk_links_key_check check (
    char_length(idempotency_key) between 8 and 200
  ),
  constraint anpi_talk_links_reason_check check (
    cancel_reason_code is null
    or (char_length(cancel_reason_code) between 1 and 64
        and cancel_reason_code !~* '(https?://|<|@)')
  ),
  constraint anpi_talk_links_idem_uidx unique (idempotency_key)
);

comment on table public.anpi_talk_notification_links is
  'Phase 10 sidecar: ANPI job/delivery <-> talk_notifications.id. No PII/title/body/url. service_role only.';

create unique index if not exists anpi_talk_links_talk_id_uidx
  on public.anpi_talk_notification_links (talk_notification_id)
  where talk_notification_id is not null;

create index if not exists anpi_talk_links_job_idx
  on public.anpi_talk_notification_links (scheduler_job_id)
  where scheduler_job_id is not null;

revoke all on table public.anpi_talk_notification_links from public, anon, authenticated;
grant select, insert, update, delete on table public.anpi_talk_notification_links to service_role;

-- ---------------------------------------------------------------------------
-- 4. Fixed Talk row renderer (fixed title/body strings — no adapter free text,
--    no HTML, no URL). target_url is always '#': the schema's NOT NULL safe
--    default. type='anpi'. Priority from kind.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_render_talk_row(
  p_contract jsonb,
  p_talk_user_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_err text;
  v_template text;
  v_kind text;
  v_key text;
  v_title text;
  v_body text;
  v_priority text;
  v_id text;
begin
  v_err := public.anpi_phase8_validate_contract(p_contract);
  if v_err is not null then
    raise exception using errcode = '22023', message = v_err;
  end if;
  if p_talk_user_id is null or char_length(trim(p_talk_user_id)) < 1 then
    raise exception using errcode = '22023', message = 'anpi_talk_identity_unresolved';
  end if;

  v_template := p_contract->>'template_key';
  v_kind := p_contract->'parameters'->>'kind';
  v_key := p_contract->>'idempotency_key';

  -- Fixed catalog strings only. Plain Japanese. No HTML / URL / PII.
  case v_template
    when 'anpi.initial' then
      v_title := '安否確認のお願い';       v_body := '本日の安否確認をお願いします。'; v_priority := 'normal';
    when 'anpi.reminder' then
      v_title := '安否確認リマインド';      v_body := '安否確認がまだ完了していません。'; v_priority := 'high';
    when 'anpi.contact_unconfirmed' then
      v_title := '安否未確認のお知らせ';    v_body := 'ご家族の安否がまだ確認できていません。'; v_priority := 'high';
    when 'anpi.late_confirmation' then
      v_title := '安否確認の完了（遅延）';  v_body := '安否確認が完了しました。'; v_priority := 'normal';
    when 'anpi.system_notice' then
      v_title := 'システムからのお知らせ';  v_body := 'ANPIシステムからの通知です。'; v_priority := 'normal';
    when 'anpi.delivery_failed' then
      v_title := '通知エラー';             v_body := '安否通知の送信に失敗しました。'; v_priority := 'normal';
    else
      raise exception using errcode = '22023', message = 'anpi_unknown_template';
  end case;

  -- Stable id from idempotency key (mirrors live-notify notifyIdFromKey pattern).
  v_id := 'anpi-n-' || encode(extensions.digest(v_key, 'sha256'), 'hex');

  return jsonb_build_object(
    'id', v_id,
    'user_id', p_talk_user_id,
    'type', 'anpi',
    'title', v_title,
    'body', v_body,
    'target_url', '#',        -- never a real URL; schema NOT NULL safe default
    'source', 'anpi_phase10',
    'priority', v_priority,
    'template_key', v_template,
    'kind', v_kind
  );
end;
$$;

revoke all on function public.anpi_phase10_render_talk_row(jsonb, text) from public, anon, authenticated;
grant execute on function public.anpi_phase10_render_talk_row(jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. real_dry write validation (NO talk_notifications INSERT). Resolves
--    recipient, validates contract, re-checks eligibility, maps row, confirms
--    dedup, records sidecar state 'dry', returns would_insert + receipt.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_talk_write_dry_run(
  p_job_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  would_insert boolean,
  talk_notification_id text,
  error_code text,
  talk_table_present boolean,
  already_written boolean,
  mode text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_contract jsonb;
  v_err text;
  v_reason text;
  v_key text;
  v_talk_user text;
  v_row jsonb;
  v_id text;
  v_link public.anpi_talk_notification_links%rowtype;
  v_present boolean := to_regclass('public.talk_notifications') is not null;
begin
  mode := 'real_dry';
  talk_table_present := v_present;
  would_insert := false;
  already_written := false;

  select * into v_job from public.anpi_scheduler_jobs where id = p_job_id;
  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_contract := public.anpi_phase8_build_notification_contract(p_job_id);
  v_key := v_contract->>'idempotency_key';

  v_err := public.anpi_phase8_validate_contract(v_contract);
  if v_err is not null then
    status := 'failed'; talk_notification_id := null; error_code := v_err;
    return next; return;
  end if;

  -- Fail-closed identity mapping.
  begin
    v_talk_user := public.anpi_resolve_talk_user_id(v_job.recipient_user_id);
  exception when others then
    status := 'failed'; talk_notification_id := null;
    error_code := 'anpi_talk_identity_unresolved';
    return next; return;
  end;

  -- Confirm-race / eligibility re-check.
  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    perform public.anpi_phase10_talk_write_cancel(v_key, v_reason, p_now);
    status := 'cancelled'; talk_notification_id := null; error_code := v_reason;
    return next; return;
  end if;

  -- Dedup via sidecar.
  select * into v_link
  from public.anpi_talk_notification_links l
  where l.idempotency_key = v_key
  for update;

  if found and v_link.state = 'written' then
    status := 'written'; talk_notification_id := v_link.talk_notification_id;
    error_code := null; already_written := true; would_insert := false;
    return next; return;
  end if;
  if found and v_link.state = 'cancelled' then
    status := 'cancelled'; talk_notification_id := v_link.talk_notification_id;
    error_code := coalesce(v_link.cancel_reason_code, 'anpi_cancelled');
    would_insert := false;
    return next; return;
  end if;

  -- Map (validates render); no INSERT into talk_notifications.
  v_row := public.anpi_phase10_render_talk_row(v_contract, v_talk_user);
  v_id := v_row->>'id';

  insert into public.anpi_talk_notification_links (
    scheduler_job_id, idempotency_key, talk_user_id, state, created_at, updated_at
  ) values (
    v_job.id, v_key, v_talk_user, 'dry', p_now, p_now
  )
  on conflict (idempotency_key) do update
    set talk_user_id = excluded.talk_user_id,
        state = case when public.anpi_talk_notification_links.state in ('written', 'cancelled')
                     then public.anpi_talk_notification_links.state else 'dry' end,
        updated_at = p_now
  returning * into v_link;

  status := 'accepted';
  would_insert := (v_link.state = 'dry');
  talk_notification_id := null;  -- real_dry never writes the inbox row
  error_code := null;
  return next;
end;
$$;

comment on function public.anpi_phase10_talk_write_dry_run(uuid, timestamptz) is
  'Phase 10 real_dry: resolve + validate + eligibility + map + dedup. NO talk_notifications INSERT.';

revoke all on function public.anpi_phase10_talk_write_dry_run(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.anpi_phase10_talk_write_dry_run(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 6. status() — sidecar-based, PII-free.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_talk_write_status(p_idempotency_key text)
returns table (
  status text,
  talk_notification_id text,
  talk_user_bound boolean,
  cancel_reason_code text,
  link_found boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_link public.anpi_talk_notification_links%rowtype;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;

  select * into v_link
  from public.anpi_talk_notification_links l
  where l.idempotency_key = p_idempotency_key;

  if not found then
    status := null; talk_notification_id := null; talk_user_bound := false;
    cancel_reason_code := null; link_found := false;
    return next; return;
  end if;

  status := v_link.state;
  talk_notification_id := v_link.talk_notification_id;
  talk_user_bound := v_link.talk_user_id is not null;  -- boolean only, never the value
  cancel_reason_code := v_link.cancel_reason_code;
  link_found := true;
  return next;
end;
$$;

revoke all on function public.anpi_phase10_talk_write_status(text) from public, anon, authenticated;
grant execute on function public.anpi_phase10_talk_write_status(text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. cancel() — idempotent logical cancel. Never physically deletes a written
--    inbox row (history preserved). Cascades Phase 9/8 receipt cancel.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_talk_write_cancel(
  p_idempotency_key text,
  p_reason text default 'anpi_cancelled',
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  already_terminal boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reason text := left(regexp_replace(coalesce(nullif(p_reason, ''), 'anpi_cancelled'), '[^a-z0-9_]', '_', 'gi'), 64);
  v_link public.anpi_talk_notification_links%rowtype;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;

  -- Cascade adapter-side cancel (idempotent, no talk_notifications touch).
  perform public.anpi_phase9_adapter_cancel(p_idempotency_key, v_reason, p_now);

  select * into v_link
  from public.anpi_talk_notification_links l
  where l.idempotency_key = p_idempotency_key
  for update;

  if not found then
    insert into public.anpi_talk_notification_links (
      idempotency_key, state, cancel_reason_code, created_at, updated_at
    ) values (
      p_idempotency_key, 'cancelled', v_reason, p_now, p_now
    )
    on conflict (idempotency_key) do nothing
    returning * into v_link;
    status := 'cancelled'; already_terminal := false;
    return next; return;
  end if;

  -- Written notifications are terminal: keep the delivered inbox row intact.
  if v_link.state = 'written' then
    status := 'written'; already_terminal := true;
    return next; return;
  end if;
  if v_link.state = 'cancelled' then
    status := 'cancelled'; already_terminal := true;
    return next; return;
  end if;

  update public.anpi_talk_notification_links l
  set state = 'cancelled', cancel_reason_code = v_reason, updated_at = p_now
  where l.id = v_link.id
  returning * into v_link;

  status := v_link.state; already_terminal := false;
  return next;
end;
$$;

revoke all on function public.anpi_phase10_talk_write_cancel(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.anpi_phase10_talk_write_cancel(text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Guarded internal REAL writer. Represents the production/staging write.
--    HARD-DISABLED: without p_local_test the function refuses to run.
--    p_local_test=true is for LOCAL rollback fixtures only (source marker
--    'anpi_phase10_test'); it still fail-closes on identity / eligibility.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_talk_notification_create_internal(
  p_job_id uuid,
  p_now timestamptz default clock_timestamp(),
  p_local_test boolean default false
)
returns table (
  status text,
  talk_notification_id text,
  error_code text,
  already_seen boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_contract jsonb;
  v_err text;
  v_reason text;
  v_key text;
  v_talk_user text;
  v_row jsonb;
  v_id text;
  v_link public.anpi_talk_notification_links%rowtype;
begin
  -- Environment / feature guard: real (non-test) writes are disabled this phase.
  if coalesce(p_local_test, false) is not true then
    raise exception using errcode = '0A000', message = 'anpi_talk_real_write_disabled';
  end if;

  if to_regclass('public.talk_notifications') is null then
    status := 'failed'; talk_notification_id := null;
    error_code := 'anpi_talk_table_absent'; already_seen := false;
    return next; return;
  end if;

  select * into v_job from public.anpi_scheduler_jobs where id = p_job_id;
  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_contract := public.anpi_phase8_build_notification_contract(p_job_id);
  v_key := v_contract->>'idempotency_key';

  v_err := public.anpi_phase8_validate_contract(v_contract);
  if v_err is not null then
    status := 'failed'; talk_notification_id := null; error_code := v_err; already_seen := false;
    return next; return;
  end if;

  begin
    v_talk_user := public.anpi_resolve_talk_user_id(v_job.recipient_user_id);
  exception when others then
    status := 'failed'; talk_notification_id := null;
    error_code := 'anpi_talk_identity_unresolved'; already_seen := false;
    return next; return;
  end;

  -- Confirm-race guard immediately before write.
  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    perform public.anpi_phase10_talk_write_cancel(v_key, v_reason, p_now);
    status := 'cancelled'; talk_notification_id := null; error_code := v_reason; already_seen := false;
    return next; return;
  end if;

  select * into v_link
  from public.anpi_talk_notification_links l
  where l.idempotency_key = v_key
  for update;

  if found and v_link.state = 'written' then
    status := 'written'; talk_notification_id := v_link.talk_notification_id;
    error_code := null; already_seen := true;
    return next; return;
  end if;
  if found and v_link.state = 'cancelled' then
    status := 'cancelled'; talk_notification_id := v_link.talk_notification_id;
    error_code := coalesce(v_link.cancel_reason_code, 'anpi_cancelled'); already_seen := true;
    return next; return;
  end if;

  v_row := public.anpi_phase10_render_talk_row(v_contract, v_talk_user);
  v_id := v_row->>'id';

  -- Inbox write. Dedup by PK (mirrors live-notify ON CONFLICT DO NOTHING).
  -- Local test marker source only. No unread/Realtime/Push side effects here.
  insert into public.talk_notifications (
    id, user_id, type, title, body, target_url, source, priority
  ) values (
    v_id, v_talk_user, 'anpi', v_row->>'title', v_row->>'body', '#',
    'anpi_phase10_test', v_row->>'priority'
  )
  on conflict (id) do nothing;

  insert into public.anpi_talk_notification_links (
    scheduler_job_id, idempotency_key, talk_notification_id, talk_user_id,
    state, created_at, updated_at
  ) values (
    v_job.id, v_key, v_id, v_talk_user, 'written', p_now, p_now
  )
  on conflict (idempotency_key) do update
    set talk_notification_id = coalesce(public.anpi_talk_notification_links.talk_notification_id, excluded.talk_notification_id),
        talk_user_id = excluded.talk_user_id,
        state = case when public.anpi_talk_notification_links.state = 'cancelled'
                     then 'cancelled' else 'written' end,
        updated_at = p_now
  returning * into v_link;

  -- Align Phase 8 receipt ledger for cross-phase status consistency.
  insert into public.anpi_talk_adapter_receipts (
    idempotency_key, template_key, status, provider_message_id, stub_mode, created_at, updated_at
  ) values (
    v_key, v_contract->>'template_key', 'delivered', 'talk:' || v_id, 'success', p_now, p_now
  )
  on conflict (idempotency_key) do update
    set status = case when public.anpi_talk_adapter_receipts.status = 'cancelled'
                     then public.anpi_talk_adapter_receipts.status else 'delivered' end,
        provider_message_id = coalesce(public.anpi_talk_adapter_receipts.provider_message_id, 'talk:' || v_id),
        updated_at = p_now;

  status := v_link.state;
  talk_notification_id := v_link.talk_notification_id;
  error_code := null;
  already_seen := false;
  return next;
end;
$$;

comment on function public.anpi_talk_notification_create_internal(uuid, timestamptz, boolean) is
  'Phase 10 guarded REAL writer. Disabled unless p_local_test=true (local rollback fixtures). Fail-closed identity/eligibility. Dedup by stable id. No unread/Realtime/Push.';

revoke all on function public.anpi_talk_notification_create_internal(uuid, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.anpi_talk_notification_create_internal(uuid, timestamptz, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 9. health() — write-path readiness snapshot (PII-free).
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_talk_write_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_present boolean := to_regclass('public.talk_notifications') is not null;
  v_cols integer := 0;
begin
  if v_present then
    select count(*) into v_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'talk_notifications'
      and column_name in ('id', 'user_id', 'type', 'title', 'body', 'target_url', 'source', 'priority');
  end if;

  return jsonb_build_object(
    'ok', true,
    'adapter', 'talk_write_path',
    'allowed_modes', jsonb_build_array('local', 'shadow', 'real_dry'),
    'real_mode_enabled', false,
    'production_send', false,
    'staging_send', false,
    'user_facing_inbox_write', false,
    'unread_increment', false,
    'realtime', false,
    'push', false,
    'talk_table_present', v_present,
    'talk_required_columns_present', (v_cols = 8),
    'identity_mapping', 'anpi_resolve_talk_user_id',
    'sidecar_ledger', to_regclass('public.anpi_talk_notification_links') is not null,
    'templates', (select count(*)::integer from public.anpi_talk_templates where enabled),
    'actions', (select count(*)::integer from public.anpi_talk_actions where enabled),
    'target_url_policy', 'fixed_hash_no_url'
  );
end;
$$;

revoke all on function public.anpi_phase10_talk_write_health() from public, anon, authenticated;
grant execute on function public.anpi_phase10_talk_write_health() to service_role;

-- ---------------------------------------------------------------------------
-- 10. Unified send dispatcher (Phase 8 interface seam). real hard-disabled.
--     local -> Phase 8 stub · shadow -> Phase 9 shadow · real_dry -> dry_run.
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_write_for_job(
  p_job_id uuid,
  p_mode text default 'real_dry',
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mode text := public.anpi_phase10_normalize_mode(p_mode);
  v8 record;
  v9 record;
  v10 record;
begin
  if v_mode = 'local' then
    select * into v8 from public.anpi_phase8_adapter_send_for_job(p_job_id, 'success', p_now);
    return jsonb_build_object(
      'mode', 'local', 'status', v8.status, 'would_insert', false,
      'talk_notification_id', null, 'error_code', v8.error_code,
      'idempotency_key', v8.contract->>'idempotency_key'
    );
  elsif v_mode = 'shadow' then
    select * into v9 from public.anpi_phase9_adapter_send_for_job(p_job_id, 'shadow', p_now);
    return jsonb_build_object(
      'mode', 'shadow', 'status', v9.status, 'would_insert', false,
      'talk_notification_id', null, 'error_code', v9.error_code,
      'idempotency_key', v9.contract->>'idempotency_key'
    );
  else
    -- real_dry
    select * into v10 from public.anpi_phase10_talk_write_dry_run(p_job_id, p_now);
    return jsonb_build_object(
      'mode', 'real_dry', 'status', v10.status, 'would_insert', v10.would_insert,
      'talk_notification_id', v10.talk_notification_id, 'error_code', v10.error_code,
      'talk_table_present', v10.talk_table_present, 'already_written', v10.already_written
    );
  end if;
end;
$$;

revoke all on function public.anpi_phase10_write_for_job(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.anpi_phase10_write_for_job(uuid, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 11. Sidecar retention maintenance (local; no user-facing effect).
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase10_purge_links(
  p_now timestamptz default clock_timestamp(),
  p_retain interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  delete from public.anpi_talk_notification_links l
  where l.updated_at < (p_now - p_retain)
    and l.state in ('cancelled', 'dry');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.anpi_phase10_purge_links(timestamptz, interval) from public, anon, authenticated;
grant execute on function public.anpi_phase10_purge_links(timestamptz, interval) to service_role;

-- Explicit: no ALTER on public.talk_notifications · no RLS change ·
-- no cron · no Push/Realtime hooks · no production/staging enablement.
