-- Partner management P1: profiles, documents, reviews
-- P2+: dedicated audit table, antisocial, contracts, etc.

create or replace function public.partner_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence if not exists public.partner_code_seq start 1;

create or replace function public.generate_partner_code()
returns text
language plpgsql
as $$
declare
  seq_val bigint;
  yr text;
begin
  yr := to_char(now(), 'YYYY');
  seq_val := nextval('public.partner_code_seq');
  return 'PR-' || yr || '-' || lpad(seq_val::text, 4, '0');
end;
$$;

create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_code text not null unique default public.generate_partner_code(),
  source text not null,
  company_name text not null,
  representative_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  partner_type text not null,
  business_types text[] not null default '{}',
  service_area text not null,
  status text not null default 'pending',
  postal_code text,
  corporate_number text,
  website_url text,
  sns_url text,
  monthly_capacity text,
  available_schedule text,
  achievements text,
  invoice_number text,
  insurance_status text,
  insurance_personal_limit text,
  insurance_property_limit text,
  workers_comp_type text,
  notes text,
  raw_application jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  contracted boolean not null default false,
  contract_status text,
  contract_progress text,
  invoice_status text,
  insurance_expiry date,
  workers_comp_expiry date,
  antisocial_status text,
  referral_eligible boolean,
  referral_block_code text,
  evaluation_rank text,
  contracted_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_profiles_source_check
    check (source in ('iwasho', 'tasful', 'builder')),
  constraint partner_profiles_partner_type_check
    check (partner_type in ('corporation', 'sole_proprietor', 'solo_contractor', 'freelance')),
  constraint partner_profiles_status_check
    check (status in ('pending', 'hold', 'approved', 'rejected', 'contracted'))
);

create index if not exists idx_partner_profiles_status on public.partner_profiles (status);
create index if not exists idx_partner_profiles_source on public.partner_profiles (source);
create index if not exists idx_partner_profiles_created_at on public.partner_profiles (created_at desc);
create index if not exists idx_partner_profiles_partner_code on public.partner_profiles (partner_code);
create index if not exists idx_partner_profiles_business_types on public.partner_profiles using gin (business_types);

drop trigger if exists trg_partner_profiles_updated_at on public.partner_profiles;
create trigger trg_partner_profiles_updated_at
  before update on public.partner_profiles
  for each row execute function public.partner_set_updated_at();

create table if not exists public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete cascade,
  document_type text not null,
  file_url text not null,
  file_name text,
  file_size integer,
  verified boolean not null default false,
  verified_by text,
  verified_at timestamptz,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_documents_type_check
    check (document_type in (
      'insurance_policy',
      'workers_comp_proof',
      'construction_license',
      'qualification',
      'company_profile',
      'registry',
      'opening_notice',
      'other'
    ))
);

create index if not exists idx_partner_documents_partner_id on public.partner_documents (partner_id);
create index if not exists idx_partner_documents_verified on public.partner_documents (partner_id, verified);

drop trigger if exists trg_partner_documents_updated_at on public.partner_documents;
create trigger trg_partner_documents_updated_at
  before update on public.partner_documents
  for each row execute function public.partner_set_updated_at();

create table if not exists public.partner_reviews (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete cascade,
  action text not null,
  previous_status text not null,
  new_status text not null,
  reason_code text,
  checklist_json jsonb not null default '{}'::jsonb,
  notes text,
  reviewer_id text not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint partner_reviews_action_check
    check (action in ('approve', 'hold', 'reject', 'submit')),
  constraint partner_reviews_previous_status_check
    check (previous_status in ('pending', 'hold', 'approved', 'rejected', 'contracted')),
  constraint partner_reviews_new_status_check
    check (new_status in ('pending', 'hold', 'approved', 'rejected', 'contracted'))
);

create index if not exists idx_partner_reviews_partner_reviewed
  on public.partner_reviews (partner_id, reviewed_at desc);
create index if not exists idx_partner_reviews_new_status on public.partner_reviews (new_status);

-- Storage bucket (private) — metadata only in P1
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-documents',
  'partner-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- RLS: reads for ops roles; writes via service_role Edge Functions
alter table public.partner_profiles enable row level security;
alter table public.partner_documents enable row level security;
alter table public.partner_reviews enable row level security;

create or replace function public.partner_ops_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'partner_role'), ''),
    nullif(trim(auth.jwt() ->> 'partner_role'), '')
  );
$$;

create policy partner_profiles_ops_select on public.partner_profiles
  for select to authenticated
  using (public.partner_ops_role() in ('admin', 'ops', 'reviewer'));

create policy partner_documents_ops_select on public.partner_documents
  for select to authenticated
  using (public.partner_ops_role() in ('admin', 'ops', 'reviewer'));

create policy partner_reviews_ops_select on public.partner_reviews
  for select to authenticated
  using (public.partner_ops_role() in ('admin', 'ops', 'reviewer'));

create policy partner_documents_storage_ops_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'partner-documents'
    and public.partner_ops_role() in ('admin', 'ops', 'reviewer')
  );
