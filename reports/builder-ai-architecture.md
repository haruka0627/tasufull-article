# Builder AI — アーキテクチャ設計（設計フェーズ）

実施日: 2026-06-26  
ステータス: **設計・調査のみ**（実装未着手）  
前提: Builder は TASFUL AI を利用しない。Gateway / AI Core / AI秘書 / TASFUL AI の契約は変更しない。

---

## 1. Builder AI の目的

Builder AI は **建設・リフォーム業務に特化した専用 AI** です。TASFUL AI（一般業務相談・マッチング・Platform/TLV/Talk 向け）とは UI・プロンプト・データ境界を分離し、**案件コンテキスト（Project / Thread / Partner / 見積・工程・完了）** を前提に業務支援を行います。

| 項目 | 内容 |
| --- | --- |
| 対象ユーザー | 案件オーナー（Client）、協力会社（Partner）、TASFUL 運営（Admin） |
| 提供価値 | 見積・積算・工程・契約・提案・日報など **Builder 業務フロー内** の文案・整理・チェック |
| 非目的 | 一般消費者相談、Platform 掲載探索、TLV 動画企画、Talk OPS、運営ダッシュボード代行 |

---

## 2. 担当範囲 / 非担当範囲

### 2.1 担当範囲（確定業務）

| # | 業務 | Builder AI の役割（案） |
| --- | --- | --- |
| 1 | 見積作成 | 項目整理・単価根拠文案・PDF/表形式ドラフト |
| 2 | 積算補助 | 数量・ロス率・材料費の説明、不足項目の指摘 |
| 3 | 工程作成 | 工程表ドラフト、クリティカルパス整理 |
| 4 | 契約相談 | 契約条項の平易化、確認ポイント整理（法的判断は免責） |
| 5 | 建築相談 | 工法・仕様の整理（**業者マッチングは TASFUL AI 側**） |
| 6 | リフォーム相談 | 範囲・優先順位・注意点の整理 |
| 7 | 工事内容説明 | 発注者・協力会社向け説明文 |
| 8 | 提案書作成 | 提案書・企画書ドラフト |
| 9 | メール文作成 | 依頼・催促・報告メール文案 |
| 10 | 現場チェックリスト | 入場前/施工中/完了前チェック項目生成 |
| 11 | 工程遅延対応 | 遅延理由整理・関係者向け連絡文案 |
| 12 | 作業日報補助 | 日報・週報ドラフト（thread / siteData 参照） |
| 13 | 案件管理補助 | ステータス・未対応タスクの要約 |
| 14 | FAQ | Builder 操作・業務フローに関する Q&A |

### 2.2 非担当範囲

| 領域 | 理由 |
| --- | --- |
| TASFUL AI Workspace / gen-ai-workspace | 一般業務 AI。Platform・TLV・Talk 向け |
| AI秘書（admin-operations-dashboard） | 運営 OPS・Inbox・Connect  triage 専用 |
| Platform 掲載・業者広域マッチング | `ai-modes.js` 建設相談 + listing 検索の責務 |
| TLV 動画テンプレ | `ai-workspace-tlv-source.js` |
| 自動採用・自動 BAN・返金・通報処理 | 人間または専用管理画面のみ |
| Serper / 一般 Web 検索（原則） | Builder AI は **案件データ優先**。外部検索は例外時のみ設計 |

---

## 3. Builder 現行データ構造の整理

### 3.1 ストレージ概要

| レイヤ | 実装 | 主なキー / テーブル |
| --- | --- | --- |
| **MVP ランタイム（現行）** | `localStorage` JSON | `tasful:builder:mvp:v1`, `tasful:builder:mvp:threads:v1`, `tasful:builder:mvp:notifications:v1` |
| **MVP ロール** | localStorage / sessionStorage | `tasful:builder:mvp:role`, `tasful:builder:mvp:session:role`, `tasful:builder:mvp:partner_id` |
| **Admin 補助** | localStorage | `tasful:builder:admin:partners:v1`, `tasful:builder:admin:calendarAssignments:v1`, `tasful:builder:admin:dispatchCandidates:v1` |
| **Partner 評価** | localStorage | `tasful:builder:partner_evaluations:v1`, `partner_status_events`, `partner_visibility` |
| **Supabase（設計のみ・未実行）** | `sql/builder-schema.sql` | 下表参照 |
| **建設ツール** | エフェメラル（非永続） | フォーム入力 + `builder-tool:calculated` イベント |

**正本（現 MVP）:** `builder/builder.js` の `loadMvpState()` / `saveMvpState()`  
**移行設計:** `builder/builder-supabase-schema-notes.md`, `buildSupabaseReadyPayload()`  
**B3 リポジトリ層:** HTML から `builder-data-provider.js` 等を参照しているが、**現ワークスペースでは未コミット**。MVP は `builder.js` 直アクセスにフォールバック。

### 3.2 エンティティ別データ形状

#### Project（案件）

**MVP:** `state.projects[]`  
**将来:** `builder_projects`

| フィールド | 説明 |
| --- | --- |
| `project_id` | PK |
| `owner_id` | 依頼元（Client） |
| `title`, `kind`, `status` | 案件種別・ライフサイクル |
| `required_partners`, `selected_partner_ids` | 採用人数（正は applications） |
| `visibility`, `contact_policy`, `source` | 公開・連絡・由来 |
| `main_thread_id` | メインスレッド |
| `calendar_assigned_partner_id`, `assignment_status` | カレンダー/Ops |
| `created_at`, `updated_at` | |

**Project Spec（案件詳細）:** `state.specs[project_id]`（MVP 内嵌。SQL では未分割）

| フィールド | 説明 |
| --- | --- |
| `trade_tags`, `area_codes`, `site_address` | 工種・エリア・現場 |
| `period.{start,end}`, `budget.{min,max}`, `budget_note`, `reward` | 工期・予算 |
| `description`, `overview`, `work_content`, `preferred_conditions`, `notes` | 説明 |
| `attachments[]`, `builder_summary`, `schedule_summary` | 添付・要約 |

#### Partner（協力会社）

**MVP:** `state.partners[]` + Admin `tasful:builder:admin:partners:v1`  
**将来:** `builder_partners`

| フィールド | 説明 |
| --- | --- |
| `partner_id`, `display_name`, `partner_type` | 識別・表示 |
| `trades[]`, `areas[]`, `headline`, `profile` | スキル・エリア |
| `contact_policy`, `availability`, `status` | 連絡・稼働 |
| Admin 拡張 | `reviewStatus`, `companyName`, `rating`, `completedProjects` 等 |

#### Client（依頼元）

**専用テーブルなし。** `owner_id` + actor `{ type: "owner" }` で表現。  
MVP デモ: `demo-owner-001`（表示名「TASFUL運営」）。本番は `auth.users` / 将来 `builder_owners` 想定。

#### Estimate（見積）

**永続エンティティなし。**

| 出現形 | 場所 | 内容 |
| --- | --- | --- |
| 応募希望額 | `applications[].desired_amount` | 文字列（例: `"75万円〜85万円"`） |
| 予算レンジ | `specs[].budget` | min/max/note |
| スレッド添付 | `messages[].attachments[]` | PDF 見積ファイル名 |
| ツール出力 | `builder-tool-*` | 計算結果のみ（非保存） |

#### Contract（契約）

**専用エンティティなし。**

| 出現形 | 意味 |
| --- | --- |
| `project.status = "contracted"` | ライフサイクル状態 |
| Partner onboarding `status: "contracted"` | 登録フロー |
| `contractAmount`（profit ツール） | 計算機入力のみ |

採用の正: `builder_project_applications.status = 'selected'`

#### Thread（スレッド）

**MVP:** `state.threads[thread_id]`  
**将来:** `builder_threads` + 子テーブル

| フィールド | 説明 |
| --- | --- |
| `thread_id`, `project_id`, `thread_type`, `status` | 識別・種別 |
| `messages[]` | `{ msg_id, from, ts, text, attachments[] }` |
| `events[]` | タイムライン（applied, check_in, completion 等） |
| `photos[]`, `pdf_outputs[]`, `shared_attachments[]` | 現場・PDF |
| `participants[]`, `siteData` | 参加者・入退場 |
| `completion_submission`, `completion_report` | 完了ワークフロー |
| `invoice_meta` | 請求メタ（draft/finalized） |

#### Completion（完了）

| 構造 | 用途 |
| --- | --- |
| `completion_submission` | 提出中（submitted / approved / rejected） |
| `completion_report` | 承認済み正本 → `builder_completion_reports` |
| `siteData` | 入退場・現場写真 → `builder_site_attendance` |
| `pdf_outputs` (kind: completion_report, invoice) | PDF 生成履歴 |

---

## 4. Builder AI が参照するデータ一覧

### 4.1 Supabase テーブル（設計上・移行後）

| テーブル | 参照目的 |
| --- | --- |
| `builder_projects` | 案件一覧・ステータス・オーナー |
| `builder_partners` | 協力会社プロフィール |
| `builder_project_applications` | 応募・採用状態 |
| `builder_threads` | スレッドメタ |
| `builder_messages` | チャット履歴（要約入力） |
| `builder_thread_events` | タイムライン（遅延・入退場） |
| `builder_thread_photos` | 現場写真メタ |
| `builder_completion_reports` | 完了内容 |
| `builder_site_attendance` | 入退場 |
| `builder_invoice_meta` | 請求ドラフト状況 |
| `builder_pdf_outputs` | 生成済み PDF 種別 |
| `builder_notifications` | 未読・警告の要約 |

**将来追加（設計案）:**

| テーブル | 用途 |
| --- | --- |
| `builder_project_specs` | specs の正規化（現 MVP は `state.specs`） |
| `builder_project_templates` | 案件テンプレ |
| `builder_ai_drafts` | AI 生成ドラフト（見積・提案・日報） |
| `builder_partner_evaluations` | 評価・実績（現 localStorage） |

### 4.2 MVP localStorage（現行）

| キー | 参照内容 |
| --- | --- |
| `tasful:builder:mvp:v1` | projects, partners, specs, threads, applications |
| `tasful:builder:admin:partners:v1` | Admin パートナー審査・連絡先 |
| `tasful:builder:partner_evaluations:v1` | 評価スコア |
| `tasful:builder:admin:calendarAssignments:v1` | カレンダー割当 |
| ツール画面 DOM / イベント | 計算入力・`builder-tool:calculated` payload |

### 4.3 参照しない（境界）

| データ | 理由 |
| --- | --- |
| Platform listings / business-listings | TASFUL AI 建設相談の責務 |
| Talk / Match メッセージ | Builder thread 以外 |
| Admin OPS Inbox 全体 | AI秘書 |
| gen_ai_entitlements | gen-ai-workspace 専用 |
| 他ユーザーの非関連案件 | RLS / project scope で遮断 |

---

## 5. 読取専用 vs 更新可能データ

### 5.1 原則

- Builder AI は **「提案・ドラフト・要約」** を生成し、**確定操作は人間 UI 経由** とする。
- 自動 POST（スレッド送信・採用・完了承認・請求確定）は **Phase 1 では禁止**。

### 5.2 読取専用（Read）

| データ | ロール別 |
| --- | --- |
| 自案件の project + spec | Client / Partner（参加案件）/ Admin |
| 自 thread の messages / events（直近 N 件） | 同上 |
| 自 partner プロフィール | Partner |
| 応募一覧（自案件 or 自応募） | Client / Partner |
| completion_report（承認済み） | 関係者 |
| invoice_meta（finalized 除く詳細は Client/Admin） | ロール依存 |
| partner evaluations（集計） | Admin / Client（採用判断参考） |
| 建設ツール計算結果（セッション） | 全 Builder ロール |

### 5.3 更新可能（Write — すべて **ドラフト / 提案** レイヤ）

| データ | 操作 | 制約 |
| --- | --- | --- |
| `builder_ai_drafts`（新規） | INSERT/UPDATE ドラフト | ユーザー明示保存まで thread 非反映 |
| `specs.builder_summary` / `schedule_summary` | 提案 PATCH | 確認ダイアログ必須 |
| `applications[].memo` / 文案 | ドラフトのみ | `desired_amount`・`status` は人間 |
| `pdf_outputs`（draft kind） | 生成候補 | `finalized` PDF は上書き不可 |
| チェックリスト JSON | 保存 | 新規サブリソース |
| 日報テキスト | ドラフト | thread 自動投稿なし |

### 5.4 更新禁止（Never — AI から直接触らない）

| データ | 理由 |
| --- | --- |
| `applications.status`（selected/rejected） | 採用判断 |
| `project.status` 遷移（contracted/completed 等） | ワークフロー正本 |
| `completion_submission` approve/reject | 法的・業務確定 |
| `invoice_meta.status = finalized` | 請求確定 |
| Admin `reviewStatus` | 運営審査 |
| Partner `availability` / ban | 運営・本人操作 |
| 他社案件・他社 thread | プライバシー |

---

## 6. 権限設計（Admin / Partner / Client）

**ロール対応（Builder MVP）:**

| 設計ロール | Builder 内部 | 説明 |
| --- | --- | --- |
| **Client** | `owner` | 案件依頼元・発注者 |
| **Partner** | `partner` | 協力会社 |
| **Admin** | `admin` actor + `builder-admin-*` 画面 | TASFUL 運営 |

※ MVP には `user`（利用者）ロールもあるが、Builder AI 設計では Client / Partner / Admin を正とする。

### 6.1 Client（owner）

| できること | できないこと |
| --- | --- |
| 自案件の AI チャット・要約 | 他社案件参照 |
| 見積・提案書・メール **ドラフト** 生成 | 応募の自動採用 |
| 工程表・チェックリスト案 | Partner プロフィール編集 |
| 応募者比較の整理（applications 参照） | 完了報告の自動承認 |
| 契約相談の論点整理（免責付き） | Admin カレンダー操作 |
| FAQ（Builder 操作） | OPS / 通報処理 |

### 6.2 Partner

| できること | できないこと |
| --- | --- |
| 参加案件・割当案件の AI 支援 | 未応募案件の詳細（visibility 外） |
| 見積・積算・日報ドラフト | 他 Partner の応募内容 |
| 工程遅延連絡文案 | 採用ステータス変更 |
| 現場チェックリスト | 請求 finalize |
| 自プロフィールを **参照** した提案文 | Client の連絡先（policy 外） |
| 完了報告文案（提出前ドラフト） | Admin 審査操作 |

### 6.3 Admin

| できること | できないこと |
| --- | --- |
| 全案件の要約・滞留検知文案 | AI 単独での採用/却下確定 |
| カレンダー割当 **案** | 返金・BAN 実行（秘書と同様画面誘導） |
| Partner 審査メモ草案 | 本番 secret 変更 |
| 複数案件横断レポート | Platform listing 編集 |
| Dispatch 候補整理 | TASFUL AI / 秘書機能の代替 |

**実装時の enforcement:** Supabase RLS（`sql/builder-schema.sql` コメント参照）+ Builder AI API で `project_id` / `actor_type` スコープ検証。

---

## 7. UI 案（画面設計）

Builder AI は **独立ハブ** とし、`ai-workspace.html` へリンクしない。

### 7.1 情報アーキテクチャ（案）

```
builder/
  builder-ai.html              … メインハブ（チャット + コンテキストバー）
  builder-ai-estimate.html     … 見積テンプレート AI
  builder-ai-schedule.html   … 工程テンプレート AI
  builder-ai-proposal.html   … 提案書テンプレート AI
  builder-ai-contract.html     … 契約相談
  builder-ai-faq.html          … FAQ
  construction-tools.html      … 既存ツール（サイド AI コメント → LLM 接続）
```

### 7.2 画面要素（共通）

| 領域 | 内容 |
| --- | --- |
| **コンテキストバー** | 案件選択、Partner/Client ロール、thread リンク |
| **チャット** | 履歴、送信、コピー、ドラフト保存 |
| **テンプレートチップ** | 業務別 starter（見積/工程/日報…） |
| **出力パネル** | Markdown / 表 / PDF プレビュー（保存は明示ボタン） |
| **免責** | 契約・安全・法令は専門家確認 |

### 7.3 既存画面との統合

| 既存 | 統合案 |
| --- | --- |
| `construction-tools.html` + `data-builder-ai-comment` | `BuilderAIEngine.analyze()` の先を `TasuBuilderAICore`（LLM）へ。計算結果を context 注入 |
| `mvp-thread.html` | 「AI に要約」「返信案」ボタン → 別パネル or モーダル（thread context 付き） |
| `mvp-project-detail.html` | 案件サマリ AI・遅延対応 |
| `mvp-templates.html` | テンプレ → AI 編集フロー |

---

## 8. Gateway 利用方針

### 8.1 結論: **既存 Gateway を利用可能。新 Gateway は不要。**

| 項目 | 方針 |
| --- | --- |
| 利用 API | `TasuAiModelGateway.completeTurn()` / `callModel()` |
| Edge | 既存 `gemini-chat`, `openai-chat`, `claude-chat` |
| 新規 Edge | **作らない** |
| 検索 | 原則 `skipSearch: true`（案件データ優先） |
| surface | `surface: "builder_ai"`（ログ識別のみ。Gateway 本体は surface を必須処理しない） |
| モデル選択 | Builder 専用 UI（TASFUL AI の `ai-plan-models` workspace 例外は使わない） |

### 8.2 推奨アダプタ層（実装フェーズ）

```
builder-ai-core.js       … TasuBuilderAICore.query() — Gateway ラッパー
builder-ai-adapter.js    … project/thread context 組み立て
builder-ai-tool-router.js … 業務 intent → プロンプト / ツール
builder-ai-tools.js      … 読取 API（MVP store / 将来 repository）
```

**重要:** これらは **Builder 名前空間** に閉じ、`ai-workspace-chat.js` / `admin-ai-secretary-phase2.js` は変更しない。

### 8.3 現状

| コンポーネント | 状態 |
| --- | --- |
| `builder/builder-ai-engine.js` | ルールベース診断のみ（`analyze()` 稼働） |
| `builder-ai-core.js` 等 | HTML 参照あり、**ファイル未実装** |
| `BuilderAIEngine.query()` | Core 未読込時は失敗メッセージを返す |
| Builder → `TasuAiModelGateway` | **参照ゼロ** |

Gateway `completeTurn` は `surface` をログに渡すのみで、Builder から既存 Edge を呼んでも **TASFUL AI / 秘書の挙動は変わらない**。

---

## 9. AI秘書との役割分担

| 観点 | AI秘書 | Builder AI |
| --- | --- | --- |
| 利用者 | TASFUL 運営 | Client / Partner / Admin（Builder 内） |
| 画面 | `admin-operations-dashboard.html` | `builder/*` |
| データ | Inbox, Connect, OPS WATCH, **Builder 案件の監視** | Builder MVP / Supabase 案件データ |
| Gateway surface | `ops_secretary` | `builder_ai`（案） |
| 実行 | 操作は提案のみ。返金/BAN 不可 | ドラフトのみ。採用/完了確定不可 |
| Builder 言及 | phase2 プロンプトで triage | 案件単位の業務支援 |

**重複（統合しない）:**

| 機能 | 秘書 | Builder AI |
| --- | --- | --- |
| Builder 案件の「存在」把握 | ✅ 横断監視 | ✅ 単案件深掘り |
| 次アクション提案 | ✅ 管理画面 URL 誘導 | ✅ 見積・工程・文案 |
| チャット UI | ✅ 運営用 | ✅ 業務用 |

---

## 10. TASFUL AI との役割分担

| 観点 | TASFUL AI | Builder AI |
| --- | --- | --- |
| 利用者 | Platform / TLV / Talk / 一般 Workspace | Builder ユーザーのみ |
| 入口 | `ai-workspace.html`, `gen-ai-workspace.html` | `builder/builder-ai*.html`（案） |
| マッチング | listing / FAQ / Serper | **案件内** Partner / Application |
| モード | `ai-modes.js`（建設相談・提案資料等） | Builder 業務テンプレ |
| データ | Platform 横断 | Project / Thread スコープ |

**重複機能一覧（統合しない）:**

| 機能 | TASFUL AI | Builder AI |
| --- | --- | --- |
| 見積の目安・相場整理 | `tasful-guide` / 建設相談 | 案件 spec + 行項目見積 |
| 提案書・契約書文案 | `proposal-contract` モード | 案件 thread 文脈付き提案 |
| 建築・リフォーム相談 | 建設相談 + **業者候補検索** | 工法整理 + **既存 Partner/応募** |
| 工程・人工 | 自由チャット | 構造化工程表 + ツール連携 |
| メール文 | 一般ビジネス | 案件・完了・請求文脈 |
| FAQ | `ai-faq-knowledge.js`（Platform） | Builder 操作・フロー |
| PDF / 添付 | Workspace attachments | Thread pdf_outputs / 見積 PDF |
| Voice | `ai-workspace-voice.js` | 将来拡張（Phase 2+） |

**ユーザー向けメッセージ:** Platform / TLV / Talk から Builder AI へは誘導しない。Builder 内のみ。

---

## 11. 将来拡張案

| Phase | 内容 |
| --- | --- |
| **P0 設計レビュー** | 本ドキュメント承認 |
| **P1 Core** | `builder-ai-core.js` + Gateway 接続、`surface: builder_ai`、skipSearch |
| **P2 Context** | project/thread スコープ、ドラフト storage `builder_ai_drafts` |
| **P3 Tools** | 既存 `builder-tool-*` ↔ LLM 診断の統合 |
| **P4 RLS** | Supabase 本番 + actor 境界 |
| **P5 Billing** | Builder プラン / 利用回数（TASFUL AI 課金とは別 SKU 想定） |
| **P6 Voice** | 現場向け音声入力（Voice Core 共有は可、UI は Builder 専用） |

---

## 12. 現行 Builder AI 実装状態（調査メモ）

| ファイル | 状態 |
| --- | --- |
| `builder/builder-ai-engine.js` | ✅ ルールベース `analyze()` / イベント `builder-tool:calculated` |
| `builder/builder-tool-ai-*.js` | ✅ 計算 + `diagnose()` ヒューリスティック |
| `builder-ai-core.js` 等 | ❌ 未実装（HTML のみ参照） |
| Gateway 連携 | ❌ 未接続 |

---

## 13. 設計レビュー時の確認チェックリスト

- [ ] Client / Partner / Admin 境界で参照データが足りるか
- [ ] Write 禁止一覧（採用・完了・請求確定）に異論がないか
- [ ] TASFUL AI 建設相談とのユーザー向け説明（「業者探しは TASFUL AI、案件実行は Builder AI」）
- [ ] Gateway 共用で Builder 専用 systemPrompt / context 注入方式
- [ ] Supabase 移行後の `specs` 正規化タイミング
- [ ] 契約・安全に関する免責表示

---

## 参照ファイル

| パス | 内容 |
| --- | --- |
| `builder/builder.js` | MVP 状態・ロール・thread/completion |
| `sql/builder-schema.sql` | Supabase DDL 設計 |
| `builder/builder-supabase-schema-notes.md` | 移行メモ |
| `builder/builder-ai-engine.js` | 現行 AI 土台 |
| `builder/builder-tool-ai-*.js` | 業務ツール |
| `ai-model-gateway.js` | 共通 Gateway |
| `ai-modes.js` | TASFUL AI モード（重複参照） |
| `admin-ai-secretary-phase2.js` | AI秘書 |

---

**次ステップ:** 本設計のレビュー承認後、P1（`builder-ai-core.js` + Gateway ラッパー）から実装開始。
