# Builder Provider Listing / Sponsored Visibility — 設計（Draft）

**Status:** Draft（**設計のみ · 未実装**）  
**最終更新:** 2026-07-04  
**正本:** 本ファイル · [BUILDER_AI.md](./BUILDER_AI.md)  
**関連課金（分離）:** [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md)（Contact Reveal · Builder AI サブスク）· [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md)（条件検索 · 無料コア）  
**共通スポンサー広告システム（分離表示 · organic 非干渉）:** [SPONSOR_ADS.md](../SPONSOR_ADS.md)（**REL-F-13** · Platform / Builder / BD · 将来 TLV 等）— organic への `sponsored_boost` 加点は **採用しない**（本 Draft §5 の boost merge は見直し対象）

---

## 目的

業者 · ワーカーが **自由にプロフィールを掲載**できる導線と、  
**AI 検索 / 条件検索での優先表示 · TOP 表示**をサブスク / 掲載課金として設計する。

> **掲載無料 · 検索/閲覧無料 · 連絡先開示は Contact Reveal · 露出ブーストは Provider 課金**

[BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) の Contact Reveal · Builder AI サブスクとは **商品 · 請求 · entitlements すべて独立**。

---

## 1. 課金レーン全体像

| レーン | 誰が払う | モデル | 内容 |
| --- | --- | --- | --- |
| **Free Listing** | 掲載者 | **¥0** | プロフィール作成 · 編集 · 無料掲載 |
| **検索 / 閲覧** | 顧客 | **¥0** | 条件検索 · フィルタ · プロフィール · お気に入り |
| **Contact Reveal** | 顧客 | 都度 | 直接連絡先開示 — [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) |
| **Provider Boost** | 掲載者 | 月額 | 優先表示 · Sponsored · メディア上限 UP 等 |
| **Builder AI** | 利用者 | 月額 | 業務 AI ツール — Contact Reveal / Boost と **別契約** |

```text
掲載者                          顧客（発注者）
  │                                │
  ├─ Free Listing（無料掲載）       ├─ 検索/フィルタ/閲覧（無料）
  ├─ Provider Boost（月額）         └─ Contact Reveal（都度・連絡先のみ）
  └─ Sponsored TOP（地域月額）
```

---

## 2. 無料掲載（Free Listing）

### 対象

- **業者（partner / company）**
- **ワーカー（worker）**

### 掲載者が登録できる項目（公開プロフィール）

| カテゴリ | フィールド例 |
| --- | --- |
| 基本 | 会社名 / 屋号 · 表示名 · 業種 · 職種 |
| エリア | 対応都道府県 · 市区町村（公開レベル） |
| 紹介 | 自己紹介 · 強み · 対応規模 |
| 実績 | 施工事例（件数上限 Free  tier） · 評価 · 実績タグ |
| 資格 | 保有資格 · 建設業許可（番号マスク可） |
| コンプライアンス | 保険加入 · インボイス登録（有無バッジ） |
| メディア | プロフィール写真 · 現場写真（枚数上限 Free tier） |
| 営業 | 営業時間 · 対応可能曜日 |

### 無料で提供する体験

- プロフィール **作成 · 編集 · 公開** — 掲載自体 **無料**
- 条件検索 · フィルタ結果への **通常掲載**
- プロフィール **閲覧** — 無料
- **お気に入り** — 無料

### 非公開（Contact Reveal 管轄）

電話 · メール · LINE · 担当者フルネーム · 詳細住所 · 外部 HP URL 等 — [BUILDER_MONETIZATION.md §3](./BUILDER_MONETIZATION.md)

---

## 3. 顧客側（発注者）

| 機能 | 課金 |
| --- | --- |
| 条件検索 · AI 補助検索（将来 Pro） | 無料（検索コア） |
| フィルタ · 並び替え | 無料 |
| プロフィール閲覧 | 無料 |
| お気に入り | 無料 |
| **連絡先を見る** | **Contact Reveal 都度課金のみ** |

TASFUL TALK / 掲示板経由のプラットフォーム内連絡は Contact Reveal 設計に従う（メッセージ 1 通課金 **しない**）。

---

## 4. 掲載者側の課金（Provider Boost / Business）

### プラン概要

| プラン | 価格（Draft · 税込想定） | 主な特典 |
| --- | --- | --- |
| **Free Listing** | **¥0** | 基本掲載 · 写真/事例上限（低） |
| **Provider Boost** | **¥980〜¥1,980 / 月** | 検索優先 · AI 候補加点 · メディア上限 UP |
| **Builder Business** | **¥4,980 / 月** | Boost 上位相当 + 解析 · 認証バッジ · 外部リンク |
| **Sponsored TOP 枠** | **¥3,000〜¥10,000 / 月 / 地域** | 地域 × カテゴリ TOP スロット |
| **Enterprise** | 個別見積 | 多拠点 · 広域 · 運営 SLA |

**表示:** UI には **「Draft Pricing」** と明記。

### Provider Boost / Business 特典（案）

| 特典 | 説明 |
| --- | --- |
| **検索優先表示** | deterministic スコアに `sponsored_boost` 加点 |
| **AI おすすめ候補** | 条件一致時に候補プールへ **加点**（LLM ランキング **禁止**） |
| **Sponsored / TOP 枠** | 地域 · カテゴリ別スロット（上限本数 · ローテーション） |
| **写真掲載数 UP** | `provider_profile_media` 上限引き上げ |
| **施工事例数 UP** | ポートフォolio 件数上限 |
| **外部リンク掲載** | 公式 HP（**連絡先フィールドとは分離** · クリック計測） |
| **認証バッジ** | 本人確認 / 法人確認 / 保険 · インボイス verified badge |
| **アクセス解析** | プロフィール PV · 検索 imp · お気に入り |
| **問い合わせ / 開示レポート** | TALK 入口 click · Contact Reveal 件数（集計のみ · 課金は Reveal 側） |

### Builder Business との関係

- **Builder Business（¥4,980/月）** は [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) の Builder AI 上位プランと **名称共有可**だが、entitlements は **Listing Boost** と **AI ツール** を **別フラグ**で管理（混同禁止）。
- 初期: Provider Boost 単体販売を優先 · Business はバンドル案として Backlog。

---

## 5. ランキング方針

> **2026-07-04 更新:** スポンサー露出の正本は [SPONSOR_ADS.md](../SPONSOR_ADS.md)。  
> **分離枠 + organic 非干渉**を採用する。以下の `sponsored_boost` 加点案は **履歴・代替案**として残し、新規実装では **通常一覧への課金加点を行わない**。

### 原則

| # | ルール |
| --- | --- |
| 1 | **完全な金払い順にしない** — マッチング品質と信頼シグナルを優先 |
| 2 | **基本スコアは deterministic** — 既存 `SCORE_WEIGHTS` 系（[BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) · `builder-ai-candidate-recommend.js`）を拡張 |
| 3 | **スポンサーは分離枠のみ** — organic スコアへの課金加点 **禁止**（[SPONSOR_ADS.md](../SPONSOR_ADS.md)） |
| 4 | **Sponsored は UI 明示** — 「スポンサー」「広告」「PR」ラベル必須 |
| 5 | **LLM ランキング禁止** — AI は **おすすめ理由の説明のみ**（Pro · 1 セッション 1 回） |

### 基本スコア要素（deterministic）

| 要素 | 重みイメージ |
| --- | --- |
| 対応エリア一致 | 高 |
| 職種 / カテゴリ一致 | 高 |
| 実績 · 施工事例数 | 中 |
| 評価 | 中 |
| 本人確認 / 法人確認 | 中 |
| 保険 · インボイス | 中 |
| プロフィール更新日 | 低（鮮度） |
| NG フラグ | 大幅減点 |

### Sponsored Boost 加点（案）

```text
final_score = clamp(
  base_deterministic_score + sponsored_boost_points,
  min=0,
  max=BASE_MAX + SPONSORED_CAP
)
```

- `sponsored_boost_points`: プラン · TOP 枠 · 入札上限に応じて **固定テーブル**（LLM 不使用）
- **Free のみの検索結果が Sponsored だけで埋まらない**よう、Organic 最低表示比率を設ける（例: 70% organic / 30% sponsored cap）

### AI の役割（許可 / 禁止）

| 許可 | 禁止 |
| --- | --- |
| 自然文 → SearchFilter 変換 | 全データ LLM 走査 |
| 取得済み結果の **おすすめ理由** 文案 | **毎回 LLM で順位決定** |
| 注意点の要約 | Sponsored 表記の省略 · 隠蔽 |

---

## 6. 実装想定（データモデル · Backlog）

### テーブル（Supabase · RLS 前提）

#### `provider_profiles`

| 列 | 説明 |
| --- | --- |
| `id` | PK |
| `owner_user_id` | 掲載者アカウント |
| `provider_type` | `worker` \| `partner` |
| `display_name` | 公開表示名 |
| `public_fields` | jsonb — 公開プロフィール本体 |
| `contact_private` | jsonb — **RLS 厳格 · Reveal 後のみ** |
| `status` | `draft` \| `published` \| `suspended` |
| `verified_flags` | kyc · corp · insurance · invoice |
| `updated_at` | 鮮度スコア用 |

**分離:** `public_fields` と `contact_private` は **物理/論理分離** · 公開 API から contact を join しない。

#### `provider_listing_plans`

| 列 | 説明 |
| --- | --- |
| `id` | PK |
| `code` | `free` \| `boost` \| `business` \| `sponsored_top` \| `enterprise` |
| `price_yen` | 月額 |
| `entitlements` | jsonb — メディア上限 · boost 点数 · バッジ |

#### `provider_boosts`

| 列 | 説明 |
| --- | --- |
| `id` | PK |
| `profile_id` | FK → provider_profiles |
| `plan_id` | FK → provider_listing_plans |
| `region_code` | 地域（Sponsored TOP 用） |
| `category` | カテゴリスロット |
| `boost_points` | deterministic 加点 |
| `starts_at` / `ends_at` | 有効期間 |
| `status` | `active` \| `expired` \| `cancelled` |

#### `provider_profile_media`

| 列 | 説明 |
| --- | --- |
| `profile_id` | FK |
| `kind` | `avatar` \| `gallery` \| `case_study` |
| `storage_path` | Supabase Storage |
| `sort_order` | 表示順 |

#### `provider_stats_daily`

| 列 | 説明 |
| --- | --- |
| `profile_id` | FK |
| `date` | 集計日 |
| `profile_views` | PV |
| `search_impressions` | 検索 imp |
| `favorites_adds` | お気に入り |
| `reveal_requests` | Reveal 試行（課金は contact_reveals） |

#### `search_result_impressions`

| 列 | 説明 |
| --- | --- |
| `search_session_id` | 匿名/ユーザー |
| `filter_hash` | SearchFilter cache key |
| `profile_id` | 表示されたプロフィール |
| `rank` | 表示順位 |
| `is_sponsored` | boolean |
| `created_at` | |

#### `contact_reveal_events`

| 列 | 説明 |
| --- | --- |
| `reveal_id` | FK → contact_reveals（[BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md)） |
| `profile_id` | 集計用 |
| `event` | `requested` \| `paid` \| `viewed` |

### 検索パイプライン（将来）

```text
SearchFilter → Repository.query（無料 · organic pool）
  → deterministic base_score
  → merge active provider_boosts（加点 · cap）
  → insert Sponsored TOP slots（明示ラベル · 上限）
  → sort · paginate
  → log search_result_impressions
  → (Pro) AI 理由文案のみ（順位変更なし）
```

### 既存コードとの接点

| 既存 | 拡張 |
| --- | --- |
| `builder-search-repository.js` | organic query · boost merge hook |
| `builder-ai-candidate-recommend.js` | SCORE_WEIGHTS + sponsored_boost |
| `builder-ai-conditional-search.js` | SearchFilter 維持 · 検索無料 |
| `mvp-partner-register.html` 等 | → provider_profiles 編集 UI（Backlog） |

---

## 7. 禁止事項

| # | 禁止 |
| --- | --- |
| 1 | **有料業者だけ**を常に上位固定 |
| 2 | **Sponsored 表記**を隠す · 偽装 |
| 3 | **AI にランキング丸投げ**（LLM 順位生成） |
| 4 | **連絡先の無料公開**（Contact Reveal 迂回） |
| 5 | **Contact Reveal と Provider サブスクの混同**（請求 · UI · entitlements） |
| 6 | **AI Membership 統合**（TASFUL AI Workspace） |
| 7 | **検索 / プロフィール閲覧**の有料化 |
| 8 | **掲載自体**の必須課金（Free Listing をなくす） |

---

## 8. 実装フェーズ（Backlog）

| Phase | 内容 |
| --- | --- |
| **L0** | 本設計 · SKU · Sponsored 表示ガイドライン |
| **L1** | `provider_profiles` · RLS · 公開/非公開 contact 分離 |
| **L2** | 掲載者プロフィール CRUD UI（最小） |
| **L3** | `provider_boosts` · Stripe サブスク · entitlements |
| **L4** | 検索パイプライン boost merge · Sponsored UI ラベル |
| **L5** | `provider_stats_daily` · 掲載者ダッシュボード |
| **L6** | Sponsored TOP 枠 · 地域入札 · Enterprise |

**今回スコープ外:** DB migration · UI · Payment · Gateway/LLM

---

## 9. 関連ドキュメント

| ファイル | 内容 |
| --- | --- |
| [BUILDER_MONETIZATION.md](./BUILDER_MONETIZATION.md) | Contact Reveal · Builder AI サブスク |
| [BUILDER_AI_CONDITIONAL_SEARCH.md](./BUILDER_AI_CONDITIONAL_SEARCH.md) | 条件検索（無料） |
| [reports/builder-provider-listing-design.md](../reports/builder-provider-listing-design.md) | 本設計レポート |

---

*Draft · Builder v1.0 RELEASE FROZEN — 実装は Backlog 承認後*
