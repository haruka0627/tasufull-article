\set ON_ERROR_STOP on

-- ANPI Phase 2 DB-backed test.
-- Run only against a disposable local Supabase/Postgres database after applying
-- 20260727020000_anpi_phase2_data_foundation.sql.
-- Every write is rolled back.

begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anpi-phase2-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anpi-phase2-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anpi-phase2-c@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anpi-phase2-d@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anpi-phase2-e@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- 1-2: settings creation and timezone default.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

insert into public.anpi_settings (owner_user_id, subject_user_id)
values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.anpi_settings
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  '1 settings creation'
);
select pg_temp.assert_true(
  (
    select timezone = 'Asia/Tokyo'
    from public.anpi_settings
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  '2 timezone default'
);

reset role;

-- 3: invalid timezone rejected.
do $$
begin
  begin
    insert into public.anpi_settings (owner_user_id, subject_user_id, timezone)
    values (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000002',
      'UTC'
    );
    raise exception 'ASSERTION FAILED: 3 invalid timezone accepted';
  exception when check_violation then
    null;
  end;
end $$;

-- 4: invalid weekdays rejected.
do $$
begin
  begin
    insert into public.anpi_settings (owner_user_id, subject_user_id, weekdays)
    values (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000002',
      array[1, 8]::smallint[]
    );
    raise exception 'ASSERTION FAILED: 4 invalid weekdays accepted';
  exception when check_violation then
    null;
  end;
end $$;

-- 5: reminder count upper bound.
do $$
begin
  begin
    insert into public.anpi_settings (owner_user_id, subject_user_id, reminder_count)
    values (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000002',
      3
    );
    raise exception 'ASSERTION FAILED: 5 reminder_count above maximum accepted';
  exception when check_violation then
    null;
  end;
end $$;

insert into public.anpi_settings (owner_user_id, subject_user_id)
values (
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002'
);

-- 6: one current settings row per subject.
do $$
begin
  begin
    insert into public.anpi_settings (owner_user_id, subject_user_id)
    values (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000002'
    );
    raise exception 'ASSERTION FAILED: 6 duplicate current settings accepted';
  exception when unique_violation then
    null;
  end;
end $$;

-- 7: daily check scheduler idempotency.
do $$
declare
  v_setting uuid;
  v_first uuid;
  v_second uuid;
begin
  select id into v_setting
  from public.anpi_settings
  where subject_user_id = 'a0000000-0000-4000-8000-000000000001';

  v_first := public.anpi_create_daily_check(
    v_setting,
    (now() at time zone 'Asia/Tokyo')::date,
    now()
  );
  v_second := public.anpi_create_daily_check(
    v_setting,
    (now() at time zone 'Asia/Tokyo')::date,
    now()
  );
  perform pg_temp.assert_true(v_first = v_second, '7 duplicate cron returns same check');
end $$;

-- 8: invalid canonical status rejected.
do $$
declare
  v_setting uuid;
begin
  select id into v_setting from public.anpi_settings
  where subject_user_id = 'b0000000-0000-4000-8000-000000000002';
  begin
    insert into public.anpi_check_instances (
      setting_id, owner_user_id, subject_user_id, local_check_date,
      scheduled_at, status
    ) values (
      v_setting,
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000002',
      (now() at time zone 'Asia/Tokyo')::date,
      now(),
      'delivery_failed'
    );
    raise exception 'ASSERTION FAILED: 8 invalid check status accepted';
  exception when check_violation then
    null;
  end;
end $$;

-- 9-11: confirm terminal protection, late confirmation and idempotency.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

select * from public.anpi_confirm_check(
  (
    select id from public.anpi_check_instances
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      and local_check_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  'anpi_ui'
);

select pg_temp.assert_true(
  (
    select status = 'confirmed' and confirmed_at is not null
    from public.anpi_check_instances
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      and local_check_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  '9 confirm writes terminal state'
);

select pg_temp.assert_true(
  (
    select duplicate
    from public.anpi_confirm_check(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      ),
      'talk'
    )
  ),
  '11 repeated confirm is idempotent'
);

reset role;

do $$
declare
  v_check uuid;
begin
  select id into v_check
  from public.anpi_check_instances
  where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
    and local_check_date = (now() at time zone 'Asia/Tokyo')::date;
  begin
    update public.anpi_check_instances set status = 'notified' where id = v_check;
    raise exception 'ASSERTION FAILED: 9 confirmed terminal transition accepted';
  exception when data_exception then
    null;
  end;
end $$;

insert into public.anpi_check_instances (
  setting_id, owner_user_id, subject_user_id, local_check_date,
  scheduled_at, status, first_notified_at, last_reminded_at,
  overdue_at, contact_notified_at
) values (
  (
    select id from public.anpi_settings
    where subject_user_id = 'b0000000-0000-4000-8000-000000000002'
  ),
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002',
  (now() at time zone 'Asia/Tokyo')::date,
  now(),
  'contact_notified',
  now() - interval '6 hours',
  now() - interval '4 hours',
  now() - interval '2 hours',
  now()
);

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  (
    select status = 'confirmed_late'
    from public.anpi_confirm_check(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'b0000000-0000-4000-8000-000000000002'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      ),
      'talk'
    )
  ),
  '10 contact_notified becomes confirmed_late'
);
reset role;

-- 12: another user cannot confirm.
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.anpi_confirm_check(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      ),
      'anpi_ui'
    );
    raise exception 'ASSERTION FAILED: 12 another user confirmed check';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%anpi_check_not_accessible%' then
        raise exception 'ASSERTION FAILED: 12 unexpected privilege error: %', sqlerrm;
      end if;
  end;
end $$;
reset role;

-- 13: paused/cancelled checks cannot confirm.
do $$
declare
  v_setting uuid;
begin
  select id into v_setting from public.anpi_settings
  where subject_user_id = 'b0000000-0000-4000-8000-000000000002';
  insert into public.anpi_check_instances (
    setting_id, owner_user_id, subject_user_id, local_check_date,
    scheduled_at, status
  ) values (
    v_setting,
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    (now() at time zone 'Asia/Tokyo')::date + 1,
    now() + interval '1 day',
    'paused'
  );
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';
do $$
begin
  begin
    perform public.anpi_confirm_check(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'b0000000-0000-4000-8000-000000000002'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date + 1
      ),
      'anpi_ui'
    );
    raise exception 'ASSERTION FAILED: 13 paused check confirmed';
  exception when data_exception then
    null;
  end;
end $$;
reset role;

-- 14-17: invitation hash, expiration, replay and invitee authorization.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

insert into public.anpi_contacts (
  owner_user_id, subject_user_id, contact_user_id, relationship
) values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000003',
  'relative'
);

insert into public.anpi_contact_invitations (
  id, contact_id, inviter_user_id, invitee_user_id, token_hash, expires_at
) values (
  'f0000000-0000-4000-8000-000000000001',
  (select id from public.anpi_contacts where subject_user_id = 'a0000000-0000-4000-8000-000000000001'),
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000003',
  repeat('a', 64),
  now() + interval '1 day'
);

reset role;
select pg_temp.assert_true(
  (
    select token_hash = repeat('a', 64)
      and token_hash !~ 'token|secret'
    from public.anpi_contact_invitations
    where invitee_user_id = 'c0000000-0000-4000-8000-000000000003'
  ),
  '14 only token hash stored'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(
  public.anpi_respond_contact_invitation(
    'f0000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    true
  ) = 'active',
  '16 invitee accepts once'
);

do $$
begin
  begin
    perform public.anpi_respond_contact_invitation(
      'f0000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      true
    );
    raise exception 'ASSERTION FAILED: 16 invitation replay accepted';
  exception when data_exception then
    null;
  end;
end $$;
reset role;

-- Create an expired invitation as database owner, preserving expires_at > created_at.
insert into public.anpi_contacts (
  owner_user_id, subject_user_id, contact_user_id, relationship
) values (
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000004',
  'friend'
);
insert into public.anpi_contact_invitations (
  id, contact_id, inviter_user_id, invitee_user_id, token_hash,
  created_at, expires_at
) values (
  'f0000000-0000-4000-8000-000000000002',
  (select id from public.anpi_contacts where subject_user_id = 'b0000000-0000-4000-8000-000000000002'),
  'b0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000004',
  repeat('b', 64),
  now() - interval '2 hours',
  now() - interval '1 hour'
);

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000004';
do $$
begin
  begin
    perform public.anpi_respond_contact_invitation(
      'f0000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      true
    );
    raise exception 'ASSERTION FAILED: 15 expired invitation accepted';
  exception when data_exception then
    null;
  end;
end $$;
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.anpi_respond_contact_invitation(
      'f0000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      true
    );
    raise exception 'ASSERTION FAILED: 17 non-invitee accepted invitation';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%anpi_invitation_not_accessible%' then
        raise exception 'ASSERTION FAILED: 17 unexpected privilege error: %', sqlerrm;
      end if;
  end;
end $$;
reset role;

-- 18-21: consent gate, revoke, delivery uniqueness, failure separation.
do $$
declare
  v_check uuid;
  v_pending_contact uuid;
  v_other_active uuid;
begin
  select id into v_check from public.anpi_check_instances
  where subject_user_id = 'b0000000-0000-4000-8000-000000000002'
    and local_check_date = (now() at time zone 'Asia/Tokyo')::date;
  select id into v_pending_contact from public.anpi_contacts
  where subject_user_id = 'b0000000-0000-4000-8000-000000000002';
  select id into v_other_active from public.anpi_contacts
  where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
    and status = 'active';

  begin
    insert into public.anpi_notification_deliveries (
      check_id, recipient_user_id, contact_id, channel, kind
    ) values (
      v_check,
      'd0000000-0000-4000-8000-000000000004',
      v_pending_contact,
      'talk',
      'contact_unconfirmed'
    );
    raise exception 'ASSERTION FAILED: 18 pending contact delivery accepted';
  exception when insufficient_privilege then
    null;
  end;

  -- Wrong-subject active contact must not attach to another subject's check.
  begin
    insert into public.anpi_notification_deliveries (
      check_id, recipient_user_id, contact_id, channel, kind
    ) values (
      v_check,
      'c0000000-0000-4000-8000-000000000003',
      v_other_active,
      'talk',
      'contact_unconfirmed'
    );
    raise exception 'ASSERTION FAILED: 18 cross-subject contact delivery accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

insert into public.anpi_notification_deliveries (
  check_id, recipient_user_id, contact_id, channel, kind
) values (
  (
    select id from public.anpi_check_instances
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      and local_check_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  'c0000000-0000-4000-8000-000000000003',
  (
    select id from public.anpi_contacts
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'talk',
  'contact_unconfirmed'
);

do $$
begin
  begin
    insert into public.anpi_notification_deliveries (
      check_id, recipient_user_id, contact_id, channel, kind
    ) values (
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      ),
      'c0000000-0000-4000-8000-000000000003',
      (
        select id from public.anpi_contacts
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      ),
      'talk',
      'contact_unconfirmed'
    );
    raise exception 'ASSERTION FAILED: 20 duplicate delivery accepted';
  exception when unique_violation then
    null;
  end;
end $$;

update public.anpi_notification_deliveries
set status = 'failed', failed_at = now(), failure_code = 'provider_unavailable'
where recipient_user_id = 'c0000000-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  (
    select status = 'confirmed'
    from public.anpi_check_instances
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      and local_check_date = (now() at time zone 'Asia/Tokyo')::date
  ),
  '21 delivery failure does not change check status'
);

-- Delivery check_id rebind must be rejected (identity + consent guard).
do $$
declare
  v_delivery uuid;
  v_other_check uuid;
begin
  select id into v_delivery
  from public.anpi_notification_deliveries
  where recipient_user_id = 'c0000000-0000-4000-8000-000000000003'
  limit 1;
  select id into v_other_check
  from public.anpi_check_instances
  where subject_user_id = 'b0000000-0000-4000-8000-000000000002'
  limit 1;
  begin
    update public.anpi_notification_deliveries
    set check_id = v_other_check
    where id = v_delivery;
    raise exception 'ASSERTION FAILED: 18 check_id rebind accepted';
  exception when data_exception then
    if sqlerrm not like '%anpi_delivery_identity_immutable%'
       and sqlerrm not like '%anpi_contact_not_notification_eligible%' then
      raise exception 'ASSERTION FAILED: 18 unexpected check_id rebind error: %', sqlerrm;
    end if;
  end;
end $$;

-- Critical: overdue is not visible to contacts; contact_notified is.
insert into public.anpi_check_instances (
  setting_id, owner_user_id, subject_user_id, local_check_date,
  scheduled_at, status, first_notified_at, overdue_at
) values (
  (
    select id from public.anpi_settings
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  (now() at time zone 'Asia/Tokyo')::date + 1,
  now() + interval '1 day',
  'overdue',
  now(),
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.anpi_contact_check_summary(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date + 1
      )
    )
  ),
  '25 overdue hidden from active contact'
);
reset role;

update public.anpi_check_instances
set status = 'contact_notified',
    contact_notified_at = now()
where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  and local_check_date = (now() at time zone 'Asia/Tokyo')::date + 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  (
    select count(*) = 1 and bool_and(status = 'contact_notified')
    from public.anpi_contact_check_summary(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date + 1
      )
    )
  ),
  '25 active contact sees contact_notified summary only'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000003';
select public.anpi_revoke_contact(
  (
    select id from public.anpi_contacts
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
  )
);
reset role;

select pg_temp.assert_true(
  not exists (
    select 1 from public.anpi_contacts
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
      and status = 'active'
      and accepted_at is not null
      and revoked_at is null
      and deleted_at is null
  ),
  '19 revoked contact excluded from eligible set'
);

-- 22: audit safe payload never includes secrets/tokens/contact PII.
select pg_temp.assert_true(
  not exists (
    select 1
    from public.anpi_audit_logs
    where (old_values_safe::text || new_values_safe::text)
      ~* 'token|password|email|phone|display_name'
  ),
  '22 audit contains no secret or contact PII fields'
);

-- 23-24: RLS own/other settings SELECT.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 1 from public.anpi_settings),
  '23 owner sees own settings'
);
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(
  (select count(*) = 0 from public.anpi_settings),
  '24 other user cannot see settings'
);
reset role;

-- 25: active contact receives only the minimal summary RPC, never full settings.
-- The contact is revoked now, therefore the summary is empty.
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.anpi_contact_check_summary(
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      )
    )
  ),
  '25 revoked contact gets no summary'
);
reset role;

-- 26: client cannot directly mutate check status.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
do $$
begin
  begin
    update public.anpi_check_instances
    set status = 'cancelled', cancelled_at = now()
    where subject_user_id = 'a0000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: 26 direct client status update accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- 27: client cannot insert delivery.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
do $$
begin
  begin
    insert into public.anpi_notification_deliveries (
      check_id, recipient_user_id, channel, kind
    ) values (
      (
        select id from public.anpi_check_instances
        where subject_user_id = 'a0000000-0000-4000-8000-000000000001'
          and local_check_date = (now() at time zone 'Asia/Tokyo')::date
      ),
      'a0000000-0000-4000-8000-000000000001',
      'talk',
      'initial'
    );
    raise exception 'ASSERTION FAILED: 27 client delivery insert accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- 28: client cannot read audit.
do $$
begin
  begin
    perform count(*) from public.anpi_audit_logs;
    raise exception 'ASSERTION FAILED: 28 client audit read accepted';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- 29: soft-deleted setting is excluded from RLS reads.
update public.anpi_settings
set deleted_at = now(), enabled = false
where subject_user_id = 'b0000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  (select count(*) = 0 from public.anpi_settings),
  '29 soft-deleted settings hidden'
);
reset role;

-- 30: migration objects, RLS flags, and reminder_count=0 transition.
select pg_temp.assert_true(
  public.anpi_phase2_transition_allowed('notified', 'overdue'),
  '30 notified->overdue allowed for reminder_count=0'
);

select pg_temp.assert_true(
  (
    select count(*) = 6
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'anpi_settings',
        'anpi_check_instances',
        'anpi_contacts',
        'anpi_contact_invitations',
        'anpi_notification_deliveries',
        'anpi_audit_logs'
      )
      and c.relrowsecurity
  ),
  '30 all six Phase 2 tables have RLS enabled'
);

\echo 'ANPI Phase 2 DB-backed assertions: 30 PASS'

rollback;
