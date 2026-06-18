# Supabase RLS 最終監査レポート

**作成日:** 2026-06-17  
**種別:** 調査・監査のみ（**実装変更なし**）  
**対象 DB:** linked Supabase プロジェクト（`ddojquacsyqesrjhcvmn` 相当）  
**前提:** RELEASE FROZEN 維持 · 新機能追加なし · 既存挙動変更なし

**監査方法:**

1. リポジトリ内 SQL / RLS 定義の静的レビュー
2. リンク済み DB への `pg_policies` / `pg_publication_tables` 実状態クエリ
3. 既存検証スクリプト実行: `scripts/verify-talk-rls-staging.mjs`
4. ライブ REST プローブ（anon / JWT ユーザー、読取 + 限定的 INSERT 試行）

---

## 1. エグゼクティブサマリー

| 項目 | 判定 |
|------|------|
| **本番投入可否** | ❌ **不可**（P0 修正必須） |
| **P0 修正** | **あり** — dev ポリシー残存により RLS が実質無効化 |
| **重点テーブル talk_call_*** | ✅ 本番 RLS 適用済み・参加者分離 OK |
| **重点テーブル anpi Phase2** | ❌ dev + prod 併存 → **全公開同等** |
| **RELEASE FROZEN 影響** | SQL 適用のみ（ポリシー DROP + 既存 prod 有効化）。アプリコード変更不要 |

**結論:** スキーマと本番向け RLS **定義は揃っている**が、リンク DB には **`using (true)` の dev ポリシーが多数残存**している。PostgreSQL RLS は permissive ポリシーを **OR 結合**するため、本番ポリシーと dev ポリシーが共存すると **本番 RLS が無効化**される。本番投入前に **dev ポリシー一括削除が必須**。

---

## 2. 監査対象テーブル一覧

リンク DB に存在しポリシーが確認されたテーブル（全 **37** テーブル、RLS 無効テーブル **0**）。

| ドメイン | テーブル | RLS | ポリシー数 | 備考 |
|----------|----------|-----|------------|------|
| **TALK WebRTC** | `talk_call_sessions` | ✅ | 3 | prod のみ（dev なし） |
| | `talk_call_signals` | ✅ | 2 | prod のみ |
| **TALK** | `talk_notifications` | ✅ | 9 | dev + prod 併存 |
| | `talk_ai_drafts` | ✅ | 8 | dev + prod 併存 |
| | `talk_broadcast_drafts` | ✅ | 8 | dev + prod 併存 |
| | `talk_follow_subscriptions` | ✅ | 8 | dev + prod 併存 |
| | `talk_ops_messages` | ✅ | 3 | ops admin のみ |
| **安否 Phase2** | `anpi_check_sessions` | ✅ | 7 | **dev + prod 併存** |
| | `anpi_no_response_audit_log` | ✅ | 4 | **dev + prod 併存** |
| **安否 Phase1** | `anpi_user_contexts` | ✅ | 4 | prod のみ |
| | `anpi_notification_logs` | ✅ | 4 | prod のみ |
| **運営 / Support / AI秘書** | `support_tickets` | ✅ | 3 | `tasu_can_manage_ops()` |
| | `support_events` | ✅ | 2 | 同上 |
| | `support_admin_notifications` | ✅ | 3 | 同上 |
| | `ai_ops_cases` | ✅ | 3 | 同上 |
| | `ai_ops_events` | ✅ | 2 | 同上 |
| | `ai_ops_admin_notifications` | ✅ | 3 | 同上 |
| | `connect_issues` | ✅ | 3 | 同上 |
| **Builder（評価系）** | `builder_partner_*` | ✅ | 2–3 | ops admin のみ |
| **Marketplace** | `listings` | ✅ | 4 | dev 全許可 |
| | `business_listings` | ✅ | 4 | dev 全許可 |
| **Profile** | `members` | ✅ | 1 | dev SELECT 全許可 |
| | `profiles` | ✅ | 1 | dev SELECT 全許可 |
| **その他** | `favorites` | ✅ | 4 | public 全許可 |
| | `company_reviews` | ✅ | 4 | 適切寄り |
| | `gen_ai_3d_*` / `gen_ai_entitlements` | ✅ | 1 each | `using(false)` で deny |
| | `gen_ai_subscriptions` | ✅ | 0 | **deny all（意図通り）** |
| | `transaction_*` | ✅ | 1 each | **Allow all public** |
| | `ai_messages`, `chats`, `blocked_users`, `reviews`, `review_scores`, `monthly_usage` | ✅ | 1 each | **Allow all public** |
| | `moderation_logs`, `reports` | ✅ | 1 each | anon INSERT のみ |
| **未存在** | `shop_orders` | — | — | REST 404（未デプロイ） |
| | `builder_projects` 等コア | — | — | リンク DB に未作成 |

---

## 3. RLS 有効 / 無効一覧

| 状態 | 件数 |
|------|------|
| RLS 有効 | **全 public ユーザテーブル** |
| RLS 無効 | **0**（`relrowsecurity = false` クエリ 0 行） |

※ RLS 有効でも **dev / Allow all ポリシー** があると実質オープン。

---

## 4. 重点テーブル — ポリシー詳細

### 4.1 `talk_call_sessions` / `talk_call_signals` ✅

**適用:** `sql/talk-call-rls-production.sql`（dev ポリシー **未残存**）

| 操作 | ロール | ポリシー | 条件 |
|------|--------|----------|------|
| SELECT | authenticated | `*_select_participant` | caller / callee / admin |
| INSERT | authenticated | sessions: `*_insert_caller` | caller_id = JWT |
| UPDATE | authenticated | sessions: `*_update_participant` | 参加者 / admin |
| INSERT | authenticated | signals: `*_insert_participant` | sender + session 参加者 |
| DELETE | — | **なし** | authenticated deny |

**ライブ検証:**

| テスト | 結果 |
|--------|------|
| anon SELECT | 0 行（拒否相当） |
| anon INSERT | **401 RLS 拒否** ✅ |
| caller INSERT | 201 ✅ |
| callee SELECT / UPDATE | 200 ✅ |
| 第三者 SELECT | 0 行 ✅ |
| `verify-talk-rls-staging`（talk_notifications 含む） | dev 残存で **FAIL**（call テーブル自体は OK） |

**リスク:** **Low**（本番 RLS 単独で機能。Realtime は session/signal 両方 publication 済み — RLS でフィルタされるが、参加者以外は購読不可）

---

### 4.2 `anpi_check_sessions` / `anpi_no_response_audit_log` ❌ CRITICAL

**適用:** `sql/anpi-no-response-phase2-rls.sql` — **dev + prod 同時存在**

| ポリシー | ロール | 効果 |
|----------|--------|------|
| `*_select_dev` 等 | **anon, authenticated** | `using (true)` → **全行 R/W/D** |
| `*_select_prod` 等 | authenticated | 契約者 / 利用者 / admin 限定 |

**ライブ検証:**

| テスト | 結果 |
|--------|------|
| anon INSERT `anpi_check_sessions` | **201 成功** ❌ |
| authenticated 第三者 READ | dev により **可能** ❌ |
| audit log UPDATE/DELETE ポリシー | **なし**（prod 単独なら immutability OK） |
| dev 併存時 audit INSERT | anon から **可能**（FK 次第） ❌ |

**リスク:** **Critical** — 安否未応答イベント・監査ログが anon から改ざん可能。

---

### 4.3 `anpi_user_contexts` / `anpi_notification_logs` ⚠️

**ポリシー:** prod のみ（dev **未検出**）  
**設計:** `anpi_can_read_*` / `anpi_can_write_*` + authenticated のみ

**ライブ検証:** anon SELECT 0 行 ✅（現状 OK）

**リスク:** **Low**（現 DB 状態）。ただし将来 dev 再適用で即 Critical 化。

---

### 4.4 TALK 通知 / 下書き系 ❌

**dev ポリシー残存（各 4 本 × 4 テーブル）:**

- `talk_notifications`（prod 5 本と併存 → 計 9）
- `talk_ai_drafts`
- `talk_broadcast_drafts`
- `talk_follow_subscriptions`

**`verify-talk-rls-staging.mjs` 結果（2026-06-17）:**

```
✗ anon reads 2 rows without JWT
✗ user A reads user B row
✗ user B reads user A row
✗ user B reads user A AI draft
✗ non-admin inserted notification for other user
```

**ライブ:** anon が `talk_notifications` を **3 行 READ** ❌

**リスク:** **Critical**

---

### 4.5 運営 / Support / Connect / AI運営秘書 ✅

**適用:** `sql/ops-rls-production.sql`

| テーブル | SELECT/INSERT/UPDATE | 条件 |
|----------|----------------------|------|
| `support_tickets`, `connect_issues`, `ai_ops_cases`, `talk_ops_messages` 等 | authenticated | `tasu_can_manage_ops()` |
| DELETE | **ポリシーなし** | deny（service_role のみ） |

**ライブ:** 一般ユーザー JWT で `support_tickets` SELECT → **0 行** ✅

**リスク:** **Low**（JWT `tasu_admin` / `ops_admin` クレームが Auth 管理下にある前提）

---

### 4.6 Marketplace / Profile / Payments 系 ❌ HIGH

| テーブル | 問題 |
|----------|------|
| `listings`, `business_listings` | `*_dev` → anon CRUD 全許可 |
| `members`, `profiles` | anon SELECT 全許可 |
| `favorites` | `{public}` 全 CRUD 全許可 |
| `transaction_rooms/messages/reads` | `Allow all` → **public 全許可** |
| `gen_ai_subscriptions` | ポリシー 0 = **deny all** ✅（Edge/service_role 前提） |
| `gen_ai_3d_tickets` 等 | `using(false)` ✅ |
| `shop_orders` | テーブル未存在 |

**リスク:** **High**（決済 URL・Stripe ID を含む listing 列の露出、取引チャット全公開）

---

## 5. 確認項目チェックリスト

| # | 確認項目 | 結果 |
|---|----------|------|
| 1 | RLS が有効か | ✅ 全テーブル有効 |
| 2 | anon で読めすぎないか | ❌ talk_notifications / listings / members 等 |
| 3 | authenticated で他人データを読めないか | ❌ dev 併存テーブルで FAIL |
| 4 | insert/update/delete 過剰でないか | ❌ dev `with check (true)` 多数 |
| 5 | audit log 改ざん不可か | ⚠️ prod 設計は OK、**dev 併存で INSERT/DELETE 可能** |
| 6 | call session/signal が当事者以外不可か | ✅ prod RLS 検証 PASS |
| 7 | anpi session が本人・家族以外不可か | ❌ dev 併存で全公開 |
| 8 | dev policy が本番に残っていないか | ❌ **32+ 本残存** |
| 9 | service_role 前提処理が client から叩けないか | ✅ gen_ai_subscriptions 等は deny；ops は admin JWT 必須 |
| 10 | Realtime publication 過剰でないか | ⚠️ 下記 |

---

## 6. dev policy 残存チェック

**リンク DB で検出された dev / staging 系ポリシー（抜粋）:**

| テーブル | dev ポリシー |
|----------|--------------|
| `anpi_check_sessions` | select/insert/update/**delete**_dev |
| `anpi_no_response_audit_log` | select/insert_dev |
| `talk_notifications` | select/insert/update/delete_dev |
| `talk_ai_drafts` | 同上 |
| `talk_broadcast_drafts` | 同上 |
| `talk_follow_subscriptions` | select/insert/update/delete_dev |
| `listings` / `business_listings` | 同上 |
| `members` / `profiles` | select_dev |

**未残存（良好）:**

- `talk_call_sessions` / `talk_call_signals` — dev なし
- `anpi_user_contexts` / `anpi_notification_logs` — dev なし

**既存 DROP スクリプト（リポジトリ内）:**

| ファイル | 対象 |
|----------|------|
| `sql/talk-rls-drop-dev-policies.sql` | talk_* 4 テーブル |
| `sql/anpi-rls-drop-dev-policies.sql` | anpi_user_contexts, anpi_notification_logs |
| **未作成** | **anpi_check_sessions, anpi_no_response_audit_log** |
| **未作成** | listings / members / profiles / favorites |

---

## 7. Realtime publication 確認

**`supabase_realtime` 登録テーブル（リンク DB）:**

| テーブル | 評価 |
|----------|------|
| `talk_call_sessions` | ✅ 通話着信に必要 |
| `talk_call_signals` | ✅ WebRTC シグナリングに必要 |
| `talk_notifications` | ✅ TALK 通知 |
| `talk_ai_drafts` / `talk_broadcast_drafts` | ⚠️ 本人限定 RLS 前提 — **dev 削除後 OK** |
| `talk_follow_subscriptions` | 同上 |
| `anpi_check_sessions` | ⚠️ Phase2 ダッシュボード live 用 — **dev 削除 + prod RLS 必須** |
| `favorites` | ⚠️ 全公開 RLS 下では過剰 |
| `moderation_logs` | ⚠️ anon INSERT ポリシーと併用注意 |
| `transaction_messages` / `transaction_reads` | ❌ Allow all RLS — ** publication も危険** |

**原則:** Realtime は RLS を尊重するが、**緩い RLS + publication = イベント漏洩**。dev ポリシー削除が先。

---

## 8. リスク分類

### Critical

| ID | 内容 | テーブル |
|----|------|----------|
| C-1 | dev `using(true)` と prod 併存 → **RLS 完全バイパス** | talk_notifications, talk_ai_drafts, talk_broadcast_drafts, talk_follow_subscriptions |
| C-2 | 同上 | **anpi_check_sessions, anpi_no_response_audit_log** |
| C-3 | anon が talk_notifications を READ 可能（実測 3 行） | talk_notifications |
| C-4 | anon が anpi_check_sessions を INSERT 可能（実測 201） | anpi_check_sessions |

### High

| ID | 内容 | テーブル |
|----|------|----------|
| H-1 | listings / business_listings anon CRUD 全許可 | marketplace |
| H-2 | transaction_* Allow all public | 取引チャット |
| H-3 | members / profiles anon SELECT 全許可 | PII |
| H-4 | favorites public 全 CRUD | ユーザー行為 |

### Medium

| ID | 内容 |
|----|------|
| M-1 | ai_messages / chats / blocked_users / reviews Allow all |
| M-2 | anpi audit `insert_prod` が `talk_current_user_id()` 参照（関数未適用時の失敗リスク） |
| M-3 | Realtime に favorites / transaction_* 登録 |
| M-4 | Builder コアテーブル未デプロイ — 将来 RLS 未適用デプロイリスク |

### Low

| ID | 内容 |
|----|------|
| L-1 | talk_call_* — 本番 RLS 良好 |
| L-2 | anpi_user_contexts / logs — prod のみ |
| L-3 | ops / support / ai_ops — admin 限定 |
| L-4 | gen_ai_subscriptions — deny all（service_role 経由） |
| L-5 | gen_ai_3d_* — explicit deny |

---

## 9. 修正優先度

### P0 — 本番投入前必須

| # | 内容 | 影響 |
|---|------|------|
| P0-1 | **TALK dev ポリシー削除** | `sql/talk-rls-drop-dev-policies.sql` 実行 |
| P0-2 | **安否 Phase2 dev ポリシー削除** | 新規 SQL 必要（下記案） |
| P0-3 | **P0 後に検証再実行** | `verify-talk-rls-staging.mjs` PASS、`verify-anpi-rls-real-db.mjs` |
| P0-4 | **anon プローブ再確認** | talk_notifications 0 行、anpi_check INSERT 401/403 |

### P1 — 本番前強く推奨

| # | 内容 |
|---|------|
| P1-1 | listings / business_listings / members / profiles dev 削除 + 本番ポリシー適用 |
| P1-2 | transaction_* / ai_messages / chats の Allow all 見直し |
| P1-3 | favorites RLS を user_id スコープに |
| P1-4 | Realtime から favorites / transaction_* 除外検討 |
| P1-5 | `anpi_no_response_audit_log` に UPDATE/DELETE **明示 deny**（RESTRICTIVE policy またはポリシー非作成のままドキュメント化） |

### P2 — 後回し

| # | 内容 |
|---|------|
| P2-1 | Builder コア (`builder_projects` 等) デプロイ時 `builder-rls-policies.sql` 適用 |
| P2-2 | shop_orders デプロイ時 RLS 同時適用 |
| P2-3 | moderation_logs / reports anon INSERT → Edge Function 経由化 |
| P2-4 | ops テーブル Realtime 要否の整理 |

---

## 10. 修正 SQL 案（P0 — 新規作成推奨、未適用）

**ファイル案:** `sql/anpi-no-response-phase2-drop-dev-policies.sql`

```sql
-- 安否 Phase2 — dev ポリシー削除（本番投入前必須）
-- *_dev は using(true) のため *_prod と OR 結合され本番 RLS が無効になります。

drop policy if exists "anpi_check_sessions_select_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_insert_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_update_dev" on public.anpi_check_sessions;
drop policy if exists "anpi_check_sessions_delete_dev" on public.anpi_check_sessions;

drop policy if exists "anpi_no_response_audit_log_select_dev" on public.anpi_no_response_audit_log;
drop policy if exists "anpi_no_response_audit_log_insert_dev" on public.anpi_no_response_audit_log;

-- 残存確認（0 行が期待）
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('anpi_check_sessions', 'anpi_no_response_audit_log')
  and policyname like '%_dev';
```

**P0 適用順（推奨）:**

```text
1. sql/talk-rls-production.sql          （未適用なら）
2. sql/talk-call-rls-production.sql       （済）
3. sql/anpi-rls-production.sql            （済）
4. sql/anpi-no-response-phase2-rls.sql    （済 — prod ポリシー含む）
5. sql/talk-rls-drop-dev-policies.sql     ← P0
6. sql/anpi-rls-drop-dev-policies.sql     ← P0
7. sql/anpi-no-response-phase2-drop-dev-policies.sql  ← P0（新規）
8. 検証スクリプト再実行
```

**P1 追加案（marketplace）:** `listings` / `business_listings` の `*_dev` DROP + オーナー scoped ポリシー（別 Epic、FROZEN 解凍要）

---

## 11. service_role / client 境界

| 処理 | 想定経路 | client 直接 | 評価 |
|------|----------|-------------|------|
| WebRTC session 作成 | authenticated + talk_call RLS | INSERT caller のみ | ✅ |
| 安否 check 作成（本番） | authenticated contract_holder | dev 削除後 OK | ⚠️ |
| gen_ai Stripe 更新 | Edge Function | deny all | ✅ |
| ops チケット | admin JWT | 一般 user deny | ✅ |
| TALK fanout | admin JWT | 非 admin deny（dev 削除後） | ⚠️ |

**注意:** anon key はクライアントに埋め込み済み。**dev ポリシー = 実質 API 全開放**。

---

## 12. 最終判定

| 観点 | 判定 |
|------|------|
| 本番投入可否 | ❌ **不可** |
| P0 修正の有無 | **あり（4 項目）** |
| talk_call WebRTC | ✅ **本番 Ready**（dev 未残存） |
| anpi Phase2 | ❌ **dev 削除まで不可** |
| TALK コア | ❌ **dev 削除まで不可** |
| 運営 / ops | ✅ 現状 OK |
| RELEASE FROZEN | **SQL のみ** — アプリ/UI/機能変更不要 |

### 本番 Go 条件（再監査）

1. dev ポリシー 0 件（anpi Phase2 / TALK / 既存 anpi 含む）
2. `verify-talk-rls-staging.mjs` — **0 errors**
3. `verify-anpi-rls-real-db.mjs` — preflight anon insert 拒否
4. anon REST: `talk_notifications` / `anpi_check_sessions` INSERT/SELECT 拒否
5. talk_call 参加者分離 — 現状維持 PASS

---

## 13. RELEASE FROZEN への影響

| 変更種別 | 必要 | FROZEN 抵触 |
|----------|------|-------------|
| SQL: dev policy DROP | ✅ | **非抵触**（セキュリティ hardening） |
| SQL: 既存 prod policy 再適用 | 任意 | 非抵触 |
| アプリ JS/HTML 変更 | ❌ 不要 | — |
| WebRTC / 安否 / AI音声 仕様変更 | ❌ 不要 | — |
| 新 RLS 設計・大規模作り直し | ❌ 不要 | — |

**推奨:** P0 は **DB オペレーションのみ** で完結。Epic LOCK（WebRTC Phase1 / 安否 Phase2 / AI音声 Phase1）は **RLS hardening 後も維持可能**。

---

## 14. 参考 — 既存検証コマンド

```bash
# TALK RLS（JWT 自動発行）
node scripts/verify-talk-rls-staging.mjs

# 安否 RLS（JWT 要 .env 設定）
node scripts/verify-anpi-rls-real-db.mjs

# dev 残存確認（SQL Editor）
select tablename, policyname from pg_policies
where schemaname = 'public' and policyname like '%_dev'
order by 1, 2;
```

**2026-06-17 実測:** `verify-talk-rls-staging.mjs` → **FAILED (5)**（dev ポリシーが原因）
