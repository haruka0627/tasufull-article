-- AI秘書 Phase 6-B — Google OAuth Token Vault + PKCE pending state
-- Tokens are server-only (Edge service_role). No client SELECT policies.

create or replace function public.secretary_google_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.secretary_google_token_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google',
  google_account_email text,
  access_token text not null default '',
  refresh_token text not null default '',
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secretary_google_token_vault_provider_check
    check (provider in ('google')),
  constraint secretary_google_token_vault_user_provider_key unique (user_id, provider)
);

comment on table public.secretary_google_token_vault is
  'AI秘書 Google Workspace OAuth tokens — Edge-only access (service_role). Never expose to browser.';

create index if not exists secretary_google_token_vault_user_id_idx
  on public.secretary_google_token_vault (user_id);

drop trigger if exists secretary_google_token_vault_set_updated_at on public.secretary_google_token_vault;
create trigger secretary_google_token_vault_set_updated_at
  before update on public.secretary_google_token_vault
  for each row execute function public.secretary_google_set_updated_at();

create table if not exists public.secretary_google_oauth_pending (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  redirect_uri text not null,
  scopes text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

comment on table public.secretary_google_oauth_pending is
  'PKCE OAuth state — short-lived · Edge-only · deleted after callback.';

create index if not exists secretary_google_oauth_pending_expires_idx
  on public.secretary_google_oauth_pending (expires_at);

alter table public.secretary_google_token_vault enable row level security;
alter table public.secretary_google_oauth_pending enable row level security;

-- Deny direct client access. Edge Functions use service_role (bypasses RLS).
-- Future: optional SELECT for ops_admin metadata-only view without token columns.

revoke all on table public.secretary_google_token_vault from anon, authenticated;
revoke all on table public.secretary_google_oauth_pending from anon, authenticated;

grant all on table public.secretary_google_token_vault to service_role;
grant all on table public.secretary_google_oauth_pending to service_role;
