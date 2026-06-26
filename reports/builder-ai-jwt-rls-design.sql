-- Builder AI JWT / RLS 設計案（P2-A · P2-B 更新 · 実行禁止）
-- 本番 DB への適用は P2-C staging 検証後
-- Staging 実行用 DDL/RLS: sql/builder-ai-drafts-staging.sql （DO NOT RUN ON PRODUCTION）

-- ============================================================
-- 1. builder_ai_drafts テーブル案
-- ============================================================

/*
CREATE TABLE IF NOT EXISTS public.builder_ai_drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      text NOT NULL,
  actor_type    text NOT NULL CHECK (actor_type IN ('admin','owner','partner','guest')),
  project_id    text,
  thread_id     text,
  action        text NOT NULL,
  content       text NOT NULL,
  is_draft      boolean NOT NULL DEFAULT true,
  hidden        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT builder_ai_drafts_content_draft CHECK (
    content LIKE '【下書き・確認用】%'
  )
);

CREATE INDEX IF NOT EXISTS idx_builder_ai_drafts_actor
  ON public.builder_ai_drafts (actor_type, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_builder_ai_drafts_project
  ON public.builder_ai_drafts (project_id, created_at DESC)
  WHERE project_id IS NOT NULL AND hidden = false;
*/

-- ============================================================
-- 2. JWT claim 想定（auth.jwt() -> app_metadata / custom claims）
-- ============================================================
-- sub              -> auth.users.id (actor_id 正本)
-- role             -> admin | owner | partner | guest
-- builder_owner_id -> owner ロール時の owner_id
-- partner_id       -> partner ロール時
-- tenant_id        -> 将来マルチテナント用（任意）

-- ============================================================
-- 3. RLS policy 案（builder_ai_drafts）
-- ============================================================

/*
ALTER TABLE public.builder_ai_drafts ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分の draft / admin は全件
CREATE POLICY builder_ai_drafts_select_own ON public.builder_ai_drafts
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR (
      actor_type = (auth.jwt() ->> 'role')
      AND actor_id = COALESCE(
        auth.jwt() ->> 'partner_id',
        auth.jwt() ->> 'builder_owner_id',
        auth.jwt() ->> 'sub',
        'guest'
      )
    )
  );

-- INSERT: 自分名義のみ · content は下書き prefix 必須（CHECK でも担保）
CREATE POLICY builder_ai_drafts_insert_own ON public.builder_ai_drafts
  FOR INSERT WITH CHECK (
    actor_type = (auth.jwt() ->> 'role')
    AND actor_id = COALESCE(
      auth.jwt() ->> 'partner_id',
      auth.jwt() ->> 'builder_owner_id',
      auth.jwt() ->> 'sub',
      'guest'
    )
    AND is_draft = true
    AND content LIKE '【下書き・確認用】%'
  );

-- UPDATE: hidden のみ（内容改ざん不可 · トリガーで content 変更禁止も可）
CREATE POLICY builder_ai_drafts_update_hide ON public.builder_ai_drafts
  FOR UPDATE USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR (
      actor_type = (auth.jwt() ->> 'role')
      AND actor_id = COALESCE(
        auth.jwt() ->> 'partner_id',
        auth.jwt() ->> 'builder_owner_id',
        auth.jwt() ->> 'sub'
      )
    )
  )
  WITH CHECK (hidden IN (true, false));

-- DELETE: 本人または admin
CREATE POLICY builder_ai_drafts_delete_own ON public.builder_ai_drafts
  FOR DELETE USING (
    (auth.jwt() ->> 'role') = 'admin'
    OR (
      actor_type = (auth.jwt() ->> 'role')
      AND actor_id = actor_id
    )
  );
*/

-- ============================================================
-- 4. 既存 Builder テーブル — Builder AI 読取/書込スコープ
-- ============================================================
-- projects, project_specs, threads, applications:
--   READ  : canAccessProject と同等（guest 不可 · owner/partner スコープ · admin 全件）
--   WRITE : Builder AI からは書込不可（draft テーブルのみ INSERT）
-- partner profiles, admin ops memos:
--   READ  : 現行 buildProjectContext と同様にロール別フィルタ（Edge で redact）
--   WRITE : 不可

-- ============================================================
-- 5. Builder AI Edge / Gateway — 変更なし方針
-- ============================================================
-- surface=builder_ai, skipSearch=true はクライアントから渡すのみ
-- JWT は Supabase session から Edge Functions が検証（P2-B）
