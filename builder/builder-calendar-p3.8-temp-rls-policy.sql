-- ============================================================
-- Builder Calendar P3.8 — Staging 一時的 RLS ポリシー
--
-- 目的: anon / authenticated ロールが builder_projects を SELECT できるようにする
-- 対象: Staging ahlxuyvhzqdqaojiywmu のみ
-- 注意: 本番DBには絶対に適用しないこと
-- ============================================================

-- すでに RLS が有効な状態なので policy を作成するだけ

-- anon（未ログイン）用 SELECT policy
CREATE POLICY "builder_projects_select_anon_p38" 
ON public.builder_projects 
FOR SELECT 
TO anon
USING (true);

-- authenticated（ログインユーザー）用 SELECT policy
CREATE POLICY "builder_projects_select_auth_p38" 
ON public.builder_projects 
FOR SELECT 
TO authenticated
USING (true);

-- ============================================================
-- 確認クエリ
-- ============================================================
-- SELECT * FROM pg_policies WHERE tablename = 'builder_projects';

-- ============================================================
-- 適用後に確認
-- 1. ブラウザで http://127.0.0.1:8788/builder/project-calendar をリロード
-- 2. Console でデータソースモードが "supabase" になることを確認
-- 3. 3件の CAL-DEMO 案件が表示されることを確認
-- ============================================================

-- ============================================================
-- 検証完了後、不要になったら削除（P4 で本格的な RLS に置き換え）
-- ============================================================
-- DROP POLICY IF EXISTS "builder_projects_select_anon_p38" ON public.builder_projects;
-- DROP POLICY IF EXISTS "builder_projects_select_auth_p38" ON public.builder_projects;