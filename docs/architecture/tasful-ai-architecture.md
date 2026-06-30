# TASFUL AI Architecture Report

**最終更新:** 2026-06-26（AI Phase）
**ステータス:** DRAFT (SSOT for Future Implementation)

本ドキュメントは、TASFUL全体におけるAI機能の統合入口である「TASFUL AI」および、その内部生成エンジンである「Builder Engine」の長期的なアーキテクチャ設計を定義する Single Source of Truth (SSOT) です。

---

## 1. Architecture Principles

TASFULにおけるAI開発の基本方針として、以下の原則を厳守します。

1. **TASFUL AI は TASFUL 全体の共通AI入口である**
   Platform、Business Directory、TASFUL Materials、TLV、Talk、Secretary などの各プロダクトは、原則として TASFUL AI 経由でAI機能を利用する。
2. **各プロダクトごとに専用AIを乱立させない**
   プロダクトごとに独自のLLMループや専用Gateway Surfaceを新設することは禁止する。
3. **Builder Engine は TASFUL AI 内部の生成エンジンとして扱う**
   「Builder AI」という名称はユーザー向けの導線としては使用せず、内部エンジン「Builder Engine」として扱う。
4. **Platform 等から Builder Engine を直接呼ばない**
   生成機能を利用する場合は、必ず TASFUL AI（または AI Orchestrator）を介してリクエストを行う。
5. **AI生成結果は、各プロダクトの正本DBやCMSを経由して保存・公開する**
   AIが直接コンテンツを公開したり、DBを直接更新する設計は禁止する。必ずユーザーまたは管理者の承認・審査フロー（下書き保存）を経由する。
6. **Agent/Tool Calling 等の将来拡張を見据える**
   将来の Gemini Agent API、Interactions API、MCP (Model Context Protocol) 対応を見据えた疎結合な構成とする。

---

## 2. TASFUL AI の責務

TASFUL AI は、以下の責務を集約して担当します。

*   **AI検索:** 横断的な情報検索、サイト内検索の高度化
*   **ページ生成 / 編集:** Builder Engine を用いたWebページ・コンテンツの生成と編集支援
*   **コード生成:** HTML/CSS/JS等の生成
*   **画像 / 文章生成:** プロンプトからの画像生成（動画・音楽含む）、テキスト作成・要約
*   **SEO改善:** SEOメタデータ、キーワードの提案
*   **Business管理支援:** Business Directory 向けの下書き生成、レビュー支援
*   **Platform操作支援:** クーポン設定、商品情報の最適化提案
*   **Materials生成支援:** TASFUL Materials 向けのPDF/PPT等資料生成サポート
*   **TLV / Talk / Secretary支援:** 各プロダクトへの専門的なコンテキスト提供とアシスト
*   **将来Agent操作 / Tool Calling:** 各種プロダクトAPI（保存、検索、下書き作成等）を叩くエージェント機能
*   **Provider選択 / ルーティング:** リクエストに応じた最適なAIモデル（OpenAI, Gemini, DeepSeek等）の動的選択
*   **利用回数 / 課金 / Usage管理:** ユーザーのプラン（Free/Lite/Pro/Max）に応じたトークン、画像生成回数などの利用制限と課金管理

---

## 3. レイヤー構成

TASFULのAIアーキテクチャは、プロダクト層からProvider層まで明確にレイヤーを分離します。

```mermaid
flowchart TD
    User([User])

    subgraph Product Layer [1. Product UI Layer]
        Platform[Platform]
        BD[Business Directory]
        Materials[TASFUL Materials]
        TLV[TLV]
        Talk[Talk]
        Sec[Secretary]
    end

    subgraph TASFUL AI Layer [2. TASFUL AI Workspace]
        Workspace[TASFUL AI Chat / Interface]
    end

    subgraph Orchestration Layer [3. AI Orchestrator / Gateway]
        Gateway[AI Gateway / Orchestrator]
        Usage[Usage / Billing / Token Mgmt]
        Routing[Model Routing & Fallback]
        Agent[Agent / Tool Calling Manager]
    end

    subgraph Engine Layer [4. Engine Layer]
        Builder[Builder Engine<br/>(Page/Code/Edit)]
        ImageGen[Image/Media Generator]
    end

    subgraph Provider Layer [5. Provider Layer]
        ProviderAbst[Provider Abstraction]
        OpenAI[OpenAI]
        Gemini[Gemini]
        Claude[Claude]
        DeepSeek[DeepSeek]
        Other[Grok / OpenRouter]
    end

    subgraph DB CMS Layer [6. DB & CMS Layer]
        DB[(Product DB / CMS<br/>blocks_json / draft)]
    end

    %% Flow
    User --> Product Layer
    Platform & BD & Materials & TLV & Talk & Sec -->|Request / Source Context| Workspace
    Workspace --> Gateway
    Gateway --> Usage
    Gateway --> Routing
    Routing --> Engine Layer
    Routing --> ProviderAbst
    Engine Layer --> ProviderAbst
    ProviderAbst --> OpenAI & Gemini & Claude & DeepSeek & Other

    Gateway --> Agent
    Agent -->|Tool API (Draft Only)| DB
```

---

## 4. Product Integration

各プロダクトは TASFUL AI を通じてAI機能を利用します。役割分担と接続方針は以下の通りです。

| プロダクト | TASFUL AI が担当すること | プロダクト側が担当すること | 保存先 / 公開経路 | 禁止事項 |
| :--- | :--- | :--- | :--- | :--- |
| **Platform** | 商品説明の最適化、クーポンの提案、横断検索のAI解釈 | AIへの導線表示（`source=platform`）、確定したコンテンツの表示 | Platform正本DB（下書きとして保存し、ユーザーが確定） | Platform専用AIエンジンの新設、直接公開 |
| **Business Directory** | 店舗情報の下書き生成、SEO提案、ページ生成（Builder Engine経由） | ビジネスデータの正本管理、公開ステータスの管理、CMSとしての審査フロー | `blocks_json`, `page_content` のDraft状態として保存 | AIによる直接 `published` への更新 |
| **TASFUL Materials** | PDF/PPT等の資料生成、要約支援 | 資料データの保存、権限管理、ダウンロードUI | Materials正本DB | - |
| **TLV** | 専門知識の提供、シミュレーション支援 | `source=tlv` での TASFUL AI Workspace への遷移、UI表示 | 保存が必要な場合はTLV管理DB | TLV専用LLMループの構築 |
| **Talk** | チャット要約、返信文の提案 | トーク履歴の保持、メッセージ送信機能 | Talk正本DB | 自動送信（ユーザーの確認必須） |
| **Secretary** | (※内部用として) 運営データの要約、優先順位付け | DB取得、画面表示、フィルタリング等のプログラム処理 | Secretary管理DB | AIによる直接的な管理者アクション（BAN等） |
| **Builder Engine** | コード生成、ページ構造(blocks_json)の生成 | - (内部エンジンであるためUIを持たない) | Business Directory等を経由して保存 | ユーザーへの直接のUI露出 |

*   **現状との差分:** 一部（旧Builder AIなど）が独立したUIやSurfaceを持っている状態ですが、将来的にこれらはTASFUL AIの内部エンジンとして隠蔽・統合されます。
*   **移行方針:** 既存の専用AIエントリは段階的に TASFUL AI Workspace（`source=xxx`パラメータ）へのリダイレクトに切り替え、専用バックエンドは Orchestrator 配下のモジュールへリファクタリングします。

---

## 5. Builder Engine

これまでの「Builder AI」は、アーキテクチャ上以下の通り再定義されます。

*   **名称の変更:** ユーザー向け導線としての「Builder AI」という名称は廃止し、「Builder Engine」とする。
*   **位置づけ:** Builder Engine は TASFUL AI 内部の「ページ生成 / コード生成」に特化した専門エンジンである。
*   **直接呼び出し禁止:** Platform や Business Directory から直接 Builder Engine を呼び出すことはしない。必ず TASFUL AI を経由する。
*   **UIの隠蔽:** Builder UI / Builder surface をユーザーに直接見せない。ユーザーは TASFUL AI のチャットインターフェース等を通じて生成を依頼する。

---

## 6. Provider Architecture

将来的なマルチモデル化・コスト最適化に向け、AI Provider の切り替え設計を抽象化します。

*   **Provider抽象化:** アプリケーションロジックは特定のProvider（OpenAI等）に依存せず、Gatewayの抽象化インターフェースを介してリクエストを行う。
*   **モデル選択とルーティング:** タスクの性質（テキスト生成、複雑なコード生成、画像生成）に応じて、動的に最適なモデルへルーティングする。
    *   *例:* 一般応答=OpenAI, 管理者要約=DeepSeek, 将来の現場診断=Gemini
*   **フォールバック:** 主力モデルがダウンした際やレートリミットに達した際、代替モデル（Claude, Grok 等）へ自動的に切り替える仕組み。
*   **コスト管理とレート制限:** トークン使用量を監視し、超過リクエストをブロックまたはキューイングする。
*   **ログと失敗時の扱い:** Providerエラーは全てGatewayで捕捉し、ユーザーには統一されたエラーメッセージを返し、内部ログに詳細を記録する。

---

## 7. Tool Calling / Agent Architecture

TASFUL AI が自律的にシステムと連動するための将来アーキテクチャです。

*   **対象技術:** Gemini Agent API, OpenAI Interactions API, MCP (Model Context Protocol), Browser / Computer Use
*   **提供ツール (Tools):**
    *   `blocks_json` 編集ツール
    *   `page_content` 編集ツール
    *   検索ツール (Product DB検索)
    *   下書き作成ツール
    *   Publish Request ツール
*   **重要原則 (直接公開の禁止):**
    AI（Agent）がToolを通じてデータを操作する場合、**絶対に**各プロダクトの保存・審査・公開フローを通さなければならない。AIのアクションは常に「下書きの作成・更新」や「公開リクエストの起票」に留め、最終的な DBの `published` ステータス変更は人間（ユーザーまたは管理者）が行う。

---

## 8. Data / Usage / Billing

TASFUL AI の利用履歴・課金・回数制限は、一元的に管理されます。

*   **管理項目:**
    *   `conversation` / `message`: チャット履歴
    *   `ai_session`: セッションごとのコンテキスト
    *   `usage_log`: 詳細な利用履歴
*   **メトリクス:**
    *   Provider Usage & Token Usage (入力/出力)
    *   Image/Media Generation Usage
    *   Tool Call Usage
*   **プランと制限 (Billing):**
    *   Free / Lite / Pro / Max などのプランに応じた Daily Limit / Monthly Quota を設定。
    *   Overage (超過) 時の挙動（ブロックまたは従量課金）の制御。
    *   Abuse Prevention (不正利用防止、スパム制御) のための Rate Limit。

---

## 9. Security / Safety

TASFUL AI はプラットフォームの安全性を担保するため、以下のセキュリティ要件を満たします。

*   **Prompt Injection対策:** ユーザー入力をサニタイズし、システムプロンプトのオーバーライドを防ぐ。
*   **Tool Permission & User Scope:** Tool Calling は実行ユーザーの権限（JWT claims）コンテキスト内で実行される。
*   **RLS (Row Level Security):** Supabase の RLS を厳格に適用し、他者のデータを読み書きできないようにする。
*   **直接DB更新・公開禁止:** 前述の通り、AIからの直接更新・直接公開はシステム的にブロックする。
*   **XSS対策 & blocks_json validation:** AIが生成した HTML/CSS や `blocks_json` は、保存前および描画前に厳格なバリデーションとサニタイズを行う。
*   **監査ログ & モデレーション:** AIの生成内容やTool実行履歴は監査ログとして保存。不適切コンテンツ生成のフィルタリング（Provider側機能も併用）。
*   **APIキー秘匿:** Provider の APIキー は全て Edge Function / Gateway 層で環境変数として管理し、フロントエンドには一切露出させない。

---

## 10. Roadmap

TASFUL AI アーキテクチャの実現に向けた段階的な実装フェーズです。

*   **Phase A:** TASFUL AI 現状整理（本番接続・Quota実装）
*   **Phase B:** AI Gateway / Orchestrator の整理（内部構造のリファクタリング）
*   **Phase C:** Provider 抽象化層の実装（フォールバック・動的ルーティング）
*   **Phase D:** Product Integration 整理（各プロダクトの専用AIを廃止し、TASFUL AI へ導線統合）
*   **Phase E:** Usage / Billing 基盤の完全統合（プラン別制御の厳密化）
*   **Phase F:** Tool Calling 対応（下書き生成API等の提供）
*   **Phase G:** Agent API 対応（高度な自律プロンプト処理）
*   **Phase H:** MCP (Model Context Protocol) 対応

---

## 11. Future AGENTS.md / TODO.md 反映案 (メモ)

本ドキュメントの合意後、将来的に各運用ファイルへ以下を反映することを推奨します。

### 将来 AGENTS.md へ反映すべきルール
*   「新しいAI機能を追加する際は、TASFUL AIの機能を拡張すること。プロダクト専用のAI UI/Gatewayを新設してはならない。」
*   「Builder Engine は内部機能であり、ユーザーに見えるUIを作ってはならない。」
*   「AIは必ずDraft/下書き状態を生成すること。AIから直接DBの本番テーブルを更新・公開してはならない。」

### 将来 TODO.md へ反映すべき実装フェーズ
*   [ ] 既存 Builder AI の UI を TASFUL AI Workspace 内の機能として吸収・統合する
*   [ ] Platform / TLV などの既存専用AIエントリを、完全に `ai-workspace?source=xxx` へリダイレクトするよう修正
*   [ ] AI Gateway の Provider 抽象化（OpenAI / DeepSeek 等のルーティングロジックの分離）
*   [ ] Agent/Tool API (MCP等) の PoC 作成と安全な DB 連携の検証
