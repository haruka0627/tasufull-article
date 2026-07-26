-- =============================================================================
-- ANPI Phase 17 — First insert cleanup (guarded · staging ahlxuyvhzqdqaojiywmu)
-- STAGING TEST ONLY
-- DO NOT APPLY TO PRODUCTION
-- =============================================================================
-- Deletes ONLY the Phase17 test notification identified by deterministic id
-- derived from gate.idempotency_key (+ source marker).
--
-- Modes:
--   p_dry_run=true  → counts only (default)
--   p_dry_run=false → delete when exactly 1 matching row
--
-- Guards:
--   expected count must be 1 to delete
--   0 → ok stop
--   >1 → BLOCK (no delete)
-- Does NOT touch anpi_user_contexts / Phase15 seeds / other notifications.
-- =============================================================================

create or replace function public.anpi_phase17_cleanup_first_test_notification(
  p_dry_run boolean default true
)
returns table (
  matched_count integer,
  deleted_count integer,
  dry_run boolean,
  blocked boolean,
  reason_code text,
  notification_id text,
  executed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
  v_id text;
  v_match integer;
begin
  select idempotency_key into v_key from public.anpi_phase17_insert_gate where id = 1;
  if v_key is null then
    matched_count := 0; deleted_count := 0; dry_run := coalesce(p_dry_run, true);
    blocked := true; reason_code := 'anpi_phase17_gate_missing'; notification_id := null;
    executed_at := clock_timestamp(); return next; return;
  end if;

  v_id := 'anpi-p17-' || encode(extensions.digest(v_key, 'sha256'), 'hex');

  select count(*)::int into v_match
  from public.talk_notifications t
  where t.id = v_id
    and t.source = 'anpi_phase17_test'
    and t.type = 'anpi';

  matched_count := coalesce(v_match, 0);
  notification_id := v_id;
  dry_run := coalesce(p_dry_run, true);
  executed_at := clock_timestamp();

  if matched_count = 0 then
    deleted_count := 0; blocked := false; reason_code := 'anpi_phase17_cleanup_none';
    return next; return;
  end if;

  if matched_count > 1 then
    deleted_count := 0; blocked := true; reason_code := 'anpi_phase17_cleanup_ambiguous';
    return next; return;
  end if;

  -- matched_count = 1
  if coalesce(p_dry_run, true) then
    deleted_count := 0; blocked := false; reason_code := 'anpi_phase17_cleanup_dry_run';
    return next; return;
  end if;

  delete from public.talk_notifications t
  where t.id = v_id
    and t.source = 'anpi_phase17_test'
    and t.type = 'anpi';

  get diagnostics deleted_count = row_count;
  blocked := false;
  reason_code := 'anpi_phase17_cleanup_deleted';

  update public.anpi_phase17_insert_gate
  set inserted_count = greatest(inserted_count - deleted_count, 0),
      last_notification_id = case when deleted_count > 0 then null else last_notification_id end,
      updated_at = now()
  where id = 1;

  return next;
end;
$$;

revoke all on function public.anpi_phase17_cleanup_first_test_notification(boolean)
  from public, anon, authenticated;
grant execute on function public.anpi_phase17_cleanup_first_test_notification(boolean)
  to service_role;

-- Convenience dry-run select for humans
select * from public.anpi_phase17_cleanup_first_test_notification(true);
