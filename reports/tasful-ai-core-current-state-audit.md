# TASFUL AI Core — 現状調査レポート

**調査日:** 2026-07-05  
**目的:** 2026年8月の TASFUL AI Core 一括実装前に、既存実装・設計・未着手を切り分ける  
**方法:** コード・Edge・SQL・docs/reports 横断調査（**コード変更なし**）  
**正本参照:** `docs/DECISIONS.md` AD-005 · `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` · `docs/architecture/tasful-ai-architecture.md`

---

## 用語整理

本リポジトリにおける **「AI Core」** は公式に単一モジュール名ではない。AD-005 では **`ai-model-gateway.js` 契約**を「Gateway / AI Core 契約」と呼ぶ。本レポートの **TASFUL AI Core** は、ユーザー提示の構成ツリー（Router · Guard · Ledger · Subscription · Queue · Admin · 各サービス連携）を **横断基盤**として整理したもの。

**境界（変更禁止 · AD-002/003/004/010）**

| 領域 | 扱い |
| --- | --- |
| Builder AI | 別 surface · Gateway 経由可 · **統合禁止** |
| AI 秘書 | DeepSeek 専用 Adapter · **Gateway 非経由** |
| Platform / TLV | 専用 LLM エンジン **禁止** · Workspace 入口のみ |
| Secretary Google Tools | OAuth/Workspace · LLM ではない |

---

## 構成ツリー別 — 現状マトリクス

| コンポーネント | 状態 | 実装度 | 主な根拠 |
| --- | --- | --- | --- |
| **AI Router** | 一部実装 | ~40% | Gateway + Search Orchestrator + Router **設定 UI**（チャット未配線） |
| **Provider Adapter** | 一部実装 | ~50% | Gateway 分岐 · Voice Core registry · 秘書/BD 個別 Adapter |
| **Auto Mode** | 一部実装 | ~30% | `ai-workspace-model-router-settings.js`（localStorage · 実行時未接続） |
| **Manual Mode** | 実装済み | ~70% | `ai-model-selector.js` · `ai-plan-models.js` → Gateway `getSelectedModelId` |
| **User API Key 管理** | 未着手 | 0% | 設計上 Edge Secret のみ · BYOK テーブル/UI なし |
| **Usage Guard** | 一部実装 | ~35% | Workspace quota · Voice guard · **SAFE-05 統合ガード未** |
| **Cost Ledger** | 未着手 | ~5% | localStorage ログのみ · SAFE-06/07 設計のみ |
| **Subscription** | 一部実装 | ~65% | DB + Stripe Edge + quota 連携 · Billing UI はデモモード残 |
| **従量課金上限** | 一部実装 | ~40% | 日次 turn/vision のみ · 月次/メーター課金未 |
| **Usage Gauge** | 一部実装 | ~45% | Workspace usage 同期 · 請求画面はデモゲージ |
| **Queue** | 未着手 | 0% | SAFE-08 設計のみ · wrangler に Queue バインディングなし |
| **Admin Console** | 一部実装 | ~25% | 秘書 OPS ダッシュボード · **AI Core 専用管理画面なし** |
| **Builder 連携** | 実装済み | ~90% | `builder-ai-core.js` → Gateway `surface=builder_ai` |
| **Platform 連携** | 実装済み | ~95% | deterministic assist + `source=platform` 遷移のみ |
| **Talk 連携** | 一部実装 | ~60% | 下書き Gateway · QA は ConsultBridge |
| **Business Directory 連携** | 一部実装 | ~70% | 専用 Gemini Edge + quota · Gateway 非経由 |
| **TLV 連携** | 実装済み | ~90% | 入口リンク + `ai-workspace-tlv-source.js` のみ |

---

## 1. すでに実装済みのもの

### 1.1 Gateway 契約（AD-005 · 実質の LLM Router 中核）

| 項目 | 内容 |
| --- | --- |
| 正本 | `ai-model-gateway.js` — `TasuAiModelGateway.completeTurn()` |
| 役割 | 検索 orchestrator 連携 → プロバイダ別 Edge 呼び分け（gemini/openai/claude） |
| 付帯 | `ai-search-orchestrator.js` · `ai-interaction-log.js`（localStorage） |
| テスト | `scripts/test-tasful-ai-final-phase.mjs` **31/31 PASS**（参照時点） |
| 凍結 | AD-005 — 破壊的変更禁止 |

### 1.2 Manual モデル選択（Workspace / Builder）

| モジュール | 内容 |
| --- | --- |
| `ai-plan-models.js` | Free/Lite/Pro プラン別モデル定義 · localStorage 選択 |
| `ai-model-selector.js` | チップ UI · `setSelectedModelId` |
| Gateway | `completeTurn` 内で `getSelectedModelId` + `isModelAllowed` |

### 1.3 Workspace チャット · 検索 · 添付 · 音声

| 領域 | モジュール |
| --- | --- |
| チャット | `ai-workspace-chat.js` · `tasful-general-ai-shell.js` |
| 検索 | `ai-search-orchestrator.js` · `ai-web-search-serper.js` |
| 添付/Vision | `ai-workspace-attachments.js` |
| 音声 | `shared/voice-core/*` · `ai-workspace-voice.js` |
| 履歴 | `ai-history-store.js`（localStorage · max 500） |
| メディア計画 | `ai-video-generate.js` · `ai-music-generate.js` · Edge generate |

### 1.4 Edge — チャット / 検索 / Quota（Supabase）

| Function | Provider | Guard |
| --- | --- | --- |
| `gemini-chat` | Gemini | `enforceWorkspaceQuotaEntry` |
| `openai-chat` | OpenAI | 同上 |
| `claude-chat` | Claude | 同上 |
| `serper-search` | Brave（既定）/ Serper | なし |
| `ai-workspace-quota` | — | check/consume RPC |
| `openai-realtime-session` | OpenAI Realtime | kill switch + JWT + rate limit |
| `ai-workspace-video-generate` / `music-generate` | Gemini（計画文） | quota + kill switch |

共有: `supabase/functions/_shared/ai-workspace-quota.ts`

### 1.5 Edge — Cloudflare Pages Functions（AI）

| Route | 用途 |
| --- | --- |
| `/api/secretary-deepseek-chat` | AI 秘書 LLM（DeepSeek · AD-010） |
| `/api/gemini-ocr` | OCR（Platform モデレーション等） |
| `/api/gemini-tts` | TTS（Workspace 本命パス） |
| `/api/gemini-live-session` | Live セッショントークン発行 |
| Worker `gemini-live-proxy` | Gemini Live WS（本番想定 · Phase 4-B backlog） |

### 1.6 Subscription / Billing（GenAI Stripe）

| 層 | 実装 |
| --- | --- |
| DB | `gen_ai_subscriptions` · `gen_ai_entitlements` · `gen_ai_3d_*` |
| Edge | `stripe-create-genai-checkout` · `confirm` · `get-genai-plan` · `portal` · `webhook` |
| クライアント | `stripe-genai-config.js` · `ai-workspace-usage.js`（Phase2 Edge 同期） |
| カタログ | `shared/pricing/generated/tasful-pricing-config.js` |

### 1.7 日次 Quota 強制（Workspace）

| 項目 | 状態 |
| --- | --- |
| `ai_workspace_usage_daily` + RPC | Production 手動適用済（2026-06-28 レポート） |
| `ai-workspace-usage.js` | 送信前 `canUseAsync` · 成功後 `consume` |
| `ai-workspace-chat.js` | sendMessage 先頭で quota チェック |

### 1.8 各サービス連携（AD 準拠）

| サービス | 実装 | 入口 |
| --- | --- | --- |
| **Builder** | Gateway `surface=builder_ai` | `builder/builder-ai-core.js` |
| **Platform** | assist + リダイレクトのみ | `platform-search-assist.js` → `ai-workspace.html?source=platform` |
| **TLV** | 8テンプレ + 無料枠 UI | `live/tlv-tasful-ai-entry.js` · `ai-workspace-tlv-source.js` |
| **Talk** | 下書き + 相談委譲 | `talk-ai-search-bridge.js` |
| **BD** | 掲載下書き AI | `business-directory-ai.ts` + `business_directory_ai_draft_usage_daily` |
| **Site Assistant** | FAQ/内部検索 | `ai-consult-bridge.js` · Gateway **非接続** |

### 1.9 設定 UI（Workspace）

`ai-workspace-settings.js` 配下: 一般 · チャット · ルーティング · モデルルーター · 請求 · セキュリティ 等（**多くは localStorage 正本**）

---

## 2. 一部実装済みのもの

### 2.1 AI Router（製品定義 vs 実装ギャップ）

| あるもの | ないもの |
| --- | --- |
| Gateway が modelId + search を束ねる | **統一 Router サービス**（Edge 単一入口） |
| `ai-workspace-model-router-settings.js` Auto/Manual · use-case 別 preset | **`ai-workspace-chat.js` が `resolveGatewayModelId` を呼ばない** |
| `ai-workspace-routing-settings.js` inferUseCase | ルーター設定 → 実チャットへの配線未完 |
| `ai-intent-router.js` · `ai-search-router.js` | 全 Feature 横断ルーティングポリシーなし |

**判定:** Router **UI/設計は先行**、**実行時 Router は Gateway + 手動 model 選択に留まる**。

### 2.2 Provider Adapter

| Adapter | 経路 | 統一性 |
| --- | --- | --- |
| Gateway `callModel` | 3 Edge 直 POST | Workspace/Builder 共通 |
| `TasuSecretaryDeepSeekAdapter` | CF Function | 秘書専用 · Gateway 外 |
| `shared/voice-core/voice-provider-router.js` | STT/TTS/Realtime | Voice 専用 registry パターンあり |
| BD `business-directory-ai.ts` | Gemini 直 | 製品専用 |
| Tripo3D / Neural4D stub | genai-3d | アドオン |

**判定:** **パターンは複数存在**するが **AI Core 共通 Provider Adapter 層は未抽象化**。

### 2.3 Auto Mode

- `MODEL_MODES`: auto / speed / quality / cost
- `MODE_PRESETS` + `modelAutoRouting` フラグ（localStorage）
- `resolveGatewayModelId` は catalog id → gateway id マップまで実装
- **チャット送信パス未接続** → 実効は Manual チップ選択 + Gateway デフォルト

### 2.4 Usage Guard

| ガード済み | 未ガード / 弱い |
| --- | --- |
| Workspace text/vision（3 chat Edge） | `/api/gemini-ocr` |
| Media generate（kill + quota） | 秘書 DeepSeek CF |
| Voice Realtime（専用 guard） | `gemini-image-character-analyze` |
| BD AI draft quota | Turnstile / WAF / 統合 SAFE-05 |

設計正本: `docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md` — **実行前チェック順序は定義済み · 実装は Future**

### 2.5 Subscription / Billing UI

| 実装 | ギャップ |
| --- | --- |
| Stripe Checkout/Portal Edge | `ai-workspace-billing-settings.js` は **`localStorage_demo` モード** |
| `gen_ai_subscriptions`  limits 列 | カタログ JS と DB limits **二重定義** |
| Plan upgrade UI | Max ¥2,980 SKU **未実装**（Draft） |
| REL-F-04 AI Membership | 料金 **Draft** · 原価シミュレーション待ち |

### 2.6 Usage Gauge / ログ

| あるもの | 限界 |
| --- | --- |
| `ai-workspace-usage.js` 残回数（Edge 同期） | トークン数・コストなし |
| `TasuAiInteractionLog` localStorage | サーバー永続化なし |
| 秘書 `ai_usage` domain 集計 | クライアントログ依存 |
| 請求設定「今月の利用状況」UI | デモデータ |

### 2.7 Admin Console

| あるもの | ないもの |
| --- | --- |
| `admin-operations-dashboard.html`（秘書 OPS） | **TASFUL AI Core 専用 Admin**（SAFE-16） |
| 秘書朝レポート（手動 · OpsEvent 中心） | API コスト · プロバイダ別課金ダッシュボード |
| `admin-ai-kpi-center.js` 等 | 異常利用自動停止 UI |

### 2.8 Talk / BD 連携

- **Talk:** QA/cross-matching は Workspace 委譲 · 下書きのみ Gateway — **Talk 専用 quota/guard なし**
- **BD:** 独立 Edge · 日次 draft quota — **TASFUL AI サブスク entitlement とは未統合**

---

## 3. 設計だけあるもの

| ID / ドキュメント | 内容 | 分類 |
| --- | --- | --- |
| **REL-F-15** · `TASFUL_AI_SAFE_OPS_FOUNDATION.md` | SAFE-01〜17（WAF · Turnstile · Guard · Log · Cost · Queue · Admin） | **2026-08 着手目標** |
| **REL-F-04** · `AI_MEMBERSHIP_PRICING.md` | Lite/Pro/Max · Fair Use · ¥150 キャンペーン | Draft · 実装禁止扱い |
| `reports/tasful-ai-workspace-enforcement-design.md` | Phase 1→2 quota 設計（**Phase2 は実装済み**） | 設計→一部完了 |
| `reports/secretary-ops-context-builder-design.md` | 6 ドメイン · AI利用状況 collector 設計 | 秘書向け · 部分実装 |
| `sql/ai-workspace-voice-live-minute-migration.sql` | 音声分 quota 列 | **未適用 Draft** |
| `supabase/gen_ai_usage.sql` | 旧 gen-ai 日次 counters | legacy · 未使用 |
| `docs/AI/BUILDER_CREDITS.md` | 共通ポイント wallet | Future |
| `tasful_ai_api_credit` SKU | pricing catalog placeholder | usage metered · DB なし |
| CF Queue（SAFE-08） | バースト吸収 | wrangler 未設定 |
| 履歴 Supabase 同期 | P2 TBD | `tasful-ai-architecture.md` |
| User BYOK | — | 要件未定義 · テーブルなし |

---

## 4. 未着手のもの

| 項目 | 備考 |
| --- | --- |
| **統合 AI Core Router**（Edge 単一入口・policy engine） | Gateway 契約拡張は ADR 必須 |
| **User API Key 管理** | 現方針は Edge Secret のみ |
| **Cost Ledger**（`cost_ledger` · プロバイダ別集計） | SAFE-07 |
| **Usage Log 永続化**（`ai_usage_events` / `usage_log`） | SAFE-06 |
| **Token metering**（input/output tokens） | なし |
| **月次上限**（SAFE-13） | 日次のみ |
| **CF Queue + 非同期 AI ワーカー** | SAFE-08 |
| **TASFUL AI 専用 Admin Console** | SAFE-16 |
| **API コストアラート → 秘書毎朝レポート** | SAFE-15/17（コスト部分） |
| **Auto Mode の実行時配線** | UI のみ |
| **カタログ ↔ DB entitlements 正規化** | drift リスク |
| **gen_ai_* / ai_workspace_* の versioned migration** | 手動 SQL のみ |
| **Redis 分散 Rate Limit** | `VOICE_REALTIME_RATE_LIMIT_DISTRIBUTED` Future |

---

## 5. 既存ファイル一覧（AI Core 関連 · 代表）

### 5.1 クライアント — Gateway / Workspace 中核

```
ai-model-gateway.js              # AD-005 契約 · completeTurn
ai-search-orchestrator.js        # Web検索前処理
ai-plan-models.js                # プラン別モデル
ai-model-selector.js             # Manual 選択 UI
ai-workspace-chat.js             # チャット本体 · quota ゲート
ai-workspace-usage.js            # 日次 quota クライアント
ai-workspace-billing-settings.js # 請求 UI（demo モード）
ai-workspace-plan-upgrade.js     # プラン比較
ai-workspace-model-router-settings.js  # Auto/Manual 設定
ai-workspace-routing-settings.js       # use-case 推論
ai-interaction-log.js            # localStorage ログ
stripe-genai-config.js           # Stripe/Edge URL
shared/pricing/pricing-catalog-runtime.js
shared/pricing/generated/tasful-pricing-config.js
```

### 5.2 クライアント — 他 surface

```
builder/builder-ai-core.js       # Builder AI → Gateway
admin-ai-secretary-deepseek-adapter.js  # 秘書 · Gateway 外
talk-ai-search-bridge.js         # Talk 下書き
ai-consult-bridge.js             # Site Assistant / 内部検索
platform-search-assist.js        # Platform deterministic
live/tlv-tasful-ai-entry.js      # TLV 入口
business-directory/business-directory-ai-draft.js  # BD UI
```

### 5.3 Voice Provider Adapter パターン（参考実装）

```
shared/voice-core/voice-provider-router.js
shared/voice-core/voice-adapter-interface.js
shared/voice-core/adapters/voice-openai-realtime-adapter.js
shared/voice-core/adapters/voice-gemini-live-adapter.js
supabase/functions/_shared/voice-realtime-edge-guard.ts
```

### 5.4 Edge Functions（AI 関連 · 29+）

**Supabase（代表）:** `gemini-chat` · `openai-chat` · `claude-chat` · `serper-search` · `ai-workspace-quota` · `openai-realtime-session` · `ai-workspace-*-generate` · `gemini-image-character-analyze` · `gemini-tts` · `genai-3d-generate` · `stripe-*-genai-*` · `business-directory`（AI action）

**Cloudflare:** `secretary-deepseek-chat` · `gemini-ocr` · `gemini-tts` · `gemini-live-session` · Worker `gemini-live-proxy`

### 5.5 設計・ステータス docs

```
docs/AI/TASFUL_AI.md
docs/AI/TASFUL_AI_SAFE_OPS_FOUNDATION.md
docs/AI/AI_MEMBERSHIP_PRICING.md
docs/architecture/tasful-ai-architecture.md
docs/DECISIONS.md (AD-005, AD-010)
docs/TODO.md (REL-F-15, SAFE-01〜17, REL-F-04)
reports/tasful-ai-current-status.md
reports/tasful-ai-workspace-phase2-production.md
reports/tasful-ai-production-ready-verification.md
```

### 5.6 テスト・検証

```
scripts/test-tasful-ai-final-phase.mjs
scripts/verify-tasful-ai-monitoring.mjs
scripts/test-builder-ai-live-qa.mjs
scripts/test-business-directory-ai-draft-phase1b-edge.mjs
```

---

## 6. 既存 DB / migration 一覧

### 6.1 TASFUL AI Core 直結（manual SQL · migrations 外）

| オブジェクト | ファイル | 適用 |
| --- | --- | --- |
| `public.gen_ai_subscriptions` | `supabase/gen_ai_subscriptions.sql` | Production 手動（Stripe runbook） |
| `public.gen_ai_entitlements` | `supabase/gen_ai_entitlements.sql` | 同上 |
| `public.ai_workspace_usage_daily` | `sql/ai-workspace-usage-daily.sql` | Production 2026-06-28 |
| RPC `check_ai_workspace_quota` / `consume_ai_workspace_quota` | 同上 | 同上 |
| `public.gen_ai_3d_tickets` 等 | `supabase/gen_ai_3d_*.sql` | Production |
| `public.gen_ai_usage_daily` | `supabase/gen_ai_usage.sql` | **legacy draft · 未使用** |
| `voice_used_minutes` + RPC | `sql/ai-workspace-voice-live-minute-migration.sql` | **未適用** |

### 6.2 versioned migrations（AI 隣接）

| Migration | 内容 |
| --- | --- |
| `20260716100000_business_directory_ai_draft_usage.sql` | BD AI draft 日次 quota |
| `20260710100000_secretary_google_token_vault.sql` | 秘書 OAuth（AI Key ではない） |

### 6.3 意図的に存在しないテーブル

`usage_log` · `cost_ledger` · `token_usage` · `user_api_keys` · `tasful_ai_*` namespace · `monthly_usage`（TASFUL AI）

---

## 7. 既存 Edge / Worker 一覧（AI）

| 種別 | 名前 | Provider |
| --- | --- | --- |
| Supabase | gemini-chat / openai-chat / claude-chat | 各社 |
| Supabase | serper-search | Brave/Serper |
| Supabase | ai-workspace-quota | — |
| Supabase | openai-realtime-session | OpenAI |
| Supabase | ai-workspace-video-generate / music-generate | Gemini |
| Supabase | gemini-image-character-analyze | Gemini Vision |
| Supabase | gemini-tts | Gemini |
| Supabase | genai-3d-generate | Tripo3D |
| Supabase | stripe-create/confirm/get-genai-plan/portal/webhook | Stripe |
| Supabase | business-directory (generate_listing_draft) | Gemini |
| CF Pages | secretary-deepseek-chat | DeepSeek |
| CF Pages | gemini-ocr / gemini-tts / gemini-live-session | Gemini |
| CF Worker | gemini-live-proxy | Gemini Live WS |

**Queue:** なし（`deploy/cloudflare/workers/wrangler.toml` は `gemini-live-proxy` のみ）

---

## 8. 足りない DB

| 優先 | テーブル / RPC | 用途 |
| --- | --- | --- |
| P0 | `ai_usage_events`（仮称） | SAFE-06 · surface/model/feature/request_id |
| P0 | `provider_cost_daily` or `cost_ledger` | SAFE-07 · 推定コスト集計 |
| P1 | `ai_usage_monthly` | SAFE-13 月次上限 |
| P1 | `pricing_entitlements` mirror | カタログ ↔ DB 単一正本 |
| P1 | `api_credit_wallet` + ledger | `tasful_ai_api_credit` SKU |
| P2 | `voice_used_minutes` 列適用 | 音声分 quota |
| P2 | チャット履歴 Supabase | P2 同期設計 |
| Ops | `gen_ai_*` を `supabase/migrations/` へ昇格 | Staging/Prod drift 防止 |

---

## 9. 足りない Edge

| 優先 | 機能 | 備考 |
| --- | --- | --- |
| P0 | **統合 Usage Guard middleware** | 既存 Edge への共通 pre-hook（OCR/秘書/vision 含む） |
| P0 | **Usage ingest API** | log event 書き込み（service_role） |
| P1 | **Cost aggregation batch** | 日次集計 · 秘書レポート入力 |
| P1 | **Billing read API 統一** | billing-settings の demo 廃止 |
| P2 | **CF Queue consumer** | 非同期推論 · バースト制御 |
| P2 | **Turnstile verify** | CF Pages / Supabase 共通 |

**注意:** Gateway 契約変更なしで進めるなら、**新 Edge は Gateway 外の横断層**として追加する設計が AD-005 と両立しやすい。

---

## 10. 足りない UI

| 優先 | 画面 / 機能 | 現状 |
| --- | --- | --- |
| P0 | Workspace 請求の **本番データ接続** | localStorage_demo |
| P0 | 統一 **利用上限到達** UX（全 Feature） | テキスト turn のみ整備 |
| P1 | **AI Core Admin**（利用状況 · コスト · 停止） | 秘書 OPS のみ |
| P1 | Auto Mode **実行結果の表示**（どのモデルが選ばれたか） | 設定画面のみ |
| P2 | User API Key（採用する場合） | 未設計 |
| P2 | 月次ゲージ · コスト見積り | デモ/なし |

---

## 11. 8月にやるべき優先順位（推奨）

**前提:** Staging のみ · Production SQL/MCP/Live Stripe/CF Production deploy **禁止**（プロジェクトルール）  
**ゴール:** 「AI Core」ではなく **SAFE 縦スライス 1 本** + **既存資産の配線完了**

| 順位 | タスク | 理由 |
| --- | --- | --- |
| **1** | **SAFE-05 Usage Guard 縦スライス**（Chat 1 本 + OCR 1 本） | コスト直結 · 設計正本あり · 実行後制限禁止 |
| **2** | **SAFE-06 Usage Log**（`ai_usage_events` + ingest Edge） | Admin/秘書レポートのデータソース |
| **3** | **Auto Router 配線**（`resolveGatewayModelId` → `completeTurn.modelId`） | UI 先行実装の実益化 · AD-005 範囲内 |
| **4** | **Billing Adapter 本接続**（billing-settings demo → Stripe Edge） | Subscription 実装の UI 完結 |
| **5** | **migration 昇格**（`ai_workspace_usage_daily` + `gen_ai_subscriptions`） | drift 防止 · 8月以降の本番準備 |
| **6** | **SAFE-07 Cost Ledger（推定）** | プロバイダ別 · 日次 · 秘書朝レポート連携 |
| **7** | **未ガード Edge 横断**（秘書 DeepSeek · character analyze） | 穴埋め |
| **8** | **CF WAF/Turnstile Staging runbook**（SAFE-01/02） | インフラ · コードと並行 |
| **9** | **Queue（SAFE-08）** | 負荷対策 · 1〜7 完了後 |
| **10** | **AI Core Admin（SAFE-16）** | ログ/コスト DB 依存 |

**後回し（8月スコープ外推奨）**

- REL-F-04 Membership 価格確定・Max SKU
- User BYOK
- Gateway 破壊的変更 / 単一 Edge Router への統合（ADR 必要）
- Builder Credits · Platform/TLV 専用エンジン
- 履歴 Supabase 全量同期

---

## 12. 実装フェーズ案（2026-08）

### Phase A — 安全最小縦スライス（2〜3 週）

- [ ] Staging: `ai_usage_events` DDL + RLS draft
- [ ] 共通 `enforceAiUsageGuard()`（auth · plan · daily · feature）を `gemini-chat` + `gemini-ocr` に適用
- [ ] `ai-workspace-chat.js` に `resolveGatewayModelId` 配線
- [ ] `node scripts/test-tasful-ai-final-phase.mjs` + 新規 `test-tasful-ai-safe-ops-guard.mjs`（未作成）
- [ ] 8788 検証 · Console 0

### Phase B — 課金・可視化（2 週）

- [ ] billing-settings を Edge フェッチに切替
- [ ] usage gauge を DB/Edge 正本に統一（demo 削除）
- [ ] カタログ limits → `gen_ai_subscriptions` 同期方針ドキュメント化
- [ ] voice minute migration Staging 適用判断

### Phase C — 運用基盤（2〜3 週）

- [ ] Cost 日次集計（推定単価表 · batch）
- [ ] 秘書朝レポートに AI コストサマリ追加（draft 表示）
- [ ] SAFE-16 最小 Admin（read-only 利用一覧）
- [ ] CF Turnstile Staging Preview

### Phase D — 拡張（9月以降）

- [ ] Queue · 月次上限 · Token metering
- [ ] migrations 正規化 · Production Go 判断（10月チェックリスト連携）

---

## 各サービス AI 呼び出し箇所（調査結果）

| サービス | 呼び出し | Gateway | 専用 Edge | 備考 |
| --- | --- | --- | --- | --- |
| **TASFUL AI Workspace** | `ai-workspace-chat.js` | ✅ | quota/media/voice | 本命 |
| **Builder AI** | `builder-ai-core.js` | ✅ `builder_ai` | — | AD-002 分離 |
| **Platform** | `platform-search-assist.js` 等 | ❌ | — | `source=platform` 遷移のみ |
| **Talk** | `talk-ai-search-bridge.js` | △ 下書きのみ | — | QA は ConsultBridge |
| **Business Directory** | `business-directory-ai-draft.js` | ❌ | `business-directory` | 独立 quota |
| **TLV** | `tlv-tasful-ai-entry.js` | ❌（入口） | — | Workspace に委譲 |
| **AI 秘書** | `admin-ai-secretary-phase2.js` | ❌ | CF DeepSeek | AD-010 |
| **Site Assistant** | `tasful-site-assistant-adapter.js` | ❌ | — | FAQ/内部検索 |
| **Platform OCR** | `chat-ocr.js` | ❌ | CF `gemini-ocr` | Usage Guard なし |

---

## Go / No-Go 判定（8月実装開始）

| 判定 | 項目 |
| --- | --- |
| **Go** | SAFE-05/06 の **Staging 縦スライス**（Chat + OCR） |
| **Go** | Auto Router **配線**（Gateway 契約内） |
| **Go** | Billing UI の **Edge 接続**（Stripe Test） |
| **Go** | manual SQL の **migration 化（Staging）** |
| **Conditional Go** | Cost Ledger · Admin Console — **Phase A ログ DB 完了後** |
| **No-Go** | `ai-model-gateway.js` **破壊的変更**（ADR なし） |
| **No-Go** | Builder/秘書/Platform/TLV **統合エンジン化** |
| **No-Go** | Production Supabase 適用 · Stripe Live · CF Production（明示承認まで） |
| **No-Go** | REL-F-04 **Membership 価格確定前の本番課金変更** |
| **No-Go** | CF Queue 本番バインディング（設計・Staging 検証前） |

**総合:** 8月は **「TASFUL AI Core 新規フレームワーク一括」ではなく、既存 Gateway + Edge + Stripe 資産の上に SAFE 運用層を載せる** 方針が現実的（Go）。全面リファクタは No-Go。

---

## 参照コミット・レポート

| 資料 | 用途 |
| --- | --- |
| `reports/tasful-ai-p1-implementation.md` | P1 完了スナップショット |
| `reports/tasful-ai-workspace-phase2-production.md` | quota Production 適用 |
| `reports/tasful-ai-production-ready-verification.md` | Production Ready Go 根拠 |
| `reports/tasful-pricing-config-plan.md` | カタログ · Boost 等（Platform 別レーン） |
| `docs/KNOWN_ISSUES.md` KI-001 | Gateway diff 解消記録 |
| `docs/TODO.md` REL-F-15 · SAFE-01〜17 | 8月バックログ正本 |

---

*本レポートは調査のみ。実装・migration 適用は別タスク・明示承認後に実施すること。*
