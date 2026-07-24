# TASFUL 全体 — Pricing Config 設計プラン

**日付:** 2026-07-05  
**種別:** 設計レポートのみ（**実装・Stripe・DB・Edge・Production 変更なし**）  
**目的:** 価格は後から変更可能にし、まず **「機能だけ動く」** 状態を作る。金額（¥550 等）はすべて **仮値（provisional）** として扱う。

**関連正本:** `docs/DECISIONS.md`（AD-013 · AD-014）· `docs/PRICING.md` · `docs/AI/AI_MEMBERSHIP_PRICING.md` · `docs/AI/BUILDER_MONETIZATION.md` · `docs/SPONSOR_ADS.md`

---

## 0. サマリ

| 項目 | 結論 |
| --- | --- |
| **現状** | 課金ロジックは **領域ごとに分散** · 金額は JS/TS 定数と HTML 文言に **ハードコード** · Stripe Price ID は env のみ可変 |
| **設計方針** | **`tasful-pricing-catalog` 単一カタログ** → ビルド時にフロント / Edge へ同期 · 表示・計算・Checkout フォールバックを同一 SKU 参照 |
| **仮値扱い** | 全 `amount_jpy` / `rate_pct` に `provisional: true` · UI に **Draft Pricing** 表示を維持 |
| **変更経路（段階）** | Phase 1: JSON/JS config · Phase 2: Supabase `pricing_catalog` 読取 · Phase 3: 運営管理画面 |
| **本レポートの Go** | **設計 Go** — 実装は別 Epic（Stripe/DB/Edge 変更は人間承認後） |

---

## 1. 現在の課金仕様（洗い出し）

### 1.1 レーン分離（ADR 準拠）

| レーン | 収益モデル | 正本 | 実装状態 |
| --- | --- | --- | --- |
| **Platform マッチング** | 成約手数料 · チャット開始料 | `platform-chat-fee.js` · AD-013 | **UI + 計算あり** · Stripe 一部 |
| **Platform Boost（上位掲載）** | 期間課金（7/30日 · PR） | `stripe-featured-config.js` · `featured-plans.ts` | **Stripe Checkout あり** |
| **スポンサー掲載** | 期間/月額（未確定） | `docs/SPONSOR_ADS.md` | **設計のみ** |
| **急ぎ案件優先** | — | なし（`urgent` は無料 UI タグ） | **未設計・未実装** |
| **認証バッジ** | バンドル（単体 SKU なし） | `BUILDER_PROVIDER_LISTING.md` · BD verification arch | **設計のみ** |
| **求人掲載** | やりとり開始料（掲載無料） | `platform-chat-fee.js`（job カテゴリ） | **¥550 フラット実装** |
| **Builder Contact Reveal** | 都度 | `builder-billing-policy.js` | **定数のみ** · Stripe 未 |
| **Builder Provider Boost** | 月額（Draft） | `BUILDER_PROVIDER_LISTING.md` | **設計のみ** |
| **Business Directory** | 月額サブスク | `business-directory-subscription-model.md` | **Stripe 実装** · 円額は Edge 定数 |
| **TASFUL AI プラン** | 月額サブスク + アドオン | `stripe-genai-config.js` · `genai-plans.ts` | **Stripe 実装**（basic/pro のみ） |
| **TASFUL AI 従量上限** | 日次 Fair Use | `ai-workspace-usage.js` · quota Edge | **Phase 2 一部本番** |
| **TLV Coin / サブスク** | 別 Wallet | `docs/PRICING.md` | **本レポート対象外**（レーン分離維持） |

### 1.2 Platform マッチング課金（現行）

| 条件 | 誰が払う | 金額（仮値） | タイミング |
| --- | --- | --- | --- |
| **求人**（Connect なし） | 掲載者（poster） | **¥550 固定** | 応募者確定 → Talk 開始前 |
| **スキル/商品/店舗/業務/ワーカー**（Connect なし） | チャット開始側 | **¥550 固定** | 「チャットに進む」時 |
| **Connect あり** | 成約側（GMV ベース） | **5%（最低 ¥550）** | 取引完了時 |
| **一般案件（builder_board）** | Talk-only · 手数料なし | ¥0 | 一般案件ローンチ（RL-10） |

根拠: `platform-chat-fee.js` L3–6 · `docs/DECISIONS.md` AD-013「Platform / 案件・仕事 = 成約手数料」

### 1.3 Boost（Platform 上位掲載 · 実装済み）

| SKU | 期間 | 仮値（税込想定） | kind |
| --- | --- | --- | --- |
| `featured_7days` | 7 日 | ¥980 | featured |
| `featured_30days` | 30 日 | ¥2,980 | featured |
| `pr_30days` | 30 日 | ¥4,980 | pr |

正本: `stripe-featured-config.js` · `supabase/functions/_shared/featured-plans.ts`

### 1.4 スポンサー掲載（設計のみ）

| 商品タイプ | モデル | 価格 |
| --- | --- | --- |
| 7/14/30 日掲載 | 期間課金 | **未確定** |
| 月額スポンサー | サブスク | **未確定** |
| 地域/カテゴリ別 | 将来 | **未確定** |

ルール: organic 順位に課金加点 **禁止** · 分離ブロック表示 · ラベル必須（`docs/SPONSOR_ADS.md`）

### 1.5 急ぎ案件優先（未実装）

| 現状 | 将来案 |
| --- | --- |
| `builder.js` の `isUrgentProject` は **期限ベースの無料バッジ** | 掲載者向け **期間課金オプション**（Boost と別 SKU · organic 非干渉） |

価格: **未定** — カタログに `platform_urgent_priority_7d` 等の **placeholder SKU** のみ先行定義

### 1.6 認証バッジ（未単体課金）

| 領域 | 現状 |
| --- | --- |
| Builder | Builder Business（¥4,980/mo Draft）に **バンドル** |
| Business Directory | `verification_badges` は信頼シグナル · **課金ゲートなし** |
| Platform | 本人確認 UI「準備中」· 単体価格なし |

方針: 単体 SKU は作らず、**entitlement フラグ**（`badge_kyc` 等）をプラン/SKU に紐づける

### 1.7 求人掲載

| 項目 | 仕様 |
| --- | --- |
| 掲載自体 | **無料**（投稿 UI は既存） |
| 収益化 | **やりとり開始料 ¥550**（求人カテゴリのみ · Connect 5% は使わない） |
| 検証 | `docs/TODO.md` — 求人 → ¥550 → Talk **PASS 完了** |

### 1.8 TASFUL AI プラン（現行実装）

| プラン | 仮値 | SKU ID | 日次上限（text/voice/image） | Stripe |
| --- | --- | --- | --- | --- |
| Free | ¥0 | — | 5 / 5 / 3 | — |
| Lite（basic_300） | ¥300/mo | `genai_basic_300` | 30 / 30 / 10 | env `STRIPE_GENAI_PRICE_BASIC_300` |
| Pro（pro_980） | ¥980/mo | `genai_pro_980` | 100 / 100 / 30 | env `STRIPE_GENAI_PRICE_PRO_980` |
| Max | ¥2,980/mo | **未実装** | Draft · Fair Use 拡張 | なし |
| キャンペーン | ¥150 | **未実装** | マーケ用 · 常設不可 | なし |
| 2D Live アドオン | ¥300/mo | `genai_2d_live_300` | — | env |
| 3D Generate チケット | ¥500 都度 | `genai_3d_generate_500` | — | env |

ドキュメント: `docs/AI/AI_MEMBERSHIP_PRICING.md`（Draft · 原価シミュレーション前）

### 1.9 TASFUL AI — Auto / Manual / API登録 / ゲージ / 従量上限

| 概念 | 現状 | 設計上の位置づけ |
| --- | --- | --- |
| **Auto** | Gateway がモードに応じてモデル選択（Pro = マルチルート） | **Pro 以上の entitlement** · `routing_mode: auto` |
| **Manual** | `ai-model-selector.js` チップでユーザー選択 | **全プランで基本提供** · `routing_mode: manual` |
| **API登録（BYOK）** | **未実装** · コードベースに該当なし | **Max / API ティア将来 SKU** · ユーザー API キーは Edge に保存せずクライアント or 暗号化 vault（別 Epic） |
| **使用量ゲージ** | `ai-workspace-billing-settings.js` は **localStorage デモ**（8000/10000 等） | 正本は `ai-workspace-usage.js` + DB `ai_workspace_usage_daily` |
| **従量上限** | `dailyTextLimit` 等がプラン定義に直書き | カタログ `limits.daily` + Fair Use `limits.monthly`（P1） |

**注意:** `ai-plan-models.js` は Workspace beta で **全モデル enabled** — 課金ゲートと未接続（`reports/tasful-ai-workspace-enforcement-design.md`）

### 1.10 Builder 関連（参考 · Platform 横断設計に含む）

| 項目 | 仮値 | 状態 |
| --- | --- | --- |
| Contact Reveal | ¥550/件 · 5pack ¥1,200 · 10pack ¥2,000 | 定数のみ |
| 成約手数料 | 5–10% | 定数のみ |
| Provider Boost | ¥980–¥1,980/mo | Draft |
| Builder AI Pro/Business | ¥1,480 / ¥4,980/mo | Draft |

---

## 2. 価格ハードコード箇所

### 2.1 一覧（要 config 化）

| 領域 | ファイル | 定数/文言 | 仮値 |
| --- | --- | --- | --- |
| **Platform matching** | `platform-chat-fee.js` | `FEE_RATE`, `MIN_FEE_YEN`, `JOB_CHAT_FEE_YEN` | 5%, ¥550 |
| | `platform-chat-fee-pay.js` / `.html` | UI「550円」「5%（最低550円）」 | 同上 |
| | `platform-chat-start-fee-card.js` | `PAY_BTN`, fallback 550 | ¥550 |
| | `chat-detail.js` | 「550円のお支払い後」 | ¥550 |
| | `ai-workspace-chat.js` | デモ応答「550円/件」 | ¥550 |
| **Boost** | `stripe-featured-config.js` | `PLANS.*.amountJpy` | 980/2980/4980 |
| | `supabase/functions/_shared/featured-plans.ts` | `FEATURED_PLANS` | 同上 |
| **Builder reveal** | `builder/builder-billing-policy.js` | `CONTACT_REVEAL_FEE_YEN` | ¥550 |
| | `builder/builder-contact-reveal.js` | policy 参照 | ¥550 |
| | `builder/builder.js` | 表示フォールバック 550 | ¥550 |
| **TASFUL AI プラン** | `stripe-genai-config.js` | `FREE_PLAN`, `PLANS`, `ADDON_PLANS` | 0/300/980/500 |
| | `supabase/functions/_shared/genai-plans.ts` | `GENAI_PLANS` | 同上 |
| | `supabase/functions/_shared/genai-checkout-plans.ts` | アドオン金額 | 300/500 |
| | `ai-workspace-billing-settings.js` | `DEFAULT_AVAILABLE_PLANS`, `DEFAULT_USAGE` | 300/980/2980 · デモ上限 |
| **TASFUL AI 上限** | `ai-workspace-usage.js` | `DEFAULT_FREE_PLAN.dailyTextLimit: 5` | 5 |
| | `supabase/functions/_shared/ai-workspace-quota.ts` | free fallback 5 | 5 |
| **BD サブスク** | `supabase/functions/_shared/business-directory-stripe.ts` | `unitAmountYen` | ¥980 / ¥2,980 |
| | `business-directory/terms.html` | 法的表記 | 同上 |
| **ドキュメントのみ** | `docs/AI/BUILDER_PROVIDER_LISTING.md` | Boost/Sponsor/Badge | Draft レンジ |
| | `docs/SPONSOR_ADS.md` | スポンサー全般 | 未確定 |
| | `reports/builder-monetization-design.md` | ¥300 reveal（**陳腐化**） | → ¥550 に更新要 |

### 2.2 二重正本問題（リスク）

同一 SKU が **フロント JS** と **Edge `_shared/*.ts`** に重複定義されている。

| SKU 系統 | フロント | Edge |
| --- | --- | --- |
| GenAI | `stripe-genai-config.js` | `genai-plans.ts` |
| Featured | `stripe-featured-config.js` | `featured-plans.ts` |
| Platform fee | `platform-chat-fee.js` | （動的 `fee_amount` 受取 · 上限検証なし） |
| BD | — | `business-directory-stripe.ts` |

**設計で解消:** 単一 `tasful-pricing-catalog.json` → ビルドスクリプトで JS/TS 生成

### 2.3 既に config 化されているもの

| 項目 | 方式 |
| --- | --- |
| Stripe Price ID（GenAI） | env `STRIPE_GENAI_PRICE_*` |
| Stripe Price ID（BD） | env `BUSINESS_DIRECTORY_STRIPE_PRICE_*` |
| Featured Stripe Price | env or `price_data` フォールバック |
| Platform service fee | Checkout 時に `fee_amount` を動的送信（金額の算出元は JS 定数） |
| TLV coin packs | DB `coin_packs`（別レーン） |

---

## 3. Pricing Config 案

### 3.1 設計原則

1. **SKU 第一** — 価格・率・上限はすべて `sku_id` に紐づく
2. **仮値フラグ** — `provisional: true` · `effective_from` · `version`
3. **レーン分離** — Wallet/ledger は統合しない（AD-002 · AD-013 · TLV 分離）
4. **表示と決済の分離** — カタログが表示・計算の SSOT · Stripe Price ID は **参照のみ**
5. **機能優先** — Phase 1 は JSON + 読取で既存フローを動かす · 管理画面は後回し

### 3.2 カタログ配置（案）

```text
shared/pricing/
  tasful-pricing-catalog.json      # 人間編集 SSOT（仮値）
  tasful-pricing-catalog.schema.json
scripts/lib/
  tasful-pricing-config.mjs      # 読取 · 検証 · 整形 API
scripts/
  generate-pricing-config-artifacts.mjs  # JS/TS/dist 同期（build:pages フック候補）
```

**ランタイム公開（Phase 1）:**

```text
tasful-pricing-config.js         # ブラウザ IIFE（既存 stripe-*-config パターン）
deploy/cloudflare/dist/...       # build ミラー
```

**Edge（Phase 2）:**

```text
supabase/functions/_shared/tasful-pricing-catalog.ts  # 生成物 · 手編集禁止
```

### 3.3 カタログ JSON スキーマ（案）

```json
{
  "schema_version": 1,
  "updated_at": "2026-07-05",
  "default_currency": "JPY",
  "lanes": {
    "platform_matching": { ... },
    "platform_boost": { ... },
    "platform_sponsor": { ... },
    "platform_urgent": { ... },
    "platform_job": { ... },
    "builder_reveal": { ... },
    "builder_boost": { ... },
    "tasful_ai": { ... },
    "business_directory": { ... }
  }
}
```

**SKU エントリ例:**

```json
{
  "sku_id": "platform_chat_start_job",
  "lane": "platform_matching",
  "label": "求人やりとり開始料",
  "billing_model": "one_time",
  "amount_jpy": 550,
  "provisional": true,
  "tax_inclusive": true,
  "stripe": {
    "product_key": "platform_service_fee",
    "price_id_env": null,
    "checkout_mode": "payment"
  },
  "rules": {
    "category": "job",
    "connect_allowed": false,
    "payer": "poster"
  }
}
```

```json
{
  "sku_id": "platform_connect_completion",
  "lane": "platform_matching",
  "billing_model": "rate_min",
  "rate_pct": 5,
  "min_amount_jpy": 550,
  "provisional": true,
  "rules": { "requires_stripe_connect": true }
}
```

```json
{
  "sku_id": "genai_pro_980",
  "lane": "tasful_ai",
  "billing_model": "subscription",
  "amount_jpy": 980,
  "interval": "month",
  "provisional": true,
  "entitlements": {
    "routing_modes": ["manual", "auto"],
    "models": ["gemini-flash", "gpt", "claude"],
    "limits": {
      "daily": { "text_turn": 100, "voice_turn": 100, "image_turn": 30 },
      "monthly": { "text_turn": null, "fair_use_policy": "cursor_style" }
    }
  },
  "stripe": { "price_id_env": "STRIPE_GENAI_PRICE_PRO_980" }
}
```

### 3.4 読取 API（`TasuPricingConfig` 案）

```javascript
// tasful-pricing-config.js（新規 · 既存モジュールの薄いファサード）
TasuPricingConfig.getSku("platform_chat_start_job")       // → { amount_jpy: 550, ... }
TasuPricingConfig.calcFee("platform_connect_completion", { gmv_yen: 10000 })
TasuPricingConfig.getPlanEntitlements("genai_pro_980")
TasuPricingConfig.formatYen(550)                          // → "¥550"
TasuPricingConfig.isProvisional("platform_chat_start_job") // → true → UI に Draft 表示
```

**既存モジュールとの関係（移行期）:**

| 既存 | 移行 |
| --- | --- |
| `platform-chat-fee.js` | 内部で `TasuPricingConfig` 参照 · 公開 API は維持 |
| `stripe-genai-config.js` | `PLANS` を catalog から hydrate |
| `stripe-featured-config.js` | 同上 |
| `builder-billing-policy.js` | `CONTACT_REVEAL_FEE_YEN` → catalog |

### 3.5 変更経路（段階）

| Phase | 変更方法 | 対象 |
| --- | --- | --- |
| **1** | `tasful-pricing-catalog.json` 編集 → `npm run build:pages` → deploy | 開発/Staging · **機能動作優先** |
| **2** | Supabase `pricing_catalog` テーブル（読取専用 RPC）+ JSON フォールバック | Staging 価格 A/B |
| **3** | 運営管理画面（admin-operations-dashboard 配下 · 秘書と別） | Production 価格変更 · 監査ログ |

**Phase 2 テーブル案（将来 · 本タスクでは migration しない）:**

```sql
-- 設計メモのみ
pricing_catalog (sku_id PK, lane, payload jsonb, amount_jpy, rate_pct, provisional, effective_from, version, updated_at)
pricing_catalog_audit (id, sku_id, old_payload, new_payload, actor, at)
```

### 3.6 Stripe との関係（変更しない前提での接続）

| パターン | 現状 | config 化後 |
| --- | --- | --- |
| 固定サブスク | env Price ID | catalog `amount_jpy` + env Price ID **整合チェック** script |
| 動的 one-time（Platform fee） | `fee_amount` body | catalog から算出 → Edge で **上限/下限検証**（将来） |
| price_data フォールバック | Edge が catalog 金額で生成 | 維持 · **Stripe Dashboard 価格変更は env 更新で追従** |

**本設計では Stripe Product/Price の作成・変更は行わない。**

---

## 4. Platform ¥550 マッチングの実装方針

### 4.1 現行フロー（維持）

```text
応募/マッチング確定
  → platform-chat-fee.js calcFee / calcJobChatFee
  → platform-chat-fee-pay.html（Stripe Checkout or デモ）
  → stripe-create-service-fee（fee_amount）
  → Talk 解放（chat-detail）
```

### 4.2 Config 化ステップ（実装 Epic · 本レポート外）

| # | 作業 | ファイル |
| --- | --- | --- |
| 1 | catalog に `platform_chat_start_job` · `platform_chat_start_listing` · `platform_connect_completion` を定義 | `shared/pricing/tasful-pricing-catalog.json` |
| 2 | `platform-chat-fee.js` が catalog から `JOB_CHAT_FEE_YEN` / `MIN_FEE_YEN` / `FEE_RATE` を読む | 既存 API 互換 |
| 3 | UI 文言を `TasuPricingConfig.formatYen()` + `isProvisional()` に統一 | `platform-chat-fee-pay.*` · `platform-chat-start-fee-card.js` · `chat-detail.js` |
| 4 | 回帰 | `docs/TODO.md` 求人550円フロー · Platform finish phase scripts |
| 5 | （任意）Edge `stripe-create-service-fee` が受信 `fee_amount` を catalog と照合 | **別承認** · Edge 変更 |

### 4.3 仮値 ¥550 の扱い

- catalog `provisional: true` · UI に **「参考価格（Draft）」** バッジ
- 変更時: JSON の `amount_jpy` のみ更新 → build → **コードロジック変更なし**
- Connect 5% / min ¥550 も同 SKU グループで管理

### 4.4 Platform 一般案件との境界

- `kind=builder_board` / 一般案件は **手数料 SKU 対象外**（RL-10 · Talk-only）
- catalog `rules.excluded_categories: ["builder_board", "general"]`

---

## 5. オプション課金の実装方針

### 5.1 Boost（Platform 上位掲載）

| 項目 | 方針 |
| --- | --- |
| SKU | 既存 `featured_7days` / `featured_30days` / `pr_30days` を catalog に移行 |
| 実装 | `stripe-featured-config.js` + `featured-plans.ts` → **生成物化** |
| organic | **加点なし** — 掲載期間中の `priority` フラグのみ（現行維持） |
| 価格変更 | catalog `amount_jpy` · Stripe Price は env または price_data |

### 5.2 スポンサー掲載

| 項目 | 方針 |
| --- | --- |
| 現状 | `docs/SPONSOR_ADS.md` のみ |
| Phase 1 | catalog に **placeholder SKU**（`sponsor_job_7d` 等 · `amount_jpy: null` · `enabled: false`） |
| Phase 2 | 分離 UI ブロック + `sponsor_slots` 台帳（DB · 別 Epic） |
| 価格 | 運営が catalog / 管理画面で設定 · **organic 非干渉をテストで強制** |

### 5.3 急ぎ案件優先

| 項目 | 方針 |
| --- | --- |
| 商品定義 | 掲載者向け **期間オプション**（例: `urgent_badge_7d`） |
| 表示 | 一覧で「急ぎ」バッジ + **有料ラベル**（Boost とは別 entitlement） |
| organic | ソート加点 **禁止** — フィルタ「急ぎのみ」+ バッジ表示のみ |
| 価格 | 仮値 placeholder（例 ¥500/7日）· `provisional: true` |
| 実装順 | スポンサー **後** · Boost catalog 化 **後** |

### 5.4 認証バッジ

| 項目 | 方針 |
| --- | --- |
| 課金 | **単体 SKU なし** — `entitlements.badges: ["kyc", "corp", "insurance"]` をプランに付与 |
| Builder | `builder_business_monthly` SKU にバンドル |
| BD | verification は信頼データ · プラン `pro` の `search_boost_weight` と分離 |
| 将来 | 審査手数料 SKU を追加する場合も catalog `lane: trust` で管理 |

### 5.5 求人掲載

| 項目 | 方針 |
| --- | --- |
| 掲載 | 無料（現状維持） |
| 収益 | `platform_chat_start_job` SKU に一本化 |
| Boost/スポンサー | 求人一覧の **分離枠** として将来追加（AD-013 成約手数料モデル維持） |

### 5.6 Builder レーン（Platform 横断 catalog に含める）

| SKU 群 | 備考 |
| --- | --- |
| `builder_contact_reveal_single` | ¥550 仮値 |
| `builder_contact_reveal_pack_5` / `_10` | パック割引 |
| `builder_provider_boost_monthly` | Draft · enabled: false から開始 |
| Stripe | Builder Production Ready 前は **デモ決済のみ**（現状維持） |

---

## 6. TASFUL AI 実装方針

### 6.1 プラン体系（catalog 案）

| plan_code | 表示名 | 仮値 | routing | 主な entitlement |
| --- | --- | --- | --- | --- |
| `free` | Free | ¥0 | manual のみ | Gemini · 日次 5 |
| `lite` / `basic_300` | Lite | ¥300/mo | manual | Gemini · 日次 30 |
| `pro` / `pro_980` | Pro | ¥980/mo | **manual + auto** | マルチモデル · 日次 100 |
| `max` | Max | ¥2,980/mo | manual + auto + 拡張 Fair Use | **SKU placeholder · enabled: false** |
| `api_byok` | API（BYOK） | TBD | manual + **api_registered** | ユーザー API キー · 上限は「登録 API の Fair Use」|

**名称統一:** 表示は Lite/Pro/Max · 内部は `genai_*` / `basic_300` 共存期間は alias マップで吸収

### 6.2 Auto / Manual

| モード | 挙動 | ゲート |
| --- | --- | --- |
| **Manual** | `ai-model-selector.js` でユーザーがモデル選択 | 全プラン |
| **Auto** | Gateway / ルータがタスクに応じてモデル選択（Pro+） | `entitlements.routing_modes` に `auto` があるプランのみ |

**実装:** `ai-plan-models.js` の `modelAccess` を catalog `entitlements.models` から hydrate · Auto は `ai-model-selector` に「おまかせ」チップ追加（別 Epic）

### 6.3 API登録（BYOK · 将来）

| 項目 | 方針 |
| --- | --- |
| 現状 | **未実装** — catalog に SKU のみ先行定義 |
| 保存 | ユーザー API キーは **TASFUL AI 専用 vault**（Edge · 暗号化）— Secretary/Builder と分離 |
| 課金 | 月額 + 従量キャップ · または BYOK は月額のみで TASFUL API 原価ゼロ |
| 表示 | 設定タブ「API 登録」· Draft 表示 |

### 6.4 使用量ゲージ

| 層 | 正本 | UI |
| --- | --- | --- |
| **日次 quota（実装済）** | `ai-workspace-usage.js` · DB `ai_workspace_usage_daily` | サイドバー `data-ai-sidebar-plan-usage` |
| **請求タブ（デモ）** | `ai-workspace-billing-settings.js` localStorage | 設定 › 請求 · **catalog 連携でデモ廃止** |
| **ゲージ項目** | catalog `limits.daily` / `limits.monthly` キー | text / voice / image / web_search / video_gen |

**移行:** `DEFAULT_USAGE` ハードコード → `TasuPricingConfig.getPlanEntitlements(plan).limits`

### 6.5 従量上限（Fair Use）

| 段階 | 上限の定義場所 |  enforcement |
| --- | --- | --- |
| Phase 1（済） | `stripe-genai-config.js` `dailyTextLimit` | クライアント + Edge quota |
| Phase 2 | catalog `limits.daily` + `limits.monthly` | Edge `ai-workspace-quota.ts` が catalog 参照 |
| Phase 3 | 原価連動の動的上限（管理画面） | **非目標（初期）** — 手動 catalog 更新で十分 |

**原則（AI_MEMBERSHIP_PRICING）:** Unlimited 禁止 · Cursor 型 Fair Use · 超過時はブロック + アップグレード CTA

### 6.6 既存 Stripe との接続（変更なし）

- env `STRIPE_GENAI_PRICE_*` は維持
- 追加 script: `node scripts/verify-pricing-stripe-parity.mjs`（catalog 金額 vs Stripe Price metadata · **将来**）

---

## 7. 実装順

価格確定より **配線と SKU 統一** を優先する。

| 順 | Epic | 内容 | 触るもの | 禁止遵守 |
| --- | --- | --- | --- | --- |
| **P0** | **Catalog SSOT** | `tasful-pricing-catalog.json` + schema + `tasful-pricing-config.mjs` + 生成 script | `shared/pricing/*`, `scripts/*` | Stripe/DB/Edge 不変 |
| **P1** | **Platform ¥550** | `platform-chat-fee*` を catalog 参照に差し替え · UI Draft 表示 | Platform JS/HTML | Edge 検証は P2 |
| **P1** | **Featured Boost** | featured 二重定義を生成物に統一 | `stripe-featured-config.js` ← 生成 | Edge TS は生成物 |
| **P2** | **TASFUL AI プラン** | `stripe-genai-config` / `genai-plans` を catalog 化 · usage limits 同期 | AI Workspace JS | Gateway 契約不変 |
| **P2** | **Billing タブ** | `ai-workspace-billing-settings.js` デモ値を catalog 連携 | AI settings UI | — |
| **P3** | **Builder billing policy** | `builder-billing-policy.js` → catalog | Builder | FROZEN 域は最小 diff |
| **P3** | **BD 円額** | `business-directory-stripe.ts` 定数を catalog 参照 | Edge（**承認後**） | — |
| **P4** | **Placeholder SKU** | Sponsor / Urgent / Max / BYOK · `enabled: false` | catalog のみ | 機能未公開 |
| **P5** | **DB catalog** | `pricing_catalog` migration + 読取 RPC | Supabase（**承認後**） | — |
| **P6** | **管理画面** | 運営が SKU 価格・上限を編集 · 監査ログ | admin UI（新規） | — |
| **P7** | **Stripe parity CI** | catalog ↔ Stripe Price 整合テスト | scripts | — |

**「機能だけ動く」最小セット:** **P0 + P1（Platform）+ P2（AI プラン読取）**

---

## 8. リスク

| # | リスク | 影響 | 緩和 |
| --- | --- | --- | --- |
| R1 | **二重正本の同期漏れ**（JS/TS） | 表示価格と Checkout 金額の不一致 | 生成 script 必須 · CI で catalog vs 生成物 diff ゼロ |
| R2 | **Stripe Price と catalog の乖離** | 請求額と表示の差 | parity 検証 script · env 更新 runbook |
| R3 | **Platform FROZEN 域の変更** | Production Ready 回帰 | 定数→catalog 参照のみ · ロジック不変 · 回帰テスト必須 |
| R4 | **Builder / AI レーン混同** | AD-002 違反 | catalog `lane` 必須 · 共通 Wallet 禁止 |
| R5 | **Sponsor/Boost の organic 汚染** | 信頼低下 · AD-013/SPONSOR_ADS 違反 | entitlement とソート分離 · 専用テスト |
| R6 | **仮値の本番固定化** | 価格変更コスト増 | `provisional` フラグ + UI Draft · 早期に Phase 2 へ |
| R7 | **Edge 変更承認の遅延** | サーバー側金額検証なし | Phase 1 はクライアント正本 · 改ざんリスクは既知 issue として記録 |
| R8 | **陳腐化ドキュメント**（¥300 reveal 等） | 設計判断ミス | `docs/KNOWN_ISSUES.md` 追記 · 本レポートを SSOT 候補に |
| R9 | **TASFUL AI beta 全モデル開放** | 課金ゲート無効 | `ai-plan-models` を catalog entitlements に接続（P2） |
| R10 | **管理画面なしでの価格変更** | 運用負荷 | Phase 1 は JSON + deploy で許容 · runbook 化 |

---

## 9. Go / No-Go

### 9.1 本設計レポート

| ゲート | 判定 |
| --- | --- |
| 調査完了（docs / code / Stripe 関連） | **Go** |
| pricing config 案の一貫性（SKU · lane · provisional） | **Go** |
| AD-002 / AD-013 / AD-005 遵守 | **Go** |
| 禁止事項（Stripe/Production/DB/Migration/Edge 変更） | **遵守** |

### 9.2 実装 Epic 着手

| ゲート | 判定 | 条件 |
| --- | --- | --- |
| **P0 Catalog SSOT** | **Go** | 本レポート承認 · 選別コミット |
| **P1 Platform config 化** | **Conditional Go** | Platform 回帰 PASS · 8788 求人550円フロー維持 |
| **P2 TASFUL AI config 化** | **Conditional Go** | `test-tasful-ai-final-phase.mjs` PASS · Gateway 不変 |
| **P5 DB catalog** | **No-Go（現時点）** | migration 人間承認 · Staging 検証後 |
| **P6 管理画面** | **No-Go（現時点）** | Phase 2 DB 完了後 |
| **Sponsor / Urgent 実装** | **No-Go（現時点）** | REL-F-13 別 Epic · 価格未確定 |
| **価格最終確定（本番）** | **No-Go** | AI 原価シミュレーション · Product 承認（`AI_MEMBERSHIP_PRICING.md` P1） |

### 9.3 推奨次アクション（人間）

1. 本レポートレビュー · `docs/TODO.md` に P0–P2 タスク追記（任意）
2. P0 実装承認 → `shared/pricing/tasful-pricing-catalog.json` 初版作成
3. ¥550 等は **仮値のまま** UI に Draft 表示を統一
4. 陳腐化レポート `builder-monetization-design.md` の ¥300 表記を修正（docs のみ）

---

## 10. 参照ファイル索引

| 種別 | パス |
| --- | --- |
| ADR | `docs/DECISIONS.md`（AD-013 · AD-014） |
| TLV 価格 | `docs/PRICING.md`（本レポート対象外レーン） |
| AI 価格 Draft | `docs/AI/AI_MEMBERSHIP_PRICING.md` |
| Builder 課金 | `docs/AI/BUILDER_MONETIZATION.md` · `builder/builder-billing-policy.js` |
| Provider Boost | `docs/AI/BUILDER_PROVIDER_LISTING.md` |
| スポンサー | `docs/SPONSOR_ADS.md` |
| Platform 手数料 | `platform-chat-fee.js` · `platform-chat-fee-pay.js` |
| Featured Boost | `stripe-featured-config.js` · `supabase/functions/_shared/featured-plans.ts` |
| TASFUL AI | `stripe-genai-config.js` · `ai-workspace-usage.js` · `ai-workspace-billing-settings.js` |
| Quota 設計 | `reports/tasful-ai-workspace-enforcement-design.md` |
| BD サブスク | `docs/business-directory-subscription-model.md` |
| 収益監査 | `reports/revenue-production-readiness-review.md` |

---

*本ファイルは `reports/tasful-pricing-config-plan.md` として設計正本候補。実装ステータスは `docs/PROJECT_STATUS.md` / `docs/TODO.md` と整合させること。*
