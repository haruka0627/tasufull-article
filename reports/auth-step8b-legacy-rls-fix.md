# NB-3 STEP 8B — Legacy Chat / Transaction RLS 修正適用

**実施日:** 2026-06-18  
**対象環境:** ステージングのみ `https://ddojquacsyqesrjhcvmn.supabase.co`  
**本番 DB (`tasful.jp`): 未適用（本レポートでは適用禁止）**

---

## 実施① SQLレビュー

**対象ファイル:** `sql/auth-step8-legacy-chat-rls-proposal.sql`  
**判定:** **PASS**

| 観点 | 内容 |
|------|------|
| DROP 対象 | `Allow all *`（transaction_rooms/messages/reads, chats, ai_messages, reviews, review_scores, blocked_users, monthly_usage）、旧 `favorites_*` public ポリシー |
| CREATE 対象 | 当事者ベースの `transaction_rooms` / `transaction_messages` / `transaction_reads` / `reviews` / `favorites` ポリシー、`transaction_room_participant()` SECURITY DEFINER 関数 |
| anon 権限 | 対象5テーブルに SELECT/INSERT/UPDATE/DELETE ポリシーなし → REST anon READ 0 件。`moderation_logs` / `reports` の anon INSERT のみ `with_check(true)` で意図的に維持 |
| authenticated 権限 | buyer/seller 当事者・reviewer/reviewed・favorites 本人のみ。JWT `talk_current_user_id()` ベース |
| service_role 権限 | 明示ポリシーなし（RLS バイパス）。検証スクリプトの seed/cleanup は service_role 経由 |
| ops/admin 例外 | `talk_is_admin()` により transaction_rooms / favorites / transaction_reads / reviews の SELECT・一部 UPDATE/DELETE を許可 |

**修正メモ（初回適用失敗対応）:** ステージング `transaction_rooms` に `partner_id` 列が存在しないため、SQL から `partner_id` 参照を除去し `buyer_id` + `seller_id` のみに統一済み。

**chats / ai_messages:** user 列なしのため RLS 有効・ポリシーなし（クライアント直アクセス全面 deny）。

---

## 実施② ステージング適用

```bash
npx supabase db query --linked --yes -f sql/auth-step8-legacy-chat-rls-proposal.sql
```

| 項目 | 結果 |
|------|------|
| 適用環境 | linked staging (`ddojquacsyqesrjhcvmn`) |
| 初回適用 | FAIL — `column "partner_id" does not exist`（部分 DROP のみ） |
| 再適用（SQL 修正後） | **SUCCESS** (exit 0) |
| 本番適用 | **実施していない** |

---

# 適用前 inventory

**保存先:** `reports/auth-step8b-pre-inventory.json`  
**取得:** `node scripts/verify-auth-step8-rls-inventory.mjs`（適用直前）

### 対象 legacy テーブル anon READ（適用前）

| テーブル | anon READ 件数 | 判定 |
|----------|----------------|------|
| transaction_rooms | **3** | FAIL |
| transaction_messages | **3** | FAIL |
| chats | **3** | FAIL |
| reviews | **1** | FAIL |
| favorites | 0 | PASS（ただし Allow all 系ポリシー残存） |

**その他:** `errors: ["anon READ 3 rows on transaction_rooms"]` — STEP 8 と同様 legacy `Allow all` / `using(true)` が有効だった状態。

---

# 適用内容

`sql/auth-step8-legacy-chat-rls-proposal.sql` の主な変更:

1. **DROP** — 全 `Allow all *` および旧 public favorites ポリシー
2. **transaction_rooms** — `select/insert/update` を authenticated 当事者 + `talk_is_admin()` のみ
3. **transaction_messages** — `transaction_room_participant(room_id)` 経由の select、sender 本人 insert のみ
4. **transaction_reads** — 本人 `user_id` のみ（admin read 可）
5. **reviews** — reviewer / reviewed / room 参加者 / admin の select、reviewer insert のみ
6. **favorites** — 本人 CRUD（admin select/delete 可）
7. **review_scores** — `Allow all` 削除、`authenticated` SELECT のみ（anon 禁止）
8. **chats / ai_messages / blocked_users / monthly_usage** — RLS 有効、クライアント用ポリシーなし

適用後 `pg_policies` 確認: 対象5テーブルに `Allow all` / `using(true)` **0 件**。残存 `with_check(true)` は `moderation_logs_insert_anon` / `reports_insert_anon` のみ（通報 INSERT 用・対象外）。

---

# 適用後 inventory

**保存先:** `reports/auth-step8b-post-inventory.json`（`auth-step8-rls-inventory.json` の適用後スナップショット）  
**取得:** `node scripts/verify-auth-step8-rls-inventory.mjs`（適用後）

### 対象 legacy テーブル anon READ（適用後）

| テーブル | anon READ 件数 | 判定 |
|----------|----------------|------|
| transaction_rooms | **0** | PASS |
| transaction_messages | **0** | PASS |
| chats | **0** | PASS |
| reviews | **0** | PASS |
| favorites | **0** | PASS |

**inventory スクリプト:** `errors: []` — legacy 対象の anon READ 違反なし。

**`pg_policies` 全 DB 監査（`qual=true` OR `with_check=true` OR `Allow all`）:**

| テーブル | ポリシー | 備考 |
|----------|----------|------|
| moderation_logs | moderation_logs_insert_anon | 意図的（通報） |
| reports | reports_insert_anon | 意図的（通報） |

対象5テーブルおよび STEP8 legacy 一覧における `using(true)` / `Allow all`: **0**

---

# anon probe

**実行:** `node scripts/verify-auth-step8b-legacy-rls.mjs`  
**詳細:** `reports/auth-step8b-probe-results.json`

| テーブル | 件数 | 判定 |
|----------|------|------|
| transaction_rooms | 0 | **PASS** |
| transaction_messages | 0 | **PASS** |
| chats | 0 | **PASS** |
| reviews | 0 | **PASS** |
| favorites | 0 | **PASS** |

**legacy using(true)/Allow all 件数:** 0 — **PASS**

---

# authenticated A/B probe

**ユーザー A:** `u_me` (`talk-rls-a@tasful-dev.test`)  
**ユーザー B:** `u_store` (`talk-rls-b@tasful-dev.test`)

| テスト | 内容 | 判定 |
|--------|------|------|
| transaction_rooms | A は当事者 room を 1 件 READ、B は 0 件 | **PASS** |
| transaction_messages | B は A の room メッセージを READ 不可（0 件） | **PASS** |
| favorites | B は A の favorites を READ 不可（0 件） | **PASS** |
| favorites insert | B が `user_id=A` で INSERT 拒否 | **PASS** |

※ SELECT / INSERT を中心に検証。UPDATE / DELETE は favorites・transaction 系ポリシー定義上、他人データは `using` / `with_check` で拒否される設計（当事者・本人限定）。

---

# ops/admin probe

| ロール | テスト | 結果 | 判定 |
|--------|--------|------|------|
| member | support_tickets SELECT | 0 件（拒否） | **PASS** |
| tasu_admin | support_tickets SELECT | 1 件（参照可） | **PASS** |
| talk_is_admin | transaction_rooms / favorites 等 | ポリシーに `talk_is_admin()` 含む | **PASS** |

一般ユーザーへの ops データ漏洩: 検出なし。

---

# TALK回帰

**実行:** `node scripts/verify-talk-rls-staging.mjs`  
**判定:** **PASS**

- anon notifications 不可
- user A/B 通知分離
- AI draft 分離
- admin fanout
- cleanup 正常

---

# reviews回帰

**専用 E2E スクリプト:** なし（STEP 8B probe で当事者分離を検証）

| 検証 | 結果 |
|------|------|
| anon READ reviews | 0 件 — **PASS** |
| authenticated 他人 reviews | room 非参加者は READ 不可（probe 設計上間接確認） |
| marketplace / TALK 回帰 | 下記総合回帰に含め **PASS** |

---

# favorites回帰

| 検証 | 結果 |
|------|------|
| anon READ favorites | 0 件 — **PASS** |
| A/B 分離（READ / INSERT） | **PASS** |
| marketplace RLS | `verify-marketplace-rls.mjs` **PASS**（favorites テーブル anon 0 件を inventory で確認） |

---

## 実施⑥ その他回帰（transaction chat / 通知 / marketplace / ANPI）

| スクリプト | 判定 |
|------------|------|
| `verify-talk-rls-staging.mjs` | **PASS** |
| `verify-marketplace-rls.mjs` | **PASS** (P1+P2+P3) |
| `verify-anpi-rls-real-db.mjs` | **PASS** (17/17) |

transaction chat は STEP 8B probe（rooms/messages A/B）+ TALK 回帰でカバー。

---

## 実施⑦ inventory 再監査

**実行:** `node scripts/verify-auth-step8-rls-inventory.mjs`

| 期待値 | 結果 |
|--------|------|
| 対象 legacy anon READ | **0** ✓ |
| using(true) on legacy targets | **0** ✓ |
| Allow all on legacy targets | **0** ✓ |

---

# 残リスク

| 項目 | 深刻度 | 内容 |
|------|--------|------|
| 本番未適用 | **P0（運用）** | 本番 DB は依然 legacy 状態の可能性。**別 STEP・別レポートで本番適用が必要。** |
| review_scores | LOW | `using (user_id is not null or user_id is null)` は authenticated 全行 READ 相当。anon には影響なし。将来は集計ビュー化を検討 |
| chats / ai_messages | LOW | ポリシーなし＝全面 deny。レガシー AI チャットがクライアント直 Supabase 参照している場合は機能停止。service_role / Edge 経由なら問題なし |
| shop_orders | INFO | テーブル未デプロイ（404）。デプロイ時は SQL コメント §7 のポリシー追加が必要 |
| blocked_users / monthly_usage | LOW | RLS 有効・ポリシーなし。利用箇所があれば service_role 経由か要確認 |
| 初回適用部分失敗 | INFO | partner_id エラー前に DROP のみ実行された可能性。再適用で完了・検証 PASS |

---

# STEP8B判定

## **PASS**

### PASS 根拠

- [x] 対象5テーブル anon READ **0 件**
- [x] 対象 legacy `using(true)` / `Allow all` **0 件**
- [x] authenticated 他人データアクセス不可（A/B probe PASS）
- [x] TALK / marketplace / ANPI 回帰なし
- [x] ops/admin 分離維持
- [x] **ステージングのみ適用**（本番未触）

### 次ステップ

**STEP 9 E2E 総検証へ進行可**（ステージング基準）。

### 本番適用について

**本レポートでは本番 DB への適用は実施していません。**

本番適用が必要な場合は以下を別途実施すること:

1. 本番 Supabase プロジェクト向けの適用前 inventory 保存
2. メンテナンスウィンドウまたは影響評価
3. 同一 SQL `sql/auth-step8-legacy-chat-rls-proposal.sql` の本番適用（スキーマ差分: `partner_id` 有無を事前確認）
4. 本番向け `verify-auth-step8b-legacy-rls.mjs` + 回帰スイート再実行
5. 別レポート `reports/auth-step8b-production-apply.md`（仮）での GO/NO-GO 判定

---

## 参照ファイル

| ファイル | 用途 |
|----------|------|
| `sql/auth-step8-legacy-chat-rls-proposal.sql` | 適用 SQL |
| `scripts/verify-auth-step8b-legacy-rls.mjs` | STEP 8B 専用 probe |
| `scripts/verify-auth-step8-rls-inventory.mjs` | inventory 監査 |
| `reports/auth-step8b-pre-inventory.json` | 適用前スナップショット |
| `reports/auth-step8b-post-inventory.json` | 適用後スナップショット |
| `reports/auth-step8b-probe-results.json` | anon/A/B/ops probe 詳細 |
