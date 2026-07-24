# TASFUL Pricing Catalog — 運用正本

**最終更新:** 2026-07-05  
**スコープ:** Platform · TASFUL AI · Builder 等の価格・上限・Stripe env key の **Single Source of Truth (SSOT)**

---

## 1. SSOT（正本）

| レイヤ | 正本パス | 備考 |
| --- | --- | --- |
| **Catalog JSON** | `shared/pricing/tasful-pricing-catalog.json` | **唯一の手編集対象** |
| Schema | `shared/pricing/pricing-catalog.schema.json` | 構造定義 |
| フロント generated | `shared/pricing/generated/tasful-pricing-config.js` | **編集禁止** |
| フロント snapshot | `shared/pricing/generated/tasful-pricing-snapshot.js` | **編集禁止**（P1–P3 主要 SKU の fallback） |
| Edge generated | `supabase/functions/_shared/generated/tasful-pricing-config.ts` | **編集禁止** |
| Runtime bridge | `shared/pricing/pricing-catalog-runtime.js` | catalog → 各 UI/Stripe モジュール |
| バリデータ | `scripts/lib/pricing-catalog-validator.mjs` | 構造検証 |

**価格・日次上限をソースに新規ハードコードしない。** UI / Edge / Stripe フロントは catalog または generated 経由で参照する。

**Free 枠（TASFUL AI）** は catalog 外 — [DECISIONS.md §AD-016](./DECISIONS.md) を参照。

---

## 2. 編集禁止（generated）

以下は `node scripts/generate-pricing-config.mjs` の出力のみ更新する:

- `shared/pricing/generated/tasful-pricing-config.js`
- `shared/pricing/generated/tasful-pricing-snapshot.js`
- `supabase/functions/_shared/generated/tasful-pricing-config.ts`

手編集した場合、次回 generate で上書きされる。PR では **JSON の diff のみ** をレビューする。

---

## 3. 標準ワークフロー

```bash
# 1. JSON のみ編集
#    shared/pricing/tasful-pricing-catalog.json

# 2. 生成
node scripts/generate-pricing-config.mjs

# 3. 検証
npm run verify:pricing-catalog

# 4. 静的ステージ（ローカル）
#    CF_PAGES 未設定 = local target（下記 §5）
npm run build:pages

# 5. 領域別 regression（変更に応じて）
node scripts/test-ai-workspace-quota-unit.mjs
node scripts/verify-ai-plan-compare-modal.mjs
node scripts/verify-ai-billing-settings-tab.mjs
```

---

## 4. SKU 追加手順

1. `tasful-pricing-catalog.json` の `skus` にエントリを追加（`sku` キーと `sku` フィールドを一致させる）
2. 必須フィールド: `domain`, `label`, `description`, `billingType`, `currency`, `provisional`, `enabled`, `status`
3. 有料 SKU: `amount` + 必要なら `stripePriceEnvKey`（Stripe Dashboard の Secret 名と一致）
4. 上限: `limits.daily` / `limits.monthly`（未使用キーは `null` または `0` でよい）
5. `scripts/generate-pricing-config.mjs` の `SNAPSHOT_SKU_IDS` に含めるか判断（フロント fallback が必要な SKU のみ）
6. `shared/pricing/pricing-catalog-runtime.js` または Edge shared（`genai-plans.ts` / `genai-checkout-plans.ts`）に legacy ID マッピングを追加
7. generate → verify → 該当 HTML に pricing script 3 本が読み込まれているか確認
8. **Production deploy / Edge deploy / DB migration は別タスク**（本ドキュメントの generate だけでは本番反映されない）

### billingType 早見

| 型 | 用途 |
| --- | --- |
| `fixed` | 都度課金（Builder Contact Reveal 等） |
| `subscription` | 月額サブスク（Lite / Pro / Add-on 2D Live） |
| `percent` | 率課金 + 最低額（Connect） |
| `usage` | 従量（API Credit 候補） |
| `placeholder` | 価格未確定 · **enabled:false 推奨** |

---

## 5. 価格変更手順

1. **JSON の `amount` のみ** を更新（ハードコード箇所を同時に直さない）
2. `updatedAt` を当日（`YYYY-MM-DD`）に更新
3. `node scripts/generate-pricing-config.mjs`
4. `npm run verify:pricing-catalog`
5. Stripe Dashboard で Price を変更する場合は **Secret 名（`stripePriceEnvKey`）は変えず** Price ID のみ差し替え（本番は人手 · 本タスクでは Stripe 変更禁止）
6. UI / billing デモが catalog 経由であることを grep で確認（`300` / `980` 等の直書きが増えていないこと）

---

## 6. Placeholder 追加手順

将来 SKU（課金導線なし）のテンプレート:

```json
"tasful_ai_example_placeholder": {
  "sku": "tasful_ai_example_placeholder",
  "domain": "tasful_ai",
  "label": "機能名（未確定）",
  "description": "設計中 — 課金導線なし",
  "billingType": "placeholder",
  "currency": "JPY",
  "provisional": true,
  "enabled": false,
  "status": "draft",
  "limits": { "daily": { "feature_key": null } },
  "features": ["future_addon"]
}
```

- **`enabled: false`** — checkout / UI CTA を出さない
- **`status: draft`** — 設計中（`planned` はより先の構想）
- **`provisional: true`** — 価格・上限が未確定であることを示す
- Max / Ultra / Enterprise / API Credit 等はこのパターンに従う（AD-016 · P4）

---

## 7. limits 構造（TASFUL AI）

`limits.daily` で使用するキー（未使用は `0` または `null`）:

| キー | 意味 |
| --- | --- |
| `text_turn` | テキスト回答（日次） |
| `voice_turn` | 音声ターン（日次） |
| `image_turn` | 画像生成（日次） |
| `deep_research_turn` | Deep Research（日次） |
| `video_minute` | 動画生成（分/日） |
| `realtime_voice_minute` | リアルタイム音声（分/日） |

`limits.monthly` 例:

| キー | 意味 |
| --- | --- |
| `fair_use_policy` | Max 等の Fair Use ポリシー ID |
| `api_credit_units` | API クレジット単位 |
| `seat_policy` | Enterprise 席数ポリシー |

---

## 8. Build 運用（CF_PAGES · env guard）

実装: `scripts/lib/builder-deploy-flags.mjs` · `deploy/cloudflare/stage-cloudflare-pages.mjs`

| モード | 条件 | Supabase 期待 | 結果 |
| --- | --- | --- | --- |
| **Local** | `CF_PAGES` 未設定または `≠ 1` | Staging / Production どちらでも可 | **PASS**（`cfDeployTarget=local`） |
| **Preview** | `CF_PAGES=1` かつ branch ≠ `cf-pages-deploy` | **Staging** ref `ahlxuyvhzqdqaojiywmu` | **PASS** |
| **Preview** | `CF_PAGES=1` | Production ref | **FAIL**（guard） |
| **Production** | `CF_PAGES=1` かつ branch = `cf-pages-deploy` | **Production** ref `ddojquacsyqesrjhcvmn` | **PASS** |
| **Production** | `CF_PAGES=1` かつ branch = `cf-pages-deploy` | Staging ref | **FAIL**（guard） |

### ローカル build（推奨）

```powershell
Remove-Item Env:CF_PAGES -ErrorAction SilentlyContinue
$env:TASFUL_SUPABASE_URL="https://ahlxuyvhzqdqaojiywmu.supabase.co"
$env:TASFUL_SUPABASE_ANON_KEY="eyJ..."
npm run build:pages
```

### 既知の失敗（仕様）

CI / ローカルで `CF_PAGES=1` + Production branch + **Staging** `chat-supabase-config.js` URL の組み合わせは意図的に **exit 1**:

```
Production deploy must not use Staging Supabase URL
```

→ Preview は Staging · Production deploy は Production URL を使う（[supabase-environments.md](./supabase-environments.md)）。

---

## 9. Billing Adapter（TASFUL AI）

| 項目 | 現状（P4） | 将来 |
| --- | --- | --- |
| モード | `localStorage_demo` | `stripe_edge` |
| 状態保存 | `tasu_ai_billing_settings`（localStorage） | Edge `stripe-get-genai-plan` + DB |
| プラン一覧 | `TasuPricingRuntime.buildGenAiBillingPlans()` | 同上 + Stripe Subscription |
| 利用状況 | `buildGenAiUsageSnapshot` + usage モジュール | Edge quota API |
| 履歴・支払い | catalog 金額から生成した **デモデータ** | Stripe Invoice / Portal |
| アップグレード | `runUpgradePlan` → `console.info` demo | `stripe-create-genai-checkout` |
| 管理・解約 | `runManagePlan` / `runCancelPlan` demo | `stripe-create-genai-portal` |

**切替ポイント（コード）:** `ai-workspace-billing-settings.js`

1. `BILLING_ADAPTER_MODE` 定数
2. `loadState` / `persistState`
3. `runUpgradePlan` · `runManagePlan` · `runCancelPlan` 系
4. `buildBillingHistoryFromCatalog`（デモ履歴）
5. `formatForApiRequest`（API 契約の正本）

実装は **Production Ready 接続タスク**（P5 以降）。P4 ではドキュメントと定数の整理のみ。

---

## 10. Edge / フロント対応表（TASFUL AI · P4）

| Legacy ID | Catalog SKU | Edge / フロント |
| --- | --- | --- |
| `genai_basic_300` | `tasful_ai_lite` | `genai-plans.ts` · `stripe-genai-config.js` |
| `genai_pro_980` | `tasful_ai_pro` | 同上 |
| Max placeholder | `tasful_ai_max_placeholder` | `buildGenAiMaxPlaceholder` · checkout なし |
| `genai_2d_live_300` | `tasful_ai_addon_2d_live_300` | `genai-checkout-plans.ts` · `stripe-genai-config.js` |
| `genai_3d_generate_500` | `tasful_ai_addon_3d_generate_500` | 同上（`enabled:false` · draft） |

---

## 11. 関連ドキュメント

- [DECISIONS.md §AD-016](./DECISIONS.md) — Free 枠 catalog 外
- [local-dev.md](./local-dev.md) — 8788 検証 · build 手順
- [supabase-environments.md](./supabase-environments.md) — Staging / Production ref
- [AI/AI_MEMBERSHIP_PRICING.md](./AI/AI_MEMBERSHIP_PRICING.md) — 製品仕様（catalog と矛盾時は catalog + ADR を優先して整合）

---

*Pricing Config P4 完了時点の運用正本。Stripe 本番 · Edge deploy · DB 反映は含まない。*
