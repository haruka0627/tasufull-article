# Business Directory — DB / Data Model 設計

**最終更新:** 2026-06-27  
**前提 AD:** [DECISIONS.md](./DECISIONS.md) **AD-013**  
**関連:** [business-directory-subscription-model.md](./business-directory-subscription-model.md) · [business-directory-mvp-design.md](./business-directory-mvp-design.md) · [business-directory-self-service-design.md](./business-directory-self-service-design.md)  
**状態:** **設計のみ** — migration · コード · UI · Stripe 実装は **未着手**

---

## 1. 設計目的

Business Directory を **掲載型 SaaS** として実装する前に、データ構造 · 状態管理 · プラン制御を正本化する。

| 原則 | 内容 |
| --- | --- |
| **Self-Service** | 事業者が CRUD · 運営は審査のみ |
| **初回最小** | listings + profile + photo 1 · 子テーブルは公開後 |
| **プラン制御** | `plan_features` で編集可否 · 表示上限 |
| **既存分離** | `listings` / `business_listings`（Marketplace/Platform）とは **別名前空間** |
| **Marketplace / Platform** | 成約手数料モデル **変更なし** |

---

## 2. ER 概要

```text
auth.users
    │
    └── business_directory_listings (1..n per owner · MVP は 1)
            ├── business_directory_profiles (1:1)
            ├── business_directory_photos (1..n)
            ├── business_directory_business_hours (0..n)
            ├── business_directory_social_links (0..n)
            ├── business_directory_tlv_videos (0..n)
            ├── business_directory_review_requests (0..n)
            └── business_directory_audit_logs (0..n)

business_directory_categories (参照)
business_directory_plan_features (マスタ)
```

**命名:** 接頭辞 `business_directory_` で Marketplace `listings` と衝突回避。

---

## 3. メインエンティティ

### 3.1 `business_directory_listings`

掲載の **ライフサイクル正本**（検索 · 公開状態 · プラン · 種別）。

| 列 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | uuid | PK | `gen_random_uuid()` |
| `owner_user_id` | uuid | ✅ | FK → `auth.users` |
| `listing_type` | text | ✅ | `shop_retail` · `business_service` |
| `status` | text | ✅ | §4 状態 |
| `plan_code` | text | ✅ | `free` · `standard` · `pro` · `premium` |
| `category_id` | uuid | ✅ | FK → categories |
| `display_name` | text | ✅ | 店舗名 / サービス名 |
| `slug` | text | ✅ | URL 用 · owner 内 unique |
| `service_areas` | text[] | ✅ | 対応地域コード |
| `hp_mode` | text | ✅ | `external_redirect` · `full_page`（§8） |
| `website_url` | text | — | 公式 HP（任意） |
| `search_text` | tsvector | — | 検索用（将来トリガ） |
| `plan_assigned_at` | timestamptz | — | プラン反映日 |
| `published_at` | timestamptz | — | 初回公開日 |
| `suspended_at` | timestamptz | — | 停止日 |
| `archived_at` | timestamptz | — | 退会日 |
| `stripe_customer_id` | text | — | 将来 Stripe |
| `stripe_subscription_id` | text | — | 将来 Stripe |
| `created_at` | timestamptz | ✅ | — |
| `updated_at` | timestamptz | ✅ | — |

**インデックス（案）:** `(status, listing_type)` · `(category_id)` · `(owner_user_id)` · GIN `service_areas`

---

### 3.2 `business_directory_profiles`

掲載 **詳細プロフィール**（listings と 1:1）。

| 列 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `listing_id` | uuid | PK/FK | → listings |
| `company_name` | text | ✅ | 会社名 |
| `contact_name` | text | ✅ | 担当者 |
| `contact_email` | text | ✅ | 審査通知 |
| `contact_phone` | text | ✅ | — |
| `postal_code` | text | — | — |
| `prefecture` | text | ✅ | — |
| `city` | text | ✅ | — |
| `address_line1` | text | ✅ | 番地 |
| `address_line2` | text | — | 建物等 |
| `latitude` | numeric | — | 地図（Standard+） |
| `longitude` | numeric | — | 地図 |
| `short_description` | text | ✅ | 初回短文（80〜150 字） |
| `full_description` | text | — | 公開後拡張 |
| `shop_sales_genre` | text | — | 店舗: 販売ジャンル |
| `shop_main_products` | text | — | 店舗: 公開後 |
| `service_summary` | text | — | 業務: 主なサービス |
| `price_range_text` | text | — | 業務: 料金目安 |
| `achievements_text` | text | — | 業務: 実績 |
| `licenses_text` | text | — | 業務: 資格・許認可 |
| `staff_intro_text` | text | — | 業務: スタッフ |
| `contact_mode` | text | — | `external_url` · `form` · `talk`（Pro+） |
| `contact_target_url` | text | — | 問い合わせ先 |
| `terms_accepted_at` | timestamptz | ✅ | 規約同意 |
| `updated_at` | timestamptz | ✅ | — |

**type 固有項目** は初回最小列 + 公開後テキスト列。深い構造は将来 jsonb 拡張可。

---

### 3.3 `business_directory_categories`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_type` | text | `shop_retail` · `business_service` |
| `parent_id` | uuid | 階層 · nullable |
| `code` | text | 安定キー |
| `name` | text | 表示名 |
| `sort_order` | int | — |
| `is_active` | boolean | — |

---

### 3.4 `business_directory_photos`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `kind` | text | `logo` · `cover` · `gallery` · `product` · `work_sample` · `staff` |
| `storage_bucket` | text | Supabase Storage |
| `storage_path` | text | — |
| `alt_text` | text | — |
| `sort_order` | int | — |
| `is_primary` | boolean | 初回 1 枚 = true |
| `created_at` | timestamptz | — |

**プラン上限:** Free=1 · Standard=10 · Pro=20（`plan_features` 参照）

---

### 3.5 `business_directory_business_hours`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `day_of_week` | smallint | 0=日 … 6=土 · null=定休日ルール |
| `opens_at` | time | — |
| `closes_at` | time | — |
| `is_closed` | boolean | 定休 |
| `note` | text | 「不定休」等 |
| `sort_order` | int | — |

初回申請は profiles 側テキストでも可 · 公開後に正規化。

---

### 3.6 `business_directory_social_links`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `platform` | text | `instagram` · `x` · `facebook` · `line` · `youtube` · `other` |
| `url` | text | — |
| `sort_order` | int | — |

Standard+ · MVP 初回フォームには **含めない**。

---

### 3.7 `business_directory_tlv_videos`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `tlv_video_id` | uuid | TLV 既存動画 ID（参照のみ） |
| `embed_url` | text | キャッシュ |
| `title` | text | — |
| `purpose` | text | `store_intro` · `work_sample` · `product_intro` |
| `sort_order` | int | — |
| `created_at` | timestamptz | — |

Pro+ · TLV 側 migration なし。

---

### 3.8 `business_directory_plan_features`

プラン × 機能フラグ **マスタ**（seed データ想定）。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `plan_code` | text PK | `free` · `standard` · `pro` · `premium` |
| `max_photos` | int | — |
| `max_tlv_videos` | int | — |
| `max_social_links` | int | — |
| `allow_business_hours` | boolean | — |
| `allow_sns` | boolean | — |
| `allow_tlv` | boolean | — |
| `allow_contact_form` | boolean | — |
| `allow_analytics` | boolean | — |
| `allow_ai_recommend` | boolean | — |
| `search_boost_weight` | int | Pro 上位表示 |
| `allow_multi_listing` | boolean | Premium |
| `allow_connect_checkout` | boolean | Premium/Future |
| `stripe_price_id` | text | nullable |
| `display_name` | text | — |
| `updated_at` | timestamptz | — |

**アプリ層:** 編集 API は `plan_features` を読み、拒否理由を返す（DB CHECK よりアプリ制御を優先 · MVP）。

---

### 3.9 `business_directory_review_requests`

運営 **審査キュー**（ユーザー口コミ `reviews` とは別）。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `request_type` | text | `initial_publish` · `content_update` · `plan_upgrade` |
| `status` | text | `open` · `approved` · `rejected` |
| `submitted_by` | uuid | owner_user_id |
| `submitted_at` | timestamptz | — |
| `reviewed_by` | uuid | 運営 user · nullable |
| `reviewed_at` | timestamptz | — |
| `reject_reason_code` | text | テンプレ |
| `reject_reason_note` | text | — |
| `snapshot_json` | jsonb | 申請時点の主要フィールド |

**フロー:** 事業者が公開申請 → `review_requests.open` + listings.status=`review_requested`

---

### 3.10 `business_directory_audit_logs`

全状態変更 · 運営操作の **監査正本**。

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `listing_id` | uuid FK | — |
| `actor_user_id` | uuid | 事業者 or 運営 |
| `actor_role` | text | `owner` · `ops` · `system` |
| `action` | text | §4.3 |
| `from_status` | text | nullable |
| `to_status` | text | nullable |
| `metadata` | jsonb | 差分要約 · IP 等 |
| `created_at` | timestamptz | — |

**append-only** · UPDATE/DELETE 禁止（RLS + ポリシー設計方針）。

---

## 4. 掲載ステータス

### 4.1 状態一覧

| status | 意味 | 検索表示 |
| --- | --- | --- |
| `draft` | 下書き · 未申請 | ❌ |
| `review_requested` | 公開申請済 · 運営審査待ち | ❌ |
| `published` | 公開中 | ✅ |
| `rejected` | 審査却下 | ❌ |
| `suspended` | 運営停止 · 規約違反 | ❌ |
| `unpublished` | 事業者非公開 · 一時停止 | ❌ |
| `archived` | 退会 · 履歴保持 | ❌ |

**注:** MVP 設計 doc の `pending_review` は **`review_requested` と同義**（data model 正本は `review_requested`）。

### 4.2 状態遷移

```text
                    ┌─────────────────┐
                    │     draft       │
                    └────────┬────────┘
                             │ 公開申請（事業者）
                             ▼
                    ┌─────────────────┐
         差戻し     │ review_requested│     承認
        ┌──────────│                 │──────────┐
        │          └────────┬────────┘          │
        ▼                   │                   ▼
   ┌─────────┐              │            ┌─────────────┐
   │  draft  │◄─────────────┘            │  published  │
   └─────────┘   再編集→再申請           └──────┬──────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │ 内容更新（要審査）          │ 運営停止                    │ 退会
                    ▼                            ▼                            ▼
           ┌─────────────────┐           ┌─────────────┐              ┌─────────────┐
           │ review_requested│           │  suspended  │─────────────►│  archived   │
           └────────┬────────┘           └─────────────┘   復帰不可    └─────────────┘
                    │ 承認
                    └──────────────────────────► published
```

### 4.3 audit `action` 例

| action | 説明 |
| --- | --- |
| `listing.created` | 初回作成 |
| `listing.submit_review` | 公開申請 |
| `listing.approve` | 運営承認 |
| `listing.reject` | 差戻し |
| `listing.publish` | 公開確定 |
| `listing.suspend` | 停止 |
| `listing.unsuspend` | 停止解除 → published |
| `listing.archive` | 退会 |
| `listing.plan_change` | プラン変更 |
| `profile.update` | プロフィール更新 |
| `ops.force_edit` | 規約違反時のみ |

---

## 5. プラン制御

### 5.1 編集可否マトリクス（アプリ + seed）

| 機能 | free | standard | pro | premium |
| --- | --- | --- | --- | --- |
| 基本情報 | ✅ | ✅ | ✅ | ✅ |
| 写真 max | 1 | 10 | 20 | 50 |
| SNS | ❌ | ✅ | ✅ | ✅ |
| 営業時間 | ❌ | ✅ | ✅ | ✅ |
| TLV | ❌ | ❌ | ✅ | ✅ |
| 問い合わせ導線 | 外部URLのみ | 外部 | 内蔵 | 内蔵+チャット |
| 検索 boost | 0 | 0 | 10 | 20 |
| 複数 listing | ❌ | ❌ | ❌ | ✅ |

### 5.2 契約状態（将来 · listings 列）

| `subscription_status` | MVP |
| --- | --- |
| `none` | ✅ 手動プラン |
| `trialing` | 将来 |
| `active` | 将来 Stripe |
| `past_due` | 将来 · 表示降格 |
| `canceled` | 将来 · Free 降格 |

MVP では `plan_code` 手動設定 · Stripe 列は NULL。

---

## 6. Self-Service データフロー

### 6.1 初回公開申請（最小）

```text
INSERT listings (draft → review_requested)
INSERT profiles (必須列)
INSERT photos (1 row, is_primary=true)
INSERT review_requests (initial_publish, open)
INSERT audit_logs (submit_review)
```

### 6.2 公開後編集

| 変更種別 | listings.status | review_requests |
| --- | --- | --- |
| 軽微（電話のみ等 · 将来定義） | `published` 維持 | 不要 |
| 主要（名称 · カテゴリ · 写真 primary 等） | → `review_requested` | `content_update` |
| 運営承認後 | → `published` | `approved` |

MVP は **初回 + 全主要変更を審査** でも可（シンプル優先）。

---

## 7. 公式 HP モード（`hp_mode`）

| hp_mode | 条件 | 公開ページ UX |
| --- | --- | --- |
| `external_redirect` | `website_url` あり | 最小カード + **公式サイト CTA** |
| `full_page` | URL なし or 事業者選択 | TASFUL 掲載ページを **簡易 HP** |

`website_url` は両モードで保持可（full_page でもリンク表示）。

---

## 8. RLS 設計方針（migration 前 · 設計のみ）

| ロール | listings | profiles | photos | review_requests | audit_logs |
| --- | --- | --- | --- | --- | --- |
| **owner** | CRUD own draft/review | CRUD own | CRUD own | INSERT own · SELECT own | INSERT via app |
| **anon** | SELECT published のみ | SELECT published join | SELECT published join | ❌ | ❌ |
| **authenticated** | SELECT published | SELECT published | SELECT published | ❌ | ❌ |
| **ops** | ALL | ALL | ALL | UPDATE status | INSERT |

**Safe view 案:** `business_directory_listings_public` — `status=published` のみ anon SELECT。

---

## 9. 既存テーブルとの境界

| 既存 | Business Directory | 関係 |
| --- | --- | --- |
| `public.listings` | `business_directory_listings` | **別テーブル** · 商品/求人/スキル |
| `public.business_listings` | 同上 | 移行 Epic まで共存 |
| Marketplace Checkout | — | **触らない** |
| Platform Connect / deals | — | **触らない** |

---

## 10. 将来拡張（設計余地のみ）

| テーブル | 用途 |
| --- | --- |
| `business_directory_user_reviews` | 口コミ（Standard+） |
| `business_directory_reports` | 通報 |
| `business_directory_analytics_daily` | Pro アクセス解析 |
| `business_directory_listing_group` | Premium 複数店舗 |

MVP 設計 doc §6 の `business_directory_reviews` / `reports` は上記に統合命名。

---

**実装:** `supabase/migrations/20260711100000_business_directory_phase1_schema.sql` · seed `20260711100001_*` · `scripts/test-business-directory-phase1-schema.mjs`

**Migration 適用:** 未実施（リポジトリ追加のみ · staging で別途 apply）

---

## 参照

- [DECISIONS.md](./DECISIONS.md) AD-013
- [business-directory-ui-flow-design.md](./business-directory-ui-flow-design.md)
- [reports/business-directory-data-model-design.md](../reports/business-directory-data-model-design.md)
