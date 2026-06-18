-- public.listings — 求人（job）用カラム追加
-- Supabase SQL Editor で実行してください。

alter table public.listings
  add column if not exists job_location text,
  add column if not exists work_style text,
  add column if not exists employment_type text,
  add column if not exists salary_type text,
  add column if not exists salary_amount numeric,
  add column if not exists working_hours text,
  add column if not exists required_skills text,
  add column if not exists welcome_skills text,
  add column if not exists job_benefits text,
  add column if not exists application_deadline date,
  add column if not exists recruitment_count integer,
  add column if not exists application_method text,
  add column if not exists contract_terms text,
  add column if not exists company_name text,
  add column if not exists recruiter_name text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists company_description text;

comment on column public.listings.job_location is '勤務地';
comment on column public.listings.work_style is '勤務形態（リモート可 等）';
comment on column public.listings.employment_type is '雇用形態（正社員 等）';
comment on column public.listings.salary_type is '報酬種別（月給・時給 等）';
comment on column public.listings.salary_amount is '報酬額（数値）';
comment on column public.listings.working_hours is '勤務時間';
comment on column public.listings.required_skills is '必須スキル';
comment on column public.listings.welcome_skills is '歓迎スキル';
comment on column public.listings.job_benefits is '福利厚生・待遇';
comment on column public.listings.application_deadline is '応募締切';
comment on column public.listings.recruitment_count is '募集人数';
comment on column public.listings.application_method is '応募方法';
comment on column public.listings.contract_terms is '契約条件';
comment on column public.listings.company_name is '掲載企業名';
comment on column public.listings.recruiter_name is '採用担当者名';
comment on column public.listings.contact_email is '連絡先メール';
comment on column public.listings.phone is '電話番号';
comment on column public.listings.company_description is '企業紹介';
