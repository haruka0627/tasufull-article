-- =============================================================================
-- ANPI Phase 15 — Mapping seed (human-reviewed · staging ahlxuyvhzqdqaojiywmu only)
-- =============================================================================
-- Seeds anpi_user_contexts from auth.users app_metadata.talk_user_id claims.
-- Only rows where talk_user_id is present AND differs from auth uid (mismatch class).
--
-- Prerequisites: schema package applied (anpi-phase15-talk-identity-mapping-foundation.sql)
-- Does NOT insert talk_notifications rows.
-- Does NOT enable Real INSERT / Realtime / Push.
-- =============================================================================

insert into public.anpi_user_contexts (
  auth_user_id,
  talk_user_id,
  anpi_user_id,
  member_id,
  user_id,
  mapping_source,
  mapping_status,
  metadata,
  updated_at
)
select
  u.id,
  nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), ''),
  u.id::text,
  nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), ''),
  nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), ''),
  'app_metadata.talk_user_id',
  'approved_phase15',
  jsonb_build_object(
    'phase', 15,
    'claim_source', 'app_metadata.talk_user_id',
    'seeded_at', now()
  ),
  now()
from auth.users u
where nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '') is not null
  and nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '') is distinct from u.id::text
on conflict (auth_user_id) do update
  set talk_user_id = excluded.talk_user_id,
      member_id = excluded.member_id,
      anpi_user_id = excluded.anpi_user_id,
      user_id = excluded.user_id,
      mapping_source = excluded.mapping_source,
      mapping_status = excluded.mapping_status,
      metadata = excluded.metadata,
      updated_at = now();

-- Sanity + dry-run parity (no notification INSERT)
select
  (select count(*) from public.anpi_user_contexts
     where mapping_status = 'approved_phase15') as seeded_rows,
  (select count(*) from auth.users u
     where nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '') is not null
       and nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '') is distinct from u.id::text) as expected_candidates,
  -- Writer vs reader claim parity for seeded users
  (select count(*) from auth.users u
     join public.anpi_user_contexts c on c.auth_user_id = u.id
     where public.anpi_resolve_talk_user_id(u.id)
         = nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '')
  ) as writer_matches_talk_claim,
  -- Users without claim: resolver returns uid (fallback OK)
  (select count(*) from auth.users u
     where nullif(trim(u.raw_app_meta_data ->> 'talk_user_id'), '') is null
       and public.anpi_resolve_talk_user_id(u.id) = u.id::text
  ) as no_claim_fallback_ok;
