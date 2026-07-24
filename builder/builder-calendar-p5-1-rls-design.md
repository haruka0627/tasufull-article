# Builder Calendar P5-1 — 本番 RLS 設計レポート

> 調査日: 2026-07-04
> 対象テーブル: `public.builder_projects`
> 状態: **設計のみ（実装禁止）**

---

## 1. 現在の暫定 Policy 整理

### 1.1 P3.8 で適用した一時 Policy（Staging のみ）

```sql
-- Staging 検証用。本番では絶対に使用しない
CREATE POLICY "builder_projects_select_anon_p38" ON public.builder_projects
  FOR SELECT TO anon USING (true);
CREATE POLICY "builder_projects_select_auth_p38" ON public.builder_projects
  FOR SELECT TO authenticated USING (true);
```

**問題点:**
- `anon` が全件 SELECT 可能（完全に公開）
- `authenticated` も全件 SELECT 可能（権限の分離なし）
- INSERT/UPDATE/DELETE の policy なし（write は常に 401 で失敗）

### 1.2 既存設計書の参照

`sql/builder-rls-policies.sql` に既存の設計案がある。このファイルは **Builder 全体** の RLS 設計であり、`builder_projects` 以外にも複数テーブルを含む。また、`owner_id` / `actor_type` / `partner_id` などの JWT claim を使った高度な権限制御を前提としている。

---

## 2. 本番 RLS 設計案

### 2.1 前提条件

| 項目 | 前提 | 備考 |
|------|------|------|
| 認証方式 | Supabase Auth（JWT） | `auth.uid()` でユーザー識別 |
| テーブル | `public.builder_projects`（33カラム） | migration 20260717130000 適用済み |
| RLS 状態 | 現在有効（一時 policy あり） | 本番用に差し替え |
| ユーザータイプ | anon / authenticated / service_role | 3ロールで権限分離 |
| 案件の可視性 | `visibility` カラム（public/private/partner_only/team_only） | 既存 |
| 所有者 | `owner_id` カラム（text） | auth.uid() と比較 |

### 2.2 設計方針

| 操作 | anon | authenticated | service_role |
|------|------|-------------|-------------|
| SELECT | `visibility='public'` のみ | 可視性に応じた制御 | 全件許可 |
| INSERT | ❌ 禁止 | 自分の案件のみ | 全件許可 |
| UPDATE | ❌ 禁止 | 自分の案件のみ | 全件許可 |
| DELETE | ❌ 禁止 | 自分の案件のみ（論理削除推奨） | 全件許可 |

### 2.3 Policy 定義案

#### Helper Function

```sql
-- Calendar でのみ使用する簡易 helper（既存 builder-rls-policies.sql の helper は
-- 複数テーブルに依存するため、Calendar 単体では不要。auth.uid() のみで判定）
create or replace function public.builder_calendar_uid()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;
```

#### SELECT Policy

```sql
-- anon は public 案件のみ閲覧可能
CREATE POLICY "builder_projects_select_anon" ON public.builder_projects
  FOR SELECT TO anon
  USING (
    visibility = 'public'
    OR visibility IS NULL  -- 未設定時は public 扱い
  );

-- authenticated は可視性に応じて閲覧可能
CREATE POLICY "builder_projects_select_auth" ON public.builder_projects
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR visibility IS NULL
    OR owner_id = auth.uid()::text
    OR visibility IN ('partner_only', 'team_only')
  );

-- service_role は全件閲覧可能（管理画面用）
-- service_role はデフォルトで全行アクセス可能。明示的な policy は不要
```

#### INSERT Policy

```sql
-- authenticated のみ。自分の案件のみ作成可能
CREATE POLICY "builder_projects_insert_auth" ON public.builder_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()::text
  );

-- service_role は全件挿入可能（明示的な policy 不要）
```

#### UPDATE Policy

```sql
-- authenticated のみ。自分の案件のみ更新可能
CREATE POLICY "builder_projects_update_auth" ON public.builder_projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- service_role は全件更新可能（明示的な policy 不要）
```

#### DELETE Policy

```sql
-- 論理削除を推奨（status='deleted' に変更する方式）
-- 物理削除は admin のみ
CREATE POLICY "builder_projects_delete_admin_only" ON public.builder_projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid()::text);
```

### 2.4 既存設計との比較

| 観点 | `sql/builder-rls-policies.sql` | 本設計案（Calendar 特化） |
|------|-------------------------------|--------------------------|
| 認証方式 | JWT claim（actor_id / actor_type / partner_id） | `auth.uid()` のみ |
| 権限モデル | owner / partner / admin の3種 | anon / authenticated / service_role の3種 |
| 複雑度 | 高（10テーブル、複数 helper） | 低（1テーブル、helper 最小限） |
| パートナー権限 | 詳細な制御（応募・選定・メッセージ） | 未対応（将来拡張） |
| 適用範囲 | Builder 全体 | Calendar 単体 |

**統合方針:** Calendar の RLS は `auth.uid()` ベースの簡易設計で運用開始し、後日 `sql/builder-rls-policies.sql` の拡張設計に統合する。

---

## 3. 権限分離の詳細

### 3.1 anon に許可する範囲

| 操作 | 許可条件 | 理由 |
|------|---------|------|
| SELECT | `visibility='public'` または未設定 | 一般公開案件のカレンダー表示 |
| INSERT | ❌ 禁止 | 認証なしでの作成を防止 |
| UPDATE | ❌ 禁止 | 同上 |
| DELETE | ❌ 禁止 | 同上 |

**→ Calendar の公開カレンダー表示のみ。** 未ログインユーザーが Builder Calendar で案件を閲覧できる必要がある場合のみ。

### 3.2 authenticated に許可する範囲

| 操作 | 許可条件 | 理由 |
|------|---------|------|
| SELECT | 自身の案件 + public案件 | カレンダーに自分の案件を表示 |
| INSERT | 自身の案件のみ | 新規案件作成 |
| UPDATE | 自身の案件のみ | 編集・日程変更・完了報告 |
| DELETE | 自身の案件のみ | 案件削除（論理削除推奨） |

**→ Calendar の全機能を利用可能。** ログインユーザーが自分の案件を管理。

### 3.3 service_role 前提にすべき処理

| 処理 | 理由 |
|------|------|
| 管理画面の全件操作 | Builder 運営の管理機能 |
| サーバーサイドのバッチ処理 | 自動通知・集計・レポート生成 |
| 本番 seed データ投入 | 初回データ投入時 |
| migration 適用 | DDL 実行時 |

### 3.4 Builder 運営 / パートナー / ユーザーの権限分離

| ロール | 実体 | 権限 |
|--------|------|------|
| 運営（admin） | service_role または専用 claim | 全件 CRUD |
| オーナー（ユーザー） | authenticated, `owner_id = auth.uid()` | 自身の案件のみ |
| パートナー | authenticated, 将来 `partner_id` claim | 現状は `owner_id` と同等。将来 `partner_only` 案件の閲覧を追加 |
| 未ログイン訪問者 | anon | public 案件の閲覧のみ |

### 3.5 Calendar 公開表示と管理画面操作の分離

| 画面 | 前提ロール | 操作 |
|------|-----------|------|
| Builder Calendar 公開カレンダー | anon | public 案件の閲覧のみ |
| Builder Calendar ユーザーカレンダー | authenticated | 自身の案件の全操作 |
| Builder 管理画面 | service_role / admin | 全案件の全操作 |

### 3.6 Talk 連携時の読み書き権限

Builder Calendar の Talk 連携は `talk_room_id` / `talk_thread_id` カラムを参照するのみで、Talk 自体の権限は別テーブルの RLS で制御される。`builder_projects` の RLS が Talk 連携に影響を与えることはない。

---

## 4. localStorage 廃止前に必要な最低 Policy

| # | Policy | 必須理由 |
|---|--------|---------|
| 1 | SELECT anon | 公開カレンダー表示に必要 |
| 2 | SELECT authenticated | 自身の案件読み込みに必要 |
| 3 | INSERT authenticated | 案件作成に必要 |
| 4 | UPDATE authenticated | 案件編集・日程変更・完了報告に必要 |

**上記4つの policy が整備されていないと、localStorage を廃止できない。**

現在の `builder_projects` には `owner_id` カラムがあるため、`auth.uid()` との比較で所有権を判定できる。これら4 policy があれば、Builder Calendar の基本機能は Supabase のみで動作可能。

---

## 5. Production 適用時のリスク

| # | リスク | Severity | 対策 |
|---|--------|----------|------|
| 1 | 既存の一時 policy を削除する前に本番 policy を適用すると、空白期間が発生 | **P0** | 一時 policy を削除する前に本番 policy を CREATE する |
| 2 | `auth.uid()` が期待通り動作しない | **P1** | Supabase の JWT 設定を確認。`auth.uid()` は `auth.users.id` の UUID を返す |
| 3 | `owner_id` が `auth.uid()` と一致しない | **P1** | 既存データの `owner_id` が UUID 形式でない場合、`auth.uid()::text` と一致しない。既存データの移行が必要 |
| 4 | `visibility` が NULL の場合、anon が全件 SELECT 可能 | **P2** | `COALESCE(visibility, 'public')` でデフォルト値を設定 |
| 5 | パートナー権限が未実装 | **P2** | 現状は `owner_id` のみ。パートナー機能は別途拡張 |
| 6 | policy の多重定義による競合 | **P2** | 一時 policy を DROP してから本番 policy を CREATE |

---

## 6. Production 適用前チェックリスト

### 🟢 必須

| # | 項目 | 確認方法 |
|---|------|---------|
| [ ] | `auth.uid()` が期待する値を返すか確認 | Supabase SQL Editor で `SELECT auth.uid();` を実行 |
| [ ] | 既存データの `owner_id` 形式を確認 | `SELECT DISTINCT owner_id FROM builder_projects;` |
| [ ] | 一時 policy を削除する前に本番 policy を作成 | 一時 policy と本番 policy が共存可能か確認 |
| [ ] | anon で public 案件のみ SELECT 可能か確認 | `SET ROLE anon; SELECT * FROM builder_projects;` |
| [ ] | authenticated で自身の案件のみ INSERT 可能か確認 | Supabase client で実際に挿入テスト |
| [ ] | authenticated で自身の案件のみ UPDATE 可能か確認 | 同上 |

### 🟡 推奨

| # | 項目 |
|---|------|
| [ ] | `visibility` のデフォルト値を `'public'` に設定する migration を作成 |
| [ ] | `owner_id` に INDEX を作成（`CREATE INDEX IF NOT EXISTS ...`） |
| [ ] | バックアップを取得してから policy を適用 |
| [ ] | RLS policy のテスト用 SQL スクリプトを作成 |

---

## 7. Migration 作成方針

### 7.1 ファイル名

```
supabase/migrations/20260718000000_builder_calendar_rls.sql
```

### 7.2 内容

```sql
-- ============================================================
-- Builder Calendar RLS — 本番用 policy
-- 適用方法: Supabase Dashboard SQL Editor で手動実行
-- 注意: 本番DBに適用する前にバックアップを取得すること
-- ============================================================

-- 1. 一時 policy の削除
DROP POLICY IF EXISTS "builder_projects_select_anon_p38" ON public.builder_projects;
DROP POLICY IF EXISTS "builder_projects_select_auth_p38" ON public.builder_projects;

-- 2. SELECT: anon は public 案件のみ
CREATE POLICY "builder_projects_select_anon" ON public.builder_projects
  FOR SELECT TO anon
  USING (COALESCE(visibility, 'public') = 'public');

-- 3. SELECT: authenticated は可視性に応じて
CREATE POLICY "builder_projects_select_auth" ON public.builder_projects
  FOR SELECT TO authenticated
  USING (
    COALESCE(visibility, 'public') = 'public'
    OR owner_id = auth.uid()::text
    OR visibility IN ('partner_only', 'team_only')
  );

-- 4. INSERT: authenticated のみ、自分の案件
CREATE POLICY "builder_projects_insert_auth" ON public.builder_projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()::text);

-- 5. UPDATE: authenticated のみ、自分の案件
CREATE POLICY "builder_projects_update_auth" ON public.builder_projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- 6. DELETE: 所有者のみ（論理削除推奨）
CREATE POLICY "builder_projects_delete_auth" ON public.builder_projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid()::text);
```

### 7.3 ロールバック用 SQL

```sql
DROP POLICY IF EXISTS "builder_projects_select_anon" ON public.builder_projects;
DROP POLICY IF EXISTS "builder_projects_select_auth" ON public.builder_projects;
DROP POLICY IF EXISTS "builder_projects_insert_auth" ON public.builder_projects;
DROP POLICY IF EXISTS "builder_projects_update_auth" ON public.builder_projects;
DROP POLICY IF EXISTS "builder_projects_delete_auth" ON public.builder_projects;

-- 必要に応じて一時 policy を復元
-- CREATE POLICY "builder_projects_select_anon_p38" ...
-- CREATE POLICY "builder_projects_select_auth_p38" ...
```

---

## 8. 推奨実装順

```
Step 1 [調査]（今回）
  └─ [x] RLS 設計レポート作成

Step 2 [実装] — migration 作成
  └─ migration SQL ファイルを作成（`20260718000000_builder_calendar_rls.sql`）

Step 3 [Staging 適用] — 調査用
  └─ Staging で migration を適用
  └─ anon / authenticated の動作確認（SELECT/INSERT/UPDATE）
  └─ 全回帰テスト実行

Step 4 [adapter 改修] — await 化
  └─ adapter.writeProject() を fire-and-forget から await に変更
  └─ Supabase write 失敗時のエラー処理

Step 5 [Staging write E2E]
  └─ RLS 適用後、全 write 関数の Supabase 保存確認
  └─ console.error でエラー詳細を確認

Step 6 [Production 適用]
  └─ 本番DBに migration を適用
  └─ 動作確認後、localStorage 廃止を再判断
```

---

## 9. まだ実装しない方がいい内容

| 内容 | 理由 |
|------|------|
| パートナー権限の完全分離 | Calendar 単体では不要。`sql/builder-rls-policies.sql` で別途設計済み |
| `builder_project_applications` テーブルの RLS | Calendar 未使用テーブル。Builder 全体の移行時に設定 |
| `builder_can_read_project()` 関数の統合 | 既存 `sql/builder-rls-policies.sql` の helper と重複するため、後日統合 |
| 複数テーブルをまたぐ RLS | Calendar は `builder_projects` のみ。他のテーブルは別途 |
| `service_role` 用の明示的な policy | デフォルトで全件アクセス可能。明示的な policy は不要 |
| RLS のトリガー / 監査ログ | 将来の課題。現時点では不要 |
| 行レベルの暗号化 | 過剰設計。必要ない |

---

## 10. 結論

### RLS 設計の要点

1. **anon に許可するのは public 案件の SELECT のみ**
2. **authenticated は自身の案件のみ全操作可能**
3. **service_role は全件操作可能（明示的な policy 不要）**
4. **`auth.uid()` ベースの簡易設計で Calendar 単体では十分**
5. **既存 `sql/builder-rls-policies.sql` の拡張設計は後日統合**

### 次に実装すべき内容

1. RLS policy migration の作成（`20260718000000_builder_calendar_rls.sql`）
2. Staging での適用と動作確認
3. adapter.writeProject() の await 化（fire-and-forget 廃止）
4. Staging write E2E テスト