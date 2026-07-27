# AI 実行ゲート — Phase B 実装チケット（B1–B6）

**Status:** B1 PASS · **B2 PASS（local schema · 未 commit）** · B3 以降は着手指示待ち  
**最終更新:** 2026-07-28  
**計画正本:** [AI_EXECUTION_GATE_PHASE_B_PLAN.md](./AI_EXECUTION_GATE_PHASE_B_PLAN.md)  
**設計正本:** [AI_EXECUTION_GATE.md](./AI_EXECUTION_GATE.md)（FREEZE APPROVED 2026-07-28）

> B1: `_shared/ai-exec-gate-*.mjs` + B1 test（`6b92cad`）。B2: `20260728120000_ai_exec_gate_phase_b2.sql` + B2 test。各後続チケットは **明示的な着手指示**があるまで実装しない。Production 非接触 · Staging only · ops only。

---

## 依存関係（概要）

```
B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► B6
              │                ▲
              └────────────────┘（B5 は B3 GET 契約に依存 · B4 完了後に結合表示が完成）
```

| チケット | 依存 |
| --- | --- |
| **B1** | なし（最初に着手） |
| **B2** | B1 |
| **B3** | B1 · B2 |
| **B4** | B3 |
| **B5** | B3（最低限）· B4（E2E 表示完成） |
| **B6** | B1–B5 |

**Phase B 開始時の最初の 1 チケット: B1**

---

## 共通 NO-GO（全チケット）

Production 接続/変更 · Staging 以外への apply · Cron · Worker · MCP · Gmail/外部送信 · 業務データ変更 · MEDIUM/HIGH 実行 · Self Correction · Diff & Approve · 音声 · Gateway 契約変更 · SAFE-06/07 破壊 · Capability allowlist 外追加 · 子 execution · prompt/response 全文保存 · hard cap のフロント露出 · 自動超過/暗黙フォールバック · 指示なき commit/push/deploy

---

## B1 — 契約・定数・型・Feature Flag / Emergency Stop / hard cap

### 状態

**B1 PASS（コード実装 · 2026-07-28）** · commit / push は別途人間指示

### 目的

Phase B のコード定数・列挙・Flag/Stop/Budget hard cap・redaction の共有モジュールを追加し、後続 API が依存できる契約面を固定する。

### 対象ファイル

**新規**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-capabilities.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-flags.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-budget.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-types.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-redaction.mjs`
- `scripts/test-ai-exec-gate-phase-b1-constants.mjs`（または同等）

**変更:** なし（または最小の export 配線のみ）

### allowlist

- Capability: `collect_daily_ops` · `generate_ops_report` のみ
- action: `ops_secretary.daily_pending.report_pipeline` のみ
- flag key: `ai_exec_gate.phase_b.daily_ops_report`
- env: Staging hard cap 名（例 `AI_EXEC_GATE_PHASE_B_DAILY_HARD_CAP`）— フロント非公開

### 依存関係

なし（先頭）

### テスト

- allowlist 外 capability 拒否
- flag state 判定（staging_only / disabled）
- emergency stop true → deny
- hard cap 超過 → blocked 相当の判定結果
- redaction が禁止キーを落とす

### 完了条件

- 定数モジュールが計画の shape を満たす
- unit テスト PASS
- DB / API / UI 未接続でも単体で意味が通る

### NO-GO

共通 NO-GO · DB migration · HTTP API · Dashboard · DeepSeek 呼出

### rollback

新規ファイル削除のみ（他依存なし）

### commit 境界

`docs` は含めず（既に別途更新済なら触らない）。`_shared/ai-exec-gate-*.mjs` + B1 テストのみ選別ステージ。

---

## B2 — 最小 DB migration と RLS（監査スキーマ）

### 状態

**B2 PASS（3表 schema · local apply · B1/B2 テスト · 最終レビュー 2026-07-28）** · Staging/Production apply 未実施  
**Migration:** `supabase/migrations/20260728120000_ai_exec_gate_phase_b2.sql`  
**Test:** `node scripts/test-ai-exec-gate-phase-b2-db.mjs`  
**Notes:** `reports/ai-exec-gate-phase-b2-migration-notes.md`

### 目的

Staging 向けに execution 監査の最小スキーマと RLS（deny-all + service_role）を追加する。

**最終テーブル（3）:** `ai_execution_requests` · `ai_execution_events` · `ai_execution_results`

### 設定2表を採用しなかった理由（最終レビュー）

PLAN は `ai_feature_flags` / `ai_emergency_controls` を概念オブジェクトとして列挙するが、B1 で Feature Flag / Emergency Stop の **制御正本は env** である。B2 で mutable な DB 制御表を置くと二重正本になり、DB 変更だけで許可・stop 解除に見える経路ができる。よって B2 では **削除**し、request 上の flag/stop **snapshot 列のみ**で監査する。制御の DB 化は後続フェーズで明示決定するまで行わない。

### 対象ファイル

**新規 / 変更（B2 コミット対象）**

- `supabase/migrations/20260728120000_ai_exec_gate_phase_b2.sql`
- `scripts/test-ai-exec-gate-phase-b2-db.mjs`
- `reports/ai-exec-gate-phase-b2-migration-notes.md`
- 本チケット B2 節

**変更禁止:** FREEZE · PLAN · B1 modules

### allowlist

- 上記 3 表のみ（Capability テーブルシードなし · 設定2表なし · Gate API/RPC なし）
- Production apply スクリプトを作らない

### 依存関係

B1（列・列挙 · env 制御正本）

### テスト

- `node scripts/test-ai-exec-gate-phase-b1-constants.mjs`
- `node scripts/test-ai-exec-gate-phase-b2-db.mjs`
- local constraint / RLS probes（notes 参照）
- Staging apply は **別途人間承認後**

### 完了条件

- 3 表 · B1/FREEZE 契約整合 · RLS deny-all + 最小 service_role
- SAFE-06/07 に ALTER 破壊なし
- Production 向け apply 手順を文書に **書かない / No-Go 明記**
- Feature Flag / Emergency Stop が B1 env 正本のまま（DB で上書き不可）

### NO-GO

Production migration · Capability DB シード · proposals/approvals 本運用表 · データ backfill · B3 API/RPC · Staging/Production apply without approval

### rollback

Staging で Flag disabled · 必要なら table drop（人間判断）· migration 取り消しは Staging 限定 runbook

### commit 境界

migration SQL + test + notes + tickets B2 のみ。Functions/UI / B1 を混ぜない。

---

## B3 — Gate API と Policy 評価

### 状態

**B3 PASS（create / execute-stub / get · unit+mock+local DB · 2026-07-28）** · Staging/Production deploy 未実施 · commit は別途明示指示  
**Routes (PLAN):** `POST /api/ai-exec-gate/create` · `POST /api/ai-exec-gate/execute` · `GET /api/ai-exec-gate/:id`  
**Test:** `node scripts/test-ai-exec-gate-phase-b3-api.mjs`  
**Notes:** `reports/ai-exec-gate-phase-b3-api-notes.md`

### 目的

`create` / `execute`（stub）/ `get` の Cloudflare Pages Functions と Policy 評価順を実装する。execute の executor 本体は B4 接続点（本フェーズは状態遷移 stub のみ）。

### 対象ファイル

**新規**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-ops-auth.mjs`（JWT `is_ops` / `tasu_admin` · 既存 claim 正本の CF 移植）
- `deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-repository.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-http.mjs`
- `deploy/cloudflare/functions/api/ai-exec-gate/create.js`
- `deploy/cloudflare/functions/api/ai-exec-gate/execute.js`
- `deploy/cloudflare/functions/api/ai-exec-gate/[id].js`
- `scripts/test-ai-exec-gate-phase-b3-api.mjs`
- `reports/ai-exec-gate-phase-b3-api-notes.md`

**参照:** `supabase-jwt-auth.mjs` · B1 modules · B2 表（設定2表なし）

### allowlist

- action / capability / service / ports の固定 pipeline のみ
- ops JWT のみ（`app_metadata.is_ops` または `role=tasu_admin`）
- Feature Flag / Emergency Stop / Hard cap = B1 env 正本
- estimated cost = server 固定 `0.01` USD（client 指定禁止）

### 依存関係

B1 · B2

### テスト

- 非 ops → 401/403
- allowlist 外 → 4xx
- flag disabled / stop / hard cap → `blocked` + audit row/event
- 冪等キーで二重 create が同一 id · payload mismatch → 409
- execute stub 状態遷移 · results 未使用
- レスポンスに cap 生値なし
- B1/B2 regression PASS

### 完了条件

- Policy B サブセットがサーバ側で強制
- create/get 実装 · execute は stub（`queued` 維持 · provider なし · B4 で本接続）
- event 失敗時は 500 `event_persist_failed`（clean allowed にしない）
- prompt をログ/metadata に残さない
- migration 追加なし · FREEZE/PLAN 未変更

### NO-GO

DeepSeek 本接続（B4）· Dashboard（B5）· MEDIUM 承認 API · Production · migration · 設定2表復活

### rollback

Flag disabled · ルート削除 · 関数ファイル削除

### commit 境界

gate API + policy/service/repository + B3 テスト + tickets/notes。秘書 UI / DeepSeek / FREEZE / PLAN を混ぜない。

---

## B4 — Secretary executor 接続（deterministic pipeline）

### 状態

**B4 PASS（executor · atomic claim · deterministic collect/report · results · 2026-07-28）** · Staging/Production deploy 未実施 · commit は別途明示指示  
**Route:** `POST /api/ai-exec-gate/execute` → `executeGatePipeline`  
**Test:** `node scripts/test-ai-exec-gate-phase-b4-executor.mjs`  
**Notes:** `reports/ai-exec-gate-phase-b4-executor-notes.md`

### 目的

単一 pipeline 内で `ops_collector` → `secretary_deepseek`（**port 境界 · 外部 DeepSeek 非接続**）→ `gate_audit_writer` を接続し、日次未対応レポートを **deterministic** に完成させる。

### 対象ファイル

**新規**

- `deploy/cloudflare/functions/_shared/ai-exec-gate-executor.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-ops-collector.mjs`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-report-generator.mjs`
- `scripts/test-ai-exec-gate-phase-b4-executor.mjs`
- `reports/ai-exec-gate-phase-b4-executor-notes.md`

**変更**

- `deploy/cloudflare/functions/api/ai-exec-gate/execute.js`
- `deploy/cloudflare/functions/_shared/ai-exec-gate-repository.mjs`（atomic claim · insert-only result）
- `deploy/cloudflare/functions/_shared/ai-exec-gate-policy.mjs`（B4 event / failure codes）
- `deploy/cloudflare/functions/_shared/ai-exec-gate-service.mjs`（GET flags）
- 本チケット B4 節

**原則非変更**

- `deploy/cloudflare/functions/api/secretary-deepseek-chat.js`
- FREEZE / PLAN · B2 migration · admin-ai browser modules（B4 では edge fixture collector）

### allowlist

- Capability 2 つの内部 step のみ
- 外部送信・Gmail・業務テーブル UPDATE/DELETE なし
- **外部 AI provider call なし**（DeepSeek/OpenAI/Gemini/Claude）
- empty-safe deterministic collector + template report

### 依存関係

B3

### テスト

- collect が LLM を呼ばない
- report が deterministic（provider なし）
- events に step_* が並ぶ
- atomic claim · concurrent 拒否 · success replay · result overwrite 拒否
- timeout · collector/generator/result/event failure paths
- 失敗時 failed + サニタイズ error · running orphan log
- B1/B2/B3 regression

### 完了条件

- 1 execution で取得→要約→結果保存まで成功パス
- 子 execution なし
- AD-010 維持（Gateway 非混在 · DeepSeek Function 非接続）

### NO-GO

Orchestrator 大規模改修 · Human Send Gate 送信 · 問い合わせ送信 · max_attempts>1 · 外部 provider · migration

### rollback

execute を stub に戻す · Flag disabled

### commit 境界

executor + collector/report adapters + repository/policy + B4 テスト/notes。Dashboard HTML は B5。

---

## B5 — Dashboard 読取表示

### 目的

運営ダッシュボードに当日 pipeline 結果の読取表示を最小追加する。

### 対象ファイル

**新規**

- `admin-ai-exec-gate-client.js`

**変更**

- `admin-operations-dashboard.html`（最小枠）
- （必要なら）関連 CSS 最小

### allowlist

- get API のサニタイズ結果のみ表示
- 承認 UI・送信 UI を追加しない
- cap / secret 非表示

### 依存関係

B3 必須 · B4 で E2E 完成

### テスト

- 8788 で HTTP 200
- Console Error 0
- viewport 1280 / 768 / 390
- blocked/failed 時の汎用メッセージ

### 完了条件

- ops ユーザーが当日レポート状態を確認できる
- 非 ops で API 失敗が安全

### NO-GO

承認キュー本実装 · 音声 · レイアウト大改修（秘書 FROZEN 尊重）

### rollback

HTML 枠と client を除去 · 旧 Morning Report 表示に戻す

### commit 境界

client + dashboard 最小差分 + 表示確認メモ。migration を混ぜない。

---

## B6 — テスト・Staging 検証・証跡

### 目的

B1–B5 の統合回帰・Staging 検証・証跡レポートを完了し Phase B 縦スライスを閉じる。

### 対象ファイル

**新規**

- `scripts/test-ai-exec-gate-phase-b-suite.mjs`（または分割の統合ランナー）
- `reports/ai-exec-gate-phase-b-verification.md`

**変更:** テストの足りない assert のみ

### allowlist

- 検証・レポートのみ。機能追加禁止

### 依存関係

B1–B5

### テスト

- 計画 §16 の全項目
- Negative: 非 ops · flag · stop · cap · 二重実行 · allowlist 外
- 秘書既存回帰
- Staging only であることの記録

### 完了条件

- 統合テスト PASS
- 8788 証跡（HTTP Status · Console Error · Viewport）
- Phase B NO-GO 再確認チェックリスト完了
- Production 非接触の証明（変更環境の記述）

### NO-GO

新機能 · Production deploy · 追加 Capability

### rollback

なし（検証チケット）。問題発見時は Flag disabled で機能停止。

### commit 境界

tests + reports のみ。機能コードのついで直しは禁止（別チケットへ）。

---

## 着手順序（再掲）

1. **B1** ← Phase B 開始時の最初のチケット  
2. B2  
3. B3  
4. B4  
5. B5  
6. B6  

各チケット開始前に人間の明示指示を要する。
