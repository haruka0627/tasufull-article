# Builder Calendar P4 Phase 4 — localStorage 廃止判断・本番移行前調査レポート

> 調査日: 2026-07-04
> 調査者: Cursor
> 状態: **調査・判定のみ（実装禁止）**

---

## 1. localStorage 依存一覧

### 1.1 プロジェクトストア（builder-project-store.js）

| 関数 | Key | 用途 | 読み取り | 書き込み | Phase1-3接続 |
|------|-----|------|---------|---------|-------------|
| `readAll()` | `tasu_builder_project_hub_v1` | 全案件読み込み | ✅ | — | adapter非経由 |
| `writeAll(data)` | `tasu_builder_project_hub_v1` | 全案件保存 | — | ✅ | adapter非経由 |
| `ensureSeed()` | 同上 | 初回起動時にDemo案件をseed | ✅ | ✅ | adapter非経由 |
| `seedDemoProjects()` | 同上（経由） | 3件のDemo案件生成 | — | ✅ | adapter非経由 |
| `clearForTests()` | 同上 | テスト用にlocalStorage削除 | — | ✅ | テスト時のみ |

### 1.2 永続化内部関数（builder-project-store.js）

| 関数 | 保存処理 | Supabase adapter | localStorage |
|------|---------|-----------------|-------------|
| `persistProjectDocuments()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `persistProjectNotifications()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `saveVisionDiagnosis()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `saveProject()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateProject()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateSchedule()` | → updateProject() | ✅ 間接 | ✅ 常に保存 |
| `updateFinance()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateEstimate()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateInvoice()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateContract()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |
| `updateCompletion()` | adapter.writeProject() + writeAll() | ✅ fire-and-forget | ✅ 常に保存 |

### 1.3 カレンダーUI固有（builder-project-calendar.js）

| 関数 | Key | 用途 | Phase1-3接続 |
|------|-----|------|-------------|
| `COMPLETION_DRAFT_KEY` | `tasu_builder_cal_completion_draft_v1` | 完了報告下書きを案件IDごとに保存 | ❌ adapter非経由 |
| `loadCompletionDraft()` | 同上 | 下書き読み込み | ❌ |
| `saveCompletionDraft()` | 同上 | 下書き保存 | ❌ |

### 1.4 Supabase read / write 経路

| 経路 | ファイル | 状態 |
|------|---------|------|
| Read | `builder-project-calendar-supabase.js` → `fetchProjectsFromSupabase()` | ✅ 実装済み |
| Read | `builder-project-store.js` → `hydrateFromSupabase()` | ✅ 実装済み |
| Write | `builder-project-write-adapter.js` → `writeProject()` | ✅ 実装済み（fire-and-forget） |

---

## 2. Supabase 移行済み一覧

### 2.1 ✅ Supabase Read 確認済み（P3.8）

| 項目 | 状態 |
|------|------|
| `builder_projects` テーブル | Staging に33カラム作成済み |
| SELECT anon policy | ✅ 一時ポリシー適用済み |
| Supabase mode | ✅ 正常動作確認（mode=supabase, count=3） |
| Demo fallback | ✅ エラー時に安全にフォールバック |

### 2.2 ✅ Supabase Write adapter 経由化済み（P4 Phase1〜3）

全25 write 関数が `adapter.writeProject()` を呼び出す。

| グループ | 関数数 | 状態 |
|---------|-------|------|
| Core（save/update/schedule） | 3 | ✅ Phase 1 |
| Sub-resource（completion/finance/estimate/invoice/contract） | 5 | ✅ Phase 2 |
| Document（add/update/remove/archive） | 4 | ✅ Phase 3（persistProjectDocuments経由） |
| Notification（add/update/markRead/markUnread/archive） | 5 | ✅ Phase 3（persistProjectNotifications経由） |
| Vision（saveVisionDiagnosis） | 1 | ✅ Phase 3 |

---

## 3. 未解決リスク一覧

| # | リスク | Severity | 詳細 |
|---|--------|----------|------|
| **R1** | **fire-and-forget write** | **P1** | `adapter.writeProject()` は `.then()` で非同期実行。Supabase 保存失敗が UI に通知されない。localStorage には常に保存されるため「UI上は保存成功、DBは未保存」状態が発生する |
| **R2** | **RLS 未整備（INSERT/UPDATE/DELETE）** | **P1** | 現在は SELECT policy のみ。INSERT・UPDATE を anon に許可する policy がないため、Supabase mode で write しても実際には 401 で失敗する。デモでは確認不可（demo_fallback では adapter 非呼び出し） |
| **R3** | **writeAll() が localStorage のみ** | **P2** | `writeAll()` は adapter を経由しない。最終的な項目の永続化は localStorage に依存 |
| **R4** | **複数タブ同期** | **P2** | localStorage は同一オリジン内で共有されるが、Supabase 経由した場合、別タブでの変更を他のタブが検知できない |
| **R5** | **Production config 切替が手動** | **P2** | Staging 検証のたびに `chat-supabase-config.js` を手動で書き換える必要がある |
| **R6** | **COMPLETION_DRAFT_KEY 未統合** | **P3** | 完了報告の下書きは localStorage にのみ保存。Supabase の `completion_report` jsonb カラムと統一されていない |
| **R7** | **Supabase write の冪等性未確認** | **P3** | 同一データの重複 INSERT/UPDATE が発生した場合の動作を確認していない |
| **R8** | **エラー時のユーザー体験** | **P3** | Supabase write 失敗時も localStorage 保存により UI は成功表示される。ユーザーは DB 保存失敗に気づかない |

---

## 4. RLS 本番設計で必要な Policy 案

### 4.1 現在の状態（Staging 一時ポリシー）

```sql
-- P3.8 で追加した一時ポリシー（検証用。本番では削除）
CREATE POLICY "builder_projects_select_anon_p38" ON public.builder_projects 
  FOR SELECT TO anon USING (true);
CREATE POLICY "builder_projects_select_auth_p38" ON public.builder_projects 
  FOR SELECT TO authenticated USING (true);
```

### 4.2 本番用 RLS 設計案

```sql
-- 1. RLS 有効化
ALTER TABLE public.builder_projects ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: 案件の可視性に基づく
-- visibility: public / private / partner_only / team_only
CREATE POLICY "builder_projects_select_public" ON public.builder_projects
  FOR SELECT TO anon
  USING (visibility = 'public');

CREATE POLICY "builder_projects_select_authenticated" ON public.builder_projects
  FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'partner_only', 'team_only')
    OR owner_id = auth.uid()::text
  );

-- 3. INSERT: 認証ユーザーのみ
CREATE POLICY "builder_projects_insert_authenticated" ON public.builder_projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()::text);

-- 4. UPDATE: 所有者のみ
CREATE POLICY "builder_projects_update_owner" ON public.builder_projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- 5. DELETE: 所有者のみ（Phase 4 では未使用）
CREATE POLICY "builder_projects_delete_owner" ON public.builder_projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid()::text);
```

### 4.3 アノンキーと認証の使い分け

| ロール | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `anon` | `visibility='public'` のみ | ❌ 禁止 | ❌ 禁止 | ❌ 禁止 |
| `authenticated` | 可視性に応じて | 自分の案件のみ | 自分の案件のみ | ❌ 未実装 |
| `service_role` | 全件 | 全件 | 全件 | 全件（管理画面用） |

---

## 5. localStorage 廃止可否判定表

| 対象 | 分類 | 判定 | 理由 |
|------|------|------|------|
| `writeAll(data)` | **C** | Production移行後 | 現時点では Supabase の fire-and-forget が非同期で信頼性が低い。Supabase の write が確実になった時点で廃止可能 |
| `readAll()` | **C** | Production移行後 | Supabase read が安定したら `hydrateFromSupabase()` に統一。ただしオフライン対応として残す選択肢もある |
| `ensureSeed()` | **B** | P4では維持 | 初回起動時のDemo seedとして必要。Supabase に seed データがある場合のみ不要になる |
| `seedDemoProjects()` | **B** | P4では維持 | Demo fallback の中核。Supabase 接続失敗時にローカルで動作させるために必要 |
| `persistProjectDocuments()` | **B** | P4では維持 | 内部で `writeAll()` を呼ぶ。adapter 経由の Supabase write は fire-and-forget のまま維持 |
| `persistProjectNotifications()` | **B** | P4では維持 | 同上 |
| `COMPLETION_DRAFT_KEY` | **D** | 永続的に残す | 未送信の下書きを保持する正当なユースケース。アプリケーションがクラッシュしてもデータを失わない |
| `demo_fallback` | **D** | 永続的に残す | Supabase 接続失敗時の最後の砦。全てのユーザーが Supabase に接続できる環境になるまで維持 |
| `clearForTests()` | **B** | P4では維持 | テスト用。テストフレームワークが Supabase を使ってテストするようになれば不要 |

### 判定分類の定義

| 分類 | 意味 | 判断基準 |
|------|------|---------|
| **A: すぐ廃止可能** | 現時点で localStorage 不要 | 該当なし |
| **B: P4では維持すべき** | Phase 4 では削除しない | 現時点ではリスクが高い |
| **C: Production移行後** | 本番投入後に判断 | 安定稼働が確認できてから |
| **D: 永続的に残す** | 削除すべきでない | オフライン/下書き用途として正当 |

---

## 6. Production 移行前チェックリスト

### 🟢 必須（P0）

| # | 項目 | 詳細 | 担当 |
|---|------|------|------|
| [ ] | INSERT/UPDATE RLS policy の追加 | Staging で write が通ることを確認 | P4 Phase4 実装時 |
| [ ] | fire-and-forget → await 化 | adapter.writeProject() を await し、エラーを UI に伝播 | P4 Phase4 実装時 |
| [ ] | Staging での write E2E 確認 | Supabase mode で全 write 関数が実際に保存されることを確認 | テスト |

### 🟡 推奨（P1）

| # | 項目 | 詳細 |
|---|------|------|
| [ ] | Migration の本番適用手順書作成 | `20260717130000` を本番DBに適用する手順 |
| [ ] | RLS policy migration の作成 | `supabase/migrations/` に RLS設定用 migration を追加 |
| [ ] | Staging config 切り替え機能の追加 | `chat-supabase-config.js` を環境変数で切り替え |
| [ ] | エラー通知の実装 | Supabase write 失敗時に console.error だけでなく UI にも表示 |

### 🔵 将来（P2）

| # | 項目 | 詳細 |
|---|------|------|
| [ ] | COMPLETION_DRAFT_KEY の Supabase 統合 | 完了報告下書きを `completion_report` jsonb に直接保存 |
| [ ] | 複数タブ同期 | Supabase Realtime または `storage` event で同期 |
| [ ] | オフライン対応設計 | localStorage をキャッシュとして利用し、オンライン復帰時に同期 |
| [ ] | `writeAll()`/`readAll()` の廃止 | Supabase のみに移行 |

---

## 7. 推奨ロードマップ

```
現状（P4 Phase3完了）
  └─ localStorage 二重書き込み + fire-and-forget adapter
  
Phase 4（今回）— 調査・判定のみ
  └─ [x] localStorage廃止可否判定
  └─ [ ] RLS本番設計（未実装）
  
↑ ここまで完了 ↓

P4 Phase4 実装フェーズ（今後の作業）
  ┌─ Step 1: RLS Policy migration 作成
  │   └─ supabase/migrations/20260718000000_builder_calendar_rls.sql
  │
  ├─ Step 2: fire-and-forget → await 化
  │   ├─ adapter.writeProject() を await するよう変更
  │   └─ エラーを呼び出し元に伝播
  │
  ├─ Step 3: Staging write E2E 確認
  │   ├─ RLS policy 適用（INSERT/UPDATE）
  │   └─ 全write関数のSupabase保存確認
  │
  ├─ Step 4: エラー通知の実装
  │   └─ Supabase write 失敗時の UI 表示
  │
  ├─ Step 5: 環境切り替え機能
  │   └─ chat-supabase-config.js の動的切替
  │
  └─ Step 6（C判定）: localStorage廃止判断
      ├─ writeAll() / readAll() の Supabase 完全移行
      └─ ensureSeed() の seed データを Supabase に移動
```

---

## 8. Phase 4 で実装すべき内容 / まだ実装しない内容

### 実装すべき内容（P4 Phase4 実装フェーズ）

| 優先度 | 内容 | 理由 |
|--------|------|------|
| **P0** | RLS INSERT/UPDATE policy の作成 | 現在 Supabase write が常に 401 で失敗する |
| **P0** | adapter.writeProject() の await 化 | fire-and-forget はデータ喪失リスク |
| **P1** | Migration の本番適用手順 | Production 移行に必須 |
| **P1** | エラー通知の実装 | ユーザーが保存失敗に気づけるように |
| **P2** | 環境切り替え機能 | 検証のたびに手動変更は非効率 |

### まだ実装しない内容

| 内容 | 理由 |
|------|------|
| localStorage の完全廃止 | C 判定。Production 移行後に判断 |
| `writeAll()` / `readAll()` の削除 | C 判定。Supabase write の信頼性確認後 |
| `COMPLETION_DRAFT_KEY` の削除 | D 判定。下書き用途として永続的に維持 |
| `seedDemoProjects()` の削除 | B/D 判定。Demo fallback として残す |
| 複数タブ同期 | P2 将来課題。Phase 4 スコープ外 |
| オフライン対応 | P2 将来課題。Phase 4 スコープ外 |

---

## 9. 結論

### localStorage 廃止は **まだできない。**

| 観点 | 判定 |
|------|------|
| 技術的準備 | ✅ Phase1-3で全writeのadapter経由化完了 |
| 権限（RLS） | ❌ INSERT/UPDATE policy 未整備 |
| 信頼性 | ❌ fire-and-forget では廃止リスク大 |
| 環境切り替え | ❌ 手動変更が必要 |
| エラー通知 | ❌ 未実装 |

### 推奨する次のアクション

1. **RLS policy migration を作成する**（INSERT/UPDATE を含む）
2. **adapter.writeProject() を await 化する**（fire-and-forget を廃止）
3. **Staging で write E2E テストを実行する**
4. **上記完了後に localStorage 廃止を再判断する**