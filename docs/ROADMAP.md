# TASFUL ロードマップ

**最終更新:** 2026-06-27（Business Directory UI Flow 設計）

---

## 凡例

| 記号 | 意味 |
| --- | --- |
| ✅ | 完了（根拠: コミット / レポート / テスト） |
| 🔄 | 実装済み · 本番接続 or 運用タスク残 |
| 📋 | 未着手 or 設計のみ |
| 🔒 | Production Ready · 凍結（Critical/Security のみ変更可） |

---

## サービス展開方針（2026-06 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-011**

| 製品 | 当面 | 海外 |
| --- | --- | --- |
| **Builder** | 日本国内完成優先 · 建設・案件管理専用 | **対象外** |
| **Platform** | 日本国内向け | 発送・多通貨・多言語は将来。**今は海外前提実装なし** |
| **TLV** | 日本発で開発 | 将来は海外ユーザー利用可能な設計。多言語・翻訳は将来 |
| **TASFUL AI** | 日本発で開発 | 将来は海外ユーザー利用可能な設計。多言語・音声・専門 AI は段階追加 |

**共通:** 日本法人・日本運営。「海外ユーザーが使える設計」と「本格海外展開」は区別。国別法人・法対応は利益・法務体制整備後。

---

## UI/UX 設計原則（2026-06 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-012**

| 思想 | 内容 |
| --- | --- |
| **目的** | 高機能でありながら、誰でも直感的に使える |
| **高機能** | **AI** で処理 |
| **シンプル** | **UI** で実現 |

**原則（要約）:** 高機能とシンプルの両立 · 小学生でも分かる · 一目で用途理解 · 迷えばシンプル優先 · 平易な言葉 · AI で複雑操作を簡素化 · 新機能でも既存 UI を複雑化しない

**補足:** UI 単純化が目的ではない。必要な機能は実装し、複雑さは AI が吸収してユーザーにシンプルな UI を提供する。

---

## Business Directory — サブスク掲載モデル（2026-06-27 確定）

**正本:** [DECISIONS.md](./DECISIONS.md) **AD-013** · 詳細: [business-directory-subscription-model.md](./business-directory-subscription-model.md)

| 領域 | 収益主軸 | 状態 |
| --- | --- | --- |
| **店舗・販売** | 月額サブスク掲載料 | 🔄 Phase 6 Stripe · Owner/Ops/Public/課金 接続済 |
| **業務サービス** | 月額サブスク掲載料 | 🔄 Phase 6 Stripe · Owner/Ops/Public/課金 接続済 |
| **Marketplace（商品）** | **成約手数料** | ✅ 既存方針 **維持** |
| **Platform / 案件** | **成約手数料** | ✅ 既存方針 **維持** |
| **広告枠** | スポンサー · 上位表示 · PR | 📋 将来 |

**プラン案:** Free · Standard · Pro · Premium/Future（サブスク課金 · 決済実装は別 Epic）

**MVP 設計:** [business-directory-mvp-design.md](./business-directory-mvp-design.md) · `reports/business-directory-mvp-design.md`

**Self-Service:** [business-directory-self-service-design.md](./business-directory-self-service-design.md) · `reports/business-directory-self-service-design.md`

**Data Model:** [business-directory-data-model-design.md](./business-directory-data-model-design.md) · `reports/business-directory-data-model-design.md`

**UI Flow:** [business-directory-ui-flow-design.md](./business-directory-ui-flow-design.md) · `reports/business-directory-ui-flow-design.md`

**Phase 1 DB:** `supabase/migrations/20260711100000_business_directory_phase1_schema.sql` · seed · `scripts/test-business-directory-phase1-schema.mjs` · `reports/business-directory-phase1-db.md`

**Phase 2 API:** service + Edge · `scripts/test-business-directory-phase2-api.mjs` · `reports/business-directory-phase2-api.md`

**Phase 3 Owner UI:** `business-directory/` · `scripts/test-business-directory-phase3-owner-ui.mjs` · `reports/business-directory-phase3-owner-ui.md`

**Phase 4 Admin UI:** `business-directory/admin/` · `scripts/test-business-directory-phase4-admin-ui.mjs` · `reports/business-directory-phase4-admin-ui.md`

**Phase 5 Public UI:** `business-directory/public/` · `scripts/test-business-directory-phase5-public-ui.mjs` · `reports/business-directory-phase5-public-ui.md`

**Phase 6 Stripe:** migration · checkout · webhook · plan guard · `scripts/test-business-directory-phase6-stripe.mjs` · `reports/business-directory-phase6-stripe.md`

**Phase 7 Preflight:** `scripts/test-business-directory-phase7-deploy-preflight.mjs` · `reports/business-directory-phase7-deploy-preflight.md` — **Pages build Go**

**Production Step 1 Migration:** `reports/business-directory-production-step1-migration.md` · staging apply + repair 済

**Production Step 2 Edge:** `reports/business-directory-production-step2-edge.md` · Edge deploy · secrets · **15/15 smoke PASS**

**Production Step 3 Preview E2E:** `reports/business-directory-production-step3-preview-e2e.md` · Pages preview · mock なし E2E **15/15 PASS**

**Production Step 4 Deploy:** `reports/business-directory-production-step4-production.md` · Production Pages · 最終 smoke **48/48 PASS · Go**

**報告:** `reports/business-directory-subscription-model.md`

---

## 製品基盤

| フェーズ | 状態 | 根拠 |
| --- | --- | --- |
| Builder v1.0 | ✅ 🔒 | `reports/builder-release-status.md` |
| Platform NB-1M | ✅ 🔒（製品） | スモーク PASS · `reports/platform-nb1m-frontend-prod-deploy-ready.md` |
| TLV v1.0 | ✅ 🔒 | `reports/tlv-release-status.md` |
| AI 運営秘書 v1.1 | ✅ 🔒 | `reports/ai-ops-secretary-release-status.md` |
| TALK / Connect / 安否 | ✅ 🔒 | 各 release-status レポート |

---

## AI ロードマップ

### AI プロバイダ分担（確定 · 2026-06-26）

| 製品 / 領域 | 本番 API | 参照 |
| --- | --- | --- |
| AI 秘書 | **DeepSeek**（秘書専用 Adapter · Gateway 非混在） | [AI/SECRETARY_AI.md](./AI/SECRETARY_AI.md) · AD-010 |
| TASFUL AI | **OpenAI** | [AI/TASFUL_AI.md](./AI/TASFUL_AI.md) |
| TASFUL AI 操作アシスタント | **Gemini** | [tasful-ai-ui-operation-assist-backlog.md](./tasful-ai-ui-operation-assist-backlog.md) |
| Builder AI | **OpenAI** + **Gemini Vision**（Gateway） | [AI/BUILDER_AI.md](./AI/BUILDER_AI.md) |
| Builder AI 計算 Orchestrator | ✅ 実装（Phase 3） | `reports/builder-ai-tools-phase3.md` |
| Builder AI Live Phase 4-A | ✅ 実装（Live 風 MVP） | `66051f7` · `reports/builder-ai-live-phase4-plan.md` |
| Builder AI Gemini Live Phase 4-B | 📋 Backlog | [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |
| Groq / Cerebras / Claude | 採用しない（現時点） | — |

### Builder AI

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| 設計 | ✅ | `reports/builder-ai-architecture.md` |
| P1（actions · UI · 隔離） | ✅ | `5ed9672` |
| P2-A / P2-B（tools · JWT · draft staging SQL） | ✅ | `5ed9672` · `reports/builder-ai-p2-b.md` |
| **P2-C**（DB 適用 · hook · Supabase 正本化 · Live E2E） | 📋 | `reports/builder-ai-p2-b.md` §9 |
| **UI Phase 1**（現場診断 UI シェル） | ✅ | `5d28acc` |
| **Vision Phase 2**（Gemini Vision · Gateway attachments） | ✅ | `4aff9ec` |
| **Tool Integration Phase 3**（自然文 → 計算ツール Orchestrator） | ✅ | `05c32ad` · `reports/builder-ai-tools-phase3.md` |
| **Live Phase 4-A**（カメラ · Voice · スナップショット Vision · Live 風 MVP） | ✅ | `66051f7` · `reports/builder-ai-live-phase4-plan.md` |
| **Vision Phase 5**（構造化 JSON 診断 · Analyzer · 11 カテゴリ） | ✅ `7ef4efd` | `reports/builder-ai-phase5-vision.md` |
| **Project Hub Phase 6-A**（案件ハブ MVP · Vision 保存） | ✅ `46c5e02` | `reports/builder-project-hub-phase6a.md` |
| **Project Calendar Phase 6-B**（工程 · 月/週カレンダー · 遅延） | ✅ `556f315` | `reports/builder-project-calendar-phase6b.md` |
| **Project Finance Phase 6-C**（見積/原価/粗利 · 支払サマリー） | ✅ `e70d679` | `reports/builder-project-finance-phase6c.md` |
| **Estimate/Invoice Phase 6-D**（見積・請求基盤 · SCHEMA v4） | ✅ `8be158f` | `reports/builder-estimate-invoice-phase6d.md` |
| **Contract/Completion Phase 6-E**（契約・完了基盤 · SCHEMA v5） | ✅ `ac385c6` | `reports/builder-contract-completion-phase6e.md` |
| **Document Center Phase 6-F**（ドキュメント管理基盤 · SCHEMA v6） | ✅ `549e562` | `reports/builder-document-center-phase6f.md` |
| **Notification Center Phase 6-G**（通知基盤 Foundation · SCHEMA v7） | ✅ `74d54b8` | `reports/builder-notification-center-phase6g.md` |
| **Command Dashboard Phase 6-H**（司令塔 KPI · Store 読取のみ） | ✅ 実装 · 未コミット | `reports/builder-dashboard-phase6h.md` |
| **Gemini Live Phase 4-B**（WebSocket · ephemeral token · 真 Live） | 📋 Backlog | [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) |

### Platform（製品機能）

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| **Coupon System**（店舗発行 · 購入者適用 · 運営監視） | 📋 Backlog | [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md) · 共通基盤化前提 · **UI Critical 優先度外** |

### Platform AI（入口のみ）

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| Next Phase（search hub · badges · OAuth コード） | ✅ | `5ed9672` |
| Finish Phase（listing 配線 · favorites UI · compare） | ✅ | `5ed9672` |
| Featured / favorites DB / OAuth E2E | 📋 | `reports/platform-finish-phase.md` §9 |

### TASFUL AI Workspace

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| チャット · 検索 · 画像 UI | ✅（既存 + 更新） | コミット前から存在 |
| Final（履歴 · 動画 · 音楽 · 資料 · 音声 · 規約） | ✅ | `5ed9672` · `reports/tasful-ai-final-phase.md` |
| **課金 enforcement Phase 1**（クライアント） | ✅ | `2a43fe5` · Production deploy |
| **課金 enforcement Phase 2**（Edge + DB） | ✅ コード · ⏳ deploy | `reports/tasful-ai-workspace-phase2-enforcement.md` |
| **本番接続**（Edge · billing · Access E2E） | 🔄 | `reports/tasful-ai-production-preflight.md` |
| **操作アシスタント**（Gemini · 画面操作案内 · 製品横断ナビ） | 📋 Backlog | [tasful-ai-ui-operation-assist-backlog.md](./tasful-ai-ui-operation-assist-backlog.md) · 本番接続 P0 後 |

### TLV AI

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| TLV 専用 AI エンジン | ❌ 作らない | [DECISIONS.md](./DECISIONS.md) |
| Workspace 入口（`source=tlv`） | ✅ | `5ed9672` · `reports/tlv-tasful-ai-entry.md` |

### AI 秘書

| フェーズ | 状態 | 内容 |
| --- | --- | --- |
| v1.1 リリース | ✅ 🔒 | `reports/ai-ops-secretary-release-status.md` |
| **本番 AI API** | ✅ 方針確定 | **DeepSeek API**（AD-010）· 要約/優先付け/自然文のみ · 遷移/件数/検索/フィルターは非AI |
| 未コミット phase ファイル | 📋 要整理 | working tree に `admin-ai-secretary-phase*.js` 等 |
| **DeepSeek 本番接続** | 📋 **P0 実装** | 秘書専用 Adapter / Edge · **Gateway 非混在**（[TODO.md](./TODO.md) §P0-3） |
| **Operations Orchestrator Phase 5-A** | ✅ 実装（未コミット） | Registry · Classifier · Human Gate · Task Queue · `reports/secretary-orchestrator-phase5a.md` |
| **Operations Orchestrator Phase 5-B** | ✅ 実装（未コミット） | OpsEvent · HSG · CI ingest · 朝レポート · `reports/secretary-orchestrator-phase5b.md` |
| **Operations Orchestrator Phase 5-C** | ✅ 実装（未コミット） | Command Center UI · フィルタ · L3/L4 · `reports/secretary-orchestrator-phase5c.md` |
| **Google Workspace Phase 6-A** | ✅ 設計完了 | Gmail / Calendar / Contacts / Drive · `reports/secretary-google-workspace-plan.md` |
| **Google Workspace Phase 6-B** | ✅ 実装 | OAuth PKCE · Token Vault · Edge skeleton · `reports/secretary-google-phase6b-oauth-token-vault.md` |
| **Google Workspace Phase 6-D** | ✅ 実装 | Gmail write + Human Gate · `reports/secretary-google-phase6d-gmail-write-human-gate.md` |
| **Google Workspace Phase 6-E** | ✅ 実装 | Calendar read-only · UI タブ · `reports/secretary-google-phase6e-calendar-readonly.md` |
| **Google Workspace Phase 6-F** | ✅ 実装 | Calendar write + Human Gate · `reports/secretary-google-phase6f-calendar-write-human-gate.md` |
| **Google Workspace Phase 6-G** | ✅ 実装 | Contacts read-only · `reports/secretary-google-phase6g-contacts-readonly.md` |
| **Google Workspace Phase 6-H** | ✅ 実装 | Drive read-only · `reports/secretary-google-phase6h-drive-readonly.md` |
| **Google Workspace Phase 7-A** | ✅ 実装 | Workspace Orchestrator · `reports/secretary-google-phase7a-workspace-orchestrator.md` |
| **Google Workspace Phase 7-B** | ✅ 実装 | Activity / Audit Log · `reports/secretary-google-phase7b-workspace-activity.md` |
| **Operations Orchestrator Phase 7-A** | 📋 未着手 | Cursor SDK · cron · L1 自動送信 · Agent 自動実行 |
| **Trend Scout**（トレンド収集 · 経営参謀提案） | 📋 Backlog | [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md) · v1.2 以降想定 · **UI Critical 優先度外** |

---

## Voice Core（OpenAI Realtime · Phase 5 完了）

| 項目 | 状態 | 根拠 |
| --- | --- | --- |
| **Realtime Edge**（GA `client_secrets` · ephemeral token） | ✅ | `0cedb27` · `supabase/functions/_shared/openai-realtime-session.ts` |
| **GA Transport**（WebSocket · beta subprotocol 除去） | ✅ | `6924aa1` |
| **Default model `gpt-realtime-2`** | ✅ | `74e8048` |
| **TASFUL AI Live** opt-in | ✅ | `1c8fe87` · `surface: tasful_ai` · flags default OFF |
| **Builder AI Live** opt-in | ✅ | `2a57283` · `surface: builder_ai` · flags default OFF |
| **AI秘書 Live** opt-in | ✅ | `e43c9c0` · `surface: ops_secretary` · flags default OFF |
| **Kill Switch**（`VOICE_REALTIME_EDGE_ENABLED=1`） | ✅ | `d1f6ced` |
| **Rate Limit Phase 1**（in-memory · 10 req/min/IP） | ✅ | `d1f6ced` |
| **Hardening Phase 2**（JWT · 分散 Rate Limit） | 📋 | `reports/voice-phase5d-complete.md` §次フェーズ |
| **TLV / Platform Voice** | 📋 未対応 | AD-003 / AD-004 |

**共通:** 両方の feature flag が ON のときのみ live。デフォルト mock · live 失敗時 mock fallback。

**報告:** `reports/voice-phase5d-complete.md`

---

## 横断

| 項目 | 状態 |
| --- | --- |
| AI 規約 / 免責（共通） | ✅ `5ed9672` |
| **Site Assistant Phase 1**（右下 **TASFUL サイトAI** · cross-search/FAQ 流用 · Gateway 非接続） | ✅ 実装 — [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) · **未デプロイ** |
| **Site Assistant Phase 2+**（Feedback Launcher · 通報/OPS 集約） | 📋 Backlog — 同上 · **UI Critical 優先度外** |
| Gateway 契約変更 | **意図なし** · working tree に `ai-model-gateway.js` 差分あり → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| working tree 440 件整理 | 📋 [TODO.md](./TODO.md) |
| `docs/` 正本 | 📋 本更新 · **未コミット** |

---

## 将来（v1.1 以降 · 凍結解除後）

- Builder AI Supabase 本番 RLS（P2-C 完了後）
- **Builder AI Gemini Live Phase 4-B** — [builder-ai-gemini-live-field-diagnosis-backlog.md](./builder-ai-gemini-live-field-diagnosis-backlog.md) · Vision ✅ · Calc Orchestrator ✅ · **Live 4-A ✅** `66051f7`
- TASFUL AI 履歴 Supabase 同期
- **TASFUL AI 操作アシスタント**（Gemini · 画面操作案内 · 製品横断ナビ）— [tasful-ai-ui-operation-assist-backlog.md](./tasful-ai-ui-operation-assist-backlog.md)
- Platform お気に入りサーバー正本
- **Platform Coupon System**（店舗・出品者発行 · 横断クーポン基盤）— [platform-coupon-system-backlog.md](./platform-coupon-system-backlog.md)
- **AI Secretary Trend Scout**（トレンド · 市場 · 補助金 · 法改正 · SNS/検索傾向 → TASFUL 提案）— [ai-secretary-trend-scout-backlog.md](./ai-secretary-trend-scout-backlog.md)
- **TASFUL Site Assistant Phase 2+**（Feedback Launcher · 通報 · OPS / AI 秘書集約）— [tasful-site-assistant-backlog.md](./tasful-site-assistant-backlog.md) · Phase 1 ✅
- 動画/音楽 API 本番パイプライン
- PDF/PPT エクスポート（TASFUL AI 資料生成）

**注:** TLV / Builder v1.0 / AI 秘書 v1.1 は FEATURE FROZEN。機能追加はマイナーバージョン計画後のみ。
