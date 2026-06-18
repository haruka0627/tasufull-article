# Supabase RLS P0 修正レポート

**作成日:** 2026-06-17  
**種別:** SQL 適用のみ（**アプリ / UI 変更なし**）  
**対象 DB:** linked Supabase（`ddojquacsyqesrjhcvmn`）  
**前提:** [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) の P0 指摘対応

---

## 1. エグゼクティブサマリー

| 項目 | 結果 |
|------|------|
| **P0 dev ポリシー DROP** | ✅ 完了（22 本） |
| **prod ポリシー** | ✅ 維持（変更なし） |
| **RLS enabled** | ✅ 維持 |
| **`verify-talk-rls-staging.mjs`** | ✅ **PASS** |
| **`verify-anpi-rls-real-db.mjs`** | ✅ **17/17 PASS**（JWT 再発行後） |
| **Phase2 専用検証** | ✅ **PASS**（`verify-anpi-no-response-rls-p0.mjs`） |
| **残 P0（対象 6 テーブル）** | **なし** |
| **本番投入可否（P0 スコープ）** | ✅ **可**（P1 項目は別途） |

---

## 2. 適用 SQL 一覧

| 順 | ファイル | 内容 |
|----|----------|------|
| 1 | `sql/talk-rls-drop-dev-policies.sql` | TALK 4 テーブル dev 16 本 DROP |
| 2 | `sql/anpi-rls-drop-dev-policies.sql` | anpi contexts/logs dev 8 本 DROP（既に無ければ no-op） |
| 3 | `sql/anpi-no-response-phase2-drop-dev-policies.sql` | **新規** — Phase2 dev 6 本 DROP |

**適用コマンド:**

```bash
node scripts/apply-supabase-rls-p0-drop-dev.mjs
```

**適用日:** 2026-06-17 — 3 ファイルすべて exit 0、残存 dev 確認クエリ **0 行**

---

## 3. DROP した policy 一覧（22 本）

### 3.1 TALK（16 本）

| テーブル | DROP ポリシー |
|----------|---------------|
| `talk_notifications` | select_dev, insert_dev, update_dev, delete_dev |
| `talk_ai_drafts` | select_dev, insert_dev, update_dev, delete_dev |
| `talk_broadcast_drafts` | select_dev, insert_dev, update_dev, delete_dev |
| `talk_follow_subscriptions` | select_dev, insert_dev, update_dev, delete_dev |

### 3.2 安否 Phase2（6 本）— 新規 SQL

| テーブル | DROP ポリシー |
|----------|---------------|
| `anpi_check_sessions` | select_dev, insert_dev, update_dev, delete_dev |
| `anpi_no_response_audit_log` | select_dev, insert_dev |

### 3.3 安否 Phase1（8 本 — 念のため実行、DB 上は既に prod のみ）

| テーブル | DROP ポリシー |
|----------|---------------|
| `anpi_user_contexts` | select_dev, insert_dev, update_dev, delete_dev |
| `anpi_notification_logs` | select_dev, insert_dev, update_dev, delete_dev |

---

## 4. 適用前 / 適用後の差分

### 4.1 ポリシー数（P0 対象 6 テーブル）

| テーブル | 適用前 | 適用後 | 差分 |
|----------|--------|--------|------|
| `talk_notifications` | 9（dev 4 + prod 5） | **5**（prod のみ） | −4 dev |
| `talk_ai_drafts` | 8 | **4** | −4 dev |
| `talk_broadcast_drafts` | 8 | **4** | −4 dev |
| `talk_follow_subscriptions` | 8 | **4** | −4 dev |
| `anpi_check_sessions` | 7（dev 4 + prod 3） | **3**（prod のみ） | −4 dev |
| `anpi_no_response_audit_log` | 4（dev 2 + prod 2） | **2**（prod のみ） | −2 dev |

### 4.2 適用後に残る prod ポリシー（維持）

**TALK:**

- `talk_notifications_*_own` + `insert_admin_fanout`
- `talk_ai_drafts_*_own`
- `talk_broadcast_drafts_*_own`
- `talk_follow_subscriptions_*_own`

**安否 Phase2:**

- `anpi_check_sessions_select_prod` / `insert_prod` / `update_prod`
- `anpi_no_response_audit_log_select_prod` / `insert_prod`

**監査ログ immutability:** UPDATE / DELETE ポリシー **なし** → authenticated は改ざん不可（service_role のみバイパス）

### 4.3 挙動差分（実測）

| 操作 | 適用前 | 適用後 |
|------|--------|--------|
| anon READ `talk_notifications` | **3 行取得** ❌ | **0 行** ✅ |
| anon INSERT `anpi_check_sessions` | **201 成功** ❌ | **RLS 拒否** ✅ |
| user A READ user B notifications | **可能** ❌ | **不可** ✅ |
| stranger READ `anpi_check_sessions` | dev により可能 ❌ | **0 行** ✅ |
| audit log UPDATE/DELETE | dev 併存時リスク | **拒否** ✅ |

---

## 5. 検証結果

### 5.1 `verify-talk-rls-staging.mjs`

```
✓ anon cannot read notifications without auth
✓ user A reads own notifications only
✓ user B reads own notifications only
✓ user B cannot read user A AI draft
✓ non-admin cannot fanout to other user
Production RLS verification passed.
```

**適用前:** FAILED (5) — anon READ 2 行、ユーザー間 READ 漏洩  
**適用後:** **PASS**

### 5.2 `verify-anpi-rls-real-db.mjs`

**注意:** 初回実行は `.env` 内 JWT 期限切れで 9/18（RLS 問題ではない）。  
`node scripts/issue-anpi-rls-jwt.mjs --write-env` 後に再実行:

```
=== 17/17 OK ===
  preflight: anon insert 拒否
  A: anon context/logs insert 拒否
  C: user B 他人 select/update 不可
  E: admin select/update OK
```

### 5.3 Phase2 専用 — `verify-anpi-no-response-rls-p0.mjs`（新規）

```
OK  anon INSERT anpi_check_sessions 拒否
OK  anon READ talk_notifications 0 行
OK  contract_holder INSERT check session
OK  stranger READ check session 拒否
OK  contract_holder audit INSERT
OK  audit UPDATE 拒否（改ざん不可）
OK  audit DELETE 拒否
=== PASS (0 errors) ===
```

---

## 6. 残 P0 の有無

| 対象（監査 P0） | 状態 |
|-----------------|------|
| talk_notifications | ✅ 解消 |
| talk_ai_drafts | ✅ 解消 |
| talk_broadcast_drafts | ✅ 解消 |
| talk_follow_subscriptions | ✅ 解消 |
| anpi_check_sessions | ✅ 解消 |
| anpi_no_response_audit_log | ✅ 解消 |

**P0 スコープ内の残件: なし**

---

## 7. P1 として残す項目（本監査範囲外）

[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) 参照:

| ID | 内容 |
|----|------|
| P1-1 | `listings` / `business_listings` dev 全許可 |
| P1-2 | `transaction_*` Allow all public |
| P1-3 | `members` / `profiles` anon SELECT 全許可 |
| P1-4 | `favorites` public 全 CRUD |
| P1-5 | Realtime publication 見直し（favorites / transaction_*） |
| P1-6 | `ai_messages` / `chats` / `blocked_users` Allow all |

---

## 8. 本番投入可否

| 観点 | 判定 |
|------|------|
| P0 対象 6 テーブル | ✅ **本番 Ready** |
| talk_call_*（前回監査 PASS） | ✅ 変更なし |
| anpi_user_contexts / logs | ✅ prod のみ（変更なし） |
| ops / support / ai_ops | ✅ 変更なし |
| **全体プラットフォーム** | ⚠️ P1 未対応テーブルあり — **段階投入推奨** |

### 判定

- **安否 / TALK 通知・WebRTC / Phase2 未応答フロー:** ✅ **本番投入可**（P0 完了）
- **Marketplace / 取引チャット全体:** P1 対応まで限定公開 or Edge 経由のみ推奨

---

## 9. RELEASE FROZEN への影響

| 変更 | 有無 |
|------|------|
| アプリ JS/HTML/CSS | ❌ なし |
| UI | ❌ なし |
| prod RLS 緩和 | ❌ なし |
| SQL: dev DROP のみ | ✅ |
| 新機能 | ❌ なし |

**Epic LOCK（WebRTC Phase1 / 安否 Phase2 / AI音声 Phase1）:** **維持**

---

## 10. 運用メモ

```bash
# P0 再適用（新環境）
node scripts/apply-supabase-rls-p0-drop-dev.mjs

# 検証
node scripts/verify-talk-rls-staging.mjs
node scripts/issue-anpi-rls-jwt.mjs --write-env   # JWT 期限切れ時
node scripts/verify-anpi-rls-real-db.mjs
node scripts/verify-anpi-no-response-rls-p0.mjs

# dev 残存確認（0 行期待）
select tablename, policyname from pg_policies
where schemaname='public' and policyname like '%_dev'
  and tablename in (
    'talk_notifications','talk_ai_drafts','talk_broadcast_drafts',
    'talk_follow_subscriptions','anpi_check_sessions','anpi_no_response_audit_log'
  );
```

**JWT 有効期限:** `verify-anpi-rls-real-db.mjs` は `.env` の JWT 期限切れで false negative になり得る。本番 CI では `issue-anpi-rls-jwt.mjs` を先行実行すること。
