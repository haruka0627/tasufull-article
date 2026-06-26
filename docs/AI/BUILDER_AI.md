# Builder AI

**最終更新:** 2026-06-27（Notification Center Phase 6-G · 通知基盤）  
**ステータス:** **実装済み**（… + **Document Center 6-F** + **Notification Center 6-G**）· P2-C 残  
**直近コミット:** `549e562`（Document Center 6-F · **git push 未実施**）

---

## 概要

Builder AI は **建設・リフォーム現場業務 AI**（チャット AI ではなく **現場業務を効率化するプラットフォーム**）。TASFUL AI Workspace とは **統合しない**（[DECISIONS.md](../DECISIONS.md) AD-002）。

| 項目 | 内容 |
| --- | --- |
| **展開方針** | 日本国内完成優先 · 建設業務専用 · 海外対象外 — [DECISIONS.md](../DECISIONS.md) **AD-011** |
| **Builder 製品** | Production Ready v1.0 · RELEASE FROZEN |
| **Builder AI 画面** | `builder/builder-ai.html` + `builder/builder-ai-*.js` |
| **surface** | `builder_ai`（Gateway 経由） |
| **Vision** | **Gemini Vision** — 既存 `gemini-chat` Edge（Gateway `attachments`） |

### 育成方向（3 柱）

| 柱 | 内容 |
| --- | --- |
| **現場 AI** | Vision ✅ · **Live 4-A ✅**（Live 風 MVP）· **真 Gemini Live 📋** |
| **計算 AI** | **Tool Orchestrator ✅** · 面積 · 外壁 · 塗料 · 材料 · 利益 · 税 · 見積（既存 calculators 流用）· 足場/屋根/人工/原価/会計 📋 |
| **業務 AI** | 顧客 · 現場 · 写真 · メモ · 見積 · 請求 · 領収 · 売上 · 経費 · 会計補助（将来） |

**設計原則:** AI が直接計算するのではなく、**必要な Builder 内部ツールを判断して実行**する（既存 `builder-ai-calculators` 等）。

---

## 実装済み

### Core（`5ed9672` 〜）

| 領域 | 内容 |
| --- | --- |
| **Core / Engine** | `builder-ai-core.js`, `builder-ai-engine.js`, `builder-ai-adapter.js` |
| **Actions** | 24 actions（見積 · 工程 · 検索 assist · 計算 · 税務 assist · 実務 assist · 候補推薦 等） |
| **Legacy UI** | `builder-ai-page.js` — 業務下書き · Gateway · `<details>` 内 |
| **Draft** | localStorage + Supabase best-effort |
| **Tools HTML** | `builder/tool-ai-*.html`（4 ページ） |

### 現場 UI + Vision（2026-06-26）

| Phase | commit | 内容 |
| --- | --- | --- |
| **UI Phase 1** | `5d28acc` | 現場診断 UI シェル · 写真 · クイック相談 · Live/Voice stub |
| **Vision Phase 2** | `4aff9ec` | Gemini Vision 接続 · `builder-ai-vision.js` · `runFieldVision` |
| **Tool Integration Phase 3** | `05c32ad` | 自然文 → intent · Orchestrator · precalc · `builder-ai-calc-*.js` |
| **Live Phase 4-A** | `66051f7` | カメラプレビュー · スナップショット Vision · Voice adapter · gate stub |

| モジュール | 役割 |
| --- | --- |
| `builder-ai-ui.js` | 現場チャット UI · Vision / 計算 / **Live ルート** |
| `builder-ai-ui.css` | 現場 UI · **Live パネル** スタイル |
| `builder-ai-vision.js` | 画像 base64 · 4MB · `runFieldDiagnosis` → Analyzer 委譲 |
| `builder-ai-vision-analyzer.js` | **Phase 5** · JSON 正本 · カテゴリ別プロンプト · Gateway 構造化診断 |
| `builder-ai-calc-intent.js` | 自然文 intent / スロット抽出 |
| `builder-ai-calc-orchestrator.js` | ツール選択 · チェーン実行 · 要約 |
| `builder-ai-core.js` | `runFieldVision` · **`precalc`**（数値再計算禁止） |
| `builder-ai-live.js` | カメラプレビュー · スナップショット → Vision |
| `builder-ai-voice.js` | `TasuAiVoiceCore` adapter · `surface: builder_ai` |
| `builder-ai-live-gate.js` | Free/Pro gate stub（本番課金未接続） |
| `builder-project-store.js` | **Phase 6-A〜6-F** · 案件 · 日程 · 収支 · 見積/請求 · 契約/完了 · ドキュメント · Vision |
| `builder-project-calendar.js` | **Phase 6-B** · 月/週カレンダー · 本日/今週/遅延 |
| `builder-project-hub.js` | 案件一覧 · 検索 |
| `builder-project-detail.js` | 案件詳細 · タイムライン閲覧 · メモ最小編集 |

**経路（Vision）:** Builder → Gateway → `gemini-chat` → Gemini Vision

**経路（計算）:** 自然文 → CalcIntent → CalcOrchestrator → `builder-ai-calculators` / `builder-tool-material-calculator` → 要約（AI は数値を再計算しない）

**回答（Vision）:** 見える範囲 · 想定状態 · 補修/交換可能性 · 確認ポイント · 材料候補 · 概算レンジ · 注意事項 + 必須免責

---

## Builder AI Tool Integration Phase 3（✅ 実装済）

| 項目 | 内容 |
| --- | --- |
| **intent** | 自然文から計算 intent / スロット抽出 |
| **Orchestrator** | 既存 deterministic ツール選択 · チェーン実行 |
| **precalc** | Gateway 要約時に数値再計算禁止 |
| **MVP** | 坪→㎡ · 材料数量 · 外壁塗装概算 · 利益率逆算 · 消費税/インボイス |

**報告:** `reports/builder-ai-tools-phase3.md`

---

## Builder AI Live Phase 4-A（✅ 実装済 · `66051f7`）

**現場 Live 風 MVP** — 真 Gemini Live（WebSocket）ではない。既存 REST Vision · ブラウザ Voice Core のみ。

| 項目 | 内容 |
| --- | --- |
| **カメラプレビュー** | `getUserMedia` · Live パネル UI |
| **スナップショット Vision** | canvas キャプチャ → 既存 `runFieldVision` |
| **Voice Core adapter** | `tasful-ai-voice-core.js` · `surface: builder_ai` · STT/TTS |
| **transcript ルーティング** | 音声 → Calc Orchestrator または Vision |
| **会話ログ** | `sessionStorage` · source メタ（text / voice / camera_snapshot） |
| **Free/Pro gate stub** | `builder-ai-live-gate.js` · `?tier=pro` デバッグ |

**非実装（Phase 4-B）:** 真 Gemini Live · WebSocket · ephemeral token Edge

**インフラ:** Gateway 契約変更 **なし** · Secret **なし** · 新規 CF Function **なし** · **未 push · 未デプロイ**

**報告:** `reports/builder-ai-live-phase4-plan.md`

---

## Free / Pro 方針（設計維持）

|  tier | 想定 |
| --- | --- |
| **Free** | Site AI · Builder 基本 AI · 簡易写真診断 · 一部計算 · カレンダー · 簡易収支 |
| **Pro** | Gemini Vision 本格 · Live · Voice · 全計算 · 顧客/現場管理 · AI 履歴 · 見積 · 会計補助 |

Builder AI は **「AI を売る」** のではなく **現場業務効率化プラットフォーム** として設計を維持する。

---

## 非担当

- TASFUL AI Workspace · Site Assistant · AI 秘書 · DeepSeek · Platform · TLV 専用 AI

---

## テスト

| スクリプト | 結果 |
| --- | --- |
| `scripts/test-builder-ai-live-phase4.mjs` | **18/18 PASS** |
| `scripts/test-builder-ai-calc-phase3.mjs` | **15/15 PASS** |
| `scripts/test-builder-ai-vision-phase2.mjs` | **8/8 PASS** |
| `scripts/test-builder-ai-vision-phase5.mjs` | **28/28 PASS** |
| `scripts/test-builder-project-hub-phase6a.mjs` | **PASS** |
| `scripts/test-builder-ai-ui-phase1.mjs` | **15/15 PASS** |
| `scripts/test-builder-ai-p1-review.mjs` | **135/135 PASS** |
| `scripts/test-builder-ai-tools-adaptation.mjs` | **85/85 PASS** |
| `npm run build:pages` | **PASS** |

**報告:** `reports/builder-ai-live-phase4-plan.md` · `reports/builder-ai-vision-phase2.md` · `reports/builder-ai-phase5-vision.md` · `reports/builder-project-hub-phase6a.md` · `reports/builder-ai-tools-phase3.md`

---

## Builder Project Hub Phase 6-A（✅ commit 済 · `46c5e02`）

**案件ハブ MVP** — Builder 経由案件の一覧 · 詳細 · タイムライン · Vision 診断 JSON 保存

| 項目 | 内容 |
| --- | --- |
| **画面** | `project-hub.html` · `project-detail.html` |
| **ストア** | `TasuBuilderProjectStore`（localStorage） |
| **一覧** | ID · 名前 · カテゴリ · 顧客 · 業者 · ステータス · 更新日 |
| **検索** | キーワード · カテゴリ · ステータス |
| **タイムライン** | 作成 · 見積 · AI診断 · 契約 · 施工 · 完了（閲覧のみ） |
| **AI 連携** | `builder-ai.html?projectId=` → Vision 診断 JSON → 案件保存 |

**テスト:** `scripts/test-builder-project-hub-phase6a.mjs`

**報告:** `reports/builder-project-hub-phase6a.md`

---

## Builder Project Calendar Phase 6-B（✅ commit 済 · `556f315`）

**工程・日程管理** — 月/週カレンダー · 本日/今週/遅延 · 詳細から日程変更

| 項目 | 内容 |
| --- | --- |
| **画面** | `project-calendar.html` |
| **日程** | 開始日 · 終了日 · 工程（8段階） |
| **AI 準備** | `previewScheduleIntent` · `prepareScheduleIntent`（未接続） |

**テスト:** `scripts/test-builder-project-calendar-phase6b.mjs`

**報告:** `reports/builder-project-calendar-phase6b.md`

---

## Builder Project Finance Phase 6-C（✅ commit 済 · `e70d679`）

**収支 MVP** — `project.finance` · Hub サマリー · `finance_updated`

**テスト:** `scripts/test-builder-project-finance-phase6c.mjs` · **報告:** `reports/builder-project-finance-phase6c.md`

---

## Builder Estimate/Invoice Phase 6-D（✅ commit 済 · `8be158f`）

**見積・請求基盤** — `project.estimate` / `project.invoice`（SCHEMA v4）

| 項目 | 内容 |
| --- | --- |
| **見積** | 番号 · 状態 · 明細 items · 税10% · 合計 |
| **請求** | 番号 · draft/issued/paid/cancelled · 期限/入金日 |
| **Hub** | 総見積/総請求 · 未請求/未入金件数 · 一覧列 |
| **AI 準備** | `previewEstimateIntent` · `prepareEstimateIntent` 等（未接続） |
| **非実装** | Stripe · PDF · 電子署名 · メール · 他 surface |

**テスト:** `scripts/test-builder-estimate-invoice-phase6d.mjs`

**報告:** `reports/builder-estimate-invoice-phase6d.md`

---

## Builder Contract/Completion Phase 6-E（✅ commit 済 · `ac385c6`）

**契約・完了基盤** — `project.contract` / `project.completion`（SCHEMA v5）

| 項目 | 内容 |
| --- | --- |
| **契約** | 番号 · draft/sent/signed/cancelled · 着工/完了予定 · 保証期間 |
| **完了** | not_started/working/inspection/completed/handed_over · 確認 · 写真（表示のみ） |
| **Hub** | 契約待ち/工事中/完了待ち/完了済み · 一覧列 |
| **AI 準備** | `previewContractIntent` · `prepareContractIntent` 等（未接続） |
| **非実装** | Stripe · PDF · 電子署名 · メール · 通知 · 他 surface |

**テスト:** `scripts/test-builder-contract-completion-phase6e.mjs`

**報告:** `reports/builder-contract-completion-phase6e.md`

---

## Builder Document Center Phase 6-F（✅ commit 済 · `549e562`）

**ドキュメント管理基盤** — `project.documents[]`（SCHEMA v6）

| 項目 | 内容 |
| --- | --- |
| **種別** | photo / drawing / pdf / contract / invoice / estimate / memo / other |
| **状態** | active / archived / deleted |
| **Detail** | 一覧 · 検索 · タグ · 追加/編集/アーカイブ/削除（ダミー管理） |
| **Hub** | 総数/写真/PDF/図面/契約書サマリー · 一覧列 |
| **AI 準備** | `previewDocumentIntent` · `prepareDocumentIntent`（未接続） |
| **非実装** | OCR · PDF生成 · Cloud Storage · 実アップロード · 他 surface |

**テスト:** `scripts/test-builder-document-center-phase6f.mjs`

**報告:** `reports/builder-document-center-phase6f.md`

---

## Builder Notification Center Phase 6-G（✅ 実装 · 未コミット）

**通知基盤 Foundation** — `project.notifications[]`（SCHEMA v7）

| 項目 | 内容 |
| --- | --- |
| **優先度** | low / normal / high / urgent |
| **状態** | unread / read / archived |
| **ソース** | schedule / finance / estimate / invoice / contract / completion / document / vision / manual |
| **Detail** | Notifications パネル（未読数 · 一覧 · 既読/未読/アーカイブ · 手動追加） |
| **Hub** | 総通知/未読/高優先度/期限超過/今日期限サマリー · 一覧列（通知数/未読/高優先度） |
| **生成** | `generateProjectNotifications` — 既存データから候補のみ（自動送信なし） |
| **AI 準備** | `previewNotificationIntent` · `prepareNotificationIntent`（Gateway 未接続） · `applyNotificationIntent` は previewOnly |
| **非実装** | メール · Push · Web Push · LINE/Slack · AI秘書 · cron · Platform/TLV/TASFUL AI 連携 |

**テスト:** `scripts/test-builder-notification-center-phase6g.mjs`

**報告:** `reports/builder-notification-center-phase6g.md`

---

## Builder AI Vision Phase 5（✅ commit 済 · `7ef4efd`）

**構造化 Gemini Vision 診断** — JSON 正本 · 11 カテゴリ · AI参考診断免責統一

| 項目 | 内容 |
| --- | --- |
| **Analyzer** | `TasuBuilderAIVisionAnalyzer` · `analyze` → Gateway `runFieldVision` |
| **JSON** | category · condition · checkItems · possibleCauses · additionalChecks · aiComment |
| **UI** | 解析中 / 診断完了 / エラー / 画像なし · 診断パネル（レイアウト最小変更） |
| **フォールバック** | Gateway 失敗 · JSON 解析失敗 → カテゴリ mock |
| **非実装** | OCR · CAD · 寸法 · 3D · 他 surface 連携 |

**テスト:** `scripts/test-builder-ai-vision-phase5.mjs` — **28/28 PASS** + phase2 回帰 8/8

**報告:** `reports/builder-ai-phase5-vision.md`

---

## 残タスク — P2-C（draft / RLS）

参照: `reports/builder-ai-p2-b.md` §9

1. staging DB に drafts SQL 適用
2. `custom_access_token_hook` — `builder_*` claims
3. draft store Supabase 正本化
4. RLS JWT 検証
5. Live Edge E2E（staging）
6. 本番 dev query role 廃止

---

## 将来 Backlog

| 項目 | 状態 | 参照 |
| --- | --- | --- |
| **Gemini Live Phase 4-B**（WebSocket · ephemeral token · 真 Live） | 📋 未着手 | [builder-ai-gemini-live-field-diagnosis-backlog.md](../builder-ai-gemini-live-field-diagnosis-backlog.md) · `reports/builder-ai-live-phase4-plan.md` §4-B |
| **会計補助**（白/青 · インボイス · 確定申告） | 📋 将来 | 本 doc §育成方向 |

---

## 重要ルール

- すべての出力は **下書き** — 契約/請求/採用/完了承認に使わない
- Gateway 本体契約は安易に変更しない（`attachments` 既存流用）
- Vision / Live アダプタは **Builder AI 内に閉じる**（AD-002）
- AI は補助。**画像だけでは確定判断できない** — 現地確認 · 専門業者優先

**レポート:** `reports/builder-ai-live-phase4-plan.md`, `reports/builder-ai-vision-phase2.md`, `reports/builder-ai-architecture.md`, `reports/builder-ai-p1-review.md`
