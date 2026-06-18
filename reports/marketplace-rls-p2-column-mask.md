# Marketplace RLS P2 — 公開データ列マスク / Safe Select Layer

**作成日:** 2026-06-17  
**種別:** 設計 + SQL 適用 + 最小 JS 差し替え + 検証  
**前提:** P1-S1〜S4 適用済み（[`marketplace-rls-p1-implementation.md`](marketplace-rls-p1-implementation.md)）  
**RELEASE FROZEN:** UI デザイン変更なし · 公開 fetch 経路のみ差し替え

---

## 1. エグゼクティブサマリー

| 項目 | 結果 |
|------|------|
| **Safe layer** | 4 views + `marketplace_sanitize_form_data()` |
| **anon base table SELECT** | **REVOKE**（view のみ可） |
| **payment_url anon 露出** | ✅ 解消（view 非収載 + base 直読不可） |
| **owner 管理列** | ✅ base table + JWT で維持 |
| **検証** | ✅ `node scripts/verify-marketplace-rls.mjs` **30/30 PASS** |

---

## 2. 公開 UI が必要とするカラム（調査結果）

### 2.1 `listings`（一般掲載）

| 用途 | 必要列 |
|------|--------|
| 一覧カード / AI検索 / 市場TOP | `id`, `user_id`, `listing_type`, `title`, `description`, `tags`, `publish_status`, `price_amount`, `image_url`, `thumbnail_url`, `category`, `form_data`（表示用）, `created_at`, `is_featured`, `featured_until` |
| 詳細（skill/product/job/worker） | 上記 + `product_description`, `condition`, `delivery_*`, `gallery_urls`, `images`, `options`, job/worker 拡張列 |
| 決済 UI（公開 anon） | **`onsite_payment`, `invoice_support` フラグのみ**（URL 本体は不要 — Stripe/Edge 経由） |

### 2.2 `business_listings`

| 用途 | 必要列 |
|------|--------|
| 店舗TOP / 市場検索 / 業者ボード | `id`, `user_id`, `business_category`, `company_name`, `title`, `description`, `service_area`, `status`, `rating`, `review_count`, 画像列, `form_data`（サニタイズ後） |
| 店舗詳細 | 上記 + `phone`, `business_hours`, `hp_url`, `google_map_url`, `service_menu_items`, `work_cases` 等 |

### 2.3 `profiles` / `members`（出品者表示）

| 用途 | 必要列 |
|------|--------|
| 出品者カード（`listing-seller-profile.js`） | profiles: `display_name`, `avatar_url`, `availability_status`, `work_hours` · members: `rank`, `badge_image_url`, `is_premium`, `identity_verified`, `deals_count`, `followers_count` |

**除外:** `last_seen_at`（行動追跡 · 内部状態）— UI は fallback「—」で継続

---

## 3. 非公開にしたカラム / キー

### 3.1 テーブル列（view 非収載 + anon REVOKE）

| テーブル | 非公開列 |
|----------|----------|
| `listings` | `payment_url`, `bank_transfer_info`, `featured_stripe_session_id` |
| `business_listings` | `payment_url`, `bank_transfer_info`, `pr_payment_url`, `pr_bank_info`, `featured_payment_url`, `featured_bank_info` |
| `profiles` | `last_seen_at` |

### 3.2 `form_data` 除去キー（`marketplace_sanitize_form_data`）

`payment_url`, `bank_transfer_info`, `bank_info`, `worker_payment_url`, `worker_bank_info`, `pr_payment_url`, `pr_bank_info`, `featured_payment_url`, `featured_bank_info`, `stripe_*`, `checkout_session_id`, `payment_intent_id`, `internal_notes`, `seller_memo`, `moderation_notes`, `rejected_reason`, `admin_flags`, `payment`（ネストオブジェクト全体）

---

## 4. 作成した view / 関数

| オブジェクト | 種別 | 役割 |
|--------------|------|------|
| `marketplace_sanitize_form_data(jsonb)` | FUNCTION | form_data から決済・内部キー除去 |
| `public_marketplace_listings` | VIEW | 公開 listing · 安全列のみ · `publish_status` 公開行のみ |
| `public_business_listings` | VIEW | 公開 business · 安全列のみ |
| `public_marketplace_profiles` | VIEW | 公開出品者 profile · `last_seen_at` 除外 |
| `public_marketplace_members` | VIEW | 公開出品者 member バッジ |

**設計:** definer view + `WHERE marketplace_listing_is_public` / `marketplace_profile_is_public`（P1 関数再利用）

**Grants:**

- `GRANT SELECT` on 4 views → `anon`, `authenticated`
- `REVOKE SELECT` on base 4 tables → `anon`

**ファイル:** [`sql/marketplace-public-safe-layer.sql`](../sql/marketplace-public-safe-layer.sql)  
**適用:** `node scripts/apply-marketplace-public-safe-layer.mjs`

---

## 5. 変更した参照箇所（JS · UI 非変更）

| ファイル | 変更内容 |
|----------|----------|
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `window.TasuMarketplaceRead` — public/base table 名 + auth 判定 |
| [`listings-db.js`](../listings-db.js) | 公開 fetch → `public_marketplace_listings` · owner draft → base · `getListingPayment` は authenticated のみ base |
| [`business-listings-db.js`](../business-listings-db.js) | 公開一覧/詳細 → safe view · owner fallback → base |
| [`listing-detail-loader.js`](../listing-detail-loader.js) | Supabase 直 fetch → safe view 優先 + owner fallback |
| [`listing-seller-profile.js`](../listing-seller-profile.js) | profiles/members/listing count → safe views |

**維持（base table）:** `fetchListingsByUser`, insert/update/delete, `profile-settings` upsert, `my-listings` 管理

---

## 6. 検証結果

**実行:** `node scripts/verify-marketplace-rls.mjs` → **PASS（30 項目）**

### P1（21 項目）— すべて PASS

行単位 RLS · anon draft 不可 · owner CRUD · 非 owner 分離 — 変更なし

### P2（9 項目）— すべて PASS

| テスト | 結果 |
|--------|------|
| anon `public_marketplace_listings` 読取 | ✅ |
| safe view に `payment_url` 列なし | ✅ |
| anon base `listings` 直 SELECT | ✅ 拒否 |
| owner base `payment_url` 読取 | ✅ |
| anon `public_business_listings` | ✅ |
| anon base `profiles.last_seen_at` | ✅ 拒否 |
| safe profile view | ✅ |

### anon / owner / non-owner まとめ

| ロール | 公開 listing | payment_url | draft | 他人 draft |
|--------|--------------|-------------|-------|------------|
| **anon** | safe view ✅ | ❌ | ❌ | ❌ |
| **owner JWT** | safe + base ✅ | base ✅ | base ✅ | ❌ |
| **non-owner JWT** | safe + base 公開行 ✅ | base 公開行可* | ❌ | ❌ |

\* authenticated 非 owner が base table の `payment_url` を REST 直叩きで読める可能性は **P3** 残（公開 UI 経路は safe view のみ）

---

## 7. ページ smoke 影響

| ページ | 影響 |
|--------|------|
| 市場TOP / index-home | ✅ 公開 listing + デモ merge 維持 |
| AI検索 | ✅ `fetchPublished*` → safe view |
| 店舗TOP / 検索 | ✅ `fetchPublishedBusinessListings` → safe view |
| カテゴリ一覧 | ✅ 同上 |
| 商品/掲載詳細 | ✅ UUID 詳細 safe view · デモ fallback 維持 |
| 出品者プロフィール | ✅ safe profile/member · `last_seen_at` は「—」fallback |
| 決済パネル（Supabase 実データ） | ⚠️ `payment_url` 非表示（意図通り）— デモ/Stripe Edge 経由は従来通り |

---

## 8. 残リスク

| ID | リスク | 深刻度 |
|----|--------|--------|
| R-P2-1 | authenticated **非 owner** が base table REST で公開行の `payment_url` を読める可能性 | Medium（P3） |
| R-P2-2 | `form_data` 内の未知キーに URL が残る可能性 | Low — sanitize リスト拡張で対応 |
| R-P2-3 | `users` テーブル RLS 無し（handle 露出） | Medium（P3） |
| R-P2-4 | `shop_store_products` 未マスク | Medium（P3） |
| R-P2-5 | mock `u_me` 未認証投稿は引き続き不可（P1 同様） | 運用 |

---

## 9. P3 候補

| ID | 内容 |
|----|------|
| **P3-MKT-1** | authenticated 非 owner 向け base table 危険列 REVOKE + owner 判定 policy |
| **P3-MKT-2** | `shop_store_products` safe view |
| **P3-MKT-3** | `users` RLS + public handle view |
| **P3-MKT-4** | `marketplace_sanitize_form_data` キーリスト CI 同期 / 深層 JSON 走査 |
| **P3-MKT-5** | 決済導線を Edge Function のみに統一（detail payment panel デモ依存整理） |

---

## 10. 適用手順（再現）

```bash
# P1 済み前提
node scripts/apply-marketplace-public-safe-layer.mjs
node scripts/verify-marketplace-rls.mjs
```

---

**実施:** 2026-06-17 — リンク DB 適用済み · 検証 PASS
