# Business Directory MVP 設計

**最終更新:** 2026-06-27  
**前提 AD:** [DECISIONS.md](./DECISIONS.md) **AD-013**  
**方針正本:** [business-directory-subscription-model.md](./business-directory-subscription-model.md)  
**状態:** **設計のみ** — コード · DB migration · UI · 決済 · Stripe 実装は **未着手**

---

## 1. 全体構造

### TASFUL 市場 TOP（4 区分）

```text
TASFUL市場
├ 商品マーケット   … 商品を買いたい
├ 店舗・販売       … 会社・店舗を探したい
├ 業務サービス     … 依頼先を探したい
└ 案件・仕事       … 仕事・人材を探したい
```

### 検索・一覧の原則

| 原則 | 内容 |
| --- | --- |
| **目的別分離** | 横断検索結果に商品 · 店舗 · 業務 · 案件を **混在させない** |
| **入口固定** | ユーザーは最初に **目的に合った区分** を選ぶ |
| **既存 HP 対応** | 公式サイト URL 登録のみで送客可 · HP なしは TASFUL 掲載ページを簡易 HP として利用 |

### Business Directory の位置づけ

**店舗・販売** と **業務サービス** の **掲載・発見** を担う。商品売買 · 案件マッチングは **含まない**（§9 参照）。

---

## 2. 掲載ページ仕様

公開ページは **metadata のみ** 掲載。決済 · 在庫 · 契約本文は MVP スコープ外。

### 2.1 店舗・販売ページ

| 項目 | MVP | プラン依存 |
| --- | --- | --- |
| 店舗名 | ✅ 必須 | — |
| 会社名 | ✅ 必須 | — |
| カテゴリ | ✅ 必須 | — |
| 住所 | ✅ 必須 | — |
| 対応地域 | ✅ | — |
| 営業時間 | Standard+ | Free は省略可 |
| 定休日 | Standard+ | Free は省略可 |
| 電話番号 | ✅ | — |
| 公式サイト URL | ✅ | Free 可 |
| SNS | Standard+ | — |
| 紹介文 | ✅ | 文字数上限 |
| 写真 | ✅ | Free: 少数 · Standard+: 複数 |
| 商品紹介 | Standard+ | テキスト + 画像（カート・Checkout なし） |
| 地図 | Standard+ | 住所から embed |
| TLV 動画 | Pro+ | 埋め込みのみ |
| 問い合わせ導線 | Pro+ | フォーム / TALK 導線（MVP は mailto / 外部 HP） |
| プラン種別 | 内部表示 | バッジは Pro で検討 |
| 掲載ステータス | 内部 | 公開時のみ一覧表示 |

**既存 HP あり:** 掲載ページは **最小情報 + 公式サイトへ送客** モードを選べる（TASFUL 内フルページは任意）。

### 2.2 業務サービスページ

| 項目 | MVP | プラン依存 |
| --- | --- | --- |
| 会社名 | ✅ 必須 | — |
| サービス名 | ✅ 必須 | — |
| カテゴリ | ✅ 必須 | — |
| 対応地域 | ✅ 必須 | — |
| 料金目安 | ✅ | テキスト（見積フォームは Premium/Future） |
| 実績 | Standard+ | テキスト |
| 施工写真 | Standard+ | — |
| スタッフ紹介 | Standard+ | 任意 |
| 公式サイト URL | ✅ | — |
| SNS | Standard+ | — |
| 紹介文 | ✅ | — |
| TLV 動画 | Pro+ | 施工事例 · 紹介動画 |
| 問い合わせ導線 | Pro+ | 同上 |
| プラン種別 | 内部 | — |
| 掲載ステータス | 内部 | — |

---

## 3. 登録フォーム（シンプル化）

**原則:** 1 画面完結を目指す · 必須は最小 · 種別選択後に **追加 3〜4 項目** のみ表示。

### 3.1 共通（必須）

| 項目 | 備考 |
| --- | --- |
| 掲載種別 | `shop_retail` / `business_service` |
| 会社名 / 店舗名 | 種別に応じラベル切替 |
| 担当者名 | — |
| メール | 連絡 · 審査通知 |
| 電話 | — |
| 所在地 | 都道府県 + 市区町村 + 番地（地図は後から） |
| 対応地域 | 複数選択可 |
| 公式サイト URL | **任意** — あれば送客優先 |
| SNS URL | 任意 · 複数は Standard 以降 |
| 紹介文 | 200〜500 字目安 |
| 写真 | Free: 最大 3 · Standard+: 10 |
| カテゴリ | 1 つ必須 |
| 希望プラン | Free / Standard / Pro（MVP は申込のみ · 課金なし） |
| 利用規約同意 | 必須チェック |

### 3.2 店舗・販売 専用（+4）

| 項目 | 備考 |
| --- | --- |
| 営業時間 | テキスト or 曜日テンプレ |
| 定休日 | 任意 |
| 商品ジャンル | カテゴリ補助 |
| 主な販売商品 | 短文 · 商品マーケット出品とは別 |

### 3.3 業務サービス 専用（+5）

| 項目 | 備考 |
| --- | --- |
| サービス内容 | 必須 |
| 料金目安 | 必須 · レンジ表記 |
| 対応可能エリア | 対応地域と連動 |
| 実績 | 任意 |
| 資格・許認可 | 任意 · 運営審査で確認 |

### フォーム UX

- **ステップ数:** MVP は **1 ステップ**（種別切替で追加フィールド表示）
- **下書き:** `draft` 保存（ローカル or 将来 DB）
- **送信後:** `pending_review` → 運営審査 → `published`

---

## 4. プラン別機能

| 機能 | Free | Standard | Pro | Premium / Future |
| --- | --- | --- | --- | --- |
| 基本情報掲載 | ✅ | ✅ | ✅ | ✅ |
| 写真 | 少数（≤3） | 複数 | 複数 | 複数 |
| 検索露出 | 低 | 通常 | **上位表示** | 広告枠 |
| 専用掲載ページ | 簡易 | ✅ フル | ✅ | ✅ |
| 営業時間 · 定休日 | — | ✅ | ✅ | ✅ |
| SNS | — | ✅ | ✅ | ✅ |
| 口コミ | — | ✅ 閲覧 | ✅ | ✅ |
| 公式サイト URL | ✅ | ✅ | ✅ | ✅ |
| TLV 動画 | — | — | ✅ | ✅ |
| 問い合わせ導線 | 外部 URL のみ | 外部 | TASFUL 内 | TASFUL 内 + チャット |
| アクセス解析 | — | — | ✅ | ✅ |
| AI 紹介対象 | — | — | ✅ | ✅ |
| 複数店舗管理 | — | — | — | ✅ |
| 広告枠 | — | — | — | ✅ |
| 予約 · 見積 · チャット · Connect | — | — | — | ✅ |
| 成果報酬オプション | — | — | — | ✅（月額 + 成果報酬） |

**MVP:** プランは **申込・表示のみ**。Stripe サブスク課金は **別 Epic**。

---

## 5. 管理画面設計

**対象:** 運営（AI 秘書 OPS とは独立 · 将来連携可）

| 機能 | MVP | 備考 |
| --- | --- | --- |
| 掲載申請一覧 | ✅ | `pending_review` フィルタ |
| 審査（承認 / 差戻し） | ✅ | 差戻し理由テンプレ |
| 公開 / 非公開 | ✅ | `published` ↔ `suspended` |
| プラン変更 | ✅ 手動 | 将来 Stripe 連動 |
| 掲載情報編集 | ✅ | 事業者申請内容の修正 |
| 写真管理 | ✅ | 不適切画像の削除 |
| 通報 / 不正確認 | ✅ | `business_directory_reports` |
| 契約ステータス確認 | 📋 表示のみ | MVP は決済なし · **将来 Stripe Subscription ID 列を予約** |

### 将来 Stripe 接続（設計のみ）

```text
business_directory_profiles.stripe_customer_id     (nullable)
business_directory_profiles.stripe_subscription_id (nullable)
business_directory_plans.stripe_price_id           (nullable)
```

MVP では **NULL 許容 · UI 非表示** でスキーマ余地のみ。

---

## 6. DB 設計案（migration 禁止 · 設計のみ）

### 6.1 テーブル候補

#### `business_directory_profiles`

掲載の正本（店舗 · 業務を 1 テーブルで `listing_type` 分岐）。

| 列（案） | 型 | 備考 |
| --- | --- | --- |
| `id` | uuid PK | — |
| `owner_user_id` | uuid FK | auth.users |
| `listing_type` | enum | `shop_retail` · `business_service` |
| `status` | enum | §6.2 |
| `plan_id` | uuid FK | → plans |
| `display_name` | text | 店舗名 or サービス名 |
| `company_name` | text | — |
| `category_id` | uuid FK | — |
| `address_*` | text | 分割保存 |
| `service_area` | text[] | 対応地域 |
| `phone` | text | — |
| `email` | text | 担当連絡 |
| `website_url` | text | 公式 HP |
| `sns_urls` | jsonb | — |
| `description` | text | 紹介文 |
| `type_specific` | jsonb | 営業時間 / 料金目安 / 資格等 |
| `tlv_video_ids` | uuid[] | TLV 動画参照（Pro+） |
| `contact_mode` | enum | `external_url` · `form` · `talk` |
| `stripe_customer_id` | text nullable | 将来 |
| `stripe_subscription_id` | text nullable | 将来 |
| `published_at` | timestamptz | — |
| `created_at` / `updated_at` | timestamptz | — |

#### `business_directory_media`

| 列（案） | 備考 |
| --- | --- |
| `profile_id` FK | — |
| `kind` | `photo` · `logo` · `staff` · `work_sample` |
| `storage_path` | Supabase Storage |
| `sort_order` | — |

#### `business_directory_categories`

| 列（案） | 備考 |
| --- | --- |
| `id` | — |
| `listing_type` | 店舗用 / 業務用ツリー |
| `name` | — |
| `parent_id` | 階層 |

#### `business_directory_plans`

| 列（案） | 備考 |
| --- | --- |
| `code` | `free` · `standard` · `pro` · `premium` |
| `features` | jsonb · §4 機能フラグ |
| `stripe_price_id` | nullable |

#### `business_directory_reviews`

| 列（案） | 備考 |
| --- | --- |
| `profile_id` | Standard+ |
| `author_user_id` | 認証ユーザー |
| `rating` | 1–5 |
| `body` | テキスト |
| `status` | `pending` · `published` · `hidden` |

#### `business_directory_reports`

| 列（案） | 備考 |
| --- | --- |
| `profile_id` | — |
| `reporter_user_id` | — |
| `reason` | enum |
| `status` | `open` · `resolved` |

### 6.2 掲載ステータス

| status | 意味 |
| --- | --- |
| `draft` | 下書き · 未申請 |
| `pending_review` | 申請済 · 運営審査待ち |
| `published` | 公開中 · 検索対象 |
| `suspended` | 非公開 · 規約違反等 |
| `archived` | 退会 · 履歴保持 |

**遷移:** `draft` → `pending_review` → `published` | `suspended` → `archived`

### 6.3 既存テーブルとの関係

| 既存 | 関係 |
| --- | --- |
| `listings` / `business_listings` | **別系統** — MVP は新テーブル群。移行は別 Epic |
| `shop-store-page.js` 等 | 将来 Business Directory へ段階置換 |

---

## 7. 検索 / フィルター

### MVP

| 条件 | 適用 |
| --- | --- |
| キーワード | 店舗名 · 会社名 · 紹介文 · サービス内容 |
| カテゴリ | ツリー 1 選択 |
| 地域 | 都道府県 · 市区町村 |
| 掲載種別 | `shop_retail` / `business_service` **必須スコープ** |
| プラン | Pro 優先表示（同一条件内） |

**混在禁止:** 商品マーケット · 案件検索 API とは **別エンドポイント**。

### 将来

口コミ順 · おすすめ順 · 動画あり · 営業中 · AI おすすめ

---

## 8. TLV 連携（設計のみ）

| 用途 | 掲載先 | MVP |
| --- | --- | --- |
| 店舗紹介動画 | 店舗・販売ページ | Pro+ · embed |
| 施工事例動画 | 業務サービスページ | Pro+ · embed |
| 商品紹介動画 | 店舗・販売（商品紹介セクション） | Pro+ · embed |

**方式:** `tlv_video_ids` → 既存 TLV プレイヤー embed URL（**TLV 側の新 API は今回不要**）。

**禁止:** TLV から Marketplace Checkout や Platform 案件へ直リンク混在。

---

## 9. Marketplace / Platform との境界

| 領域 | 役割 | 収益 | Business Directory との関係 |
| --- | --- | --- | --- |
| **Business Directory** | 店舗 · 会社 · 業務サービスの **掲載・発見** | 月額サブスク掲載料 | **本設計の対象** |
| **Marketplace** | **商品売買** | **成約手数料** | 商品出品フォーム · Checkout · 在庫は **含めない** |
| **Platform** | **案件 · 求人 · ワーカー · スキル** | **成約手数料** | 求人 · 応募 · Connect deal は **含めない** |

### 混在禁止（MVP）

- Business Directory 登録フォームに **商品販売フォーム** を置かない
- Business Directory 登録フォームに **求人 / 案件フォーム** を置かない
- 店舗ページから商品購入は **公式 HP 送客** または **別途 Marketplace 出品**（リンクのみ）

**Marketplace / Platform の成約手数料方針は AD-013 どおり変更しない。**

---

## 10. MVP スコープ外

| 項目 | 扱い |
| --- | --- |
| コード変更 | ❌ 本フェーズ |
| DB migration | ❌ 設計案のみ |
| UI 実装 | ❌ |
| Stripe / 決済 | ❌ 列余地のみ |
| Builder AI / TASFUL AI / AI 秘書 | ❌ 変更なし |

---

## 11. 実装フェーズ案（参考 · 未確定）

| Phase | 内容 |
| --- | --- |
| **MVP-1** | 登録フォーム · 審査 · 公開ページ · 検索（Free/Standard） |
| **MVP-2** | Pro 機能 · TLV embed · 問い合わせ導線 |
| **MVP-3** | Stripe サブスク · プラン自動反映 |
| **Future** | Premium · Connect · 成果報酬 |

---

## 参照

- [DECISIONS.md](./DECISIONS.md) AD-013
- [business-directory-subscription-model.md](./business-directory-subscription-model.md)
- [reports/business-directory-mvp-design.md](../reports/business-directory-mvp-design.md)
