# AI 実行ゲート — Phase B 実装計画（確定）

**Status:** 計画 **確定** · B1 完了（`6b92cad`）· B2 以降は明示指示後のみ  
**最終更新:** 2026-07-28  
**正本設計:** [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md)（**FREEZE APPROVED 2026-07-28**）  
**実装チケット:** [AI_EXECUTION_GATE_PHASE_B_TICKETS.md](./AI_EXECUTION_GATE_PHASE_B_TICKETS.md)  
**縦スライス（固定）:** AI秘書 → 今日の未対応案件取得 → レポート生成 → ゲート記録 → 監査保存 → 運営ダッシュボード表示

---

## 0. 環境・対象外（再確認）

| 項目 | 値 |
| --- | --- |
| 環境 | **Staging only** · **Production 非接触** |
| 利用者 | **ops only**（`is_ops` / `tasu_admin`） |
| Risk | **LOW** |
| Mode | **AUTO** または **REPORT_ONLY** |
| Priority | **NORMAL**（日次） |
| 外部送信 | **対象外** |
| 業務データ変更 | **対象外**（ゲート記録・監査・結果のみ） |
| Cron / Worker / MCP | **対象外** |
| Self Correction / Diff & Approve | **対象外** |
| MEDIUM / HIGH 処理 | **対象外** |
| 問い合わせ送信 / Gmail write | **対象外** |
| 音声 | **対象外** |
| Retry | `max_attempts=1` |
| LLM | 既存 DeepSeek Adapter 再利用（Gateway 非混在 · AD-010） |
| SAFE-06/07 | **壊さない** · 本格予算連携は **Phase C** |

---

## 0.1 確定した 3 設計判断（FREEZE 反映）

### 1. Budget

- SAFE-06/07 本格予算連携は **Phase C**
- Phase B は **コード側定数 hard cap**
- hard cap 超過時は **`blocked`**（reason: `budget_hard_cap`）
- **自動超過・暗黙フォールバック禁止**
- cap 値は **環境変数または Staging 専用設定**（例: `AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP`）
- **secret / 管理値 / 残予算の生値をフロントへ露出しない**（超過時は汎用メッセージ可）

### 2. Capability

- Phase B は **コード定数を正**
- **DB シード・管理画面・動的編集は行わない**
- allowlist **固定**（対象外 Capability を追加しない）:

| capability_key | version | 用途 |
| --- | --- | --- |
| `collect_daily_ops` | `1` | 未対応案件のプログラム取得 |
| `generate_ops_report` | `1` | レポート要約生成 |

- 将来の DB マスタ化に耐えるフィールド契約は維持（実装は定数オブジェクトで同等 shape）

### 3. Pipeline 粒度

- **単一 `ai_execution_request` pipeline**
- `action_type`（固定）: `ops_secretary.daily_pending.report_pipeline`
- 内部で `collect_daily_ops` → `generate_ops_report` → persist を順実行
- 内部 step は **`ai_execution_events`** および/または **result metadata** に記録
- **子 execution 分割は行わない**
- 将来、独立再実行・個別承認が必要になった場合のみ親子 execution へ拡張

---

## 1. 固定 allowlist（Phase B）

### Capability

`collect_daily_ops` · `generate_ops_report`

### action_type

`ops_secretary.daily_pending.report_pipeline` のみ（create/execute 受付）

### target_service

`ops_secretary` のみ

### Executor ports

`ops_collector` · `secretary_deepseek` · `gate_audit_writer`

### Feature flag key

`ai_exec_gate.phase_b.daily_ops_report`（初期 `staging_only`）

### 変更してよいパス（実装時）

下記 §2–3 に列挙したもののみ。allowlist 外の大規模秘書改修・Gateway・他製品は禁止。

---

## 2. 対象ファイル（既存 · 変更想定）

| パス | 役割 | チケット |
| --- | --- | --- |
| `admin-operations-dashboard.html` | 最小表示枠 | B5 |
| `admin-ai-daily-inbox.js` | 収集ロジック再利用（書込最小化） | B4 |
| `admin-ai-secretary-morning-report.js` | レポート材料再利用 | B4 |
| `admin-ai-secretary-ops-context.js` | 集計再利用 | B4 |
| `admin-ai-secretary-deepseek-adapter.js` | 要約呼び出し（契約維持） | B4 |
| `deploy/cloudflare/functions/api/secretary-deepseek-chat.js` | **原則非変更** | B4 参照のみ |
| `auth-ops-guard.js` | 参照のみ | B3 |

大規模 Orchestrator / Human Send Gate / Gmail write の書き換えは **禁止**。

---

## 3. 新規ファイル（固定候補）

| パス | 役割 | チケット |
| --- | --- | --- |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs` | Capability 定数 allowlist | B1 |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-flags.mjs` | Feature Flag / Emergency Stop 読取契約 | B1 |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-budget.mjs` | hard cap 判定（env） | B1 |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs` | Policy 評価順 | B3 |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-redaction.mjs` | サニタイズ | B1 |
| `deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs` | 状態・列挙定数 | B1 |
| `deploy/cloudflare/functions/api/ai-exec-gate-create.js` | create | B3 |
| `deploy/cloudflare/functions/api/ai-exec-gate-execute.js` | execute pipeline | B3+B4 |
| `deploy/cloudflare/functions/api/ai-exec-gate-get.js` | get | B3 |
| `admin-ai-exec-gate-client.js` | ダッシュボードクライアント | B5 |
| `supabase/migrations/*_ai_exec_gate_phase_b.sql` | Staging テーブル（B2 着手時のみ作成） | B2 |
| `scripts/test-ai-exec-gate-phase-b-*.mjs` | 回帰 | B6 |

---

## 4. DB 論理（B2 · SQL はチケット着手時）

**Production apply 禁止 · Staging only。**

| テーブル | B 必須列（要約） |
| --- | --- |
| `ai_execution_requests` | id · user_id · tenant_id? · capability_key/version · target_service · action_type · action_payload · payload_hash · risk_level · business_priority · execution_mode · execution_status · estimated_api_cost · budget_limit_snapshot · idempotency_key · actor_* · initiator_* · execution_attempts · max_attempts · executor_* · timestamps |
| `ai_execution_events` | append-only · sequence_number · event_type · statuses · sanitized_metadata |
| `ai_execution_results` | sanitized_summary · metrics · error_code · output_reference? · retention_until |
| `ai_feature_flags` | flag_key · scope · state（最小） |
| `ai_emergency_controls` | scope_type/value · is_stopped · reason |

**作らない:** `ai_capability_definitions` 行シード · `ai_proposals` / `ai_approvals` 本運用 · 二重コスト台帳

RLS: deny-all + service_role（SAFE-06 パターン）。

---

## 5. API 契約

| Method | Path | 役割 |
| --- | --- | --- |
| `POST` | `/api/ai-exec-gate/create` | 要求作成 · 冪等 |
| `POST` | `/api/ai-exec-gate/execute` | Policy → 単一 pipeline 実行 |
| `GET` | `/api/ai-exec-gate/:id` | 状態・サニタイズ結果 |

- Bearer JWT · ops 必須 · クライアント `user_id` 無視
- create は `action_type=ops_secretary.daily_pending.report_pipeline` のみ受付
- レスポンスに hard cap 生値・secret を含めない

---

## 6. Executor / Pipeline

```
execute(execution_id)
  → policy (Auth…Routing)
  → event: step_collect_start
  → ops_collector (プログラム · LLM なし)
  → event: step_collect_done (件数メタ)
  → event: step_report_start
  → secretary_deepseek (既存 Adapter)
  → event: step_report_done (model/latency のみ)
  → gate_audit_writer (result + succeeded)
```

失敗時: 該当 step の event + `failed` または policy 段階で `blocked`。

---

## 7–14. Policy / 状態 / Auth / Flag / Stop / 冪等 / 監査 / 費用

（正本 [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md) に準拠。B 特記のみ）

- 状態: `draft → policy_checking → queued → running → succeeded|failed|blocked`
- Flag: `ai_exec_gate.phase_b.daily_ops_report` = `staging_only`
- Stop: global / `ops_secretary` / capability スコープ
- 冪等: `tenant|ops_secretary|ops_secretary.daily_pending.report_pipeline|JST_day|payload_hash`
- 監査禁止: prompt / response 全文
- 費用: `estimated_api_cost` 必須 · SAFE-06 本格は Phase C · hard cap のみ B

---

## 15. Dashboard 表示（B5）

実行状態 · 未対応件数サマリ · sanitized 要約 · 超過/停止時の汎用メッセージ · 冪等再利用有無。  
承認ボタン列は不要。cap 生値非表示。

---

## 16. テスト計画（B6）

Unit: policy · flag · stop · hard cap · 冪等 · redaction · capability allowlist  
Contract: create/execute/get  
Browser: `http://127.0.0.1:8788` · HTTP 200 · Console Error 0 · 1280/768/390  
Negative: 非 ops · flag disabled · stop · cap 超過 · 二重実行 · allowlist 外 capability  
回帰: 既存秘書テスト維持

---

## 17. ロールバック

1. Feature Flag → `disabled`  
2. Emergency Stop  
3. Staging から API ルート除去  
4. UI フォールバック（旧 Morning Report）  
5. テーブル DROP は別判断（通常は読取停止）

---

## 18. 実装 allowlist / NO-GO

**Allow:** §2–3 のパス · Staging migration（B2）· 本計画範囲のテスト · 選別 docs

**NO-GO:** Production · Cron/Worker/MCP · 外部送信 · 業務書込 · MEDIUM/HIGH · Self Correction · Diff&Approve · 音声 · Gateway 契約変更 · SAFE 破壊 · Capability allowlist 外追加 · 子 execution · commit/push は人間指示時のみ

---

## Phase B Go 条件（更新）

1. Phase A **FREEZE APPROVED**（**済 · 2026-07-28**）  
2. 本計画の 3 判断・allowlist 凍結（**本更新で確定**）  
3. Staging 作業の明示承認  
4. AD-002/005/006/010 非違反確認  
5. **実装着手の明示指示**（チケット B1 から）  
6. 秘書 FROZEN 差分最小の確認（各チケット完了条件）

---

## 次アクション

B1 は完了済み。実装コードには進まない。次は人間が **B2 着手を明示指示**したときのみ [チケット](./AI_EXECUTION_GATE_PHASE_B_TICKETS.md) の B2 を開始する。
