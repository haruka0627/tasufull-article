# dev RLS Cleanup Plan（監査のみ）

**実施日:** 2026-06-17  
**種別:** 監査・計画のみ（**修正禁止 / SQL 適用禁止**）  
**根拠:** [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) · [`release-readiness-overview.md`](release-readiness-overview.md) · リポジトリ内 SQL / apply スクリプト静的レビュー  
**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`（2026-06-17 監査時点）

---

## エグゼクティブサマリー

| 項目 | 内容 |
|------|------|
| **問題** | `using (true)` の **dev / staging PoC ポリシー**が本番 prod ポリシーと **OR 結合**され、RLS が実質無効 |
| **BLOCKER** | Release Readiness 最優先 1 位（[`release-readiness-overview.md`](release-readiness-overview.md) B-1） |
| **修正種別** | **SQL DROP のみ** — アプリ JS / UI 変更不要（RELEASE FROZEN 非抵触） |
| **リンク DB 推定 dev 残存** | **32+ 本**（`*_dev`）+ ops staging PoC（存在時） |
| **DROP スクリプト** | P0 用 **5 ファイル**（うち favorites / push は **ギャップあり**） |

---

## 1. 監査方針

| 項目 | 内容 |
|------|------|
| コード変更 | **なし** |
| SQL 適用 | **なし**（本ドキュメントは計画のみ） |
| 判定基準 | `policyname like '%_dev'` または `using(true)` + staging PoC 名 |

**PostgreSQL RLS 要点:** permissive ポリシーは **OR**。dev が 1 本でも残ると prod の制限が無効化される。

---

## 2. dev policy 一覧（リンク DB · 2026-06-17 実測）

[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) §6 より。

### 2.1 TALK — `*_dev`（Critical）

| テーブル | dev ポリシー名 | 操作 | ロール |
|----------|----------------|------|--------|
| `talk_notifications` | `talk_notifications_select_dev` | SELECT | anon, authenticated |
| | `talk_notifications_insert_dev` | INSERT | anon, authenticated |
| | `talk_notifications_update_dev` | UPDATE | anon, authenticated |
| | `talk_notifications_delete_dev` | DELETE | anon, authenticated |
| `talk_ai_drafts` | `talk_ai_drafts_{select,insert,update,delete}_dev` | CRUD | anon, authenticated |
| `talk_broadcast_drafts` | `talk_broadcast_drafts_{select,insert,update,delete}_dev` | CRUD | anon, authenticated |
| `talk_follow_subscriptions` | `talk_follow_subscriptions_{select,insert,update,delete}_dev` | CRUD | anon, authenticated |

**小計: 16 本**

**実測影響:** anon が `talk_notifications` を **3 行 READ** · `verify-talk-rls-staging.mjs` **5 FAIL**

**dev なし（良好）:**

| テーブル | 備考 |
|----------|------|
| `talk_call_sessions` | prod のみ |
| `talk_call_signals` | prod のみ |
| `talk_ops_messages` | ops admin のみ |

---

### 2.2 TALK 通話 Push — `*_dev`（要確認 · スキーマ由来）

[`sql/talk-call-push-schema.sql`](../sql/talk-call-push-schema.sql) が dev を **CREATE**。本番 RLS 適用時に DROP される設計。

| テーブル | dev ポリシー名 | 本数 |
|----------|----------------|------|
| `talk_call_push_events` | `talk_call_push_events_{select,insert,update}_dev` | 3 |
| `talk_push_subscriptions` | `talk_push_subscriptions_{select,insert,update,delete}_dev` | 4 |

**小計: 7 本（schema のみ適用・prod RLS 未適用時）**

**2026-06-17 監査:** 37 テーブル一覧に **明示記載なし**（Phase7 で prod RLS 適用済みの可能性）。適用前後で末尾確認 SQL 必須。

**専用 DROP スクリプト:** **なし** — [`sql/talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) 先頭で DROP + prod CREATE。

---

### 2.3 安否 — `*_dev`

#### Phase1（リンク DB: dev **未検出** · 予防 DROP 推奨）

| テーブル | dev ポリシー名 | 本数 |
|----------|----------------|------|
| `anpi_user_contexts` | `anpi_user_contexts_{select,insert,update,delete}_dev` | 4 |
| `anpi_notification_logs` | `anpi_notification_logs_{select,insert,update,delete}_dev` | 4 |

#### Phase2（Critical · dev + prod 併存）

| テーブル | dev ポリシー名 | 本数 |
|----------|----------------|------|
| `anpi_check_sessions` | `anpi_check_sessions_{select,insert,update,delete}_dev` | 4 |
| `anpi_no_response_audit_log` | `anpi_no_response_audit_log_{select,insert}_dev` | 2 |

**Phase2 小計: 6 本（実測 dev 残存）**

**実測影響:** anon が `anpi_check_sessions` を **INSERT 201 成功**

**Phase1 prod のみ（良好）:** `anpi_user_contexts` / `anpi_notification_logs` — 現 DB は prod 単独

---

### 2.4 Marketplace — `*_dev`（High）

| テーブル | dev ポリシー名 | 本数 |
|----------|----------------|------|
| `listings` | `listings_{select,insert,update,delete}_dev` | 4 |
| `business_listings` | `business_listings_{select,insert,update,delete}_dev` | 4 |
| `profiles` | `profiles_select_dev` | 1 |
| `members` | `members_select_dev` | 1 |

**小計: 10 本**

**公開閲覧への影響:** クライアントは **safe view 第一選択**（[`marketplace-rls-final-lock-review.md`](marketplace-rls-final-lock-review.md) PASS）。base 直叩き dev 依存コードは **403/0 行** になるが、意図どおり。

---

### 2.5 Connect / 運営 / Builder 評価 — staging PoC（dev 命名以外）

**Connect 専用 `*_dev`:** **なし**（`connect_issues` は ops prod のみ）

**ops staging PoC**（`using(true)` · dev 同等の危険）:

| パターン | 対象テーブル例 |
|----------|----------------|
| `{table}_select_staging_read` | support_tickets, connect_issues, ai_ops_cases, talk_ops_messages, builder_partner_* 等 |
| `{table}_insert_staging_dual_write` | 同上 |

**DROP スクリプト:** [`sql/ops-rls-drop-dev-policies.sql`](../sql/ops-rls-drop-dev-policies.sql)

**2026-06-17 監査:** 運営 / Support / Connect / AI秘書 は **一般 JWT deny = OK**（staging 未残存または prod 単独）

---

### 2.6 Builder コア

| 項目 | 状態 |
|------|------|
| `builder_projects` 等コアテーブル | リンク DB **未作成**（REST 404） |
| `builder_partner_*` | ops admin RLS のみ · dev なし |
| 将来デプロイ時 | [`sql/builder-rls-policies.sql`](../sql/builder-rls-policies.sql) を **dev なしで**適用 |

---

### 2.7 その他 `*_dev`（本計画 P1 · スクリプト未整備）

| テーブル | dev ポリシー | DROP スクリプト |
|----------|--------------|-----------------|
| `favorites` | `favorites_{select,insert,update,delete}_dev` | **リポジトリに未作成** |
| `blocked_users` | `blocked_users_dev_all` | 未作成 |
| `moderation_logs` | `moderation_logs_insert_dev` | 未作成 |
| `reports` | `reports_insert_dev` | 未作成 |

**定義元:** `supabase/favorites.sql`, `supabase/blocked_users.sql` 等

**注意:** 命名が `_dev` でない **Allow all public** ポリシー（`transaction_*`, `ai_messages`, `chats` 等）は **本クリーンアップ P0 スコープ外** — 別 Epic P1（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) §9 P1-2）

---

## 3. 本番 policy 一覧（DROP 後に残るもの）

### 3.1 TALK

**ソース:** [`sql/talk-rls-production.sql`](../sql/talk-rls-production.sql)

| テーブル | 本番ポリシー | 要点 |
|----------|--------------|------|
| `talk_notifications` | `*_select_own`, `*_insert_own`, `*_update_own`, `*_delete_own`, `*_insert_admin_fanout` | 本人 + admin fanout |
| `talk_ai_drafts` | `*_select_own`, `*_insert_own`, `*_update_own`, `*_delete_own` | 本人 · admin read |
| `talk_broadcast_drafts` | 同上 | 本人 · admin read/update |
| `talk_follow_subscriptions` | `*_select_own`, `*_insert_own`, `*_update_own`, `*_delete_own` | 本人のみ |

**ヘルパー:** `talk_current_user_id()`, `talk_is_admin()`

**通話:** [`sql/talk-call-rls-production.sql`](../sql/talk-call-rls-production.sql) — `*_select_participant`, `*_insert_caller`, `*_update_participant`, `*_insert_participant`

**Push:** [`sql/talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) — `talk_call_push_events_select_callee`, `*_insert_caller`, `*_update_participant`, `talk_push_subscriptions_own`

---

### 3.2 安否

**Phase1:** [`sql/anpi-rls-production.sql`](../sql/anpi-rls-production.sql) — `anpi_*_{select,insert,update,delete}_prod`

**Phase2:** [`sql/anpi-no-response-phase2-rls.sql`](../sql/anpi-no-response-phase2-rls.sql) — `anpi_check_sessions_{select,insert,update}_prod`, `anpi_no_response_audit_log_{select,insert}_prod`

**ヘルパー:** `anpi_current_member_id()`, `anpi_is_admin()`, `anpi_can_read_check_session()`

---

### 3.3 Marketplace

**ソース:** [`sql/marketplace-rls-production.sql`](../sql/marketplace-rls-production.sql) + P3 [`sql/marketplace-rls-p3-authenticated-owner-only.sql`](../sql/marketplace-rls-p3-authenticated-owner-only.sql)

| テーブル | 本番ポリシー | 要点 |
|----------|--------------|------|
| `listings` / `business_listings` | `*_select_owner`, `*_insert_owner`, `*_update_owner`, `*_delete_owner` | owner CRUD のみ |
| `profiles` / `members` | `*_select_owner`, `*_insert_owner`, `*_update_owner` | owner CRUD |
| 公開閲覧 | **safe view 4 本** | `public_marketplace_*` · anon GRANT |

---

### 3.4 Connect / 運営 / Builder 評価

**ソース:** [`sql/ops-rls-production.sql`](../sql/ops-rls-production.sql)

| テーブル | 本番ポリシー | 要点 |
|----------|--------------|------|
| `connect_issues` | `connect_issues_{select,insert,update}_ops` | `tasu_can_manage_ops()` |
| `support_tickets`, `support_events`, `support_admin_notifications` | 同上パターン | ops admin |
| `ai_ops_cases`, `ai_ops_events`, `ai_ops_admin_notifications` | 同上 | ops admin |
| `builder_partner_evaluations`, `builder_partner_status_events`, `builder_partner_visibility` | 同上 | ops admin |
| `talk_ops_messages` | 同上 | ops admin |

**DELETE:** authenticated ポリシー **なし**（service_role のみ）

---

## 4. DROP 対象マトリクス

| 優先 | ドメイン | DROP 対象 | スクリプト | prod 前提 |
|------|----------|-----------|------------|-----------|
| **P0-A** | TALK 通知/下書き | 16 × `*_dev` | [`sql/talk-rls-drop-dev-policies.sql`](../sql/talk-rls-drop-dev-policies.sql) | `talk-rls-production.sql` |
| **P0-B** | 安否 Phase2 | 6 × `*_dev` | [`sql/anpi-no-response-phase2-drop-dev-policies.sql`](../sql/anpi-no-response-phase2-drop-dev-policies.sql) | `anpi-no-response-phase2-rls.sql` prod 節 |
| **P0-C** | 安否 Phase1 | 8 × `*_dev`（存在時） | [`sql/anpi-rls-drop-dev-policies.sql`](../sql/anpi-rls-drop-dev-policies.sql) | `anpi-rls-production.sql` |
| **P0-D** | Marketplace | 10 × `*_dev` | [`sql/marketplace-rls-drop-dev-policies.sql`](../sql/marketplace-rls-drop-dev-policies.sql) | `marketplace-rls-production.sql` + P2/P3 |
| **P0-E** | TALK Push | 7 × `*_dev`（存在時） | prod RLS 内 DROP（専用ファイルなし） | `talk-call-push-rls-production.sql` |
| **P0-F** | 運営 staging PoC | `*_staging_read`, `*_staging_dual_write` | [`sql/ops-rls-drop-dev-policies.sql`](../sql/ops-rls-drop-dev-policies.sql) | `ops-rls-production.sql` |
| **P1-G** | favorites 等 | 4+ × `*_dev` | **要新規 SQL**（計画のみ） | owner-scoped 本番 RLS **未整備** |

**一括 apply（P0-A〜C）:** [`scripts/apply-supabase-rls-p0-drop-dev.mjs`](../scripts/apply-supabase-rls-p0-drop-dev.mjs)  
**含まれないもの:** Marketplace · ops staging · Push · favorites

---

## 5. 影響範囲

### 5.1 DROP 後に **改善**されるもの

| 領域 | Before | After |
|------|--------|-------|
| TALK | anon / 他ユーザーが notifications / drafts 読取可 | 本人 JWT + admin のみ |
| 安否 Phase2 | anon INSERT 201 | authenticated + 契約者/利用者/admin のみ |
| Marketplace base | anon CRUD 全許可 | owner RLS + safe view 公開閲覧 |
| 監査 | `verify-talk-rls-staging` 5 FAIL | **0 errors 期待** |

### 5.2 DROP 後に **制限**されるもの（意図どおり）

| 利用パターン | 影響 |
|--------------|------|
| anon key のみで Supabase 直叩き（デバッグ） | **拒否** — 本番設計どおり |
| `talkDev=1` でも **JWT なし** REST | TALK テーブル read/write 不可 |
| Marketplace **base table** 直 SELECT（非 owner） | 0 行 — safe view 経由は継続 |
| 安否 Phase2 E2E | **有効 JWT 必須**（`issue-anpi-rls-jwt.mjs`） |

### 5.3 **影響なし / 低**（監査根拠）

| 領域 | 理由 |
|------|------|
| TALK 通話 WebRTC | dev 从未残存 · prod 単独 PASS |
| Connect UI デモ | 主に localStorage / demo seller status |
| Builder board フロント | DB コア未デプロイ · 通知は TALK 経由 |
| AI運営 ops テーブル | prod admin RLS 既に OK |
| RELEASE FROZEN 6 領域 JS | **変更不要** |

### 5.4 DROP **単独では解決しない**もの（別 Epic）

| 問題 | テーブル |
|------|----------|
| Allow all public | `transaction_rooms`, `transaction_messages`, `transaction_reads`, `ai_messages`, `chats`, `reviews`, `review_scores` 等 |
| favorites 全公開 CRUD | `favorites`（dev 削除後も **本番 owner policy 要設計**） |

---

## 6. 適用順序（推奨 · 実行は別タスク）

```text
Phase 0 — バックアップ
  0.1  pg_policies エクスポート（ロールバック用）
  0.2  末尾確認 SQL で dev 件数記録

Phase 1 — 本番 RLS 存在確認（未適用なら先に apply）
  1.1  sql/talk-rls-production.sql
  1.2  sql/talk-call-rls-production.sql
  1.3  sql/talk-call-push-rls-production.sql        （Push dev DROP 含む）
  1.4  sql/anpi-rls-production.sql
  1.5  sql/anpi-no-response-phase2-rls.sql           （prod 節）
  1.6  sql/marketplace-rls-production.sql
  1.7  sql/marketplace-public-safe-layer.sql
  1.8  sql/marketplace-rls-p3-authenticated-owner-only.sql
  1.9  sql/ops-rls-production.sql

Phase 2 — dev / staging PoC DROP（P0）
  2.1  sql/ops-rls-drop-dev-policies.sql            （staging 適用歴がある場合）
  2.2  sql/talk-rls-drop-dev-policies.sql
  2.3  sql/anpi-rls-drop-dev-policies.sql
  2.4  sql/anpi-no-response-phase2-drop-dev-policies.sql
  2.5  sql/marketplace-rls-drop-dev-policies.sql

  または部分実行:
       node scripts/apply-supabase-rls-p0-drop-dev.mjs     （2.2〜2.4）
       node scripts/apply-marketplace-rls.mjs              （1.6+2.5 を含む）
       node scripts/apply-talk-production-supabase.mjs     （1.1+2.2）

Phase 3 — 検証（§8）
  3.1  dev 0 件確認 SQL
  3.2  各 verify スクリプト
  3.3  主要 E2E 回帰（限定）

Phase 4 — P1（別チケット）
  4.1  favorites / transaction_* 本番 RLS 設計
```

**原則:** **prod 確認 → DROP → verify**。DROP のみ先行は prod 未適用時に **全 deny** リスク（Push 等）。

---

## 7. Rollback 手順

### 7.1 事前バックアップ（推奨）

```sql
-- SQL Editor: DROP 前に実行
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (policyname like '%_dev' or policyname like '%staging%')
order by tablename, policyname;
```

結果を CSV / git 外の安全な場所に保存。

### 7.2 Rollback = dev ポリシー再 CREATE

| ドメイン | 再 CREATE 元（**ステージング復旧用 · 本番では使用禁止**） |
|----------|-----------------------------------------------------------|
| TALK 4 表 | 各 schema SQL の dev 節（例: talk-sync 系） |
| 安否 Phase2 | [`sql/anpi-no-response-phase2-rls.sql`](../sql/anpi-no-response-phase2-rls.sql) L6–51 |
| 安否 Phase1 | [`sql/anpi-notification-logs.sql`](../sql/anpi-notification-logs.sql) dev 節 |
| Marketplace | [`supabase/setup_marketplace_listings.sql`](../supabase/setup_marketplace_listings.sql) dev 節 |
| favorites | [`supabase/favorites.sql`](../supabase/favorites.sql) |
| Push | [`sql/talk-call-push-schema.sql`](../sql/talk-call-push-schema.sql) L54–95 |

**注意:** Rollback は **セキュリティ後退**。本番 linked DB では **非推奨**。ローカル / 隔離ステージングのみ。

### 7.3 部分 Rollback

- 単一ポリシーのみ復旧: バックアップ行から `create policy` 文を再実行
- prod ポリシーは DROP しないため、dev 再 ADD で再び OR バイパス状態に戻る

### 7.4 検証失敗時

1. 失敗テストのテーブル / ロールを特定
2. 該当 prod ポリシー欠落 → Phase 1 の prod SQL を再 apply
3. dev 誤削除でローカル E2E のみ必要 → 7.2 で **linked 以外** に限定復旧

---

## 8. DROP 前後確認 SQL

```sql
-- dev 残存（0 行 = OK）
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname like '%_dev'
order by 1, 2;

-- staging PoC 残存（0 行 = OK）
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (policyname like '%staging_read%' or policyname like '%staging_dual_write%')
order by 1, 2;

-- テーブル別 prod/dev 件数
select tablename,
  count(*) filter (where policyname like '%_dev') as dev_count,
  count(*) filter (where policyname not like '%_dev') as other_count
from pg_policies
where schemaname = 'public'
group by tablename
order by dev_count desc, tablename;
```

---

## 9. リポジトリギャップ（計画のみ · 実装禁止）

| ID | 内容 | 推奨 |
|----|------|------|
| G-1 | `talk_call_push` 専用 drop-dev SQL なし | `talk-call-push-drop-dev-policies.sql` 新規 or P0 apply に追加 |
| G-2 | `favorites` drop-dev SQL なし | P1 で owner RLS 設計とセット |
| G-3 | `apply-supabase-rls-p0-drop-dev.mjs` が Marketplace / ops を含まない | 横断 apply スクリプト統合検討 |
| G-4 | `transaction_*` Allow all は dev 命名外 | 別 Epic · 本クリーンアップと混同しない |

---

## 10. 安全に DROP 可能な policy 一覧

**前提:** 対応する **本番 prod / owner ポリシーが適用済み**であること。  
**対象:** linked DB に **存在する場合**すべて DROP 可能（`IF EXISTS` 付きスクリプト使用）。

### P0 — スクリプトあり · prod 整備済 · **安全に DROP 可**

#### TALK（16）

```
talk_notifications_select_dev
talk_notifications_insert_dev
talk_notifications_update_dev
talk_notifications_delete_dev
talk_ai_drafts_select_dev
talk_ai_drafts_insert_dev
talk_ai_drafts_update_dev
talk_ai_drafts_delete_dev
talk_broadcast_drafts_select_dev
talk_broadcast_drafts_insert_dev
talk_broadcast_drafts_update_dev
talk_broadcast_drafts_delete_dev
talk_follow_subscriptions_select_dev
talk_follow_subscriptions_insert_dev
talk_follow_subscriptions_update_dev
talk_follow_subscriptions_delete_dev
```

#### 安否 Phase1（8 · 存在時）

```
anpi_user_contexts_select_dev
anpi_user_contexts_insert_dev
anpi_user_contexts_update_dev
anpi_user_contexts_delete_dev
anpi_notification_logs_select_dev
anpi_notification_logs_insert_dev
anpi_notification_logs_update_dev
anpi_notification_logs_delete_dev
```

#### 安否 Phase2（6）

```
anpi_check_sessions_select_dev
anpi_check_sessions_insert_dev
anpi_check_sessions_update_dev
anpi_check_sessions_delete_dev
anpi_no_response_audit_log_select_dev
anpi_no_response_audit_log_insert_dev
```

#### Marketplace（10）

```
listings_select_dev
listings_insert_dev
listings_update_dev
listings_delete_dev
business_listings_select_dev
business_listings_insert_dev
business_listings_update_dev
business_listings_delete_dev
profiles_select_dev
members_select_dev
```

#### TALK Push（7 · schema-only 適用時）

```
talk_call_push_events_select_dev
talk_call_push_events_insert_dev
talk_call_push_events_update_dev
talk_push_subscriptions_select_dev
talk_push_subscriptions_insert_dev
talk_push_subscriptions_update_dev
talk_push_subscriptions_delete_dev
```

※ [`talk-call-push-rls-production.sql`](../sql/talk-call-push-rls-production.sql) 適用済みなら **既に DROP 済み**の可能性大。

#### 運営 staging PoC（存在時 · テーブル×サフィックス）

```
{table}_select_staging_read
{table}_insert_staging_read
{table}_update_staging_read
{table}_delete_staging_read
{table}_insert_staging_dual_write
```

対象テーブル: `support_tickets`, `support_events`, `connect_issues`, `support_admin_notifications`, `ai_ops_cases`, `ai_ops_events`, `ai_ops_admin_notifications`, `builder_partner_evaluations`, `builder_partner_status_events`, `builder_partner_visibility`, `talk_ops_messages`, `member_favorites`, `listings`（staging 適用歴がある場合のみ）

---

### P1 — DROP 可能だが **本番代替 RLS 未整備 · 要設計後**

```
favorites_select_dev
favorites_insert_dev
favorites_update_dev
favorites_delete_dev
blocked_users_dev_all
moderation_logs_insert_dev
reports_insert_dev
```

**DROP 単独実行は非推奨** — favorites 等は dev 削除後 **authenticated 全 deny** または Allow all 残存のどちらか。

---

### DROP 不可（本番ポリシー · 意図的 deny）

- `talk_call_sessions_*_participant` / `talk_call_signals_*`
- `talk_notifications_*_own` / `*_insert_admin_fanout`
- `anpi_*_prod`
- `listings_*_owner` / `business_listings_*_owner` / `profiles_*_owner` / `members_*_owner`
- `connect_issues_*_ops` / `support_*_ops` / `ai_ops_*_ops`
- `gen_ai_*` の `using(false)` deny ポリシー

---

## 11. DROP 後に再実行すべきテスト一覧

### 11.1 必須（P0 ゲート）

| # | スクリプト | 期待 | ドメイン |
|---|------------|------|----------|
| 1 | `node scripts/verify-talk-rls-staging.mjs` | **0 errors** | TALK |
| 2 | `node scripts/issue-anpi-rls-jwt.mjs` → JWT 更新 | 成功 | 安否前提 |
| 3 | `node scripts/verify-anpi-rls-real-db.mjs` | **18/18 PASS**（JWT 有効時） | 安否 Phase1 |
| 4 | `node scripts/verify-anpi-no-response-rls-p0.mjs` | PASS | 安否 Phase2 |
| 5 | `node scripts/verify-marketplace-rls.mjs` | **38/38 PASS** · dev 0 | Marketplace |

### 11.2 推奨（横断回帰 · JWT / strict 前提）

| # | スクリプト | ドメイン |
|---|------------|----------|
| 6 | `SUPABASE_STRICT=1 node scripts/test-talk-call-push-notification-design.mjs` | TALK Push |
| 7 | `node scripts/test-anpi-identity-linking-browser.mjs` | 安否 |
| 8 | `node scripts/test-anpi-no-response-phase2-browser.mjs` | 安否 Phase2 |
| 9 | `node scripts/test-anpi-rls-production-browser.mjs` | 安否 RLS browser |
| 10 | `node scripts/review-talk-user-flow.mjs` | TALK 導線 |
| 11 | `node scripts/review-connect-user-flow.mjs` | Connect |
| 12 | `node scripts/review-builder-user-flow.mjs` | Builder |
| 13 | `node scripts/review-market-user-flow.mjs` | 市場EC |

### 11.3 手動 REST プローブ（credential 記載なし）

| プローブ | 期待 |
|----------|------|
| anon GET `talk_notifications` | 0 行 or 401 |
| anon POST `anpi_check_sessions` | **401/403** |
| anon GET `listings`（base） | 0 行 · safe view は公開行可 |
| non-owner JWT GET 他者 `talk_ai_drafts` | 0 行 |

### 11.4 実行順（推奨）

```text
1. 確認 SQL（§8）→ dev 0 件
2. verify-talk-rls-staging.mjs
3. issue-anpi-rls-jwt.mjs（必要時）
4. verify-anpi-rls-real-db.mjs
5. verify-anpi-no-response-rls-p0.mjs
6. verify-marketplace-rls.mjs
7. 横断 review-* / test-anpi-* （時間許せば）
```

---

## 12. 関連ファイル索引

| 種別 | パス |
|------|------|
| 横断監査 | [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) |
| Release BLOCKER | [`release-readiness-overview.md`](release-readiness-overview.md) |
| P0 DROP 一括 | [`scripts/apply-supabase-rls-p0-drop-dev.mjs`](../scripts/apply-supabase-rls-p0-drop-dev.mjs) |
| TALK apply | [`scripts/apply-talk-production-supabase.mjs`](../scripts/apply-talk-production-supabase.mjs) |
| Marketplace apply | [`scripts/apply-marketplace-rls.mjs`](../scripts/apply-marketplace-rls.mjs) |
| 安否 verify SQL | [`sql/anpi-rls-staging-verify.sql`](../sql/anpi-rls-staging-verify.sql) |

---

*監査のみ実施。SQL 適用・コード変更なし。*
