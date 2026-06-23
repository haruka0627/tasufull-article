-- MATCH verification MVP — add age verification type
-- identity API maps to identity_document (existing). age is new.

alter table public.match_verifications
  drop constraint if exists match_verifications_type_check;

alter table public.match_verifications
  add constraint match_verifications_type_check check (
    verification_type in (
      'phone',
      'identity_document',
      'age',
      'composite'
    )
  );

comment on column public.match_verifications.verification_type is
  'phone | identity_document | age | composite. API identity maps to identity_document. MVP manual review only.';
