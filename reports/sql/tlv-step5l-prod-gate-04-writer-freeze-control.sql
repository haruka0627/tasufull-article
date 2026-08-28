\set ON_ERROR_STOP on

-- TLV Gate 04 writer-freeze control candidate.
-- INTERACTIVE PSQL ONLY: the transaction must remain open at the prompt.
-- Do not use this file with a client that exits after EOF.
-- No INSERT/UPDATE/DELETE/DDL is permitted in this session.

begin;
set local application_name = 'tlv_gate04_writer_freeze_v1';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local idle_in_transaction_session_timeout = '20min';

do $gate04$
declare
  required_relations text[] := array[
    'tlv.creators',
    'tlv.streams',
    'tlv.payments',
    'tlv.tips',
    'tlv.revenue_ledger',
    'tlv.gauge_state',
    'tlv.stream_events',
    'tlv.creator_score_events',
    'tlv.payout_log',
    'tlv.viewer_wallets',
    'tlv.coin_lots',
    'tlv.payment_provider_events',
    'tlv.tip_coin_lot_allocations',
    'tlv.wallet_ledger',
    'tlv.payment_reversals',
    'public.live_tips',
    'public.live_broadcasts'
  ];
  auxiliary_relations text[] := array[
    'public.live_ad_impression_events',
    'public.live_video_view_events',
    'public.live_videos',
    'public.live_creator_monetization',
    'public.live_ad_rpm_settings',
    'public.live_monetization_audit_logs',
    'public.live_creator_profiles',
    'public.live_risk_flags'
  ];
  missing text[];
  relation_name text;
begin
  select array_agg(name order by name)
    into missing
  from unnest(required_relations) as required(name)
  where to_regclass(name) is null;

  if coalesce(cardinality(missing), 0) > 0 then
    raise exception 'GATE04_REQUIRED_RELATION_MISSING: %', array_to_string(missing, ',');
  end if;

  for relation_name in
    select name
    from (
      select unnest(required_relations) as name
      union
      select name from unnest(auxiliary_relations) as auxiliary(name)
      where to_regclass(name) is not null
    ) relations
    order by to_regclass(name)::oid
  loop
    execute format('lock table %s in share mode', to_regclass(relation_name));
  end loop;
end
$gate04$;

select
  'TLV-STEP5L-PROD-GATE04-CHECKPOINT-V1' as control_id,
  pg_backend_pid() as freeze_backend_pid,
  current_setting('application_name') as application_name,
  current_setting('transaction_read_only') as transaction_read_only,
  current_timestamp as freeze_started_at,
  count(*) filter (where l.granted) as granted_relation_locks,
  count(*) filter (where not l.granted) as ungranted_relation_locks
from pg_locks l
where l.pid = pg_backend_pid()
  and l.locktype = 'relation'
  and l.mode = 'ShareLock';

select
  n.nspname as schema_name,
  c.relname as relation_name,
  l.mode,
  l.granted
from pg_locks l
join pg_class c on c.oid = l.relation
join pg_namespace n on n.oid = c.relnamespace
where l.pid = pg_backend_pid()
  and l.locktype = 'relation'
  and l.mode = 'ShareLock'
order by n.nspname, c.relname;

with frozen_relations as (
  select distinct relation
  from pg_locks
  where pid = pg_backend_pid()
    and locktype = 'relation'
    and mode = 'ShareLock'
    and granted
), conflicting_locks as (
  select l.*
  from pg_locks l
  join frozen_relations f on f.relation = l.relation
  where l.pid <> pg_backend_pid()
    and l.mode in ('RowExclusiveLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')
)
select
  count(*) filter (where granted) as other_granted_conflicting_locks,
  count(*) filter (where not granted) as blocked_writer_locks,
  count(distinct pid) filter (
    where not granted and pg_backend_pid() = any(pg_blocking_pids(pid))
  ) as writer_sessions_blocked_by_freeze_pid
from conflicting_locks;

-- FREEZE IS ACTIVE ONLY WHILE THIS TRANSACTION AND SESSION REMAIN OPEN.
-- Normal unfreeze at the interactive prompt:
--   ROLLBACK;
-- Emergency unfreeze: Recovery Owner terminates only freeze_backend_pid.
