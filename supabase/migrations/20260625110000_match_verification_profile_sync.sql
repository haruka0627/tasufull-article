-- MATCH verification MVP: allow Edge (service_role) to sync match_profiles.verification_status
-- Client JWT updates remain blocked; admin path unchanged.

create or replace function public.match_profiles_guard_verification_status()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and coalesce(current_setting('request.jwt.claim.role', true), '') is distinct from 'service_role'
     and coalesce(current_setting('role', true), '') is distinct from 'service_role'
     and not public.match_is_admin() then
    raise exception 'verification_status is read-only for clients';
  end if;
  return new;
end;
$$;

comment on function public.match_profiles_guard_verification_status() is
  'Blocks client JWT from changing verification_status; allows service_role (Edge) and admins.';

-- Edge-only helper: set identity verification to pending after submit (idempotent).
create or replace function public.match_edge_sync_profile_verification_pending(p_user_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return null;
  end if;

  update public.match_profiles
  set
    verification_status = 'pending',
    updated_at = timezone('utc', now())
  where user_id = trim(p_user_id)
    and archived_at is null
    and verification_status not in ('verified', 'phone_verified')
  returning verification_status into v_status;

  return v_status;
end;
$$;

revoke all on function public.match_edge_sync_profile_verification_pending(text) from public;
grant execute on function public.match_edge_sync_profile_verification_pending(text) to service_role;

comment on function public.match_edge_sync_profile_verification_pending(text) is
  'MATCH Edge: identity submit → match_profiles.verification_status=pending (not verified).';
