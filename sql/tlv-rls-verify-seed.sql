-- TLV RLS verify seed — public shorts + broadcasts (test creator only)
-- Safe to re-run: uses fixed UUIDs + ON CONFLICT DO NOTHING
-- Does not modify existing production rows.

insert into public.live_creator_profiles (
  user_id,
  bio,
  creator_status,
  live_permission_status
) values (
  'tlv_rls_verify_test',
  '[TLV TEST] RLS公開閲覧確認用クリエイター',
  'active',
  'identity_verified'
)
on conflict (user_id) do update set
  bio = excluded.bio,
  creator_status = excluded.creator_status,
  live_permission_status = excluded.live_permission_status
where public.live_creator_profiles.user_id = 'tlv_rls_verify_test';

insert into public.live_shorts (
  id,
  creator_id,
  title,
  description,
  storage_path,
  duration_sec,
  status,
  view_count,
  like_count,
  published_at
) values
  ('a1000001-0000-4000-8000-000000000001', 'tlv_rls_verify_test', '[TLV TEST] ショート 01', 'RLS verify seed', 'tlv_rls_verify_test/short-01.mp4', 30, 'published', 120, 3, now() - interval '6 hours'),
  ('a1000001-0000-4000-8000-000000000002', 'tlv_rls_verify_test', '[TLV TEST] ショート 02', 'RLS verify seed', 'tlv_rls_verify_test/short-02.mp4', 28, 'published', 240, 5, now() - interval '5 hours'),
  ('a1000001-0000-4000-8000-000000000003', 'tlv_rls_verify_test', '[TLV TEST] ショート 03', 'RLS verify seed', 'tlv_rls_verify_test/short-03.mp4', 25, 'published', 360, 2, now() - interval '4 hours'),
  ('a1000001-0000-4000-8000-000000000004', 'tlv_rls_verify_test', '[TLV TEST] ショート 04', 'RLS verify seed', 'tlv_rls_verify_test/short-04.mp4', 22, 'published', 480, 8, now() - interval '3 hours'),
  ('a1000001-0000-4000-8000-000000000005', 'tlv_rls_verify_test', '[TLV TEST] ショート 05', 'RLS verify seed', 'tlv_rls_verify_test/short-05.mp4', 20, 'published', 600, 1, now() - interval '2 hours'),
  ('a1000001-0000-4000-8000-000000000006', 'tlv_rls_verify_test', '[TLV TEST] ショート 06', 'RLS verify seed', 'tlv_rls_verify_test/short-06.mp4', 18, 'published', 720, 4, now() - interval '1 hour'),
  ('a1000001-0000-4000-8000-000000000007', 'tlv_rls_verify_test', '[TLV TEST] ショート 07', 'RLS verify seed B shelf', 'tlv_rls_verify_test/short-07.mp4', 16, 'published', 840, 6, now() - interval '50 minutes'),
  ('a1000001-0000-4000-8000-000000000008', 'tlv_rls_verify_test', '[TLV TEST] ショート 08', 'RLS verify seed B shelf', 'tlv_rls_verify_test/short-08.mp4', 15, 'published', 960, 2, now() - interval '40 minutes')
on conflict (id) do nothing;

insert into public.live_broadcasts (
  id,
  creator_id,
  title,
  status,
  stream_provider,
  scheduled_at,
  started_at,
  ended_at
) values
  (
    'b2000001-0000-4000-8000-000000000001',
    'tlv_rls_verify_test',
    '[TLV TEST] 配信予定（scheduled）',
    'scheduled',
    'stub',
    now() + interval '2 days',
    null,
    null
  ),
  (
    'b2000001-0000-4000-8000-000000000002',
    'tlv_rls_verify_test',
    '[TLV TEST] ライブ配信中（live）',
    'live',
    'stub',
    now() - interval '30 minutes',
    now() - interval '20 minutes',
    null
  ),
  (
    'b2000001-0000-4000-8000-000000000003',
    'tlv_rls_verify_test',
    '[TLV TEST] 配信終了（ended）',
    'ended',
    'stub',
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '23 hours'
  )
on conflict (id) do nothing;
