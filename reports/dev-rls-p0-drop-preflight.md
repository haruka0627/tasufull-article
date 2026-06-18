# P0 dev RLS Drop Preflight

**実施日:** 2026-06-17  
**種別:** 監査のみ（**SQL 適用禁止 / DROP 実行禁止**）  
**根拠:** [`dev-rls-cleanup-plan.md`](dev-rls-cleanup-plan.md) · [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) · 対象 SQL / apply / verify 静的レビュー

**対象 DB:** linked Supabase `ddojquacsyqesrjhcvmn`（2026-06-17 監査記録）

---

## 総合判定: **WARNING**

**P0 dev DROP へ進行可能** — ただし以下を守ること:

1. **`apply-marketplace-rls.mjs` を丸ごと実行しない**（P3 `*_select_public` 再作成リスク）
2. **Marketplace / ops / Push は `apply-supabase-rls-p0-drop-dev.mjs` に未包含** — 分割実行必須
3. **`talk-call-push-rls-production.sql` は DROP 専用ではなく prod 再適用** — P0 DROP バッチと分離
4. **安否 verify 前に JWT 再発行**（`verify-anpi-rls-real-db.mjs` 9/18 FAIL · JWT expired 記録あり）

prod ポリシーはリンク DB 上 **dev と併存**しており、DROP 前提（prod 存在）は **P0 全表で満たす**。DROP SQL 自体は **dev / staging のみ**を対象とし **再実行可能（IF EXISTS）**。

---

## 1. P0 DROP 対象の確定

| ドメイン | 分類 | ポリシー数 | DROP スクリプト | 備考 |
|----------|------|------------|-----------------|------|
| **TALK notifications / drafts / follow** | **今回 DROP する** | 16 | `sql/talk-rls-drop-dev-policies.sql` | prod 併存確認済 |
| **安否 Phase1** | **存在時のみ DROP** | 8 | `sql/anpi-rls-drop-dev-policies.sql` | リンク DB: dev **未検出** · IF EXISTS で no-op 可 |
| **安否 Phase2 no-response** | **今回 DROP する** | 6 | `sql/anpi-no-response-phase2-drop-dev-policies.sql` | prod 併存 · Critical |
| **Marketplace** | **今回 DROP する** | 10 | `sql/marketplace-rls-drop-dev-policies.sql` | P1–P3 + safe view 前提 |
| **TALK Push** | **存在時のみ DROP** | 7 | `sql/talk-call-push-rls-production.sql`（dev 節） | Phase7 prod 適用済みなら **既 DROP 済みの可能性** |
| **ops staging PoC** | **存在時のみ DROP** | 可変 | `sql/ops-rls-drop-dev-policies.sql` | 監査: ops prod OK · staging 未検出の可能性 |
| **favorites** | **今回 DROP しない** | — | なし | P1 · 本番 owner RLS 未整備 |
| **blocked_users** | **今回 DROP しない** | — | なし | P1 · 同上 |
| **moderation_logs** | **今回 DROP しない** | — | なし | P1 |
| **reports** | **今回 DROP しない** | — | なし | P1 |

### 今回 DROP しない（明示）

| 対象 | 理由 |
|------|------|
| 本番 `*_prod` / `*_own` / `*_owner` / `*_participant` / `*_ops` | prod 維持 |
| `gen_ai_*` `using(false)` deny | 意図的 deny |
| `transaction_*` Allow all public | P1 別 Epic · P0 スコープ外 |
| favorites / blocked_users / moderation_logs / reports | **本番 policy 未整備 · 保留** |

---

## 2. DROP 対象一覧（今回実行対象）

### 2.1 TALK — 16 本

```
talk_notifications_{select,insert,update,delete}_dev
talk_ai_drafts_{select,insert,update,delete}_dev
talk_broadcast_drafts_{select,insert,update,delete}_dev
talk_follow_subscriptions_{select,insert,update,delete}_dev
```

### 2.2 安否 Phase2 — 6 本

```
anpi_check_sessions_{select,insert,update,delete}_dev
anpi_no_response_audit_log_{select,insert}_dev
```

### 2.3 安否 Phase1 — 8 本（存在時）

```
anpi_user_contexts_{select,insert,update,delete}_dev
anpi_notification_logs_{select,insert,update,delete}_dev
```

### 2.4 Marketplace — 10 本

```
listings_{select,insert,update,delete}_dev
business_listings_{select,insert,update,delete}_dev
profiles_select_dev
members_select_dev
```

### 2.5 TALK Push — 7 本（存在時 · 別 apply）

```
talk_call_push_events_{select,insert,update}_dev
talk_push_subscriptions_{select,insert,update,delete}_dev
```

### 2.6 ops staging PoC — 存在時のみ

パターン: `{table}_{select,insert,update,delete}_staging_read`, `{table}_insert_staging_dual_write`  
テーブル: support_*, connect_issues, ai_ops_*, builder_partner_*, talk_ops_messages, member_favorites, listings

---

## 3. 保留対象一覧

| 対象 | 分類 | 理由 |
|------|------|------|
| `favorites_*_dev` | 本番未整備のため保留 | owner-scoped prod なし |
| `blocked_users_dev_all` | 保留 | P1 |
| `moderation_logs_insert_dev` | 保留 | P1 |
| `reports_insert_dev` | 保留 | P1 |
| `transaction_*` Allow all | P0 スコープ外 | dev 命名ではない |
| `ai_messages`, `chats`, `reviews` Allow all | P0 スコープ外 | 別 Epic |

---

## 4. 本番 policy 前提確認

### 4.1 ソース監査 — `using(true)` in prod ファイル

| prod SQL | `using(true)` in prod 節 | 判定 |
|----------|--------------------------|------|
| `talk-rls-production.sql` | **なし** | ✅ owner/admin 明示 |
| `anpi-rls-production.sql` | **なし** | ✅ `*_prod` + helper 関数 |
| `anpi-no-response-phase2-rls.sql` | **dev 節のみ**（L13–51） | ✅ prod 節 L84+ は scoped |
| `marketplace-rls-production.sql` | **なし**（`marketplace_is_owner` / `listing_is_public`） | ✅ |
| `marketplace-rls-p3-authenticated-owner-only.sql` | **なし** | ✅ owner-only base |
| `talk-call-push-rls-production.sql` | **なし** | ✅ callee/caller/participant |
| `ops-rls-production.sql` | **なし** | ✅ `tasu_can_manage_ops()` |

### 4.2 ドメイン別 prod ポリシー（DROP 後に残るもの）

| ドメイン | テーブル | 本番ポリシー | 条件タイプ |
|----------|----------|--------------|------------|
| TALK | `talk_notifications` | `*_own`, `*_insert_admin_fanout` | `talk_current_user_id()` / admin |
| TALK | `talk_ai_drafts`, `talk_broadcast_drafts` | `*_own` | 本人 · admin read |
| TALK | `talk_follow_subscriptions` | `*_own` | 本人 |
| 安否 P1 | `anpi_user_contexts`, `anpi_notification_logs` | `*_prod` | `anpi_can_read/write_*` |
| 安否 P2 | `anpi_check_sessions` | `*_prod` | 契約者/利用者/admin |
| 安否 P2 | `anpi_no_response_audit_log` | select/insert `_prod` | セッション参加者 · INSERT only |
| Marketplace | `listings`, `business_listings` | `*_owner` CRUD | `marketplace_is_owner(user_id)` |
| Marketplace | `profiles`, `members` | `*_owner` | 同上 |
| Marketplace 公開 | safe views 4 本 | GRANT anon/authenticated | base dev DROP 後も view 経由 |
| TALK Push | `talk_call_push_events` | callee select / caller insert / participant update | ringing 整合 |
| TALK Push | `talk_push_subscriptions` | `talk_push_subscriptions_own` | 本人 + admin |
| Connect/ops | `connect_issues` 等 | `*_ops` | `tasu_can_manage_ops()` |

### 4.3 リンク DB 実状態（[`supabase-rls-final-audit.md`](supabase-rls-final-audit.md)）

| 確認 | 結果 |
|------|------|
| dev + prod **併存**（TALK 4 表 · Phase2） | ✅ prod **存在** — DROP 安全 |
| Phase1 dev **未検出** | ✅ prod 単独 — DROP は no-op |
| `talk_call_*` dev なし | ✅ 通話 prod 単独 |
| ops 一般 user deny | ✅ prod 単独 |
| anon `talk_notifications` READ 可 | ❌ dev 残存の証拠 — DROP 必要 |
| anon `anpi_check_sessions` INSERT 201 | ❌ Phase2 dev 残存 |

### 4.4 anon / authenticated 想定（DROP 後）

| ロール | TALK 表 | 安否 Phase2 | Marketplace base | Marketplace 公開 |
|--------|---------|-------------|------------------|------------------|
| **anon** | deny | deny | deny | safe view OK |
| **authenticated 本人** | 本人行のみ | 契約者/利用者行 | owner 行 | safe view OK |
| **authenticated 他者** | deny | deny | deny | safe view 公開分のみ |
| **admin JWT** | fanout/read | admin | ops 表 | — |

---

## 5. DROP SQL 安全性確認

| チェック | talk | anpi P1 | anpi P2 | marketplace | ops | push prod |
|----------|------|---------|---------|-------------|-----|-----------|
| `DROP POLICY IF EXISTS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| テーブル名一致 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| dev / staging のみ | ✅ `*_dev` | ✅ | ✅ | ✅ `*_dev` | ✅ `*staging*` | ⚠️ dev **+ prod 再 CREATE** |
| prod 誤 DROP | ✅ なし | ✅ | ✅ | ✅ | ✅ | ⚠️ **意図的** drop→create（idempotent） |
| 再実行可能 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 注意: `talk-call-push-rls-production.sql`

- dev 7 本を DROP するが、**同一ファイル内**で `talk_call_push_events_*_callee` 等 prod も drop→create
- **P0 pure DROP バッチに含めない**
- 未適用環境のみ: `node scripts/apply-talk-call-push-supabase.mjs`（schema + phase71 + prod RLS）
- 既適用環境: dev 残存確認 SQL のみ · 残存時のみ当該ファイル再実行可

### 注意: `ops-rls-drop-dev-policies.sql`

- `listings` に staging ポリシー DROP を含む — **Marketplace dev とは別命名** · 衝突なし
- `member_favorites` テーブルが DB に無い場合も **IF EXISTS で no-op**

---

## 6. 推奨適用順序

```text
Phase A — 事前（DROP しない）
  A1. pg_policies バックアップ SELECT（dev-rls-cleanup-plan §7.1）
  A2. node scripts/issue-anpi-rls-jwt.mjs   # 安否 verify 用 JWT 更新

Phase B — P0 dev DROP（分割 · この順）
  B1. npx supabase db query --linked -f sql/talk-rls-drop-dev-policies.sql
  B2. npx supabase db query --linked -f sql/anpi-rls-drop-dev-policies.sql
  B3. npx supabase db query --linked -f sql/anpi-no-response-phase2-drop-dev-policies.sql
  B4. npx supabase db query --linked -f sql/marketplace-rls-drop-dev-policies.sql
      ※ marketplace-rls-production.sql は再実行しない
  B5. npx supabase db query --linked -f sql/ops-rls-drop-dev-policies.sql
      ※ staging 適用歴がある場合のみ

Phase C — Push（必要時のみ）
  C1. dev 残存確認（§7 SQL）
  C2. 残存時: apply-talk-call-push-supabase.mjs または talk-call-push-rls-production.sql のみ

Phase D — 確認 SQL
  D1. dev 0 件確認（dev-rls-cleanup-plan §8）

Phase E — verify（§7）
  E1〜E6 順に実行
```

**一括代替（B1–B3 のみ）:** `node scripts/apply-supabase-rls-p0-drop-dev.mjs`

---

## 7. 適用後 verify 一覧

| # | コマンド | 存在 | 要 SERVICE_ROLE | 要 JWT | DROP 後期待 |
|---|----------|------|-----------------|--------|-------------|
| 1 | `node scripts/verify-talk-rls-staging.mjs` | ✅ | ✅ | 自動発行可 | **0 errors** |
| 2 | `node scripts/issue-anpi-rls-jwt.mjs` | ✅ | — | 出力更新 | 成功 |
| 3 | `node scripts/verify-anpi-rls-real-db.mjs` | ✅ | ✅ | **ANPI_RLS_*_JWT** | **18/18 PASS** |
| 4 | `node scripts/verify-anpi-no-response-rls-p0.mjs` | ✅ | — | A/B JWT | PASS |
| 5 | `node scripts/verify-marketplace-rls.mjs` | ✅ | ✅ | 自動発行可 | **38/38 PASS** |
| 6 | `$env:SUPABASE_STRICT="1"; node scripts/test-talk-call-push-notification-design.mjs` | ✅ | ✅ | — | PASS |

**実行可否:** 全 6 コマンド **スクリプト存在確認済**（2026-06-17）。  
**前提:** `.env` または `chat-supabase-config.js` に `SUPABASE_URL` / keys。安否 #3–4 は **JWT 再発行必須**。

---

## 8. apply script 包含 / 未包含

### `scripts/apply-supabase-rls-p0-drop-dev.mjs`

| 含む | 含まない |
|------|----------|
| `talk-rls-drop-dev-policies.sql` | `marketplace-rls-drop-dev-policies.sql` |
| `anpi-rls-drop-dev-policies.sql` | `ops-rls-drop-dev-policies.sql` |
| `anpi-no-response-phase2-drop-dev-policies.sql` | `talk-call-push-rls-production.sql` |

**判定:** P0 **部分カバー（3/5 DROP ファイル）** — Marketplace / ops / Push は **手動分割必須**。

### `scripts/apply-marketplace-rls.mjs`

| 順序 | ファイル | Preflight 判定 |
|------|----------|----------------|
| 1 | `marketplace-rls-production.sql` | ⚠️ **P0 DROP 前に再実行非推奨** — P3 で DROP 済み `*_select_public` を **再作成**しうる |
| 2 | `marketplace-rls-drop-dev-policies.sql` | ✅ DROP 単体として安全 |

**推奨:** P0 では **#2 のみ**実行。prod 未適用の初回適用は別メンテナンス窗口で `apply-marketplace-rls.mjs` + P2/P3 apply。

### 分割適用すべきもの

| 項目 | 理由 |
|------|------|
| Marketplace DROP | p0 apply に未包含 · production 再実行回避 |
| ops staging DROP | p0 apply に未包含 · 存在時のみ |
| TALK Push | drop-only スクリプトなし · prod apply と一体 |
| 安否 JWT 更新 | DROP 前後で verify 可能にする |

---

## 9. WARNING 詳細（FAIL にしない理由）

| ID | 内容 | 対処 |
|----|------|------|
| W-1 | Marketplace apply が prod 再実行を含む | DROP は `marketplace-rls-drop-dev-policies.sql` **単体** |
| W-2 | p0 apply が Marketplace/ops/Push 未包含 | §10 コマンドで分割 |
| W-3 | 安否 JWT expired | DROP **前**に `issue-anpi-rls-jwt.mjs` |
| W-4 | Push dev は Phase7 prod 適用で既 DROP 済みの可能性 | §7 確認 SQL で残存確認 |
| W-5 | ops staging 未検出の可能性 | B5 は no-op 許容 |

**FAIL 条件（該当なし）:** DROP SQL が prod を誤削除 · prod SQL 未定義 · 必須 verify スクリプト欠落 — いずれも **未該当**。

---

## 10. 次に実行すべき正確なコマンド

**監査のみのため以下は未実行。** 運用時は linked プロジェクトで順に実行。

### 10.1 事前

```powershell
cd C:\Users\rubih\tasufull-article

# バックアップ（Supabase SQL Editor に貼付）
# select tablename, policyname from pg_policies
# where schemaname='public' and policyname like '%_dev' order by 1,2;

node scripts/issue-anpi-rls-jwt.mjs
```

### 10.2 P0 DROP（推奨: 分割）

```powershell
# B1–B3 一括（TALK + 安否）
node scripts/apply-supabase-rls-p0-drop-dev.mjs

# B4 Marketplace dev のみ（production.sql は実行しない）
npx supabase db query --linked --yes -f sql/marketplace-rls-drop-dev-policies.sql

# B5 ops staging（存在時のみ · 任意）
npx supabase db query --linked --yes -f sql/ops-rls-drop-dev-policies.sql
```

### 10.3 Push dev 残存時のみ

```powershell
# 確認後、残存していれば
node scripts/apply-talk-call-push-supabase.mjs
# または prod RLS のみ:
# npx supabase db query --linked --yes -f sql/talk-call-push-rls-production.sql
```

### 10.4 確認 SQL（Supabase SQL Editor）

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname like '%_dev'
order by 1, 2;
-- 期待: 0 行（Push/Phase1 未残留）
```

### 10.5 verify

```powershell
node scripts/verify-talk-rls-staging.mjs
node scripts/verify-anpi-rls-real-db.mjs
node scripts/verify-anpi-no-response-rls-p0.mjs
node scripts/verify-marketplace-rls.mjs
$env:SUPABASE_STRICT="1"
node scripts/test-talk-call-push-notification-design.mjs
```

---

## 11. 参照

| ドキュメント | 用途 |
|--------------|------|
| [`dev-rls-cleanup-plan.md`](dev-rls-cleanup-plan.md) | P0 対象 · 安全 DROP 一覧 |
| [`supabase-rls-final-audit.md`](supabase-rls-final-audit.md) | リンク DB 実状態 |
| [`release-readiness-overview.md`](release-readiness-overview.md) | BLOCKER B-1 |

---

*Preflight 監査のみ。SQL 適用・DROP 実行なし。*
