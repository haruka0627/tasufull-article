# AI 実行ゲート — 包括設計（Phase A 正本）

**Status:** Phase A **FREEZE**（変更不可の正本）  
**人間レビュー承認:** **FREEZE APPROVED** · **2026-07-28**  
**最終更新:** 2026-07-28（FREEZE 確定）  
**関連:** [SECRETARY_AI.md](./SECRETARY_AI.md) · [TASFUL_AI_SAFE_OPS_FOUNDATION.md](./TASFUL_AI_SAFE_OPS_FOUNDATION.md) · [DECISIONS.md](../DECISIONS.md) AD-001〜006 · AD-010 · [Phase B 計画](./AI_EXECUTION_GATE_PHASE_B_PLAN.md) · [Phase B チケット](./AI_EXECUTION_GATE_PHASE_B_TICKETS.md)

> **変更規則:** 本ドキュメントは Phase A 設計の **凍結正本** である。本文の破壊的改訂は禁止。必要な変更は **versioned amendment**（追記セクション / 版番号付き差分）または **後続 Phase 設計文書** で行う。実装詳細は Phase B 以降の計画・チケットが担う。

---

## 0. Verdict

TASFUL の AI 運営は **共通制御プレーン（AI Execution Gate）** を正とし、製品固有の LLM / ドメインエンジンは **Executor Port** に隔離する。

**最終運営モデル**

```
AI: 収集・監視・分析・分類・優先付け・要約・提案・下書き・実行準備・LOW 安全処理
  → 運営ダッシュボード / 承認キューへ表示
  → 人間: 承認 / 却下 / 修正 / 後回し / 実行
```

**音声は本設計の対象外。** 音声入力・通知・読み上げ・音声 UI・音声専用ポート / API / Phase は追加しない。将来必要なら一般ダッシュボード API を別クライアントから参照する。

**Phase A 範囲:** 論理設計・契約・状態モデルの正本化。実装は後続 Phase。

### 0.1 FREEZE 時に確定した実装方針（Phase B 向け）

| # | 判断 | 確定内容 |
| --- | --- | --- |
| 1 | **Budget** | SAFE-06/07 本格予算連携は **Phase C**。Phase B は **コード定数 hard cap**（環境変数または Staging 専用設定）。超過時は **`blocked`**。自動超過・暗黙フォールバック禁止。cap / 管理値をフロントへ露出しない |
| 2 | **Capability** | Phase B は **コード定数を正**。DB シード・管理画面・動的編集なし。allowlist 固定: `collect_daily_ops` · `generate_ops_report` のみ。将来 DB マスタ化に耐える契約は維持 |
| 3 | **Pipeline** | Phase B は **単一 `ai_execution_request` pipeline**。取得→レポート→結果保存を 1 execution で追跡。内部 step は events / result metadata。子 execution 分割なし。将来の独立再実行・個別承認時のみ親子拡張 |

---

## 1. 設計原則

| 原則 | 内容 |
| --- | --- |
| 制御プレーン分離 | Gate は安全制御・承認・監査・費用・実行契約のみ。モデル/業務ロジックは内包しない |
| 三軸分離 | **Risk Level** ≠ **Business Priority** ≠ **Execution Mode** |
| Capability 上位 | **Capability** → Executor Port → Provider/Model/Domain Engine |
| Flag ≠ Stop | **Feature Flag**（段階公開）と **Emergency Stop**（緊急遮断）を分離 |
| エンジン非統合 | AD-002/003/004/010 を維持。既存製品エンジンを統合・削除しない |
| コスト正本 | SAFE-06 `ai_usage_events` · SAFE-07 cost ledger を利用実績・原価の正本とする（二重台帳禁止） |
| 監査最小化 | prompt / response 全文を監査へ保存しない。PII・secret redaction |
| HIGH 非一括 | HIGH は個別設計・個別承認。一括解禁しない |
| 段階実装 | 包括設計は先取り、実装は Phase B 以降の縦スライス |

### 論理フロー

```
Caller
  → Gate.create (capability + action + payload_hash + idempotency)
  → Policy Engine（§5 評価順）
  → Proposal / Approval / Confirmation（必要時）
  → Executor Port
  → Result
  → Audit / Cost link / Internal Notification
```

---

## 2. 三軸: Risk / Business Priority / Execution Mode

### 2.1 Risk Level（行為の危険度）

| Level | 例 | 原則 |
| --- | --- | --- |
| **LOW** | 内部取得・集計・要約・分析・分類・レポート・下書き・RO 検索・非公開プレビュー | 自動実行可（予算・権限・停止・冪等は必須） |
| **MEDIUM** | 内部設定・公開前変更・通知案・予約候補・タスク作成・限定書込・公開準備 | Proposal 後に承認必須 |
| **HIGH** | 外部送信・公開・決済・返金・契約・削除・権限・PII 開示・Prod 変更・Migration・Cron 有効化・外部アカウント・ANPI 緊急・本番コード適用 | 自動実行禁止。提案/準備は可。一部は承認後も **permanent deny** 可 |

### 2.2 Business Priority（運営上の重要度）

`CRITICAL` · `HIGH` · `NORMAL` · `LOW`

判定材料: 売上・利用者影響・セキュリティ・障害・法務・支払/対応期限・未対応時間・SLA・依存・手動必要性。

**並べ替えに使う。自動実行可否は Risk と Execution Mode が決める。**

### 2.3 Execution Mode

| Mode | 意味 |
| --- | --- |
| `AUTO` | ポリシー上安全な場合のみ自動実行 |
| `REPORT_ONLY` | 収集・表示のみ |
| `PROPOSAL_ONLY` | 実行せず提案のみ |
| `APPROVAL_REQUIRED` | 人間承認後に実行可 |
| `CONFIRMATION_REQUIRED` | 承認後、実行直前に再確認 |
| `MANUAL_ONLY` | AI は準備のみ。人間が別画面で実行 |
| `DENIED` | AI 経路では禁止 |

初期マッピング: LOW → AUTO / REPORT_ONLY · MEDIUM → APPROVAL_REQUIRED（± CONFIRMATION）· HIGH → DENIED / PROPOSAL_ONLY / MANUAL_ONLY / CONFIRMATION_REQUIRED（個別）

---

## 3. Capability 契約（上位能力）

### 3.1 責務分離

| 概念 | 責務 | 例 |
| --- | --- | --- |
| **capability_key** | AI が持つ一般的な能力（製品非依存の上位契約） | `draft_support_reply` · `generate_ops_report` |
| **action_type** | 対象サービスで実行する具体的操作 | `support.gmail.prepare_reply` · `ops_secretary.daily_pending.fetch` |
| **executor_port** | 実際の実行アダプタ | `secretary_deepseek` · `workspace_gateway` |
| **provider / model** | 推論エンジン | DeepSeek · OpenAI 等 |

関係:

```
Capability → Executor Port → Provider / Model / Domain Engine
```

目的: Executor/モデル変更でも上位契約を維持 · 同一 Capability を複数 Executor で実行可 · 重複実装回避 · Policy/Budget/Risk/Approval を Capability 単位でも制御。

### 3.2 `ai_capability_definitions`（論理）

| Field | 役割 |
| --- | --- |
| `capability_key` | 安定キー（例: `collect_daily_ops`） |
| `capability_version` | 版 |
| `display_name` / `description` | 人間可読 |
| `default_risk_level` | 既定 Risk |
| `default_execution_mode` | 既定 Mode |
| `allowed_services` | 利用可能な `target_service` |
| `allowed_executor_ports` | 許可ポート |
| `required_permissions` | 必要ロール/権限 |
| `input_schema_version` / `output_schema_version` | I/O 契約版 |
| `is_enabled` | 定義上の有効（Flag とは別層のマスタ） |
| `staging_only` | Staging 限定 Capability |
| `created_at` / `updated_at` | メタ |

**カタログ例（論理予約）** · Phase B 実装はコード定数 allowlist のみ（`collect_daily_ops` · `generate_ops_report`）。DB シードは行わない。

| capability_key | 既定 Risk | 備考 |
| --- | --- | --- |
| `collect_daily_ops` | LOW | Phase B 使用 |
| `generate_ops_report` | LOW | Phase B 使用 |
| `collect_sales` | LOW | 将来 |
| `collect_system_health` | LOW | 将来 |
| `classify_support` / `summarize_support` | LOW–MEDIUM | 将来 |
| `draft_support_reply` | MEDIUM | 将来 · 送信ではない |
| `validate_support_reply` | LOW–MEDIUM | 将来 |
| `send_support_reply` | HIGH | 自動禁止 · Phase B 外 |
| `analyze_metrics` | LOW | 将来 |
| `detect_fraud_signal` | LOW–MEDIUM | 制裁実行は別 HIGH |
| `generate_page` / `generate_seo_content` | LOW–MEDIUM | 公開は別 action |
| `review_builder_case` / `review_code_change` | LOW–MEDIUM | 適用は HIGH 個別 |

### 3.3 `ai_execution_requests` への必須追加

- `capability_key`
- `capability_version`

Policy は **capability 既定値 × action 上書き × runtime context** で最終 Risk/Mode を決定する。

---

## 4. Feature Flag 契約

### 4.1 責務分離

| 機構 | 用途 |
| --- | --- |
| **Feature Flag** | 通常運用の有効化・段階公開・Staging 限定・ベータ・サービス別停止 |
| **Emergency Stop** | 障害・セキュリティ・異常利用・緊急遮断 |

### 4.2 状態

`disabled` · `staging_only` · `internal_only` · `beta` · `enabled`

### 4.3 スコープ

`global` · `environment` · `tenant` · `target_service` · `capability` · `action_type` · `executor` · `provider` · `model`

### 4.4 `ai_feature_flags`（論理）

| Field | 役割 |
| --- | --- |
| `flag_key` | 識別子 |
| `scope_type` / `scope_value` | 適用範囲 |
| `state` | 上記状態 |
| `capability_key` / `action_type` / `target_service` | 任意の絞り込み |
| `executor_name` / `provider` / `model` | 任意 |
| `environment` | `staging` · `production` 等 |
| `reason` / `updated_by` / `updated_at` | 運用メタ |
| `expires_at` | 任意の期限 |

評価時: 最も具体的なスコープが優先。`disabled` / 環境不一致（例: Production で `staging_only`）は実行拒否 → `blocked`（reason: `feature_flag`）。

---

## 5. Policy Engine 評価順（確定）

実行前に **毎回** この順で評価する。途中失敗で停止し append-only イベントを残す。

1. Authentication / Authorization  
2. Permanent Deny（ポリシーまたは Capability 永久禁止）  
3. Emergency Stop（毎回再評価）  
4. Feature Flag  
5. Schema Validation（payload schema · size · allowlist）  
6. Risk / Execution Mode 解決（capability 既定 + action + context）  
7. Budget / Rate Limit  
8. Approval / Confirmation 要件  
9. Idempotency / Concurrency  
10. Executor Routing（allowlist · version）

---

## 6. Actor / Initiator / Approver

### 6.1 責務

| 役割 | 意味 | 保存先 |
| --- | --- | --- |
| **initiator** | 要求を開始した主体 | `initiator_type` · `initiator_id` |
| **actor** | ゲートに対して実際に create/execute を発行した主体 | `actor_type` · `actor_id` · 任意 `actor_instance_id` |
| **approver** | 人間の承認判断者 | `ai_approvals.approver_id`（JWT subject） |
| **delegated_by** | actor が代理実行している場合の委任元 | `delegated_by_actor_type` · `delegated_by_actor_id` |

同一意味のフィールドを増やしすぎない。**initiator / actor / approver** の三役割で追跡する。

### 6.2 `actor_type` / `initiator_type`

`human` · `system` · `service` · `cron` · `agent` · `mcp`

### 6.3 例

| シナリオ | initiator | actor | approver |
| --- | --- | --- | --- |
| 運営者がダッシュボードから日次レポート | human | human | —（LOW AUTO） |
| Cron が起票し service が実行 | cron | service | — |
| Agent が提案、人間が承認後に service 実行 | agent | service | human |
| MCP ツールが下書き作成 | mcp | mcp | human（MEDIUM+） |

`actor_id` は JWT subject / service 名 / cron job id / agent id / mcp tool id。クライアント申告の user_id は禁止。

---

## 7. 論理エンティティ一覧

| ID | エンティティ | 役割 |
| --- | --- | --- |
| A | `ai_execution_requests` | 要求正本（+ capability_key/version · actor/initiator） |
| B | `ai_execution_events` | append-only 監査 |
| C | `ai_proposals` | 人間向け提案 |
| D | `ai_approvals` | 承認判断 |
| E | `ai_execution_results` | 結果（要求から分離） |
| F | `ai_budget_policies` | 予算 |
| G | 利用実績・原価 | **SAFE-06/07 正本**（ゲートは execution_id でリンク） |
| H | `ai_policy_definitions` | 版付きルール |
| I | `ai_emergency_controls` | 緊急停止 |
| J | `ai_notifications` | 内部通知追跡（外部送信なし） |
| K | `ai_capability_definitions` | Capability カタログ |
| L | `ai_feature_flags` | 段階公開フラグ |

### 7.1 `ai_execution_requests` 主要フィールド（要約）

必須候補:

- `capability_key` · `capability_version`
- `actor_type` · `actor_id` · `actor_instance_id?`
- `initiator_type` · `initiator_id`
- `delegated_by_actor_type?` · `delegated_by_actor_id?`
- `risk_level` · `business_priority` · `urgency` · `execution_mode`（混在禁止）
- `payload_hash` · `idempotency_key` · `correlation_id` · `causation_id` · `parent_execution_id`
- ライフサイクル時刻 · `execution_attempts` · `max_attempts` · `timeout_ms`
- `emergency_stop_snapshot` · `policy_version` · `executor_name` · `executor_version`

### 7.2 結果・監査の禁止事項

保存しない: プロンプト全文 · 回答全文 · 秘密情報 · 生トークン · 認証情報 · メール本文全文の通常監査複製。

保存可: サニタイズ要約 · 外部 message id 参照 · メトリクス · error_code · output_reference（保持期限付き）。

---

## 8. 状態機械（`execution_status`）

`draft` · `policy_checking` · `blocked` · `proposed` · `awaiting_approval` · `changes_requested` · `approved` · `awaiting_confirmation` · `queued` · `running` · `retry_wait` · `succeeded` · `partially_succeeded` · `failed` · `rejected` · `deferred` · `cancelled` · `expired`

### 許可遷移例

**LOW AUTO**

`draft → policy_checking → queued → running → succeeded|failed|blocked`

**MEDIUM 承認**

`draft → policy_checking → proposed → awaiting_approval ⇄ changes_requested → approved → [awaiting_confirmation] → queued → running → succeeded`

**HIGH DENIED / permanent deny**

`draft → policy_checking → blocked`  
（または提案まで許可し実行パスは DENIED）

不正遷移は拒否し `reason_code=illegal_transition` を追記。

---

## 9. Proposal / Approval / Human Gate UI

運営者操作: 承認 · 却下 · 修正して承認 · 変更依頼 · 後回し · 詳細 · 実行 · キャンセル

Proposal 必須表示: 何をするか · 対象 · 理由 · 期待効果 · 変更内容 · リスク · 推定費用 · 実行後影響 · 戻せるか · 有効期限 · 推奨判断

承認後の payload / 宛先変更 → `payload_hash` 不一致で承認無効 · 再承認必須。

Diff & Approve は `diff_summary` / `preview_data` で将来接続（実装は Phase E）。

---

## 10. Cost / Budget / Idempotency / Concurrency / Retry

- 予算（包括）: daily/monthly/per_execution · soft（警告・切替候補）/ hard（blocked）
- **Phase B 確定:** SAFE-06/07 本格連携は Phase C。B はコード定数 hard cap（env / Staging 設定）· 超過は `blocked` · 自動超過/暗黙フォールバック禁止 · cap をフロント非露出
- モデル自動切替は品質・用途・ポリシー一致時のみ
- 冪等: `tenant + target_service + action_type + resource + logical_period + payload_hash`
- 再実行: new revision または `explicit_retry`
- 並列: `concurrency_key` + lease + optimistic version
- Retry 準備フィールドは持つが、無制限再試行禁止。Phase B は `max_attempts=1`。Self Correction は Phase H まで NO-GO

---

## 11. Emergency Stop

スコープ: `global` · `provider` · `model` · `target_service` · `action_type` · `executor` · `tenant` · `user`

実行前に毎回再評価。スナップショットは監査用。

---

## 12. Security / Privacy / Retention / Observability

- JWT subject 正本 · クライアント user_id 申告禁止 · `is_ops` サーバ確認
- service_role フロント禁止 · payload allowlist · schema/size · SSRF · URL/宛先 allowlist
- confirmation token: 期限・単回
- audit append-only
- 保持: メタ 24ヶ月 · 監査/コスト 36ヶ月+ · Proposal 12ヶ月 or 解決+90日 · 一時出力 7–30日 · PII は目的終了後に匿名化/削除を区別
- 観測: success/failure/blocked/approval/rejection rate · latency · cost · retries · duplicate prevention · emergency count · policy denial · executor error rate

---

## 13. Dashboard 契約

| 画面 | 内容 |
| --- | --- |
| 今日の概要 | 重要タスク · 承認待ち · 障害警告 · 売上 · 利用者対応 · API 予算 · システム状態 |
| 承認キュー | タイトル · サービス · 優先度 · リスク · 提案 · 費用 · 期限 · 承認/却下/修正/後回し |
| API・AI 利用 | 今日/今月費用 · 残予算 · サービス/モデル別 · 異常 · 上限接近 |

通知: ダッシュボード内部通知契約のみ。外部送信は HIGH 個別。

---

## 14. 問い合わせ返信への適合（将来 · Phase B 外）

```
受信（Gmail / TASFUL）
  → ingest → classify → summarize → draft reply
  → validate（禁止表現・PII・規約）
  → 承認キュー
  → 人間が修正/承認
  → 外部送信（Human Send Gate 必須）
```

| Capability | Risk | Mode（初期） |
| --- | --- | --- |
| `ingest_support_message` | LOW | AUTO / REPORT_ONLY |
| `classify_support_message` | LOW | AUTO |
| `summarize_support_message` | LOW | AUTO |
| `draft_support_reply` | MEDIUM | APPROVAL_REQUIRED |
| `validate_support_reply` | LOW–MEDIUM | AUTO or APPROVAL |
| `send_support_reply` | **HIGH** | **CONFIRMATION_REQUIRED または MANUAL_ONLY** · **permanent auto 禁止** |

送信時の承認対象: 送信先 · 件名 · 本文参照 · 添付メタ · 対象 message/thread。  
`payload_hash` 改ざん検知 · 二重送信防止の idempotency · 送信結果と外部 message id を監査（本文全文は通常監査へ複製しない）· PII 最小化と保持期限。

**適合判定: YES** — 現行ゲート契約で表現可能。Phase B には含めない。

---

## 15. 将来サービス適合（制御プレーン共有 · エンジン非統合）

Ops Secretary · TASFUL AI Workspace · Builder AI · Marketplace · TALK · TLV · ANPI · AI Page / SEO·NEWS · Support · Fraud · Code AI · Internal MCP · Agentic Cron

各製品エンジンは統合しない。共通化するのは安全制御・承認・監査・費用・実行契約のみ。

**音声ポートは予約しない。**

---

## 16. Phase 分割

| Phase | 内容 |
| --- | --- |
| **A** | 包括設計・正本化（本ドキュメント） |
| **B** | Staging LOW 縦スライス（日次未対応レポート） |
| **C** | 費用台帳接続・予算・可観測性 |
| **D** | Proposal + MEDIUM 承認耐久化 |
| **E** | Diff & Approve 接続 |
| **F** | 内部 MCP / Executor Port 追加 |
| **G** | Agentic Cron |
| **H** | 限定 Retry / Self Correction |
| **I** | AI 秘書の実処理拡張 |
| **J** | 各製品ポート追加 |

HIGH は個別設計・個別承認。一括解禁しない。**音声 Phase は設けない。**

---

## 17. 永久 NO-GO / 今回 NO-GO

**永久:** エンジン統合（AD-002/003/004）· Gateway へ DeepSeek 混在（AD-010）· Gateway 契約の安易破壊（AD-005）· 契約/決済/権限の自動確定（AD-006）· Production MCP · service_role フロント露出 · prompt/回答全文の監査保存 · HIGH 一括解禁 · 無制限リトライ · 音声専用契約・ポートの新設 · SAFE-06/07 二重台帳化

**今回（Phase A 作業）:** コード実装 · migration · DB 変更 · Production · Worker · Cron · MCP · Gmail 送信 · Diff&Approve · Self Correction · 音声 · commit · push · deploy

---

## 18. Phase A 正本化チェックリスト

| 項目 | 判定 |
| --- | --- |
| Risk / Priority / Mode 分離 | PASS |
| Capability / Action / Executor 分離 | PASS |
| Feature Flag / Emergency Stop 分離 | PASS |
| AI エンジンと制御プレーン分離 | PASS |
| SAFE-06/07 を原価正本として維持 | PASS（方針） |
| DeepSeek を Gateway に混在させない | PASS |
| 既存製品エンジンを統合・削除しない | PASS |
| prompt / response 全文を監査保存しない | PASS |
| HIGH 一括解禁しない | PASS |
| 音声契約を残さない | PASS |

**Phase A 正本化判定:** **FREEZE APPROVED（2026-07-28）** — 本ドキュメントは変更不可の正本。以降の変更は versioned amendment または後続 Phase 設計のみ。実装着手は Phase B Go 条件（[計画書](./AI_EXECUTION_GATE_PHASE_B_PLAN.md) · [チケット](./AI_EXECUTION_GATE_PHASE_B_TICKETS.md)）と明示指示を満たすまで NO-GO。

### Amendment 履歴

| 版 | 日付 | 内容 |
| --- | --- | --- |
| A-FREEZE | 2026-07-28 | 初回 FREEZE · Budget/Capability/Pipeline 実装方針確定 |

---

## 19. 参照（既存資産）

- JWT / `auth-ops-guard` / `requireSupabaseUser`
- Human Gate L1–L4 · Human Send Gate（マップ対象 · 耐久化は Phase D+）
- Daily Inbox · OpsContext · Morning Report
- DeepSeek Adapter · `/api/secretary-deepseek-chat`（AD-010）
- SAFE-05/06/07
- `ai-model-gateway.js`（触らない · AD-005）
