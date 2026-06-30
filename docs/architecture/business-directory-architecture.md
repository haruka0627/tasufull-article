# Business Directory — Architecture SSOT

**最終更新:** 2026-06-30  
**目的:** Business Directory DB Architecture および関連実装を設計する **前提となるアーキテクチャ正本**（本ファイル）。  
**スコープ:** 設計 · 境界 · データ責務 · 状態 · 参照関係。**本ファイル自体は DB migration / コード / UI を含まない。**

---

## 1. 位置づけ

| 項目 | 内容 |
| --- | --- |
| **製品名** | Business Directory（店舗・販売 / 業務サービス 掲載） |
| **TASFUL 市場での区分** | **店舗・販売** · **業務サービス**（商品マーケット · 案件・仕事とは **目的別分離**） |
| **収益モデル** | 月額サブスク掲載（AD-013）。Marketplace 成約手数料モデルは **変更しない** |
| **Self-Service** | 事業者が CRUD · 運営は **審査のみ**（入力代行しない） |
| **正本 AD** | [DECISIONS.md](../DECISIONS.md) **AD-013** |

### 1.1 詳細設計への参照（正本）

| ドキュメント | 用途 |
| --- | --- |
| [business-directory-mvp-design.md](../business-directory-mvp-design.md) | MVP 機能 · 掲載ページ · プラン · 管理画面 |
| [business-directory-data-model-design.md](../business-directory-data-model-design.md) | **DB / ER / 列定義 / 状態遷移 / RLS 方針** |
| [business-directory-self-service-design.md](../business-directory-self-service-design.md) | 登録 · 公開申請 · 公開後編集 |
| [business-directory-subscription-model.md](../business-directory-subscription-model.md) | サブスク · プラン · 収益分離 |
| [business-directory-ui-flow-design.md](../business-directory-ui-flow-design.md) | Owner / Admin / Public UI フロー |

---

## 2. 実装ステータス（docs 正本ベース）

> **注意:** `business-directory-data-model-design.md` ヘッダーは「設計のみ」と記載されているが、[TODO.md](../TODO.md) · [PROJECT_STATUS.md](../PROJECT_STATUS.md) では Phase 1–7 · Production Step 4 まで **Go** と記録されている。**以降の DB 設計作業は TODO / PROJECT_STATUS を優先**し、data model 正本との差分があれば設計時に reconcile する。

| レイヤ | 状態（2026-06-28 時点 · docs 正本） | 参照 |
| --- | --- | --- |
| **方針 · MVP 設計** | 確定 | AD-013 · MVP design |
| **DB Phase 1 schema** | migration 存在 | `supabase/migrations/20260711100000_business_directory_phase1_schema.sql` |
| **Stripe Phase 6** | migration 存在 | `supabase/migrations/20260712100000_business_directory_phase6_stripe_subscription.sql` |
| **Owner / Admin / Public UI** | MVP-1 Complete（Phase 3–5） | `business-directory/` |
| **Production Deploy** | Step 4 **48/48 Go** | [TODO.md](../TODO.md) §Business Directory |
| **Commercial Launch** | **No-Go** | Step 5 Operational Readiness · Launch Gate OB1–OB8 |
| **MVP-2 / Premium / 予約 / 決済代行** | **未着手** | [business-directory-mvp-design.md](../business-directory-mvp-design.md) §9 |

---

## 3. システム境界

### 3.1 含む（In Scope）

- 店舗・販売（`listing_type = shop_retail`）掲載 · 発見
- 業務サービス（`listing_type = business_service`）掲載 · 発見
- 事業者 Self-Service（下書き → 審査 → 公開）
- 運営 Admin（審査 · 公開/非公開 · 通報対応）
- 公開掲載ページ（metadata 中心 · Checkout なし）
- プラン（Free / Standard / Pro / Premium）と `plan_features` による機能制御
- Stripe サブスク（Phase 6 設計 · 本番運用は Launch Gate 依存）

### 3.2 含まない（Out of Scope · 変更禁止）

| 領域 | 理由 |
| --- | --- |
| **商品マーケット Checkout** | Marketplace 成約手数料モデル維持（AD-013） |
| **案件 · 仕事マッチング** | 目的別分離 · 別検索 API |
| **Platform `listings` / `business_listings`** | **別名前空間** — 衝突回避のため `business_directory_*` 接頭辞 |
| **Builder AI / TASFUL AI / AI 秘書** | AD-013 適用外 · 別 surface |
| **TLV 動画ホスティング本体** | 掲載ページへの **embed のみ**（Pro+） |
| **予約 · 見積 · TALK · Connect 決済** | Premium / Future（TBD） |

### 3.3 将来連携（TBD · 設計のみ）

- TASFUL AI おすすめ掲載（Pro+ · `allow_ai_recommend`）
- TLV 動画 embed（`business_directory_tlv_videos`）
- TALK 問い合わせ導線（Pro+ · `contact_mode = talk`）
- 口コミ · アクセス解析（Standard+ / Pro+）

---

## 4. 論理アーキテクチャ

```text
┌─────────────────────────────────────────────────────────────┐
│  Public Web (Cloudflare Pages)                              │
│  business-directory/public/  … 一覧 · 詳細 · 検索           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Owner UI          Admin UI                                   │
│  business-directory/   business-directory/admin/              │
│  new · edit · list     審査 · 公開制御 · 通報                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ Supabase client / Edge Functions
┌───────────────────────────▼─────────────────────────────────┐
│  Supabase (Postgres + Auth + RLS)                             │
│  business_directory_* テーブル群（10+ · data model 正本）     │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ Stripe (Subscriptions)     │  … Phase 6 · Launch Gate 後
              └───────────────────────────┘
```

**検索原則:** キーワード · カテゴリ · 地域 · `listing_type` スコープ。**商品 · 案件 API とは混在禁止**（[business-directory-mvp-design.md](../business-directory-mvp-design.md) §7）。

---

## 5. データアーキテクチャ（DB 設計前提）

**列 · 型 · インデックス · RLS の詳細正本:** [business-directory-data-model-design.md](../business-directory-data-model-design.md)

### 5.1 命名規則

- 接頭辞 **`business_directory_`** — Marketplace `listings` との衝突回避
- ライフサイクル正本: **`business_directory_listings`**
- プロフィール 1:1: **`business_directory_profiles`**

### 5.2 ER 概要

```text
auth.users
    └── business_directory_listings (1..n per owner · MVP は 1 想定)
            ├── business_directory_profiles (1:1)
            ├── business_directory_photos (1..n)
            ├── business_directory_business_hours (0..n)
            ├── business_directory_social_links (0..n)
            ├── business_directory_tlv_videos (0..n)
            ├── business_directory_review_requests (0..n)
            └── business_directory_audit_logs (0..n)

business_directory_categories (参照マスタ)
business_directory_plan_features (プランマスタ)
```

### 5.3 掲載種別

| `listing_type` | 意味 | 公開ページ |
| --- | --- | --- |
| `shop_retail` | 店舗・販売 | 店舗ページ仕様（MVP design §2.1） |
| `business_service` | 業務サービス | 業務ページ仕様（MVP design §2.2） |

### 5.4 ライフサイクル状態

| `status` | 意味 |
| --- | --- |
| `draft` | 下書き |
| `review_requested` | 審査待ち |
| `published` | 公開中（一覧表示対象） |
| `suspended` | 停止 |
| `archived` | 退会 |

遷移図 · 審査ルール · RLS → **data model 正本 §4–§8**。

### 5.5 プラン

| `plan_code` | 概要 |
| --- | --- |
| `free` | 基本掲載 · 写真少数 |
| `standard` | 営業時間 · SNS · 口コミ閲覧等 |
| `pro` | 上位表示 · TLV · 問い合わせ · AI 紹介対象 |
| `premium` | **Future / TBD** — 複数店舗 · 広告 · 予約 · 成果報酬 |

機能上限は **`business_directory_plan_features`** マスタで制御（migration seed 参照）。

### 5.6 HP モード

| `hp_mode` | 意味 |
| --- | --- |
| `external_redirect` | 最小情報 + 公式サイト送客 |
| `full_page` | TASFUL 内フル掲載ページ |

---

## 6. 認可 · セキュリティ方針

| 主体 | 権限（概要） |
| --- | --- |
| **Owner（事業者）** | 自身の `owner_user_id` 掲載のみ CRUD（公開申請含む） |
| **Ops Admin** | 審査 · 強制非公開 · 通報対応 · `business_directory_is_ops_admin()` |
| **Public（匿名）** | `status = published` の読み取りのみ |

RLS ポリシー詳細 → data model 正本 · migration ファイル。

**Stripe webhook:** 署名検証 · 冪等処理（Phase 6 設計 · [TODO.md](../TODO.md) 参照）。

---

## 7. 既存 Platform との関係

| 既存 | Business Directory との関係 |
| --- | --- |
| `listings` / `business_listings` | **別系統** — 移行 Epic は **Future / TBD** |
| `shop-store-page.js` 等 | 将来段階置換（MVP design §6.3） |
| Platform 検索 TOP | 目的別 4 区分 · BD は店舗/業務入口のみ |
| TASFUL AI | Pro+ AI おすすめ連携は **Future**（`allow_ai_recommend`） |

---

## 8. DB Architecture 設計時のチェックリスト

Business Directory DB Architecture を深掘りする際、本 SSOT から派生する設計タスク:

1. **data model 正本** と **実 migration**（`20260711100000_*`）の **差分 reconcile**
2. **RLS** — Owner / Admin / Public の最小権限再確認
3. **インデックス** — 検索（`listing_type` · 地域 · カテゴリ · Pro 優先）のクエリパターン
4. **プラン制御** — `plan_features` と UI 編集可否の一貫性
5. **Stripe** — `stripe_customer_id` / `stripe_subscription_id` のライフサイクル
6. **監査** — `audit_logs` · 審査差戻し理由 · 強制停止
7. **Launch Gate** — Commercial Launch No-Go ブロッカー（OB1–OB8）との整合

---

## 9. Future / TBD

| 項目 | 備考 |
| --- | --- |
| Premium プラン詳細 DB 拡張 | 複数店舗 · 広告枠 |
| 予約 · 見積 · チャット · Connect | Premium / Future |
| 口コミ本番テーブル | review 閲覧は Standard+ · 投稿フロー TBD |
| `type_specific` jsonb 深構造 | Self-Service 正本 · 公開後項目 |
| Marketplace 既存 listings 移行 | 別 Epic · スキーマ未確定 |
| AI おすすめランキング用 DB | TASFUL AI 連携 · 未設計 |

---

## 10. 関連レポート（補助）

`reports/business-directory-*.md` — Phase テスト結果 · Launch Gate · Operational Readiness。  
**ステータス判断は `docs/` 正本（PROJECT_STATUS · TODO）を優先。**

---

*本ファイルは Jules / 設計者向け SSOT。実装変更は別タスク・別 ADR で行う。*
