-- P15-L3: GRANT EXECUTE on MATCH RPC helpers for authenticated (Edge user JWT client)
-- Prerequisite: 20260622190000_match_p15_l1_schema.sql

grant execute on function public.match_compatibility_score(text, text) to authenticated;
grant execute on function public.match_profile_completeness(text) to authenticated;
grant execute on function public.match_activity_label(timestamptz) to authenticated;
grant execute on function public.match_footprint_label(timestamptz) to authenticated;
grant execute on function public.match_users_are_blocked(text, text) to authenticated;
