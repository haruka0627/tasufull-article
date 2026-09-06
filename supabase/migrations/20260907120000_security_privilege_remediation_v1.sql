-- =============================================================================
-- TASFUL SECURITY PRIVILEGE REMEDIATION V1
-- Evidence batch: batch_SECURITY_PRIVILEGE_REMEDIATION_20260907
-- Created: 2026-09-07 JST (UTC 2026-09-06)
-- Scope: P0 match_sanctions, match_daily_limits, tlv.payout_log
--         P1 live_refresh_broadcast_tip_total_stub, live_tips_broadcast_total_trigger,
--            secretary_google_set_updated_at
--         baseline HIGH (in-scope): tlv.streams
-- Apply: Staging ONLY via stg-gate (EP-01/EP-02) + human-minted approval.
--        Production: Human Gate ONLY. Do NOT apply from agent without Gate.
-- Style: new forward migration; never rewrite history. Idempotent-ish.
-- =============================================================================

BEGIN;

-- P0-1 public.match_sanctions
REVOKE ALL ON TABLE public.match_sanctions FROM anon;
REVOKE ALL ON TABLE public.match_sanctions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_sanctions TO service_role;
ALTER TABLE public.match_sanctions ENABLE ROW LEVEL SECURITY;

-- P0-2 public.match_daily_limits
REVOKE ALL ON TABLE public.match_daily_limits FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.match_daily_limits FROM authenticated;
GRANT SELECT ON TABLE public.match_daily_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_daily_limits TO service_role;
ALTER TABLE public.match_daily_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS match_daily_limits_select_own ON public.match_daily_limits;
CREATE POLICY match_daily_limits_select_own
  ON public.match_daily_limits
  FOR SELECT
  TO authenticated
  USING (user_id = public.match_current_user_id());

-- P0-3 tlv.payout_log
REVOKE ALL ON TABLE tlv.payout_log FROM anon;
GRANT SELECT ON TABLE tlv.payout_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tlv.payout_log TO service_role;
ALTER TABLE tlv.payout_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_log_creator_select ON tlv.payout_log;
CREATE POLICY payout_log_creator_select
  ON tlv.payout_log
  FOR SELECT
  TO authenticated
  USING (tlv.is_creator_of(creator_id));
DROP POLICY IF EXISTS payout_log_ops_select ON tlv.payout_log;
CREATE POLICY payout_log_ops_select
  ON tlv.payout_log
  FOR SELECT
  TO authenticated
  USING (tlv.is_tlv_ops_admin());

-- baseline HIGH tlv.streams
REVOKE ALL ON TABLE tlv.streams FROM anon;
REVOKE ALL ON TABLE tlv.streams FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tlv.streams TO service_role;
ALTER TABLE tlv.streams ENABLE ROW LEVEL SECURITY;

-- P1 SECURITY DEFINER EXECUTE surface
REVOKE ALL ON FUNCTION public.live_refresh_broadcast_tip_total_stub(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.live_refresh_broadcast_tip_total_stub(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.live_refresh_broadcast_tip_total_stub(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.live_refresh_broadcast_tip_total_stub(uuid) TO service_role;
ALTER FUNCTION public.live_refresh_broadcast_tip_total_stub(uuid) SET search_path TO public;

REVOKE ALL ON FUNCTION public.live_tips_broadcast_total_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.live_tips_broadcast_total_trigger() FROM anon;
REVOKE ALL ON FUNCTION public.live_tips_broadcast_total_trigger() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.live_tips_broadcast_total_trigger() TO service_role;
ALTER FUNCTION public.live_tips_broadcast_total_trigger() SET search_path TO public;

REVOKE ALL ON FUNCTION public.secretary_google_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secretary_google_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.secretary_google_set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.secretary_google_set_updated_at() TO service_role;
ALTER FUNCTION public.secretary_google_set_updated_at() SET search_path TO public;

COMMIT;
