# Marketplace RLS P3 — authenticated 非 owner base SELECT 禁止

**作成日:** 2026-06-17  
**種別:** SQL 適用 + 最小 JS 整理 + 検証  
**前提:** P1 ([`marketplace-rls-p1-implementation.md`](marketplace-rls-p1-implementation.md)) · P2 ([`marketplace-rls-p2-column-mask.md`](marketplace-rls-p2-column-mask.md)) 適用済み

---

## 1. エグゼクティブサマリー

| 項目 | 結果 |
|------|------|
| **base SELECT policy** | `*_select_public` **4 本 DROP** · owner-only **4 本のみ** |
| **公開閲覧** | anon / authenticated 非 owner → **safe view のみ** |
| **owner 管理** | base table + `marketplace_is_owner(user_id)` 維持 |
| **検証** | ✅ `node scripts/verify-marketplace-rls.mjs` **38/38 PASS** |

---

## 2. 実装内容

### 2.1 SQL — [`sql/marketplace-rls-p3-authenticated-owner-only.sql`](../sql/marketplace-rls-p3-authenticated-owner-only.sql)

| 操作 | 内容 |
|------|------|
| **DROP** | `listings_select_public`, `business_listings_select_public`, `profiles_select_public`, `members_select_public` |
| **維持/再作成** | `*_select_owner`（`user_id = talk_current_user_id()` 経由 `marketplace_is_owner`） |
| **Grants** | safe view 4 本 → `anon`, `authenticated` |
| **REVOKE** | base 4 テーブル `SELECT` from `anon`（P2 再確認） |

**所有者列:** 既存スキーマの `user_id text`（`auth.uid()` ではなく `talk_current_user_id()` / `member_id` クレーム）

### 2.2 JS 変更（UI 非変更）

| ファイル | 変更 |
|----------|------|
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `shouldQueryOwnerBaseTable()` 追加 · P3 コメント |
| [`listings-db.js`](../listings-db.js) | 公開 fetch → safe view · owner fallback/base CRUD 明示 |
| [`business-listings-db.js`](../business-listings-db.js) | 同上 · `fetchBusinessListingsByUser` → base |
| [`listing-detail-loader.js`](../listing-detail-loader.js) | owner base fallback を `shouldQueryOwnerBaseTable` に統一 |
| [`listing-seller-profile.js`](../listing-seller-profile.js) | 変更なし（P2 から safe view 使用済み） |

### 2.3 base table 参照残（意図的 · owner CRUD）

| ファイル | 用途 |
|----------|------|
| `listings-db.js` | insert / updatePublishStatus / getListingPayment / fetchListingsByUser |
| `business-listings-db.js` | insert / update / fetchByUser / fetchByDemoId |
| `profile-settings.js`, `member-auth.js`, `member-profile.js` | 本人 profiles upsert |
| `dashboard-data.js` | 本人 profile 行 |

---

## 3. ポリシー状態（P3 適用後）

### base table SELECT

| テーブル | ポリシー | ロール | 条件 |
|----------|----------|--------|------|
| `listings` | `listings_select_owner` | authenticated | `marketplace_is_owner(user_id)` |
| `business_listings` | `business_listings_select_owner` | authenticated | 同上 |
| `profiles` | `profiles_select_owner` | authenticated | 同上 |
| `members` | `members_select_owner` | authenticated | 同上 |

**`*_select_public`:** **0 件**

### safe view SELECT

| view | anon | authenticated |
|------|------|---------------|
| `public_marketplace_listings` | ✅ | ✅ |
| `public_business_listings` | ✅ | ✅ |
| `public_marketplace_profiles` | ✅ | ✅ |
| `public_marketplace_members` | ✅ | ✅ |

---

## 4. 検証結果（38 項目 PASS）

### P1（21）· P2（9）— すべて維持 PASS

### P3（8）— 新規

| テスト | 結果 |
|--------|------|
| non-owner B · safe view で公開 listing | ✅ |
| non-owner B · safe view に payment 列なし | ✅ |
| non-owner B · base 公開行 SELECT | ✅ 拒否 |
| non-owner B · base draft SELECT | ✅ 拒否 |
| non-owner B · base profiles SELECT | ✅ 拒否 |
| non-owner B · safe profile view | ✅ |
| owner A · base draft + payment_url | ✅ |
| `*_select_public` ポリシー 0 件 | ✅ |

### ロール別まとめ

| ロール | 公開 listing | payment_url | 他人 draft | 管理 CRUD |
|--------|--------------|-------------|------------|-----------|
| **anon** | safe view ✅ | ❌ | ❌ | ❌ |
| **auth non-owner** | safe view ✅ | ❌ base | ❌ base | ❌ |
| **auth owner** | safe + base ✅ | base ✅ | base ✅ | ✅ |

---

## 5. ページ smoke 影響

| 画面 | 影響 |
|------|------|
| 市場TOP / AI検索 / 店舗一覧 | ✅ safe view 経由 · デモ fallback 維持 |
| 詳細 / 出品者 profile | ✅ safe view |
| 出品・管理 CRUD（my-listings / post） | ✅ owner JWT + base table |
| 決済 URL パネル（Supabase 実データ） | ⚠️ 公開閲覧では非表示（P2 同様 · 意図通り） |

---

## 6. 残リスク

| ID | 内容 | 深刻度 |
|----|------|--------|
| R-P3-1 | `service_role` / SQL Editor は RLS バイパス | 運用 |
| R-P3-2 | `users` テーブル RLS 無し | Low |
| R-P3-3 | `shop_store_products` 未マスク | Medium |
| R-P3-4 | mock `u_me` 未 Auth 投稿不可 | 運用（P1 同様） |

---

## 7. 適用手順

```bash
# P1 + P2 済み前提
node scripts/apply-marketplace-rls-p3.mjs
node scripts/verify-marketplace-rls.mjs
```

---

**実施:** 2026-06-17 — リンク DB 適用済み · **38/38 PASS**
