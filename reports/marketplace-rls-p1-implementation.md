# Marketplace RLS P1-S1〜S4 実装レポート

**作成日:** 2026-06-17  
**種別:** SQL 適用 + 検証（**UI / アプリコード変更なし**）  
**対象 DB:** `ddojquacsyqesrjhcvmn`（リンク済み Supabase）  
**前提:** RELEASE FROZEN 維持

---

## 1. エグゼクティブサマリー

| 項目 | 結果 |
|------|------|
| **prod policy 適用** | ✅ 18 本（4 テーブル） |
| **dev policy DROP** | ✅ 10 本 |
| **検証** | ✅ `node scripts/verify-marketplace-rls.mjs` **PASS**（21/21） |
| **公開マーケット表示** | ✅ anon 公開 listing / business_listings 読取維持 |
| **本番投入（Marketplace DB）** | ⚠️ **条件付き可** — 本 Epic 完了、残 P1（transaction_* 等）は別途 |

---

## 2. 作成 SQL

| ファイル | 用途 |
|----------|------|
| [`sql/marketplace-rls-production.sql`](../sql/marketplace-rls-production.sql) | ヘルパー関数 + prod RLS CREATE |
| [`sql/marketplace-rls-drop-dev-policies.sql`](../sql/marketplace-rls-drop-dev-policies.sql) | dev policy DROP |
| [`scripts/apply-marketplace-rls.mjs`](../scripts/apply-marketplace-rls.mjs) | 適用順オーケストレーション（prod → DROP） |
| [`scripts/verify-marketplace-rls.mjs`](../scripts/verify-marketplace-rls.mjs) | REST + JWT 自動検証 |

### 2.1 適用順（実施済み）

```bash
node scripts/apply-marketplace-rls.mjs
# 内部:
#   1) sql/marketplace-rls-production.sql
#   2) sql/marketplace-rls-drop-dev-policies.sql

node scripts/verify-marketplace-rls.mjs
```

### 2.2 新規ヘルパー関数

| 関数 | 役割 |
|------|------|
| `marketplace_listing_is_public(status, publish_at)` | `public` または公開時刻到達済み `scheduled` のみ true |
| `marketplace_is_owner(user_id)` | `talk_current_user_id()` / `talk_is_admin()` と `user_id` 突合 |
| `marketplace_profile_is_public(user_id)` | 公開 listing / business_listing を1件以上持つ出品者のみ true |

再利用: `talk_current_user_id()` · `talk_is_admin()`（[`sql/talk-rls-production.sql`](../sql/talk-rls-production.sql) と同一定義を idempotent 再作成）

### 2.3 スキーマ追補

- `business_listings.publish_at` — リンク DB に未存在だったため `ADD COLUMN IF NOT EXISTS` を prod SQL 内で実施

---

## 3. DROP した dev policy 一覧

| テーブル | ポリシー名 |
|----------|------------|
| `listings` | `listings_select_dev` · `listings_insert_dev` · `listings_update_dev` · `listings_delete_dev` |
| `business_listings` | `business_listings_select_dev` · `business_listings_insert_dev` · `business_listings_update_dev` · `business_listings_delete_dev` |
| `profiles` | `profiles_select_dev` |
| `members` | `members_select_dev` |

**DROP 後確認:** `pg_policies` で `*_dev` **0 件**（検証脚本 PASS）

---

## 4. prod policy 一覧

### 4.1 `listings`（P1-S1）

| ポリシー | CMD | ロール | 条件 |
|----------|-----|--------|------|
| `listings_select_public` | SELECT | anon, authenticated | `marketplace_listing_is_public(publish_status, publish_at)` |
| `listings_select_owner` | SELECT | authenticated | `marketplace_is_owner(user_id)` |
| `listings_insert_owner` | INSERT | authenticated | `with check (marketplace_is_owner(user_id))` |
| `listings_update_owner` | UPDATE | authenticated | owner USING + WITH CHECK |
| `listings_delete_owner` | DELETE | authenticated | `marketplace_is_owner(user_id)` |

### 4.2 `business_listings`（P1-S2）

| ポリシー | CMD | ロール | 条件 |
|----------|-----|--------|------|
| `business_listings_select_public` | SELECT | anon, authenticated | 同上 |
| `business_listings_select_owner` | SELECT | authenticated | owner |
| `business_listings_insert_owner` | INSERT | authenticated | owner check |
| `business_listings_update_owner` | UPDATE | authenticated | owner |
| `business_listings_delete_owner` | DELETE | authenticated | owner |

### 4.3 `profiles`（P1-S3）

| ポリシー | CMD | ロール | 条件 |
|----------|-----|--------|------|
| `profiles_select_public` | SELECT | anon, authenticated | `marketplace_profile_is_public(user_id)` |
| `profiles_select_owner` | SELECT | authenticated | `marketplace_is_owner(user_id)` |
| `profiles_insert_owner` | INSERT | authenticated | owner check |
| `profiles_update_owner` | UPDATE | authenticated | owner |

### 4.4 `members`（P1-S4）

| ポリシー | CMD | ロール | 条件 |
|----------|-----|--------|------|
| `members_select_public` | SELECT | anon, authenticated | `marketplace_profile_is_public(user_id)` |
| `members_select_owner` | SELECT | authenticated | owner |
| `members_insert_owner` | INSERT | authenticated | owner check |
| `members_update_owner` | UPDATE | authenticated | owner |

**合計:** prod **18 本** / dev **0 本**

---

## 5. 検証結果

**実行:** 2026-06-17 — `node scripts/verify-marketplace-rls.mjs` → **PASS**

| # | テスト | 結果 |
|---|--------|------|
| 1 | dev policy 残存なし | ✅ |
| 2 | anon — 公開 marker listing のみ READ | ✅ |
| 3 | anon — draft READ 不可 | ✅ |
| 4 | anon — INSERT 拒否 | ✅ |
| 5 | anon — UPDATE 行変更なし | ✅ |
| 6 | anon — DELETE 行削除なし | ✅ |
| 7 | owner A — 自 draft + public READ | ✅ |
| 8 | owner B — 他人 draft READ 不可 | ✅ |
| 9 | owner A — 自 draft UPDATE | ✅ |
| 10 | owner B — 他人 listing UPDATE 行変更なし | ✅ |
| 11 | owner A — 自 user_id INSERT | ✅ |
| 12 | owner A — 他 user_id INSERT 拒否 | ✅ |
| 13 | anon — draft-only 出品者 profile 不可 | ✅ |
| 14 | owner A — profiles upsert/update | ✅ |
| 15 | page smoke — 公開 listings ≥1 | ✅ |
| 16 | page smoke — 公開 business_listings ≥1 | ✅ |
| 17 | page smoke — 公開出品者 profile（`u_me`） | ✅ |
| 18 | page smoke — 公開出品者 member（`u_me`） | ✅ |
| 19 | page smoke — 公開 UUID 詳細 READ | ✅ |

**注:** PostgREST は RLS 拒否時も PATCH/DELETE で HTTP 204 を返すことがある。検証は **行内容が変わらないこと** で判定。

---

## 6. ページ影響

| 画面 / 機能 | 影響 | 備考 |
|-------------|------|------|
| **AI 検索** | ✅ 維持 | 公開 `listings` / `business_listings` + デモ fallback |
| **店舗 TOP / 検索** | ✅ 維持 | 公開 business_listings + デモ merge |
| **カテゴリ一覧** | ✅ 維持 | 公開行のみ Supabase から取得（draft 除外 — 意図通り） |
| **商品 / 掲載詳細** | ✅ 維持 | 公開 UUID は READ 可 · draft は anon 不可 |
| **出品者プロフィール** | ✅ 維持（条件付き） | **公開掲載を持つ seller** の profile/members のみ anon 可 |
| **デモ seller（`u_sachi` 等）** | ✅ 維持 | DB に公開 listing が無い seller は `DEMO_PROFILES` fallback（既存 JS） |
| **my-listings / 投稿** | ⚠️ Auth JWT 必須 | mock `u_me` + anon 直 POST は **不可**（`talk_user_id` JWT 要） |
| **profile-settings 保存** | ✅ 可能 | `profiles_update_owner` 追加済み |

### 6.1 公開プロフィールのスコープ

`profiles` / `members` の anon SELECT は **公開 listing を1件以上持つ `user_id` のみ**。  
draft-only 出品者のプロフィールは anon から不可 — プライバシー強化。詳細ページは [`listing-seller-profile.js`](../listing-seller-profile.js) のデモ fallback でカバー。

### 6.2 機密列（P2 残）

RLS は **行単位** のため、公開 listing 行の `payment_url` · `bank_transfer_info` · `phone` 等は anon が引き続き READ 可能。列マスクは **VIEW / 列 GRANT** で別 Epic（P2）。

---

## 7. 残 P1 / P2

### P1（本 Epic 外 · 未着手）

| ID | 内容 |
|----|------|
| **P1-S5〜S7** | `transaction_*` · `ai_messages` · `chats` Allow all 見直し |
| **P1-S6** | `favorites` user_id スコープ |
| **P1-S12** | `setup_marketplace_listings.sql` / `seed_u_me_rank_test.sql` 内 dev CREATE 削除 or 警告化 |
| **P1-A1** | GenAI Edge JWT 突合 |
| **P1-ST1** | Stripe Live 運用 |

### P2

| ID | 内容 |
|----|------|
| **P2-MKT-1** | 公開 listing から `payment_url` 等を列レベルで隠す VIEW |
| **P2-MKT-2** | `users` テーブル RLS（現状 RLS 無効 · handle 露出） |
| **P2-MKT-3** | mock `currentUserId` → Supabase Auth 本番導線 |
| **P2-MKT-4** | `shop_store_products` RLS（店舗商品 · 別テーブル） |

---

## 8. 本番投入可否

| スコープ | 可否 |
|----------|------|
| **P1-S1〜S4（本 Epic）** | ✅ **投入可** — prod 適用 · dev DROP · 検証 PASS |
| **Marketplace 全体** | ⚠️ **条件付き可** — 公開 EC 表示は OK · 決済 URL 列マスクは P2 |
| **TALK / 安否 / Call** | ✅ 別 Epic（P0 済） |
| **transaction / favorites** | ❌ P1-S5〜S6 まで非推奨 |
| **Live Stripe** | ❌ P1-ST1 まで不可 |

### Go 条件（Marketplace RLS）

1. ✅ `sql/marketplace-rls-production.sql` 適用
2. ✅ `sql/marketplace-rls-drop-dev-policies.sql` 適用
3. ✅ `verify-marketplace-rls.mjs` PASS
4. ✅ anon draft / CRUD 拒否
5. ✅ 公開一覧・詳細 smoke PASS

---

## 9. RELEASE FROZEN 影響

| 変更 | 抵触 |
|------|------|
| SQL prod + dev DROP | **非抵触**（セキュリティ hardening） |
| 検証脚本追加 | **非抵触** |
| UI / HTML / JS 機能 | **変更なし** ✅ |
| Stripe / TALK / 安否 / WebRTC | **変更なし** ✅ |

---

## 10. ロールバック（参考 · 未実施）

```sql
-- 緊急時のみ: dev 復旧は非推奨（セキュリティ後退）
-- prod DROP → supabase/members_profiles_rls_dev.sql + setup §5 dev 節
```

---

**実施:** 2026-06-17 — Agent  
**適用:** リンク DB へ prod → DROP 順で反映済み  
**検証:** `scripts/verify-marketplace-rls.mjs` PASS
